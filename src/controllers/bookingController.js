const Booking = require('../models/Booking');
const Trip = require('../models/Trip');
const Payment = require('../models/Payment');
const AppError = require('../utils/AppError');
const {
  assertObjectId,
  parsePositiveInteger,
} = require('../utils/validation');

// POST /bookings — buat booking baru
const createBooking = async (req, res, next) => {
  try {
    const { trip_id, num_participants } = req.body;

    if (!trip_id || num_participants === undefined) {
      return next(new AppError('trip_id dan num_participants wajib diisi', 400));
    }

    assertObjectId(trip_id, 'trip_id');
    const participants = parsePositiveInteger(num_participants, 'num_participants');

    // Cek trip tersedia
    const trip = await Trip.findOne({
      _id: trip_id,
      status: 'active',
      departure_date: { $gte: new Date() },
    });
    if (!trip) {
      return next(new AppError('Trip tidak ditemukan atau tidak aktif', 404));
    }

    // Cek kuota tersisa
    const confirmedBookings = await Booking.aggregate([
      {
        $match: {
          trip_id: trip._id,
          status: { $in: ['pending', 'waiting_payment', 'confirmed'] },
        },
      },
      { $group: { _id: null, totalParticipants: { $sum: '$num_participants' } } },
    ]);
    const bookedSlots = confirmedBookings[0]?.totalParticipants || 0;
    const remainingQuota = trip.quota - bookedSlots;

    if (participants > remainingQuota) {
      return next(
        new AppError(`Kuota tidak cukup. Sisa kuota: ${remainingQuota}`, 400)
      );
    }

    // Cegah booking ganda untuk trip yang sama (jika belum cancelled)
    const existingBooking = await Booking.findOne({
      user_id: req.user._id,
      trip_id,
      status: { $in: ['pending', 'waiting_payment', 'confirmed'] },
    });
    if (existingBooking) {
      return next(new AppError('Kamu sudah memiliki booking aktif untuk trip ini', 400));
    }

    const total_price = trip.price * participants;

    const booking = await Booking.create({
      user_id: req.user._id,
      trip_id,
      num_participants: participants,
      total_price,
    });

    // Populate untuk response yang informatif
    await booking.populate({
      path: 'trip_id',
      select: 'title destinations price departure_date',
      populate: { path: 'destinations.destination_id' },
    });

    res.status(201).json({
      status: 'success',
      message: 'Booking berhasil dibuat. Silakan upload bukti pembayaran.',
      data: { booking },
    });
  } catch (err) {
    next(err);
  }
};

// Pastikan ownership dan status booking valid sebelum Multer menyimpan file.
const authorizePaymentBooking = async (req, res, next) => {
  try {
    assertObjectId(req.params.id, 'booking_id');

    const booking = await Booking.findOne({
      _id: req.params.id,
      user_id: req.user._id,
    });

    if (!booking) {
      return next(new AppError('Booking tidak ditemukan', 404));
    }

    if (booking.status === 'confirmed') {
      return next(new AppError('Booking ini sudah dikonfirmasi', 400));
    }

    if (booking.status === 'cancelled') {
      return next(new AppError('Booking ini sudah dibatalkan', 400));
    }

    if (booking.payment_id) {
      return next(new AppError('Pembayaran untuk booking ini sudah disubmit', 400));
    }

    req.booking = booking;
    next();
  } catch (err) {
    next(err);
  }
};

// POST /bookings/:id/payment - upload atau submit bukti pembayaran
const uploadPayment = async (req, res, next) => {
  try {
    const booking = req.booking;

    const paymentProof =
      req.file && `/uploads/payments/${req.file.filename}`;
    const proof_url =
      paymentProof || req.body.payment_proof || req.body.proof_url;

    if (!proof_url || typeof proof_url !== 'string' || !proof_url.trim()) {
      return next(
        new AppError(
          'Bukti pembayaran wajib berupa file atau payment_proof string',
          400
        )
      );
    }

    const paymentMethod = req.body.payment_method || 'transfer';
    const allowedMethods = ['transfer', 'ewallet', 'cash'];
    if (!allowedMethods.includes(paymentMethod)) {
      return next(new AppError('Metode pembayaran tidak valid', 400));
    }

    const amount =
      req.body.amount === undefined ? booking.total_price : Number(req.body.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return next(new AppError('Jumlah pembayaran harus berupa angka positif', 400));
    }
    if (amount !== booking.total_price) {
      return next(
        new AppError(`Jumlah pembayaran harus sama dengan total booking: ${booking.total_price}`, 400)
      );
    }

    const payment =
      await Payment.create({
        booking_id: booking._id,
        user_id: req.user._id,
        amount,
        payment_method: paymentMethod,
        proof_url: proof_url.trim(),
        status: 'pending',
      });

    booking.payment_id = payment._id;
    booking.status = 'waiting_payment';

    await booking.save();

    res.status(200).json({
      status: 'success',
      message:
        'Bukti pembayaran berhasil diupload. Menunggu verifikasi admin.',
      data: {
        booking,
        payment,
      },
    });
  } catch (err) {
    next(err);
  }
};

// GET /bookings/my — riwayat booking milik user yang login
const getMyBookings = async (req, res, next) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;
    const pageNumber = parsePositiveInteger(page, 'page', { defaultValue: 1 });
    const limitNumber = parsePositiveInteger(limit, 'limit', {
      defaultValue: 10,
      max: 100,
    });

    const filter = { user_id: req.user._id };
    if (status) {
      const allowedStatuses = ['pending', 'waiting_payment', 'confirmed', 'cancelled'];
      if (!allowedStatuses.includes(status)) {
        return next(new AppError('Status booking tidak valid', 400));
      }
      filter.status = status;
    }

    const skip = (pageNumber - 1) * limitNumber;

    const [bookings, total] = await Promise.all([
      Booking.find(filter)
        .populate({
          path: 'trip_id',
          populate: { path: 'destinations.destination_id' },
        })
        .populate('payment_id')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNumber),
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

// GET /bookings/:id — detail satu booking milik user
const getBookingById = async (req, res, next) => {
  try {
    assertObjectId(req.params.id, 'booking_id');

    const booking = await Booking.findOne({
      _id: req.params.id,
      user_id: req.user._id,
    })
      .populate({
        path: 'trip_id',
        populate: { path: 'destinations.destination_id' },
      })
      .populate('payment_id');

    if (!booking) {
      return next(new AppError('Booking tidak ditemukan', 404));
    }

    res.status(200).json({
      status: 'success',
      data: { booking },
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  authorizePaymentBooking,
  createBooking,
  uploadPayment,
  getMyBookings,
  getBookingById,
};
