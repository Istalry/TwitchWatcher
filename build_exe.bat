@echo off
echo ==========================================
echo      TwitchWatcher Build System
echo ==========================================

echo [1/5] Building Client...
cd client
call npm run build
if %errorlevel% neq 0 (
    echo Client build failed!
    pause
    exit /b %errorlevel%
)
cd ..

echo [2/5] Deploying Client to Server...
if exist "server\public" rmdir /s /q "server\public"
mkdir "server\public"
xcopy /E /I /Y "client\dist" "server\public"
if %errorlevel% neq 0 (
    echo Failed to copy client files!
    pause
    exit /b %errorlevel%
)

echo [3/5] Bundling Server (typecheck + esbuild)...
cd server
call npm run build
if %errorlevel% neq 0 (
    echo Server build failed!
    pause
    exit /b %errorlevel%
)

echo [4/5] Generating Executable (pkg, Node 22)...
call npm run package
if %errorlevel% neq 0 (
    echo Packaging failed!
    pause
    exit /b %errorlevel%
)

echo [5/5] Injecting Application Icon...
call npm run icon
if %errorlevel% neq 0 (
    echo Icon injection failed!
    pause
    exit /b %errorlevel%
)

echo ==========================================
echo        BUILD SUCCESSFUL
echo ==========================================
echo Executable located in: server\dist\TwitchWatcher.exe
echo Data files live in %%APPDATA%%\TwitchWatcher (or next to the exe when portable.txt exists).
pause
