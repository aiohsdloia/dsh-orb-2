#!/usr/bin/env node
// Steward Gateway: pairs iPhones and other PCs with the loopback-only DSH Web.
// No production dependencies; HTTP + WebSocket reverse proxy with an 8-digit code.

import { parseArgs } from 'node:util'
import { createServer, request as httpRequest } from 'node:http'
import { connect } from 'node:net'
import { createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto'
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { networkInterfaces } from 'node:os'

const here = dirname(fileURLToPath(import.meta.url))
const projectRoot = resolve(here, '../..')

const { values } = parseArgs({
  options: {
    port: { type: 'string', default: process.env.GATEWAY_PORT ?? '8080' },
    host: { type: 'string', default: '127.0.0.1' },
    target: { type: 'string', default: process.env.DSH_TARGET ?? 'http://127.0.0.1:3107' },
    token: { type: 'string' },
    lan: { type: 'boolean', default: false },
  },
})

const PORT = Number(values.port)
const HOST = values.lan ? '0.0.0.0' : values.host
const TARGET = values.target
const targetUrl = new URL(TARGET)

const CODE_TTL_MS = 10 * 60 * 1000
const COOKIE_TTL_MS = 30 * 24 * 3600 * 1000
const COOKIE_NAME = 'steward_gw'
const MAX_FAILURES = 5
const LOCK_MS = 60 * 1000

const dataDir = join(projectRoot, 'butler/data')
const secretPath = join(dataDir, 'gateway-secret')
if (!existsSync(secretPath)) {
  writeFileSync(secretPath, randomBytes(32).toString('hex') + '\n', 'utf8')
}
const SECRET = readFileSync(secretPath, 'utf8').trim()

let code = String(randomInt(0, 100000000)).padStart(8, '0')
let codeExpiresAt = Date.now() + CODE_TTL_MS
const failures = new Map() // ip -> { count, lockUntil }

const codeFile = join(dataDir, 'gateway-code.txt')

function writeCodeFile() {
  writeFileSync(codeFile, `${formatCode()}\n`, 'utf8')
}

function rotateCode() {
  code = String(randomInt(0, 100000000)).padStart(8, '0')
  codeExpiresAt = Date.now() + CODE_TTL_MS
  writeCodeFile()
  console.log(`[gateway] pairing code: ${formatCode()}`)
}

function formatCode() {
  return `${code.slice(0, 4)} ${code.slice(4)}`
}

function sign(payload) {
  return createHmac('sha256', SECRET).update(payload).digest('hex')
}

function mintCookie() {
  const expires = Date.now() + COOKIE_TTL_MS
  const payload = Buffer.from(String(expires)).toString('base64url')
  const sig = sign(payload)
  return `${payload}.${sig}`
}

function verifyCookie(cookieHeader) {
  if (!cookieHeader) return false
  for (const part of cookieHeader.split(';')) {
    const [name, value] = part.trim().split('=')
    if (name !== COOKIE_NAME || !value) continue
    const dot = value.lastIndexOf('.')
    if (dot < 0) return false
    const payload = value.slice(0, dot)
    const sig = value.slice(dot + 1)
    const expected = Buffer.from(sign(payload))
    const actual = Buffer.from(sig)
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return false
    const expires = Number(Buffer.from(payload, 'base64url').toString())
    return Number.isFinite(expires) && expires > Date.now()
  }
  return false
}

function clientIp(request) {
  return (request.socket?.remoteAddress ?? 'unknown')
}

function locked(ip) {
  const entry = failures.get(ip)
  if (!entry) return false
  if (entry.lockUntil > Date.now()) return true
  failures.delete(ip)
  return false
}

function registerFailure(ip) {
  const entry = failures.get(ip) ?? { count: 0, lockUntil: 0 }
  entry.count += 1
  if (entry.count >= MAX_FAILURES) {
    entry.lockUntil = Date.now() + LOCK_MS
    entry.count = 0
  }
  failures.set(ip, entry)
}

function resetFailures(ip) {
  failures.delete(ip)
}

function resolveToken() {
  if (values.token) return values.token
  if (process.env.DSH_TOKEN) return process.env.DSH_TOKEN
  const logDir = join(dataDir, 'logs')
  if (!existsSync(logDir)) return null
  const files = readdirSync(logDir).filter((n) => /^dsh-web-.*\.out\.log$/.test(n)).sort()
  for (let i = files.length - 1; i >= 0; i -= 1) {
    const text = readFileSync(join(logDir, files[i]), 'utf8')
    const match = text.match(/token=([A-Za-z0-9_-]{16,})/)
    if (match) return match[1]
  }
  return null
}

let cachedToken = null
let cachedTokenAt = 0

function getToken() {
  if (cachedToken && Date.now() - cachedTokenAt < 5000) return cachedToken
  cachedToken = resolveToken()
  cachedTokenAt = Date.now()
  return cachedToken
}

function lanAddresses() {
  const out = []
  for (const [name, infos] of Object.entries(networkInterfaces())) {
    for (const info of infos ?? []) {
      if (info.family === 'IPv4' && !info.internal) out.push(info.address)
    }
  }
  return out
}

function pairingPage(error = '') {
  return `<!doctype html>
<html lang="zh"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Steward 配对</title>
<style>
body{margin:0;font-family:-apple-system,Segoe UI,sans-serif;background:#0f1115;color:#e6e6e6;display:flex;align-items:center;justify-content:center;min-height:100vh}
.card{background:#181b22;border-radius:16px;padding:32px 24px;width:min(92vw,380px);box-shadow:0 10px 40px rgba(0,0,0,.5)}
h1{font-size:20px;margin:0 0 8px}
p{color:#9aa0a6;font-size:14px;line-height:1.6}
input{width:100%;box-sizing:border-box;font-size:20px;padding:12px;border-radius:10px;border:1px solid #2c313a;background:#0b0d12;color:#e6e6e6;text-align:center;margin-top:16px}
button{width:100%;margin-top:12px;font-size:16px;padding:12px;border-radius:10px;border:0;background:#4d6bfe;color:#fff}
.error{color:#f26d6d;font-size:14px;margin-top:8px}
.note{font-size:12px;color:#6b7280;margin-top:16px}
</style></head><body><div class="card">
<h1>Steward 配对</h1>
<p>配对码显示在电脑上，不在本页。请在电脑上运行 <code>butler\\remote\\get-pairing-code.ps1</code> 或查看网关日志，得到 8 位数字后输入。</p>
<form method="post" action="/m">
<input name="code" type="tel" inputmode="numeric" pattern="[0-9]{8}" maxlength="8" placeholder="输入 8 位配对码" autofocus required>
<button type="submit">连接 Steward</button>
</form>${error ? `<div class="error">${error}</div>` : ''}
<div class="note">配对码 10 分钟有效，错误 5 次锁定 1 分钟。只在信任的网络使用。</div>
</div></body></html>`
}

function redirect(response, location, status = 302) {
  response.writeHead(status, { location, 'cache-control': 'no-store' })
  response.end()
}

async function readBody(request, limit = 2048) {
  const chunks = []
  let size = 0
  for await (const chunk of request) {
    size += chunk.length
    if (size > limit) throw new Error('too large')
    chunks.push(chunk)
  }
  return Buffer.concat(chunks).toString('utf8')
}

function proxyRequest(request, response) {
  const headers = { ...request.headers }
  delete headers.host
  delete headers.connection
  delete headers['keep-alive']
  delete headers['proxy-connection']
  delete headers.upgrade
  delete headers['sec-websocket-key']
  delete headers['sec-websocket-version']
  delete headers['sec-websocket-extensions']
  delete headers['sec-websocket-protocol']
  headers.host = targetUrl.host
  if (headers.origin) headers.origin = targetUrl.origin

  const incoming = new URL(request.url ?? '/', `http://${targetUrl.host}`)

  const options = {
    method: request.method,
    hostname: targetUrl.hostname,
    port: targetUrl.port || 80,
    path: request.url,
    headers,
  }
  const upstream = httpRequest(options, (upstreamResponse) => {
    if (upstreamResponse.statusCode === 401 && (incoming.pathname === '/' || incoming.pathname === '/index.html')) {
      const token = getToken()
      upstreamResponse.resume()
      response.writeHead(302, {
        location: token ? `/?token=${token}` : '/m',
        'cache-control': 'no-store',
      })
      response.end()
      return
    }
    const outHeaders = { ...upstreamResponse.headers }
    delete outHeaders['content-length']
    delete outHeaders['transfer-encoding']
    response.writeHead(upstreamResponse.statusCode ?? 502, outHeaders)
    upstreamResponse.pipe(response)
  })
  upstream.on('error', (error) => {
    if (!response.headersSent) {
      response.writeHead(502, { 'content-type': 'text/plain' })
      response.end(`upstream error: ${error.message}`)
    } else {
      response.destroy()
    }
  })
  request.pipe(upstream)
}

function handleUpgrade(request, socket, head) {
  if (!verifyCookie(request.headers.cookie)) {
    socket.write('HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n')
    socket.destroy()
    return
  }
  const upstream = connect(Number(targetUrl.port || 80), targetUrl.hostname, () => {
    const lines = []
    lines.push(`${request.method} ${request.url} HTTP/1.1`)
    const headers = { ...request.headers }
    delete headers.host
  headers.host = targetUrl.host
  if (headers.origin) headers.origin = targetUrl.origin
    for (const [name, value] of Object.entries(headers)) {
      if (Array.isArray(value)) lines.push(...value.map((v) => `${name}: ${v}`))
      else if (value !== undefined) lines.push(`${name}: ${value}`)
    }
    upstream.write(lines.join('\r\n') + '\r\n\r\n')
    if (head && head.length) upstream.write(head)
    socket.pipe(upstream)
    upstream.pipe(socket)
  })
  upstream.on('error', () => socket.destroy())
  socket.on('error', () => upstream.destroy())
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`)

  if (url.pathname === '/m') {
    const ip = clientIp(request)
    if (request.method === 'GET') {
      if (codeExpiresAt <= Date.now()) rotateCode()
      response.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' })
      response.end(pairingPage())
      return
    }
    if (request.method === 'POST') {
      if (locked(ip)) {
        response.writeHead(429, { 'content-type': 'text/html; charset=utf-8', 'retry-after': '60' })
        response.end(pairingPage('尝试次数过多，请 1 分钟后再试。'))
        return
      }
      let body = ''
      try {
        body = await readBody(request)
      } catch {
        response.writeHead(413, { 'content-type': 'text/html; charset=utf-8' })
        response.end(pairingPage('请求过大。'))
        return
      }
      const submitted = new URLSearchParams(body).get('code') ?? ''
      const now = Date.now()
      if (codeExpiresAt <= now) {
        rotateCode()
        response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
        response.end(pairingPage('配对码已过期，请使用上方的新码重新输入。'))
        return
      }
      if (submitted !== code) {
        registerFailure(ip)
        response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
        response.end(pairingPage('配对码不对，请重新输入。'))
        return
      }
      resetFailures(ip)
      const cookie = mintCookie()
      response.writeHead(302, {
        location: `/?token=${getToken()}`,
        'set-cookie': `${COOKIE_NAME}=${cookie}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${COOKIE_TTL_MS / 1000}`,
        'cache-control': 'no-store',
      })
      response.end()
      return
    }
    response.writeHead(405, { allow: 'GET, POST' })
    response.end()
    return
  }

  if (url.pathname === '/gw') {
    response.writeHead(200, { 'content-type': 'application/json' })
    response.end(JSON.stringify({
      ok: true,
      paired: verifyCookie(request.headers.cookie),
      tokenReady: Boolean(getToken()),
      target: TARGET,
      codeRemainingSec: Math.max(0, Math.round((codeExpiresAt - Date.now()) / 1000)),
    }))
    return
  }

  if (!verifyCookie(request.headers.cookie)) {
    redirect(response, '/m')
    return
  }

  proxyRequest(request, response)
})

server.on('upgrade', handleUpgrade)
server.listen(PORT, HOST, () => {
  writeCodeFile()
  console.log(`[gateway] listening on ${HOST}:${PORT} -> ${TARGET}`)
  console.log(`[gateway] token=${getToken() ? 'ready' : 'missing (set DSH_TOKEN or --token)'}`)
  console.log(`[gateway] pairing code: ${formatCode()}`)
  if (values.lan) {
    for (const address of lanAddresses()) {
      console.log(`[gateway] phone/PC URL: http://${address}:${PORT}/m`)
    }
  }
})
