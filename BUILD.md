# Building Carbon Terminal

## Prerequisites

### All Platforms
- CMake ≥ 3.22
- Node.js + npm
- Git

### macOS
- Xcode Command Line Tools (`xcode-select --install`)
- Cocoa and WebKit (included with macOS SDK)

### Windows
- Visual Studio 2022 (with "Desktop development with C++" workload)
- vcpkg is bootstrapped automatically by `build.bat`

### Linux
- GCC or Clang
- webkit2gtk-4.1 dev headers

```bash
sudo apt install build-essential cmake nodejs npm \
    libwebkit2gtk-4.1-dev pkg-config
```

---

## Building

### macOS / Linux

```bash
./build.sh             # debug build
./build.sh --release   # release build
```

**macOS output:** `./build/CarbonTerminal.app`  
**Linux output:** `./build/CarbonTerminal`

### Windows

```bat
build.bat              :: debug build
build.bat --release    :: release build
```

**Output:** `.\build\Debug\CarbonTerminal.exe` or `.\build\Release\CarbonTerminal.exe`

vcpkg is bootstrapped automatically on first run into `%USERPROFILE%\.vcpkg`.

---

## Running

### macOS
```bash
open ./build/CarbonTerminal.app
```

### Linux
```bash
./build/CarbonTerminal
```

### Windows
```bat
.\build\Debug\CarbonTerminal.exe
```

---

## Cleaning the Build

### macOS / Linux
```bash
rm -rf build
```

### Windows
```bat
rmdir /s /q build
```

---

## Clearing Caches

### Windows

If you run into stale dependency issues or vcpkg behaves unexpectedly, clear
the vcpkg download and binary caches before rebuilding:

```bat
rmdir /s /q %LOCALAPPDATA%\vcpkg\archives
rmdir /s /q %USERPROFILE%\.vcpkg\downloads
rmdir /s /q build
build.bat
```

### macOS / Linux

```bash
rm -rf build
rm -rf app/frontend/node_modules
rm -rf app/frontend/.vite
./build.sh
```

---

## WSL Notes

If building under WSL, make sure you are using the **Linux-native** Node and
npm rather than the Windows versions leaking in through `PATH`. A quick check:

```bash
which node   # should be /usr/bin/node or ~/.nvm/...
which npm    # should be /usr/bin/npm  or ~/.nvm/...
```

If either points to `/mnt/c/...`, add this to your `~/.bashrc` and re-source it:

```bash
PATH=$(echo "$PATH" | sed -e 's/:\/mnt.*//g')
```