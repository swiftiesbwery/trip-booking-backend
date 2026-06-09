const express = require('express');
const router = express.Router();
const {
  createBooking,
  authorizePaymentBooking,
  uploadPayment,
  getMyBookings,
  getBookingById,
} = require('../controllers/bookingController');
const { protect } = require('../middleware/authMiddleware');
const upload = require('../middleware/uploadMiddleware');

// Semua route booking butuh login
router.use(protect);

router.post('/', createBooking);
router.get('/my', getMyBookings);
router.get('/:id', getBookingById);
router.post(
  '/:id/payment',
  authorizePaymentBooking,
  upload.single('proof'),
  uploadPayment
);

module.exports = router;
