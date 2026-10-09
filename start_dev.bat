@echo off
echo ========================================================
echo   CanineVision AI - Starting Full-Stack Application
echo ========================================================

echo [1/2] Launching FastAPI Backend on http://localhost:8000 ...
start "CanineVision Backend" cmd /k "python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload"

echo [2/2] Launching React + Vite Frontend on http://localhost:5173 ...
cd frontend
start "CanineVision Frontend" cmd /k "npm run dev"

echo.
echo Application started successfully!
echo Frontend: http://localhost:5173
echo Backend API Docs: http://localhost:8000/docs
echo ========================================================
pause
