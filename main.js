const cron = require('node-cron');
const db = require('./database.js');
const express = require('express');
const port = 3000;
const https = require('https');
const cheerio = require('cheerio');
const path = require('path');

// How many times we will request more from the feed every hour
const recurseLimit = 15;

var app = express();

// Serve static content from this URL
app.use(express.static('public/'));

var requestCookies = '';

cron.schedule('0 * * * *', () => {
  // Update the calendar data every hour
  console.log('Updating calendar data');
  updateData();
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
  updateData('null', 'null', req.params.cycles);
  res.send("OK");
});

app.get('/seedCookies', function (req, res) {
  // Some placeholder cookies, replace this with your own cookies when you first run the program
  let cookies = [
    'AWSALBTG=5y/yKZXLFwosvzYTdlrhcE4HAzerpRnUkcvn5GeD+Crl+hZZHl6M/SJKBE7x37NLHAWgqJVR+Ci1J9Oy/dUhWg1e8BlU51iYiZL1SQzjrp3DnRNqf1c5ZWJuwy6jxCmjyZh4qnaitlJ1N2z0zwywe0neyX1xtoVoO1uTFyM/c/C2; Expires=Mon, 20 Apr 2020 17:34:19 GMT; Path=/',
    'AWSALBTGCORS=5y/yKZXLFwosvzYTdlrhcE4HAzerpRnUkcvn5GeD+Crl+hZZHl6M/SJKBE7x37NLHAWgqJVR+Ci1J9Oy/dUhWg1e8BlU51iYiZL1SQzjrp3DnRNqf1c5ZWJuwy6jxCmjyZh4qnaitlJ1N2z0zwywe0neyX1xtoVoO1uTFyM/c/C2; Expires=Mon, 20 Apr 2020 17:34:19 GMT; Path=/; SameSite=None; Secure',
    'checker=TO7ssklnsyzgFqKrXXPpRyUf;expires=Thu, 13-Apr-2023 17:34:19 GMT;path=/;HttpOnly;secure; SameSite=Strict',
    'lli=1586799259408;expires=Thu, 13-Apr-2023 17:34:19 GMT;path=/;HttpOnly;secure; SameSite=Strict',
    '%csrf=AAAAATNrMcj7KNYy9TXG7LPkVFf8-7myOPR3T0Et6Abhrb9Zy9K-F4elNRfl2xyXiCtKk0MTBiPGIjupDTihf5pHKiYWmCPYV8a9Lg0L9eepeKd1JccNPrkZ0cCM36xB5BwupLJoOh70TE0bizbDDVIFTBtts5rHsu1kiAu6uhrcWIKarrJkFEEirNT9qvOyC-8qDrTmICloPj4jAJU8vVXNvYN7Zax2b4RWUl581A==;expires=Thu, 13-Apr-2023 17:34:19 GMT;path=/;HttpOnly;secure; SameSite=Strict'
  ];

  // Insert all cookies into DB so they can be retrieved from and updated there
  cookies.forEach(function (elem) {
    let query = 'INSERT INTO cookies (value) VALUES (\'' + elem + '\');';
    db.run(query);
  });

  // Input into global cookies object
  requestCookies = cookies.join('; ');
});

function setCookies(cookies) {
  // Clear old cookies from DB
  db.run('DELETE FROM cookies;');

  // Insert new cookies to DB
  cookies.forEach(function (elem) {
    let query = 'INSERT INTO cookies (value) VALUES (\'' + elem + '\');';
    db.run(query);
  });

  // Input new cookies into global cookies object
  requestCookies = cookies.join('; ');
}

function updateData(lastId = 'null', lastPostTime = 'null', iteration = recurseLimit) {
  if (iteration <= 0) {
    // Stop, that's enough of recursion for now
    console.log('Data update finished, last id was: ' + lastId);
    return;
  }
  // Specify the values for the server we're trying to download activities from
  var feedOptions = {
    hostname: 'runkeeper.com',
    path: '/moreFeed?showAvatars=false&count=9&feedOwnerUrl=1569940756&includeFriends=true&lastFeedItemID=' + lastId + '&lastFeedItemPostTime=' + lastPostTime,
    method: 'GET',
    headers: { 'Cookie': requestCookies }
  }
  console.log('Running data request with path: ' + feedOptions.path);
  let req = https.request(feedOptions, function (res) {
    // Encoding needs to be set, otherwise we can't read the response
    res.setEncoding('utf8');

    // Save received cookies into DB
    setCookies(res.headers['set-cookie']);

    // As retrieved data can be large, we collect all the chunks sent and concatenate them until we're ready to parse the whole message
    let content = '';
    res.on('data', function (response) {
      content = content + response;
    });

    res.on('end', () => {

      let $ = cheerio.load(content);
      // For each item in feed
      let elements = $('.feedItemContainer').each((i, elem) => {
        // Parse data from the feed item
        let feedItemId = elem.attribs['data-feeditemid'];
        let feedItemPostTime = elem.attribs['data-feeditemposttime'];
        let time = elem.attribs['data-feeditemposttime'].split('T').join(' ');
        let mainText = $('.mainText', elem).first().text().trim().split(' ').filter(function (el) {
          // Filter out all of the empty whitespace that we get
          return el.trim() != '';
        });
        // If the mainText contains too many words, then we already know it's not a real activity
        if (mainText.length > 4) {
          var distance = mainText[mainText.length - 4];
          var activityType = mainText[mainText.length - 2];
        } else {
          // Not a real activity, move on
          return;
        }
        let userElem = $('.mainText .usernameLinkNoSpace', elem);
        let userId = userElem[0].attribs['href'].split('/')[2];
        let name = userElem.first().text();
        let activityId = $('.responseFormContainer input[name="parentObjectId"]', elem).first().val();

        // Remember new values for our next iteration
        lastId = feedItemId;
        lastPostTime = feedItemPostTime;

        if (activityId && activityId.length != 10)
          // This entry is not a real activity, do not insert to DB
          return;

        // Try to insert the activity to DB
        db.run('INSERT INTO activities(userId, name, date, rkId, rkFeedId, rkFeedTime, activityType, distance) VALUES\
        ("'+ userId + '", "' + name + '", "' + time + '", "' + activityId + '", "' + feedItemId + '", "' + feedItemPostTime + '", "' + activityType + '", ' + parseFloat(distance) + ')',
          [], function (err) {
            // Log out the parsed event information
            console.log(lastPostTime.split('T')[0] + '-' + name + '-' + activityType + '-' + distance + '-' + activityId);

            // Log the outcome of DB insertion
            if (err)
              //to-do Update if already exists?
              console.log('Already exists in DB');
            else
              console.log('Inserted to DB');
          });
      });

      // Recursive call
      updateData(lastId, lastPostTime, iteration - 1);
    });

  });
  req.on('error', function (res) {
    console.log('HTTP request error: ');
    console.log(res);
  });
  req.end();

}

app.listen(port, () => console.log(`Listening at http://localhost:${port}`));

// Initialize cookies from the DB
setTimeout(function () {
  db.all('SELECT * FROM cookies;', [], (err, rows) => {
    requestCookies = rows.map(x => x.value).join('; ');
  });
}, 5000);