@echo off
setlocal

echo ==================================================
echo Twitch Auto-Moderator Setup
echo ==================================================
echo.

:: 1. Ollama Setup
echo [1/3] Setting up Ollama Model...
echo Pulling gemma3:4b (this may take a while if not cached)...
call ollama pull gemma3:4b
if %ERRORLEVEL% NEQ 0 (
    echo Error: Failed to pull Ollama model. Make sure Ollama is installed and running.
    echo Please install it from https://ollama.com/
    pause
    exit /b 1
)
echo Ollama model ready.
echo.

:: 2. Credentials & Config
echo [2/3] Configuring Application...
echo.
cd server
if not exist node_modules (
    echo Installing initial server dependencies needed for setup...
    call npm install
)
echo Running interactive setup...
call npm run setup
if %ERRORLEVEL% NEQ 0 (
    echo Setup failed or was cancelled.
    pause
    exit /b 1
)
cd ..

echo.

:: 3. Dependencies
echo [3/3] Installing Client Dependencies...

cd client
call npm install
cd ..

echo.
echo ==================================================
echo Setup Complete!
echo You can now run the app using start_app.bat
echo ==================================================
pause
