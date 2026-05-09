@echo off
cd /d "%~dp0backend"
echo Starting Data Scientist Helper Backend on port 8000...
echo.
echo Make sure ANTHROPIC_API_KEY is set (for AI features)
echo.
if not exist ".env" (
    echo ANTHROPIC_API_KEY=your_key_here > .env
    echo Created .env file - add your API key!
)
pip install -r requirements.txt --quiet
python -m uvicorn main:app --reload --port 8000
