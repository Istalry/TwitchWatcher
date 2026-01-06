@echo off
echo Starting Twitch Auto-Moderator...

:: Start Server
echo Starting Backend Server...
start "TwitchWatcher Server" cmd /k "cd server && npm run dev"

:: Start Client
echo Starting Frontend Dashboard...
start "TwitchWatcher Client" cmd /k "cd client && npm run dev"

echo.
echo App is launching! 
echo Frontend: http://localhost:5173
echo Backend: http://localhost:3000
timeout /t 5 >nul
start http://localhost:5173
echo.
