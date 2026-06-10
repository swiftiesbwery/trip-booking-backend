const express = require('express');
const admin = require('../controllers/adminController');
const { protect, restrictTo } = require('../middleware/authMiddleware');

const router = express.Router();
router.use(protect, restrictTo('admin'));

router.route('/trips').get(admin.listTrips).post(admin.createTrip);
router.route('/trips/:id').get(admin.getTrip).patch(admin.updateTrip).delete(admin.deleteTrip);
router.route('/trips/:id/destinations').get(admin.listTripDestinations).post(admin.addTripDestination);
router.delete('/trips/:id/destinations/:destinationId', admin.removeTripDestination);

router.route('/destinations').get(admin.listDestinations).post(admin.createDestination);
router.route('/destinations/:id').get(admin.getDestination).patch(admin.updateDestination).delete(admin.deleteDestination);

router.get('/bookings', admin.listBookings);
router.get('/bookings/:id', admin.getBooking);
router.patch('/bookings/:id/status', admin.updateBookingStatus);

router.get('/payments', admin.listPayments);
router.get('/payments/:id', admin.getPayment);
router.patch('/payments/:id/status', admin.updatePaymentStatus);

router.get('/users', admin.listUsers);
router.get('/users/:id', admin.getUser);
router.patch('/users/:id/verification', admin.updateUserVerification);

module.exports = router;
