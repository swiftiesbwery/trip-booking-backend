const errorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'An unexpected server error occurred';

  // Mongoose: duplicate key (email already registered)
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || 'Data';
    message = `${field} is already registered`;
    statusCode = 400;
  }

  // Mongoose: validation error
  if (err.name === 'ValidationError') {
    message = Object.values(err.errors)
      .map((e) => e.message)
      .join(', ');
    statusCode = 400;
  }

  // JWT error
  if (err.name === 'JsonWebTokenError') {
    message = 'Invalid token';
    statusCode = 401;
  }

  if (err.name === 'CastError') {
    message = `${err.path || 'id'} is invalid`;
    statusCode = 400;
  }

  if (err.type === 'entity.parse.failed') {
    message = 'Invalid JSON format';
    statusCode = 400;
  }

  if (err.code === 'LIMIT_FILE_SIZE') {
    message = req.originalUrl?.startsWith('/api/reviews')
      ? 'Maximum review photo size is 5MB'
      : 'Maximum file size is 2MB';
    statusCode = 400;
  }

  if (err.code === 'LIMIT_FILE_COUNT') {
    message = 'Maximum 5 review photos are allowed';
    statusCode = 400;
  }

  if (statusCode >= 500) {
    console.error('Request failed:', {
      method: req.method,
      path: req.originalUrl,
      code: err.code,
      message: err.message,
      stack: err.stack,
    });
  }

  res.status(statusCode).json({
    status: statusCode < 500 ? 'fail' : 'error',
    message,
  });
};

module.exports = errorHandler;
