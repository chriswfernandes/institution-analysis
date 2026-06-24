import { spawn, spawnSync } from 'node:child_process'
import net from 'node:net'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const CONTAINER = 'he-tracker-litellm'
const IMAGE = 'he-tracker-litellm:latest'
const PORT = 4001
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const LITELLM_DIR = path.join(ROOT, 'litellm')
const CONFIG = path.join(LITELLM_DIR, 'litellm_config.yaml')
const DOCKERFILE = path.join(LITELLM_DIR, 'litellm.Dockerfile')
const ENV_FILE = path.join(ROOT, '.env.litellm')

function pickRuntime() {
  for (const rt of ['docker', 'podman']) {
    const r = spawnSync(rt, ['--version'], { stdio: 'ignore' })
    if (!r.error && r.status === 0) return rt
  }
  return null
}

function daemonUp(rt) {
  return spawnSync(rt, ['info'], { stdio: 'ignore' }).status === 0
}

function ensureColima(rt) {
  if (daemonUp(rt)) return true
  if (spawnSync('colima', ['--version'], { stdio: 'ignore' }).status !== 0) return false
  console.log('[litellm] Docker daemon not reachable — starting Colima …')
  spawnSync('colima', ['start'], { stdio: 'inherit' })
  for (let i = 0; i < 30; i++) {
    if (daemonUp(rt)) return true
    spawnSync('sleep', ['2'])
  }
  return daemonUp(rt)
}

function readEnv() {
  const env = {}
  if (existsSync(ENV_FILE)) {
    for (const line of readFileSync(ENV_FILE, 'utf8').split('\n')) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
      if (m) env[m[1]] = m[2]
    }
  }
  return env
}

function imageExists(rt) {
  const r = spawnSync(rt, ['images', '-q', IMAGE], { encoding: 'utf8' })
  return Boolean(r.stdout?.trim())
}

function buildImage(rt) {
  const env = readEnv()
  console.log(`[litellm] Building ${IMAGE} …`)
  const r = spawnSync(
    rt,
    [
      'build',
      '-f', DOCKERFILE,
      '--build-arg', `NETSKOPE_ROOT_CA_B64=${env.NETSKOPE_ROOT_CA_B64 ?? ''}`,
      '--build-arg', `NETSKOPE_TENANT_CA_B64=${env.NETSKOPE_TENANT_CA_B64 ?? ''}`,
      '-t', IMAGE,
      LITELLM_DIR,
    ],
    { stdio: 'inherit' }
  )
  return r.status === 0
}

function isRunning(rt) {
  const r = spawnSync(
    rt,
    ['ps', '--filter', `name=^${CONTAINER}$`, '--format', '{{.Names}}'],
    { encoding: 'utf8' }
  )
  return r.stdout?.trim() === CONTAINER
}

function stopContainer(rt) {
  spawnSync(rt, ['stop', CONTAINER], { stdio: 'ignore' })
}

// Resolve true if something is already listening on localhost:PORT.
function portInUse(port) {
  return new Promise((resolve) => {
    const socket = net.connect({ host: '127.0.0.1', port })
    const done = (result) => {
      socket.destroy()
      resolve(result)
    }
    socket.setTimeout(1000)
    socket.once('connect', () => done(true))
    socket.once('timeout', () => done(false))
    socket.once('error', () => done(false))
  })
}

// Keep the process alive so concurrently does not treat this as a failure
// and so Vite keeps running; exit cleanly on signal.
function idle() {
  process.stdin.resume()
  process.on('SIGINT', () => process.exit(0))
  process.on('SIGTERM', () => process.exit(0))
}

async function main() {
  const rt = pickRuntime()
  const stopMode = process.argv.includes('--stop')

  if (stopMode) {
    if (rt) {
      stopContainer(rt)
      console.log(`[litellm] Stopped ${CONTAINER}`)
    }
    process.exit(0)
  }

  if (!rt) {
    console.warn('[litellm] No docker/podman found — skipping LiteLLM. See docs/LITELLM.md.')
    idle()
    return
  }

  if (!ensureColima(rt)) {
    console.warn('[litellm] Docker daemon unavailable (Colima not started) — skipping LiteLLM. See docs/LITELLM.md.')
    idle()
    return
  }

  if (!existsSync(ENV_FILE)) {
    console.warn('[litellm] .env.litellm missing — copy .env.litellm.example and fill it in. Skipping LiteLLM.')
    idle()
    return
  }

  // Our own container already up — follow its logs.
  if (isRunning(rt)) {
    console.log(`[litellm] ${CONTAINER} already running — attaching to logs.`)
    const child = spawn(rt, ['logs', '-f', CONTAINER], { stdio: 'inherit' })
    child.on('exit', (code) => process.exit(code ?? 0))
    return
  }

  // Something else already serves port 4001 — use it.
  if (await portInUse(PORT)) {
    console.log(`[litellm] Port ${PORT} already in use — assuming LiteLLM is available; using existing instance.`)
    idle()
    return
  }

  if (!imageExists(rt) && !buildImage(rt)) {
    console.warn('[litellm] Image build failed — skipping LiteLLM. See docs/LITELLM.md.')
    idle()
    return
  }

  const onSignal = () => {
    stopContainer(rt)
    process.exit(0)
  }
  process.on('SIGINT', onSignal)
  process.on('SIGTERM', onSignal)

  console.log(`[litellm] Starting ${IMAGE} on http://localhost:${PORT} …`)
  const child = spawn(
    rt,
    [
      'run', '--rm', '--name', CONTAINER,
      '-p', `${PORT}:4000`,
      '--env-file', ENV_FILE,
      '-v', `${CONFIG}:/app/config.yaml:ro`,
      IMAGE,
      '--config', '/app/config.yaml', '--port', '4000',
    ],
    { stdio: 'inherit' }
  )
  child.on('exit', (code) => process.exit(code ?? 0))
}

main()
