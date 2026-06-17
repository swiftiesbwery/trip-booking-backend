const Booking = require('../models/Booking');
const Destination = require('../models/Destination');
const Payment = require('../models/Payment');
const Trip = require('../models/Trip');
const User = require('../models/User');
const Wishlist = require('../models/Wishlist');
const Review = require('../models/Review');
const AppError = require('../utils/AppError');
const sqlRead = require('../services/sqlReadService');
const {
  deleteDestination: deleteDestinationMirror,
  deleteTrip: deleteTripMirror,
  safeMirror,
  syncBooking,
  syncDestination,
  syncPayment,
  syncTrip,
  syncUser,
} = require('../services/sqlMirrorService');
const {
  assertObjectId,
  parsePositiveInteger,
  pickFields,
} = require('../utils/validation');

const BOOKING_STATUSES = ['pending', 'confirmed', 'completed', 'cancelled'];
const PAYMENT_STATUSES = ['pending', 'checking', 'verified'];
const CATALOG_SORTS = ['name_asc', 'price_asc', 'price_desc'];
const CATALOG_CATEGORIES = ['all', 'domestic', 'international'];
const tripFields = [
  'title',
  'country',
  'city',
  'category',
  'image_url',
  'price',
  'quota',
  'start_date',
  'end_date',
  'destinations',
  'description',
  'duration_days',
  'departure_date',
  'itinerary',
  'facilities',
  'status',
];
const destinationFields = ['city', 'province', 'country', 'category', 'image_url', 'imageUrl', 'price'];

const paginated = async (Model, filter, req, populate = []) => {
  const page = parsePositiveInteger(req.query.page, 'page', { defaultValue: 1 });
  const limit = parsePositiveInteger(req.query.limit, 'limit', {
    defaultValue: 20,
    max: 100,
  });
  let query = Model.find(filter)
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit);
  for (const path of populate) query = query.populate(path);
  const [items, total] = await Promise.all([query, Model.countDocuments(filter)]);
  return { items, total, page, totalPages: Math.ceil(total / limit) };
};

const normalizeDestinations = async (destinations = []) => {
  if (!Array.isArray(destinations)) throw new AppError('destinations harus berupa array', 400);
  const ids = destinations.map((item) =>
    typeof item === 'string' ? item : item.destination_id
  );
  ids.forEach((id, index) => assertObjectId(id, `destinations[${index}]`));
  if (new Set(ids.map(String)).size !== ids.length) {
    throw new AppError('Destination dalam trip tidak boleh duplikat', 400);
  }
  if ((await Destination.countDocuments({ _id: { $in: ids } })) !== ids.length) {
    throw new AppError('Satu atau lebih destination tidak ditemukan', 400);
  }
  return ids.map((id, index) => ({
    destination_id: id,
    visit_order: index + 1,
    notes: '',
  }));
};

const listTrips = async (req, res, next) => {
  try {
    const page = parsePositiveInteger(req.query.page, 'page', { defaultValue: 1 });
    const limit = parsePositiveInteger(req.query.limit, 'limit', {
      defaultValue: 20,
      max: 100,
    });
    const sort = req.query.sort || 'name_asc';
    if (!CATALOG_SORTS.includes(sort)) return next(new AppError('Pilihan sort tidak valid', 400));
    const category = req.query.category || 'all';
    if (!CATALOG_CATEGORIES.includes(category)) return next(new AppError('Pilihan category tidak valid', 400));
    const result = await sqlRead.listAdminTrips({ page, limit, sort, category });
    res.json({ status: 'success', ...result, data: { trips: result.items } });
  } catch (err) { next(err); }
};

const getTrip = async (req, res, next) => {
  try {
    const trip = await sqlRead.getAdminTrip(req.params.id);
    if (!trip) return next(new AppError('Trip tidak ditemukan', 404));
    res.json({ status: 'success', data: { trip } });
  } catch (err) { next(err); }
};

const createTrip = async (req, res, next) => {
  try {
    const data = pickFields(req.body, tripFields);
    data.destinations = req.body.destinations || [];
    const trip = await sqlRead.createAdminTrip({ data, createdBy: req.user._id });
    res.status(201).json({ status: 'success', data: { trip } });
  } catch (err) { next(err); }
};

const updateTrip = async (req, res, next) => {
  try {
    const data = pickFields(req.body, tripFields);
    const trip = await sqlRead.updateAdminTrip({ id: req.params.id, data });
    res.json({ status: 'success', data: { trip } });
  } catch (err) { next(err); }
};

const deleteTrip = async (req, res, next) => {
  try {
    await sqlRead.deleteAdminTrip(req.params.id);
    res.status(204).send();
  } catch (err) { next(err); }
};

const listTripDestinations = async (req, res, next) => {
  try {
    const trip = await sqlRead.getAdminTrip(req.params.id);
    if (!trip) return next(new AppError('Trip tidak ditemukan', 404));
    res.json({ status: 'success', data: { destinations: trip.destinations } });
  } catch (err) { next(err); }
};

const addTripDestination = async (req, res, next) => {
  try {
    const trip = await sqlRead.getAdminTrip(req.params.id);
    if (!trip) return next(new AppError('Trip tidak ditemukan', 404));
    if ((trip.destinations || []).some((item) => String(item.destination_id?._id) === String(req.body.destination_id))) {
      return next(new AppError('Destination sudah terhubung dengan trip', 400));
    }
    const destinations = [
      ...(trip.destinations || []).map((item) => ({
        destination_id: item.destination_id?._id || item.destination_id,
        notes: item.notes || '',
      })),
      { destination_id: req.body.destination_id, notes: req.body.notes || '' },
    ].map((item, index) => ({ ...item, visit_order: index + 1 }));
    const updated = await sqlRead.updateAdminTrip({
      id: req.params.id,
      data: { destinations },
    });
    res.status(201).json({ status: 'success', data: { destinations: updated.destinations } });
  } catch (err) { next(err); }
};

const removeTripDestination = async (req, res, next) => {
  try {
    const trip = await sqlRead.getAdminTrip(req.params.id);
    if (!trip) return next(new AppError('Trip tidak ditemukan', 404));
    const filtered = (trip.destinations || []).filter(
      (item) => String(item.destination_id?._id || item.destination_id) !== String(req.params.destinationId)
    );
    if (filtered.length === (trip.destinations || []).length) {
      return next(new AppError('Relasi destination tidak ditemukan', 404));
    }
    await sqlRead.updateAdminTrip({
      id: req.params.id,
      data: { destinations: filtered.map((item, index) => ({
        destination_id: item.destination_id?._id || item.destination_id,
        visit_order: index + 1,
        notes: item.notes || '',
      })) },
    });
    res.status(204).send();
  } catch (err) { next(err); }
};

const listDestinations = async (req, res, next) => {
  try {
    const page = parsePositiveInteger(req.query.page, 'page', { defaultValue: 1 });
    const limit = parsePositiveInteger(req.query.limit, 'limit', {
      defaultValue: 20,
      max: 100,
    });
    const sort = req.query.sort || 'name_asc';
    if (!CATALOG_SORTS.includes(sort)) return next(new AppError('Pilihan sort tidak valid', 400));
    const category = req.query.category || 'all';
    if (!CATALOG_CATEGORIES.includes(category)) return next(new AppError('Pilihan category tidak valid', 400));
    const result = await sqlRead.listAdminDestinations({ page, limit, sort, category });
    res.json({ status: 'success', ...result, data: { destinations: result.items } });
  } catch (err) { next(err); }
};

const getDestination = async (req, res, next) => {
  try {
    const destination = await sqlRead.getAdminDestination(req.params.id);
    if (!destination) return next(new AppError('Destination tidak ditemukan', 404));
    res.json({ status: 'success', data: { destination } });
  } catch (err) { next(err); }
};

const createDestination = async (req, res, next) => {
  try {
    const destination = await sqlRead.createAdminDestination(
      pickFields(req.body, destinationFields)
    );
    res.status(201).json({ status: 'success', data: { destination } });
  } catch (err) { next(err); }
};

const updateDestination = async (req, res, next) => {
  try {
    console.log('Destination update request:', req.params.id, req.body);
    const destination = await sqlRead.updateAdminDestination({
      id: req.params.id,
      data: pickFields(req.body, destinationFields),
    });
    res.json({ status: 'success', data: { destination } });
  } catch (err) { next(err); }
};

const deleteDestination = async (req, res, next) => {
  try {
    await sqlRead.deleteAdminDestination(req.params.id);
    res.status(204).send();
  } catch (err) { next(err); }
};

const listBookings = async (req, res, next) => {
  try {
    const filter = {};
    for (const field of ['user_id', 'trip_id', 'destination_id']) {
      if (req.query[field]) {
        assertObjectId(req.query[field], field);
        filter[field] = req.query[field];
      }
    }
    if (req.query.status) {
      if (!BOOKING_STATUSES.includes(req.query.status)) return next(new AppError('Status booking tidak valid', 400));
      filter.status = req.query.status;
    }
    if (req.query.booking_type) {
      if (!['trip', 'destination'].includes(req.query.booking_type)) return next(new AppError('booking_type tidak valid', 400));
      filter.booking_type = req.query.booking_type;
    }
    const result = await paginated(Booking, filter, req, ['user_id', 'trip_id', 'destination_id', 'payment_id']);
    res.json({ status: 'success', ...result, data: { bookings: result.items } });
  } catch (err) { next(err); }
};

const getBooking = async (req, res, next) => {
  try {
    assertObjectId(req.params.id, 'booking_id');
    const booking = await Booking.findById(req.params.id)
      .populate('user_id').populate('trip_id').populate('destination_id').populate('payment_id');
    if (!booking) return next(new AppError('Booking tidak ditemukan', 404));
    res.json({ status: 'success', data: { booking } });
  } catch (err) { next(err); }
};

const updateBookingStatus = async (req, res, next) => {
  try {
    if (!BOOKING_STATUSES.includes(req.body.status)) return next(new AppError('Status booking tidak valid', 400));
    assertObjectId(req.params.id, 'booking_id');
    const booking = await Booking.findById(req.params.id);
    if (!booking) return next(new AppError('Booking tidak ditemukan', 404));
    const previousStatus = booking.status;
    booking.status = req.body.status;
    await booking.save();
    await safeMirror(`booking ${booking._id}`, () =>
      syncBooking(booking, {
        previousStatus,
        recordHistory: previousStatus !== booking.status,
        changedBy: req.user._id,
        notes: 'Status booking diperbarui oleh admin',
      })
    );
    res.json({ status: 'success', data: { booking } });
  } catch (err) { next(err); }
};

const listPayments = async (req, res, next) => {
  try {
    const page = parsePositiveInteger(req.query.page, 'page', { defaultValue: 1 });
    const limit = parsePositiveInteger(req.query.limit, 'limit', {
      defaultValue: 20,
      max: 100,
    });
    let status;
    if (req.query.status) {
      if (!PAYMENT_STATUSES.includes(req.query.status)) return next(new AppError('Status payment tidak valid', 400));
      status = req.query.status;
    }
    const result = await sqlRead.listAdminPayments({ status, page, limit });
    res.json({ status: 'success', ...result, data: { payments: result.items } });
  } catch (err) { next(err); }
};

const getPayment = async (req, res, next) => {
  try {
    assertObjectId(req.params.id, 'payment_id');
    const payment = await Payment.findById(req.params.id).populate('user_id').populate('booking_id');
    if (!payment) return next(new AppError('Payment tidak ditemukan', 404));
    res.json({ status: 'success', data: { payment } });
  } catch (err) { next(err); }
};

const updatePaymentStatus = async (req, res, next) => {
  try {
    if (!PAYMENT_STATUSES.includes(req.body.status)) return next(new AppError('Status payment tidak valid', 400));
    const sqlPayment = await sqlRead.updateAdminPaymentStatus({
      paymentId: req.params.id,
      status: req.body.status,
      changedBy: req.user._id,
    });
    if (sqlPayment) {
      return res.json({ status: 'success', data: { payment: sqlPayment } });
    }

    assertObjectId(req.params.id, 'payment_id');
    const payment = await Payment.findById(req.params.id);
    if (!payment) return next(new AppError('Payment tidak ditemukan', 404));
    payment.status = req.body.status;
    await payment.save();
    await safeMirror(`payment ${payment._id}`, () => syncPayment(payment));
    if (payment.status === 'verified') {
      const booking = await Booking.findById(payment.booking_id);
      if (booking) {
        const previousStatus = booking.status;
        booking.status = 'confirmed';
        await booking.save();
        await safeMirror(`booking ${booking._id}`, () =>
          syncBooking(booking, {
            previousStatus,
            recordHistory: previousStatus !== booking.status,
            changedBy: req.user._id,
            notes: 'Booking dikonfirmasi setelah payment diverifikasi',
          })
        );
      }
    }
    res.json({ status: 'success', data: { payment } });
  } catch (err) { next(err); }
};

const listUsers = async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.role) filter.role = req.query.role;
    if (req.query.is_verified !== undefined) filter.is_verified = req.query.is_verified === 'true';
    const result = await paginated(User, filter, req);
    res.json({ status: 'success', ...result, data: { users: result.items } });
  } catch (err) { next(err); }
};

const getUser = async (req, res, next) => {
  try {
    assertObjectId(req.params.id, 'user_id');
    const user = await User.findById(req.params.id);
    if (!user) return next(new AppError('User tidak ditemukan', 404));
    res.json({ status: 'success', data: { user } });
  } catch (err) { next(err); }
};

const updateUserVerification = async (req, res, next) => {
  try {
    if (typeof req.body.is_verified !== 'boolean') return next(new AppError('is_verified harus boolean', 400));
    assertObjectId(req.params.id, 'user_id');
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { is_verified: req.body.is_verified },
      { new: true, runValidators: true }
    );
    if (!user) return next(new AppError('User tidak ditemukan', 404));
    await safeMirror(`user ${user._id}`, () => syncUser(user));
    res.json({ status: 'success', data: { user } });
  } catch (err) { next(err); }
};

const listReviews = async (req, res, next) => {
  try {
    const result = await paginated(Review, {}, req, ['user_id', 'trip_id', 'booking_id']);
    res.json({ status: 'success', ...result, data: { reviews: result.items } });
  } catch (err) { next(err); }
};

module.exports = {
  addTripDestination, createDestination, createTrip, deleteDestination, deleteTrip,
  getBooking, getDestination, getPayment, getTrip, getUser, listBookings,
  listDestinations, listPayments, listTripDestinations, listTrips, listUsers,
  removeTripDestination, updateBookingStatus, updateDestination, updatePaymentStatus,
  updateTrip, updateUserVerification, listReviews,
};
