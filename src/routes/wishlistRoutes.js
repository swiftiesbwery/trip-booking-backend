const express = require('express');
const {
  addWishlist,
  deleteWishlist,
  getMyWishlist,
} = require('../controllers/wishlistController');
const { protect, restrictTo } = require('../middleware/authMiddleware');

const router = express.Router();
router.use(protect, restrictTo('user'));
router.route('/').get(getMyWishlist).post(addWishlist);
router.delete('/:id', deleteWishlist);

module.exports = router;
