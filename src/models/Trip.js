const mongoose = require('mongoose');

const itinerarySchema = new mongoose.Schema(
  {
    day: { type: Number, required: true },
    activity: { type: String, required: true },
    location: { type: String },
  },
  { _id: false }
);

const tripDestinationSchema = new mongoose.Schema(
  {
    destination_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Destination',
      required: [true, 'destination_id wajib diisi'],
    },
    visit_order: {
      type: Number,
      required: [true, 'visit_order wajib diisi'],
      min: [1, 'visit_order minimal 1'],
      validate: {
        validator: Number.isInteger,
        message: 'visit_order harus berupa angka bulat',
      },
    },
    notes: {
      type: String,
      trim: true,
    },
  },
  { _id: false }
);

const tripSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Judul trip wajib diisi'],
      trim: true,
    },
    description: {
      type: String,
      required: [true, 'Deskripsi trip wajib diisi'],
    },
    destinations: {
      type: [tripDestinationSchema],
      required: [true, 'Destinations wajib diisi'],
      validate: {
        validator: (destinations) =>
          Array.isArray(destinations) && destinations.length > 0,
        message: 'Destinations minimal berisi 1 destinasi',
      },
    },
    price: {
      type: Number,
      required: [true, 'Harga wajib diisi'],
      min: [0, 'Harga tidak boleh negatif'],
    },
    quota: {
      type: Number,
      required: [true, 'Kuota wajib diisi'],
      min: [1, 'Kuota minimal 1'],
    },
    duration_days: {
      type: Number,
      required: [true, 'Durasi wajib diisi'],
    },
    departure_date: {
      type: Date,
      required: [true, 'Tanggal keberangkatan wajib diisi'],
    },
    // EMBEDDED ARRAY: itinerary fleksibel & selalu dibaca bersama trip
    itinerary: [itinerarySchema],
    facilities: [String],
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
    },
    created_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { timestamps: true }
);

// Index untuk filter yang sering digunakan
tripSchema.index({ 'destinations.destination_id': 1 });
tripSchema.index({ price: 1 });
tripSchema.index({ departure_date: 1 });
tripSchema.index({ status: 1 });

module.exports = mongoose.model('Trip', tripSchema);
