import { encode, decode, FLAGS, type Packet } from './frame'
import { log, warn, error } from './log'

declare global {
    interface Window {
        __ui: {
            post(channel: string, data: ArrayBuffer): void
            on(channel: string, cb: (data: ArrayBuffer) => void): void
        }
    }
}

export type Handler = (payload: ArrayBuffer, sessionId: string) => void

const handlers = new Map<string, Set<Handler>>()

// ── Wire receive ──────────────────────────────────────────────────────────────

window.__ui.on('__ct_frame', (buf: ArrayBuffer) => {
    log(`[client] wire recv  bytes=${buf.byteLength}`)

    let pkt: Packet
    try {
        pkt = decode(buf)
    } catch (e) {
        error('[client] wire recv: decode failed:', e)
        return
    }

    log(
        `[client] wire recv  channel='${pkt.channel}' sid='${pkt.sessionId}'`,
        `payloadBytes=${pkt.payload.byteLength} flags=0x${pkt.flags.toString(16).padStart(2, '0')}`
    )

    const set = handlers.get(pkt.channel)
    if (!set) {
        warn(`[client] wire recv: no handlers registered for channel '${pkt.channel}'`)
        return
    }

    log(`[client] dispatching to ${set.size} handler(s) for '${pkt.channel}'`)
    set.forEach(h => h(pkt.payload, pkt.sessionId))
})

// ── Subscribe ─────────────────────────────────────────────────────────────────

export function on(channel: string, h: Handler): () => void {
    log(`[client] on  channel='${channel}'`)
    if (!handlers.has(channel)) handlers.set(channel, new Set())
    handlers.get(channel)!.add(h)
    return () => {
        log(`[client] off  channel='${channel}'`)
        handlers.get(channel)?.delete(h)
    }
}

// ── Send ──────────────────────────────────────────────────────────────────────

export function sendBuf(
    channel:   string,
    sessionId: string,
    payload:   ArrayBuffer,
    binary  =  false,
): void {
    log(
        `[client] sendBuf  channel='${channel}' sid='${sessionId}'`,
        `payloadBytes=${payload.byteLength} binary=${binary}`
    )
    const frame = encode({
        flags:     binary ? FLAGS.Binary : 0,
        channel,
        sessionId,
        payload,
    })
    log(`[client] sendBuf  posting ${frame.byteLength} bytes to '__ct_frame'`)
    window.__ui.post('__ct_frame', frame)
}

export function sendText(channel: string, sessionId: string, text: string): void {
    log(`[client] sendText  channel='${channel}' sid='${sessionId}' text='${text}'`)
    sendBuf(channel, sessionId, new TextEncoder().encode(text).buffer as ArrayBuffer)
}

export function sendJSON(channel: string, sessionId: string, value: unknown): void {
    const text = JSON.stringify(value)
    log(`[client] sendJSON  channel='${channel}' sid='${sessionId}' json='${text}'`)
    sendText(channel, sessionId, text)
}

export const ipc = { on, sendBuf, sendText, sendJSON } as const