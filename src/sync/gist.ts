// The transport: one secret gist, two files, each phone writing only its own.
// GitHub's REST API allows cross-origin requests with an Authorization header,
// so this works straight from the phone with no server of our own.

const API = 'https://api.github.com'

export type SyncErrorKind = 'auth' | 'missing' | 'rate' | 'network' | 'other'

export class SyncError extends Error {
  kind: SyncErrorKind
  constructor(kind: SyncErrorKind, message: string) {
    super(message)
    this.name = 'SyncError'
    this.kind = kind
  }
}

export interface GistFiles {
  [name: string]: string
}

export interface ReadResult {
  status: 'ok' | 'unchanged'
  files: GistFiles
  etag: string | null
}

export interface GistApi {
  create(token: string, files: GistFiles, description: string): Promise<string>
  read(token: string, gistId: string, etag: string | null): Promise<ReadResult>
  writeFile(token: string, gistId: string, name: string, content: string): Promise<void>
}

function headers(token: string): HeadersInit {
  return {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${token}`,
    'X-GitHub-Api-Version': '2022-11-28',
    'Content-Type': 'application/json',
  }
}

function fail(res: Response): SyncError {
  if (res.status === 401) {
    return new SyncError('auth', 'GitHub rejected the token. Re-pair to fix sync.')
  }
  if (res.status === 404) {
    return new SyncError('missing', 'The shared gist is gone. Re-pair to fix sync.')
  }
  if (res.status === 403 && res.headers.get('x-ratelimit-remaining') === '0') {
    return new SyncError('rate', 'GitHub rate limit hit — syncing again shortly.')
  }
  if (res.status === 403) {
    return new SyncError('auth', 'The token is missing the “gist” permission.')
  }
  return new SyncError('other', `GitHub error ${res.status}.`)
}

async function request(url: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(url, init)
  } catch {
    throw new SyncError('network', 'No connection — will sync when you’re back online.')
  }
}

const githubGists: GistApi = {
  async create(token, files, description) {
    const body = {
      description,
      public: false,
      files: Object.fromEntries(Object.entries(files).map(([n, content]) => [n, { content }])),
    }
    const res = await request(`${API}/gists`, {
      method: 'POST',
      headers: headers(token),
      body: JSON.stringify(body),
    })
    if (!res.ok) throw fail(res)
    const json = (await res.json()) as { id?: string }
    if (!json.id) throw new SyncError('other', 'GitHub did not return a gist id.')
    return json.id
  },

  async read(token, gistId, etag) {
    const init: RequestInit = { headers: { ...headers(token) } }
    // A 304 costs nothing against the rate limit, which is what makes polling free.
    if (etag) (init.headers as Record<string, string>)['If-None-Match'] = etag
    const res = await request(`${API}/gists/${gistId}`, init)
    if (res.status === 304) return { status: 'unchanged', files: {}, etag }
    if (!res.ok) throw fail(res)
    const json = (await res.json()) as {
      files?: Record<string, { content?: string; truncated?: boolean; raw_url?: string } | null>
    }
    const files: GistFiles = {}
    for (const [name, f] of Object.entries(json.files ?? {})) {
      if (!f) continue
      if (f.truncated && f.raw_url) {
        const raw = await request(f.raw_url, {})
        files[name] = raw.ok ? await raw.text() : ''
      } else {
        files[name] = f.content ?? ''
      }
    }
    return { status: 'ok', files, etag: res.headers.get('etag') }
  },

  async writeFile(token, gistId, name, content) {
    const res = await request(`${API}/gists/${gistId}`, {
      method: 'PATCH',
      headers: headers(token),
      body: JSON.stringify({ files: { [name]: { content } } }),
    })
    if (!res.ok) throw fail(res)
  },
}

let api: GistApi = githubGists

/** Swap the transport — used by the in-browser self-test in dev builds. */
export function setGistApi(next: GistApi | null): void {
  api = next ?? githubGists
}

export const gists: GistApi = {
  create: (...a) => api.create(...a),
  read: (...a) => api.read(...a),
  writeFile: (...a) => api.writeFile(...a),
}
