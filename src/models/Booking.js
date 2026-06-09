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
  required: true,
},

payment_id: {
  type: mongoose.Schema.Types.ObjectId,
  ref: 'Payment',
  default: null,
},

num_participants: {
  type: Number,
  required: [true, 'Jumlah peserta wajib diisi'],
  min: [1, 'Minimal 1 peserta'],
},

total_price: {
  type: Number,
  required: true,
},

status: {
  type: String,
  enum: [
    'pending',
    'waiting_payment',
    'confirmed',
    'cancelled',
  ],
  default: 'pending',
},

},
{ timestamps: true }
);

bookingSchema.index({
user_id: 1,
createdAt: -1,
});

bookingSchema.index({
status: 1,
});

bookingSchema.index({
trip_id: 1,
});

module.exports =
mongoose.model(
'Booking',
bookingSchema
);
