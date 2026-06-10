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

const populateDestinations = {
  path: 'destinations.destination_id',
};

const normalizeAndValidateDestinations = async (destinations) => {
  if (!Array.isArray(destinations) || destinations.length === 0) {
    throw new AppError('Destinations minimal berisi 1 destinasi', 400);
  }

  const normalized = destinations.map((item, index) => {
    if (!item || typeof item !== 'object') {
      throw new AppError(`destinations[${index}] tidak valid`, 400);
    }

    assertObjectId(item.destination_id, `destinations[${index}].destination_id`);

    return {
      destination_id: item.destination_id,
      visit_order: parsePositiveInteger(
        item.visit_order,
        `destinations[${index}].visit_order`
      ),
      notes: typeof item.notes === 'string' ? item.notes.trim() : item.notes,
    };
  });

  const destinationIds = normalized.map((item) => String(item.destination_id));
  if (new Set(destinationIds).size !== destinationIds.length) {
    throw new AppError('Destination yang sama tidak boleh ditambahkan dua kali', 400);
  }

  const visitOrders = normalized.map((item) => item.visit_order);
  if (new Set(visitOrders).size !== visitOrders.length) {
    throw new AppError('visit_order tidak boleh duplikat', 400);
  }

  const existingDestinationCount = await Destination.countDocuments({
    _id: { $in: destinationIds },
  });
  if (existingDestinationCount !== destinationIds.length) {
    throw new AppError('Satu atau lebih destination_id tidak ditemukan', 400);
  }

  return normalized.sort((a, b) => a.visit_order - b.visit_order);
};

// POST /trips - membuat trip dengan banyak destinasi
const createTrip = async (req, res, next) => {
  try {
    const destinations = await normalizeAndValidateDestinations(
      req.body.destinations
    );

    const trip = await Trip.create({
      ...req.body,
      destinations,
      created_by: req.user._id,
    });
    await trip.populate(populateDestinations);

    res.status(201).json({
      status: 'success',
      data: { trip },
    });
  } catch (err) {
    next(err);
  }
};

// PATCH /trips/:id - memperbarui trip dan relasi destinasinya
const updateTrip = async (req, res, next) => {
  try {
    assertObjectId(req.params.id, 'trip_id');

    const allowedFields = [
      'title',
      'description',
      'destinations',
      'price',
      'quota',
      'duration_days',
      'departure_date',
      'itinerary',
      'facilities',
      'status',
    ];
    const updates = {};

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    }

    if (updates.destinations !== undefined) {
      updates.destinations = await normalizeAndValidateDestinations(
        updates.destinations
      );
    }

    const trip = await Trip.findById(req.params.id);
    if (!trip) {
      return next(new AppError('Trip tidak ditemukan', 404));
    }

    Object.assign(trip, updates);
    await trip.save();
    await trip.populate(populateDestinations);

    res.status(200).json({
      status: 'success',
      data: { trip },
    });
  } catch (err) {
    next(err);
  }
};

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
      startDate,
      endDate,
      sort = 'start_date',
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
    };

    if (search) {
      filter.title = { $regex: escapeRegex(search), $options: 'i' };
    }

    if (destination_id) {
      assertObjectId(destination_id, 'destination_id');
      filter['destinations.destination_id'] = destination_id;
    } else if (destination || city) {
      const locationRegex = {
        $regex: escapeRegex(destination || city),
        $options: 'i',
      };
      const matchingDestinations = await Destination.find({
        $or: [
          { city: locationRegex },
          { province: locationRegex },
          { country: locationRegex },
        ],
      }).select('_id');
      filter['destinations.destination_id'] = {
        $in: matchingDestinations.map((item) => item._id),
      };
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

    if (startDate !== undefined || endDate !== undefined) {
      filter.start_date = {};
      if (startDate !== undefined) {
        const parsed = new Date(startDate);
        if (Number.isNaN(parsed.getTime())) {
          return next(new AppError('startDate tidak valid', 400));
        }
        filter.start_date.$gte = parsed;
      }
      if (endDate !== undefined) {
        const parsed = new Date(endDate);
        if (Number.isNaN(parsed.getTime())) {
          return next(new AppError('endDate tidak valid', 400));
        }
        filter.start_date.$lte = parsed;
      }
    }

    const sortOptions = {
      departure_date: { departure_date: 1 },
      start_date: { start_date: 1 },
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
        .populate(populateDestinations)
        .sort(sortQuery)
        .skip(skip)
        .limit(limitNumber)
        .select(
          'title image_url description destinations price quota start_date end_date duration_days departure_date facilities'
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
      .populate(populateDestinations);

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
  createTrip,
  updateTrip,
  getAllTrips,
  getTripById,
  getTripReviews,
};
