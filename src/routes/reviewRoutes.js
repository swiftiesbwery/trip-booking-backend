const express = require('express');
const router = express.Router();
const { createReview, getMyReviews } = require('../controllers/reviewController');
const { protect, restrictTo } = require('../middleware/authMiddleware');
const { reviewPhotosUpload } = require('../middleware/uploadMiddleware');

router.use(protect, restrictTo('user'));

router.post(
  '/',
  reviewPhotosUpload.fields([
    { name: 'photos', maxCount: 5 },
    { name: 'photos[]', maxCount: 5 },
  ]),
  createReview
);
router.get('/my', getMyReviews);

module.exports = router;
