const express = require('express');
const router = express.Router();
const { getAllTrips, getTripById, getTripReviews } = require('../controllers/tripController');

// Public routes — tidak perlu login untuk explore
router.get('/', getAllTrips);
router.get('/:id/reviews', getTripReviews);
router.get('/:id', getTripById);

module.exports = router;
