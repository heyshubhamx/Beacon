#!/bin/bash

# Start the backend server
echo "Starting backend server..."
npm run dev &
BACKEND_PID=$!

# Start the frontend server
echo "Starting frontend server..."
cd frontend && npm run dev &
FRONTEND_PID=$!

# Function to handle exit
function cleanup {
  echo "Stopping servers..."
  kill $BACKEND_PID
  kill $FRONTEND_PID
  exit 0
}

# Register the cleanup function for when script receives SIGINT
trap cleanup SIGINT

echo "Both servers are running. Press Ctrl+C to stop."
echo "Backend PID: $BACKEND_PID"
echo "Frontend PID: $FRONTEND_PID"

# Wait forever (until Ctrl+C)
wait 