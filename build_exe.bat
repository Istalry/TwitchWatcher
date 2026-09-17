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

echo [3/4] Bundling Server (typecheck + esbuild)...
cd server
call npm run build
if %errorlevel% neq 0 (
    echo Server build failed!
    pause
    exit /b %errorlevel%
)

echo [4/4] Generating Executable (pkg, Node 20)...
call npm run package
if %errorlevel% neq 0 (
    echo Packaging failed!
    pause
    exit /b %errorlevel%
)

REM echo [Post-Build] Injecting Application Icon...
REM call npx ts-node src/scripts/add_icon.ts

echo ==========================================
echo        BUILD SUCCESSFUL
echo ==========================================
echo Executable located in: server\dist\TwitchWatcher.exe
echo settings.json / users.json are created next to the exe on first run.
pause
