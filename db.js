// FILE: db.js

const mysql = require('mysql2/promise');

const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    charset: process.env.DB_CHARSET,
    waitForConnections: true,
    connectionLimit: process.env.DB_CONN_LIMIT || 10,
    queueLimit: process.env.DB_QUE_LIMIT || 0
});

module.exports = { pool };