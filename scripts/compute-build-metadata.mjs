#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0

function computeEpochMinutes() {
  return Math.floor(Date.now() / 60000)
}

function formatBuildNumber(minutes) {
  const base36 = Math.max(minutes, 0).toString(36).toUpperCase()
  const tail = base36.slice(-5)
  return tail.padStart(5, '0')
}

const epochMinutes = computeEpochMinutes()
const buildNumber = formatBuildNumber(epochMinutes)
const epochSeconds = epochMinutes * 60
const builtAtIso = new Date(epochMinutes * 60000).toISOString()

const payload = {
  epochMinutes,
  buildNumber,
  epochSeconds,
  builtAtIso,
}

const args = process.argv.slice(2)
const printJson = args.includes('--json')
const envLines = [
  `BUILD_MINUTES=${epochMinutes}`,
  `BUILD_NUMBER=${buildNumber}`,
  `BUILD_EPOCH=${epochSeconds}`,
  `BUILD_ISO=${builtAtIso}`,
]

if (printJson) {
  process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`)
} else {
  process.stdout.write(`${envLines.join('\n')}\n`)
}

const outIndex = args.indexOf('--output')
if (outIndex !== -1 && args.length > outIndex + 1) {
  const fs = await import('node:fs')
  const path = await import('node:path')
  const target = args[outIndex + 1]
  const dir = path.dirname(target)
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(target, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
}

if (process.env.GITHUB_ENV) {
  const fs = await import('node:fs')
  fs.appendFileSync(process.env.GITHUB_ENV, `${envLines.join('\n')}\n`)
}
