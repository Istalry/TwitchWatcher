@echo off
setlocal

echo ==================================================
echo TwitchWatcher Setup
echo ==================================================
echo.

:: 1. Ollama Setup (optional: skip if you plan to use Google AI)
echo [1/3] Setting up Ollama Model...
echo Pulling gemma3:4b (this may take a while if not cached)...
call ollama pull gemma3:4b
if %ERRORLEVEL% NEQ 0 (
    echo Warning: Could not pull the Ollama model. Install Ollama from https://ollama.com/
    echo          or pick Google AI in the app's setup wizard instead.
    echo.
)

:: 2. Server dependencies
echo [2/3] Installing Server Dependencies...
cd server
call npm install
if %ERRORLEVEL% NEQ 0 (
    echo Server install failed.
    pause
    exit /b 1
)
cd ..

:: 3. Client dependencies
echo [3/3] Installing Client Dependencies...
cd client
call npm install
if %ERRORLEVEL% NEQ 0 (
    echo Client install failed.
    pause
    exit /b 1
)
cd ..

echo.
echo ==================================================
echo Setup Complete!
echo Run start_app.bat - the setup wizard in the browser
echo will ask for your platform and AI credentials.
echo ==================================================
pause
