cmake_minimum_required(VERSION 3.22)
project(CarbonTerminal LANGUAGES C OBJC OBJCXX CXX)

set(CMAKE_OSX_DEPLOYMENT_TARGET "13.0" CACHE STRING "Minimum macOS version")
set(CMAKE_EXPORT_COMPILE_COMMANDS ON)

# ── Deps ──────────────────────────────────────────────────────────────────────
add_subdirectory(deps/wkwebview-ipc)

# ── Platform ──────────────────────────────────────────────────────────────────
if(APPLE)
    add_subdirectory(ui/mac)
elseif(WIN32)
    # add_subdirectory(ui/win)
elseif(UNIX)
    # add_subdirectory(ui/linux)
endif()