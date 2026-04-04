#include "ipc.h"
#include <cstdio>

namespace ct {

IPC::IPC(ui::WebView& wv) : wv_(wv) {
    wv_.on_message(kWireChannel, [this](ui::Message msg) {
        if (!msg.is_binary()) return;

        auto pkt = Packet::decode(std::span{ msg.data() });
        if (!pkt) {
            std::puts("[ipc] malformed frame – dropped");
            return;
        }

        std::unique_lock lock(mutex_);
        auto it = handlers_.find(pkt->channel);
        if (it == handlers_.end()) return;
        auto cb = it->second;          // copy so we can unlock before calling
        lock.unlock();

        cb(std::move(*pkt));
    });
}

void IPC::on(std::string_view channel, Handler cb) {
    std::lock_guard lock(mutex_);
    handlers_.insert_or_assign(std::string(channel), std::move(cb));
}

void IPC::off(std::string_view channel) {
    std::lock_guard lock(mutex_);
    handlers_.erase(std::string(channel));
}

void IPC::send(Packet pkt) {
    wv_.post_message(kWireChannel, pkt.encode());
}

void IPC::send_text(std::string_view channel,
                    std::string_view session_id,
                    std::string_view text) {
    Packet p;
    p.flags      = 0;
    p.channel    = channel;
    p.session_id = session_id;
    p.payload    = { reinterpret_cast<const uint8_t*>(text.data()),
                     reinterpret_cast<const uint8_t*>(text.data()) + text.size() };
    send(std::move(p));
}

void IPC::send_binary(std::string_view channel,
                      std::string_view session_id,
                      std::span<const uint8_t> data) {
    Packet p;
    p.flags      = kFlagBinary;
    p.channel    = channel;
    p.session_id = session_id;
    p.payload    = { data.begin(), data.end() };
    send(std::move(p));
}

} // namespace ct