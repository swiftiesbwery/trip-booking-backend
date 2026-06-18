USE trip_booking_sql;

INSERT INTO destinations
  (mongo_id, city, province, country, category, image_url, price, created_at, updated_at)
VALUES
  ('DEST-11', 'Tokyo', 'Tokyo', 'Japan', 'international', '/assets/destinations/tokyo.jpg', 2500000, NOW(), NOW()),
  ('DEST-12', 'Seoul', 'Seoul', 'South Korea', 'international', '/assets/destinations/seoul.jpg', 2300000, NOW(), NOW()),
  ('DEST-13', 'Interlaken', 'Bern', 'Switzerland', 'international', '/assets/destinations/interlaken.jpg', 5200000, NOW(), NOW()),
  ('DEST-14', 'Paris', 'Ile-de-France', 'France', 'international', '/assets/destinations/paris.jpg', 4500000, NOW(), NOW()),
  ('DEST-15', 'London', 'England', 'United Kingdom', 'international', '/assets/destinations/london.jpg', 4800000, NOW(), NOW()),
  ('DEST-16', 'Rome', 'Lazio', 'Italy', 'international', '/assets/destinations/rome.jpg', 4300000, NOW(), NOW()),
  ('DEST-17', 'Dubai', 'Dubai', 'United Arab Emirates', 'international', '/assets/destinations/dubai.jpg', 3900000, NOW(), NOW()),
  ('DEST-18', 'Singapore', 'Singapore', 'Singapore', 'international', '/assets/destinations/singapore.jpg', 2100000, NOW(), NOW()),
  ('DEST-19', 'Bangkok', 'Bangkok', 'Thailand', 'international', '/assets/destinations/bangkok.jpg', 1800000, NOW(), NOW()),
  ('DEST-20', 'Sydney', 'New South Wales', 'Australia', 'international', '/assets/destinations/sydney.jpg', 5000000, NOW(), NOW())
ON DUPLICATE KEY UPDATE
  city = VALUES(city),
  province = VALUES(province),
  country = VALUES(country),
  category = VALUES(category),
  image_url = VALUES(image_url),
  price = VALUES(price),
  updated_at = NOW();

INSERT INTO trips
  (mongo_id, title, country, city, category, image_url, description, price, quota, start_date, end_date, status, created_by, created_at, updated_at)
VALUES
  ('TRIP-11', 'Korea Autumn Escape', 'South Korea', 'Seoul', 'international', '/assets/trips/korea-autumn-escape.jpg', 'A curated Seoul escape through autumn streets, culture, food, shopping districts, and seasonal city highlights.', 5500000, 35, '2026-10-05', '2026-10-10', 'active', NULL, NOW(), NOW()),
  ('TRIP-12', 'Japan Sakura Journey', 'Japan', 'Tokyo', 'international', '/assets/trips/japan-sakura-journey.jpg', 'A spring journey through Tokyo landmarks, sakura viewing spots, local markets, and modern Japanese city life.', 6000000, 40, '2027-03-25', '2027-03-31', 'active', NULL, NOW(), NOW()),
  ('TRIP-13', 'Switzerland Alpine Dream', 'Switzerland', 'Interlaken', 'international', '/assets/trips/switzerland-alpine-dream.jpg', 'A scenic alpine journey through Interlaken, mountain viewpoints, peaceful lakes, and Swiss village landscapes.', 12000000, 20, '2027-05-10', '2027-05-17', 'active', NULL, NOW(), NOW()),
  ('TRIP-14', 'Europe Grand Tour', 'Europe', 'Paris', 'international', '/assets/trips/europe-grand-tour.jpg', 'A grand European itinerary featuring Paris, London, Rome, iconic architecture, museums, and classic city experiences.', 15000000, 25, '2027-06-03', '2027-06-14', 'active', NULL, NOW(), NOW()),
  ('TRIP-15', 'Singapore City Lights', 'Singapore', 'Singapore', 'international', '/assets/trips/singapore-city-lights.jpg', 'A compact city escape through Singapore skyline views, urban gardens, shopping streets, and night attractions.', 4000000, 50, '2026-09-12', '2026-09-15', 'active', NULL, NOW(), NOW()),
  ('TRIP-16', 'Thailand Tropical Escape', 'Thailand', 'Bangkok', 'international', '/assets/trips/thailand-tropical-escape.jpg', 'A tropical Thailand trip combining Bangkok culture, floating markets, temples, local cuisine, and resort-style leisure.', 3800000, 45, '2026-11-08', '2026-11-13', 'active', NULL, NOW(), NOW()),
  ('TRIP-17', 'Dubai Luxury Journey', 'United Arab Emirates', 'Dubai', 'international', '/assets/trips/dubai-luxury-journey.jpg', 'A luxury Dubai journey with skyline icons, desert experiences, premium shopping, marina views, and modern city highlights.', 9000000, 30, '2027-01-18', '2027-01-23', 'active', NULL, NOW(), NOW()),
  ('TRIP-18', 'Turkey Cultural Escape', 'Turkey', 'Istanbul', 'international', '/assets/trips/turkey-cultural-escape.jpg', 'A cultural Istanbul escape through historic mosques, bazaars, Bosphorus views, Turkish cuisine, and heritage districts.', 7000000, 30, '2027-04-07', '2027-04-13', 'active', NULL, NOW(), NOW()),
  ('TRIP-19', 'Australia Coastal Adventure', 'Australia', 'Sydney', 'international', '/assets/trips/australia-coastal-adventure.jpg', 'A coastal Sydney adventure with harbor landmarks, beaches, city walks, scenic viewpoints, and relaxed Australian experiences.', 8500000, 35, '2027-02-12', '2027-02-19', 'active', NULL, NOW(), NOW()),
  ('TRIP-20', 'New Zealand Nature Explorer', 'New Zealand', 'Queenstown', 'international', '/assets/trips/new-zealand-nature-explorer.jpg', 'A nature-focused Queenstown explorer trip with lakes, mountain scenery, adventure activities, and peaceful landscapes.', 11000000, 20, '2027-03-09', '2027-03-16', 'active', NULL, NOW(), NOW())
ON DUPLICATE KEY UPDATE
  title = VALUES(title),
  country = VALUES(country),
  city = VALUES(city),
  category = VALUES(category),
  image_url = VALUES(image_url),
  description = VALUES(description),
  price = VALUES(price),
  quota = VALUES(quota),
  start_date = VALUES(start_date),
  end_date = VALUES(end_date),
  status = VALUES(status),
  updated_at = NOW();

DELETE td
FROM trip_destinations td
JOIN trips t ON t.id = td.trip_id
WHERE t.mongo_id IN ('TRIP-11', 'TRIP-12', 'TRIP-13', 'TRIP-14', 'TRIP-15', 'TRIP-16', 'TRIP-17', 'TRIP-18', 'TRIP-19', 'TRIP-20');

INSERT INTO trip_destinations (trip_id, destination_id, visit_order, notes)
SELECT t.id, d.id, 1, 'Primary international destination'
FROM trips t
JOIN destinations d ON
  (t.mongo_id = 'TRIP-11' AND d.mongo_id = 'DEST-12') OR
  (t.mongo_id = 'TRIP-12' AND d.mongo_id = 'DEST-11') OR
  (t.mongo_id = 'TRIP-13' AND d.mongo_id = 'DEST-13') OR
  (t.mongo_id = 'TRIP-15' AND d.mongo_id = 'DEST-18') OR
  (t.mongo_id = 'TRIP-16' AND d.mongo_id = 'DEST-19') OR
  (t.mongo_id = 'TRIP-17' AND d.mongo_id = 'DEST-17') OR
  (t.mongo_id = 'TRIP-19' AND d.mongo_id = 'DEST-20');

INSERT INTO trip_destinations (trip_id, destination_id, visit_order, notes)
SELECT t.id, d.id, mapping.visit_order, mapping.notes
FROM trips t
JOIN (
  SELECT 'TRIP-14' AS trip_mongo_id, 'DEST-14' AS destination_mongo_id, 1 AS visit_order, 'Paris city experience' AS notes
  UNION ALL SELECT 'TRIP-14', 'DEST-15', 2, 'London city experience'
  UNION ALL SELECT 'TRIP-14', 'DEST-16', 3, 'Rome city experience'
  UNION ALL SELECT 'TRIP-18', 'DEST-16', 1, 'Regional cultural gateway'
  UNION ALL SELECT 'TRIP-20', 'DEST-20', 1, 'Oceania arrival gateway'
) mapping ON mapping.trip_mongo_id = t.mongo_id
JOIN destinations d ON d.mongo_id = mapping.destination_mongo_id;
