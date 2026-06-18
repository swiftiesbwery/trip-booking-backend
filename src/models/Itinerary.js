const mongoose = require('mongoose');

const itineraryActivitySchema = new mongoose.Schema(
  {
    time: {
      type: String,
      trim: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
  },
  { _id: false }
);

const itineraryDaySchema = new mongoose.Schema(
  {
    day: {
      type: Number,
      required: true,
      min: 1,
    },
    title: {
      type: String,
      trim: true,
    },
    activities: {
      type: [itineraryActivitySchema],
      default: [],
    },
  },
  { _id: false }
);

const itinerarySchema = new mongoose.Schema(
  {
    booking_id: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    user_id: {
      type: String,
      required: true,
      index: true,
    },
    trip_id: {
      type: String,
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ['recommended', 'custom'],
      required: true,
    },
    days: {
      type: [itineraryDaySchema],
      default: [],
    },
    is_locked: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Itinerary', itinerarySchema);
