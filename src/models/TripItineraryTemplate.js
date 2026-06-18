const mongoose = require('mongoose');

const templateActivitySchema = new mongoose.Schema(
  {
    time: {
      type: String,
      trim: true,
    },
    activity: {
      type: String,
      required: true,
      trim: true,
    },
  },
  { _id: false }
);

const templateDaySchema = new mongoose.Schema(
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
      type: [templateActivitySchema],
      default: [],
    },
  },
  { _id: false }
);

const tripItineraryTemplateSchema = new mongoose.Schema(
  {
    trip_id: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    trip_title: {
      type: String,
      required: true,
      trim: true,
    },
    days: {
      type: [templateDaySchema],
      default: [],
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model(
  'TripItineraryTemplate',
  tripItineraryTemplateSchema,
  'trip_itinerary_templates'
);
