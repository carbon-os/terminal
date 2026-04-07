@echo off
setlocal enabledelayedexpansion

:: ── Args ──────────────────────────────────────────────────────────────────────
set BUILD_TYPE=Debug
for %%a in (%*) do (
    if "%%a"=="--release" set BUILD_TYPE=Release
)

:: ── vcpkg ─────────────────────────────────────────────────────────────────────
if "%VCPKG_ROOT%"=="" set VCPKG_ROOT=%USERPROFILE%\.vcpkg

if not exist "%VCPKG_ROOT%\vcpkg.exe" (
    echo ^> bootstrapping vcpkg at %VCPKG_ROOT% ...
    git clone --depth 1 https://github.com/microsoft/vcpkg.git "%VCPKG_ROOT%"
    call "%VCPKG_ROOT%\bootstrap-vcpkg.bat" -disableMetrics
)

set TOOLCHAIN=%VCPKG_ROOT%\scripts\buildsystems\vcpkg.cmake

:: ── Web frontend ──────────────────────────────────────────────────────────────
echo ^> building web frontend...
pushd app\frontend
call npm install --silent
call npm run build
popd

:: ── Native ────────────────────────────────────────────────────────────────────
echo ^> building native (%BUILD_TYPE%)...
cmake -S . -B build ^
    -DCMAKE_BUILD_TYPE=%BUILD_TYPE% ^
    -DCMAKE_TOOLCHAIN_FILE="%TOOLCHAIN%"
cmake --build build --config %BUILD_TYPE%
if errorlevel 1 (
    echo.
    echo [FAILED] Build failed.
    exit /b 1
)

echo.
echo [OK] Built ^> .\build\%BUILD_TYPE%\CarbonTerminal.exe