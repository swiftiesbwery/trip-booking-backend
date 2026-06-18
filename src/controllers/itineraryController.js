const Itinerary = require('../models/Itinerary');
const TripItineraryTemplate = require('../models/TripItineraryTemplate');
const AppError = require('../utils/AppError');
const sqlRead = require('../services/sqlReadService');

const canPlanItinerary = (booking) =>
  booking?.booking_type === 'trip' &&
  booking.status === 'confirmed' &&
  booking.payment_id?.status === 'verified';

const normalizeTemplateDays = (days = []) =>
  days.map((day, index) => ({
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
  }));

const normalizeCustomDays = (days) => {
  if (!Array.isArray(days)) {
    throw new AppError('days must be an array', 400);
  }

  return days.map((day, index) => ({
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
  }));
};

const getEligibleBooking = async (bookingId, userId) => {
  const booking = await sqlRead.getBookingByMongoId(bookingId, userId);
  if (!booking) {
    throw new AppError('Booking not found', 404);
  }
  if (!canPlanItinerary(booking)) {
    throw new AppError('Itinerary planner is available after payment is verified and booking is confirmed', 403);
  }
  return booking;
};

const getTripId = (booking) => String(booking.trip_id?._id || booking.trip_id || '');

const getExistingItinerary = async (bookingId, userId) =>
  Itinerary.findOne({
    booking_id: String(bookingId),
    user_id: String(userId),
  });

const ensureUnlockedItinerary = (itinerary) => {
  if (itinerary?.is_locked) {
    throw new AppError('This itinerary has been locked and can no longer be edited.', 403);
  }
};

const getItineraryPlanner = async (req, res, next) => {
  try {
    const booking = await getEligibleBooking(req.params.bookingId, String(req.user._id));
    const tripId = getTripId(booking);
    const existingItinerary = await getExistingItinerary(booking._id, req.user._id);
    const template = await TripItineraryTemplate.findOne({ trip_id: tripId }).lean();

    res.status(200).json({
      status: 'success',
      data: {
        booking,
        itinerary: existingItinerary ? existingItinerary.toObject() : null,
        template,
        can_plan_itinerary: true,
        itinerary_ready: Boolean(existingItinerary),
        is_locked: Boolean(existingItinerary?.is_locked),
      },
    });
  } catch (err) {
    next(err);
  }
};

const saveRecommendedItinerary = async (req, res, next) => {
  try {
    const booking = await getEligibleBooking(req.params.bookingId, String(req.user._id));
    const tripId = getTripId(booking);
    const template = await TripItineraryTemplate.findOne({ trip_id: tripId }).lean();
    if (!template) {
      return next(new AppError('Recommended itinerary template is not available for this trip', 404));
    }
    const existingItinerary = await getExistingItinerary(booking._id, req.user._id);
    if (existingItinerary) {
      throw new AppError('You have already submitted an itinerary for this booking.', 400);
    }

    const itinerary = await Itinerary.create({
      booking_id: String(booking._id),
      user_id: String(req.user._id),
      trip_id: tripId,
      type: 'recommended',
      days: normalizeTemplateDays(template.days),
      is_locked: true,
    });

    res.status(200).json({
      status: 'success',
      message: 'Recommended itinerary saved.',
      data: { itinerary },
    });
  } catch (err) {
    next(err);
  }
};

const saveCustomItinerary = async (req, res, next) => {
  try {
    const booking = await getEligibleBooking(req.params.bookingId, String(req.user._id));
    const tripId = getTripId(booking);
    const days = normalizeCustomDays(req.body.days);
    const existingItinerary = await getExistingItinerary(booking._id, req.user._id);
    ensureUnlockedItinerary(existingItinerary);
    if (existingItinerary) {
      throw new AppError('You have already submitted an itinerary for this booking.', 400);
    }

    const itinerary = await Itinerary.create({
      booking_id: String(booking._id),
      user_id: String(req.user._id),
      trip_id: tripId,
      type: 'custom',
      days,
      is_locked: true,
    });

    res.status(200).json({
      status: 'success',
      message: 'Custom itinerary saved.',
      data: { itinerary },
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  canPlanItinerary,
  getItineraryPlanner,
  saveCustomItinerary,
  saveRecommendedItinerary,
};
