const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema(
  {
    booking_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booking',
      required: true,
      unique: true,
    },

    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    amount: {
      type: Number,
      required: true,
      min: [1, 'Jumlah pembayaran harus lebih dari 0'],
    },

    method: {
      type: String,
      enum: ['QRIS', 'Transfer Bank', 'Debit/Kredit'],
      required: [true, 'Metode pembayaran wajib diisi'],
    },

    proof_url: {
      type: String,
    },

    bank_name: {
      type: String,
      enum: ['BCA', 'Mandiri', 'BRI', 'BNI', null],
      default: null,
    },

    card_last4: {
      type: String,
      match: [/^\d{4}$/, 'card_last4 harus 4 digit'],
      default: null,
    },

    status: {
      type: String,
      enum: ['pending', 'checking', 'verified'],
      default: 'checking',
    },
  },
  { timestamps: true }
);

paymentSchema.index({ user_id: 1, createdAt: -1 });

module.exports = mongoose.model(
  'Payment',
  paymentSchema
);
