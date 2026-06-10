const Wishlist = require('../models/Wishlist');
const Trip = require('../models/Trip');
const Destination = require('../models/Destination');
const AppError = require('../utils/AppError');
const { assertObjectId } = require('../utils/validation');

const addWishlist = async (req, res, next) => {
  try {
    const { trip_id, destination_id } = req.body;
    if ((!trip_id && !destination_id) || (trip_id && destination_id)) {
      return next(new AppError('Pilih salah satu trip_id atau destination_id', 400));
    }

    const field = trip_id ? 'trip_id' : 'destination_id';
    const value = trip_id || destination_id;
    assertObjectId(value, field);
    const Model = trip_id ? Trip : Destination;
    if (!(await Model.exists({ _id: value }))) {
      return next(new AppError(`${trip_id ? 'Trip' : 'Destination'} tidak ditemukan`, 404));
    }

    const wishlist = await Wishlist.create({
      user_id: req.user._id,
      [field]: value,
    });
    await wishlist.populate(['trip_id', 'destination_id']);
    res.status(201).json({ status: 'success', data: { wishlist } });
  } catch (err) {
    next(err);
  }
};

const getMyWishlist = async (req, res, next) => {
  try {
    const wishlist = await Wishlist.find({ user_id: req.user._id })
      .populate('trip_id')
      .populate('destination_id')
      .sort({ created_at: -1 });
    res.status(200).json({
      status: 'success',
      results: wishlist.length,
      data: { wishlist },
    });
  } catch (err) {
    next(err);
  }
};

const deleteWishlist = async (req, res, next) => {
  try {
    assertObjectId(req.params.id, 'wishlist_id');
    const wishlist = await Wishlist.findOneAndDelete({
      _id: req.params.id,
      user_id: req.user._id,
    });
    if (!wishlist) return next(new AppError('Wishlist tidak ditemukan', 404));
    res.status(204).send();
  } catch (err) {
    next(err);
  }
};

module.exports = { addWishlist, deleteWishlist, getMyWishlist };
