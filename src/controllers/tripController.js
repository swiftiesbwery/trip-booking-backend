const Trip = require('../models/Trip');
const Destination = require('../models/Destination');
const Review = require('../models/Review');
const AppError = require('../utils/AppError');
const {
  assertObjectId,
  escapeRegex,
  parseNonNegativeNumber,
  parsePositiveInteger,
} = require('../utils/validation');

// GET /trips - explore semua trip aktif dengan filter, sort, pagination
const getAllTrips = async (req, res, next) => {
  try {
    const {
      search,
      destination,
      destination_id,
      city,
      minPrice,
      maxPrice,
      minDays,
      maxDays,
      sort = 'departure_date',
      page = 1,
      limit = 9,
    } = req.query;

    const pageNumber = parsePositiveInteger(page, 'page', { defaultValue: 1 });
    const limitNumber = parsePositiveInteger(limit, 'limit', {
      defaultValue: 9,
      max: 100,
    });
    const filter = {
      status: 'active',
      departure_date: { $gte: new Date() },
    };

    if (search) {
      filter.title = { $regex: escapeRegex(search), $options: 'i' };
    }

    if (destination_id) {
      assertObjectId(destination_id, 'destination_id');
      filter.destination_id = destination_id;
    } else if (destination || city) {
      const locationRegex = {
        $regex: escapeRegex(destination || city),
        $options: 'i',
      };
      const destinations = await Destination.find({
        $or: [
          { city: locationRegex },
          { province: locationRegex },
          { country: locationRegex },
        ],
      }).select('_id');
      filter.destination_id = { $in: destinations.map((item) => item._id) };
    }

    if (minPrice !== undefined || maxPrice !== undefined) {
      filter.price = {};
      if (minPrice !== undefined) {
        filter.price.$gte = parseNonNegativeNumber(minPrice, 'minPrice');
      }
      if (maxPrice !== undefined) {
        filter.price.$lte = parseNonNegativeNumber(maxPrice, 'maxPrice');
      }
      if (filter.price.$gte > filter.price.$lte) {
        return next(new AppError('minPrice tidak boleh lebih besar dari maxPrice', 400));
      }
    }

    if (minDays !== undefined || maxDays !== undefined) {
      filter.duration_days = {};
      if (minDays !== undefined) {
        filter.duration_days.$gte = parsePositiveInteger(minDays, 'minDays');
      }
      if (maxDays !== undefined) {
        filter.duration_days.$lte = parsePositiveInteger(maxDays, 'maxDays');
      }
      if (filter.duration_days.$gte > filter.duration_days.$lte) {
        return next(new AppError('minDays tidak boleh lebih besar dari maxDays', 400));
      }
    }

    const sortOptions = {
      departure_date: { departure_date: 1 },
      price_asc: { price: 1 },
      price_desc: { price: -1 },
      newest: { createdAt: -1 },
    };
    const sortQuery = sortOptions[sort];
    if (!sortQuery) {
      return next(new AppError('Pilihan sort tidak valid', 400));
    }

    const skip = (pageNumber - 1) * limitNumber;
    const [trips, total] = await Promise.all([
      Trip.find(filter)
        .populate('destination_id')
        .sort(sortQuery)
        .skip(skip)
        .limit(limitNumber)
        .select(
          'title description destination_id price quota duration_days departure_date facilities'
        ),
      Trip.countDocuments(filter),
    ]);

    res.status(200).json({
      status: 'success',
      results: trips.length,
      total,
      totalPages: Math.ceil(total / limitNumber),
      currentPage: pageNumber,
      data: { trips },
    });
  } catch (err) {
    next(err);
  }
};

// GET /trips/:id - detail trip lengkap dan ringkasan rating
const getTripById = async (req, res, next) => {
  try {
    assertObjectId(req.params.id, 'trip_id');

    const trip = await Trip.findOne({
      _id: req.params.id,
      status: 'active',
    })
      .populate('created_by', 'name')
      .populate('destination_id');

    if (!trip) {
      return next(new AppError('Trip tidak ditemukan', 404));
    }

    const ratingData = await Review.aggregate([
      { $match: { trip_id: trip._id } },
      {
        $group: {
          _id: '$trip_id',
          avgRating: { $avg: '$rating' },
          totalReviews: { $sum: 1 },
        },
      },
    ]);

    const rating = ratingData.length
      ? {
          avg: Math.round(ratingData[0].avgRating * 10) / 10,
          total: ratingData[0].totalReviews,
        }
      : { avg: 0, total: 0 };

    res.status(200).json({
      status: 'success',
      data: { trip, rating },
    });
  } catch (err) {
    next(err);
  }
};

// GET /trips/:id/reviews - semua review untuk satu trip
const getTripReviews = async (req, res, next) => {
  try {
    assertObjectId(req.params.id, 'trip_id');
    const tripExists = await Trip.exists({ _id: req.params.id, status: 'active' });
    if (!tripExists) {
      return next(new AppError('Trip tidak ditemukan', 404));
    }

    const reviews = await Review.find({ trip_id: req.params.id })
      .populate('user_id', 'name')
      .sort({ createdAt: -1 });

    res.status(200).json({
      status: 'success',
      results: reviews.length,
      data: { reviews },
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getAllTrips,
  getTripById,
  getTripReviews,
};
