const mongoose = require('mongoose');

const wishlistSchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
    trip_id: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    destination_id: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

wishlistSchema.pre('validate', function (next) {
  if ((!this.trip_id && !this.destination_id) || (this.trip_id && this.destination_id)) {
    this.invalidate(
      'trip_id',
      'Wishlist harus berisi salah satu trip atau destination'
    );
  }
  next();
});

wishlistSchema.index({ user_id: 1, trip_id: 1 }, { unique: true, sparse: true });
wishlistSchema.index({ user_id: 1, destination_id: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model('Wishlist', wishlistSchema);
