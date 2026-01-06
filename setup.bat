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

:: 2. Credentials
echo [2/3] Configuring Twitch Credentials
echo Please enter your Twitch Bot details.
echo (You can get an OAuth token from https://twitchapps.com/tmi/)
echo.

echo.
echo [!] IMPORTANT TOKEN INSTRUCTIONS [!]
echo 1. Go to https://twitchtokengenerator.com/
echo 2. Select "Bot Chat Token" or "Custom Scope Token"
echo 3. Enable these specific scopes:
echo    - chat:read
echo    - chat:edit
echo    - channel:moderate
echo 4. Click "Generate Token" and Authorize.
echo 5. Copy the "ACCESS TOKEN" (not Refresh Token, not Client ID).
echo.

set /p T_USER="Twitch Username (e.g. MyBotUser): "
set /p T_CHANNEL="Target Channel (e.g. ninja -- just the name, NO URL): "
set /p T_TOKEN="Access Token (e.g. oauth:xyz123...): "

:: Write to .env
echo Writing credentials to server/.env ...
(
echo TWITCH_USERNAME=%T_USER%
echo TWITCH_OAUTH_TOKEN=%T_TOKEN%
echo TWITCH_CHANNEL=%T_CHANNEL%
echo PORT=3000
echo OLLAMA_MODEL=gemma3:4b
) > server/.env

echo.

:: 3. Dependencies
echo [3/3] Installing Dependencies...
echo Server dependencies...
cd server
call npm install
cd ..

echo Client dependencies...
cd client
call npm install
cd ..

echo.
echo ==================================================
echo Setup Complete!
echo You can now run the app using start_app.bat
echo ==================================================
pause
