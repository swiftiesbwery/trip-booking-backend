const express = require('express');
const router = express.Router();
const {
  createTrip,
  updateTrip,
  getAllTrips,
  getTripById,
  getTripReviews,
} = require('../controllers/tripController');
const { protect, restrictTo } = require('../middleware/authMiddleware');

router.post('/', protect, restrictTo('admin'), createTrip);
router.patch('/:id', protect, restrictTo('admin'), updateTrip);

// Public routes - tidak perlu login untuk explore
router.get('/', getAllTrips);
router.get('/:id/reviews', getTripReviews);
router.get('/:id', getTripById);

module.exports = router;
