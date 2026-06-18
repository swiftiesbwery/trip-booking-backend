const Review = require('../models/Review');
const AppError = require('../utils/AppError');
const fs = require('fs');
const sqlRead = require('../services/sqlReadService');

const getUploadedReviewPhotos = (req) => [
  ...(req.files?.photos || []),
  ...(req.files?.['photos[]'] || []),
];

const cleanupUploadedReviewPhotos = (files = []) => {
  files.forEach((file) => {
    if (file?.path) {
      fs.unlink(file.path, () => {});
    }
  });
};

// POST /reviews - buat review untuk booking yang layak direview
const createReview = async (req, res, next) => {
  const uploadedPhotos = getUploadedReviewPhotos(req);
  try {
    const body = req.body || {};
    const { booking_id, comment } = body;
    const ratingRaw = Array.isArray(body.rating) ? body.rating[0] : body.rating;

    console.log('BODY', req.body);
    console.log('FILES', req.files);

    if (uploadedPhotos.length > 5) {
      cleanupUploadedReviewPhotos(uploadedPhotos);
      return next(new AppError('Maximum 5 review photos are allowed', 400));
    }

    if (ratingRaw === undefined || ratingRaw === null || ratingRaw === '') {
      cleanupUploadedReviewPhotos(uploadedPhotos);
      return next(new AppError('rating is required', 400));
    }

    const ratingNumber = Number(ratingRaw);
    if (!Number.isInteger(ratingNumber) || ratingNumber < 1 || ratingNumber > 5) {
      cleanupUploadedReviewPhotos(uploadedPhotos);
      return next(new AppError('Rating must be between 1 and 5', 400));
    }

    let booking = null;
    if (booking_id !== undefined && booking_id !== null && booking_id !== '') {
      const bookingId = Number(booking_id);
      if (Number.isInteger(bookingId) && bookingId > 0) {
        booking = await sqlRead.getReviewableBooking({
          bookingId,
          userId: String(req.user._id),
        });
      }
    }

    if (!booking) {
      booking = await sqlRead.getLatestReviewableBookingForUser({
        userId: String(req.user._id),
      });
    }

    if (!booking) {
      cleanupUploadedReviewPhotos(uploadedPhotos);
      return next(
        new AppError(
        'You do not have a trip booking that can be reviewed',
          403
        )
      );
    }

    const existingReview = await Review.findOne({
      booking_id: booking.id,
    });
    if (existingReview) {
      cleanupUploadedReviewPhotos(uploadedPhotos);
      return next(new AppError('You have already reviewed this booking', 403));
    }

    const photos = uploadedPhotos.map((file) => `/uploads/reviews/${file.filename}`);

    const review = await Review.create({
      user_id: String(req.user._id),
      user_name: req.user.name || booking.user_name,
      trip_id: booking.trip_id,
      trip_title: booking.trip_title,
      booking_id: booking.id,
      rating: ratingNumber,
      comment: typeof comment === 'string' ? comment.trim() : comment,
      photos,
    });

    res.status(201).json({
      status: 'success',
      message: 'Review submitted successfully.',
      data: { review },
    });
  } catch (err) {
    cleanupUploadedReviewPhotos(uploadedPhotos);
    next(err);
  }
};

// GET /reviews/my — semua review yang pernah dibuat user
const getMyReviews = async (req, res, next) => {
  try {
    const reviews = await Review.find({ user_id: String(req.user._id) }).sort({ createdAt: -1 });

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
