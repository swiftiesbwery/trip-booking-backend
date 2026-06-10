const express = require('express');
const { getMyPayments } = require('../controllers/bookingController');
const { protect, restrictTo } = require('../middleware/authMiddleware');

const router = express.Router();
router.use(protect, restrictTo('user'));
router.get('/my', getMyPayments);

module.exports = router;
