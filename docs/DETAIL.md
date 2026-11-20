# WebDAV 插件同步

> WebDAV plugin sync — sync installed DSH plugins across devices over WebDAV.

## 功能简介

<!-- English: Sync installed DSH plugins across multiple devices over WebDAV. -->

`@local/dsh-webdav-sync` 通过 WebDAV 在多台设备的 DSH 之间同步已安装的插件：

- 基于 WebDAV 协议，可使用任意支持 WebDAV 的网盘或自建服务作为中转；
- 支持多种同步策略：合并或覆盖；
- 支持排除指定插件，默认排除本插件自身；
- 备份目录可自定义，默认为 `dsh-plugin-sync`。

## 快速开始

<!-- English: Fill in the WebDAV URL, account and password, save, test the connection, then sync now. -->

1. 打开插件设置，填写 WebDAV 地址、账号、密码；
2. 点击保存，写入本地配置；
3. 点击“测试连接”，确认地址与凭据可用；
4. 点击“立即同步”，开始一次同步。

## 备份目录说明

<!-- English: Remote layout: {backup-dir}/manifest.json plus {backup-dir}/packages/{plugin}@{version}.tgz; the default backup directory is dsh-plugin-sync. -->

远端按以下结构存放同步数据：

```text
{备份目录}/
├── manifest.json
└── packages/
    └── {插件名}@{版本}.tgz
```

- `manifest.json`：清单文件，记录已同步插件的名称、版本等元信息；
- `packages/{插件名}@{版本}.tgz`：插件安装包，按“插件名@版本”命名；
- 备份目录默认为 `dsh-plugin-sync`，可在设置中自定义。

## 同步策略

<!-- English: Merge keeps the union of plugins with the newer semver per plugin; overwrite follows the remote whenever the versions differ, even when the local copy is newer. -->

### 合并（merge）

- 同步后两端插件取并集；
- 同一插件在两端版本不同时，按 semver 语义化版本比较，保留较新一端的版本。

### 覆盖（overwrite）

- 以远端为准：只要两端版本不同，就卸载本地版本并安装远端包；
- **注意：本地比远端新时也会被降级覆盖。使用覆盖策略前，请先上传本地改动。**

## 排除插件

<!-- English: The plugin excludes itself by default, and additional plugins can be excluded via multi-select. -->

- 默认排除 `@local/dsh-webdav-sync` 自身，避免同步过程影响本插件；
- 可在设置中多选其他需要排除的插件，被排除的插件不参与同步。

## 状态说明

<!-- English: Status is idle, syncing, success or failed, with the last sync time shown. -->

| 状态 | 含义 |
| --- | --- |
| idle | 空闲，未在同步 |
| 同步中 | 正在执行同步 |
| 成功 | 上一次同步成功完成 |
| 失败 | 上一次同步失败，可查看错误信息 |

- **上次同步时间**：显示最近一次同步的时间，便于确认数据新鲜度。

## 限制与注意

<!-- English: Requires Node 18+, applies changes immediately via HMR, cannot sync built-in read-only plugins, stores the password in plain text, and may race under concurrent syncs. -->

- 需要 Node 18+ 的 DSH 运行环境；
- 插件安装/卸载会即时生效（HMR），同步过程中无需重启；
- 不可同步 installation 内置只读插件；
- WebDAV 密码明文存于配置文件，请注意 WebDAV 凭据安全（建议使用专用账号并限制目录权限）；
- 多端同时同步可能产生竞态，建议错开使用。
