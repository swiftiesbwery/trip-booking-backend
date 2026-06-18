const Booking = require('../models/Booking');
const Destination = require('../models/Destination');
const Payment = require('../models/Payment');
const Trip = require('../models/Trip');
const User = require('../models/User');
const Wishlist = require('../models/Wishlist');
const Review = require('../models/Review');
const TripItineraryTemplate = require('../models/TripItineraryTemplate');
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
const TRIP_STATUSES = ['active', 'inactive'];
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

const normalizeRecommendedItineraryDays = (days = []) =>
  (Array.isArray(days) ? days : [])
    .map((day, index) => ({
      day: Number(day.day) || index + 1,
      title: typeof day.title === 'string' ? day.title.trim() : '',
      activities: Array.isArray(day.activities)
        ? day.activities
            .map((activity) => ({
              time: typeof activity.time === 'string' ? activity.time.trim() : '',
              title: String(activity.title || activity.activity || '').trim(),
            }))
            .filter((activity) => activity.title)
        : [],
    }))
    .filter((day) => day.title || day.activities.length);

const syncRecommendedItineraryTemplate = async (tripId, tripTitle, days) => {
  if (days === undefined) return null;
  const normalizedDays = normalizeRecommendedItineraryDays(days);
  if (!normalizedDays.length) {
    await TripItineraryTemplate.deleteOne({ trip_id: String(tripId) });
    return null;
  }
  return TripItineraryTemplate.findOneAndUpdate(
    { trip_id: String(tripId) },
    {
      trip_id: String(tripId),
      trip_title: tripTitle,
      days: normalizedDays,
    },
    { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
  );
};

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
  if (!Array.isArray(destinations)) throw new AppError('destinations must be an array', 400);
  const ids = destinations.map((item) =>
    typeof item === 'string' ? item : item.destination_id
  );
  ids.forEach((id, index) => assertObjectId(id, `destinations[${index}]`));
  if (new Set(ids.map(String)).size !== ids.length) {
    throw new AppError('A destination cannot appear twice in the same trip', 400);
  }
  if ((await Destination.countDocuments({ _id: { $in: ids } })) !== ids.length) {
    throw new AppError('One or more destinations were not found', 400);
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
    if (!CATALOG_SORTS.includes(sort)) return next(new AppError('Invalid sort option', 400));
    const category = req.query.category || 'all';
    if (!CATALOG_CATEGORIES.includes(category)) return next(new AppError('Invalid category option', 400));
    const result = await sqlRead.listAdminTrips({ page, limit, sort, category });
    res.json({ status: 'success', ...result, data: { trips: result.items } });
  } catch (err) { next(err); }
};

const getTrip = async (req, res, next) => {
  try {
    const trip = await sqlRead.getAdminTrip(req.params.id);
    if (!trip) return next(new AppError('Trip not found', 404));
    const template = await TripItineraryTemplate.findOne({ trip_id: String(trip._id) }).lean();
    res.json({
      status: 'success',
      data: {
        trip,
        recommended_itinerary: template?.days || [],
        itinerary_template: template || null,
      },
    });
  } catch (err) { next(err); }
};

const createTrip = async (req, res, next) => {
  try {
    const hasRecommendedItinerary = Object.prototype.hasOwnProperty.call(req.body, 'recommended_itinerary');
    const data = pickFields(req.body, tripFields);
    data.destinations = req.body.destinations || [];
    if (data.status && !TRIP_STATUSES.includes(data.status)) {
      return next(new AppError('Invalid trip status', 400));
    }
    const trip = await sqlRead.createAdminTrip({ data, createdBy: req.user._id });
    if (hasRecommendedItinerary) {
      await syncRecommendedItineraryTemplate(trip._id, trip.title, req.body.recommended_itinerary);
    }
    res.status(201).json({ status: 'success', data: { trip } });
  } catch (err) { next(err); }
};

const updateTrip = async (req, res, next) => {
  try {
    const hasRecommendedItinerary = Object.prototype.hasOwnProperty.call(req.body, 'recommended_itinerary');
    const data = pickFields(req.body, tripFields);
    if (data.status && !TRIP_STATUSES.includes(data.status)) {
      return next(new AppError('Invalid trip status', 400));
    }
    const trip = await sqlRead.updateAdminTrip({ id: req.params.id, data });
    if (hasRecommendedItinerary) {
      await syncRecommendedItineraryTemplate(trip._id, trip.title, req.body.recommended_itinerary);
    }
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
    if (!trip) return next(new AppError('Trip not found', 404));
    res.json({ status: 'success', data: { destinations: trip.destinations } });
  } catch (err) { next(err); }
};

const addTripDestination = async (req, res, next) => {
  try {
    const trip = await sqlRead.getAdminTrip(req.params.id);
    if (!trip) return next(new AppError('Trip not found', 404));
    if ((trip.destinations || []).some((item) => String(item.destination_id?._id) === String(req.body.destination_id))) {
      return next(new AppError('Destination is already connected to this trip', 400));
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
    if (!trip) return next(new AppError('Trip not found', 404));
    const filtered = (trip.destinations || []).filter(
      (item) => String(item.destination_id?._id || item.destination_id) !== String(req.params.destinationId)
    );
    if (filtered.length === (trip.destinations || []).length) {
      return next(new AppError('Destination relation not found', 404));
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
    if (!CATALOG_SORTS.includes(sort)) return next(new AppError('Invalid sort option', 400));
    const category = req.query.category || 'all';
    if (!CATALOG_CATEGORIES.includes(category)) return next(new AppError('Invalid category option', 400));
    const result = await sqlRead.listAdminDestinations({ page, limit, sort, category });
    res.json({ status: 'success', ...result, data: { destinations: result.items } });
  } catch (err) { next(err); }
};

const getDestination = async (req, res, next) => {
  try {
    const destination = await sqlRead.getAdminDestination(req.params.id);
    if (!destination) return next(new AppError('Destination not found', 404));
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
    const page = parsePositiveInteger(req.query.page, 'page', { defaultValue: 1 });
    const limit = parsePositiveInteger(req.query.limit, 'limit', {
      defaultValue: 20,
      max: 100,
    });
    if (req.query.status) {
      if (!BOOKING_STATUSES.includes(req.query.status)) return next(new AppError('Invalid booking status', 400));
    }
    if (req.query.booking_type) {
      if (!['trip', 'destination'].includes(req.query.booking_type)) return next(new AppError('Invalid booking type', 400));
    }
    const result = await sqlRead.listAdminBookings({
      status: req.query.status,
      bookingType: req.query.booking_type,
      page,
      limit,
    });
    res.json({ status: 'success', ...result, data: { bookings: result.items } });
  } catch (err) { next(err); }
};

const getBooking = async (req, res, next) => {
  try {
    const booking = await sqlRead.getAdminBooking(req.params.id);
    if (!booking) return next(new AppError('Booking not found', 404));
    res.json({ status: 'success', data: { booking } });
  } catch (err) { next(err); }
};

const updateBookingStatus = async (req, res, next) => {
  try {
    if (!BOOKING_STATUSES.includes(req.body.status)) return next(new AppError('Invalid booking status', 400));
    const booking = await sqlRead.updateAdminBookingStatus({
      bookingId: req.params.id,
      status: req.body.status,
      changedBy: req.user._id,
    });
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
      if (!PAYMENT_STATUSES.includes(req.query.status)) return next(new AppError('Invalid payment status', 400));
      status = req.query.status;
    }
    const result = await sqlRead.listAdminPayments({ status, page, limit });
    res.json({ status: 'success', ...result, data: { payments: result.items } });
  } catch (err) { next(err); }
};

const getPayment = async (req, res, next) => {
  try {
    const payment = await sqlRead.getAdminPayment(req.params.id);
    if (!payment) return next(new AppError('Payment not found', 404));
    res.json({ status: 'success', data: { payment } });
  } catch (err) { next(err); }
};

const updatePaymentStatus = async (req, res, next) => {
  try {
    if (!PAYMENT_STATUSES.includes(req.body.status)) return next(new AppError('Invalid payment status', 400));
    const sqlPayment = await sqlRead.updateAdminPaymentStatus({
      paymentId: req.params.id,
      status: req.body.status,
      changedBy: req.user._id,
    });
    res.json({ status: 'success', data: { payment: sqlPayment } });
  } catch (err) { next(err); }
};

const listUsers = async (req, res, next) => {
  try {
    const page = parsePositiveInteger(req.query.page, 'page', { defaultValue: 1 });
    const limit = parsePositiveInteger(req.query.limit, 'limit', {
      defaultValue: 20,
      max: 100,
    });
    const result = await sqlRead.listUsers({
      role: req.query.role,
      is_verified: req.query.is_verified !== undefined ? req.query.is_verified === 'true' : undefined,
      page,
      limit,
    });
    res.json({
      status: 'success',
      ...result,
      page,
      totalPages: Math.ceil(result.total / limit),
      data: { users: result.users },
    });
  } catch (err) { next(err); }
};

const getUser = async (req, res, next) => {
  try {
    assertObjectId(req.params.id, 'user_id');
    const user = await User.findById(req.params.id);
    if (!user) return next(new AppError('User not found', 404));
    res.json({ status: 'success', data: { user } });
  } catch (err) { next(err); }
};

const updateUserVerification = async (req, res, next) => {
  try {
    if (typeof req.body.is_verified !== 'boolean') return next(new AppError('is_verified must be a boolean', 400));
    assertObjectId(req.params.id, 'user_id');
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { is_verified: req.body.is_verified },
      { new: true, runValidators: true }
    );
    if (!user) return next(new AppError('User not found', 404));
    await safeMirror(`user ${user._id}`, () => syncUser(user));
    res.json({ status: 'success', data: { user } });
  } catch (err) { next(err); }
};

const listReviews = async (req, res, next) => {
  try {
    const result = await paginated(Review, {}, req);
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
