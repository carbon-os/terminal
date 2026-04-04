cmake_minimum_required(VERSION 3.22)
project(CarbonTerminal LANGUAGES C OBJC OBJCXX CXX)

set(CMAKE_CXX_STANDARD 23)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_EXPORT_COMPILE_COMMANDS ON)

# ── FetchContent ──────────────────────────────────────────────────────────────
include(FetchContent)
set(FETCHCONTENT_BASE_DIR ${CMAKE_SOURCE_DIR}/deps)

FetchContent_Declare(ui
    GIT_REPOSITORY https://github.com/carbon-os/ui.git
    GIT_TAG        main
    SOURCE_DIR     ${CMAKE_SOURCE_DIR}/deps/ui
)
FetchContent_Declare(nlohmann_json
    GIT_REPOSITORY https://github.com/nlohmann/json.git
    GIT_TAG        v3.11.3
    SOURCE_DIR     ${CMAKE_SOURCE_DIR}/deps/json
)
set(JSON_BuildTests OFF CACHE BOOL "" FORCE)
set(JSON_Install    OFF CACHE BOOL "" FORCE)
FetchContent_MakeAvailable(ui nlohmann_json)

# ── Shared sources ────────────────────────────────────────────────────────────
set(SOURCES
    src/packet.cpp
    src/ipc.cpp
)

# ── macOS ─────────────────────────────────────────────────────────────────────
if(APPLE)
    set(CMAKE_OSX_DEPLOYMENT_TARGET "13.0" CACHE STRING "")

    list(APPEND SOURCES
        src/main_mac.mm
        src/mac/pty.mm
        src/mac/prefs.mm
        src/mac/clipboard.mm
    )
    add_executable(CarbonTerminal MACOSX_BUNDLE ${SOURCES})

    find_library(COCOA_FW  Cocoa  REQUIRED)
    find_library(WEBKIT_FW WebKit REQUIRED)

    target_compile_options(CarbonTerminal PRIVATE
        $<$<COMPILE_LANGUAGE:OBJCXX>:-fobjc-arc>
    )
    target_link_libraries(CarbonTerminal PRIVATE
        ui::ui nlohmann_json::nlohmann_json
        ${COCOA_FW} ${WEBKIT_FW}
    )
    set_target_properties(CarbonTerminal PROPERTIES
        MACOSX_BUNDLE                      TRUE
        MACOSX_BUNDLE_BUNDLE_NAME          "Carbon Terminal"
        MACOSX_BUNDLE_BUNDLE_VERSION       "0.1"
        MACOSX_BUNDLE_SHORT_VERSION_STRING "0.1"
        MACOSX_BUNDLE_ICON_FILE            "logo"
        MACOSX_BUNDLE_INFO_PLIST           "${CMAKE_SOURCE_DIR}/resources/Info.plist"
        RUNTIME_OUTPUT_DIRECTORY           "${CMAKE_BINARY_DIR}"
    )
    add_custom_command(TARGET CarbonTerminal POST_BUILD
        COMMAND codesign --force --sign "-"
                --entitlements "${CMAKE_SOURCE_DIR}/resources/entitlements.plist"
                "$<TARGET_BUNDLE_DIR:CarbonTerminal>"
        COMMENT "Codesigning CarbonTerminal.app"
    )
    add_custom_command(TARGET CarbonTerminal POST_BUILD
        COMMAND ${CMAKE_COMMAND} -E copy_directory
            "${CMAKE_SOURCE_DIR}/app/frontend/dist"
            "$<TARGET_BUNDLE_CONTENT_DIR:CarbonTerminal>/Resources/web"
        COMMENT "Copying web bundle → Resources/web"
    )
    add_custom_command(TARGET CarbonTerminal POST_BUILD
        COMMAND ${CMAKE_COMMAND} -E copy
            "${CMAKE_SOURCE_DIR}/resources/assets/logo.icns"
            "$<TARGET_BUNDLE_CONTENT_DIR:CarbonTerminal>/Resources/logo.icns"
        COMMENT "Copying app icon"
    )

# ── Windows ───────────────────────────────────────────────────────────────────
elseif(WIN32)
    list(APPEND SOURCES
        src/main_win.cpp
        src/win/pty.cpp
        src/win/prefs.cpp
    )
    add_executable(CarbonTerminal WIN32 ${SOURCES})
    target_link_libraries(CarbonTerminal PRIVATE
        ui::ui nlohmann_json::nlohmann_json
        shlwapi shell32  # SHGetFolderPath
    )
    # Copy web bundle beside the exe after build
    add_custom_command(TARGET CarbonTerminal POST_BUILD
        COMMAND ${CMAKE_COMMAND} -E copy_directory
            "${CMAKE_SOURCE_DIR}/app/frontend/dist"
            "$<TARGET_FILE_DIR:CarbonTerminal>/web"
        COMMENT "Copying web bundle → web/"
    )

# ── Linux ─────────────────────────────────────────────────────────────────────
elseif(UNIX)
    list(APPEND SOURCES
        src/main_linux.cpp
        src/linux/pty.cpp
        src/linux/prefs.cpp
    )
    add_executable(CarbonTerminal ${SOURCES})

    find_package(PkgConfig REQUIRED)
    pkg_check_modules(WEBKIT REQUIRED webkit2gtk-4.1)

    # Web bundle install dir — override with -DCT_INSTALL_WEBDIR=...
    if(NOT DEFINED CT_INSTALL_WEBDIR)
        set(CT_INSTALL_WEBDIR "${CMAKE_INSTALL_PREFIX}/share/CarbonTerminal/web")
    endif()

    target_compile_definitions(CarbonTerminal PRIVATE
        CT_WEB_DIR="${CT_INSTALL_WEBDIR}"
    )
    target_link_libraries(CarbonTerminal PRIVATE
        ui::ui nlohmann_json::nlohmann_json
        util  # forkpty
    )

    # Install rules
    install(TARGETS CarbonTerminal DESTINATION bin)
    install(DIRECTORY "${CMAKE_SOURCE_DIR}/app/frontend/dist/"
            DESTINATION "${CT_INSTALL_WEBDIR}")
endif()

target_include_directories(CarbonTerminal PRIVATE include)