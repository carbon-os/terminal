import { encode, decode, FLAGS } from './frame'

// ── Arc bridge (injected by the Go host) ─────────────────────────────────────

declare global {
    interface Window {
        ipc: {
            post(channel: string, data: string | ArrayBuffer): void
            on(channel: string, cb: (payload: string | ArrayBuffer) => void): void
            off(channel: string): void
        }
    }
}

// ── Types ─────────────────────────────────────────────────────────────────────

export type Handler = (payload: ArrayBuffer, sessionId: string) => void

// ── Internal channel → handler registry ──────────────────────────────────────

const handlers = new Map<string, Set<Handler>>()

// ── Wire receive — single __ct_frame channel ──────────────────────────────────

window.ipc.on('__ct_frame', (raw: string | ArrayBuffer) => {
    const buf = raw instanceof ArrayBuffer ? raw : new TextEncoder().encode(raw).buffer as ArrayBuffer

    let pkt
    try {
        pkt = decode(buf)
    } catch {
        return
    }

    const set = handlers.get(pkt.channel)
    if (!set || set.size === 0) return

    set.forEach(h => {
        try {
            h(pkt.payload, pkt.sessionId)
        } catch { /* ignore handler errors */ }
    })
})

// ── Subscribe ─────────────────────────────────────────────────────────────────

export function on(channel: string, handler: Handler): () => void {
    let set = handlers.get(channel)
    if (!set) {
        set = new Set()
        handlers.set(channel, set)
    }
    set.add(handler)
    return () => {
        handlers.get(channel)?.delete(handler)
    }
}

// ── Send ──────────────────────────────────────────────────────────────────────

export function sendBuf(
    channel:   string,
    sessionId: string,
    payload:   ArrayBuffer,
    binary  =  false,
): void {
    const frame = encode({
        flags:     binary ? FLAGS.Binary : 0,
        channel,
        sessionId,
        payload,
    })
    window.ipc.post('__ct_frame', frame)
}

export function sendText(channel: string, sessionId: string, text: string): void {
    sendBuf(channel, sessionId, new TextEncoder().encode(text).buffer as ArrayBuffer)
}

export function sendJSON(channel: string, sessionId: string, value: unknown): void {
    sendText(channel, sessionId, JSON.stringify(value))
}

// ── Public API ────────────────────────────────────────────────────────────────

export const ipc = { on, sendBuf, sendText, sendJSON } as const