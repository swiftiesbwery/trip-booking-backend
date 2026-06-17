require('dotenv').config();

const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const sqlPool = require('../src/config/sqlDb');
const User = require('../src/models/User');
const Wishlist = require('../src/models/Wishlist');

const API_BASE = process.env.API_BASE || `http://localhost:${process.env.PORT || 3000}/api`;

const fail = (message) => {
  throw new Error(message);
};

const request = async (path, { token, ...options } = {}) => {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
  const text = await response.text();
  const body = text ? JSON.parse(text) : null;
  if (!response.ok) {
    fail(`${options.method || 'GET'} ${path} failed: ${response.status} ${text}`);
  }
  return body;
};

const run = async () => {
  await mongoose.connect(process.env.MONGODB_URI);

  const user = await User.findOne({ role: 'user' }).sort({ createdAt: 1 });
  if (!user) fail('Tidak ada user role=user di MongoDB untuk test wishlist');

  const [[trip]] = await sqlPool.query(
    "SELECT mongo_id FROM trips WHERE status = 'active' ORDER BY id ASC LIMIT 1"
  );
  if (!trip?.mongo_id) fail('Tidak ada trip aktif di MySQL untuk test wishlist');

  const token = jwt.sign({ id: String(user._id) }, process.env.JWT_SECRET, {
    expiresIn: '10m',
  });

  const existing = await request('/wishlists', { token });
  for (const item of existing.data.wishlist || []) {
    if ((item.trip_id?._id || item.trip_id) === trip.mongo_id) {
      await request(`/wishlists/${item._id}`, { token, method: 'DELETE' });
    }
  }

  const created = await request('/wishlists', {
    token,
    method: 'POST',
    body: JSON.stringify({ trip_id: trip.mongo_id }),
  });
  const wishlistId = created.data.wishlist._id;
  console.log('POST wishlist OK:', wishlistId);

  const mongoWishlist = await Wishlist.findById(wishlistId);
  if (!mongoWishlist) fail('Wishlist tidak ditemukan di MongoDB setelah POST');

  const [[sqlCreated]] = await sqlPool.query(
    'SELECT COUNT(*) AS total FROM wishlists WHERE mongo_id = ?',
    [wishlistId]
  );
  if (Number(sqlCreated.total) !== 1) {
    fail('Wishlist tidak ditemukan di MySQL setelah POST');
  }
  console.log('MongoDB + MySQL insert verified');

  const listed = await request('/wishlists', { token });
  const listedItem = listed.data.wishlist.find((item) => item._id === wishlistId);
  if (!listedItem) fail('Wishlist baru tidak muncul di GET /wishlists');
  console.log('GET wishlist OK');

  await request(`/wishlists/${wishlistId}`, { token, method: 'DELETE' });
  console.log('DELETE wishlist OK');

  const mongoDeleted = await Wishlist.findById(wishlistId);
  if (mongoDeleted) fail('Wishlist masih ada di MongoDB setelah DELETE');

  const [[sqlDeleted]] = await sqlPool.query(
    'SELECT COUNT(*) AS total FROM wishlists WHERE mongo_id = ?',
    [wishlistId]
  );
  if (Number(sqlDeleted.total) !== 0) {
    fail('Wishlist masih ada di MySQL setelah DELETE');
  }
  console.log('MongoDB + MySQL delete verified');
};

run()
  .then(async () => {
    await mongoose.disconnect();
    await sqlPool.end();
    console.log('Wishlist end-to-end test OK');
  })
  .catch(async (error) => {
    console.error(error.message);
    await mongoose.disconnect().catch(() => {});
    await sqlPool.end().catch(() => {});
    process.exit(1);
  });
