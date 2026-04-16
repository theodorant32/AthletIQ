#!/bin/bash
# Local development setup script

set -e

echo "Setting up AthletIQ local development environment..."

# Start PostgreSQL
echo "Starting PostgreSQL container..."
docker-compose up -d

# Wait for database to be ready
echo "Waiting for database to be ready..."
sleep 5

# Install backend dependencies
echo "Installing backend dependencies..."
cd backend
npm install

# Install frontend dependencies
echo "Installing frontend dependencies..."
cd ../frontend
npm install

# Install ML dependencies
echo "Installing ML dependencies..."
cd ../ml-pipeline
pip install -r requirements.txt

# Run database migrations
echo "Running database migrations..."
cd ../backend
npm run db:migrate

echo ""
echo "Setup complete!"
echo ""
echo "To start development:"
echo "  Backend:  cd backend && npm run dev"
echo "  Frontend: cd frontend && npm run dev"
echo ""
echo "Backend:  http://localhost:4000"
echo "Frontend: http://localhost:3001"
