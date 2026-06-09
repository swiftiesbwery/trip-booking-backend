const express = require('express');
const router = express.Router();
const { createReview, getMyReviews } = require('../controllers/reviewController');
const { protect } = require('../middleware/authMiddleware');

router.use(protect);

router.post('/', createReview);
router.get('/my', getMyReviews);

module.exports = router;
