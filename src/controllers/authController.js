const jwt = require('jsonwebtoken');
const User = require('../models/User');
const AppError = require('../utils/AppError');

// Helper: buat JWT token
const signToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
};

// Helper: kirim response dengan token
const sendTokenResponse = (user, statusCode, res) => {
  const token = signToken(user._id);
  // Hapus password dari output
  user.password = undefined;

  res.status(statusCode).json({
    status: 'success',
    token,
    data: { user },
  });
};

// POST /auth/register
const register = async (req, res, next) => {
  try {
    const { name, email, password, phone } = req.body;

    if (!name?.trim() || !email?.trim() || !password) {
      return next(new AppError('Nama, email, dan password wajib diisi', 400));
    }
    if (typeof password !== 'string' || password.length < 6) {
      return next(new AppError('Password minimal 6 karakter', 400));
    }
    if (phone !== undefined && typeof phone !== 'string') {
      return next(new AppError('Phone harus berupa string', 400));
    }

    const normalizedEmail = email.trim().toLowerCase();
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return next(new AppError('Email sudah terdaftar', 400));
    }

    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      password,
      phone,
    });
    sendTokenResponse(user, 201, res);
  } catch (err) {
    next(err);
  }
};

// POST /auth/login
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email?.trim() || !password) {
      return next(new AppError('Email dan password wajib diisi', 400));
    }

    // Gunakan .select('+password') karena field password di-hide by default
    const user = await User.findOne({ email: email.trim().toLowerCase() }).select(
      '+password'
    );
    if (!user || !(await user.comparePassword(password))) {
      return next(new AppError('Email atau password salah', 401));
    }

    sendTokenResponse(user, 200, res);
  } catch (err) {
    next(err);
  }
};

// GET /auth/me
const getMe = async (req, res, next) => {
  try {
    res.status(200).json({
      status: 'success',
      data: { user: req.user },
    });
  } catch (err) {
    next(err);
  }
};

module.exports = { register, login, getMe };
