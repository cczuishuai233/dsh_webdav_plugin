/**
 * WebDAV plugin sync for DSH: keep installed plugins aligned across devices.
 *
 * Host half: declares the Config schema, owns the sync engine, and serves a
 * small JSON API at POST /api/webdav-sync for the Client configuration panel.
 */

import path from 'node:path'
import { fileURLToPath } from 'node:url'
import Schema from '@deepseek-ai/schemastery'
import { SyncEngine, SELF_NAME, DEFAULT_BACKUP_DIR } from './src/host/engine.js'

export const inject = ['connection']

export const Config = Schema.object({
  webdavUrl: Schema.string().default('')
    .description('WebDAV 服务器地址，例如 https://dav.example.com/dav/'),
  username: Schema.string().default('')
    .description('WebDAV 用户名'),
  password: Schema.string().default('')
    .description('WebDAV 密码'),
  backupDir: Schema.string().default(DEFAULT_BACKUP_DIR)
    .description('远端备份目录名，默认 dsh-plugin-sync'),
  strategy: Schema.union([Schema.const('merge'), Schema.const('overwrite')]).default('merge')
    .description('同步策略：merge 按版本取较新端，overwrite 以远端为准'),
  excludedPlugins: Schema.array(Schema.string()).default([SELF_NAME])
    .description('排除同步的插件包名，本插件自身始终排除'),
  deviceName: Schema.string().default('')
    .description('本机设备名标识，留空自动取主机名'),
})

export function apply(ctx, config) {
  const here = path.dirname(fileURLToPath(import.meta.url))
  const marker = `${path.sep}node_modules${path.sep}`
  const markerIndex = here.lastIndexOf(marker)
  const derived = markerIndex >= 0 ? here.slice(0, markerIndex + marker.length) : undefined

  // Where sibling installed plugins live: the profile's node_modules is the
  // authoritative home (DSH exposes it via DSH_PROFILE_DIR); the directory
  // this package is physically loaded from covers linked development setups.
  const candidates = []
  const profileDir = process.env.DSH_PROFILE_DIR
  if (typeof profileDir === 'string' && profileDir.length > 0) candidates.push(path.join(profileDir, 'node_modules'))
  if (derived !== undefined) candidates.push(derived)
  candidates.push(path.resolve(here, '..'))
  const nodeModulesCandidates = [...new Set(candidates)]

  const engine = new SyncEngine(ctx, () => config, nodeModulesCandidates)

  const json = (data, status = 200) => new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  })

  const sanitizedConfig = () => ({
    webdavUrl: String(config.webdavUrl ?? ''),
    username: String(config.username ?? ''),
    hasPassword: String(config.password ?? '').length > 0,
    backupDir: String(config.backupDir ?? '').trim() || DEFAULT_BACKUP_DIR,
    strategy: config.strategy === 'overwrite' ? 'overwrite' : 'merge',
    excludedPlugins: Array.isArray(config.excludedPlugins) ? config.excludedPlugins : [SELF_NAME],
    deviceName: String(config.deviceName ?? ''),
  })

  async function saveConfig(patch) {
    const raw = patch !== null && typeof patch === 'object' ? patch : {}
    const clean = {}
    for (const key of ['webdavUrl', 'username', 'deviceName']) {
      if (key in raw) clean[key] = String(raw[key] ?? '').trim()
    }
    if ('backupDir' in raw) {
      const backupDir = String(raw.backupDir ?? '').trim()
      if (backupDir.length > 0) clean.backupDir = backupDir
    }
    if ('password' in raw && raw.password !== '' && raw.password !== null && raw.password !== undefined) {
      clean.password = String(raw.password)
    }
    if (Array.isArray(raw.excludedPlugins)) {
      clean.excludedPlugins = [...new Set(
        raw.excludedPlugins.map(value => String(value).trim()).filter(value => value.length > 0),
      )]
    }

    const entry = ctx.fiber?.entry
    const editor = ctx.get('configEditor')
    if (entry === undefined || editor === undefined) throw new Error('当前环境无法保存配置')
    await editor.edit(entry, current => ({ ...current, ...clean }))

    const preview = sanitizedConfig()
    for (const key of ['webdavUrl', 'username', 'backupDir', 'deviceName']) {
      if (key in clean) preview[key] = clean[key]
    }
    if ('password' in clean) preview.hasPassword = true
    if (Array.isArray(clean.excludedPlugins)) preview.excludedPlugins = clean.excludedPlugins
    return { config: preview }
  }

  async function handleRpc(request) {
    let body
    try {
      body = await request.json()
    } catch {
      return json({ ok: false, error: '请求体不是合法 JSON' }, 400)
    }
    const op = body?.op
    try {
      let data
      switch (op) {
        case 'status': data = engine.snapshot(); break
        case 'test': data = await engine.testConnection(); break
        case 'listPlugins': data = await engine.listPlugins(); break
        case 'getConfig': data = { config: sanitizedConfig() }; break
        case 'saveConfig': data = await saveConfig(body.patch); break
        case 'sync': data = await engine.sync(body?.direction); break
        default: return json({ ok: false, error: `未知操作: ${String(op)}` }, 400)
      }
      return json({ ok: true, data })
    } catch (error) {
      return json({ ok: false, error: error instanceof Error ? error.message : String(error) })
    }
  }

  ctx.effect(
    () => ctx.connection.fetch.register({
      path: '/api/webdav-sync',
      methods: ['POST'],
      fetch: request => handleRpc(request),
    }),
    'webdav-sync: api route',
  )
}
