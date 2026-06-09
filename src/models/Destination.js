const mongoose = require('mongoose');

const destinationSchema = new mongoose.Schema(
  {
    city: {
      type: String,
      required: true,
      trim: true,
    },
    province: {
      type: String,
      required: true,
      trim: true,
    },
    country: {
      type: String,
      default: 'Indonesia',
      trim: true,
    },
    image_url: String
  },
  { timestamps: true }
);

destinationSchema.index({ city: 1, province: 1, country: 1 });

module.exports =
  mongoose.model(
    'Destination',
    destinationSchema
  );
