const sqlPool = require('../config/sqlDb');
const mongoose = require('mongoose');
const Booking = require('../models/Booking');
const Destination = require('../models/Destination');
const Payment = require('../models/Payment');
const Trip = require('../models/Trip');
const Wishlist = require('../models/Wishlist');

const toNumber = (value) => (value === null || value === undefined ? value : Number(value));
const publicId = (row, prefix = '') => row.mongo_id || `${prefix}${row.id}`;
const sqlPublicId = (id, prefix) => {
  const value = String(id || '');
  return value.startsWith(prefix) ? value.slice(prefix.length) : value;
};
const sqlNumericId = (id, prefix) => {
  const value = sqlPublicId(id, prefix);
  return /^\d+$/.test(value) ? Number(value) : null;
};
const catalogError = (message, statusCode = 400) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};
const allowedCategories = new Set(['all', 'domestic', 'international']);
const normalizeCategory = (value = 'all') => {
  const category = String(value || 'all').toLowerCase();
  if (!allowedCategories.has(category)) {
    throw catalogError('Pilihan category tidak valid', 400);
  }
  return category;
};
const normalizeCatalogWriteCategory = (value, fallback = 'domestic') => {
  const category = String(value || fallback).toLowerCase();
  if (!['domestic', 'international'].includes(category)) {
    throw catalogError('Pilihan category tidak valid', 400);
  }
  return category;
};
const getSqlId = async (connection, table, id, prefix = `sql-${table.slice(0, -1)}-`) => {
  if (id === undefined || id === null || id === '') return null;
  const numericId = sqlNumericId(id, prefix);
  const [[row]] = await connection.query(
    `SELECT id FROM ${table} WHERE mongo_id = ? OR id = ? LIMIT 1`,
    [String(id), numericId]
  );
  return row?.id || null;
};
const mongoIds = (rows, field = 'mongo_id') =>
  [
    ...new Set(
      rows
        .map((row) => row[field])
        .filter((value) => value && mongoose.isValidObjectId(value))
        .map(String)
    ),
  ];
const publicIds = (rows, field) =>
  [...new Set(rows.map((row) => row[field]).filter(Boolean).map(String))];

const mapById = (items) =>
  new Map(items.map((item) => [String(item._id), item.toObject ? item.toObject() : item]));

const loadTripExtras = async (ids) => {
  const validIds = ids.filter((id) => mongoose.isValidObjectId(id));
  if (!validIds.length) return new Map();
  const trips = await Trip.find({ _id: { $in: validIds } })
    .select('image_url duration_days departure_date facilities itinerary created_by')
    .lean();
  return mapById(trips);
};

const loadDestinationExtras = async (ids) => {
  const validIds = ids.filter((id) => mongoose.isValidObjectId(id));
  if (!validIds.length) return new Map();
  const destinations = await Destination.find({ _id: { $in: validIds } })
    .select('image_url')
    .lean();
  return mapById(destinations);
};

const destinationFromRow = (row, extras = {}) => ({
  _id: publicId(row, 'sql-destination-'),
  id: row.id,
  city: row.city,
  name: row.city,
  province: row.province,
  location: [row.city, row.province, row.country].filter(Boolean).join(', '),
  country: row.country,
  category: row.category || 'domestic',
  image_url: row.image_url || extras.image_url,
  image: row.image_url || extras.image_url,
  price: toNumber(row.price),
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const userFromRow = (row) =>
  row
    ? {
        _id: row.user_mongo_id || row.mongo_id_user || publicId(row, 'sql-user-'),
        name: row.name,
        email: row.email,
        phone: row.phone,
        role: row.role,
        is_verified: Boolean(row.is_verified),
        createdAt: row.user_created_at || row.created_at,
        updatedAt: row.user_updated_at || row.updated_at,
      }
    : null;

const getUserByEmail = async (email) => {
  const [rows] = await sqlPool.query('SELECT * FROM users WHERE email = ? LIMIT 1', [
    email,
  ]);
  if (!rows.length) return null;
  const user = userFromRow(rows[0]);
  user.password_hash = rows[0].password_hash;
  return user;
};

const getUserByMongoId = async (id) => {
  const [rows] = await sqlPool.query('SELECT * FROM users WHERE mongo_id = ? LIMIT 1', [id]);
  return rows.length ? userFromRow(rows[0]) : null;
};

const paymentFromRow = (row) =>
  row && row.payment_mongo_id
    ? {
        _id: row.payment_mongo_id,
        booking_id: row.booking_mongo_id,
        user_id: row.user_mongo_id,
        amount: toNumber(row.payment_amount),
        method: row.payment_method,
        proof_url: row.payment_proof_url,
        bank_name: row.payment_bank_name,
        card_last4: row.payment_card_last4,
        status: row.payment_status,
        createdAt: row.payment_created_at,
        updatedAt: row.payment_updated_at,
      }
    : null;

const tripFromRow = (row, destinations = [], extras = {}, createdBy = null) => ({
  _id: publicId(row, 'sql-trip-'),
  id: row.id,
  title: row.title,
  name: row.title,
  country: row.country,
  city: row.city,
  category: row.category || 'domestic',
  image_url: row.image_url || extras.image_url || destinations[0]?.destination_id?.image_url,
  image: row.image_url || extras.image_url || destinations[0]?.destination_id?.image_url,
  description: row.description,
  destinations,
  price: toNumber(row.price),
  quota: toNumber(row.quota),
  seats: toNumber(row.quota),
  start_date: row.start_date,
  end_date: row.end_date,
  duration_days: extras.duration_days,
  departure_date: extras.departure_date || row.start_date,
  itinerary: extras.itinerary || [],
  facilities: extras.facilities || [],
  status: row.status,
  created_by: createdBy || extras.created_by || row.created_by_mongo_id || undefined,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const loadTripDestinations = async (tripIds) => {
  if (!tripIds.length) return new Map();
  const [rows] = await sqlPool.query(
    `SELECT
      td.trip_id,
      td.visit_order,
      td.notes,
      d.id,
      d.mongo_id,
      d.city,
      d.province,
      d.country,
      d.category,
      d.image_url,
      d.price,
      d.created_at,
      d.updated_at
     FROM trip_destinations td
     JOIN destinations d ON d.id = td.destination_id
     WHERE td.trip_id IN (?)
     ORDER BY td.visit_order ASC`,
    [tripIds]
  );
  const extraMap = await loadDestinationExtras(mongoIds(rows));
  const grouped = new Map();
  for (const row of rows) {
    if (!grouped.has(row.trip_id)) grouped.set(row.trip_id, []);
    grouped.get(row.trip_id).push({
      destination_id: destinationFromRow(row, extraMap.get(String(row.mongo_id))),
      visit_order: toNumber(row.visit_order),
      notes: row.notes,
    });
  }
  return grouped;
};

const listTrips = async ({
  search,
  destination,
  destination_id,
  city,
  category = 'all',
  minPrice,
  maxPrice,
  startDate,
  endDate,
  sort = 'name_asc',
  page,
  limit,
  activeOnly = true,
}) => {
  const selectedCategory = normalizeCategory(category);
  const where = [];
  const params = [];
  const joins = [];

  if (activeOnly) {
    where.push('t.status = ?');
    params.push('active');
  }
  if (selectedCategory !== 'all') {
    where.push('t.category = ?');
    params.push(selectedCategory);
  }

  if (search) {
    where.push('(t.title LIKE ? OR d_search.city LIKE ? OR d_search.province LIKE ? OR d_search.country LIKE ?)');
    joins.push('LEFT JOIN trip_destinations td_search ON td_search.trip_id = t.id');
    joins.push('LEFT JOIN destinations d_search ON d_search.id = td_search.destination_id');
    const term = `%${search}%`;
    params.push(term, term, term, term);
  }
  if (destination_id) {
    joins.push('JOIN trip_destinations td_filter ON td_filter.trip_id = t.id');
    joins.push('JOIN destinations d_filter ON d_filter.id = td_filter.destination_id');
    where.push('(d_filter.mongo_id = ? OR d_filter.id = ?)');
    params.push(destination_id, sqlNumericId(destination_id, 'sql-destination-'));
  } else if (destination || city) {
    joins.push('JOIN trip_destinations td_filter ON td_filter.trip_id = t.id');
    joins.push('JOIN destinations d_filter ON d_filter.id = td_filter.destination_id');
    where.push(
      '(d_filter.city LIKE ? OR d_filter.province LIKE ? OR d_filter.country LIKE ?)'
    );
    const term = `%${destination || city}%`;
    params.push(term, term, term);
  }
  if (minPrice !== undefined) {
    where.push('t.price >= ?');
    params.push(minPrice);
  }
  if (maxPrice !== undefined) {
    where.push('t.price <= ?');
    params.push(maxPrice);
  }
  if (startDate !== undefined) {
    where.push('t.start_date >= ?');
    params.push(startDate);
  }
  if (endDate !== undefined) {
    where.push('t.start_date <= ?');
    params.push(endDate);
  }

  const orderBy = {
    name_asc: 't.title ASC',
    departure_date: 't.start_date ASC',
    start_date: 't.start_date ASC',
    price_asc: 't.price ASC',
    price_desc: 't.price DESC',
    newest: 't.created_at DESC',
  }[sort];

  const baseFrom = `FROM trips t
    LEFT JOIN users u ON u.id = t.created_by
    ${joins.join('\n')}`;
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const countParams = [...params];
  const [countRows] = await sqlPool.query(
    `SELECT COUNT(DISTINCT t.id) AS total ${baseFrom} ${whereSql}`,
    countParams
  );
  const total = Number(countRows[0]?.total || 0);
  const [rows] = await sqlPool.query(
    `SELECT DISTINCT
      t.*,
      u.mongo_id AS created_by_mongo_id,
      u.name AS created_by_name,
      u.email AS created_by_email
     ${baseFrom}
     ${whereSql}
     ORDER BY ${orderBy}
     LIMIT ? OFFSET ?`,
    [...params, limit, (page - 1) * limit]
  );

  const destinationMap = await loadTripDestinations(rows.map((row) => row.id));
  const extrasMap = await loadTripExtras(mongoIds(rows));
  const trips = rows.map((row) =>
    tripFromRow(row, destinationMap.get(row.id) || [], extrasMap.get(String(row.mongo_id)), {
      _id: row.created_by_mongo_id,
      name: row.created_by_name,
      email: row.created_by_email,
    })
  );
  return { trips, total };
};

const getTripByMongoId = async (id, { activeOnly = true } = {}) => {
  const sqlTripId = sqlNumericId(id, 'sql-trip-');
  const [rows] = await sqlPool.query(
    `SELECT t.*, u.mongo_id AS created_by_mongo_id, u.name AS created_by_name
     FROM trips t
     LEFT JOIN users u ON u.id = t.created_by
     WHERE (t.mongo_id = ? OR t.id = ?) ${activeOnly ? "AND t.status = 'active'" : ''}
     LIMIT 1`,
    [id, sqlTripId]
  );
  if (!rows.length) return null;
  const row = rows[0];
  const destinationMap = await loadTripDestinations([row.id]);
  const extrasMap = await loadTripExtras([row.mongo_id]);
  return tripFromRow(row, destinationMap.get(row.id) || [], extrasMap.get(String(row.mongo_id)), {
    _id: row.created_by_mongo_id,
    name: row.created_by_name,
  });
};

const listDestinations = async ({
  search,
  page,
  limit,
  sort = 'name_asc',
  category = 'all',
}) => {
  const selectedCategory = normalizeCategory(category);
  const where = [];
  const params = [];
  if (search) {
    where.push('(city LIKE ? OR province LIKE ? OR country LIKE ?)');
    const term = `%${search}%`;
    params.push(term, term, term);
  }
  if (selectedCategory !== 'all') {
    where.push('category = ?');
    params.push(selectedCategory);
  }
  const orderBy = {
    name_asc: 'city ASC',
    price_asc: 'price ASC',
    price_desc: 'price DESC',
  }[sort];
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const [countRows] = await sqlPool.query(
    `SELECT COUNT(*) AS total FROM destinations ${whereSql}`,
    params
  );
  const [rows] = await sqlPool.query(
    `SELECT * FROM destinations ${whereSql} ORDER BY ${orderBy} LIMIT ? OFFSET ?`,
    [...params, limit, (page - 1) * limit]
  );
  const extraMap = await loadDestinationExtras(mongoIds(rows));
  return {
    destinations: rows.map((row) =>
      destinationFromRow(row, extraMap.get(String(row.mongo_id)))
    ),
    total: Number(countRows[0]?.total || 0),
  };
};

const getDestinationByMongoId = async (id) => {
  const sqlDestinationId = sqlNumericId(id, 'sql-destination-');
  const [rows] = await sqlPool.query(
    'SELECT * FROM destinations WHERE mongo_id = ? OR id = ? LIMIT 1',
    [id, sqlDestinationId]
  );
  if (!rows.length) return null;
  const extraMap = await loadDestinationExtras([id]);
  return destinationFromRow(rows[0], extraMap.get(id));
};

const listTripsForDestination = async (destinationId) => {
  const sqlDestinationId = sqlNumericId(destinationId, 'sql-destination-');
  const [rows] = await sqlPool.query(
    `SELECT t.*
     FROM trips t
     JOIN trip_destinations td ON td.trip_id = t.id
     JOIN destinations d ON d.id = td.destination_id
     WHERE (d.mongo_id = ? OR d.id = ?) AND t.status = 'active'
     ORDER BY t.start_date ASC`,
    [destinationId, sqlDestinationId]
  );
  const destinationMap = await loadTripDestinations(rows.map((row) => row.id));
  const extrasMap = await loadTripExtras(mongoIds(rows));
  return rows.map((row) =>
    tripFromRow(row, destinationMap.get(row.id) || [], extrasMap.get(String(row.mongo_id)))
  );
};

const ensureCatalogColumns = async () => {
  const ensureColumn = async (table, column, definition) => {
    const [rows] = await sqlPool.query(
      `SELECT COLUMN_NAME
       FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?
       LIMIT 1`,
      [table, column]
    );
    if (!rows.length) {
      await sqlPool.query(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    }
  };
  await ensureColumn('destinations', 'category', "VARCHAR(20) NOT NULL DEFAULT 'domestic' AFTER country");
  await ensureColumn('destinations', 'image_url', 'VARCHAR(500) NULL AFTER category');
  await ensureColumn('trips', 'country', "VARCHAR(120) NOT NULL DEFAULT 'Indonesia' AFTER title");
  await ensureColumn('trips', 'city', 'VARCHAR(120) NULL AFTER country');
  await ensureColumn('trips', 'category', "VARCHAR(20) NOT NULL DEFAULT 'domestic' AFTER city");
  await ensureColumn('trips', 'image_url', 'VARCHAR(500) NULL AFTER category');
  await ensureColumn('payments', 'bank_name', 'VARCHAR(30) NULL AFTER proof_url');
  await ensureColumn('payments', 'card_last4', 'CHAR(4) NULL AFTER bank_name');
};

const listAdminTrips = async ({ page, limit, sort = 'name_asc', category = 'all' }) => {
  const { trips, total } = await listTrips({
    page,
    limit,
    sort,
    category,
    activeOnly: false,
  });
  return {
    items: trips,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  };
};

const listAdminDestinations = async ({ page, limit, sort = 'name_asc', category = 'all' }) => {
  const { destinations, total } = await listDestinations({ page, limit, sort, category });
  return {
    items: destinations,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  };
};

const normalizeSqlTripDestinations = async (connection, destinations = []) => {
  if (!Array.isArray(destinations)) throw catalogError('destinations harus berupa array');
  if (!destinations.length) throw catalogError('Destinations minimal berisi 1 destinasi');

  const normalized = [];
  const seen = new Set();
  for (const [index, item] of destinations.entries()) {
    const rawId = typeof item === 'string' ? item : item?.destination_id;
    const destinationId = await getSqlId(
      connection,
      'destinations',
      rawId,
      'sql-destination-'
    );
    if (!destinationId) throw catalogError(`destinations[${index}] tidak ditemukan`, 400);
    if (seen.has(destinationId)) throw catalogError('Destination dalam trip tidak boleh duplikat');
    seen.add(destinationId);
    normalized.push({
      destination_id: destinationId,
      visit_order: Number(item?.visit_order || index + 1),
      notes: typeof item?.notes === 'string' ? item.notes.trim() : '',
    });
  }
  return normalized.sort((a, b) => a.visit_order - b.visit_order);
};

const insertTripDestinations = async (connection, tripId, destinations) => {
  for (const [index, item] of destinations.entries()) {
    await connection.query(
      `INSERT INTO trip_destinations
        (trip_id, destination_id, visit_order, notes)
       VALUES (?, ?, ?, ?)`,
      [tripId, item.destination_id, index + 1, item.notes || null]
    );
  }
};

const getAdminTrip = async (id) => getTripByMongoId(id, { activeOnly: false });

const createAdminTrip = async ({ data, createdBy }) => {
  const connection = await sqlPool.getConnection();
  try {
    await connection.beginTransaction();
    const destinations = await normalizeSqlTripDestinations(connection, data.destinations || []);
    const createdBySqlId = createdBy
      ? await getSqlId(connection, 'users', createdBy, 'sql-user-')
      : null;
    const [result] = await connection.query(
      `INSERT INTO trips
        (title, country, city, category, image_url, description, price, quota, start_date, end_date, status, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [
        data.title,
        data.country || 'Indonesia',
        data.city || null,
        normalizeCatalogWriteCategory(data.category),
        data.image_url || null,
        data.description || null,
        Number(data.price),
        Number(data.quota),
        data.start_date,
        data.end_date,
        data.status || 'active',
        createdBySqlId,
      ]
    );
    await insertTripDestinations(connection, result.insertId, destinations);
    await connection.commit();
    return getAdminTrip(result.insertId);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

const updateAdminTrip = async ({ id, data }) => {
  const connection = await sqlPool.getConnection();
  try {
    await connection.beginTransaction();
    const tripId = await getSqlId(connection, 'trips', id, 'sql-trip-');
    if (!tripId) throw catalogError('Trip tidak ditemukan', 404);

    const fields = [];
    const params = [];
    for (const [field, value] of Object.entries({
      title: data.title,
      country: data.country,
      city: data.city,
      category: data.category ? normalizeCatalogWriteCategory(data.category) : undefined,
      image_url: data.image_url,
      description: data.description,
      price: data.price !== undefined ? Number(data.price) : undefined,
      quota: data.quota !== undefined ? Number(data.quota) : undefined,
      start_date: data.start_date,
      end_date: data.end_date,
      status: data.status,
    })) {
      if (value !== undefined) {
        fields.push(`${field} = ?`);
        params.push(value === '' ? null : value);
      }
    }
    if (fields.length) {
      await connection.query(
        `UPDATE trips SET ${fields.join(', ')}, updated_at = NOW() WHERE id = ?`,
        [...params, tripId]
      );
    }
    if (data.destinations !== undefined) {
      const destinations = await normalizeSqlTripDestinations(connection, data.destinations);
      await connection.query('DELETE FROM trip_destinations WHERE trip_id = ?', [tripId]);
      await insertTripDestinations(connection, tripId, destinations);
    }
    await connection.commit();
    return getAdminTrip(tripId);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

const deleteAdminTrip = async (id) => {
  const connection = await sqlPool.getConnection();
  try {
    await connection.beginTransaction();
    const tripId = await getSqlId(connection, 'trips', id, 'sql-trip-');
    if (!tripId) throw catalogError('Trip tidak ditemukan', 404);
    const [[booking]] = await connection.query(
      'SELECT id FROM bookings WHERE trip_id = ? LIMIT 1',
      [tripId]
    );
    if (booking) throw catalogError('Trip yang sudah memiliki booking tidak dapat dihapus');
    await connection.query('DELETE FROM wishlists WHERE trip_id = ?', [tripId]);
    await connection.query('DELETE FROM trip_destinations WHERE trip_id = ?', [tripId]);
    await connection.query('DELETE FROM trips WHERE id = ?', [tripId]);
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

const getAdminDestination = async (id) => {
  const [rows] = await sqlPool.query(
    `SELECT *
     FROM destinations
     WHERE id = ?`,
    [id]
  );

  return rows[0] || null;
};

const createAdminDestination = async (data) => {
  const [result] = await sqlPool.query(
    `INSERT INTO destinations
      (city, province, country, category, image_url, price, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())`,
    [
      data.city,
      data.province,
      data.country || 'Indonesia',
      normalizeCatalogWriteCategory(data.category),
      data.image_url || null,
      Number(data.price || 0),
    ]
  );
  return getAdminDestination(result.insertId);
};

const updateAdminDestination = async ({ id, data }) => {
  const connection = await sqlPool.getConnection();
  try {
    await connection.beginTransaction();
    const destinationId = await getSqlId(connection, 'destinations', id, 'sql-destination-');
    if (!destinationId) throw catalogError('Destination tidak ditemukan', 404);
    const [[currentDestination]] = await connection.query(
      'SELECT * FROM destinations WHERE id = ? FOR UPDATE',
      [destinationId]
    );
    if (!currentDestination) throw catalogError('Destination tidak ditemukan', 404);

    const normalizedData = {
      city: data.city,
      province: data.province,
      country: data.country,
      category: data.category ? normalizeCatalogWriteCategory(data.category) : undefined,
      image_url: data.image_url !== undefined ? data.image_url : data.imageUrl,
      price: data.price !== undefined ? Number(data.price) : undefined,
    };
    const fields = [];
    const params = [];
    for (const [field, value] of Object.entries(normalizedData)) {
      if (value !== undefined) {
        fields.push(`${field} = ?`);
        params.push(value === '' ? null : value);
      }
    }
    let mysqlResult = null;
    if (fields.length) {
      const [result] = await connection.query(
        `UPDATE destinations SET ${fields.join(', ')}, updated_at = NOW() WHERE id = ?`,
        [...params, destinationId]
      );
      mysqlResult = result;
    }
    console.log('MySQL update result:', mysqlResult);

    const [[updatedDestination]] = await connection.query(
      'SELECT * FROM destinations WHERE id = ? LIMIT 1',
      [destinationId]
    );
    const mongoPayload = {
      city: updatedDestination.city,
      province: updatedDestination.province,
      country: updatedDestination.country || 'Indonesia',
      category: updatedDestination.category || 'domestic',
      image_url: updatedDestination.image_url || undefined,
      price: Number(updatedDestination.price || 0),
    };
    let mongoResult = null;
    if (updatedDestination.mongo_id && mongoose.isValidObjectId(updatedDestination.mongo_id)) {
      mongoResult = await Destination.findByIdAndUpdate(
        updatedDestination.mongo_id,
        mongoPayload,
        { new: true, runValidators: true }
      );
    }
    if (!mongoResult) {
      mongoResult = await Destination.create(mongoPayload);
      await connection.query(
        'UPDATE destinations SET mongo_id = ?, updated_at = NOW() WHERE id = ?',
        [String(mongoResult._id), destinationId]
      );
    }
    console.log('Mongo update result:', mongoResult?._id || mongoResult);
    await connection.commit();
    return getAdminDestination(destinationId);
  } catch (error) {
    await connection.rollback();
    console.error('Destination update failed:', error);
    throw error;
  } finally {
    connection.release();
  }
};

const deleteAdminDestination = async (id) => {
  const connection = await sqlPool.getConnection();
  try {
    await connection.beginTransaction();
    const destinationId = await getSqlId(connection, 'destinations', id, 'sql-destination-');
    if (!destinationId) throw catalogError('Destination tidak ditemukan', 404);
    const [[trip]] = await connection.query(
      'SELECT trip_id FROM trip_destinations WHERE destination_id = ? LIMIT 1',
      [destinationId]
    );
    if (trip) throw catalogError('Destination yang terhubung dengan trip tidak dapat dihapus');
    const [[booking]] = await connection.query(
      'SELECT id FROM bookings WHERE destination_id = ? LIMIT 1',
      [destinationId]
    );
    if (booking) throw catalogError('Destination yang memiliki booking tidak dapat dihapus');
    await connection.query('DELETE FROM wishlists WHERE destination_id = ?', [destinationId]);
    await connection.query('DELETE FROM destinations WHERE id = ?', [destinationId]);
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

const bookingFromRow = (row, trip = null, destination = null) => ({
  _id: publicId(row, 'sql-booking-'),
  user_id: userFromRow(row),
  trip_id: trip,
  destination_id: destination,
  booking_type: row.booking_type,
  qty: toNumber(row.qty),
  visit_date: row.visit_date,
  payment_id: paymentFromRow(row),
  status: row.status,
  total_price: toNumber(row.total_price),
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const listBookings = async ({ userId, status, page, limit }) => {
  const where = ['u.mongo_id = ?'];
  const params = [userId];
  if (status) {
    where.push('b.status = ?');
    params.push(status);
  }
  const whereSql = `WHERE ${where.join(' AND ')}`;
  const [countRows] = await sqlPool.query(
    `SELECT COUNT(*) AS total
     FROM bookings b
     JOIN users u ON u.id = b.user_id
     ${whereSql}`,
    params
  );
  const [rows] = await sqlPool.query(
    `SELECT
      b.*,
      u.mongo_id AS mongo_id_user,
      u.name,
      u.email,
      u.phone,
      u.role,
      u.is_verified,
      u.created_at AS user_created_at,
      u.updated_at AS user_updated_at,
      p.mongo_id AS payment_mongo_id,
      p.amount AS payment_amount,
      p.method AS payment_method,
      p.proof_url AS payment_proof_url,
      p.bank_name AS payment_bank_name,
      p.card_last4 AS payment_card_last4,
      p.status AS payment_status,
      p.created_at AS payment_created_at,
      p.updated_at AS payment_updated_at
     FROM bookings b
     JOIN users u ON u.id = b.user_id
     LEFT JOIN payments p ON p.booking_id = b.id
     ${whereSql}
     ORDER BY b.created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, (page - 1) * limit]
  );
  const tripIds = [...new Set(rows.map((row) => row.trip_id).filter(Boolean))];
  const destinationIds = [
    ...new Set(rows.map((row) => row.destination_id).filter(Boolean)),
  ];
  const tripRows = tripIds.length
    ? (await sqlPool.query(`SELECT * FROM trips WHERE id IN (?)`, [tripIds]))[0]
    : [];
  const destinationRows = destinationIds.length
    ? (await sqlPool.query(`SELECT * FROM destinations WHERE id IN (?)`, [destinationIds]))[0]
    : [];
  const tripDestinationMap = await loadTripDestinations(tripRows.map((row) => row.id));
  const tripExtrasMap = await loadTripExtras(mongoIds(tripRows));
  const destinationExtrasMap = await loadDestinationExtras(mongoIds(destinationRows));
  const tripsById = new Map(
    tripRows.map((row) => [
      row.id,
      tripFromRow(
        row,
        tripDestinationMap.get(row.id) || [],
        tripExtrasMap.get(String(row.mongo_id))
      ),
    ])
  );
  const destinationsById = new Map(
    destinationRows.map((row) => [
      row.id,
      destinationFromRow(row, destinationExtrasMap.get(String(row.mongo_id))),
    ])
  );
  const bookings = rows.map((row) =>
    bookingFromRow(
      {
        ...row,
        mongo_id: row.mongo_id,
        user_mongo_id: row.mongo_id_user,
        booking_mongo_id: row.mongo_id,
        created_at: row.created_at,
        updated_at: row.updated_at,
      },
      tripsById.get(row.trip_id) || null,
      destinationsById.get(row.destination_id) || null
    )
  );
  return { bookings, total: Number(countRows[0]?.total || 0) };
};

const getBookingByMongoId = async (id, userId) => {
  const [rows] = await sqlPool.query(
    `SELECT
      b.*,
      u.mongo_id AS mongo_id_user,
      u.name,
      u.email,
      u.phone,
      u.role,
      u.is_verified,
      u.created_at AS user_created_at,
      u.updated_at AS user_updated_at,
      p.mongo_id AS payment_mongo_id,
      p.amount AS payment_amount,
      p.method AS payment_method,
      p.proof_url AS payment_proof_url,
      p.bank_name AS payment_bank_name,
      p.card_last4 AS payment_card_last4,
      p.status AS payment_status,
      p.created_at AS payment_created_at,
      p.updated_at AS payment_updated_at
     FROM bookings b
     JOIN users u ON u.id = b.user_id
     LEFT JOIN payments p ON p.booking_id = b.id
     WHERE b.mongo_id = ? AND u.mongo_id = ?
     LIMIT 1`,
    [id, userId]
  );
  if (!rows.length) return null;
  const row = rows[0];
  const tripRows = row.trip_id
    ? (await sqlPool.query('SELECT * FROM trips WHERE id = ? LIMIT 1', [row.trip_id]))[0]
    : [];
  const destinationRows = row.destination_id
    ? (await sqlPool.query('SELECT * FROM destinations WHERE id = ? LIMIT 1', [
        row.destination_id,
      ]))[0]
    : [];
  const tripDestinationMap = await loadTripDestinations(tripRows.map((item) => item.id));
  const tripExtrasMap = await loadTripExtras(mongoIds(tripRows));
  const destinationExtrasMap = await loadDestinationExtras(mongoIds(destinationRows));
  const trip = tripRows[0]
    ? tripFromRow(
        tripRows[0],
        tripDestinationMap.get(tripRows[0].id) || [],
        tripExtrasMap.get(String(tripRows[0].mongo_id))
      )
    : null;
  const destination = destinationRows[0]
    ? destinationFromRow(
        destinationRows[0],
        destinationExtrasMap.get(String(destinationRows[0].mongo_id))
      )
    : null;
  return bookingFromRow(
    {
      ...row,
      user_mongo_id: row.mongo_id_user,
      booking_mongo_id: row.mongo_id,
    },
    trip,
    destination
  );
};

const listPayments = async (userId) => {
  const [rows] = await sqlPool.query(
    `SELECT
      p.*,
      b.mongo_id AS booking_mongo_id
     FROM payments p
     JOIN users u ON u.id = p.user_id
     JOIN bookings b ON b.id = p.booking_id
     WHERE u.mongo_id = ?
     ORDER BY p.created_at DESC`,
    [userId]
  );
  return rows.map((row) => ({
    _id: publicId(row, 'sql-payment-'),
    booking_id: row.booking_mongo_id,
    user_id: userId,
    amount: toNumber(row.amount),
    method: row.method,
    proof_url: row.proof_url,
    bank_name: row.bank_name,
    card_last4: row.card_last4,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
};

const paymentAdminFromRow = (row) => ({
  _id: publicId(row, 'sql-payment-'),
  id: row.id,
  booking_id: {
    _id: row.booking_mongo_id,
    status: row.booking_status,
  },
  user_id: {
    _id: row.user_mongo_id,
    name: row.user_name,
    email: row.user_email,
  },
  amount: toNumber(row.amount),
  method: row.method,
  proof_url: row.proof_url,
  bank_name: row.bank_name,
  card_last4: row.card_last4,
  status: row.status,
  booking_status: row.booking_status,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const listAdminPayments = async ({ status, page, limit }) => {
  const where = [];
  const params = [];
  if (status) {
    where.push('p.status = ?');
    params.push(status);
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const [countRows] = await sqlPool.query(
    `SELECT COUNT(*) AS total
     FROM payments p
     JOIN users u ON p.user_id = u.id
     JOIN bookings b ON p.booking_id = b.id
     ${whereSql}`,
    params
  );
  const [rows] = await sqlPool.query(
    `SELECT
      p.id,
      p.mongo_id,
      p.booking_id,
      p.user_id,
      p.amount,
      p.method,
      p.proof_url,
      p.bank_name,
      p.card_last4,
      p.status,
      p.created_at,
      p.updated_at,
      u.mongo_id AS user_mongo_id,
      u.name AS user_name,
      u.email AS user_email,
      b.mongo_id AS booking_mongo_id,
      b.status AS booking_status
     FROM payments p
     JOIN users u ON p.user_id = u.id
     JOIN bookings b ON p.booking_id = b.id
     ${whereSql}
     ORDER BY p.id DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, (page - 1) * limit]
  );
  return {
    items: rows.map(paymentAdminFromRow),
    total: Number(countRows[0]?.total || 0),
    page,
    totalPages: Math.ceil(Number(countRows[0]?.total || 0) / limit),
  };
};

const updateAdminPaymentStatus = async ({ paymentId, status, changedBy }) => {
  const connection = await sqlPool.getConnection();
  try {
    await connection.beginTransaction();
    const sqlPaymentId = sqlPublicId(paymentId, 'sql-payment-');
    const sqlPaymentIdNumber = /^\d+$/.test(sqlPaymentId) ? Number(sqlPaymentId) : null;
    const [[payment]] = await connection.query(
      `SELECT
        p.*,
        b.status AS booking_status,
        b.mongo_id AS booking_mongo_id,
        u.mongo_id AS user_mongo_id,
        u.name AS user_name,
        u.email AS user_email
       FROM payments p
       JOIN bookings b ON b.id = p.booking_id
       JOIN users u ON u.id = p.user_id
       WHERE p.mongo_id = ? OR p.id = ?
       LIMIT 1`,
      [paymentId, sqlPaymentIdNumber]
    );
    if (!payment) {
      await connection.rollback();
      return null;
    }

    await connection.query(
      'UPDATE payments SET status = ?, updated_at = NOW() WHERE id = ?',
      [status, payment.id]
    );

    if (status === 'verified' && payment.booking_status !== 'confirmed') {
      await connection.query(
        "UPDATE bookings SET status = 'confirmed', updated_at = NOW() WHERE id = ?",
        [payment.booking_id]
      );
      const changedBySqlId = changedBy
        ? await getSqlId(connection, 'users', changedBy)
        : null;
      await connection.query(
        `INSERT INTO booking_history
          (booking_id, changed_by, previous_status, new_status, notes)
         VALUES (?, ?, ?, 'confirmed', ?)`,
        [
          payment.booking_id,
          changedBySqlId,
          payment.booking_status,
          'Booking dikonfirmasi setelah payment diverifikasi',
        ]
      );
    }

    await connection.commit();
    const [rows] = await sqlPool.query(
      `SELECT
        p.id,
        p.mongo_id,
        p.booking_id,
        p.user_id,
        p.amount,
        p.method,
        p.proof_url,
        p.bank_name,
        p.card_last4,
        p.status,
        p.created_at,
        p.updated_at,
        u.mongo_id AS user_mongo_id,
        u.name AS user_name,
        u.email AS user_email,
        b.mongo_id AS booking_mongo_id,
        b.status AS booking_status
       FROM payments p
       JOIN users u ON p.user_id = u.id
       JOIN bookings b ON p.booking_id = b.id
       WHERE p.id = ?
       LIMIT 1`,
      [payment.id]
    );
    return rows.length ? paymentAdminFromRow(rows[0]) : null;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

const listUsers = async ({ role, is_verified, page, limit }) => {
  const where = [];
  const params = [];
  if (role) {
    where.push('role = ?');
    params.push(role);
  }
  if (is_verified !== undefined) {
    where.push('is_verified = ?');
    params.push(is_verified ? 1 : 0);
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const [countRows] = await sqlPool.query(
    `SELECT COUNT(*) AS total FROM users ${whereSql}`,
    params
  );
  const [rows] = await sqlPool.query(
    `SELECT * FROM users ${whereSql} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [...params, limit, (page - 1) * limit]
  );
  return {
    users: rows.map(userFromRow),
    total: Number(countRows[0]?.total || 0),
  };
};

const listWishlist = async (userId) => {
  const [rows] = await sqlPool.query(
    `SELECT
      w.*,
      t.id AS trip_sql_id,
      t.mongo_id AS trip_mongo_id,
      d.id AS destination_sql_id,
      d.mongo_id AS destination_mongo_id
     FROM wishlists w
     JOIN users u ON u.id = w.user_id
     LEFT JOIN trips t ON t.id = w.trip_id
     LEFT JOIN destinations d ON d.id = w.destination_id
     WHERE u.mongo_id = ?
     ORDER BY w.created_at DESC`,
    [userId]
  );
  const trips = new Map();
  for (const row of rows.filter((item) => item.trip_sql_id)) {
    const publicTripId = publicId({ id: row.trip_sql_id, mongo_id: row.trip_mongo_id }, 'sql-trip-');
    trips.set(row.trip_sql_id, await getTripByMongoId(publicTripId, { activeOnly: false }));
  }
  const destinationIds = publicIds(rows, 'destination_sql_id');
  const destinationRows = destinationIds.length
    ? (await sqlPool.query('SELECT * FROM destinations WHERE id IN (?)', [
        destinationIds,
      ]))[0]
    : [];
  const destinationExtrasMap = await loadDestinationExtras(mongoIds(destinationRows));
  const destinations = new Map(
    destinationRows.map((row) => [
      row.id,
      destinationFromRow(row, destinationExtrasMap.get(String(row.mongo_id))),
    ])
  );
  return rows.map((row) => ({
    _id: publicId(row, 'sql-wishlist-'),
    user_id: userId,
    trip_id: row.trip_sql_id ? trips.get(row.trip_sql_id) : null,
    destination_id: row.destination_sql_id
      ? destinations.get(row.destination_sql_id)
      : null,
    created_at: row.created_at,
  }));
};

const createSqlWishlist = async ({ userId, tripId, destinationId }) => {
  const connection = await sqlPool.getConnection();
  try {
    const [[user]] = await connection.query(
      'SELECT id FROM users WHERE mongo_id = ? LIMIT 1',
      [userId]
    );
    if (!user) throw new Error('User SQL tidak ditemukan');

    let sqlTripId = null;
    let sqlDestinationId = null;
    if (tripId) {
      sqlTripId = await getSqlId(connection, 'trips', tripId, 'sql-trip-');
      if (!sqlTripId) throw new Error('Trip tidak ditemukan');
    }
    if (destinationId) {
      sqlDestinationId = await getSqlId(
        connection,
        'destinations',
        destinationId,
        'sql-destination-'
      );
      if (!sqlDestinationId) throw new Error('Destination tidak ditemukan');
    }

    const [[existing]] = await connection.query(
      `SELECT w.mongo_id
       FROM wishlists w
       WHERE w.user_id = ?
         AND ((? IS NOT NULL AND w.trip_id = ?) OR (? IS NOT NULL AND w.destination_id = ?))
       LIMIT 1`,
      [user.id, sqlTripId, sqlTripId, sqlDestinationId, sqlDestinationId]
    );
    if (existing) {
      const wishlist = await listWishlist(userId);
      return wishlist.find((item) => item._id === existing.mongo_id);
    }

    const wishlistPublicId = `SQLWISH-${Date.now()}-${Math.random()
      .toString(16)
      .slice(2, 8)}`;
    await connection.query(
      `INSERT INTO wishlists
        (mongo_id, user_id, trip_id, destination_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, NOW(), NOW())`,
      [wishlistPublicId, user.id, sqlTripId, sqlDestinationId]
    );
    const wishlist = await listWishlist(userId);
    return wishlist.find((item) => item._id === wishlistPublicId);
  } finally {
    connection.release();
  }
};

const deleteSqlWishlist = async ({ wishlistId, userId }) => {
  const [result] = await sqlPool.query(
    `DELETE w
     FROM wishlists w
     JOIN users u ON u.id = w.user_id
     WHERE w.mongo_id = ? AND u.mongo_id = ?`,
    [wishlistId, userId]
  );
  return result.affectedRows > 0;
};

const countSqlTable = async (table) => {
  const [rows] = await sqlPool.query(`SELECT COUNT(*) AS total FROM \`${table}\``);
  return Number(rows[0]?.total || 0);
};

const createSqlBooking = async ({ userId, tripId, qty }) => {
  const connection = await sqlPool.getConnection();
  try {
    await connection.beginTransaction();
    const [[user]] = await connection.query(
      'SELECT id, mongo_id FROM users WHERE mongo_id = ? LIMIT 1',
      [userId]
    );
    if (!user) throw new Error('User SQL tidak ditemukan');

    const sqlTripId = await getSqlId(connection, 'trips', tripId, 'sql-trip-');
    const [[trip]] = await connection.query(
      "SELECT * FROM trips WHERE id = ? AND status = 'active' LIMIT 1",
      [sqlTripId]
    );
    if (!trip) throw new Error('Trip tidak ditemukan');

    const [[booked]] = await connection.query(
      `SELECT COALESCE(SUM(qty), 0) AS total
       FROM bookings
       WHERE trip_id = ? AND status IN ('pending', 'confirmed', 'completed')`,
      [trip.id]
    );
    const remaining = Number(trip.quota) - Number(booked.total || 0);
    if (qty > remaining) {
      const error = new Error(`Kuota trip tidak mencukupi. Sisa kuota: ${Math.max(remaining, 0)}`);
      error.statusCode = 400;
      throw error;
    }

    const bookingPublicId = `SQLBOOK-${Date.now()}-${Math.random()
      .toString(16)
      .slice(2, 8)}`;
    await connection.query(
      `INSERT INTO bookings
        (mongo_id, user_id, trip_id, destination_id, booking_type, qty, visit_date,
         status, total_price, created_at, updated_at)
       VALUES (?, ?, ?, NULL, 'trip', ?, ?, 'pending', ?, NOW(), NOW())`,
      [
        bookingPublicId,
        user.id,
        trip.id,
        qty,
        trip.start_date,
        Number(trip.price) * qty,
      ]
    );
    const [[bookingRow]] = await connection.query(
      'SELECT id FROM bookings WHERE mongo_id = ? LIMIT 1',
      [bookingPublicId]
    );
    await connection.query(
      `INSERT INTO booking_history
        (booking_id, changed_by, previous_status, new_status, notes)
       VALUES (?, ?, NULL, 'pending', ?)`,
      [bookingRow.id, user.id, 'Booking dibuat']
    );
    await connection.commit();
    return getBookingByMongoId(bookingPublicId, userId);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

const getPendingSqlBookingForPayment = async (bookingId, userId) => {
  const [rows] = await sqlPool.query(
    `SELECT b.*
     FROM bookings b
     JOIN users u ON u.id = b.user_id
     LEFT JOIN payments p ON p.booking_id = b.id
     WHERE b.mongo_id = ? AND u.mongo_id = ? AND p.id IS NULL
     LIMIT 1`,
    [bookingId, userId]
  );
  if (!rows.length || rows[0].status !== 'pending') return null;
  return rows[0];
};

const createSqlPayment = async ({ bookingId, userId, method, proofUrl, bankName = null, cardLast4 = null }) => {
  const connection = await sqlPool.getConnection();
  try {
    await connection.beginTransaction();
    const [[booking]] = await connection.query(
      `SELECT b.*, u.id AS sql_user_id
       FROM bookings b
       JOIN users u ON u.id = b.user_id
       WHERE b.mongo_id = ? AND u.mongo_id = ? AND b.status = 'pending'
       LIMIT 1`,
      [bookingId, userId]
    );
    if (!booking) throw new Error('Booking tidak ditemukan');
    const paymentPublicId = `SQLPAY-${Date.now()}-${Math.random()
      .toString(16)
      .slice(2, 8)}`;
    await connection.query(
      `INSERT INTO payments
        (mongo_id, booking_id, user_id, amount, method, proof_url, bank_name, card_last4, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'checking', NOW(), NOW())`,
      [
        paymentPublicId,
        booking.id,
        booking.sql_user_id,
        booking.total_price,
        method,
        proofUrl,
        bankName,
        cardLast4,
      ]
    );
    await connection.commit();
    return {
      payment: {
        _id: paymentPublicId,
        booking_id: bookingId,
        user_id: userId,
        amount: toNumber(booking.total_price),
        method,
        proof_url: proofUrl,
        bank_name: bankName,
        card_last4: cardLast4,
        status: 'checking',
      },
      booking: await getBookingByMongoId(bookingId, userId),
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

const cancelSqlBooking = async ({ bookingId, userId }) => {
  const connection = await sqlPool.getConnection();
  try {
    await connection.beginTransaction();
    const [[booking]] = await connection.query(
      `SELECT b.*, u.id AS sql_user_id
       FROM bookings b
       JOIN users u ON u.id = b.user_id
       WHERE b.mongo_id = ? AND u.mongo_id = ?
       LIMIT 1`,
      [bookingId, userId]
    );
    if (!booking) throw new Error('Booking tidak ditemukan');
    if (booking.status !== 'pending') {
      const error = new Error('Hanya booking pending yang dapat dibatalkan');
      error.statusCode = 400;
      throw error;
    }
    await connection.query(
      "UPDATE bookings SET status = 'cancelled', updated_at = NOW() WHERE id = ?",
      [booking.id]
    );
    await connection.query(
      `INSERT INTO booking_history
        (booking_id, changed_by, previous_status, new_status, notes)
       VALUES (?, ?, ?, 'cancelled', ?)`,
      [booking.id, booking.sql_user_id, booking.status, 'Booking dibatalkan oleh user']
    );
    await connection.commit();
    return getBookingByMongoId(bookingId, userId);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

module.exports = {
  cancelSqlBooking,
  countSqlTable,
  createSqlBooking,
  createSqlPayment,
  createAdminDestination,
  createAdminTrip,
  createSqlWishlist,
  deleteAdminDestination,
  deleteAdminTrip,
  deleteSqlWishlist,
  ensureCatalogColumns,
  getAdminDestination,
  getAdminTrip,
  getBookingByMongoId,
  getDestinationByMongoId,
  getPendingSqlBookingForPayment,
  getTripByMongoId,
  getUserByEmail,
  getUserByMongoId,
  listAdminDestinations,
  listBookings,
  listDestinations,
  listPayments,
  listAdminPayments,
  listAdminTrips,
  listTrips,
  listTripsForDestination,
  listUsers,
  listWishlist,
  updateAdminDestination,
  updateAdminTrip,
  updateAdminPaymentStatus,
};
