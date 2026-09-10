#!/bin/bash
# Creates one database per microservice inside the shared local Postgres
# instance. This gives us the database-per-service pattern (each service
# only ever connects to its own database/user) without running a separate
# Postgres container per service in local/dev Compose.
set -e

DATABASES=(
  identity_db
  restaurant_db
  media_db
  venue_db
  event_db
  offers_db
  order_db
  payment_db
  food_order_db
  rating_db
  notification_db
  reporting_db
  checkin_db
)

for db in "${DATABASES[@]}"; do
  echo "Creating database '$db' if it does not exist"
  psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" <<-EOSQL
    SELECT 'CREATE DATABASE $db' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '$db')\gexec
EOSQL
done
