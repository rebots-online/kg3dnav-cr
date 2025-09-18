// SPDX-License-Identifier: Apache-2.0
import { defineConfig } from 'vite'
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

const minutes = epochMinutes()
const buildNumber = buildNumberFromMinutes(minutes)
const epochSeconds = minutes * 60

export default defineConfig({
  plugins: [react()],
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
    __BUILD_SEMVER__: JSON.stringify(process.env.npm_package_version || '0.0.0-dev'),
    __GIT_SHA__: JSON.stringify(process.env.GIT_COMMIT || process.env.VERCEL_GIT_COMMIT_SHA || process.env.GITHUB_SHA || 'unknown'),
  },
})

