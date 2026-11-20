/**
 * Sync engine: packages locally installed plugin bundles, uploads them to a
 * WebDAV collection, downloads and installs remote packages, and keeps an
 * in-memory status snapshot for the UI. One sync runs at a time.
 */

import { createHash, randomUUID } from 'node:crypto'
import { promises as fs } from 'node:fs'
import { statSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { WebDavClient, davFileName } from './webdav.js'
import { packDirectory } from './tarball.js'

/** This plugin's own package name; always excluded from synchronization. */
export const SELF_NAME = '@local/dsh-webdav-sync'
export const DEFAULT_BACKUP_DIR = 'dsh-plugin-sync'
const MANIFEST_VERSION = 1

function titleOf(meta) {
  const title = meta?.title
  if (typeof title === 'string') return title
  if (title !== null && typeof title === 'object') return title.zh ?? title.en
  return undefined
}

function parseVersion(value) {
  const match = /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/.exec(String(value ?? '').trim())
  if (match === null) return null
  return { major: Number(match[1]), minor: Number(match[2]), patch: Number(match[3]), pre: match[4] ?? null }
}

/** Compare two semver-ish versions; returns -1, 0, or 1. */
export function compareVersions(a, b) {
  const pa = parseVersion(a)
  const pb = parseVersion(b)
  if (pa === null || pb === null) {
    const sa = String(a ?? '')
    const sb = String(b ?? '')
    return sa === sb ? 0 : sa > sb ? 1 : -1
  }
  for (const key of ['major', 'minor', 'patch']) {
    if (pa[key] !== pb[key]) return pa[key] < pb[key] ? -1 : 1
  }
  if (pa.pre === pb.pre) return 0
  if (pa.pre === null) return 1
  if (pb.pre === null) return -1
  return pa.pre < pb.pre ? -1 : pa.pre > pb.pre ? 1 : 0
}

/** Bump when the sync logic changes; surfaced through status for diagnostics. */
export const CODE_VERSION = 3

export class SyncEngine {
  /**
   * @param {import('@deepseek-ai/cordis').Context} ctx - host plugin context.
   * @param {() => Record<string, unknown>} getConfig - current plugin config.
   * @param {string[]} nodeModulesCandidates - candidate node_modules roots that
   *   may hold sibling installed plugins, most reliable first.
   */
  constructor(ctx, getConfig, nodeModulesCandidates) {
    this.ctx = ctx
    this.getConfig = getConfig
    this.nodeModulesCandidates = Array.isArray(nodeModulesCandidates) ? nodeModulesCandidates.filter(Boolean) : []
    this.state = {
      phase: 'idle',
      lastSyncAt: null,
      lastError: null,
      lastResult: null,
      remoteCount: null,
    }
  }

  #config() {
    return this.getConfig() ?? {}
  }

  #deviceName() {
    return String(this.#config().deviceName ?? '').trim() || os.hostname()
  }

  #backupDir() {
    return String(this.#config().backupDir ?? '').trim() || DEFAULT_BACKUP_DIR
  }

  #excluded() {
    const list = this.#config().excludedPlugins
    return Array.isArray(list) ? list.map(item => String(item)) : []
  }

  #isExcluded(name) {
    // The sync plugin itself is always excluded to avoid reinstall loops.
    return name === SELF_NAME || this.#excluded().includes(name)
  }

  #dav() {
    const config = this.#config()
    return new WebDavClient({ baseUrl: config.webdavUrl, username: config.username, password: config.password })
  }

  get syncing() {
    return this.state.phase === 'syncing'
  }

  snapshot() {
    return {
      configured: String(this.#config().webdavUrl ?? '').trim().length > 0,
      phase: this.state.phase,
      lastSyncAt: this.state.lastSyncAt,
      lastError: this.state.lastError,
      lastResult: this.state.lastResult,
      strategy: this.#config().strategy === 'overwrite' ? 'overwrite' : 'merge',
      backupDir: this.#backupDir(),
      deviceName: this.#deviceName(),
      excluded: [SELF_NAME, ...this.#excluded().filter(name => name !== SELF_NAME)],
      remoteCount: this.state.remoteCount,
      searchRoots: this.nodeModulesCandidates,
      codeVersion: CODE_VERSION,
    }
  }

  async testConnection() {
    const dav = this.#dav()
    await dav.verify()
    await dav.ensureCollection([this.#backupDir()])
    await dav.ensureCollection([this.#backupDir(), 'packages'])
    return { message: '连接成功' }
  }

  async listLocalBundles() {
    const pluginManager = this.ctx.get('pluginManager')
    if (pluginManager === undefined) throw new Error('pluginManager 服务不可用')
    const bundles = await pluginManager.listBundles()
    return bundles
      .filter(bundle => bundle.installed === true)
      .map(bundle => ({
        name: bundle.name,
        version: bundle.version ?? '0.0.0',
        enabled: bundle.enabled === true,
        title: titleOf(bundle.meta) ?? bundle.description ?? bundle.name,
        self: bundle.name === SELF_NAME,
      }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }

  async listPlugins() {
    return { plugins: await this.listLocalBundles(), excluded: this.#excluded() }
  }

  #packBuffer(name) {
    // The plugin may physically live in the profile's node_modules (GitHub /
    // registry install) or in a linked workspace checkout during development;
    // probe every candidate root instead of assuming one location.
    const tried = []
    for (const base of this.nodeModulesCandidates) {
      const dir = path.join(base, name)
      try {
        if (!statSync(dir).isDirectory()) {
          tried.push(`${dir} (not a directory)`)
          continue
        }
        const data = packDirectory(dir)
        return { data, size: data.length, sha256: createHash('sha256').update(data).digest('hex') }
      } catch (error) {
        tried.push(`${dir} (${error?.code ?? error?.message ?? 'unknown'})`)
      }
    }
    throw new Error(`在本机未找到插件目录 ${name}；已尝试 ${tried.join(' , ') || '(无候选目录)'}`)
  }

  #begin(direction) {
    if (this.state.phase === 'syncing') throw new Error('已有同步任务正在进行，请稍后再试')
    this.state.phase = 'syncing'
    this.state.lastError = null
    this.state.lastResult = { direction, pushed: 0, pulled: 0, skipped: 0, failed: 0, details: [] }
    return this.state.lastResult
  }

  #settle(error) {
    this.state.lastSyncAt = new Date().toISOString()
    if (error !== undefined) {
      this.state.phase = 'error'
      this.state.lastError = error
    } else {
      this.state.phase = 'ok'
      this.state.lastError = null
    }
  }

  async #runExclusive(task) {
    try {
      return await task()
    } catch (error) {
      this.#settle(error instanceof Error ? error.message : String(error))
      throw error
    }
  }

  async #readRemoteManifest(dav) {
    const manifest = await dav.getJson([this.#backupDir(), 'manifest.json'])
    if (manifest === null) return { version: MANIFEST_VERSION, plugins: {} }
    if (typeof manifest !== 'object' || manifest === null || typeof manifest.plugins !== 'object' || manifest.plugins === null) {
      throw new Error('远端清单格式不正确')
    }
    return manifest
  }

  async #writeRemoteManifest(dav, manifest) {
    manifest.version = MANIFEST_VERSION
    manifest.updatedAt = new Date().toISOString()
    manifest.updatedBy = this.#deviceName()
    await dav.putText([this.#backupDir(), 'manifest.json'], JSON.stringify(manifest, null, 2))
  }

  async #ensureRemoteLayout(dav) {
    await dav.ensureCollection([this.#backupDir()])
    await dav.ensureCollection([this.#backupDir(), 'packages'])
  }

  async #pushInner(result, dav) {
    await this.#ensureRemoteLayout(dav)
    const manifest = await this.#readRemoteManifest(dav)
    const bundles = await this.listLocalBundles()
    for (const bundle of bundles) {
      if (this.#isExcluded(bundle.name)) continue
      const detail = { name: bundle.name, action: 'uploaded' }
      try {
        const packed = this.#packBuffer(bundle.name)
        const fileName = davFileName(bundle.name, bundle.version)
        await dav.putBuffer([this.#backupDir(), 'packages', fileName], packed.data)
        manifest.plugins[bundle.name] = {
          version: bundle.version,
          file: fileName,
          sha256: packed.sha256,
          size: packed.size,
          updatedAt: new Date().toISOString(),
          device: this.#deviceName(),
        }
        result.pushed += 1
      } catch (error) {
        detail.action = 'failed'
        detail.message = error instanceof Error ? error.message : String(error)
        result.failed += 1
      }
      result.details.push(detail)
    }
    await this.#writeRemoteManifest(dav, manifest)
    this.state.remoteCount = Object.keys(manifest.plugins).length
  }

  async #installFromRemote(dav, name, entry, local) {
    const remoteVersion = String(entry?.version ?? '')
    if (remoteVersion.length === 0) throw new Error('远端清单缺少版本号')
    const fileName = String(entry?.file ?? '') || davFileName(name, remoteVersion)
    const data = await dav.getBuffer([this.#backupDir(), 'packages', fileName])
    if (data === null) throw new Error('远端包文件不存在')
    const pluginManager = this.ctx.get('pluginManager')
    if (pluginManager === undefined) throw new Error('pluginManager 服务不可用')
    const tmpDir = path.join(os.tmpdir(), `dsh-webdav-sync-${randomUUID()}`)
    await fs.mkdir(tmpDir, { recursive: true })
    const tgzPath = path.join(tmpDir, davFileName(name, remoteVersion))
    await fs.writeFile(tgzPath, data)
    try {
      if (local !== undefined) {
        const removal = await pluginManager.removeBundle(name).catch(error => ({
          application: 'failed',
          error: { diagnostic: error instanceof Error ? error.message : String(error) },
        }))
        if (removal.application !== 'applied') {
          throw new Error(`卸载本地旧版本失败: ${removal?.error?.diagnostic ?? removal?.application ?? '未知原因'}`)
        }
      }
      const install = await pluginManager.installBundle(tgzPath, { enabled: local === undefined ? true : local.enabled }).catch(error => ({
        application: 'failed',
        error: { diagnostic: error instanceof Error ? error.message : String(error) },
      }))
      if (install.application !== 'applied') {
        throw new Error(`安装失败: ${install?.error?.diagnostic ?? install?.application ?? '未知原因'}`)
      }
    } finally {
      void fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {})
    }
  }

  async #pullInner(result, dav) {
    const manifest = await this.#readRemoteManifest(dav)
    this.state.remoteCount = Object.keys(manifest.plugins).length
    const strategy = this.#config().strategy === 'overwrite' ? 'overwrite' : 'merge'
    const locals = new Map((await this.listLocalBundles()).map(bundle => [bundle.name, bundle]))
    for (const [name, entry] of Object.entries(manifest.plugins)) {
      if (this.#isExcluded(name)) continue
      const detail = { name, action: 'skipped' }
      try {
        const local = locals.get(name)
        const remoteVersion = String(entry?.version ?? '')
        let shouldInstall
        if (local === undefined) {
          shouldInstall = true
          detail.action = 'installed'
        } else {
          const comparison = compareVersions(remoteVersion, local.version)
          shouldInstall = strategy === 'overwrite' ? comparison !== 0 : comparison > 0
          if (shouldInstall) detail.action = 'updated'
        }
        if (!shouldInstall) {
          result.skipped += 1
          result.details.push(detail)
          continue
        }
        await this.#installFromRemote(dav, name, entry, local)
        result.pulled += 1
      } catch (error) {
        detail.action = 'failed'
        detail.message = error instanceof Error ? error.message : String(error)
        result.failed += 1
      }
      result.details.push(detail)
    }
  }

  /** Upload local plugins to WebDAV. */
  async push() {
    return this.#runExclusive(async () => {
      const result = this.#begin('push')
      await this.#pushInner(result, this.#dav())
      this.#settle()
      return { pushed: result.pushed, failed: result.failed }
    })
  }

  /** Download and install remote plugins per the configured strategy. */
  async pull() {
    return this.#runExclusive(async () => {
      const result = this.#begin('pull')
      await this.#pullInner(result, this.#dav())
      this.#settle()
      return { pulled: result.pulled, skipped: result.skipped, failed: result.failed }
    })
  }

  /** Run a sync in the background; poll snapshot() for progress. */
  async sync(direction = 'both') {
    const dir = direction === 'push' ? 'push' : direction === 'pull' ? 'pull' : 'both'
    const result = this.#begin(dir)
    const dav = this.#dav()
    void this.#runExclusive(async () => {
      if (dir !== 'push') await this.#pullInner(result, dav)
      if (dir !== 'pull') await this.#pushInner(result, dav)
      this.#settle()
      return result
    }).catch(() => {})
    return { started: true, direction: dir }
  }
}
