#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

function computeEpochMinutes() {
  return Math.floor(Date.now() / 60000)
}

function formatBuildNumber(minutes) {
  const base36 = Math.max(minutes, 0).toString(36).toUpperCase()
  const tail = base36.slice(-5)
  return tail.padStart(5, '0')
}

function parseMajorMinor(versionString) {
  const [majorRaw = '0', minorRaw = '0'] = String(versionString ?? '').split('.')
  const major = Number.parseInt(majorRaw, 10)
  const minor = Number.parseInt(minorRaw, 10)
  return {
    major: Number.isFinite(major) ? major : 0,
    minor: Number.isFinite(minor) ? minor : 0,
  }
}

function computeVersionBuild({ major, minor }, epochSeconds) {
  const minorPadded = String(minor).padStart(2, '0')
  const bucket = Math.floor(Math.max(epochSeconds, 0) / 100) % 10000
  const bucketPadded = String(bucket).padStart(4, '0')
  return `v${major}.${minorPadded}${bucketPadded}`
}

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const packageJsonPath = path.resolve(__dirname, '..', 'package.json')
let packageVersion = '0.0.0'
try {
  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'))
  packageVersion = packageJson.version ?? packageVersion
} catch (err) {
  console.warn('Unable to read package.json for version build computation:', err)
}

const epochMinutes = computeEpochMinutes()
const buildNumber = formatBuildNumber(epochMinutes)
const epochSeconds = epochMinutes * 60
const builtAtIso = new Date(epochMinutes * 60000).toISOString()
const { major, minor } = parseMajorMinor(packageVersion)
const versionBuild = computeVersionBuild({ major, minor }, Math.floor(Date.now() / 1000))

const payload = {
  epochMinutes,
  buildNumber,
  epochSeconds,
  builtAtIso,
  version: packageVersion,
  versionBuild,
  version_build: versionBuild,
}

const args = process.argv.slice(2)
const printJson = args.includes('--json')
const envLines = [
  `BUILD_MINUTES=${epochMinutes}`,
  `BUILD_NUMBER=${buildNumber}`,
  `BUILD_EPOCH=${epochSeconds}`,
  `BUILD_ISO=${builtAtIso}`,
  `VERSION_BUILD=${versionBuild}`,
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
