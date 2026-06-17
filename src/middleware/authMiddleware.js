const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const User = require('../models/User');
const AppError = require('../utils/AppError');
const sqlRead = require('../services/sqlReadService');

// Middleware: wajib login
const protect = async (req, res, next) => {
  try {
    // Ambil token dari header Authorization
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next(new AppError('Silakan login terlebih dahulu', 401));
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      return next(new AppError('Token tidak ditemukan', 401));
    }

    // Verifikasi token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Cek user masih ada. Token lama memakai ObjectId Mongo, data SQL-only
    // memakai public id dari kolom users.mongo_id.
    const user = mongoose.isValidObjectId(decoded.id)
      ? await User.findById(decoded.id)
      : await sqlRead.getUserByMongoId(decoded.id);
    if (!user) {
      return next(new AppError('User tidak ditemukan', 401));
    }

    req.user = (await sqlRead.getUserByMongoId(String(user._id))) || user;
    next();
  } catch (err) {
    if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
      return next(new AppError('Token tidak valid atau sudah expired', 401));
    }
    return next(err);
  }
};

// Middleware: restrict ke role tertentu
const restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return next(new AppError('Kamu tidak memiliki akses ke fitur ini', 403));
    }
    next();
  };
};

module.exports = { protect, restrictTo };
