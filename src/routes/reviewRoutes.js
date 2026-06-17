const express = require('express');
const router = express.Router();
const { createReview, getMyReviews } = require('../controllers/reviewController');
const { protect, restrictTo } = require('../middleware/authMiddleware');

router.use(protect, restrictTo('user'));

router.post('/', createReview);
router.get('/my', getMyReviews);

module.exports = router;
