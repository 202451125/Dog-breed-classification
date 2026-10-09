@echo off
echo ========================================================
echo   Dog Breed Classification - Starting Web Application
echo ========================================================

echo [1/2] Starting FastAPI Backend on http://localhost:8000 ...
start "Backend API" cmd /k "python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload"

echo [2/2] Starting React Frontend on http://localhost:5173 ...
cd frontend
start "Frontend UI" cmd /k "npm run dev"

echo.
echo Application started!
echo Frontend: http://localhost:5173
echo Backend API Docs: http://localhost:8000/docs
echo ========================================================
pause
