const sqlPool = require('../config/sqlDb');
const mongoose = require('mongoose');
const Booking = require('../models/Booking');
const Destination = require('../models/Destination');
const Trip = require('../models/Trip');
const User = require('../models/User');
const Wishlist = require('../models/Wishlist');

const mongoId = (value) => String(value?._id || value);

const getSqlId = async (connection, table, id) => {
  if (!id) return null;
  const [rows] = await connection.query(
    `SELECT id FROM \`${table}\` WHERE mongo_id = ? LIMIT 1`,
    [mongoId(id)]
  );
  return rows[0]?.id || null;
};

const getExistingSqlId = async (connection, table, id) => {
  const sqlId = await getSqlId(connection, table, id);
  if (!sqlId) throw new Error(`SQL ${table} ${mongoId(id)} was not found`);
  return sqlId;
};

const syncUserInternal = async (connection, userOrId) => {
  const userId = mongoId(userOrId);
  const user = await User.findById(userId).select('+password');
  if (!user) throw new Error(`MongoDB user ${userId} was not found`);

  await connection.query(
    `INSERT INTO users
      (mongo_id, name, email, password_hash, phone, role, is_verified, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
      name = VALUES(name),
      email = VALUES(email),
      password_hash = VALUES(password_hash),
      phone = VALUES(phone),
      role = VALUES(role),
      is_verified = VALUES(is_verified),
      updated_at = VALUES(updated_at)`,
    [
      mongoId(user),
      user.name,
      user.email,
      user.password,
      user.phone || null,
      user.role,
      Boolean(user.is_verified),
      user.createdAt,
      user.updatedAt,
    ]
  );

  return getSqlId(connection, 'users', user);
};

const syncDestinationInternal = async (connection, destinationOrId) => {
  const destinationId = mongoId(destinationOrId);
  const destination = await Destination.findById(destinationId);
  if (!destination) throw new Error(`MongoDB destination ${destinationId} was not found`);

  await connection.query(
    `INSERT INTO destinations
      (mongo_id, city, province, country, category, image_url, price, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
      city = VALUES(city),
      province = VALUES(province),
      country = VALUES(country),
      category = VALUES(category),
      image_url = VALUES(image_url),
      price = VALUES(price),
      updated_at = VALUES(updated_at)`,
    [
      mongoId(destination),
      destination.city,
      destination.province,
      destination.country || 'Indonesia',
      destination.category || 'domestic',
      destination.image_url || null,
      destination.price,
      destination.createdAt,
      destination.updatedAt,
    ]
  );

  return getSqlId(connection, 'destinations', destination);
};

const syncTripInternal = async (connection, tripOrId) => {
  const tripId = mongoId(tripOrId);
  const trip = await Trip.findById(tripId);
  if (!trip) throw new Error(`MongoDB trip ${tripId} was not found`);

  const creatorId = trip.created_by
    ? await syncUserInternal(connection, trip.created_by)
    : null;

  const destinationRows = [];
  for (const item of trip.destinations) {
    destinationRows.push({
      id: await syncDestinationInternal(connection, item.destination_id),
      visitOrder: item.visit_order,
      notes: item.notes || null,
    });
  }

  await connection.query(
    `INSERT INTO trips
      (mongo_id, title, country, city, category, image_url, description, price, quota, start_date, end_date, status,
       created_by, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
      title = VALUES(title),
      country = VALUES(country),
      city = VALUES(city),
      category = VALUES(category),
      image_url = VALUES(image_url),
      description = VALUES(description),
      price = VALUES(price),
      quota = VALUES(quota),
      start_date = VALUES(start_date),
      end_date = VALUES(end_date),
      status = VALUES(status),
      created_by = VALUES(created_by),
      updated_at = VALUES(updated_at)`,
    [
      mongoId(trip),
      trip.title,
      trip.country || 'Indonesia',
      trip.city || null,
      trip.category || 'domestic',
      trip.image_url || null,
      trip.description || null,
      trip.price,
      trip.quota,
      trip.start_date,
      trip.end_date,
      trip.status,
      creatorId,
      trip.createdAt,
      trip.updatedAt,
    ]
  );

  const sqlTripId = await getSqlId(connection, 'trips', trip);
  await connection.query('DELETE FROM trip_destinations WHERE trip_id = ?', [sqlTripId]);
  for (const destination of destinationRows) {
    await connection.query(
      `INSERT INTO trip_destinations
        (trip_id, destination_id, visit_order, notes)
       VALUES (?, ?, ?, ?)`,
      [sqlTripId, destination.id, destination.visitOrder, destination.notes]
    );
  }

  return sqlTripId;
};

const syncBookingInternal = async (
  connection,
  bookingOrId,
  { previousStatus, recordHistory = false, changedBy = null, notes = null } = {}
) => {
  const bookingId = mongoId(bookingOrId);
  const booking = await Booking.findById(bookingId);
  if (!booking) throw new Error(`MongoDB booking ${bookingId} was not found`);

  const userId = await syncUserInternal(connection, booking.user_id);
  const tripId = booking.trip_id
    ? await syncTripInternal(connection, booking.trip_id)
    : null;
  const destinationId = booking.destination_id
    ? await syncDestinationInternal(connection, booking.destination_id)
    : null;

  await connection.query(
    `INSERT INTO bookings
      (mongo_id, user_id, trip_id, destination_id, booking_type, qty, visit_date,
       status, total_price, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
      user_id = VALUES(user_id),
      trip_id = VALUES(trip_id),
      destination_id = VALUES(destination_id),
      booking_type = VALUES(booking_type),
      qty = VALUES(qty),
      visit_date = VALUES(visit_date),
      status = VALUES(status),
      total_price = VALUES(total_price),
      updated_at = VALUES(updated_at)`,
    [
      mongoId(booking),
      userId,
      tripId,
      destinationId,
      booking.booking_type,
      booking.qty,
      booking.visit_date,
      booking.status,
      booking.total_price,
      booking.createdAt,
      booking.updatedAt,
    ]
  );

  const sqlBookingId = await getSqlId(connection, 'bookings', booking);
  if (recordHistory) {
    const changedById = changedBy
      ? await syncUserInternal(connection, changedBy)
      : null;
    await connection.query(
      `INSERT INTO booking_history
        (booking_id, changed_by, previous_status, new_status, notes)
       VALUES (?, ?, ?, ?, ?)`,
      [sqlBookingId, changedById, previousStatus || null, booking.status, notes]
    );
  }

  return sqlBookingId;
};

const runInTransaction = async (operation) => {
  const connection = await sqlPool.getConnection();
  try {
    await connection.beginTransaction();
    const result = await operation(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

const safeMirror = async (label, operation) => {
  try {
    await operation();
  } catch (error) {
    console.error(
      `SQL mirror failed: ${label} - ${error.code || 'ERROR'} - ${error.message}`
    );
  }
};

const deleteFromMirror = async (table, id) => {
  await runInTransaction(async (connection) => {
    await connection.query(`DELETE FROM \`${table}\` WHERE mongo_id = ?`, [mongoId(id)]);
  });
};

const syncUser = (user) => runInTransaction((connection) => syncUserInternal(connection, user));
const syncDestination = (destination) =>
  runInTransaction((connection) => syncDestinationInternal(connection, destination));
const syncTrip = (trip) => runInTransaction((connection) => syncTripInternal(connection, trip));
const syncBooking = (booking, options) =>
  runInTransaction((connection) => syncBookingInternal(connection, booking, options));
const syncPayment = (payment) =>
  runInTransaction(async (connection) => {
    const sqlBookingId = await syncBookingInternal(connection, payment.booking_id);
    const sqlUserId = await syncUserInternal(connection, payment.user_id);

    await connection.query(
      `INSERT INTO payments
        (mongo_id, booking_id, user_id, amount, method, proof_url, bank_name, card_last4, status,
         created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
        booking_id = VALUES(booking_id),
        user_id = VALUES(user_id),
        amount = VALUES(amount),
        method = VALUES(method),
        proof_url = VALUES(proof_url),
        bank_name = VALUES(bank_name),
        card_last4 = VALUES(card_last4),
        status = VALUES(status),
        updated_at = VALUES(updated_at)`,
      [
        mongoId(payment),
        sqlBookingId,
        sqlUserId,
        payment.amount,
        payment.method,
        payment.proof_url || null,
        payment.bank_name || null,
        payment.card_last4 || null,
        payment.status,
        payment.createdAt,
        payment.updatedAt,
      ]
    );
  });

const syncWishlist = (wishlist) =>
  runInTransaction(async (connection) => {
    const wishlistId = mongoId(wishlist);
    const item = await Wishlist.findById(wishlistId);
    if (!item) throw new Error(`MongoDB wishlist ${wishlistId} was not found`);

    const userId = mongoose.isValidObjectId(item.user_id)
      ? await syncUserInternal(connection, item.user_id)
      : await getExistingSqlId(connection, 'users', item.user_id);
    const tripId = item.trip_id
      ? mongoose.isValidObjectId(item.trip_id)
        ? await syncTripInternal(connection, item.trip_id)
        : await getExistingSqlId(connection, 'trips', item.trip_id)
      : null;
    const destinationId = item.destination_id
      ? mongoose.isValidObjectId(item.destination_id)
        ? await syncDestinationInternal(connection, item.destination_id)
        : await getExistingSqlId(connection, 'destinations', item.destination_id)
      : null;

    await connection.query(
      `INSERT INTO wishlists
        (mongo_id, user_id, trip_id, destination_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
        user_id = VALUES(user_id),
        trip_id = VALUES(trip_id),
        destination_id = VALUES(destination_id),
        updated_at = VALUES(updated_at)`,
      [
        mongoId(item),
        userId,
        tripId,
        destinationId,
        item.created_at || item.createdAt,
        item.updated_at || item.updatedAt || new Date(),
      ]
    );
  });

const deleteDestination = (destination) => deleteFromMirror('destinations', destination);
const deleteTrip = (trip) => deleteFromMirror('trips', trip);
const deleteUser = (user) => deleteFromMirror('users', user);
const deleteBooking = (booking) => deleteFromMirror('bookings', booking);
const deletePayment = (payment) => deleteFromMirror('payments', payment);
const deleteWishlist = (wishlist) => deleteFromMirror('wishlists', wishlist);

module.exports = {
  deleteBooking,
  deleteDestination,
  deletePayment,
  deleteTrip,
  deleteUser,
  deleteWishlist,
  safeMirror,
  syncBooking,
  syncDestination,
  syncPayment,
  syncTrip,
  syncUser,
  syncWishlist,
};
