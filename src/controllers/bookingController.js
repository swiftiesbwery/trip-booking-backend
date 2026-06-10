const Booking = require('../models/Booking');
const Trip = require('../models/Trip');
const Destination = require('../models/Destination');
const Payment = require('../models/Payment');
const AppError = require('../utils/AppError');
const {
  assertObjectId,
  parseDate,
  parsePositiveInteger,
} = require('../utils/validation');

const BOOKING_STATUSES = ['pending', 'confirmed', 'completed', 'cancelled'];
const PAYMENT_METHODS = ['QRIS', 'Transfer Bank', 'Debit/Kredit'];

const populateBooking = (query) =>
  query.populate('trip_id').populate('destination_id').populate('payment_id');

const createBooking = async (req, res, next) => {
  try {
    const { booking_type, trip_id, destination_id, qty, visit_date } = req.body;
    if (!['trip', 'destination'].includes(booking_type)) {
      return next(new AppError('booking_type harus trip atau destination', 400));
    }

    const quantity = parsePositiveInteger(qty, 'qty');
    const visitDate = parseDate(visit_date, 'visit_date');
    let item;

    if (booking_type === 'trip') {
      if (!trip_id || destination_id) {
        return next(new AppError('Booking trip wajib memiliki trip_id saja', 400));
      }
      assertObjectId(trip_id, 'trip_id');
      item = await Trip.findById(trip_id);
      if (!item) return next(new AppError('Trip tidak ditemukan', 404));

      const booked = await Booking.aggregate([
        {
          $match: {
            trip_id: item._id,
            status: { $in: ['pending', 'confirmed'] },
          },
        },
        { $group: { _id: null, total: { $sum: '$qty' } } },
      ]);
      if (quantity > item.quota - (booked[0]?.total || 0)) {
        return next(new AppError('Kuota trip tidak mencukupi', 400));
      }
    } else {
      if (!destination_id || trip_id) {
        return next(
          new AppError('Booking destination wajib memiliki destination_id saja', 400)
        );
      }
      assertObjectId(destination_id, 'destination_id');
      item = await Destination.findById(destination_id);
      if (!item) return next(new AppError('Destination tidak ditemukan', 404));
    }

    const booking = await Booking.create({
      user_id: req.user._id,
      booking_type,
      trip_id: booking_type === 'trip' ? item._id : null,
      destination_id: booking_type === 'destination' ? item._id : null,
      qty: quantity,
      visit_date: visitDate,
      total_price: item.price * quantity,
      status: 'pending',
    });
    await populateBooking(booking);

    res.status(201).json({ status: 'success', data: { booking } });
  } catch (err) {
    next(err);
  }
};

const authorizePaymentBooking = async (req, res, next) => {
  try {
    assertObjectId(req.params.id, 'booking_id');
    const booking = await Booking.findOne({
      _id: req.params.id,
      user_id: req.user._id,
    });
    if (!booking) return next(new AppError('Booking tidak ditemukan', 404));
    if (booking.status !== 'pending') {
      return next(new AppError('Hanya booking pending yang dapat dibayar', 400));
    }
    if (booking.payment_id) {
      return next(new AppError('Payment untuk booking ini sudah dibuat', 400));
    }
    req.booking = booking;
    next();
  } catch (err) {
    next(err);
  }
};

const uploadPayment = async (req, res, next) => {
  try {
    const { method } = req.body;
    if (!PAYMENT_METHODS.includes(method)) {
      return next(new AppError('Metode payment tidak valid', 400));
    }

    const proofUrl =
      (req.file && `/uploads/payments/${req.file.filename}`) ||
      req.body.payment_proof ||
      req.body.proof_url;
    if (!proofUrl || typeof proofUrl !== 'string' || !proofUrl.trim()) {
      return next(new AppError('Bukti pembayaran wajib diisi', 400));
    }

    const payment = await Payment.create({
      booking_id: req.booking._id,
      user_id: req.user._id,
      amount: req.booking.total_price,
      method,
      proof_url: proofUrl.trim(),
      status: 'checking',
    });
    req.booking.payment_id = payment._id;
    await req.booking.save();

    res.status(201).json({
      status: 'success',
      message: 'Payment berhasil disubmit dan sedang diperiksa',
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
      return next(new AppError('Status booking tidak valid', 400));
    }
    const pageNumber = parsePositiveInteger(page, 'page', { defaultValue: 1 });
    const limitNumber = parsePositiveInteger(limit, 'limit', {
      defaultValue: 10,
      max: 100,
    });
    const filter = { user_id: req.user._id };
    if (status) filter.status = status;

    const [bookings, total] = await Promise.all([
      populateBooking(
        Booking.find(filter)
          .sort({ createdAt: -1 })
          .skip((pageNumber - 1) * limitNumber)
          .limit(limitNumber)
      ),
      Booking.countDocuments(filter),
    ]);
    res.status(200).json({
      status: 'success',
      results: bookings.length,
      total,
      totalPages: Math.ceil(total / limitNumber),
      currentPage: pageNumber,
      data: { bookings },
    });
  } catch (err) {
    next(err);
  }
};

const getBookingById = async (req, res, next) => {
  try {
    assertObjectId(req.params.id, 'booking_id');
    const booking = await populateBooking(
      Booking.findOne({ _id: req.params.id, user_id: req.user._id })
    );
    if (!booking) return next(new AppError('Booking tidak ditemukan', 404));
    res.status(200).json({ status: 'success', data: { booking } });
  } catch (err) {
    next(err);
  }
};

const cancelBooking = async (req, res, next) => {
  try {
    assertObjectId(req.params.id, 'booking_id');
    const booking = await Booking.findOne({
      _id: req.params.id,
      user_id: req.user._id,
    });
    if (!booking) return next(new AppError('Booking tidak ditemukan', 404));
    if (booking.status !== 'pending') {
      return next(new AppError('Hanya booking pending yang dapat dibatalkan', 400));
    }
    booking.status = 'cancelled';
    await booking.save();
    res.status(200).json({ status: 'success', data: { booking } });
  } catch (err) {
    next(err);
  }
};

const getMyPayments = async (req, res, next) => {
  try {
    const payments = await Payment.find({ user_id: req.user._id })
      .populate({
        path: 'booking_id',
        populate: [{ path: 'trip_id' }, { path: 'destination_id' }],
      })
      .sort({ createdAt: -1 });
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
