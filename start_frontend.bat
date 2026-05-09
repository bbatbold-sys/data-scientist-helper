@echo off
cd /d "%~dp0frontend"
echo Starting Data Scientist Helper Frontend on port 5173...
echo.
if not exist "node_modules" (
    echo Installing dependencies...
    npm install
)
npm run dev
