const Itinerary = require('../models/Itinerary');
const AppError = require('../utils/AppError');
const sqlRead = require('../services/sqlReadService');
const { assertObjectId, parsePositiveInteger } = require('../utils/validation');

const normalizeDays = (days = []) => {
  if (!Array.isArray(days)) {
    throw new AppError('days must be an array', 400);
  }

  return days
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
};

const getBookingSummary = async (bookingId) => {
  if (!bookingId) return null;
  return sqlRead.getAdminBooking(bookingId);
};

const serializeItinerary = (itinerary, booking) => {
  const user = booking?.user_id || null;
  const trip = booking?.trip_id || null;
  const payment = booking?.payment_id || null;

  return {
    ...itinerary.toObject(),
    status: itinerary.is_locked ? 'Submitted' : 'Draft',
    booking: booking
      ? {
          _id: booking._id,
          booking_type: booking.booking_type,
          status: booking.status,
          qty: booking.qty,
          visit_date: booking.visit_date,
          total_price: booking.total_price,
          user_id: user,
          trip_id: trip,
          destination_id: booking.destination_id,
          payment_id: payment,
        }
      : null,
    booking_status: booking?.status || '',
    payment_status: payment?.status || booking?.payment_status || '',
    user_name: user?.name || '',
    trip_title: trip?.title || '',
    user_email: user?.email || '',
    trip,
    user,
    payment,
  };
};

const listItineraries = async (req, res, next) => {
  try {
    const page = parsePositiveInteger(req.query.page, 'page', { defaultValue: 1 });
    const limit = parsePositiveInteger(req.query.limit, 'limit', {
      defaultValue: 20,
      max: 100,
    });

    const [items, total] = await Promise.all([
      Itinerary.find({})
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Itinerary.countDocuments({}),
    ]);

    const bookings = await Promise.all(items.map((item) => getBookingSummary(item.booking_id)));
    const itineraries = items.map((item, index) => serializeItinerary(item, bookings[index]));

    res.json({
      status: 'success',
      items: itineraries,
      total,
      page,
      totalPages: Math.ceil(total / limit),
      data: { itineraries },
    });
  } catch (err) {
    next(err);
  }
};

const getItinerary = async (req, res, next) => {
  try {
    assertObjectId(req.params.id, 'itinerary_id');
    const itinerary = await Itinerary.findById(req.params.id);
    if (!itinerary) {
      return next(new AppError('Itinerary not found', 404));
    }
    const booking = await getBookingSummary(itinerary.booking_id);

    res.json({
      status: 'success',
      data: {
        itinerary: serializeItinerary(itinerary, booking),
      },
    });
  } catch (err) {
    next(err);
  }
};

const updateItinerary = async (req, res, next) => {
  try {
    assertObjectId(req.params.id, 'itinerary_id');
    const itinerary = await Itinerary.findById(req.params.id);
    if (!itinerary) {
      return next(new AppError('Itinerary not found', 404));
    }
    const days = normalizeDays(req.body.days);
    itinerary.days = days;
    await itinerary.save({ validateModifiedOnly: true });
    const booking = await getBookingSummary(itinerary.booking_id);

    res.json({
      status: 'success',
      message: 'Itinerary updated.',
      data: {
        itinerary: serializeItinerary(itinerary, booking),
      },
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getItinerary,
  listItineraries,
  updateItinerary,
};
