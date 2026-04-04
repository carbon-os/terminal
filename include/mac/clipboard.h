#pragma once
#include "../ipc.h"

namespace ct::mac {
    // Registers: clipboard.write · clipboard.read
    // Emits:     clipboard.data
    void register_clipboard_handlers(IPC& ipc);
}