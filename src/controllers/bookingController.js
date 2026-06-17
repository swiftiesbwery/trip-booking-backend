const Booking = require('../models/Booking');
const Trip = require('../models/Trip');
const Payment = require('../models/Payment');
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
      return next(new AppError('booking_type harus trip', 400));
    }
    if (!trip_id || qty === undefined) {
      return next(
        new AppError('booking_type, trip_id, dan qty wajib diisi', 400)
      );
    }

    const quantity = parsePositiveInteger(qty, 'qty');
    const sqlTrip = await sqlRead.getTripByMongoId(trip_id, { activeOnly: false });
    if (sqlTrip) {
      const booking = await sqlRead.createSqlBooking({
        userId: String(req.user._id),
        tripId: trip_id,
        qty: quantity,
      });
      return res.status(201).json({ status: 'success', data: { booking } });
    }

    assertObjectId(trip_id, 'trip_id');
    const trip = await Trip.findById(trip_id);
    if (!trip) return next(new AppError('Trip tidak ditemukan', 404));
    if (trip.status !== 'active') {
      return next(new AppError('Trip sedang tidak aktif dan tidak dapat dibooking', 400));
    }

    const tripStartDate = trip.start_date || trip.departure_date;
    const tripEndDate = trip.end_date || tripStartDate;
    if (
      !tripStartDate ||
      !tripEndDate ||
      Number.isNaN(new Date(tripStartDate).getTime()) ||
      Number.isNaN(new Date(tripEndDate).getTime())
    ) {
      return next(new AppError('Trip belum memiliki jadwal yang valid', 400));
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
        new AppError(`Kuota trip tidak mencukupi. Sisa kuota: ${remainingQuota}`, 400)
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
    if (!mongoose.isValidObjectId(req.params.id)) {
      const booking = await sqlRead.getPendingSqlBookingForPayment(
        req.params.id,
        String(req.user._id)
      );
      if (!booking) return next(new AppError('Booking tidak ditemukan', 404));
      req.sqlBooking = booking;
      return next();
    }

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
    const bankName = method === 'Transfer Bank' ? req.body.bank_name : null;
    if (method === 'Transfer Bank' && !BANK_NAMES.includes(bankName)) {
      return next(new AppError('Bank transfer tidak valid', 400));
    }
    let cardLast4 = null;
    if (method === 'Debit/Kredit') {
      const cardNumber = String(req.body.card_number || '').replace(/\s+/g, '');
      if (!/^\d{12,19}$/.test(cardNumber)) {
        return next(new AppError('Nomor kartu harus berupa angka', 400));
      }
      if (!/^(0[1-9]|1[0-2])\/\d{2}$/.test(String(req.body.expiry || ''))) {
        return next(new AppError('Expiry kartu harus format MM/YY', 400));
      }
      if (!/^\d{3,4}$/.test(String(req.body.cvv || ''))) {
        return next(new AppError('CVV harus 3-4 digit', 400));
      }
      cardLast4 = cardNumber.slice(-4);
    }

    const proofUrl =
      (req.file && `/uploads/payments/${req.file.filename}`) ||
      req.body.payment_proof ||
      req.body.proof_url;
    if (!proofUrl || typeof proofUrl !== 'string' || !proofUrl.trim()) {
      return next(new AppError('Bukti pembayaran wajib diisi', 400));
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
        message: 'Payment berhasil disubmit dan sedang diperiksa',
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
    const { bookings, total } = await sqlRead.listBookings({
      userId: String(req.user._id),
      status,
      page: pageNumber,
      limit: limitNumber,
    });

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
    if (!mongoose.isValidObjectId(req.params.id)) {
      const booking = await sqlRead.getBookingByMongoId(req.params.id, String(req.user._id));
      if (!booking) return next(new AppError('Booking tidak ditemukan', 404));
      return res.status(200).json({ status: 'success', data: { booking } });
    }

    assertObjectId(req.params.id, 'booking_id');
    const booking = await sqlRead.getBookingByMongoId(req.params.id, String(req.user._id));
    if (!booking) return next(new AppError('Booking tidak ditemukan', 404));
    res.status(200).json({ status: 'success', data: { booking } });
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
    if (!booking) return next(new AppError('Booking tidak ditemukan', 404));
    if (booking.status !== 'pending') {
      return next(new AppError('Hanya booking pending yang dapat dibatalkan', 400));
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
