// End-to-end encryption for the shared-tab files. The key is generated on the
// phone that sets sync up and travels only inside the pairing code, so GitHub
// stores ciphertext it has no way to read.

const te = new TextEncoder()
const td = new TextDecoder()

function subtle(): SubtleCrypto {
  if (!globalThis.crypto?.subtle) {
    throw new Error('Encryption needs a secure connection (https).')
  }
  return globalThis.crypto.subtle
}

export function toB64url(bytes: Uint8Array): string {
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

// `Uint8Array<ArrayBuffer>` (not the default `ArrayBufferLike`) so WebCrypto,
// which rejects SharedArrayBuffer-backed views, accepts these directly.
export function fromB64url(s: string): Uint8Array<ArrayBuffer> {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/')
  const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4)
  const raw = atob(padded)
  const out = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

/** A fresh 256-bit key, base64url. */
export function randomKey(): string {
  return toB64url(crypto.getRandomValues(new Uint8Array(32)))
}

async function importKey(keyB64: string): Promise<CryptoKey> {
  const raw = fromB64url(keyB64)
  if (raw.length !== 32) throw new Error('Bad encryption key.')
  return subtle().importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt'])
}

interface Envelope {
  v: 1
  alg: 'A256GCM'
  iv: string
  ct: string
}

/** Encrypt a value into the JSON blob we store as a gist file. */
export async function seal(keyB64: string, payload: unknown): Promise<string> {
  const key = await importKey(keyB64)
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ct = await subtle().encrypt({ name: 'AES-GCM', iv }, key, te.encode(JSON.stringify(payload)))
  const env: Envelope = { v: 1, alg: 'A256GCM', iv: toB64url(iv), ct: toB64url(new Uint8Array(ct)) }
  return JSON.stringify(env)
}

export async function unseal<T>(keyB64: string, text: string): Promise<T> {
  let env: Envelope
  try {
    env = JSON.parse(text) as Envelope
  } catch {
    throw new Error('Synced data is unreadable.')
  }
  if (env?.v !== 1 || !env.iv || !env.ct) throw new Error('Synced data is in an unknown format.')
  const key = await importKey(keyB64)
  let plain: ArrayBuffer
  try {
    plain = await subtle().decrypt(
      { name: 'AES-GCM', iv: fromB64url(env.iv) },
      key,
      fromB64url(env.ct),
    )
  } catch {
    // wrong key, or the blob was tampered with — AES-GCM authenticates, so this
    // is the only place either can be detected
    throw new Error('Could not decrypt — the pairing code may not match.')
  }
  return JSON.parse(td.decode(plain)) as T
}

/** Short content hash, used to skip uploads that would change nothing. */
export async function digest(text: string): Promise<string> {
  const h = await subtle().digest('SHA-256', te.encode(text))
  return toB64url(new Uint8Array(h)).slice(0, 22)
}
