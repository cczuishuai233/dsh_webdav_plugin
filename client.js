/**
 * WebDAV plugin sync — Client half.
 * Renders a compact sync status panel on the bundle's Plugins page
 * (slot `plugins.bundle.config`, keyed by this package name) and talks to the
 * Host half over POST /api/webdav-sync.
 */
window.__ModuleLoader__.load({
  id: '@local/dsh-webdav-sync',
  factory(require) {
    const React = require('react')
    const { useState, useEffect, useRef } = React
    const h = React.createElement

    const NS = 'webdavSync'
    const SELF_NAME = '@local/dsh-webdav-sync'

    const DICTS = {
      zh: {
        'summary.loading': '同步状态加载中…',
        'summary.unconfigured': '未配置 WebDAV 同步',
        'summary.syncing': '正在同步…',
        'summary.ok': '同步正常 · 上次 {time}',
        'summary.error': '同步失败 · {time}',
        'summary.idle': '同步就绪',
        'status.title': '同步状态',
        'status.unconfigured': '尚未配置 WebDAV。填写下方服务器地址并保存后，即可在多台 DSH 之间同步插件。',
        'status.lastSync': '上次同步：{time}',
        'status.never': '从未同步',
        'status.device': '设备：{name}',
        'status.strategy': '策略：{value}',
        'status.backupDir': '目录：{value}',
        'status.remoteCount': '远端插件：{n}',
        'status.lastError': '错误：{message}',
        'action.sync': '立即同步',
        'action.push': '仅上传',
        'action.pull': '仅下载',
        'action.test': '测试连接',
        'action.syncing': '同步中…',
        'sync.started': '同步任务已开始',
        'test.ok': '连接成功',
        'result.title': '最近一次同步',
        'result.none': '暂无同步记录',
        'result.pushed': '上传 {n}',
        'result.pulled': '安装 {n}',
        'result.skipped': '跳过 {n}',
        'result.failed': '失败 {n}',
        'result.showDetails': '展开明细',
        'result.hideDetails': '收起明细',
        'config.heading': '同步设置',
        'config.url': 'WebDAV 地址',
        'config.urlPlaceholder': 'https://dav.example.com/dav/',
        'config.username': '用户名',
        'config.password': '密码',
        'config.passwordSaved': '已保存（留空则不修改）',
        'config.backupDir': '备份目录',
        'config.backupDirPlaceholder': 'dsh-plugin-sync',
        'config.backupDirHint': '远端根目录下的文件夹名，留空使用默认目录 dsh-plugin-sync。',
        'config.strategy': '同步策略',
        'config.strategyMerge': '合并（推荐）',
        'config.strategyMergeDesc': '按版本号比较，仅安装远端较新的插件。',
        'config.strategyOverwrite': '覆盖',
        'config.strategyOverwriteDesc': '以远端为准，版本不同即卸载本地旧版并安装远端包。',
        'config.excluded': '排除插件',
        'config.excludedHint': '勾选后这些插件不参与同步。本插件自身始终排除。',
        'config.excludedCount': '已排除 {n} 个插件',
        'config.excludedNone': '未排除其他插件',
        'config.alwaysExcluded': '始终排除',
        'config.deviceName': '设备名（可选）',
        'config.deviceNamePlaceholder': '留空自动使用主机名',
        'config.save': '保存设置',
        'config.saving': '保存中…',
        'config.saved': '已保存',
        'config.savedReloaded': '已保存，同步服务已应用新配置',
        'action.needConfig': '请先填写 WebDAV 地址并保存',
        'action.uploaded': '已上传',
        'action.installed': '已安装',
        'action.updated': '已更新',
        'action.skipped': '已跳过',
        'action.failed': '失败',
        'load.failed': '加载失败',
        'load.retry': '重试',
        'error.prefix': '操作失败：',
        'time.justNow': '刚刚',
        'time.minutes': '{n} 分钟前',
        'time.hours': '{n} 小时前',
        'time.days': '{n} 天前',
      },
      en: {
        'summary.loading': 'Loading sync status…',
        'summary.unconfigured': 'WebDAV sync not configured',
        'summary.syncing': 'Syncing…',
        'summary.ok': 'Sync healthy · last {time}',
        'summary.error': 'Sync failed · {time}',
        'summary.idle': 'Ready to sync',
        'status.title': 'Sync status',
        'status.unconfigured': 'WebDAV is not configured yet. Fill in the server address below and save to sync plugins across devices.',
        'status.lastSync': 'Last sync: {time}',
        'status.never': 'Never synced',
        'status.device': 'Device: {name}',
        'status.strategy': 'Strategy: {value}',
        'status.backupDir': 'Folder: {value}',
        'status.remoteCount': 'Remote plugins: {n}',
        'status.lastError': 'Error: {message}',
        'action.sync': 'Sync now',
        'action.push': 'Upload only',
        'action.pull': 'Download only',
        'action.test': 'Test connection',
        'action.syncing': 'Syncing…',
        'sync.started': 'Sync started',
        'test.ok': 'Connection OK',
        'result.title': 'Last sync result',
        'result.none': 'No sync record yet',
        'result.pushed': '{n} uploaded',
        'result.pulled': '{n} installed',
        'result.skipped': '{n} skipped',
        'result.failed': '{n} failed',
        'result.showDetails': 'Show details',
        'result.hideDetails': 'Hide details',
        'config.heading': 'Sync settings',
        'config.url': 'WebDAV URL',
        'config.urlPlaceholder': 'https://dav.example.com/dav/',
        'config.username': 'Username',
        'config.password': 'Password',
        'config.passwordSaved': 'Saved (leave empty to keep)',
        'config.backupDir': 'Backup folder',
        'config.backupDirPlaceholder': 'dsh-plugin-sync',
        'config.backupDirHint': 'Folder name under the WebDAV root; empty uses the default dsh-plugin-sync.',
        'config.strategy': 'Sync strategy',
        'config.strategyMerge': 'Merge (recommended)',
        'config.strategyMergeDesc': 'Compare versions and install only newer remote plugins.',
        'config.strategyOverwrite': 'Overwrite',
        'config.strategyOverwriteDesc': 'Remote wins: reinstall the remote package whenever versions differ.',
        'config.excluded': 'Excluded plugins',
        'config.excludedHint': 'Checked plugins are not synced. This plugin itself is always excluded.',
        'config.excludedCount': '{n} plugins excluded',
        'config.excludedNone': 'No extra exclusions',
        'config.alwaysExcluded': 'always excluded',
        'config.deviceName': 'Device name (optional)',
        'config.deviceNamePlaceholder': 'Defaults to the hostname',
        'config.save': 'Save settings',
        'config.saving': 'Saving…',
        'config.saved': 'Saved',
        'config.savedReloaded': 'Saved; the sync service reloaded with the new settings',
        'action.needConfig': 'Configure the WebDAV URL first and save',
        'action.uploaded': 'uploaded',
        'action.installed': 'installed',
        'action.updated': 'updated',
        'action.skipped': 'skipped',
        'action.failed': 'failed',
        'load.failed': 'Load failed',
        'load.retry': 'Retry',
        'error.prefix': 'Operation failed: ',
        'time.justNow': 'just now',
        'time.minutes': '{n} min ago',
        'time.hours': '{n} h ago',
        'time.days': '{n} d ago',
      },
    }

    const CSS = `
.wdvs-panel{display:flex;flex-direction:column;gap:14px;font-size:13px;line-height:1.5;color:var(--dsw-alias-label-primary)}
.wdvs-summary{display:flex;align-items:center;gap:6px;font-size:12px;color:var(--dsw-alias-label-secondary)}
.wdvs-card{background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l1);border-radius:10px;padding:14px 16px}
.wdvs-status-row{display:flex;align-items:center;gap:10px}
.wdvs-dot{width:9px;height:9px;border-radius:50%;flex:none}
.wdvs-dot-idle{background:var(--dsw-alias-state-idle-primary)}
.wdvs-dot-syncing{background:var(--dsw-alias-brand-primary);animation:wdvs-pulse 1.2s ease-in-out infinite}
.wdvs-dot-ok{background:var(--dsw-alias-state-success-primary)}
.wdvs-dot-error{background:var(--dsw-alias-state-error-primary)}
@keyframes wdvs-pulse{0%,100%{opacity:1}50%{opacity:.35}}
.wdvs-progress{height:2px;border-radius:1px;background:var(--dsw-alias-border-l1);overflow:hidden;margin-top:10px}
.wdvs-progress::after{content:'';display:block;height:100%;width:40%;background:var(--dsw-alias-brand-primary);border-radius:1px;animation:wdvs-slide 1.2s linear infinite}
@keyframes wdvs-slide{from{transform:translateX(-100%)}to{transform:translateX(350%)}}
.wdvs-meta{margin-top:6px;font-size:12px;color:var(--dsw-alias-label-secondary);display:flex;flex-wrap:wrap;gap:4px 14px}
.wdvs-actions{display:flex;gap:8px;flex-wrap:wrap}
.wdvs-btn{appearance:none;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);border-radius:8px;padding:6px 14px;font-size:13px;cursor:pointer;transition:background .15s,filter .15s}
.wdvs-btn:hover:not(:disabled){background:var(--dsw-alias-bg-layer-2)}
.wdvs-btn:disabled{opacity:.5;cursor:not-allowed}
.wdvs-btn-primary{background:var(--dsw-alias-brand-primary);border-color:var(--dsw-alias-brand-primary);color:#fff}
.wdvs-btn-primary:hover:not(:disabled){filter:brightness(1.08);background:var(--dsw-alias-brand-primary)}
.wdvs-section-title{font-size:13px;font-weight:600;margin:0 0 10px}
.wdvs-field{display:flex;flex-direction:column;gap:5px;margin-bottom:12px}
.wdvs-label{font-size:12px;color:var(--dsw-alias-label-secondary)}
.wdvs-input{appearance:none;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);border-radius:8px;padding:7px 10px;font-size:13px;width:100%;box-sizing:border-box}
.wdvs-input:focus{outline:none;border-color:var(--dsw-alias-brand-primary)}
.wdvs-input::placeholder{color:var(--dsw-alias-label-secondary);opacity:.7}
.wdvs-hint{font-size:11px;color:var(--dsw-alias-label-secondary)}
.wdvs-strategies{display:flex;gap:8px}
.wdvs-strategy{flex:1;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;padding:10px 12px;cursor:pointer;display:flex;flex-direction:column;gap:3px;background:var(--dsw-alias-bg-base);text-align:left}
.wdvs-strategy-active{border-color:var(--dsw-alias-brand-primary);box-shadow:0 0 0 1px var(--dsw-alias-brand-primary) inset}
.wdvs-strategy-title{font-size:13px;font-weight:600;color:var(--dsw-alias-label-primary)}
.wdvs-strategy-desc{font-size:11px;color:var(--dsw-alias-label-secondary)}
.wdvs-picker{position:relative}
.wdvs-tags{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}
.wdvs-tag{display:inline-flex;align-items:center;gap:4px;background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-border-l1);border-radius:6px;padding:2px 8px;font-size:11px;font-family:ui-monospace,SFMono-Regular,monospace;color:var(--dsw-alias-label-primary)}
.wdvs-tag-x{border:none;background:none;color:var(--dsw-alias-label-secondary);cursor:pointer;font-size:13px;padding:0 2px;line-height:1}
.wdvs-tag-x:hover{color:var(--dsw-alias-state-error-primary)}
.wdvs-picker-panel{position:absolute;z-index:30;top:calc(100% + 6px);left:0;right:0;background:var(--dsw-alias-bg-overlay);border:1px solid var(--dsw-alias-border-l2);border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,.18);padding:6px;max-height:260px;overflow:auto}
.wdvs-check{display:flex;align-items:center;gap:8px;padding:7px 8px;border-radius:6px;cursor:pointer;font-size:12px;color:var(--dsw-alias-label-primary)}
.wdvs-check:hover{background:var(--dsw-alias-bg-layer-2)}
.wdvs-check-disabled{opacity:.65;cursor:not-allowed}
.wdvs-toast{border-radius:8px;padding:8px 12px;font-size:12px;border:1px solid}
.wdvs-toast-ok{border-color:var(--dsw-alias-state-success-primary);color:var(--dsw-alias-state-success-primary);background:var(--dsw-alias-bg-layer-1)}
.wdvs-toast-error{border-color:var(--dsw-alias-state-error-primary);color:var(--dsw-alias-state-error-primary);background:var(--dsw-alias-bg-layer-1)}
.wdvs-result-stats{display:flex;gap:16px;font-size:12px;color:var(--dsw-alias-label-secondary);margin-top:8px;flex-wrap:wrap}
.wdvs-result-details{margin-top:8px;border-top:1px solid var(--dsw-alias-border-l1);padding-top:8px;display:flex;flex-direction:column;gap:4px;font-size:12px}
.wdvs-detail-row{display:flex;gap:8px;align-items:baseline;flex-wrap:wrap}
.wdvs-detail-name{font-family:ui-monospace,SFMono-Regular,monospace;font-size:11px;color:var(--dsw-alias-label-primary)}
.wdvs-detail-action{font-size:11px;color:var(--dsw-alias-label-secondary)}
.wdvs-detail-msg{color:var(--dsw-alias-state-error-primary);font-size:11px}
.wdvs-linklike{border:none;background:none;padding:0;color:var(--dsw-alias-brand-primary);cursor:pointer;font-size:12px}
`

    async function callApi(op, params) {
      const url = new URL('/api/webdav-sync', document.baseURI)
      const carrier = globalThis.__DSH_TRANSPORT__ && globalThis.__DSH_TRANSPORT__.fetch
      const doFetch = carrier || fetch
      const response = await doFetch(carrier ? url.href : url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(Object.assign({ op }, params || {})),
      })
      let json
      try {
        json = await response.json()
      } catch {
        throw new Error(`HTTP ${response.status}: 响应不是 JSON`)
      }
      if (!json || json.ok !== true) throw new Error((json && json.error) || `HTTP ${response.status}`)
      return json.data
    }

    function formatTime(iso, t) {
      if (!iso) return null
      const date = new Date(iso)
      if (Number.isNaN(date.getTime())) return null
      const seconds = Math.floor((Date.now() - date.getTime()) / 1000)
      if (seconds < 60) return t('time.justNow')
      const minutes = Math.floor(seconds / 60)
      if (minutes < 60) return t('time.minutes').replace('{n}', String(minutes))
      const hours = Math.floor(minutes / 60)
      if (hours < 24) return t('time.hours').replace('{n}', String(hours))
      const days = Math.floor(hours / 24)
      if (days < 7) return t('time.days').replace('{n}', String(days))
      return date.toLocaleString()
    }

    function makeTranslator(propsT) {
      const lang = (navigator.language || 'en').toLowerCase().startsWith('zh') ? 'zh' : 'en'
      const lookup = key => {
        let node = DICTS[lang]
        for (const part of key.split('.')) {
          if (node === undefined || node === null) return undefined
          node = node[part]
        }
        return typeof node === 'string' ? node : undefined
      }
      return (key, vars) => {
        let text
        try {
          const value = propsT ? propsT(key) : undefined
          if (typeof value === 'string' && value.length > 0 && value !== key) text = value
        } catch {}
        if (text === undefined) text = lookup(key)
        if (text === undefined) text = key
        if (vars !== undefined && typeof text === 'string') {
          for (const [name, value] of Object.entries(vars)) text = text.replaceAll(`{${name}}`, String(value))
        }
        return text
      }
    }

    function StatusDot({ phase }) {
      const cls = ['wdvs-dot', `wdvs-dot-${phase === 'syncing' ? 'syncing' : phase === 'ok' ? 'ok' : phase === 'error' ? 'error' : 'idle'}`].join(' ')
      return h('span', { className: cls })
    }

    function Summary({ t: propsT }) {
      const t = makeTranslator(propsT)
      const [status, setStatus] = useState(undefined)
      useEffect(() => {
        let alive = true
        const tick = () => callApi('status').then(data => { if (alive) setStatus(data) }).catch(() => {})
        tick()
        const id = setInterval(tick, 5000)
        return () => { alive = false; clearInterval(id) }
      }, [])
      let text = t('summary.loading')
      if (status !== undefined) {
        if (!status.configured) text = t('summary.unconfigured')
        else if (status.phase === 'syncing') text = t('summary.syncing')
        else if (status.phase === 'error') text = t('summary.error').replace('{time}', formatTime(status.lastSyncAt, t) ?? '')
        else if (status.phase === 'ok') text = t('summary.ok').replace('{time}', formatTime(status.lastSyncAt, t) ?? '')
        else text = t('summary.idle')
      }
      const phase = status === undefined ? 'idle' : !status.configured ? 'idle' : status.phase
      return h('div', { className: 'wdvs-summary' }, h(StatusDot, { phase }), h('span', null, text))
    }

    function Toast({ toast, onDone }) {
      useEffect(() => {
        const id = setTimeout(onDone, 4000)
        return () => clearTimeout(id)
      }, [toast])
      if (toast === null) return null
      return h('div', { className: `wdvs-toast wdvs-toast-${toast.kind}`, role: 'status' }, toast.text)
    }

    function StatusCard({ t, status }) {
      if (status === null) return null
      const lastSync = formatTime(status.lastSyncAt, t)
      const strategyText = status.strategy === 'overwrite' ? t('config.strategyOverwrite') : t('config.strategyMerge')
      const phase = !status.configured ? 'idle' : status.phase
      let headline
      if (!status.configured) headline = t('summary.unconfigured')
      else if (phase === 'syncing') headline = t('summary.syncing')
      else if (phase === 'error') headline = t('summary.error').replace('{time}', lastSync ?? '')
      else if (phase === 'ok') headline = t('summary.ok').replace('{time}', lastSync ?? '')
      else headline = t('summary.idle')
      const meta = []
      if (status.configured) {
        meta.push(t('status.lastSync').replace('{time}', lastSync ?? t('status.never')))
        meta.push(t('status.device').replace('{name}', status.deviceName ?? ''))
        meta.push(t('status.strategy').replace('{value}', strategyText))
        meta.push(t('status.backupDir').replace('{value}', status.backupDir ?? ''))
        if (typeof status.remoteCount === 'number') meta.push(t('status.remoteCount').replace('{n}', String(status.remoteCount)))
      }
      return h('div', { className: 'wdvs-card' },
        h('div', { className: 'wdvs-status-row' }, h(StatusDot, { phase }), h('strong', null, headline)),
        !status.configured && h('div', { className: 'wdvs-meta' }, t('status.unconfigured')),
        phase === 'error' && status.lastError && h('div', { className: 'wdvs-meta' },
          h('span', { style: { color: 'var(--dsw-alias-state-error-primary)' } }, t('status.lastError').replace('{message}', status.lastError))),
        h('div', { className: 'wdvs-meta' }, ...meta.map((item, index) => h('span', { key: index }, item))),
        phase === 'syncing' && h('div', { className: 'wdvs-progress' }))
    }

    function ResultCard({ t, result }) {
      const [open, setOpen] = useState(false)
      if (result === null || result === undefined) {
        return h('div', { className: 'wdvs-card' },
          h('div', { className: 'wdvs-section-title' }, t('result.title')),
          h('div', { className: 'wdvs-hint' }, t('result.none')))
      }
      const details = Array.isArray(result.details) ? result.details : []
      return h('div', { className: 'wdvs-card' },
        h('div', { className: 'wdvs-section-title' }, t('result.title')),
        h('div', { className: 'wdvs-result-stats' },
          h('span', null, t('result.pushed').replace('{n}', String(result.pushed ?? 0))),
          h('span', null, t('result.pulled').replace('{n}', String(result.pulled ?? 0))),
          h('span', null, t('result.skipped').replace('{n}', String(result.skipped ?? 0))),
          h('span', { style: (result.failed ?? 0) > 0 ? { color: 'var(--dsw-alias-state-error-primary)' } : undefined },
            t('result.failed').replace('{n}', String(result.failed ?? 0)))),
        details.length > 0 && h('button', { type: 'button', className: 'wdvs-linklike', onClick: () => setOpen(!open) },
          open ? t('result.hideDetails') : t('result.showDetails')),
        open && details.length > 0 && h('div', { className: 'wdvs-result-details' },
          ...details.map((detail, index) => h('div', { key: index, className: 'wdvs-detail-row' },
            h('span', { className: 'wdvs-detail-name' }, detail.name),
            h('span', { className: 'wdvs-detail-action' }, t(`action.${detail.action}`)),
            detail.message && h('span', { className: 'wdvs-detail-msg' }, detail.message)))))
    }

    function StrategyPicker({ t, value, onChange }) {
      const options = [
        { key: 'merge', title: t('config.strategyMerge'), desc: t('config.strategyMergeDesc') },
        { key: 'overwrite', title: t('config.strategyOverwrite'), desc: t('config.strategyOverwriteDesc') },
      ]
      return h('div', { className: 'wdvs-strategies' },
        ...options.map(option => h('button', {
          key: option.key,
          type: 'button',
          className: option.key === value ? 'wdvs-strategy wdvs-strategy-active' : 'wdvs-strategy',
          onClick: () => onChange(option.key),
        }, h('span', { className: 'wdvs-strategy-title' }, option.title),
          h('span', { className: 'wdvs-strategy-desc' }, option.desc))))
    }

    function ExclusionPicker({ t, plugins, excluded, onChange }) {
      const [open, setOpen] = useState(false)
      const rootRef = useRef(null)
      useEffect(() => {
        if (!open) return undefined
        const onDocMouseDown = event => {
          if (rootRef.current && !rootRef.current.contains(event.target)) setOpen(false)
        }
        const onKeyDown = event => {
          if (event.key === 'Escape') setOpen(false)
        }
        document.addEventListener('mousedown', onDocMouseDown)
        document.addEventListener('keydown', onKeyDown)
        return () => {
          document.removeEventListener('mousedown', onDocMouseDown)
          document.removeEventListener('keydown', onKeyDown)
        }
      }, [open])
      const options = plugins.filter(plugin => plugin.name !== SELF_NAME)
      const toggle = name => onChange(excluded.includes(name) ? excluded.filter(item => item !== name) : [...excluded, name])
      return h('div', { className: 'wdvs-picker', ref: rootRef },
        h('button', {
          type: 'button',
          className: 'wdvs-input',
          style: { textAlign: 'left', cursor: 'pointer' },
          'aria-haspopup': 'listbox',
          'aria-expanded': open,
          onClick: () => setOpen(!open),
        }, t('config.excludedCount').replace('{n}', String(excluded.length))),
        h('div', { className: 'wdvs-tags' },
          excluded.filter(name => name !== SELF_NAME).length === 0 && h('span', { className: 'wdvs-hint' }, t('config.excludedNone')),
          ...excluded.filter(name => name !== SELF_NAME).map(name => h('span', { key: name, className: 'wdvs-tag' }, name,
            h('button', { type: 'button', className: 'wdvs-tag-x', 'aria-label': name, onClick: () => toggle(name) }, '×')))),
        open && h('div', { className: 'wdvs-picker-panel' },
          h('label', { className: 'wdvs-check wdvs-check-disabled', key: SELF_NAME },
            h('input', { type: 'checkbox', checked: true, disabled: true, readOnly: true }),
            h('span', null, `${SELF_NAME} (${t('config.alwaysExcluded')})`)),
          ...options.map(plugin => h('label', { key: plugin.name, className: 'wdvs-check' },
            h('input', { type: 'checkbox', checked: excluded.includes(plugin.name), onChange: () => toggle(plugin.name) }),
            h('span', null, `${plugin.name} · v${plugin.version}${plugin.title && plugin.title !== plugin.name ? ` — ${plugin.title}` : ''}`)))))
    }

    function Field({ label, hint, children }) {
      return h('div', { className: 'wdvs-field' },
        h('span', { className: 'wdvs-label' }, label),
        children,
        hint && h('span', { className: 'wdvs-hint' }, hint))
    }

    function Panel({ t: propsT }) {
      const t = makeTranslator(propsT)
      const [config, setConfig] = useState(null)
      const [plugins, setPlugins] = useState([])
      const [excluded, setExcluded] = useState([])
      const [status, setStatus] = useState(null)
      const [password, setPassword] = useState('')
      const [toast, setToast] = useState(null)
      const [busy, setBusy] = useState(false)
      const [saving, setSaving] = useState(false)
      const [loadError, setLoadError] = useState(null)
      const [reloadKey, setReloadKey] = useState(0)

      useEffect(() => {
        let alive = true
        setLoadError(null)
        Promise.all([callApi('getConfig'), callApi('status'), callApi('listPlugins')])
          .then(([cfg, st, pl]) => {
            if (!alive) return
            setConfig(cfg.config)
            setExcluded(Array.isArray(cfg.config.excludedPlugins) ? cfg.config.excludedPlugins : [])
            setStatus(st)
            setPlugins(pl.plugins)
          })
          .catch(error => { if (alive) setLoadError(error instanceof Error ? error.message : String(error)) })
        return () => { alive = false }
      }, [reloadKey])

      useEffect(() => {
        const id = setInterval(() => callApi('status').then(data => setStatus(data)).catch(() => {}), 3000)
        return () => clearInterval(id)
      }, [])

      const updateField = (key, value) => setConfig(current => ({ ...current, [key]: value }))

      const runAction = async (op, params, successText) => {
        setBusy(true)
        try {
          await callApi(op, params)
          setToast({ kind: 'ok', text: successText })
        } catch (error) {
          setToast({ kind: 'error', text: t('error.prefix') + (error instanceof Error ? error.message : String(error)) })
        } finally {
          if (op === 'sync') {
            // The Host runs the sync in the background: keep the buttons held
            // until the polled status leaves `syncing` (see effect below).
            callApi('status').then(data => {
              setStatus(data)
              if (data.phase !== 'syncing') setBusy(false)
            }).catch(() => setBusy(false))
          } else {
            setBusy(false)
            callApi('status').then(data => setStatus(data)).catch(() => {})
          }
        }
      }

      // Releases the action buttons as soon as a background sync settles.
      useEffect(() => {
        if (status !== null && status.phase !== 'syncing') setBusy(false)
      }, [status])

      const save = async () => {
        if (config === null) return
        setSaving(true)
        try {
          const patch = {
            webdavUrl: config.webdavUrl ?? '',
            username: config.username ?? '',
            backupDir: config.backupDir ?? '',
            strategy: config.strategy ?? 'merge',
            excludedPlugins: excluded,
            deviceName: config.deviceName ?? '',
          }
          if (password.length > 0) patch.password = password
          const result = await callApi('saveConfig', { patch })
          setConfig(result.config)
          setExcluded(Array.isArray(result.config.excludedPlugins) ? result.config.excludedPlugins : [])
          setPassword('')
          setToast({ kind: 'ok', text: t('config.savedReloaded') })
          // Ordinary config fields restart the plugin; refresh so the status
          // card reflects the fresh instance instead of a stale snapshot.
          callApi('status').then(data => setStatus(data)).catch(() => {})
        } catch (error) {
          setToast({ kind: 'error', text: t('error.prefix') + (error instanceof Error ? error.message : String(error)) })
        } finally {
          setSaving(false)
        }
      }

      if (loadError !== null) {
        return h('div', { className: 'wdvs-panel' },
          h('div', { className: 'wdvs-toast wdvs-toast-error' }, t('error.prefix') + loadError),
          h('div', { className: 'wdvs-actions' },
            h('button', { type: 'button', className: 'wdvs-btn', onClick: () => setReloadKey(key => key + 1) }, t('load.retry'))))
      }
      if (config === null) {
        return h('div', { className: 'wdvs-panel' }, h('div', { className: 'wdvs-hint' }, t('summary.loading')))
      }
      const syncing = status !== null && status.phase === 'syncing'
      const configured = status === null ? true : status.configured
      const syncDisabled = busy || syncing || !configured

      return h('div', { className: 'wdvs-panel' },
        toast !== null && h(Toast, { key: toast.text + String(toast.kind), toast, onDone: () => setToast(null) }),
        h(StatusCard, { t: propsT, status }),
        h('div', { className: 'wdvs-actions' },
          h('button', { type: 'button', className: 'wdvs-btn wdvs-btn-primary', disabled: syncDisabled, title: configured ? undefined : t('action.needConfig'), onClick: () => runAction('sync', { direction: 'both' }, t('sync.started')) },
            syncing ? t('action.syncing') : t('action.sync')),
          h('button', { type: 'button', className: 'wdvs-btn', disabled: syncDisabled, title: configured ? undefined : t('action.needConfig'), onClick: () => runAction('sync', { direction: 'push' }, t('sync.started')) }, t('action.push')),
          h('button', { type: 'button', className: 'wdvs-btn', disabled: syncDisabled, title: configured ? undefined : t('action.needConfig'), onClick: () => runAction('sync', { direction: 'pull' }, t('sync.started')) }, t('action.pull')),
          h('button', { type: 'button', className: 'wdvs-btn', disabled: busy || syncing, onClick: () => runAction('test', undefined, t('test.ok')) }, t('action.test'))),
        h(ResultCard, { t: propsT, result: status === null ? null : status.lastResult }),
        h('div', { className: 'wdvs-card' },
          h('div', { className: 'wdvs-section-title' }, t('config.heading')),
          h(Field, { label: t('config.url') },
            h('input', {
              className: 'wdvs-input', type: 'text', value: config.webdavUrl ?? '',
              placeholder: t('config.urlPlaceholder'),
              onChange: event => updateField('webdavUrl', event.target.value),
            })),
          h(Field, { label: t('config.username') },
            h('input', {
              className: 'wdvs-input', type: 'text', value: config.username ?? '',
              onChange: event => updateField('username', event.target.value),
            })),
          h(Field, { label: t('config.password') },
            h('input', {
              className: 'wdvs-input', type: 'password', value: password, autoComplete: 'new-password',
              placeholder: config.hasPassword ? t('config.passwordSaved') : '',
              onChange: event => setPassword(event.target.value),
            })),
          h(Field, { label: t('config.backupDir'), hint: t('config.backupDirHint') },
            h('input', {
              className: 'wdvs-input', type: 'text', value: config.backupDir ?? '',
              placeholder: t('config.backupDirPlaceholder'),
              onChange: event => updateField('backupDir', event.target.value),
            })),
          h(Field, { label: t('config.strategy') },
            h(StrategyPicker, { t: propsT, value: config.strategy ?? 'merge', onChange: value => updateField('strategy', value) })),
          h(Field, { label: t('config.excluded'), hint: t('config.excludedHint') },
            h(ExclusionPicker, { t: propsT, plugins, excluded, onChange: setExcluded })),
          h(Field, { label: t('config.deviceName') },
            h('input', {
              className: 'wdvs-input', type: 'text', value: config.deviceName ?? '',
              placeholder: t('config.deviceNamePlaceholder'),
              onChange: event => updateField('deviceName', event.target.value),
            })),
          h('div', { className: 'wdvs-actions' },
            h('button', { type: 'button', className: 'wdvs-btn wdvs-btn-primary', disabled: saving || syncing, onClick: save },
              saving ? t('config.saving') : t('config.save')))))
    }

    function PluginSyncPanel(props) {
      const view = props && props.view
      if (view === 'summary') return h(Summary, props)
      return h(Panel, props)
    }

    /** One-line live status beside the bundle detail page title. */
    function DetailStatusBadge({ subject }) {
      if (!subject || subject.kind !== 'bundle' || !subject.pkg || subject.pkg.name !== '@local/dsh-webdav-sync') return null
      return h(Summary, {})
    }

    return {
      inject: ['slots', 'locale'],
      apply(ctx) {
        const style = document.createElement('style')
        style.setAttribute('data-dsh-webdav-sync', '')
        style.textContent = CSS
        document.head.appendChild(style)
        ctx.effect(() => () => style.remove(), 'webdav-sync: styles')

        try {
          const unregister = ctx.locale.register(NS, DICTS)
          if (typeof unregister === 'function') ctx.effect(() => () => unregister(), 'webdav-sync: dictionaries')
        } catch {
          // Locale service unavailable: built-in fallback translation stays active.
        }

        ctx.slots.inject('plugins.bundle.config', () => ctx.slots.register({
          name: 'plugins.bundle.config',
          key: '@local/dsh-webdav-sync',
          locale: NS,
        }, PluginSyncPanel))

        ctx.slots.inject('plugins.detail.badge', () => ctx.slots.register({
          name: 'plugins.detail.badge',
          id: 'webdav-sync-status',
          order: 10,
          locale: NS,
        }, DetailStatusBadge))
      },
    }
  },
})
