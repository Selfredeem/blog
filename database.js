const mysql = require('mysql2');
const config = require('./config');

const database = mysql.createConnection({
    host:config.host,
    user:config.user,
    port:config.port,
    password:config.password,
    database:config.database
});

database.connect();

module.exports = database;