const errorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Terjadi kesalahan pada server';

  // Mongoose: duplicate key (email sudah terdaftar)
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || 'Data';
    message = `${field} sudah terdaftar`;
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
    message = 'Token tidak valid';
    statusCode = 401;
  }

  if (err.name === 'CastError') {
    message = `${err.path || 'id'} tidak valid`;
    statusCode = 400;
  }

  if (err.type === 'entity.parse.failed') {
    message = 'Format JSON tidak valid';
    statusCode = 400;
  }

  if (err.code === 'LIMIT_FILE_SIZE') {
    message = 'Ukuran file maksimal 2MB';
    statusCode = 400;
  }

  res.status(statusCode).json({
    status: statusCode < 500 ? 'fail' : 'error',
    message,
  });
};

module.exports = errorHandler;
