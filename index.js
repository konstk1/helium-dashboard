const {Influx} = require('./src/influx');
const helium = require('./src/helium');

exports.handler = async (event, context) => {
  console.log('Node ver: ', process.version);
  console.log('Received event:', JSON.stringify(event, null, 2));

  Influx.open(); // open influx connection

  // right now there's only one task but in the future multiple tasks can be done in parallel
  let tasks = [
      // helium
      { name: 'Helium', promise: helium.processHelium(), },
    ];

  const results = await Promise.allSettled(tasks.map(t => t.promise));

  await Influx.close(); // we're done with influx, close it

  var firstFailure;

  results.forEach((r, idx) => {
    console.log(`${tasks[idx].name}: ${r.status}`);
    if (r.status === 'rejected') {
      console.log('  -> Error: ', r.reason.message);
      // first encountered failure will be thrown as error for the lambda result
      if (!firstFailure) {
        firstFailure = r.reason.message;
      }
    }
  })

  if (firstFailure) {
    throw firstFailure;
  }

  const response = 'Done';

  return response;
};