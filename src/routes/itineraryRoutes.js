const express = require('express');
const router = express.Router();
const {
  getItineraryPlanner,
  saveCustomItinerary,
  saveRecommendedItinerary,
} = require('../controllers/itineraryController');
const { protect, restrictTo } = require('../middleware/authMiddleware');

router.use(protect, restrictTo('user'));

router.get('/bookings/:bookingId', getItineraryPlanner);
router.post('/bookings/:bookingId/recommended', saveRecommendedItinerary);
router.put('/bookings/:bookingId/custom', saveCustomItinerary);

module.exports = router;
