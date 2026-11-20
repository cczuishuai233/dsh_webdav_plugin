# WebDAV Plugin Sync (`@local/dsh-webdav-sync`)

## Summary

WebDAV plugin sync keeps the plugins installed on multiple DSH devices in step. It uses any WebDAV server or cloud drive as the relay, supports merge or overwrite strategies, lets you exclude specific plugins, and excludes itself by default.

## Configure

1. Open the plugin settings and fill in the WebDAV URL, account and password.
2. Save the configuration.
3. Click **Test connection** to verify the endpoint and credentials.
4. Click **Sync now** to run a sync.

The remote backup directory defaults to `dsh-plugin-sync` and can be customized.

## Sync strategies

- **Merge** — the union of plugins on both ends; for the same plugin, the newer semver version wins.
- **Overwrite** — the remote side wins; a stale local version is uninstalled before the remote package is installed.

## Exclusions

- `@local/dsh-webdav-sync` excludes itself by default.
- Additional plugins can be excluded via multi-select in the settings.

## Remote layout

```text
{backup-dir}/
├── manifest.json
└── packages/
    └── {plugin}@{version}.tgz
```

- `manifest.json` lists the synced plugins and their versions.
- `packages/{plugin}@{version}.tgz` holds each plugin package.

## Limitations

- Requires a DSH runtime with Node 18+.
- Plugin installs/uninstalls take effect immediately (HMR); no restart needed.
- Built-in read-only installation plugins cannot be synced.
- The WebDAV password is stored in plain text in the config file — protect your WebDAV credentials.
- Concurrent syncs from multiple devices may race; stagger usage across devices.
