#pragma once

#include <ui/webview.h>
#include "packet.h"

#include <functional>
#include <mutex>
#include <span>
#include <string>
#include <string_view>
#include <unordered_map>

namespace ct {

class IPC {
public:
    using Handler = std::function<void(Packet)>;

    explicit IPC(ui::WebView& wv);

    void on(std::string_view channel, Handler cb);
    void off(std::string_view channel);

    void send(Packet pkt);
    void send_text(std::string_view channel,
                   std::string_view session_id,
                   std::string_view text);
    void send_binary(std::string_view channel,
                     std::string_view session_id,
                     std::span<const uint8_t> data);

private:
    static constexpr const char* kWireChannel = "__ct_frame";

    ui::WebView& wv_;

    std::mutex                               mutex_;
    std::unordered_map<std::string, Handler> handlers_;
};

} // namespace ct