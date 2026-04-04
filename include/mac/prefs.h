#pragma once
#include "../ipc.h"

namespace ct::mac {
    // Registers: prefs.profiles.{load,save} · prefs.settings.{load,save}
    // Emits:     prefs.profiles.data · prefs.settings.data
    void register_prefs_handlers(IPC& ipc);
}