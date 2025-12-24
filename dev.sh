#!/bin/bash

# Commander Deck Builder - Development Startup Script

echo "🎴 Commander Deck Builder - Starting Development Environment"
echo ""

# Check if we're in the right directory
if [ ! -d "frontend" ]; then
    echo "❌ Error: Please run this script from the project root directory"
    exit 1
fi

# Function to check if a port is in use
check_port() {
    if lsof -Pi :$1 -sTCP:LISTEN -t >/dev/null 2>&1 ; then
        echo "⚠️  Warning: Port $1 is already in use"
        return 1
    fi
    return 0
}

# Check ports
echo "Checking ports..."
check_port 3000
echo ""

# Start frontend (contains backend API)

# Start frontend
echo "🎨 Starting Frontend (port 3000)..."
cd frontend
if [ ! -d "node_modules" ]; then
    echo "📦 Installing frontend dependencies..."
    npm install
fi

npm run dev > ../frontend.log 2>&1 &
FRONTEND_PID=$!
echo "✅ Frontend started (PID: $FRONTEND_PID)"
cd ..

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✨ Commander Deck Builder is running!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "🌐 URL: http://localhost:3000"
echo ""
echo "📋 Logs:"
echo "   tail -f frontend.log"
echo ""
echo "🛑 To stop: kill $FRONTEND_PID"
echo "   Or run:  pkill -P $$"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Save PIDs to file for easy cleanup
echo "$FRONTEND_PID" > .dev-pids

# Recursive kill function to ensure all child processes (like ts-node) are killed
kill_tree() {
    local pid=$1
    if [ -z "$pid" ]; then return; fi
    
    # Find children (works with pgrep or ps)
    local children=$(pgrep -P "$pid" 2>/dev/null)
    if [ -z "$children" ]; then
        children=$(ps -o pid= --ppid "$pid" 2>/dev/null)
    fi

    for child in $children; do
        kill_tree "$child"
    done
    
    kill "$pid" 2>/dev/null
}

cleanup() {
    # Avoid running multiple times
    trap - INT TERM EXIT
    
    echo ""
    echo "🛑 Stopping services..."
    
    
    if [ -n "$FRONTEND_PID" ]; then
        echo "   Killing Frontend tree ($FRONTEND_PID)..."
        kill_tree "$FRONTEND_PID"
    fi
    
    rm -f .dev-pids
    echo "👋 Servers stopped"
    exit 0
}

# Wait for user interrupt
echo ""
echo "Press Ctrl+C to stop all servers..."
trap cleanup INT TERM EXIT

wait
