// SPDX-License-Identifier: Apache-2.0
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

function epochMinutes() {
  return Math.floor(Date.now() / 60000)
}

function buildNumberFromMinutes(minutes: number) {
  const base36 = Math.max(minutes, 0).toString(36).toUpperCase()
  const tail = base36.slice(-5)
  return tail.padStart(5, '0')
}

function parseMajorMinor(versionString: string): { major: number; minor: number } {
  const [majorRaw = '0', minorRaw = '0'] = String(versionString ?? '').split('.')
  const major = Number.parseInt(majorRaw, 10)
  const minor = Number.parseInt(minorRaw, 10)
  return {
    major: Number.isFinite(major) ? major : 0,
    minor: Number.isFinite(minor) ? minor : 0,
  }
}

function computeVersionBuild(semver: string, epochSeconds: number): string {
  const { major, minor } = parseMajorMinor(semver)
  const bucket = Math.floor(Math.max(epochSeconds, 0) / 100) % 10000
  return `v${major}.${String(minor).padStart(2, '0')}${String(bucket).padStart(4, '0')}`
}

const minutes = epochMinutes()
const buildNumber = buildNumberFromMinutes(minutes)
const epochSeconds = minutes * 60
const packageVersion = process.env.npm_package_version || '0.0.0-dev'
const versionBuild = computeVersionBuild(packageVersion, Math.floor(Date.now() / 1000))

type IncomingLogEntry = {
  id: string
  timestamp: string
  level: 'debug' | 'info' | 'warn' | 'error'
  source: string
  message: string
  detail?: unknown
}

function agentLogBridgePlugin(): Plugin {
  return {
    name: 'agent-log-bridge',
    apply: 'serve',
    configureServer(server) {
      const logger = server.config.logger
      server.ws.on('hkg:log', (payload) => {
        const entry = payload as IncomingLogEntry
        const color =
          entry.level === 'error'
            ? '\x1b[31m'
            : entry.level === 'warn'
              ? '\x1b[33m'
              : entry.level === 'debug'
                ? '\x1b[36m'
                : '\x1b[32m'
        const reset = '\x1b[0m'
        const prefix = `${color}[HKG ${entry.level.toUpperCase()}][${entry.source}]${reset}`
        const line = `${prefix} ${entry.message}`
        const method: 'info' | 'warn' | 'error' =
          entry.level === 'error' ? 'error' : entry.level === 'warn' ? 'warn' : 'info'
        const logFn = (logger[method] ?? console.log.bind(console)) as (message: string) => void
        logFn(line)
        if (entry.detail !== undefined) {
          const detailLine = `${color}  detail:${reset} ${JSON.stringify(entry.detail, null, 2)}`
          logFn(detailLine)
        }
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), agentLogBridgePlugin()],
  resolve: {
    alias: {
      react: path.resolve(process.cwd(), 'node_modules/react'),
      'react-dom': path.resolve(process.cwd(), 'node_modules/react-dom'),
    },
  },
  define: {
    __BUILD_MINUTES__: JSON.stringify(minutes),
    __BUILD_NUMBER__: JSON.stringify(buildNumber),
    __BUILD_EPOCH__: JSON.stringify(epochSeconds),
    __BUILD_SEMVER__: JSON.stringify(packageVersion),
    __GIT_SHA__: JSON.stringify(process.env.GIT_COMMIT || process.env.VERCEL_GIT_COMMIT_SHA || process.env.GITHUB_SHA || 'unknown'),
    __VERSION_BUILD__: JSON.stringify(versionBuild),
  },
})

