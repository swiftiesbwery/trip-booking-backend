const fs = require('fs/promises');
const path = require('path');
require('dotenv').config();
const mongoose = require('mongoose');
const mysql = require('mysql2/promise');
const Destination = require('../src/models/Destination');

const isObjectId = (value) => typeof value === 'string' && mongoose.isValidObjectId(value);

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
    const sqlPath = path.join(__dirname, '..', 'database', 'domestic_destination_image_urls.sql');
    const sql = await fs.readFile(sqlPath, 'utf8');
    await connection.query(sql);

    const [rows] = await connection.query(
      `SELECT mongo_id, image_url
       FROM destinations
       WHERE category = 'domestic'
         AND image_url IS NOT NULL
         AND mongo_id IS NOT NULL`
    );

    const mongoRows = rows.filter((row) => isObjectId(String(row.mongo_id)));
    if (mongoRows.length && process.env.MONGODB_URI) {
      await mongoose.connect(process.env.MONGODB_URI);
      for (const row of mongoRows) {
        await Destination.updateOne(
          { _id: row.mongo_id },
          { $set: { image_url: row.image_url } }
        );
      }
      await mongoose.disconnect();
    }

    console.log(`Domestic destination image URLs applied. Mongo synced: ${mongoRows.length}`);
  } finally {
    await connection.end();
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  }
};

run().catch((error) => {
  console.error(`Domestic destination image URL seed failed: ${error.message}`);
  process.exit(1);
});
