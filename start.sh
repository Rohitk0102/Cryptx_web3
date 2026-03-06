#!/bin/bash

# CryptX Web3 Portfolio Tracker - Startup Script
# This script starts frontend and backend services

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
API_DIR="$PROJECT_ROOT/apps/api"
WEB_DIR="$PROJECT_ROOT/apps/web"
LOG_DIR="$PROJECT_ROOT/logs"

# Port configuration
BACKEND_PORT=5001
FRONTEND_PORT=3000

# Create logs directory
mkdir -p "$LOG_DIR"

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_header() {
    echo -e "${PURPLE}================================${NC}"
    echo -e "${PURPLE}$1${NC}"
    echo -e "${PURPLE}================================${NC}"
}

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to check if port is in use
port_in_use() {
    lsof -ti:$1 >/dev/null 2>&1
}

# Function to kill process on port
kill_port() {
    if port_in_use $1; then
        print_warning "Port $1 is in use. Killing existing process..."
        lsof -ti:$1 | xargs kill -9 2>/dev/null || true
        sleep 2
    fi
}

# Function to check prerequisites
check_prerequisites() {
    print_header "CHECKING PREREQUISITES"
    
    # Check Node.js
    if command_exists node; then
        NODE_VERSION=$(node --version)
        print_success "Node.js found: $NODE_VERSION"
    else
        print_error "Node.js is not installed. Please install Node.js 18+"
        exit 1
    fi
    
    # Check npm
    if command_exists npm; then
        NPM_VERSION=$(npm --version)
        print_success "npm found: $NPM_VERSION"
    else
        print_error "npm is not installed"
        exit 1
    fi
    
    # Check for required environment files
    if [ ! -f "$API_DIR/.env" ]; then
        print_warning "Backend .env file not found. Creating from example..."
        if [ -f "$API_DIR/.env.example" ]; then
            cp "$API_DIR/.env.example" "$API_DIR/.env"
            print_success "Created backend .env file"
        else
            print_error "Backend .env.example not found!"
            exit 1
        fi
    fi
    
    if [ ! -f "$WEB_DIR/.env.local" ]; then
        print_warning "Frontend .env.local file not found. Creating from example..."
        if [ -f "$WEB_DIR/.env.example" ]; then
            cp "$WEB_DIR/.env.example" "$WEB_DIR/.env.local"
            print_success "Created frontend .env.local file"
        else
            print_error "Frontend .env.example not found!"
            exit 1
        fi
    fi
    
    print_success "All prerequisites checked!"
}

# Function to install dependencies
install_dependencies() {
    print_header "INSTALLING DEPENDENCIES"
    
    cd "$PROJECT_ROOT"
    
    if [ ! -d "node_modules" ]; then
        print_status "Installing root dependencies..."
        npm install
    else
        print_success "Root dependencies already installed"
    fi
    
    if [ ! -d "$API_DIR/node_modules" ]; then
        print_status "Installing backend dependencies..."
        cd "$API_DIR"
        npm install
    else
        print_success "Backend dependencies already installed"
    fi
    
    if [ ! -d "$WEB_DIR/node_modules" ]; then
        print_status "Installing frontend dependencies..."
        cd "$WEB_DIR"
        npm install
    else
        print_success "Frontend dependencies already installed"
    fi
    
    print_success "All dependencies ready!"
}

# Function to setup database
setup_database() {
    print_header "SETTING UP DATABASE"
    
    cd "$API_DIR"
    
    # Check if Prisma is installed
    if ! command_exists npx; then
        print_error "npx not found"
        return 1
    fi
    
    print_status "Generating Prisma client..."
    npx prisma generate
    
    print_status "Running database migrations..."
    npx prisma migrate deploy 2>/dev/null || npx prisma migrate dev --name init
    
    print_success "Database setup completed!"
}

# Function to start services (using npm workspaces)
start_services() {
    print_header "STARTING SERVICES"
    
    # Kill existing processes on required ports
    kill_port $BACKEND_PORT
    kill_port $FRONTEND_PORT
    
    cd "$PROJECT_ROOT"
    
    print_status "Starting both backend and frontend..."
    print_status "Backend will run on port $BACKEND_PORT"
    print_status "Frontend will run on port $FRONTEND_PORT"
    echo ""
    
    # Use npm workspaces to start both services with concurrently
    npm run dev
}

# Function to start backend only
start_backend() {
    print_header "STARTING BACKEND ONLY"
    
    kill_port $BACKEND_PORT
    
    print_status "Starting backend server..."
    cd "$PROJECT_ROOT"
    npm run dev:api > "$LOG_DIR/backend.log" 2>&1 &
    BACKEND_PID=$!
    echo "$BACKEND_PID" > "$LOG_DIR/backend.pid"
    
    print_success "Backend started (PID: $BACKEND_PID)"
    print_status "Backend running on http://localhost:$BACKEND_PORT"
    print_status "Logs: $LOG_DIR/backend.log"
}

# Function to start frontend only
start_frontend() {
    print_header "STARTING FRONTEND ONLY"
    
    kill_port $FRONTEND_PORT
    
    print_status "Starting frontend server..."
    cd "$PROJECT_ROOT"
    npm run dev:web > "$LOG_DIR/frontend.log" 2>&1 &
    FRONTEND_PID=$!
    echo "$FRONTEND_PID" > "$LOG_DIR/frontend.pid"
    
    print_success "Frontend started (PID: $FRONTEND_PID)"
    print_status "Frontend running on http://localhost:$FRONTEND_PORT"
    print_status "Logs: $LOG_DIR/frontend.log"
}

# Function to show service status
show_status() {
    print_header "SERVICE STATUS"
    
    # Check backend
    if port_in_use $BACKEND_PORT; then
        print_success "✅ Backend is running on port $BACKEND_PORT"
        if curl -s "http://localhost:$BACKEND_PORT/health" > /dev/null 2>&1; then
            print_success "✅ Backend health check passed"
        else
            print_warning "⚠️  Backend health check failed"
        fi
    else
        print_error "❌ Backend is not running"
    fi
    
    # Check frontend
    if port_in_use $FRONTEND_PORT; then
        print_success "✅ Frontend is running on port $FRONTEND_PORT"
    else
        print_error "❌ Frontend is not running"
    fi
    
    # Show URLs
    echo ""
    print_header "SERVICE URLS"
    echo -e "${CYAN}  🌐 Frontend:${NC}      http://localhost:$FRONTEND_PORT"
    echo -e "${CYAN}  🔌 Backend API:${NC}   http://localhost:$BACKEND_PORT/api"
    echo -e "${CYAN}  ❤️  Health Check:${NC}  http://localhost:$BACKEND_PORT/health"
    echo ""
}

# Function to stop services
stop_services() {
    print_header "STOPPING SERVICES"
    
    # Stop backend
    if [ -f "$LOG_DIR/backend.pid" ]; then
        BACKEND_PID=$(cat "$LOG_DIR/backend.pid")
        if kill -0 $BACKEND_PID 2>/dev/null; then
            print_status "Stopping backend (PID: $BACKEND_PID)..."
            kill $BACKEND_PID 2>/dev/null || true
        fi
        rm -f "$LOG_DIR/backend.pid"
    fi
    
    # Stop frontend
    if [ -f "$LOG_DIR/frontend.pid" ]; then
        FRONTEND_PID=$(cat "$LOG_DIR/frontend.pid")
        if kill -0 $FRONTEND_PID 2>/dev/null; then
            print_status "Stopping frontend (PID: $FRONTEND_PID)..."
            kill $FRONTEND_PID 2>/dev/null || true
        fi
        rm -f "$LOG_DIR/frontend.pid"
    fi
    
    # Kill any remaining processes on ports
    kill_port $BACKEND_PORT
    kill_port $FRONTEND_PORT
    
    print_success "All services stopped!"
}

# Function to show logs
show_logs() {
    local service=${1:-both}
    
    case $service in
        "backend")
            print_header "BACKEND LOGS"
            if [ -f "$LOG_DIR/backend.log" ]; then
                tail -f "$LOG_DIR/backend.log"
            else
                print_warning "No backend log file found"
            fi
            ;;
        "frontend")
            print_header "FRONTEND LOGS"
            if [ -f "$LOG_DIR/frontend.log" ]; then
                tail -f "$LOG_DIR/frontend.log"
            else
                print_warning "No frontend log file found"
            fi
            ;;
        "both")
            print_header "ALL LOGS"
            if [ -f "$LOG_DIR/backend.log" ] && [ -f "$LOG_DIR/frontend.log" ]; then
                tail -f "$LOG_DIR/backend.log" "$LOG_DIR/frontend.log"
            else
                print_warning "No log files found"
            fi
            ;;
        *)
            print_error "Unknown service: $service"
            print_status "Usage: $0 logs [backend|frontend|both]"
            ;;
    esac
}

# Function to show help
show_help() {
    cat << EOF
${PURPLE}================================${NC}
${PURPLE}CryptX Portfolio Tracker${NC}
${PURPLE}================================${NC}

${BLUE}Usage:${NC} $0 [COMMAND] [OPTIONS]

${BLUE}Commands:${NC}
  ${GREEN}start${NC}           Start both backend and frontend (default)
  ${GREEN}start-backend${NC}   Start backend only
  ${GREEN}start-frontend${NC}  Start frontend only
  ${GREEN}stop${NC}            Stop all services
  ${GREEN}restart${NC}         Restart all services
  ${GREEN}status${NC}          Show service status
  ${GREEN}logs${NC}            Show service logs
  ${GREEN}setup${NC}           Setup dependencies and database
  ${GREEN}check${NC}           Check prerequisites
  ${GREEN}help${NC}            Show this help message

${BLUE}Examples:${NC}
  $0                    # Start all services
  $0 start              # Start all services
  $0 start-backend      # Start backend only
  $0 stop               # Stop all services
  $0 status             # Check status
  $0 logs               # View all logs
  $0 logs backend       # View backend logs only

${BLUE}Ports:${NC}
  Backend:  http://localhost:$BACKEND_PORT
  Frontend: http://localhost:$FRONTEND_PORT

${BLUE}Components:${NC}
  • Backend API (Node.js + Express + Prisma)
  • Frontend (Next.js + React)
  • Database (PostgreSQL - Neon Cloud)
  • Redis (Optional, currently disabled)

EOF
}

# Main script logic
main() {
    # Change to project root
    cd "$PROJECT_ROOT"
    
    # Parse command line arguments
    COMMAND=${1:-start}
    
    case $COMMAND in
        "start")
            check_prerequisites
            install_dependencies
            setup_database
            echo ""
            start_services
            ;;
        "start-backend")
            check_prerequisites
            start_backend
            echo ""
            show_status
            ;;
        "start-frontend")
            check_prerequisites
            start_frontend
            echo ""
            show_status
            ;;
        "stop")
            stop_services
            ;;
        "restart")
            stop_services
            sleep 2
            check_prerequisites
            install_dependencies
            start_services
            ;;
        "status")
            show_status
            ;;
        "logs")
            show_logs ${2:-both}
            ;;
        "setup")
            check_prerequisites
            install_dependencies
            setup_database
            ;;
        "check")
            check_prerequisites
            ;;
        "help"|"-h"|"--help")
            show_help
            ;;
        *)
            print_error "Unknown command: $COMMAND"
            echo ""
            show_help
            exit 1
            ;;
    esac
}

# Run main function with all arguments
main "$@"
