# Helium Dashboard

![Dashboard](/images/dashboard.png)

## Note
If you have any questions, feel free to create an issue. I won't be able to hand hold anyone through the setup, but will be happy to answers simple questions. 

If you find this useful and would like to donate some HNT, the wallet is below:
`14FV9FqVXZXQo6UK5bMfy76fwTdxVQEz3mNf7WJLsrQEMNtM5jF`

![QR](/images/helium_wallet_qr.png)

## Overview
This dashboard setup collects data from Helium API and stores it in InfluxDB. Grafana reads the data from InfluxDB and presents it on the dashboard.

## Data capture
This node package collects data from Helium API. It's designed for AWS Lambda but can be run on any machine with Node.js. (If running on a machine with node, use `npm start`). This script does a single data collection and, therefore, must be run periodically (e.g., every 10 mins). Some example on how to do that:
* AWS Lambda function triggered by CloudWatch event
* Cron job on remote server (perhaps same one that runs Influx & Grafana)
* Cron job on local machine (if machine is asleep, it won't run)

### Env file
The supplied `.env.sample` contains necessary environment variables to be defined. Copy this file to `.env` and update with your parameters. Note that `.env` file is `.gitignore`'d.

## Server
The setup below assumes a Linux-like environment.

### Firewall
* allow-influx 0.0.0.0/0 TCP 8086

## HTTPS Certs (optional)
* Use Let's Encrypt instructions to get HTTPS certs. Specifically certbot.
* Allow reading domain cert directories: 
    * `sudo chmod ugo+x /etc/letsencrypt/live/{domain}/`
    * `sudo chmod ugo+x /etc/letsencrypt/archive/{domain}/`

## Influx

### Install
* https://docs.influxdata.com/influxdb/v2.0/get-started/

### Configure
* Influx 2.x - Update `/etc/influxdb/config.toml` with your config
* Restart influx: `sudo service influxdb start`
* Check for errors: `journalctl -f -u influxdb`

### Create influx bucket (if from scratch)
* See Influx docs
* This should match `INFLUX_BUCKET` env variable

### Import database backup (if restoring)
* Influx 2.x: `influx restore [path]`

### Create users
#### Influx 2.0
* Create user as per Influx docs

## Grafana

### Install
* https://grafana.com/docs/grafana/latest/installation/debian/
* Allow Grafana to bind on port 443 (if using HTTPS)
    * `sudo setcap 'cap_net_bind_service=+ep' /usr/sbin/grafana-server`


### Configure
* Update `/etc/grafana/grafana.ini` with your config

### Install plugins
```
sudo grafana-cli plugins install marcusolsson-json-datasource
```

### Import dashboard json (if new)
* Make sure to replace all instances of `helium-hotspot-address` in `helium_dashboard.json` with address of your helium hotspot.

### Migrate previous dashboards (if restoring)
* Copy `/var/lib/grafana/grafana.db`

### Start as service
```
sudo systemctl daemon-reload
sudo systemctl start grafana-server
sudo systemctl status grafana-server
```

To start on startup: 

```
sudo systemctl enable grafana-server.service
```
