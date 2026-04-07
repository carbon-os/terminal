export let loggingEnabled = true

export function setLogging(enabled: boolean): void {
    loggingEnabled = enabled
}

export function log(...args: unknown[]): void {
    if (loggingEnabled) console.log(...args)
}

export function warn(...args: unknown[]): void {
    if (loggingEnabled) console.warn(...args)
}

export function error(...args: unknown[]): void {
    if (loggingEnabled) console.error(...args)
}