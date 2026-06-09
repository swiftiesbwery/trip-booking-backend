const Review = require('../models/Review');
const Booking = require('../models/Booking');
const AppError = require('../utils/AppError');
const {
  assertObjectId,
  parsePositiveInteger,
} = require('../utils/validation');

// POST /reviews - buat review untuk trip yang pernah dibooking user
const createReview = async (req, res, next) => {
  try {
    const { booking_id, trip_id, rating, comment } = req.body;

    if (!booking_id || rating === undefined) {
      return next(new AppError('booking_id dan rating wajib diisi', 400));
    }

    assertObjectId(booking_id, 'booking_id');
    if (trip_id) assertObjectId(trip_id, 'trip_id');
    const ratingNumber = parsePositiveInteger(rating, 'rating');
    if (ratingNumber > 5) {
      return next(new AppError('Rating harus antara 1 sampai 5', 400));
    }

    const booking = await Booking.findOne({
      _id: booking_id,
      user_id: req.user._id,
      status: { $ne: 'cancelled' },
    });

    if (!booking) {
      return next(
        new AppError(
          'Booking tidak ditemukan, bukan milikmu, atau sudah dibatalkan',
          400
        )
      );
    }

    if (trip_id && booking.trip_id.toString() !== trip_id) {
      return next(new AppError('trip_id tidak sesuai dengan booking', 400));
    }

    const existingReview = await Review.findOne({
      user_id: req.user._id,
      trip_id: booking.trip_id,
    });
    if (existingReview) {
      return next(new AppError('Kamu sudah memberikan review untuk trip ini', 400));
    }

    const review = await Review.create({
      user_id: req.user._id,
      trip_id: booking.trip_id,
      booking_id,
      rating: ratingNumber,
      comment: typeof comment === 'string' ? comment.trim() : comment,
    });

    await review.populate('user_id', 'name');

    res.status(201).json({
      status: 'success',
      message: 'Review berhasil dikirim. Terima kasih!',
      data: { review },
    });
  } catch (err) {
    next(err);
  }
};

// GET /reviews/my — semua review yang pernah dibuat user
const getMyReviews = async (req, res, next) => {
  try {
    const reviews = await Review.find({ user_id: req.user._id })
      .populate({
        path: 'trip_id',
        select: 'title destinations',
        populate: { path: 'destinations.destination_id' },
      })
      .sort({ createdAt: -1 });

    res.status(200).json({
      status: 'success',
      results: reviews.length,
      data: { reviews },
    });
  } catch (err) {
    next(err);
  }
};

module.exports = { createReview, getMyReviews };
