#include "packet.h"
#include <cassert>
#include <cstring>

namespace ct {

std::vector<uint8_t> Packet::encode() const {
    assert(channel.size()    <= 255 && "channel name too long");
    assert(session_id.size() <= 255 && "session_id too long");

    const auto chan_l = static_cast<uint8_t>(channel.size());
    const auto sess_l = static_cast<uint8_t>(session_id.size());
    const auto pay_l  = static_cast<uint32_t>(payload.size());

    std::vector<uint8_t> out;
    out.reserve(10 + chan_l + sess_l + pay_l);

    // ── header ──────────────────────────────────────────────────────────────
    out.push_back(0xCA);                    // magic hi
    out.push_back(0xFE);                    // magic lo
    out.push_back(kFrameVersion);
    out.push_back(flags);
    out.push_back(chan_l);
    out.push_back(sess_l);
    out.push_back( pay_l        & 0xFF);   // payload len LE
    out.push_back((pay_l >>  8) & 0xFF);
    out.push_back((pay_l >> 16) & 0xFF);
    out.push_back((pay_l >> 24) & 0xFF);

    // ── body ────────────────────────────────────────────────────────────────
    out.insert(out.end(), channel.begin(),    channel.end());
    out.insert(out.end(), session_id.begin(), session_id.end());
    out.insert(out.end(), payload.begin(),    payload.end());

    return out;
}

std::optional<Packet> Packet::decode(std::span<const uint8_t> d) {
    constexpr size_t kHdr = 10;
    if (d.size() < kHdr)               return std::nullopt;
    if (d[0] != 0xCA || d[1] != 0xFE) return std::nullopt;
    if (d[2] != kFrameVersion)         return std::nullopt;

    const uint8_t  flags  = d[3];
    const uint8_t  chan_l = d[4];
    const uint8_t  sess_l = d[5];
    const uint32_t pay_l  = static_cast<uint32_t>(d[6])
                          | static_cast<uint32_t>(d[7]) <<  8
                          | static_cast<uint32_t>(d[8]) << 16
                          | static_cast<uint32_t>(d[9]) << 24;

    const size_t need = kHdr + chan_l + sess_l + pay_l;
    if (d.size() < need) return std::nullopt;

    size_t off = kHdr;
    Packet p;
    p.flags      = flags;
    p.channel    = { reinterpret_cast<const char*>(d.data() + off), chan_l };
    off += chan_l;
    p.session_id = { reinterpret_cast<const char*>(d.data() + off), sess_l };
    off += sess_l;
    p.payload    = { d.data() + off, d.data() + off + pay_l };

    return p;
}

} // namespace ct