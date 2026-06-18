const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema(
  {
    user_id: {
      type: String,
      required: true,
    },
    user_name: String,
    trip_id: {
      type: String,
      required: true,
    },
    trip_title: String,
    booking_id: {
      type: Number,
      required: true,
    },
    rating: {
      type: Number,
      required: [true, 'Rating is required'],
      min: [1, 'Rating must be at least 1'],
      max: [5, 'Rating must be at most 5'],
    },
    comment: {
      type: String,
      trim: true,
    },
    photos: {
      type: [String],
      default: [],
    },
  },
  { timestamps: true }
);

reviewSchema.index({ trip_id: 1 });
reviewSchema.index({ user_id: 1 });
reviewSchema.index({ booking_id: 1 }, { unique: true });

module.exports = mongoose.model('Review', reviewSchema);
