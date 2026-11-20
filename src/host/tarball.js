/**
 * Minimal ustar + gzip archiver used to package one installed plugin directory
 * into a `.tgz` that `pnpm add <path>` (and therefore Plugin Manager's
 * installBundle) can install directly. No external dependencies.
 */

import { gzipSync } from 'node:zlib'
import { readdirSync, statSync, readFileSync } from 'node:fs'
import path from 'node:path'

const BLOCK = 512

function octal(value, length) {
  return value.toString(8).padStart(length - 1, '0') + '\0'
}

function tarHeader(name, typeflag, size, mtimeSeconds, mode) {
  const header = Buffer.alloc(BLOCK)
  const nameBytes = Buffer.from(name, 'utf8')
  if (nameBytes.length > 100) throw new Error(`打包路径过长: ${name}`)
  nameBytes.copy(header, 0)
  header.write(octal(mode, 8), 100, 'utf8') // mode
  header.write(octal(0, 8), 108, 'utf8') // uid
  header.write(octal(0, 8), 116, 'utf8') // gid
  header.write(octal(size, 12), 124, 'utf8') // size
  header.write(octal(Math.max(0, Math.floor(mtimeSeconds)), 12), 136, 'utf8') // mtime
  header.write('        ', 148, 'utf8') // checksum placeholder (spaces)
  header.write(typeflag, 156, 'utf8')
  header.write('ustar\0', 257, 'utf8')
  header.write('00', 263, 'utf8')
  let sum = 0
  for (const byte of header) sum += byte
  header.write(sum.toString(8).padStart(6, '0') + '\0 ', 148, 'utf8')
  return header
}

function shouldSkip(name) {
  return name === 'node_modules' || name === '.git' || name === '.DS_Store' || name === '.patch'
}

function collectEntries(dir, base, out) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (shouldSkip(entry.name)) continue
    const abs = path.join(dir, entry.name)
    const rel = base.length === 0 ? entry.name : `${base}/${entry.name}`
    if (entry.isDirectory()) {
      out.push({ rel, abs, type: 'dir' })
      collectEntries(abs, rel, out)
    } else if (entry.isFile()) {
      out.push({ rel, abs, type: 'file' })
    }
    // Symbolic links and other node types are skipped on purpose: installed
    // plugin packages are plain directory trees.
  }
}

/**
 * Pack a directory into a gzip-compressed tar archive.
 * @param {string} dir - absolute directory to archive.
 * @returns {Buffer} the `.tgz` bytes.
 */
export function packDirectory(dir) {
  const entries = []
  collectEntries(dir, '', entries)
  const chunks = []
  for (const entry of entries) {
    const stat = statSync(entry.abs)
    if (entry.type === 'dir') {
      chunks.push(tarHeader(entry.rel, '5', 0, stat.mtimeMs / 1000, 0o755))
      continue
    }
    const data = readFileSync(entry.abs)
    chunks.push(tarHeader(entry.rel, '0', data.length, stat.mtimeMs / 1000, 0o644))
    chunks.push(data)
    const padding = (BLOCK - (data.length % BLOCK)) % BLOCK
    if (padding > 0) chunks.push(Buffer.alloc(padding))
  }
  chunks.push(Buffer.alloc(BLOCK))
  chunks.push(Buffer.alloc(BLOCK))
  return gzipSync(Buffer.concat(chunks))
}
