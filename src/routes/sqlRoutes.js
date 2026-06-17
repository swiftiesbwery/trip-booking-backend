const express = require('express');
const sqlPool = require('../config/sqlDb');
const Booking = require('../models/Booking');
const Destination = require('../models/Destination');
const Payment = require('../models/Payment');
const Trip = require('../models/Trip');
const User = require('../models/User');
const Wishlist = require('../models/Wishlist');

const router = express.Router();
const summaryTables = [
  'users',
  'trips',
  'destinations',
  'trip_destinations',
  'bookings',
  'payments',
  'booking_history',
];

const tableExists = async (table) => {
  const [rows] = await sqlPool.query(
    `SELECT COUNT(*) AS total FROM information_schema.tables
     WHERE table_schema = DATABASE() AND table_name = ?`,
    [table]
  );
  return Number(rows[0]?.total) > 0;
};

const countSqlTable = async (table) => {
  if (!(await tableExists(table))) return null;
  const [rows] = await sqlPool.query(`SELECT COUNT(*) AS total FROM \`${table}\``);
  return Number(rows[0].total);
};

const countMongoTables = async () => ({
  users: await User.countDocuments(),
  destinations: await Destination.countDocuments(),
  trips: await Trip.countDocuments(),
  bookings: await Booking.countDocuments(),
  payments: await Payment.countDocuments(),
  wishlists: await Wishlist.countDocuments(),
});

router.get('/health', async (req, res) => {
  try {
    await sqlPool.query('SELECT 1');
    res.json({ message: 'SQL connected successfully' });
  } catch (error) {
    res.status(503).json({
      message: 'SQL connection failed',
      error: error.message,
    });
  }
});

router.get('/summary', async (req, res) => {
  try {
    const counts = await Promise.all(
      summaryTables.map(async (table) => [table, await countSqlTable(table)])
    );
    const payload = Object.fromEntries(counts.filter(([, value]) => value !== null));
    if (await tableExists('wishlists')) {
      payload.wishlists = await countSqlTable('wishlists');
    }
    res.json(payload);
  } catch (error) {
    res.status(503).json({
      message: 'SQL summary unavailable',
      error: error.message,
    });
  }
});

router.get('/mirror-check', async (req, res) => {
  try {
    const mongoCounts = await countMongoTables();
    const sql = {};
    for (const table of ['users', 'destinations', 'trips', 'bookings', 'payments', 'wishlists']) {
      sql[table] = await countSqlTable(table);
    }
    res.json({
      users: { mongo: mongoCounts.users, sql: sql.users },
      destinations: { mongo: mongoCounts.destinations, sql: sql.destinations },
      trips: { mongo: mongoCounts.trips, sql: sql.trips },
      bookings: { mongo: mongoCounts.bookings, sql: sql.bookings },
      payments: { mongo: mongoCounts.payments, sql: sql.payments },
      wishlists: { mongo: mongoCounts.wishlists, sql: sql.wishlists },
    });
  } catch (error) {
    res.status(503).json({
      message: 'SQL mirror-check unavailable',
      error: error.message,
    });
  }
});

module.exports = router;
