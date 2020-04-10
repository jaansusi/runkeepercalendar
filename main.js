const cron = require('node-cron');
const db = require('./database.js');
const express = require('express');
const port = 3000;
const https = require('https');
const cheerio = require('cheerio');
const path = require('path');

const recurseLimit = 5;

var app = express();
// app.set('views', './views');
// app.set('view engine', 'pug');
app.use(express.static('public/'));

var requestCookies = '';

cron.schedule('*/1 * * * *', () => {
  // console.log('Updating calendar data');
  // updateData();
});

app.get('/getData', function (req, res) {
  db.all('SELECT name, date FROM activities;', [], (err, rows) => {
    if (err) {
      console.error('Error retrieving activities: ' + err.message);
    }
    let response = [];
    rows.map(x => {
      let temp = new Object();
      temp.title = x.name.split(' ')[0];
      temp.start = x.date.split(' ')[0];
      response.push(temp);
    });
    res.json(response);
  });
});

app.get('/', function (req, res) {
  res.sendFile(path.join(__dirname + '/static/main.html'));
});

function setCookies() {
  //to-do replace with a function parameter
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
    db.run(query);
  });
  requestCookies = cookies.join('; ');
}

function updateData(lastId = 'null', lastPostTime = 'null', iteration = 0) {
  if (iteration >= recurseLimit) {
    //Stop, that's enough
    console.log('Data update finished, last id was: ' + lastId);
    console.log(iteration);
    return;
  }
  var feedOptions = {
    hostname: 'runkeeper.com',
    path: '/moreFeed?showAvatars=false&count=9&feedOwnerUrl=1569940756&includeFriends=true&lastFeedItemID=' + lastId + '&lastFeedItemPostTime=' + lastPostTime,
    method: 'GET',
    headers: { 'Cookie': requestCookies }
  }
  console.log('Running data request with path: ' + feedOptions.path);
  let req = https.request(feedOptions, function (res) {
    res.setEncoding('utf8');

    //to-do save renewed cookies to DB
    //setCookies();

    let content = '';
    res.on('data', function (response) {
      content = content + response;
    });
    res.on('end', () => {

      let $ = cheerio.load(content);
      let elements = $('.feedItemContainer').each((i, elem) => {
        let feedItemId = elem.attribs['data-feeditemid'];
        let feedItemPostTime = elem.attribs['data-feeditemposttime'];
        let time = elem.attribs['data-feeditemposttime'].split('T').join(' ');
        let userElem = $('.mainText .usernameLinkNoSpace', elem);
        let userId = userElem[0].attribs['href'].split('/')[2];
        let name = userElem.first().text();
        let activityId = $('.responseFormContainer input[name="parentObjectId"]', elem).first().val();

        //Remember new values for our next iteration
        lastId = feedItemId;
        lastPostTime = feedItemPostTime;

        console.log(feedItemId + '-' + name + '-' + time + '-' + activityId);

        if (activityId.length != 10)
          //This entry is not a real activity, do not insert to DB
          return;
        db.run('INSERT INTO activities(userId, name, date, rkId, rkFeedId, rkFeedTime) VALUES\
        ("'+ userId + '", "' + name + '", "' + time + '", "' + activityId + '", "' + feedItemId + '", "' + feedItemPostTime + '")\
        ', [], function (err) {
          //Ignore the error, it's PROBABLY unique constraint failing.
          console.log(err);
        });


      });

      updateData(lastId, lastPostTime, iteration + 1);
    });

  });
  req.on('error', function (res) {
    console.log('HTTP request error: ');
    console.log(res);
  });
  req.end();

}

app.listen(port, () => console.log(`Listening at http://localhost:${port}`))

//Give some time for DB initialization
setTimeout(setCookies, 5000);
//setTimeout(updateData, 10000);