const fs = require('fs/promises');
const path = require('path');
require('dotenv').config();
const mysql = require('mysql2/promise');

const run = async () => {
  const connection = await mysql.createConnection({
    host: process.env.SQL_HOST || 'localhost',
    user: process.env.SQL_USER || 'root',
    password: process.env.SQL_PASSWORD || '',
    database: process.env.SQL_DATABASE || 'trip_booking_sql',
    port: Number(process.env.SQL_PORT) || 3306,
    multipleStatements: true,
  });

  try {
    const sqlPath = path.join(__dirname, '..', 'database', 'international_catalog_seed.sql');
    const sql = await fs.readFile(sqlPath, 'utf8');
    await connection.query(sql);
    console.log('International catalog seed applied.');
  } finally {
    await connection.end();
  }
};

run().catch((error) => {
  console.error(`International catalog seed failed: ${error.message}`);
  process.exit(1);
});
