#!/bin/bash

# Function to kill all background jobs on Ctrl+C
cleanup() {
    echo ""
    echo "🛑 Stopping backend and frontend servers..."
    kill 0 2>/dev/null
    lsof -ti:8000 | xargs kill -9 2>/dev/null
    lsof -ti:5173 | xargs kill -9 2>/dev/null
    echo "👋 Both servers stopped cleanly."
    exit 0
}

trap cleanup SIGINT SIGTERM EXIT

echo "=================================================="
echo "🚀 Starting NY Direction Predictor System..."
echo "=================================================="

# 0. Kill any existing processes on ports 8000 and 5173
lsof -ti:8000 | xargs kill -9 2>/dev/null
lsof -ti:5173 | xargs kill -9 2>/dev/null

sleep 1

# 1. Start Backend (FastAPI)
echo "📡 Starting FastAPI Backend on http://localhost:8000..."
uvicorn app:app --reload --port 8000 &
BACKEND_PID=$!

sleep 2

# 2. Start Frontend (React/Vite)
echo "💻 Starting React Frontend on http://localhost:5173..."
cd frontend || exit
npm run dev &
FRONTEND_PID=$!

echo ""
echo "✅ System is running!"
echo " -> Frontend URL: http://localhost:5173"
echo " -> Backend API:  http://localhost:8000"
echo "Press Ctrl+C to stop both servers."
echo ""

wait $BACKEND_PID $FRONTEND_PID

