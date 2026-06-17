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
    category: {
      type: String,
      enum: ['domestic', 'international'],
      default: 'domestic',
    },
    image_url: String,
    price: {
      type: Number,
      required: [true, 'Harga destinasi wajib diisi'],
      min: [0, 'Harga destinasi tidak boleh negatif'],
    },
  },
  { timestamps: true }
);

destinationSchema.index({ city: 1, province: 1, country: 1 });
destinationSchema.index({ category: 1, country: 1 });

module.exports =
  mongoose.model(
    'Destination',
    destinationSchema
  );
