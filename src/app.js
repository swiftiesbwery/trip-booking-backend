require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const connectDB = require('./config/db');
const sqlPool = require('./config/sqlDb');
const sqlRead = require('./services/sqlReadService');
const errorHandler = require('./middleware/errorHandler');

// Import routes
const authRoutes = require('./routes/authRoutes');
const tripRoutes = require('./routes/tripRoutes');
const destinationRoutes = require('./routes/destinationRoutes');
const bookingRoutes = require('./routes/bookingRoutes');
const reviewRoutes = require('./routes/reviewRoutes');
const wishlistRoutes = require('./routes/wishlistRoutes');
const adminRoutes = require('./routes/adminRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const sqlRoutes = require('./routes/sqlRoutes');

const app = express();

// Pastikan folder uploads ada
const uploadDir = path.join(__dirname, '..', 'uploads', 'payments');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Middleware
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', 'http://localhost:5173');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files (bukti pembayaran yang diupload)
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/trips', tripRoutes);
app.use('/api/destinations', destinationRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/wishlists', wishlistRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/sql', sqlRoutes);

// Route tidak ditemukan
app.all('*', (req, res) => {
  res.status(404).json({
    status: 'fail',
    message: `Route ${req.originalUrl} tidak ditemukan`,
  });
});

// Global error handler
app.use(errorHandler);

const PORT = process.env.PORT || 3000;

const connectMySQL = async () => {
  const connection = await sqlPool.getConnection();
  try {
    await connection.query('SELECT 1');
    if (typeof sqlRead.ensureCatalogColumns === 'function') {
      await sqlRead.ensureCatalogColumns();
    }
    console.log('MySQL connected');
  } finally {
    connection.release();
  }
};

const startServer = async () => {
  await connectDB();
  await connectMySQL();
  app.listen(PORT, () => {
    console.log(`Server berjalan di http://localhost:${PORT}`);
  });
};

if (require.main === module) {
  startServer().catch((error) => {
    console.error(`Startup error: ${error.message}`);
    process.exit(1);
  });
}

module.exports = app;
