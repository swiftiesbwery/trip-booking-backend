const Destination = require('../models/Destination');
const Trip = require('../models/Trip');
const AppError = require('../utils/AppError');
const {
  assertObjectId,
  escapeRegex,
  parsePositiveInteger,
} = require('../utils/validation');

// GET /destinations - daftar destinasi dengan pencarian lokasi
const getAllDestinations = async (req, res, next) => {
  try {
    const { search, page = 1, limit = 20 } = req.query;
    const pageNumber = parsePositiveInteger(page, 'page', { defaultValue: 1 });
    const limitNumber = parsePositiveInteger(limit, 'limit', {
      defaultValue: 20,
      max: 100,
    });
    const filter = {};

    if (search) {
      const searchRegex = { $regex: escapeRegex(search), $options: 'i' };
      filter.$or = [
        { city: searchRegex },
        { province: searchRegex },
        { country: searchRegex },
      ];
    }

    const skip = (pageNumber - 1) * limitNumber;
    const [destinations, total] = await Promise.all([
      Destination.find(filter)
        .sort({ city: 1 })
        .skip(skip)
        .limit(limitNumber),
      Destination.countDocuments(filter),
    ]);

    res.status(200).json({
      status: 'success',
      results: destinations.length,
      total,
      totalPages: Math.ceil(total / limitNumber),
      currentPage: pageNumber,
      data: { destinations },
    });
  } catch (err) {
    next(err);
  }
};

// GET /destinations/:id - detail destinasi dan trip aktifnya
const getDestinationById = async (req, res, next) => {
  try {
    assertObjectId(req.params.id, 'destination_id');

    const destination = await Destination.findById(req.params.id);
    if (!destination) {
      return next(new AppError('Destinasi tidak ditemukan', 404));
    }

    const trips = await Trip.find({
      'destinations.destination_id': destination._id,
      status: 'active',
      departure_date: { $gte: new Date() },
    })
      .sort({ departure_date: 1 })
      .select('title price quota duration_days departure_date facilities');

    res.status(200).json({
      status: 'success',
      data: { destination, trips },
    });
  } catch (err) {
    next(err);
  }
};

module.exports = { getAllDestinations, getDestinationById };
