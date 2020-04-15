const cron = require('node-cron');
const db = require('./database.js');
const httpWrapper = require('./httpRequests.js');
const express = require('express');
const port = 3000;
const path = require('path');


var app = express();

// Serve static content from this URL
app.use(express.static('public/'));


cron.schedule('0 * * * *', () => {
  // Update the calendar data every hour
  console.log('Updating calendar data');
  httpWrapper.updateData();
});

// Main view
app.get('/', function (req, res) {
  // Just send back the main html file, data will be retrieved by an http call there
  res.sendFile(path.join(__dirname + '/static/main.html'));
});

// Used by the main html to display data
app.get('/getData', function (req, res) {
  db.all('SELECT name, date, activityType, distance FROM activities WHERE date BETWEEN date("2020-04-01") AND date("2020-04-30");', [], (err, rows) => {
    if (err) {
      console.error('Error retrieving activities: ' + err.message);
    }

    res.json(rows);
  });
});

// For debugging purposes
app.get('/getAll', function (req, res) {
  db.all('SELECT * FROM activities;', [], (err, rows) => {
    res.json(rows);
  });
});

// Manually update the data by specifying how many feed pages we should go through
app.get('/download/:cycles', function (req, res) {
  //to-do Check if cycles is actually a number
  if (!req.params.cycles) {
    res.send("NOT OK");
    return;
  }
  httpWrapper.updateData('null', 'null', req.params.cycles);
  res.send("OK");
});

app.get('/seedCookies', function (req, res) {
  httpWrapper.seedCookies();
});

app.listen(port, () => console.log(`Listening at http://localhost:${port}`));
