#include "../../include/linux/prefs.h"
#include <cstdlib>
#include <filesystem>
#include <fstream>

namespace fs = std::filesystem;

// XDG_CONFIG_HOME → ~/.config/CarbonTerminal
static fs::path config_dir() {
    const char* xdg = std::getenv("XDG_CONFIG_HOME");
    fs::path base = (xdg && *xdg)
        ? fs::path(xdg)
        : fs::path(std::getenv("HOME")) / ".config";
    return base / "CarbonTerminal";
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

namespace ct::linux_ {

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

} // namespace ct::linux_