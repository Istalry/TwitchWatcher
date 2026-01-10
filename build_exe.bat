@echo off
echo ==========================================
echo      TwitchWatcher Build System
echo ==========================================

echo [1/4] Building Client...
cd client
call npm run build
if %errorlevel% neq 0 (
    echo Client build failed!
    pause
    exit /b %errorlevel%
)
cd ..

echo [2/4] Deploying Client to Server...
if exist "server\public" rmdir /s /q "server\public"
mkdir "server\public"
xcopy /E /I /Y "client\dist" "server\public"
if %errorlevel% neq 0 (
    echo Failed to copy client files!
    pause
    exit /b %errorlevel%
)

echo [3/4] Compiling Server...
cd server
call npm run build
if %errorlevel% neq 0 (
    echo Server compilation failed!
    pause
    exit /b %errorlevel%
)

echo [4/4] Generating Executable...
call npx pkg .
if %errorlevel% neq 0 (
    echo Packaging failed!
    pause
    exit /b %errorlevel%
)

REM echo [Post-Build] Injecting Application Icon...
REM if exist "dist\twitch-automod-server.exe" (
REM    call npx ts-node src/scripts/add_icon.ts
REM    if %errorlevel% neq 0 (
REM        echo Icon injection failed!
REM        pause
REM    )
REM ) else (
REM    echo Executable not found!
REM    pause
REM )

echo ==========================================
echo        BUILD SUCCESSFUL
echo ==========================================
echo Executable located in: server\dist\twitch-automod-server.exe
pause
