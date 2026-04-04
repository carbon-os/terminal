#pragma once
#include "../ipc.h"

namespace ct::mac {
    // Registers: pty.spawn · pty.in · pty.resize · pty.kill
    // Emits:     pty.out · pty.exit
    void register_pty_handlers(IPC& ipc);
}