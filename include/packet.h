#pragma once
#include <cstdint>
#include <optional>
#include <span>
#include <string>
#include <string_view>
#include <vector>

namespace ct {

//  Binary frame – all multi-byte integers little-endian
//  ┌──────────┬─────────┬──────┬──────────┬──────────┬────────────┐
//  │ magic 2B │ ver  1B │ fl 1B│ chan_l 1B │ sess_l 1B│ pay_l  4B │  = 10 B header
//  ├──────────┴─────────┴──────┴──────────┴──────────┴────────────┤
//  │  channel   – chan_l  bytes  (UTF-8, ≤ 255)                    │
//  │  session   – sess_l  bytes  (UTF-8, ≤ 255, empty = global)    │
//  │  payload   – pay_l   bytes  (binary or UTF-8 depending on fl) │
//  └──────────────────────────────────────────────────────────────┘

static constexpr uint16_t kFrameMagic   = 0xCAFE;
static constexpr uint8_t  kFrameVersion = 0x01;

enum FrameFlags : uint8_t {
    kFlagBinary   = 1 << 0,   // payload is raw bytes, not text
    kFlagRequest  = 1 << 1,   // expects a response
    kFlagResponse = 1 << 2,   // this is a response
};

struct Packet {
    uint8_t              flags      = 0;
    std::string          channel;       // routing key
    std::string          session_id;    // pty session id, "" = none
    std::vector<uint8_t> payload;

    bool is_binary()   const noexcept { return (flags & kFlagBinary)   != 0; }
    bool is_request()  const noexcept { return (flags & kFlagRequest)  != 0; }
    bool is_response() const noexcept { return (flags & kFlagResponse) != 0; }

    std::string_view text() const noexcept {
        return { reinterpret_cast<const char*>(payload.data()), payload.size() };
    }

    std::vector<uint8_t>         encode() const;
    static std::optional<Packet> decode(std::span<const uint8_t> data);
};

} // namespace ct