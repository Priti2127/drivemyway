-- Migration: 002_seed_cities.sql
-- Seeds initial supported cities with regional pricing

INSERT INTO cities (name, state, country, is_active, base_rate_hourly, base_rate_half_day, base_rate_full_day, surge_enabled, timezone)
VALUES
  ('Bengaluru',  'Karnataka',     'IN', TRUE,  150.00, 500.00,  900.00,  TRUE,  'Asia/Kolkata'),
  ('Mumbai',     'Maharashtra',   'IN', TRUE,  180.00, 600.00, 1000.00,  TRUE,  'Asia/Kolkata'),
  ('Delhi',      'Delhi',         'IN', FALSE, 160.00, 550.00,  950.00,  FALSE, 'Asia/Kolkata'),
  ('Pune',       'Maharashtra',   'IN', FALSE, 140.00, 480.00,  850.00,  FALSE, 'Asia/Kolkata'),
  ('Hyderabad',  'Telangana',     'IN', FALSE, 145.00, 490.00,  870.00,  FALSE, 'Asia/Kolkata'),
  ('Chennai',    'Tamil Nadu',    'IN', FALSE, 150.00, 500.00,  900.00,  FALSE, 'Asia/Kolkata'),
  ('Kolkata',    'West Bengal',   'IN', FALSE, 130.00, 450.00,  800.00,  FALSE, 'Asia/Kolkata'),
  ('Jaipur',     'Rajasthan',     'IN', FALSE, 120.00, 420.00,  750.00,  FALSE, 'Asia/Kolkata'),
  ('Ahmedabad',  'Gujarat',       'IN', FALSE, 130.00, 440.00,  780.00,  FALSE, 'Asia/Kolkata'),
  ('Kochi',      'Kerala',        'IN', FALSE, 140.00, 480.00,  850.00,  FALSE, 'Asia/Kolkata');
