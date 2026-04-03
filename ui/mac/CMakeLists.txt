find_library(COCOA_FW  Cocoa  REQUIRED)
find_library(WEBKIT_FW WebKit REQUIRED)

# ── UI static lib ─────────────────────────────────────────────────────────────
add_library(ui_mac STATIC
    AppDelegate.m
    MainWindowController.m
    TerminalWebView.m
    WebViewFactory.m
    PtyManager.m
    PreferencesManager.m          # ← added
)

target_include_directories(ui_mac PUBLIC ${CMAKE_CURRENT_SOURCE_DIR})
target_compile_options(ui_mac PRIVATE -fobjc-arc)

target_link_libraries(ui_mac PUBLIC
    ${COCOA_FW}
    ${WEBKIT_FW}
    wkwebview-ipc
)

# ── App bundle ────────────────────────────────────────────────────────────────
add_executable(CarbonTerminal MACOSX_BUNDLE main.m)

target_link_libraries(CarbonTerminal PRIVATE
    ui_mac
    ${COCOA_FW}
    ${WEBKIT_FW}
)

set_target_properties(CarbonTerminal PROPERTIES
    MACOSX_BUNDLE                       TRUE
    MACOSX_BUNDLE_BUNDLE_NAME           "Carbon Terminal"
    MACOSX_BUNDLE_BUNDLE_VERSION        "0.1"
    MACOSX_BUNDLE_SHORT_VERSION_STRING  "0.1"
    MACOSX_BUNDLE_ICON_FILE             "logo"
    MACOSX_BUNDLE_INFO_PLIST            "${CMAKE_SOURCE_DIR}/resources/Info.plist"
    RUNTIME_OUTPUT_DIRECTORY            "${CMAKE_BINARY_DIR}"
)

# ── Post-build: codesign ──────────────────────────────────────────────────────
add_custom_command(TARGET CarbonTerminal POST_BUILD
    COMMAND codesign --force --sign "-"
            --entitlements "${CMAKE_SOURCE_DIR}/resources/entitlements.plist"
            "$<TARGET_BUNDLE_DIR:CarbonTerminal>"
    COMMENT "Signing CarbonTerminal.app"
)

# ── Post-build: web bundle ────────────────────────────────────────────────────
add_custom_command(TARGET CarbonTerminal POST_BUILD
    COMMAND ${CMAKE_COMMAND} -E copy_directory
        "${CMAKE_SOURCE_DIR}/app/frontend/dist"
        "$<TARGET_BUNDLE_CONTENT_DIR:CarbonTerminal>/Resources/web"
    COMMENT "Copying web bundle → .app/Contents/Resources/web"
)

# ── Post-build: app icon ──────────────────────────────────────────────────────
add_custom_command(TARGET CarbonTerminal POST_BUILD
    COMMAND ${CMAKE_COMMAND} -E copy
        "${CMAKE_SOURCE_DIR}/resources/assets/logo.icns"
        "$<TARGET_BUNDLE_CONTENT_DIR:CarbonTerminal>/Resources/logo.icns"
    COMMENT "Copying app icon → .app/Contents/Resources/logo.icns"
)