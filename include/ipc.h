#pragma once
#include "packet.h"
#include <ui/webview.h>
#include <functional>
#include <mutex>
#include <span>
#include <string_view>
#include <unordered_map>

namespace ct {

// All JS ↔ C++ traffic flows through a single WebView binary channel.
// Packets are decoded and dispatched to per-channel handlers here.

static constexpr std::string_view kWireChannel = "__ct_frame";

class IPC {
public:
    using Handler = std::function<void(Packet)>;

    explicit IPC(ui::WebView& wv);

    void on (std::string_view channel, Handler cb);
    void off(std::string_view channel);

    void send(Packet pkt);

    void send_text  (std::string_view channel,
                     std::string_view session_id,
                     std::string_view text);

    void send_binary(std::string_view channel,
                     std::string_view session_id,
                     std::span<const uint8_t> data);

private:
    ui::WebView& wv_;
    std::unordered_map<std::string, Handler> handlers_;
    std::mutex   mutex_;
};

} // namespace ct