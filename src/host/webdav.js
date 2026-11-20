/**
 * Minimal WebDAV client over the Node global fetch API (Node 18+).
 * Supports the small verb subset the sync engine needs:
 * PROPFIND (existence checks), MKCOL (collection creation),
 * GET and PUT (JSON manifests and binary packages).
 */

function trimSlashes(value) {
  return String(value ?? '').replace(/^\/+|\/+$/g, '')
}

/**
 * Build an absolute WebDAV URL from the configured base and ordered segments.
 * The final segment may opt out of the trailing collection slash.
 */
export function davUrl(baseUrl, segments, { trailingSlash = false } = {}) {
  const base = trimSlashes(baseUrl)
  const parts = (segments ?? [])
    .map(segment => trimSlashes(segment))
    .filter(segment => segment.length > 0)
    .map(segment => encodeURIComponent(segment))
  let url = base.length === 0 ? '/' : base + '/'
  if (parts.length > 0) url += parts.join('/') + '/'
  if (!trailingSlash) url = url.replace(/\/$/, '')
  return url
}

/** File name of one plugin package inside the remote `packages/` collection. */
export function davFileName(packageName, version) {
  // Scoped names contain '/', which must not create extra path segments.
  const safeName = String(packageName).replace(/\//g, '__')
  return `${safeName}@${version}.tgz`
}

export class WebDavClient {
  constructor({ baseUrl, username, password } = {}) {
    this.baseUrl = String(baseUrl ?? '').trim()
    if (this.baseUrl.length === 0) throw new Error('WebDAV 地址不能为空')
    const user = String(username ?? '')
    const pass = String(password ?? '')
    this.authorization = user.length > 0
      ? `Basic ${Buffer.from(`${user}:${pass}`, 'utf8').toString('base64')}`
      : undefined
  }

  #requestUrl(path, trailingSlash) {
    if (typeof path === 'string' && (path.startsWith('http://') || path.startsWith('https://'))) return path
    return davUrl(this.baseUrl, Array.isArray(path) ? path : [path], { trailingSlash })
  }

  async #request(method, path, { body, headers, trailingSlash, signal } = {}) {
    const finalHeaders = { ...headers }
    if (this.authorization !== undefined) finalHeaders.authorization = this.authorization
    let response
    try {
      response = await fetch(this.#requestUrl(path, trailingSlash), {
        method,
        headers: finalHeaders,
        body,
        signal,
      })
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error)
      throw new Error(`WebDAV 请求失败（${method}）: ${reason}`)
    }
    return response
  }

  #assertStatus(response, allowed, action) {
    if (!allowed.includes(response.status)) {
      throw new Error(`WebDAV ${action} 失败: HTTP ${response.status} ${response.statusText}`.trim())
    }
  }

  /** Verify the server answers a PROPFIND on the configured base. */
  async verify(signal) {
    const response = await this.#request('PROPFIND', [], {
      headers: { depth: '0' },
      trailingSlash: true,
      signal,
    })
    if (response.status === 404) throw new Error('WebDAV 根路径不存在，请检查地址')
    this.#assertStatus(response, [207, 200], '连接测试')
    await response.body?.cancel().catch(() => {})
    return true
  }

  /** Create a collection and every missing parent, ignoring "already exists". */
  async ensureCollection(segments, signal) {
    const list = (Array.isArray(segments) ? segments : [segments]).map(segment => trimSlashes(segment)).filter(Boolean)
    let current = []
    for (const segment of list) {
      current = [...current, segment]
      const response = await this.#request('MKCOL', current, { trailingSlash: true, signal })
      if ([201, 405, 301, 409].includes(response.status)) {
        await response.body?.cancel().catch(() => {})
        continue
      }
      // 405 = already exists on many servers; anything else is a real failure.
      this.#assertStatus(response, [200, 201, 405], `创建目录 /${current.join('/')}`)
    }
  }

  /** Read a text resource; returns null when it does not exist. */
  async getText(segments, signal) {
    const response = await this.#request('GET', segments, { trailingSlash: false, signal })
    if (response.status === 404) return null
    this.#assertStatus(response, [200], `读取 ${Array.isArray(segments) ? segments.join('/') : segments}`)
    return await response.text()
  }

  async getJson(segments, signal) {
    const text = await this.getText(segments, signal)
    if (text === null) return null
    try {
      return JSON.parse(text)
    } catch (error) {
      throw new Error(`远端清单不是合法 JSON: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  async putText(segments, text, signal) {
    const response = await this.#request('PUT', segments, {
      body: text,
      headers: { 'content-type': 'application/json; charset=utf-8' },
      trailingSlash: false,
      signal,
    })
    this.#assertStatus(response, [200, 201, 204], `写入 ${Array.isArray(segments) ? segments.join('/') : segments}`)
    return true
  }

  /** Read a binary resource; returns null when it does not exist. */
  async getBuffer(segments, signal) {
    const response = await this.#request('GET', segments, { trailingSlash: false, signal })
    if (response.status === 404) return null
    this.#assertStatus(response, [200], `下载 ${Array.isArray(segments) ? segments.join('/') : segments}`)
    return Buffer.from(await response.arrayBuffer())
  }

  async putBuffer(segments, buffer, signal) {
    const response = await this.#request('PUT', segments, {
      body: buffer,
      headers: { 'content-type': 'application/gzip' },
      trailingSlash: false,
      signal,
    })
    this.#assertStatus(response, [200, 201, 204], `上传 ${Array.isArray(segments) ? segments.join('/') : segments}`)
    return true
  }
}
