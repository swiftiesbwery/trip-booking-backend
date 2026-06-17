CREATE DATABASE IF NOT EXISTS trip_booking_sql
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE trip_booking_sql;

CREATE TABLE IF NOT EXISTS users (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  mongo_id VARCHAR(50) UNIQUE,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(190) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  phone VARCHAR(30),
  role ENUM('user', 'admin') NOT NULL DEFAULT 'user',
  is_verified BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS destinations (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  mongo_id VARCHAR(50) UNIQUE,
  city VARCHAR(120) NOT NULL,
  province VARCHAR(120) NOT NULL,
  country VARCHAR(120) NOT NULL DEFAULT 'Indonesia',
  category VARCHAR(20) NOT NULL DEFAULT 'domestic',
  image_url VARCHAR(500),
  price DECIMAL(15, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_destinations_location (city, province, country),
  INDEX idx_destinations_category (category, country)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS trips (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  mongo_id VARCHAR(50) UNIQUE,
  title VARCHAR(190) NOT NULL,
  country VARCHAR(120) NOT NULL DEFAULT 'Indonesia',
  city VARCHAR(120),
  category VARCHAR(20) NOT NULL DEFAULT 'domestic',
  image_url VARCHAR(500),
  description TEXT,
  price DECIMAL(15, 2) NOT NULL,
  quota INT UNSIGNED NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
  created_by BIGINT UNSIGNED,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_trips_created_by
    FOREIGN KEY (created_by) REFERENCES users(id)
    ON UPDATE CASCADE ON DELETE SET NULL,
  INDEX idx_trips_dates (start_date, end_date),
  INDEX idx_trips_status (status),
  INDEX idx_trips_category (category, country)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS trip_destinations (
  trip_id BIGINT UNSIGNED NOT NULL,
  destination_id BIGINT UNSIGNED NOT NULL,
  visit_order INT UNSIGNED NOT NULL,
  notes VARCHAR(500),
  PRIMARY KEY (trip_id, destination_id),
  UNIQUE KEY uq_trip_visit_order (trip_id, visit_order),
  CONSTRAINT fk_trip_destinations_trip
    FOREIGN KEY (trip_id) REFERENCES trips(id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_trip_destinations_destination
    FOREIGN KEY (destination_id) REFERENCES destinations(id)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS bookings (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  mongo_id VARCHAR(50) UNIQUE,
  user_id BIGINT UNSIGNED NOT NULL,
  trip_id BIGINT UNSIGNED,
  destination_id BIGINT UNSIGNED,
  booking_type ENUM('trip', 'destination') NOT NULL,
  qty INT UNSIGNED NOT NULL,
  visit_date DATE,
  status ENUM('pending', 'confirmed', 'completed', 'cancelled') NOT NULL DEFAULT 'pending',
  total_price DECIMAL(15, 2) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_bookings_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_bookings_trip
    FOREIGN KEY (trip_id) REFERENCES trips(id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_bookings_destination
    FOREIGN KEY (destination_id) REFERENCES destinations(id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  INDEX idx_bookings_user_created (user_id, created_at),
  INDEX idx_bookings_status (status)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS payments (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  mongo_id VARCHAR(50) UNIQUE,
  booking_id BIGINT UNSIGNED NOT NULL UNIQUE,
  user_id BIGINT UNSIGNED NOT NULL,
  amount DECIMAL(15, 2) NOT NULL,
  method ENUM('QRIS', 'Transfer Bank', 'Debit/Kredit') NOT NULL,
  proof_url VARCHAR(500),
  bank_name VARCHAR(30),
  card_last4 CHAR(4),
  status ENUM('pending', 'checking', 'verified') NOT NULL DEFAULT 'checking',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_payments_booking
    FOREIGN KEY (booking_id) REFERENCES bookings(id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_payments_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

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

CREATE TABLE IF NOT EXISTS booking_history (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  booking_id BIGINT UNSIGNED NOT NULL,
  changed_by BIGINT UNSIGNED,
  previous_status ENUM('pending', 'confirmed', 'completed', 'cancelled'),
  new_status ENUM('pending', 'confirmed', 'completed', 'cancelled') NOT NULL,
  notes VARCHAR(500),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_booking_history_booking
    FOREIGN KEY (booking_id) REFERENCES bookings(id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_booking_history_changed_by
    FOREIGN KEY (changed_by) REFERENCES users(id)
    ON UPDATE CASCADE ON DELETE SET NULL,
  INDEX idx_booking_history_booking_created (booking_id, created_at)
) ENGINE=InnoDB;
