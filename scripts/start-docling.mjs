import { spawn, spawnSync } from 'node:child_process'
import net from 'node:net'

const CONTAINER = 'he-tracker-docling'
const IMAGE = 'quay.io/docling-project/docling-serve:latest'
const PORT = 5001
const ORIGIN = 'http://localhost:5173'

function pickRuntime() {
  for (const rt of ['docker', 'podman']) {
    const r = spawnSync(rt, ['--version'], { stdio: 'ignore' })
    if (!r.error && r.status === 0) return rt
  }
  return null
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
      console.log(`[docling] Stopped ${CONTAINER}`)
    }
    process.exit(0)
  }

  if (!rt) {
    console.warn(
      '[docling] No docker/podman found — skipping Docling. Uploads will not convert until Docling is running. See docs/DOCLING.md.'
    )
    idle()
    return
  }

  // Our own container already up — follow its logs.
  if (isRunning(rt)) {
    console.log(`[docling] ${CONTAINER} already running — attaching to logs.`)
    const child = spawn(rt, ['logs', '-f', CONTAINER], { stdio: 'inherit' })
    child.on('exit', (code) => process.exit(code ?? 0))
    return
  }

  // Something else already serves port 5001 (e.g. another Docling instance) — use it.
  if (await portInUse(PORT)) {
    console.log(`[docling] Port ${PORT} already in use — assuming Docling is available; using existing instance.`)
    idle()
    return
  }

  console.log(`[docling] Starting ${IMAGE} on http://localhost:${PORT} …`)
  const onSignal = () => {
    stopContainer(rt)
    process.exit(0)
  }
  process.on('SIGINT', onSignal)
  process.on('SIGTERM', onSignal)

  const child = spawn(
    rt,
    [
      'run', '--rm', '--name', CONTAINER,
      '-p', `${PORT}:5001`,
      '-e', 'DOCLING_SERVE_ENABLE_UI=1',
      '-e', 'DOCLING_SERVE_MAX_SYNC_WAIT=540',
      '-e', `DOCLING_SERVE_CORS_ORIGINS=["${ORIGIN}"]`,
      IMAGE,
    ],
    { stdio: 'inherit' }
  )
  child.on('exit', (code) => process.exit(code ?? 0))
}

main()
