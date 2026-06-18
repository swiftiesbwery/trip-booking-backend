const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const AppError = require('../utils/AppError');
const { safeMirror, syncUser } = require('../services/sqlMirrorService');
const sqlRead = require('../services/sqlReadService');

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
  user.password_hash = undefined;

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
      return next(new AppError('Name, email, and password are required', 400));
    }
    if (typeof password !== 'string' || password.length < 6) {
      return next(new AppError('Password must be at least 6 characters long', 400));
    }
    if (phone !== undefined && typeof phone !== 'string') {
      return next(new AppError('Phone must be a string', 400));
    }

    const normalizedEmail = email.trim().toLowerCase();
    const existingUser =
      (await sqlRead.getUserByEmail(normalizedEmail)) ||
      (await User.findOne({ email: normalizedEmail }));
    if (existingUser) {
      return next(new AppError('Email is already registered', 400));
    }

    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      password,
      phone,
    });
    await safeMirror(`user ${user._id}`, () => syncUser(user));
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
      return next(new AppError('Email and password are required', 400));
    }

    const user = await sqlRead.getUserByEmail(email.trim().toLowerCase());
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return next(new AppError('Incorrect email or password', 401));
    }

    sendTokenResponse(user, 200, res);
  } catch (err) {
    console.error('Login failed:', {
      email: req.body?.email,
      code: err.code,
      message: err.message,
    });
    next(err);
  }
};

// GET /auth/me
const getMe = async (req, res, next) => {
  try {
    const user = await sqlRead.getUserByMongoId(String(req.user._id));
    res.status(200).json({
      status: 'success',
      data: { user: user || req.user },
    });
  } catch (err) {
    next(err);
  }
};

module.exports = { register, login, getMe };
