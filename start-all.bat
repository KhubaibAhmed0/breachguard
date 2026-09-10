@echo off
echo Starting BreachGuard Backend and Frontend...
start "BreachGuard Backend" cmd /k "cd backend && .\venv\Scripts\uvicorn.exe main:app --host 127.0.0.1 --port 8000"
start "BreachGuard Frontend" cmd /k "cd frontend && npm run start -- -p 3000"
echo Both servers started!
echo Frontend: http://localhost:3000
echo Backend API Docs: http://localhost:8000/docs
pause
