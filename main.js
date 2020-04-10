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
  db.all('SELECT name, date, activityType, distance FROM activities;', [], (err, rows) => {
    if (err) {
      console.error('Error retrieving activities: ' + err.message);
    }
    let response = [];
    rows.map(x => {
      let temp = new Object();
      temp.title = x.name.split(' ')[0] + ' - ' + x.activityType + ': ' + x.distance + ' km';
      temp.start = x.date.split(' ')[0];
      response.push(temp);
    });
    res.json(response);
  });
});

app.get('/getAll', function (req, res) {
  db.all('SELECT * FROM activities;', [], (err, rows) => {
    res.json(rows);
  });
});

app.get('/', function (req, res) {
  res.sendFile(path.join(__dirname + '/static/main.html'));
});

app.get('/download', function (req, res) {
  updateData();
  res.send("OK");
});

function setCookies() {
  //to-do replace with a function parameter
  let cookies = [
    'checker=TO7ssklnsyzgFqKrXXPpRyUf;expires=Mon, 10-Apr-2023 18:42:56 GMT;path=/;HttpOnly;secure; SameSite=Strict',
    'lli=1586544176944;expires=Mon, 10-Apr-2023 18:42:56 GMT;path=/;HttpOnly;secure; SameSite=Strict',
    '%rlc=AAAAAcu2xV45pPl0sHyI4Y2Wn3inpuN0f8R0UslaHsHRUKL9jMBMg51_RPj1msE4tgUozEOOvYlP_A9HM1N9JgRb5fWeOOhf7Gv8EYLeh7n-EU_m7yBJi4J5iRFpwfcDU1HuOe-SLujCQFHD7j_OqloQw-ychbtkuwOrz6wek0cQhmAFJC_hBG33ElZI5N2RENWVO4qgpnSiagn20cHUCplKDuyOWiQ8j7ayWv6vB6pNxlU1E_TfhgaSfViT_aPRT3Xwqw==;expires=Sun, 09-Apr-2023 11:56:05 GMT;path=/;HttpOnly;secure; SameSite=Strict',
    '%csrf=AAAAAQSDfqPRssYSswojmal1QHWJ6TPOnr8mvcjZCK421vd5AFv8ovUPyiGleJyPK5-IhHwLGpEKDSa2VE5dXC55WHJSDTD4mfM-A6lSbdfGF9mpHvWNN-I2Ggl3pfwy9I1xPewZpuNkbigHmT7F7q_jbYYOgTJnEKGwPkM2ZgwTV4_Lwk-fkUXq34DIT3YkE1nZmqk0ZszNwhgsJepiwhd6EYFYLWV8JRAyfITW;expires=Mon, 10-Apr-2023 18:42:57 GMT;path=/;HttpOnly;secure; SameSite=Strict',
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
        let mainText = $('.mainText', elem).first().text().trim().split(' ').filter(function (el) {
          return el.trim() != '';
        });
        if (mainText.length > 4) {
          var distance = mainText[mainText.length - 4];
          var activityType = mainText[mainText.length - 2];
        } else {
          //Not a real activity
          return;
        }
        let userElem = $('.mainText .usernameLinkNoSpace', elem);
        let userId = userElem[0].attribs['href'].split('/')[2];
        let name = userElem.first().text();
        let activityId = $('.responseFormContainer input[name="parentObjectId"]', elem).first().val();

        //Remember new values for our next iteration
        lastId = feedItemId;
        lastPostTime = feedItemPostTime;

        console.log(name + '-' + activityType + '-' + distance + '-' + activityId);

        if (activityId && activityId.length != 10)
          //This entry is not a real activity, do not insert to DB
          return;
        console.log('inserting');
        db.run('INSERT INTO activities(userId, name, date, rkId, rkFeedId, rkFeedTime, activityType, distance) VALUES\
        ("'+ userId + '", "' + name + '", "' + time + '", "' + activityId + '", "' + feedItemId + '", "' + feedItemPostTime + '", "' + activityType + '", ' + parseFloat(distance) + ')',
        [], function (err) {
          //Ignore the error, it's PROBABLY unique constraint failing.
          // console.log(err);
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