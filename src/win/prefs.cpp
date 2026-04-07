#include "../../include/win/prefs.h"
#define WIN32_LEAN_AND_MEAN
#include <windows.h>
#include <shlobj.h>
#include <filesystem>
#include <fstream>

namespace fs = std::filesystem;

// %APPDATA%\CarbonTerminal
static fs::path config_dir() {
    wchar_t buf[MAX_PATH]{};
    if (SUCCEEDED(SHGetFolderPathW(nullptr, CSIDL_APPDATA, nullptr, 0, buf)))
        return fs::path(buf) / L"CarbonTerminal";
    // fallback: beside the exe
    const char* appdata = std::getenv("APPDATA");
    return fs::path(appdata ? appdata : ".") / "CarbonTerminal";
}

static std::string read_file(const fs::path& p, std::string_view fallback) {
    std::ifstream f(p);
    if (!f) return std::string(fallback);
    return { std::istreambuf_iterator<char>(f), {} };
}

static void write_file(const fs::path& p, const void* data, size_t len) {
    fs::create_directories(p.parent_path());
    std::ofstream f(p, std::ios::binary | std::ios::trunc);
    f.write(static_cast<const char*>(data), static_cast<std::streamsize>(len));
}

namespace ct::win {

void register_prefs_handlers(IPC& ipc) {
    ipc.on("prefs.profiles.load", [&ipc](Packet) {
        ipc.send_text("prefs.profiles.data", "",
                      read_file(config_dir() / "profiles.json", "[]"));
    });
    ipc.on("prefs.profiles.save", [](Packet pkt) {
        if (!pkt.payload.empty())
            write_file(config_dir() / "profiles.json",
                       pkt.payload.data(), pkt.payload.size());
    });
    ipc.on("prefs.settings.load", [&ipc](Packet) {
        ipc.send_text("prefs.settings.data", "",
                      read_file(config_dir() / "settings.json", "{}"));
    });
    ipc.on("prefs.settings.save", [](Packet pkt) {
        if (!pkt.payload.empty())
            write_file(config_dir() / "settings.json",
                       pkt.payload.data(), pkt.payload.size());
    });
}

} // namespace ct::win