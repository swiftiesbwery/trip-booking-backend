const Wishlist = require('../models/Wishlist');
const Trip = require('../models/Trip');
const Destination = require('../models/Destination');
const mongoose = require('mongoose');
const AppError = require('../utils/AppError');
const { assertObjectId } = require('../utils/validation');
const {
  deleteWishlist: deleteWishlistMirror,
  syncWishlist,
} = require('../services/sqlMirrorService');
const sqlRead = require('../services/sqlReadService');

const addWishlist = async (req, res, next) => {
  try {
    const { trip_id, destination_id } = req.body;
    if ((!trip_id && !destination_id) || (trip_id && destination_id)) {
      return next(new AppError('Choose either trip_id or destination_id', 400));
    }

    const field = trip_id ? 'trip_id' : 'destination_id';
    const value = trip_id || destination_id;
    const userId = String(req.user._id);
    let sqlItem = null;

    if (trip_id) {
      sqlItem = await sqlRead.getTripByMongoId(value, { activeOnly: false });
      if (!sqlItem && !(mongoose.isValidObjectId(value) && await Trip.exists({ _id: value }))) {
        return next(new AppError('Trip not found', 404));
      }
    }
    if (destination_id) {
      sqlItem = await sqlRead.getDestinationByMongoId(value);
      if (!sqlItem && !(mongoose.isValidObjectId(value) && await Destination.exists({ _id: value }))) {
        return next(new AppError('Destination not found', 404));
      }
    }

    if (sqlItem) {
      const wishlist = await sqlRead.createSqlWishlist({
        userId,
        tripId: trip_id,
        destinationId: destination_id,
      });
      return res.status(201).json({ status: 'success', data: { wishlist } });
    }

    const existing = await Wishlist.findOne({
      user_id: userId,
      [field]: value,
    });
    if (existing) {
      await syncWishlist(existing);
      return res.status(200).json({ status: 'success', data: { wishlist: existing } });
    }

    const wishlist = await Wishlist.create({
      user_id: userId,
      [field]: value,
    });
    await syncWishlist(wishlist);
    res.status(201).json({ status: 'success', data: { wishlist } });
  } catch (err) {
    if (err.code === 11000) {
      return next(new AppError('Item is already in the wishlist', 409));
    }
    next(err);
  }
};

const getMyWishlist = async (req, res, next) => {
  try {
    const wishlist = await sqlRead.listWishlist(String(req.user._id));
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
    if (!mongoose.isValidObjectId(req.params.id)) {
      const deleted = await sqlRead.deleteSqlWishlist({
        wishlistId: req.params.id,
        userId: String(req.user._id),
      });
      if (!deleted) return next(new AppError('Wishlist not found', 404));
      return res.status(204).send();
    }

    assertObjectId(req.params.id, 'wishlist_id');
    const wishlist = await Wishlist.findOne({
      _id: req.params.id,
      user_id: String(req.user._id),
    });
    if (!wishlist) return next(new AppError('Wishlist not found', 404));
    await deleteWishlistMirror(wishlist);
    await wishlist.deleteOne();
    res.status(204).send();
  } catch (err) {
    next(err);
  }
};

module.exports = { addWishlist, deleteWishlist, getMyWishlist };
