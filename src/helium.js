const { DateTime } = require('luxon');
const { Client, RewardsV1, RewardsV2, PocReceiptsV1, Challenge} = require('@helium/http');
const { Influx, Point } = require('./influx');
const { default: axios } = require('axios');

// number of hours to go back to fetch hotspot activity
const HOTSPOT_LOOKBACK_HOURS = 4;

const heliumActivityMeasurement = 'helium_activity';

const helium = new Client();

const activityType = {
  rewards_v2: 'rewards',
  poc_receipts_v1: 'witnessed',
  poc_request_v1: 'challenge',
  state_channel_close_v1: 'data_transfer'
}

async function getPrice() {
  const response = await axios('https://api.coingecko.com/api/v3/simple/price?ids=helium&vs_currencies=USD');
  console.log('Helium: price:', response.data);

  const point = new Point("helium_price")
    .tag('source', 'CoinGecko')
    .floatField('USD', response.data.helium.usd);

  Influx.write.writePoint(point);
}

async function accountStats() {
  let response = await helium.accounts.get(process.env.HELIUM_WALLET);
  console.log('response :>> ', response);
}

async function processHotspotActivity(hotspotIdentifier, sinceDate) {
  let activities = [];
  let oldestTime = DateTime.now;
  let hotspot = await helium.hotspots.get(hotspotIdentifier);

  console.log('Helium: fetching activity since', sinceDate.toString(), 'for hotspot', hotspotIdentifier);
  let page = await hotspot.activity.list();

  // fetch all activities after specified date
  while(page.data.length > 0 || page.hasMore) {
    let acts = page.data.filter(a => DateTime.fromSeconds(a.time) >= sinceDate);
    activities.push(...acts);

    // console.log(`Page ${page.data.length} vs filtered ${acts.length}`)

    // if data was filtered out (timestamp was reached) or no more data, then stop here
    if (acts.length < page.data.length || !page.hasMore) {
      break;
    }

    page = await page.nextPage();
  }

  if (activities.length == 0) {
    console.log(`No activities since ${sinceDate.toString()} for hotspot ${hotspotIdentifier}`);
    return;
  }

  console.log(`Helium: fetched ${activities.length} activities (first ${DateTime.fromSeconds(activities[activities.length-1].time).toString()}) for hotspot ${hotspotIdentifier}`);
  // activities.map(act => console.log(DateTime.fromSeconds(act.time).toString()));

  // convert activities to Influx points
  const points = activities.map(act => {
    const point = new Point(heliumActivityMeasurement)
      .timestamp(DateTime.fromSeconds(act.time).toJSDate())
      .tag('hotspot', hotspotIdentifier)
      .tag('name', hotspot.name)
      .tag('geocode', (hotspot.geocode.shortCity + ", " + hotspot.geocode.shortStreet));

    if (act instanceof RewardsV1) {

      point.tag('type', 'rewards');
      point.floatField('reward', act.totalAmount.floatBalance);
      // console.log('Reward = ', act.totalAmount.floatBalance);

    } else if (act.type == 'poc_receipts_v1') {

      if (act.path[0].challengee == hotspotIdentifier) {
        point.tag('type', 'beacon_sent');
        // console.log('Beacon sent: witnesses ', act.path[0].witnesses.length);
      } else {
        point.tag('type', 'beacon_received');
      }

      // TODO: filter for isValid (find myself in witness list, save reason)

      point.intField('count', 1);
      point.intField('witnesses', act.path[0].witnesses.length);

    } else if (act.type == 'poc_request_v1') {

      point.tag('type', 'challenge');
      point.intField('count', 1);
      // console.log('Challenge');

    } else if (act.type == 'state_channel_close_v1') {

      point.tag('type', 'data_transfer');
      point.intField('packets', act.stateChannel.summaries[0].num_packets);
      point.intField('dc', act.stateChannel.summaries[0].num_dcs);
      // console.log('Transferred packets: ', act.stateChannel.summaries[0].num_packets);

    } else {

      // console.log('Invalid type: ', act.type);
      // console.log(act);
      return new Point(heliumActivityMeasurement);  // return blank point

    }
    return point;
  });

  Influx.write.writePoints(points);
}

async function processHeliumStats() {
  const response = await axios.get('https://api.helium.io/v1/stats');
  const data = response.data.data;
  console.log('Helium: collecting network stats');

  let point = new Point("helium_stats");
  point.timestamp(new Date());  // now

  point.intField('transactions', data.counts.transactions);
  point.intField('challenges', data.counts.challenges);
  point.intField('blocks', data.counts.blocks);

  point.intField('challenges_active', data.challenge_counts.active);

  Influx.write.writePoint(point);
}

async function processHelium() {
  console.log('Processing helium');
  let funcList = (process.env.HELIUM_HOTSPOT.split(",")).map(function (hotspot) {
    return processHotspotActivity(hotspot.trim(), DateTime.local().minus({ hours: HOTSPOT_LOOKBACK_HOURS }));
  });

  await Promise.all([
    ...funcList,
    processHeliumStats(),
    getPrice(),
  ]);

  await Influx.flush();
  console.log('Helium: Influx write success');
}

module.exports = {
  processHelium,
};
