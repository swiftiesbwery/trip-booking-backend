require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../src/models/User');
const { syncUser } = require('../src/services/sqlMirrorService');

const ADMIN_EMAIL = 'admin@gmail.com';
const ADMIN_PASSWORD = 'admin123';

const seedAdmin = async () => {
  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI belum dikonfigurasi di file .env');
  }

  await mongoose.connect(process.env.MONGODB_URI);

  let admin = await User.findOne({ email: ADMIN_EMAIL }).select('+password');
  if (!admin) {
    admin = new User({
      name: 'Default Admin',
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
      role: 'admin',
      is_verified: true,
    });
  } else {
    admin.role = 'admin';
    admin.is_verified = true;

    if (!(await admin.comparePassword(ADMIN_PASSWORD))) {
      admin.password = ADMIN_PASSWORD;
    }
  }

  await admin.save();
  await syncUser(admin);
  console.log(`Admin siap digunakan: ${ADMIN_EMAIL}`);
};

seedAdmin()
  .catch((err) => {
    console.error(`Seed admin gagal: ${err.message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
