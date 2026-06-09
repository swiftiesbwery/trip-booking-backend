require('dotenv').config();
const mongoose = require('mongoose');

const migrateTripDestinations = async () => {
  await mongoose.connect(process.env.MONGODB_URI);

  const trips = mongoose.connection.collection('trips');
  const result = await trips.updateMany(
    {
      destination_id: { $exists: true },
      $or: [
        { destinations: { $exists: false } },
        { destinations: { $size: 0 } },
      ],
    },
    [
      {
        $set: {
          destinations: [
            {
              destination_id: '$destination_id',
              visit_order: 1,
              notes: '',
            },
          ],
        },
      },
      { $unset: 'destination_id' },
    ]
  );

  console.log(`Trip dimigrasikan: ${result.modifiedCount}`);
  await mongoose.disconnect();
};

migrateTripDestinations().catch(async (err) => {
  console.error(`Migrasi gagal: ${err.message}`);
  await mongoose.disconnect();
  process.exit(1);
});
