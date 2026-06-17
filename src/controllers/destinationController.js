const Destination = require('../models/Destination');
const AppError = require('../utils/AppError');
const sqlRead = require('../services/sqlReadService');
const {
  assertObjectId,
  escapeRegex,
  parsePositiveInteger,
} = require('../utils/validation');
const CATALOG_SORTS = ['name_asc', 'price_asc', 'price_desc'];
const CATALOG_CATEGORIES = ['all', 'domestic', 'international'];

// GET /destinations - daftar destinasi dengan pencarian lokasi
const getAllDestinations = async (req, res, next) => {
  try {
    const { search, sort = 'name_asc', page = 1, limit = 20, category = 'all' } = req.query;
    const pageNumber = parsePositiveInteger(page, 'page', { defaultValue: 1 });
    const limitNumber = parsePositiveInteger(limit, 'limit', {
      defaultValue: 20,
      max: 100,
    });
    if (!CATALOG_SORTS.includes(sort)) {
      return next(new AppError('Pilihan sort tidak valid', 400));
    }
    if (!CATALOG_CATEGORIES.includes(category)) {
      return next(new AppError('Pilihan category tidak valid', 400));
    }
    const { destinations, total } = await sqlRead.listDestinations({
      search,
      sort,
      page: pageNumber,
      limit: limitNumber,
      category,
    });

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
    const destination = await sqlRead.getDestinationByMongoId(req.params.id);
    if (!destination) {
      return next(new AppError('Destinasi tidak ditemukan', 404));
    }

    const trips = await sqlRead.listTripsForDestination(req.params.id);

    res.status(200).json({
      status: 'success',
      data: { destination, trips },
    });
  } catch (err) {
    next(err);
  }
};

module.exports = { getAllDestinations, getDestinationById };
