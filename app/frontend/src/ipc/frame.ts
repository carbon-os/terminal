export const FLAGS = {
    Binary:   0x01 as const,
    Request:  0x02 as const,
    Response: 0x04 as const,
}

const MAGIC_HI   = 0xCA
const MAGIC_LO   = 0xFE
const VERSION    = 0x01
const HEADER_LEN = 10

const enc = new TextEncoder()
const dec = new TextDecoder()

export interface Packet {
    flags:     number
    channel:   string
    sessionId: string
    payload:   ArrayBuffer
}

export function encode(p: Packet): ArrayBuffer {
    const ch  = enc.encode(p.channel)
    const sid = enc.encode(p.sessionId)
    const pay = new Uint8Array(p.payload)

    if (ch.length  > 255) throw new RangeError('channel too long')
    if (sid.length > 255) throw new RangeError('sessionId too long')

    const buf = new ArrayBuffer(HEADER_LEN + ch.length + sid.length + pay.length)
    const dv  = new DataView(buf)
    const u8  = new Uint8Array(buf)

    dv.setUint8 (0, MAGIC_HI)
    dv.setUint8 (1, MAGIC_LO)
    dv.setUint8 (2, VERSION)
    dv.setUint8 (3, p.flags)
    dv.setUint8 (4, ch.length)
    dv.setUint8 (5, sid.length)
    dv.setUint32(6, pay.length, /*littleEndian=*/ true)

    let off = HEADER_LEN
    u8.set(ch,  off); off += ch.length
    u8.set(sid, off); off += sid.length
    u8.set(pay, off)

    return buf
}

export function decode(buf: ArrayBuffer): Packet {
    const dv = new DataView(buf)
    const u8 = new Uint8Array(buf)

    if (u8.length < HEADER_LEN)                       throw new Error('frame too short')
    if (dv.getUint8(0) !== MAGIC_HI ||
        dv.getUint8(1) !== MAGIC_LO)                  throw new Error('bad magic')
    if (dv.getUint8(2) !== VERSION)                   throw new Error('bad version')

    const flags = dv.getUint8(3)
    const chanL = dv.getUint8(4)
    const sessL = dv.getUint8(5)
    const payL  = dv.getUint32(6, true)

    if (u8.length < HEADER_LEN + chanL + sessL + payL)
        throw new Error('frame truncated')

    let off = HEADER_LEN
    const channel   = dec.decode(u8.subarray(off, off += chanL))
    const sessionId = dec.decode(u8.subarray(off, off += sessL))
    const payload   = buf.slice(off, off + payL)

    return { flags, channel, sessionId, payload }
}