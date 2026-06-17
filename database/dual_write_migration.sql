USE trip_booking_sql;

ALTER TABLE users MODIFY COLUMN mongo_id VARCHAR(50);
ALTER TABLE destinations MODIFY COLUMN mongo_id VARCHAR(50);
ALTER TABLE trips MODIFY COLUMN mongo_id VARCHAR(50);
ALTER TABLE bookings MODIFY COLUMN mongo_id VARCHAR(50);
ALTER TABLE payments MODIFY COLUMN mongo_id VARCHAR(50);

ALTER TABLE destinations
  ADD COLUMN IF NOT EXISTS category VARCHAR(20) NOT NULL DEFAULT 'domestic' AFTER country,
  ADD COLUMN IF NOT EXISTS image_url VARCHAR(500) NULL AFTER category;

ALTER TABLE trips
  ADD COLUMN IF NOT EXISTS country VARCHAR(120) NOT NULL DEFAULT 'Indonesia' AFTER title,
  ADD COLUMN IF NOT EXISTS city VARCHAR(120) NULL AFTER country,
  ADD COLUMN IF NOT EXISTS category VARCHAR(20) NOT NULL DEFAULT 'domestic' AFTER city,
  ADD COLUMN IF NOT EXISTS image_url VARCHAR(500) NULL AFTER category;

UPDATE destinations
SET category = COALESCE(NULLIF(category, ''), 'domestic'),
    country = COALESCE(NULLIF(country, ''), 'Indonesia');

UPDATE trips
SET category = COALESCE(NULLIF(category, ''), 'domestic'),
    country = COALESCE(NULLIF(country, ''), 'Indonesia');

ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS bank_name VARCHAR(30) NULL AFTER proof_url,
  ADD COLUMN IF NOT EXISTS card_last4 CHAR(4) NULL AFTER bank_name;

CREATE TABLE IF NOT EXISTS wishlists (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  mongo_id VARCHAR(50) UNIQUE,
  user_id BIGINT UNSIGNED NOT NULL,
  trip_id BIGINT UNSIGNED,
  destination_id BIGINT UNSIGNED,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_wishlists_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_wishlists_trip
    FOREIGN KEY (trip_id) REFERENCES trips(id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_wishlists_destination
    FOREIGN KEY (destination_id) REFERENCES destinations(id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  UNIQUE KEY uq_wishlists_user_trip (user_id, trip_id),
  UNIQUE KEY uq_wishlists_user_destination (user_id, destination_id),
  INDEX idx_wishlists_user_created (user_id, created_at)
) ENGINE=InnoDB;

ALTER TABLE wishlists
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP;
