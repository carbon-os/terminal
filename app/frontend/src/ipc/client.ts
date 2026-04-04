import { encode, decode, FLAGS, type Packet } from './frame'

// ── Window bridge type ────────────────────────────────────────────────────────

declare global {
    interface Window {
        __ui: {
            post(channel: string, data: ArrayBuffer): void
            on(channel: string, cb: (data: ArrayBuffer) => void): void
        }
    }
}

// ── Types ─────────────────────────────────────────────────────────────────────

export type Handler = (payload: ArrayBuffer, sessionId: string) => void

// channel → set of registered handlers
const handlers = new Map<string, Set<Handler>>()

// ── Wire receive ──────────────────────────────────────────────────────────────

window.__ui.on('__ct_frame', (buf: ArrayBuffer) => {
    let pkt: Packet
    try   { pkt = decode(buf) }
    catch { return }

    const set = handlers.get(pkt.channel)
    if (!set) return
    set.forEach(h => h(pkt.payload, pkt.sessionId))
})

// ── Subscribe ─────────────────────────────────────────────────────────────────
// Returns an unsubscribe function so callers don't need to hold a handler ref.

function on(channel: string, h: Handler): () => void {
    if (!handlers.has(channel)) handlers.set(channel, new Set())
    handlers.get(channel)!.add(h)
    return () => handlers.get(channel)?.delete(h)
}

// ── Send ──────────────────────────────────────────────────────────────────────

function sendBuf(
    channel:   string,
    sessionId: string,
    payload:   ArrayBuffer,
    binary  =  false,
) {
    const frame = encode({
        flags:     binary ? FLAGS.Binary : 0,
        channel,
        sessionId,
        payload,
    })
    window.__ui.post('__ct_frame', frame)
}

function sendText(channel: string, sessionId: string, text: string) {
    sendBuf(channel, sessionId, new TextEncoder().encode(text).buffer as ArrayBuffer)
}

function sendJSON(channel: string, sessionId: string, value: unknown) {
    sendText(channel, sessionId, JSON.stringify(value))
}

export const ipc = { on, sendBuf, sendText, sendJSON } as const