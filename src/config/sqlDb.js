const mysql = require('mysql2/promise');

const sqlPool = mysql.createPool({
  host: process.env.SQL_HOST || 'localhost',
  user: process.env.SQL_USER || 'root',
  password: process.env.SQL_PASSWORD || '',
  database: process.env.SQL_DATABASE || 'trip_booking_sql',
  port: Number(process.env.SQL_PORT) || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

module.exports = sqlPool;
