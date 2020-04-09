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
  console.log('Updating calendar data');
  updateData();
});

app.get('/', function (req, res) {
  getActivities(res);
});

app.get('/getManual', function (req, res) {
  updateData();
  res.send('Done');
});

function getActivities(res) {
  db.all('SELECT * FROM activities;', [], (err, rows) => {
    if (err) {
      console.error('Error retrieving activities: ' + err.message);
    }
    res.json(rows);
  });
};

function updateCookie() {
  db.all('SELECT * FROM cookies;', [], (err, rows) => {
    if (err) {
      console.error('Error retrieving cookie: ' + err.message);
    }
    let cookieString = rows.map(x => x.value).join('; ');
    // console.log(cookieString);
    feedOptions.headers = { 'Cookie': cookieString };
  });
}

function setCookies() {
  let cookies = [
    'checker=TO7ssklnsyzgFqKrXXPpRyUf;expires=Sun, 09-Apr-2023 11:56:05 GMT;path=/;HttpOnly;secure; SameSite=Strict',
    'lli=1586433365887;expires=Sun, 09-Apr-2023 11:56:05 GMT;path=/;HttpOnly;secure; SameSite=Strict',
    '%rlc=AAAAAcu2xV45pPl0sHyI4Y2Wn3inpuN0f8R0UslaHsHRUKL9jMBMg51_RPj1msE4tgUozEOOvYlP_A9HM1N9JgRb5fWeOOhf7Gv8EYLeh7n-EU_m7yBJi4J5iRFpwfcDU1HuOe-SLujCQFHD7j_OqloQw-ychbtkuwOrz6wek0cQhmAFJC_hBG33ElZI5N2RENWVO4qgpnSiagn20cHUCplKDuyOWiQ8j7ayWv6vB6pNxlU1E_TfhgaSfViT_aPRT3Xwqw==;expires=Sun, 09-Apr-2023 11:56:05 GMT;path=/;HttpOnly;secure; SameSite=Strict',
    '%csrf=AAAAAfHtXOHZeUZ2UfYNxb9bupkIOcY5Du9ubHnvf9fRCQqPrEkIkDfYDdzRKBqYkPVse8KaobKQOQD2GKrzWRu3GqGrra2Og8fnMMNWvH8gPVaRLJLtz0NV-2mVWmEAKHrUOIyOapgm0s-LCioE0WVs0uSeGxuv0VPI_lbojBtBoGEiYmHTv9K0VzfnDWeRH5vSR82-Mzn3D-NDWvX9zQeJPX2FHGBJECqwlVmYFg==;expires=Sun, 09-Apr-2023 11:56:05 GMT;path=/;HttpOnly;secure; SameSite=Strict',
    '%rlt=AAAAATIX9dxPOhJbwbDaljc8TTSZ8sjYDWgKTRISQyqll56zj_oVWJEBTe0RtB3w28j7iLarlFTgFzfMUKJFakHDXY_hGCIlCYvyhbqRhG2_v5jmKL_55avQ1KxS6HzUe8KmNlXts5Xpx8w7gKpslJBFqQQBLSfYXrOus8AYgD7Nfotd6FrGmVJlz-iDIULUN5NtEs1dmU93Jn4-30qUq6Pxi0_mvnyKxucNJ4ap0Qx2qEBo_vHwTbgIi4K7zzPY1Chu30BEyeiP;expires=Sun, 09-Apr-2023 11:56:05 GMT;path=/;HttpOnly;secure; SameSite=Strict'
  ];

  db.run('DELETE FROM cookies;');
  cookies.forEach(function (elem) {
    let query = 'INSERT INTO cookies (value) VALUES (\'' + elem + '\');';
    // console.log(query);
    db.run(query);
  });
  setTimeout(updateCookie, 3000);
}

function updateData() {
  let req = https.request(feedOptions, function (res) {
    res.setEncoding('utf8');
    let content = '';
    res.on('data', function (response) {
      content = content + response;
    });
    res.on('end', () => {

      let $ = cheerio.load(content);
      let elements = $('.feedItemContainer').each((i, elem) => {
        let time = elem.attribs['data-feeditemposttime'].split('T').join(' ');
        let userElem = $('.mainText .usernameLinkNoSpace', elem);
        let userId = userElem[0].attribs['href'].split('/')[2];
        let name = userElem.first().text();
        let activityId = $('.responseFormContainer input[name="parentObjectId"]', elem).first().val();
        // console.log(activityId);
        if (activityId.length != 10)
          return;
        console.log(userId + '-' + name + '-' + time + '-' + activityId);
        db.run('INSERT INTO activities(userId, name, date, rkId) VALUES\
        ("'+userId+'", "'+name+'", "'+time+'", "'+activityId+'")\
        ', [], function(err) {
          console.log(err);
        });
      });
      //setCookies();
      console.log('done');
    });
  });
  req.on('error', function (res) {
    console.log('error');
    console.log(res);
  });
  req.end();
}

app.listen(port, () => console.log(`Listening at http://localhost:${port}`))


updateCookie();
setTimeout(updateData, 5000);