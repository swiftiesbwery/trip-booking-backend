const mongoose = require('mongoose');

const wishlistSchema = new mongoose.Schema(
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
  },
  { timestamps: { createdAt: 'created_at', updatedAt: false } }
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

wishlistSchema.index(
  { user_id: 1, trip_id: 1 },
  { unique: true, partialFilterExpression: { trip_id: { $type: 'objectId' } } }
);
wishlistSchema.index(
  { user_id: 1, destination_id: 1 },
  { unique: true, partialFilterExpression: { destination_id: { $type: 'objectId' } } }
);

module.exports = mongoose.model('Wishlist', wishlistSchema);
