const cron = require('node-cron');
const db = require('./database.js');
const express = require('express');
const port = 3000;
const https = require('https');
const cheerio = require('cheerio');
var feedOptions = {
  hostname: 'runkeeper.com',
  path: '/moreFeed?showAvatars=false&count=9&lastFeedItemID=null&lastFeedItemPostTime=null&feedOwnerUrl=1569940756&includeFriends=true',
  method: 'GET'
}

var app = express();

cron.schedule('*/1 * * * *', () => {
  // console.log('Updating calendar data');
  // updateData();
});

app.get('/', function (req, res) {
  getActivities(res);
});

app.get('/sampleData', function (req, res) {
  db.run('INSERT INTO activities(name, date, rkId) VALUES\
  ("Test Name", "2020-04-09 10:02:00", 12345),\
  ("Name Test", "2020-04-09 10:02:00", 54321)');
  res.send('Database populated.');
});

function getActivities(res) {
  db.all('SELECT * FROM activities;', [], (err, rows) => {
    if (err) {
      console.error('Error retrieving activities: ' + err.message);
    }
    res.json(rows);
  });
};

function updateData() {
  let data = requestData();
  db.run('INSERT INTO activities(name, date, rkId) VALUES\
  ("Test Name", datetime(\'now\'), 12345)\
  ');
}

function updateCookie(callback) {
  db.get('SELECT * FROM cookies;', [], (err, row) => {
    if (err) {
      console.error('Error retrieving cookie: ' + err.message);
    }
    feedOptions.headers = { 'Cookie': row.value };
  });
}

function setCookie() {
  db.run('INSERT INTO cookies (value) VALUES ("%csrf=AAAAAfs6k8muhcQZLf3RrnA1gcf8jFQ6RaaOq6z55xxFzyHdyRQKIfyegpbzL_ncGd55U5lXaYROpI4tj3O679NWIKke6qEVTwW0LSswiiu2Y4pe7kzcOnyhVxI7glBD492QBqhSs8AYk3tD-5Ih0nEh_-LRkfeZ-mfQ5oYIAeVREW2yrVB2Yj7Xmb_2rCLZfTA6kgKEgmU4N66SohrHSlgRlnL0qiSZE3hjLcUqQA==;expires=Sun, 09-Apr-2023 11:29:42 GMT;path=/;HttpOnly;secure; SameSite=Strict");');
  setTimeout(updateCookie, 3000)
}

function requestData() {
  let req = https.request(feedOptions, function (res) {
    res.setEncoding('utf8');
    res.on('data', function (response) {
      var $ = cheerio.load(response);
      var elements = $('.feedItemContainer').each((i, elem) => {
        var time = elem.attribs['data-feeditemposttime'];
        var user = $('.usernameLinkNoSpace', elem);
        user.each((i, elem) => {
          console.log(elem.attribs['href'].split('/')[2]);
        });
      });
    })
  });
  req.on('error', function (res) {
    console.log('error');
    console.log(res);
  });
  req.end();
  setCookie();
}

app.listen(port, () => console.log(`Listening at http://localhost:${port}`))

setTimeout(updateData, 5000);