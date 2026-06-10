const express = require('express');
const router = express.Router();
const {
  createBooking,
  authorizePaymentBooking,
  uploadPayment,
  getMyBookings,
  getBookingById,
  cancelBooking,
  getMyPayments,
} = require('../controllers/bookingController');
const { protect, restrictTo } = require('../middleware/authMiddleware');
const upload = require('../middleware/uploadMiddleware');

// Semua route booking butuh login
router.use(protect, restrictTo('user'));

router.post('/', createBooking);
router.get('/my', getMyBookings);
router.get('/payments/my', getMyPayments);
router.get('/:id', getBookingById);
router.patch('/:id/cancel', cancelBooking);
router.post(
  '/:id/payment',
  authorizePaymentBooking,
  upload.single('proof'),
  uploadPayment
);

module.exports = router;
