#!/bin/sh
echo "Waiting for MongoDB to be ready..."
sleep 10

echo "Running seed script..."
node dist/scripts/seed_admin.js

echo "Starting NestJS application..."
node dist/main.js