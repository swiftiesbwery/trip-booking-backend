const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    trip_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Trip',
      default: null,
    },
    destination_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Destination',
      default: null,
    },
    booking_type: {
      type: String,
      enum: ['trip', 'destination'],
      required: [true, 'booking_type is required'],
    },
    qty: {
      type: Number,
      required: [true, 'qty is required'],
      min: [1, 'qty must be at least 1'],
    },
    visit_date: {
      type: Date,
      default: null,
    },
    payment_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Payment',
      default: null,
    },
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'completed', 'cancelled'],
      default: 'pending',
    },
    total_price: {
      type: Number,
      required: true,
      min: [0, 'total_price cannot be negative'],
    },
  },
  { timestamps: true }
);

bookingSchema.pre('validate', function (next) {
  const validTrip = this.booking_type === 'trip' && this.trip_id && !this.destination_id;
  const validDestination =
    this.booking_type === 'destination' && this.destination_id && !this.trip_id;
  if (!validTrip && !validDestination) {
    this.invalidate(
      'booking_type',
      'Booking must include an item that matches booking_type'
    );
  }
  next();
});

bookingSchema.index({ user_id: 1, createdAt: -1 });
bookingSchema.index({ status: 1 });
bookingSchema.index({ trip_id: 1 });
bookingSchema.index({ destination_id: 1 });
bookingSchema.index({ booking_type: 1 });

module.exports = mongoose.model('Booking', bookingSchema);
