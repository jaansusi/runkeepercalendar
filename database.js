var sqlite3 = require('sqlite3');

let db = new sqlite3.Database('./db/calendar.db', (err) => {
    if (err) {
        return console.error('Error connecting to db: ' + err.message);
    }

    db.run('CREATE TABLE IF NOT EXISTS activities(\
        id INTEGER PRIMARY KEY,\
        name STRING NOT NULL,\
        userId INTEGER NULL,\
        date DATETIME NOT NULL,\
        rkId INTEGER NOT NULL\
        );');
    db.run('CREATE TABLE IF NOT EXISTS cookies(\
        id INTEGER PRIMARY KEY,\
        value STRING NOT NULL\
        );');
});

module.exports = db;
