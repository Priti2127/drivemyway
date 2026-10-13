-- DriveMyWay Database Schema
-- Migration: 001_initial_schema.sql
-- Creates core tables: users, drivers, cities, bookings, trips, payments, ratings, emergency_contacts

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── Cities (must exist before other tables reference it) ─────────────────────
CREATE TABLE cities (
  id                SERIAL PRIMARY KEY,
  name              VARCHAR(100)   NOT NULL,
  state             VARCHAR(100),
  country           VARCHAR(50)    NOT NULL DEFAULT 'IN',
  is_active         BOOLEAN        NOT NULL DEFAULT FALSE,
  base_rate_hourly  DECIMAL(8,2)   NOT NULL DEFAULT 150.00,
  base_rate_half_day DECIMAL(8,2)  NOT NULL DEFAULT 500.00,
  base_rate_full_day DECIMAL(8,2)  NOT NULL DEFAULT 900.00,
  surge_enabled     BOOLEAN        NOT NULL DEFAULT FALSE,
  timezone          VARCHAR(50)    NOT NULL DEFAULT 'Asia/Kolkata',
  created_at        TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

-- ─── Users ────────────────────────────────────────────────────────────────────
CREATE TYPE user_role AS ENUM ('customer', 'driver', 'admin', 'corporate');

CREATE TABLE users (
  id              UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  phone           VARCHAR(15)    NOT NULL UNIQUE,
  name            VARCHAR(100),
  email           VARCHAR(150)   UNIQUE,
  profile_photo   TEXT,
  role            user_role      NOT NULL DEFAULT 'customer',
  is_active       BOOLEAN        NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_phone ON users(phone);
CREATE INDEX idx_users_role  ON users(role);

-- ─── Drivers ─────────────────────────────────────────────────────────────────
CREATE TYPE kyc_status AS ENUM ('pending', 'in_review', 'approved', 'rejected');

CREATE TABLE drivers (
  id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID         NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  kyc_status          kyc_status   NOT NULL DEFAULT 'pending',
  license_number      VARCHAR(50),
  license_verified    BOOLEAN      NOT NULL DEFAULT FALSE,
  aadhaar_verified    BOOLEAN      NOT NULL DEFAULT FALSE,
  background_checked  BOOLEAN      NOT NULL DEFAULT FALSE,
  rating              DECIMAL(3,2) NOT NULL DEFAULT 0.00,
  total_trips         INTEGER      NOT NULL DEFAULT 0,
  languages           TEXT[]       NOT NULL DEFAULT '{}',
  city_ids            INTEGER[]    NOT NULL DEFAULT '{}',
  is_online           BOOLEAN      NOT NULL DEFAULT FALSE,
  current_lat         DECIMAL(9,6),
  current_lng         DECIMAL(9,6),
  last_location_at    TIMESTAMPTZ,
  created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_drivers_kyc_status  ON drivers(kyc_status);
CREATE INDEX idx_drivers_is_online   ON drivers(is_online);
-- Geo index for nearby driver queries (requires PostGIS or we use lat/lng range)
CREATE INDEX idx_drivers_location    ON drivers(current_lat, current_lng)
  WHERE is_online = TRUE AND kyc_status = 'approved';

-- ─── Bookings ─────────────────────────────────────────────────────────────────
CREATE TYPE booking_type    AS ENUM ('instant', 'scheduled');
CREATE TYPE service_type    AS ENUM ('hourly', 'half_day', 'full_day', 'one_way');
CREATE TYPE booking_status  AS ENUM (
  'pending', 'searching', 'assigned', 'driver_en_route',
  'in_progress', 'completed', 'cancelled'
);

CREATE TABLE bookings (
  id                UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id       UUID           NOT NULL REFERENCES users(id),
  driver_id         UUID           REFERENCES drivers(id),
  booking_type      booking_type   NOT NULL,
  service_type      service_type   NOT NULL,
  pickup_lat        DECIMAL(9,6)   NOT NULL,
  pickup_lng        DECIMAL(9,6)   NOT NULL,
  pickup_address    TEXT           NOT NULL,
  drop_lat          DECIMAL(9,6),
  drop_lng          DECIMAL(9,6),
  drop_address      TEXT,
  scheduled_at      TIMESTAMPTZ,
  duration_hours    DECIMAL(4,1),
  status            booking_status NOT NULL DEFAULT 'pending',
  estimated_fare    DECIMAL(10,2),
  final_fare        DECIMAL(10,2),
  surge_multiplier  DECIMAL(3,2)   NOT NULL DEFAULT 1.00,
  city_id           INTEGER        NOT NULL REFERENCES cities(id),
  cancelled_by      UUID           REFERENCES users(id),
  cancel_reason     TEXT,
  created_at        TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_bookings_customer_id ON bookings(customer_id);
CREATE INDEX idx_bookings_driver_id   ON bookings(driver_id);
CREATE INDEX idx_bookings_status      ON bookings(status);
CREATE INDEX idx_bookings_city_id     ON bookings(city_id);
CREATE INDEX idx_bookings_created_at  ON bookings(created_at DESC);

-- ─── Trips ────────────────────────────────────────────────────────────────────
CREATE TABLE trips (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id      UUID         NOT NULL UNIQUE REFERENCES bookings(id),
  started_at      TIMESTAMPTZ,
  ended_at        TIMESTAMPTZ,
  distance_km     DECIMAL(8,2),
  route_path      JSONB,       -- [{lat, lng, speed, heading, timestamp}]
  audio_s3_key    TEXT,        -- encrypted, nullable
  sos_triggered   BOOLEAN      NOT NULL DEFAULT FALSE,
  sos_at          TIMESTAMPTZ,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_trips_booking_id ON trips(booking_id);

-- ─── Payments ────────────────────────────────────────────────────────────────
CREATE TYPE payment_method AS ENUM ('upi', 'card', 'wallet', 'cash', 'corporate');
CREATE TYPE payment_status AS ENUM ('pending', 'authorized', 'captured', 'failed', 'refunded');

CREATE TABLE payments (
  id                    UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id            UUID            NOT NULL REFERENCES bookings(id),
  user_id               UUID            NOT NULL REFERENCES users(id),
  amount                DECIMAL(10,2)   NOT NULL,
  currency              VARCHAR(3)      NOT NULL DEFAULT 'INR',
  method                payment_method  NOT NULL,
  status                payment_status  NOT NULL DEFAULT 'pending',
  razorpay_order_id     VARCHAR(100),
  razorpay_payment_id   VARCHAR(100),
  razorpay_signature    VARCHAR(200),
  created_at            TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_payments_booking_id ON payments(booking_id);
CREATE INDEX idx_payments_user_id    ON payments(user_id);
CREATE INDEX idx_payments_status     ON payments(status);

-- ─── Ratings ─────────────────────────────────────────────────────────────────
CREATE TABLE ratings (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id  UUID        NOT NULL UNIQUE REFERENCES bookings(id),
  rater_id    UUID        NOT NULL REFERENCES users(id),
  ratee_id    UUID        NOT NULL REFERENCES users(id),
  score       SMALLINT    NOT NULL CHECK (score BETWEEN 1 AND 5),
  tags        TEXT[]      NOT NULL DEFAULT '{}',
  comment     TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ratings_ratee_id ON ratings(ratee_id);

-- ─── Emergency Contacts ───────────────────────────────────────────────────────
CREATE TABLE emergency_contacts (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name        VARCHAR(100) NOT NULL,
  phone       VARCHAR(15)  NOT NULL,
  relation    VARCHAR(50),
  notify_on   TEXT[]       NOT NULL DEFAULT '{trip_start,trip_end,sos}',
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_emergency_contacts_user_id ON emergency_contacts(user_id);

-- ─── Wallets ──────────────────────────────────────────────────────────────────
CREATE TABLE wallets (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID         NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  balance     DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ─── Wallet Transactions ──────────────────────────────────────────────────────
CREATE TYPE wallet_txn_type AS ENUM ('credit', 'debit');

CREATE TABLE wallet_transactions (
  id          UUID             PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id   UUID             NOT NULL REFERENCES wallets(id),
  type        wallet_txn_type  NOT NULL,
  amount      DECIMAL(10,2)    NOT NULL,
  description TEXT,
  ref_id      UUID,            -- booking_id or payment_id
  created_at  TIMESTAMPTZ      NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_wallet_txn_wallet_id ON wallet_transactions(wallet_id);

-- ─── updated_at trigger function ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to all tables with updated_at
CREATE TRIGGER set_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_drivers_updated_at
  BEFORE UPDATE ON drivers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_bookings_updated_at
  BEFORE UPDATE ON bookings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_payments_updated_at
  BEFORE UPDATE ON payments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
