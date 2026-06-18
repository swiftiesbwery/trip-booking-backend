USE trip_booking_sql;

UPDATE destinations
SET image_url = CASE
  WHEN LOWER(city) = 'bali' THEN '/assets/destinations/bali.jpg'
  WHEN LOWER(city) = 'nusa penida' THEN '/assets/destinations/island-hopping.jpg'
  WHEN LOWER(city) = 'ubud' THEN '/assets/destinations/nature-discovery.jpg'
  WHEN LOWER(city) = 'jogja' THEN '/assets/destinations/java-culture.jpg'
  WHEN LOWER(city) = 'borobudur' THEN '/assets/destinations/borobudur.jpg'
  WHEN LOWER(city) = 'malioboro' THEN '/assets/destinations/java-culture.jpg'
  WHEN LOWER(city) = 'labuan bajo' THEN '/assets/destinations/komodo.jpg'
  WHEN LOWER(city) = 'pulau komodo' THEN '/assets/destinations/komodo.jpg'
  WHEN LOWER(city) = 'pink beach' THEN '/assets/destinations/island-hopping.jpg'
  WHEN LOWER(city) = 'lombok' THEN '/assets/destinations/lombok.jpg'
  WHEN LOWER(city) = 'paris' AND LOWER(country) = 'europe' THEN '/assets/destinations/indonesia-highlights.jpg'
  ELSE image_url
END,
updated_at = NOW()
WHERE category = 'domestic'
  AND LOWER(city) IN (
    'bali',
    'nusa penida',
    'ubud',
    'jogja',
    'borobudur',
    'malioboro',
    'labuan bajo',
    'pulau komodo',
    'pink beach',
    'lombok',
    'paris'
  );
