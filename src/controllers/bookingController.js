const Booking = require('../models/Booking');
const Trip = require('../models/Trip');
const Payment = require('../models/Payment');
const Itinerary = require('../models/Itinerary');
const mongoose = require('mongoose');
const AppError = require('../utils/AppError');
const {
  safeMirror,
  syncBooking,
  syncPayment,
} = require('../services/sqlMirrorService');
const sqlRead = require('../services/sqlReadService');
const {
  assertObjectId,
  parsePositiveInteger,
} = require('../utils/validation');

const BOOKING_STATUSES = ['pending', 'confirmed', 'completed', 'cancelled'];
const PAYMENT_METHODS = ['QRIS', 'Transfer Bank', 'Debit/Kredit'];
const BANK_NAMES = ['BCA', 'Mandiri', 'BRI', 'BNI'];

const canPlanItinerary = (booking) =>
  booking?.booking_type === 'trip' &&
  booking.status === 'confirmed' &&
  booking.payment_id?.status === 'verified';

const addItineraryFlags = async (bookings) => {
  const list = Array.isArray(bookings) ? bookings : [bookings].filter(Boolean);
  if (!list.length) return bookings;

  const bookingIds = list.map((booking) => String(booking._id));
  const itineraries = await Itinerary.find({ booking_id: { $in: bookingIds } })
    .select('booking_id')
    .lean();
  const readyBookingIds = new Set(itineraries.map((item) => String(item.booking_id)));

  const flagged = list.map((booking) => ({
    ...booking,
    can_plan_itinerary: canPlanItinerary(booking),
    itinerary_ready: readyBookingIds.has(String(booking._id)),
  }));

  flagged.forEach((booking) => {
    console.log({
      bookingId: booking._id,
      bookingStatus: booking.status,
      paymentStatus: booking.payment_id?.status,
      canPlanItinerary: booking.can_plan_itinerary,
    });
  });

  return Array.isArray(bookings) ? flagged : flagged[0];
};

const populateBooking = (query) =>
  query.populate([
    { path: 'trip_id' },
    { path: 'destination_id' },
    { path: 'payment_id' },
  ]);

const createBooking = async (req, res, next) => {
  try {
    const { booking_type, trip_id, qty } = req.body;
    if (booking_type !== 'trip') {
      return next(new AppError('booking_type must be trip', 400));
    }
    if (!trip_id || qty === undefined) {
      return next(
        new AppError('booking_type, trip_id, and qty are required', 400)
      );
    }

    const quantity = parsePositiveInteger(qty, 'qty');
    const sqlTrip = await sqlRead.getTripByMongoId(trip_id, { activeOnly: false });
    if (sqlTrip) {
      if (sqlTrip.status !== 'active') {
        return next(new AppError('Trip is inactive and cannot be booked', 400));
      }
      const booking = await sqlRead.createSqlBooking({
        userId: String(req.user._id),
        tripId: trip_id,
        qty: quantity,
      });
      return res.status(201).json({ status: 'success', data: { booking } });
    }

    assertObjectId(trip_id, 'trip_id');
    const trip = await Trip.findById(trip_id);
    if (!trip) return next(new AppError('Trip not found', 404));
    if (trip.status !== 'active') {
      return next(new AppError('Trip is inactive and cannot be booked', 400));
    }

    const tripStartDate = trip.start_date || trip.departure_date;
    const tripEndDate = trip.end_date || tripStartDate;
    if (
      !tripStartDate ||
      !tripEndDate ||
      Number.isNaN(new Date(tripStartDate).getTime()) ||
      Number.isNaN(new Date(tripEndDate).getTime())
    ) {
      return next(new AppError('Trip does not have a valid schedule yet', 400));
    }

    const booked = await Booking.aggregate([
      {
        $match: {
          trip_id: trip._id,
          status: { $in: ['pending', 'confirmed', 'completed'] },
        },
      },
      { $group: { _id: null, total: { $sum: '$qty' } } },
    ]);
    if (quantity > trip.quota - (booked[0]?.total || 0)) {
      const remainingQuota = Math.max(trip.quota - (booked[0]?.total || 0), 0);
      return next(
        new AppError(`Trip quota is not sufficient. Remaining quota: ${remainingQuota}`, 400)
      );
    }

    const booking = await Booking.create({
      user_id: req.user._id,
      booking_type: 'trip',
      trip_id: trip._id,
      destination_id: null,
      qty: quantity,
      visit_date: tripStartDate,
      total_price: trip.price * quantity,
      status: 'pending',
    });
    await safeMirror(`booking ${booking._id}`, () =>
      syncBooking(booking, {
        recordHistory: true,
        changedBy: req.user._id,
        notes: 'Booking dibuat',
      })
    );
    await populateBooking(booking);

    res.status(201).json({ status: 'success', data: { booking } });
  } catch (err) {
    next(err);
  }
};

const authorizePaymentBooking = async (req, res, next) => {
  try {
    const booking = await sqlRead.getPendingSqlBookingForPayment(
      req.params.id,
      String(req.user._id)
    );
    if (booking) {
      req.sqlBooking = booking;
      return next();
    }

    if (!mongoose.isValidObjectId(req.params.id)) {
      return next(new AppError('Booking not found', 404));
    }

    assertObjectId(req.params.id, 'booking_id');
    const mongoBooking = await Booking.findOne({
      _id: req.params.id,
      user_id: req.user._id,
    });
    if (!mongoBooking) return next(new AppError('Booking not found', 404));
    if (mongoBooking.status !== 'pending') {
      return next(new AppError('Only pending bookings can be paid', 400));
    }
    if (mongoBooking.payment_id) {
      return next(new AppError('A payment for this booking already exists', 400));
    }
    req.booking = mongoBooking;
    next();
  } catch (err) {
    next(err);
  }
};

const uploadPayment = async (req, res, next) => {
  try {
    const { method } = req.body;
    if (!PAYMENT_METHODS.includes(method)) {
      return next(new AppError('Invalid payment method', 400));
    }
    const bankName = method === 'Transfer Bank' ? req.body.bank_name : null;
    if (method === 'Transfer Bank' && !BANK_NAMES.includes(bankName)) {
      return next(new AppError('Invalid bank transfer option', 400));
    }
    let cardLast4 = null;
    if (method === 'Debit/Kredit') {
      const cardNumber = String(req.body.card_number || '').replace(/\s+/g, '');
      if (!/^\d{12,19}$/.test(cardNumber)) {
        return next(new AppError('Card number must contain digits only', 400));
      }
      if (!/^(0[1-9]|1[0-2])\/\d{2}$/.test(String(req.body.expiry || ''))) {
        return next(new AppError('Card expiry must use MM/YY format', 400));
      }
      if (!/^\d{3,4}$/.test(String(req.body.cvv || ''))) {
        return next(new AppError('CVV must be 3-4 digits', 400));
      }
      cardLast4 = cardNumber.slice(-4);
    }

    const proofUrl =
      (req.file && `/uploads/payments/${req.file.filename}`) ||
      req.body.payment_proof ||
      req.body.proof_url;
    if (!proofUrl || typeof proofUrl !== 'string' || !proofUrl.trim()) {
      return next(new AppError('Payment proof is required', 400));
    }

    if (req.sqlBooking) {
      const { payment, booking } = await sqlRead.createSqlPayment({
        bookingId: req.params.id,
        userId: String(req.user._id),
        method,
        proofUrl: proofUrl.trim(),
        bankName,
        cardLast4,
      });
      return res.status(201).json({
        status: 'success',
        message: 'Payment submitted and under review',
        data: { payment, booking },
      });
    }

    const payment = await Payment.create({
      booking_id: req.booking._id,
      user_id: req.user._id,
      amount: req.booking.total_price,
      method,
      proof_url: proofUrl.trim(),
      bank_name: bankName,
      card_last4: cardLast4,
      status: 'checking',
    });
    req.booking.payment_id = payment._id;
    await req.booking.save();
    await safeMirror(`payment ${payment._id}`, () => syncPayment(payment));

    res.status(201).json({
      status: 'success',
      message: 'Payment submitted and under review',
      data: { payment, booking: req.booking },
    });
  } catch (err) {
    next(err);
  }
};

const getMyBookings = async (req, res, next) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;
    if (status && !BOOKING_STATUSES.includes(status)) {
      return next(new AppError('Invalid booking status', 400));
    }
    const pageNumber = parsePositiveInteger(page, 'page', { defaultValue: 1 });
    const limitNumber = parsePositiveInteger(limit, 'limit', {
      defaultValue: 10,
      max: 100,
    });
    const { bookings, total } = await sqlRead.listBookings({
      userId: String(req.user._id),
      status,
      page: pageNumber,
      limit: limitNumber,
    });

    const flaggedBookings = await addItineraryFlags(bookings);

    res.status(200).json({
      status: 'success',
      results: flaggedBookings.length,
      total,
      totalPages: Math.ceil(total / limitNumber),
      currentPage: pageNumber,
      data: { bookings: flaggedBookings },
    });
  } catch (err) {
    next(err);
  }
};

const getBookingById = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      const booking = await sqlRead.getBookingByMongoId(req.params.id, String(req.user._id));
      if (!booking) return next(new AppError('Booking not found', 404));
      const flaggedBooking = await addItineraryFlags(booking);
      return res.status(200).json({ status: 'success', data: { booking: flaggedBooking } });
    }

    assertObjectId(req.params.id, 'booking_id');
    const booking = await sqlRead.getBookingByMongoId(req.params.id, String(req.user._id));
    if (!booking) return next(new AppError('Booking not found', 404));
    const flaggedBooking = await addItineraryFlags(booking);
    res.status(200).json({ status: 'success', data: { booking: flaggedBooking } });
  } catch (err) {
    next(err);
  }
};

const cancelBooking = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      const booking = await sqlRead.cancelSqlBooking({
        bookingId: req.params.id,
        userId: String(req.user._id),
      });
      return res.status(200).json({ status: 'success', data: { booking } });
    }

    assertObjectId(req.params.id, 'booking_id');
    const booking = await Booking.findOne({
      _id: req.params.id,
      user_id: req.user._id,
    });
    if (!booking) return next(new AppError('Booking not found', 404));
    if (booking.status !== 'pending') {
      return next(new AppError('Only pending bookings can be cancelled', 400));
    }
    const previousStatus = booking.status;
    booking.status = 'cancelled';
    await booking.save();
    await safeMirror(`booking ${booking._id}`, () =>
      syncBooking(booking, {
        previousStatus,
        recordHistory: true,
        changedBy: req.user._id,
        notes: 'Booking dibatalkan oleh user',
      })
    );
    res.status(200).json({ status: 'success', data: { booking } });
  } catch (err) {
    next(err);
  }
};

const getMyPayments = async (req, res, next) => {
  try {
    const payments = await sqlRead.listPayments(String(req.user._id));
    res.status(200).json({
      status: 'success',
      results: payments.length,
      data: { payments },
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  authorizePaymentBooking,
  cancelBooking,
  createBooking,
  getBookingById,
  getMyBookings,
  getMyPayments,
  uploadPayment,
};
