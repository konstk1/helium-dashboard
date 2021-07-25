'use strict';

require('dotenv').config();
const lambda = require('../index.js');
const helium = require('../src/helium');

const event = {
  event: '',
};

console.log('Running lambda...');
lambda.handler(event).then(response => console.log('Response: ', response)).catch(err => console.log('Error: ', err));

