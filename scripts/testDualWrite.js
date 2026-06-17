require('dotenv').config();
const sqlPool = require('../src/config/sqlDb');

const API_URL = process.env.TEST_API_URL || 'http://localhost:3000';

const request = async (path, options = {}) => {
  const response = await fetch(`${API_URL}${path}`, options);
  const body = await response.json();
  if (!response.ok) {
    throw new Error(`${options.method || 'GET'} ${path} gagal (${response.status}): ${body.message}`);
  }
  return body;
};

const authHeaders = (token) => ({
  authorization: `Bearer ${token}`,
  'content-type': 'application/json',
});

const findMirror = async (table, id) => {
  const [rows] = await sqlPool.query(
    `SELECT * FROM \`${table}\` WHERE mongo_id = ? LIMIT 1`,
    [id]
  );
  if (!rows[0]) throw new Error(`${table} dengan mongo_id ${id} tidak ditemukan di SQL`);
  return rows[0];
};

const run = async () => {
  const suffix = Date.now();
  const admin = await request('/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      email: process.env.TEST_ADMIN_EMAIL || 'admin@gmail.com',
      password: process.env.TEST_ADMIN_PASSWORD || 'admin123',
    }),
  });

  const registered = await request('/api/auth/register', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      name: `Dual Write User ${suffix}`,
      email: `dual-write-${suffix}@example.com`,
      password: 'password123',
      phone: '081234567890',
    }),
  });
  const user = registered.data.user;
  await findMirror('users', user._id);

  const destinationResponse = await request('/api/admin/destinations', {
    method: 'POST',
    headers: authHeaders(admin.token),
    body: JSON.stringify({
      city: `Dual Write City ${suffix}`,
      province: 'Test Province',
      country: 'Indonesia',
      price: 100000,
    }),
  });
  const destination = destinationResponse.data.destination;
  let sqlDestination = await findMirror('destinations', destination._id);
  if (sqlDestination.city !== destination.city) {
    throw new Error('Destination belum tersinkronisasi ke SQL');
  }

  const destinationUpdate = await request(`/api/admin/destinations/${destination._id}`, {
    method: 'PATCH',
    headers: authHeaders(admin.token),
    body: JSON.stringify({
      city: `Dual Write City Updated ${suffix}`,
      province: 'Test Province',
      country: 'Indonesia',
      price: 150000,
    }),
  });
  sqlDestination = await findMirror('destinations', destination._id);
  if (sqlDestination.city !== destinationUpdate.data.destination.city || Number(sqlDestination.price) !== 150000) {
    throw new Error('Update destination belum tersinkronisasi ke SQL');
  }

  const tripResponse = await request('/api/admin/trips', {
    method: 'POST',
    headers: authHeaders(admin.token),
    body: JSON.stringify({
      title: `Dual Write Trip ${suffix}`,
      description: 'Data test dual write MongoDB ke SQL',
      price: 250000,
      quota: 10,
      start_date: '2027-01-10',
      end_date: '2027-01-12',
      destinations: [destination._id],
    }),
  });
  const trip = tripResponse.data.trip;
  const sqlTrip = await findMirror('trips', trip._id);
  const [tripDestinations] = await sqlPool.query(
    'SELECT * FROM trip_destinations WHERE trip_id = ?',
    [sqlTrip.id]
  );
  if (tripDestinations.length !== 1) {
    throw new Error('Relasi trip_destinations tidak tersinkronisasi');
  }

  const tripUpdate = await request(`/api/admin/trips/${trip._id}`, {
    method: 'PATCH',
    headers: authHeaders(admin.token),
    body: JSON.stringify({
      title: `Dual Write Trip Updated ${suffix}`,
      description: 'Data test dual write MongoDB ke SQL updated',
      price: 300000,
      quota: 12,
      start_date: '2027-01-11',
      end_date: '2027-01-13',
      destinations: [destination._id],
    }),
  });
  const sqlTripUpdated = await findMirror('trips', trip._id);
  if (
    sqlTripUpdated.title !== tripUpdate.data.trip.title ||
    Number(sqlTripUpdated.price) !== 300000 ||
    Number(sqlTripUpdated.quota) !== 12
  ) {
    throw new Error('Update trip belum tersinkronisasi ke SQL');
  }
  const [tripDestinationsAfterUpdate] = await sqlPool.query(
    'SELECT * FROM trip_destinations WHERE trip_id = ?',
    [sqlTripUpdated.id]
  );
  if (tripDestinationsAfterUpdate.length !== 1) {
    throw new Error('Update trip_destinations belum tersinkronisasi ke SQL');
  }

  const bookingResponse = await request('/api/bookings', {
    method: 'POST',
    headers: authHeaders(registered.token),
    body: JSON.stringify({
      booking_type: 'trip',
      trip_id: trip._id,
      qty: 2,
    }),
  });
  const booking = bookingResponse.data.booking;
  const sqlBooking = await findMirror('bookings', booking._id);
  const [historyAfterCreate] = await sqlPool.query(
    'SELECT * FROM booking_history WHERE booking_id = ? ORDER BY created_at ASC',
    [sqlBooking.id]
  );
  if (historyAfterCreate.length !== 1) {
    throw new Error('booking_history create belum tersinkronisasi');
  }

  const paymentResponse = await request(`/api/bookings/${booking._id}/payment`, {
    method: 'POST',
    headers: authHeaders(registered.token),
    body: JSON.stringify({
      method: 'QRIS',
      payment_proof: `https://example.com/payment-${suffix}.jpg`,
    }),
  });
  const payment = paymentResponse.data.payment;
  await findMirror('payments', payment._id);

  const verifyPayment = await request(`/api/admin/payments/${payment._id}/status`, {
    method: 'PATCH',
    headers: authHeaders(admin.token),
    body: JSON.stringify({ status: 'verified' }),
  });
  const sqlPayment = await findMirror('payments', payment._id);
  if (sqlPayment.status !== verifyPayment.data.payment.status) {
    throw new Error('Update payment belum tersinkronisasi ke SQL');
  }
  const sqlBookingAfterVerify = await findMirror('bookings', booking._id);
  if (sqlBookingAfterVerify.status !== 'confirmed') {
    throw new Error('Booking status setelah payment verified belum tersinkronisasi ke SQL');
  }
  const [history] = await sqlPool.query(
    'SELECT * FROM booking_history WHERE booking_id = ?',
    [sqlBooking.id]
  );
  if (history.length < 2) throw new Error('booking_history update belum tersinkronisasi');

  const summary = await request('/api/sql/summary');
  const mirrorCheck = await request('/api/sql/mirror-check');
  console.log('Dual-write test berhasil');
  console.log({
    mongoIds: {
      user: user._id,
      destination: destination._id,
      trip: trip._id,
      booking: booking._id,
      payment: payment._id,
    },
    summary,
    mirrorCheck,
  });
};

run()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => sqlPool.end());
