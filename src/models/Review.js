const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    trip_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Trip',
      required: true,
    },
    booking_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booking',
      required: true,
    },
    rating: {
      type: Number,
      required: [true, 'Rating wajib diisi'],
      min: [1, 'Rating minimal 1'],
      max: [5, 'Rating maksimal 5'],
    },
    comment: {
      type: String,
      trim: true,
    },
  },
  { timestamps: true }
);

reviewSchema.index({ trip_id: 1 });
reviewSchema.index({ user_id: 1 });
reviewSchema.index({ user_id: 1, trip_id: 1 }, { unique: true });

module.exports = mongoose.model('Review', reviewSchema);
