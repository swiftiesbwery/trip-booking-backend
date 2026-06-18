const multer = require('multer');
const path = require('path');
const fs = require('fs');
const AppError = require('../utils/AppError');

const paymentUploadDir = path.join(__dirname, '..', '..', 'uploads', 'payments');
const reviewUploadDir = path.join(__dirname, '..', '..', 'uploads', 'reviews');

[paymentUploadDir, reviewUploadDir].forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, paymentUploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const filename = `payment-${req.user._id}-${Date.now()}${ext}`;
    cb(null, filename);
  },
});

const fileFilter = (req, file, cb) => {
  const allowed = ['image/jpeg', 'image/png', 'image/jpg'];
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new AppError('Only JPG/PNG files are allowed', 400), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 2 * 1024 * 1024 }, // maks 2MB
});

const reviewStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, reviewUploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const index = (req.reviewPhotoIndex = (req.reviewPhotoIndex || 0) + 1);
    const filename = `review-${Date.now()}-${index}-${Math.round(Math.random() * 1e9)}${ext}`;
    cb(null, filename);
  },
});

const reviewFileFilter = (req, file, cb) => {
  const allowed = ['image/jpeg', 'image/png', 'image/webp'];
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new AppError('Only JPG, PNG, or WEBP review photos are allowed', 400), false);
  }
};

const reviewPhotosUpload = multer({
  storage: reviewStorage,
  fileFilter: reviewFileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 5,
  },
});

module.exports = upload;
module.exports.reviewPhotosUpload = reviewPhotosUpload;
