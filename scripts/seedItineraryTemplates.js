require('dotenv').config();
const mongoose = require('mongoose');
const mysql = require('mysql2/promise');
const TripItineraryTemplate = require('../src/models/TripItineraryTemplate');

const normalize = (value) =>
  String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const publicTripId = (row) => row.mongo_id || `sql-trip-${row.id}`;

const day = (number, title, activities) => ({
  day: number,
  title,
  activities: activities.map((activity, index) => {
    if (Array.isArray(activity)) {
      return { time: activity[0] || '', activity: activity[1] || '' };
    }
    return {
      time: ['09:00', '13:00', '18:00'][index] || '',
      activity,
    };
  }),
});

const templates = [
  {
    titles: ['Wonderful Bali'],
    days: [
      day(1, 'Arrival', [['09:00', 'Arrival in Bali'], ['13:00', 'Hotel Check-in'], ['18:00', 'Jimbaran Seafood Dinner']]),
      day(2, 'Ubud', [['08:00', 'Tegallalang Rice Terrace'], ['11:00', 'Monkey Forest'], ['18:00', 'Ubud Market']]),
      day(3, 'Adventure', [['09:00', 'Tanjung Benoa Water Sports'], ['14:00', 'Pandawa Beach'], ['18:00', 'Sunset Dinner']]),
      day(4, 'Culture', [['10:00', 'Uluwatu Temple'], ['17:00', 'Kecak Dance Performance']]),
      day(5, 'Departure', [['09:00', 'Souvenir Shopping'], ['13:00', 'Airport Transfer']]),
    ],
  },
  {
    titles: ['Jogja Heritage'],
    days: [
      day(1, 'Arrival', ['Arrival', 'Malioboro Night Walk']),
      day(2, 'Temple Day', ['Borobudur Temple', 'Local Culinary Tour']),
      day(3, 'Culture', ['Prambanan Temple', 'Traditional Art Performance']),
      day(4, 'Departure', ['Shopping', 'Departure']),
    ],
  },
  {
    titles: ['Komodo Explorer'],
    days: [
      day(1, 'Arrival', ['Arrival in Labuan Bajo', 'Sunset at Bukit Sylvia']),
      day(2, 'Island Trek', ['Padar Island Trek', 'Pink Beach']),
      day(3, 'Wildlife and Sea', ['Komodo Island', 'Snorkeling at Manta Point']),
      day(4, 'Departure', ['Souvenir Shopping', 'Departure']),
    ],
  },
  {
    titles: ['Lombok Escape'],
    days: [
      day(1, 'Arrival', ['Arrival', 'Senggigi Beach Sunset']),
      day(2, 'Gili Tour', ['Gili Trawangan Tour', 'Snorkeling']),
      day(3, 'Local Culture', ['Traditional Sasak Village', 'Local Culinary Experience']),
      day(4, 'Departure', ['Shopping', 'Departure']),
    ],
  },
  {
    titles: ['Java Culture'],
    days: [
      day(1, 'Arrival', ['Arrival', 'City Tour']),
      day(2, 'Workshop', ['Museum Tour', 'Batik Workshop']),
      day(3, 'Culture', ['Traditional Market', 'Cultural Performance']),
      day(4, 'Departure', ['Shopping', 'Departure']),
    ],
  },
  {
    titles: ['Island Hopping'],
    days: [
      day(1, 'Arrival', ['Arrival', 'Beach Leisure']),
      day(2, 'Island Tour', ['Island Tour 1', 'Snorkeling']),
      day(3, 'Cruise', ['Island Tour 2', 'Sunset Cruise']),
      day(4, 'Water Day', ['Water Activities', 'Seafood Dinner']),
      day(5, 'Departure', ['Shopping', 'Departure']),
    ],
  },
  {
    titles: ['Nature Discovery'],
    days: [
      day(1, 'Arrival', ['Arrival', 'Forest Walk']),
      day(2, 'Waterfall', ['Waterfall Exploration', 'Camping']),
      day(3, 'National Park', ['National Park Tour', 'Photography Session']),
      day(4, 'Departure', ['Departure']),
    ],
  },
  {
    titles: ['Family Vacation'],
    days: [
      day(1, 'Arrival', ['Arrival', 'Hotel Check-in', 'Sunset Dinner']),
      day(2, 'Family Fun', ['Theme Park Visit', 'Family Activities']),
      day(3, 'Beach Day', ['Beach Day', 'Local Culinary Tour']),
      day(4, 'Leisure', ['Shopping', 'Leisure Time']),
      day(5, 'Departure', ['Departure']),
    ],
  },
  {
    titles: ['Romantic Honeymoon'],
    days: [
      day(1, 'Arrival', ['Arrival', 'Private Dinner']),
      day(2, 'Couple Day', ['Couple Spa', 'Sunset Cruise']),
      day(3, 'Beach Leisure', ['Beach Leisure', 'Fine Dining']),
      day(4, 'Memories', ['Photography Session', 'Shopping']),
      day(5, 'Departure', ['Departure']),
    ],
  },
  {
    titles: ['Indonesia Highlights'],
    days: [
      day(1, 'Arrival', ['Arrival', 'Welcome Dinner']),
      day(2, 'History', ['Historical Tour']),
      day(3, 'Nature', ['Nature Tour']),
      day(4, 'Culture', ['Cultural Experience']),
      day(5, 'Leisure', ['Shopping and Leisure']),
      day(6, 'Departure', ['Departure']),
    ],
  },
  {
    titles: ['Japan Cherry Blossom', 'Japan Sakura Journey'],
    days: [
      day(1, 'Tokyo Arrival', ['Arrival in Tokyo', 'Shibuya Crossing']),
      day(2, 'Tokyo Icons', ['Asakusa Temple', 'Tokyo Skytree']),
      day(3, 'Mt Fuji', ['Mt Fuji Day Trip', 'Lake Kawaguchi']),
      day(4, 'Kyoto', ['Kyoto Tour', 'Fushimi Inari Shrine']),
      day(5, 'Arashiyama', ['Arashiyama Bamboo Forest', 'Shopping']),
      day(6, 'Departure', ['Departure']),
    ],
  },
  {
    titles: ['Korea Spring Escape', 'Korea Autumn Escape'],
    days: [
      day(1, 'Seoul Arrival', ['Arrival in Seoul', 'Myeongdong Night Walk']),
      day(2, 'Heritage', ['Gyeongbokgung Palace', 'Bukchon Hanok Village']),
      day(3, 'Seoul View', ['N Seoul Tower', 'Han River Picnic']),
      day(4, 'Theme Park', ['Lotte World', 'Shopping']),
      day(5, 'Gangnam', ['Gangnam Tour', 'Korean BBQ Dinner']),
      day(6, 'Departure', ['Departure']),
    ],
  },
  {
    titles: ['Switzerland Alpine Journey', 'Switzerland Alpine Dream'],
    days: [
      day(1, 'Arrival', ['Arrival in Zurich']),
      day(2, 'Lucerne', ['Lucerne Tour']),
      day(3, 'Interlaken', ['Interlaken', 'Harder Kulm']),
      day(4, 'Jungfraujoch', ['Jungfraujoch Excursion']),
      day(5, 'Grindelwald', ['Grindelwald']),
      day(6, 'Leisure', ['Shopping', 'Leisure']),
      day(7, 'Departure', ['Departure']),
    ],
  },
  {
    titles: ['Europe Grand Tour'],
    days: [
      day(1, 'Paris', ['Paris']),
      day(2, 'Brussels', ['Brussels']),
      day(3, 'Amsterdam', ['Amsterdam']),
      day(4, 'Cologne', ['Cologne']),
      day(5, 'Lucerne', ['Lucerne']),
      day(6, 'Milan', ['Milan']),
      day(7, 'Venice', ['Venice']),
      day(8, 'Rome', ['Rome']),
    ],
  },
  {
    titles: ['Australia Coastal Adventure'],
    days: [
      day(1, 'Sydney', ['Sydney Opera House']),
      day(2, 'Beach', ['Bondi Beach']),
      day(3, 'Mountains', ['Blue Mountains']),
      day(4, 'Melbourne', ['Melbourne Laneways']),
      day(5, 'Great Ocean Road', ['Great Ocean Road']),
      day(6, 'Leisure', ['Shopping']),
      day(7, 'Departure', ['Departure']),
    ],
  },
];

const genericTemplate = (title) => [
  day(1, 'Arrival', [`Arrival for ${title}`, 'Hotel Check-in']),
  day(2, 'Discovery', ['City Tour', 'Local Culinary Experience']),
  day(3, 'Leisure', ['Shopping', 'Free Time']),
  day(4, 'Departure', ['Departure']),
];

const run = async () => {
  const sql = await mysql.createConnection({
    host: process.env.SQL_HOST || 'localhost',
    user: process.env.SQL_USER || 'root',
    password: process.env.SQL_PASSWORD || '',
    database: process.env.SQL_DATABASE || 'trip_booking_sql',
    port: Number(process.env.SQL_PORT) || 3306,
  });

  await mongoose.connect(process.env.MONGODB_URI);

  try {
    const [trips] = await sql.query('SELECT id, mongo_id, title FROM trips ORDER BY id ASC');
    const templateByTitle = new Map();
    templates.forEach((template) => {
      template.titles.forEach((title) => {
        templateByTitle.set(normalize(title), template.days);
      });
    });

    let seeded = 0;
    for (const trip of trips) {
      const tripTitle = trip.title;
      const days = templateByTitle.get(normalize(tripTitle)) || genericTemplate(tripTitle);
      await TripItineraryTemplate.updateOne(
        { trip_id: publicTripId(trip) },
        {
          $set: {
            trip_id: publicTripId(trip),
            trip_title: tripTitle,
            days,
          },
        },
        { upsert: true }
      );
      seeded += 1;
    }

    console.log(`Itinerary templates seeded: ${seeded}`);
  } finally {
    await sql.end();
    await mongoose.disconnect();
  }
};

run().catch((error) => {
  console.error(`Itinerary template seed failed: ${error.message}`);
  process.exit(1);
});
