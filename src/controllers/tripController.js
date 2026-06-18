const Trip = require('../models/Trip');
const Destination = require('../models/Destination');
const Review = require('../models/Review');
const mongoose = require('mongoose');
const AppError = require('../utils/AppError');
const { safeMirror, syncTrip } = require('../services/sqlMirrorService');
const sqlRead = require('../services/sqlReadService');
const {
  assertObjectId,
  escapeRegex,
  parseNonNegativeNumber,
  parsePositiveInteger,
} = require('../utils/validation');

const populateDestinations = {
  path: 'destinations.destination_id',
};
const CATALOG_SORTS = ['name_asc', 'price_asc', 'price_desc'];
const CATALOG_CATEGORIES = ['all', 'domestic', 'international'];

const normalizeAndValidateDestinations = async (destinations) => {
  if (!Array.isArray(destinations) || destinations.length === 0) {
    throw new AppError('Destinations must include at least one destination', 400);
  }

  const normalized = destinations.map((item, index) => {
    if (!item || typeof item !== 'object') {
      throw new AppError(`destinations[${index}] is invalid`, 400);
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
    throw new AppError('The same destination cannot be added twice', 400);
  }

  const visitOrders = normalized.map((item) => item.visit_order);
  if (new Set(visitOrders).size !== visitOrders.length) {
    throw new AppError('visit_order cannot be duplicated', 400);
  }

  const existingDestinationCount = await Destination.countDocuments({
    _id: { $in: destinationIds },
  });
  if (existingDestinationCount !== destinationIds.length) {
    throw new AppError('One or more destination_id values were not found', 400);
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
    await safeMirror(`trip ${trip._id}`, () => syncTrip(trip));
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
      'country',
      'city',
      'category',
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
      return next(new AppError('Trip not found', 404));
    }

    Object.assign(trip, updates);
    await trip.save();
    await safeMirror(`trip ${trip._id}`, () => syncTrip(trip));
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
      category = 'all',
      minPrice,
      maxPrice,
      minDays,
      maxDays,
      startDate,
      endDate,
      sort = 'name_asc',
      page = 1,
      limit = 9,
    } = req.query;

    const pageNumber = parsePositiveInteger(page, 'page', { defaultValue: 1 });
    const limitNumber = parsePositiveInteger(limit, 'limit', {
      defaultValue: 9,
      max: 100,
    });
    if (!CATALOG_SORTS.includes(sort)) {
      return next(new AppError('Invalid sort option', 400));
    }
    if (!CATALOG_CATEGORIES.includes(category)) {
      return next(new AppError('Invalid category option', 400));
    }

    let parsedMinPrice;
    let parsedMaxPrice;
    if (minPrice !== undefined || maxPrice !== undefined) {
      if (minPrice !== undefined) {
        parsedMinPrice = parseNonNegativeNumber(minPrice, 'minPrice');
      }
      if (maxPrice !== undefined) {
        parsedMaxPrice = parseNonNegativeNumber(maxPrice, 'maxPrice');
      }
      if (parsedMinPrice > parsedMaxPrice) {
        return next(new AppError('minPrice cannot be greater than maxPrice', 400));
      }
    }

    let parsedStartDate;
    let parsedEndDate;
    if (startDate !== undefined || endDate !== undefined) {
      if (startDate !== undefined) {
        const parsed = new Date(startDate);
        if (Number.isNaN(parsed.getTime())) {
          return next(new AppError('startDate is invalid', 400));
        }
        parsedStartDate = startDate;
      }
      if (endDate !== undefined) {
        const parsed = new Date(endDate);
        if (Number.isNaN(parsed.getTime())) {
          return next(new AppError('endDate is invalid', 400));
        }
        parsedEndDate = endDate;
      }
    }

    const { trips, total } = await sqlRead.listTrips({
      search,
      destination,
      destination_id,
      city,
      category,
      minPrice: parsedMinPrice,
      maxPrice: parsedMaxPrice,
      startDate: parsedStartDate,
      endDate: parsedEndDate,
      sort,
      page: pageNumber,
      limit: limitNumber,
    });

    let filteredTrips = trips;
    if (minDays !== undefined || maxDays !== undefined) {
      const min = minDays !== undefined ? parsePositiveInteger(minDays, 'minDays') : null;
      const max = maxDays !== undefined ? parsePositiveInteger(maxDays, 'maxDays') : null;
      if (min !== null && max !== null && min > max) {
        return next(new AppError('minDays cannot be greater than maxDays', 400));
      }
      filteredTrips = trips.filter((trip) => {
        const duration =
          trip.duration_days ||
          Math.max(
            1,
            Math.round((new Date(trip.end_date) - new Date(trip.start_date)) / 86400000) + 1
          );
        return (min === null || duration >= min) && (max === null || duration <= max);
      });
    }

    res.status(200).json({
      status: 'success',
      results: filteredTrips.length,
      total,
      totalPages: Math.ceil(total / limitNumber),
      currentPage: pageNumber,
      data: { trips: filteredTrips },
    });
  } catch (err) {
    next(err);
  }
};

// GET /trips/:id - detail trip lengkap dan ringkasan rating
const getTripById = async (req, res, next) => {
  try {
    const trip = await sqlRead.getTripByMongoId(req.params.id);

    if (!trip) {
      return next(new AppError('Trip not found', 404));
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
    const trip = await sqlRead.getTripByMongoId(req.params.id);
    if (!trip) {
      return next(new AppError('Trip not found', 404));
    }

    const reviews = await Review.find({ trip_id: trip._id }).sort({ createdAt: -1 });

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
