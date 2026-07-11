# HoYoMusic Quick Start Script
# This script helps you quickly check if everything is ready

Write-Host "🎵 HoYoMusic MVP - Environment Check" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan
Write-Host ""

# Check Node.js
Write-Host "Checking Node.js..." -ForegroundColor Yellow
try {
    $nodeVersion = node --version
    Write-Host "✅ Node.js installed: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Node.js not found! Please install Node.js 18+" -ForegroundColor Red
    exit 1
}

# Check npm
Write-Host "Checking npm..." -ForegroundColor Yellow
try {
    $npmVersion = npm --version
    Write-Host "✅ npm installed: v$npmVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ npm not found!" -ForegroundColor Red
    exit 1
}

# Check PostgreSQL
Write-Host "Checking PostgreSQL..." -ForegroundColor Yellow
try {
    $pgVersion = psql --version
    Write-Host "✅ PostgreSQL installed: $pgVersion" -ForegroundColor Green
} catch {
    Write-Host "⚠️  PostgreSQL not found or not in PATH" -ForegroundColor Yellow
    Write-Host "   Please make sure PostgreSQL is installed and running" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "======================================" -ForegroundColor Cyan
Write-Host "Backend Dependencies Check" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan

if (Test-Path "backend/node_modules") {
    Write-Host "✅ Backend dependencies installed" -ForegroundColor Green
} else {
    Write-Host "⚠️  Backend dependencies not found" -ForegroundColor Yellow
    Write-Host "   Run: cd backend && npm install" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "======================================" -ForegroundColor Cyan
Write-Host "Frontend Dependencies Check" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan

if (Test-Path "frontend/node_modules") {
    Write-Host "✅ Frontend dependencies installed" -ForegroundColor Green
} else {
    Write-Host "⚠️  Frontend dependencies not found" -ForegroundColor Yellow
    Write-Host "   Run: cd frontend && npm install" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "======================================" -ForegroundColor Cyan
Write-Host "Configuration Check" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan

if (Test-Path "backend/.env") {
    Write-Host "✅ Backend .env file exists" -ForegroundColor Green
    Write-Host "   ⚠️  Please verify DB_PASSWORD is set correctly" -ForegroundColor Yellow
} else {
    Write-Host "❌ Backend .env file not found!" -ForegroundColor Red
    Write-Host "   Copy backend/.env.example to backend/.env" -ForegroundColor Yellow
}

if (Test-Path "frontend/.env") {
    Write-Host "✅ Frontend .env file exists" -ForegroundColor Green
} else {
    Write-Host "⚠️  Frontend .env file not found (optional)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "======================================" -ForegroundColor Cyan
Write-Host "Next Steps" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "1️⃣  Create database:" -ForegroundColor White
Write-Host "   psql -U postgres -c 'CREATE DATABASE hoyomusic;'" -ForegroundColor Gray
Write-Host ""
Write-Host "2️⃣  Initialize database:" -ForegroundColor White
Write-Host "   cd backend && npm run setup" -ForegroundColor Gray
Write-Host ""
Write-Host "3️⃣  Start backend (Terminal 1):" -ForegroundColor White
Write-Host "   cd backend && npm run dev" -ForegroundColor Gray
Write-Host ""
Write-Host "4️⃣  Start frontend (Terminal 2):" -ForegroundColor White
Write-Host "   cd frontend && npm run dev" -ForegroundColor Gray
Write-Host ""
Write-Host "5️⃣  Open browser:" -ForegroundColor White
Write-Host "   http://localhost:5173" -ForegroundColor Gray
Write-Host ""
Write-Host "📖 For detailed instructions, see SETUP_GUIDE.md" -ForegroundColor Cyan
Write-Host ""
Write-Host "Default credentials:" -ForegroundColor Yellow
Write-Host "   Username: admin" -ForegroundColor Gray
Write-Host "   Password: 'changeme'（默认），或通过 ADMIN_PASSWORD 环境变量设置" -ForegroundColor Gray
Write-Host ""

