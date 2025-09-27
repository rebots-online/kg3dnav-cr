// SPDX-License-Identifier: Apache-2.0
import type { BuildInfo } from '../types/knowledge'

// Vite build-time constants should be defined in vite config via define: {
//   __BUILD_MINUTES__: JSON.stringify(Math.floor(Date.now() / 60000)),
//   __BUILD_NUMBER__: JSON.stringify(formatBuildNumber(Math.floor(Date.now() / 60000))),
//   __BUILD_EPOCH__: JSON.stringify(Math.floor(Date.now() / 60000) * 60),
//   __BUILD_SEMVER__: JSON.stringify(process.env.npm_package_version || '0.0.0-dev'),
//   __GIT_SHA__: JSON.stringify(process.env.GIT_COMMIT || 'unknown')
// }
// This module also provides runtime fallbacks when those are not injected.

declare const __BUILD_MINUTES__: number
declare const __BUILD_NUMBER__: string
declare const __BUILD_EPOCH__: number
declare const __BUILD_SEMVER__: string
declare const __GIT_SHA__: string
declare const __VERSION_BUILD__: string

export function computeEpochMinutes(): number {
  return Math.floor(Date.now() / 60000)
}

export function formatBuildNumber(epochMinutes: number): string {
  const base36 = Math.max(epochMinutes, 0).toString(36).toUpperCase()
  const tail = base36.slice(-5)
  return tail.padStart(5, '0')
}

export function getBuildInfo(): BuildInfo {
  const minutes = (typeof __BUILD_MINUTES__ !== 'undefined' ? __BUILD_MINUTES__ : computeEpochMinutes()) as number
  const buildNumber = (typeof __BUILD_NUMBER__ !== 'undefined' ? __BUILD_NUMBER__ : formatBuildNumber(minutes)) as string
  const epochSeconds =
    typeof __BUILD_EPOCH__ !== 'undefined' ? (__BUILD_EPOCH__ as number) : Math.floor(minutes * 60)
  const semver = (typeof __BUILD_SEMVER__ !== 'undefined' ? __BUILD_SEMVER__ : '0.0.0-dev') as string
  const gitSha = (typeof __GIT_SHA__ !== 'undefined' ? __GIT_SHA__ : 'unknown') as string
  const versionBuild =
    (typeof __VERSION_BUILD__ !== 'undefined'
      ? (__VERSION_BUILD__ as string)
      : computeVersionBuild(semver, epochSeconds)) ?? computeVersionBuild(semver, epochSeconds)
  const builtAtIso = new Date(minutes * 60000).toISOString()
  return { buildNumber, epochMinutes: minutes, semver, gitSha, builtAtIso, versionBuild }
}

// Optional: augment build info from Tauri when available.
export async function fetchBuildInfo(): Promise<BuildInfo> {
  const base = getBuildInfo()
  try {
    const { invoke } = await import('@tauri-apps/api/core')
    const t = (await invoke('get_build_info')) as {
      buildNumber?: string
      epochMinutes?: string
      epoch?: string
      semver?: string
      gitSha?: string
      versionBuild?: string
      version_build?: string
    }
    const epochMinutesFromPayload = t.epochMinutes ?? t.epoch
    const epochMinutesNum =
      typeof epochMinutesFromPayload === 'string' ? Number.parseInt(epochMinutesFromPayload, 10) : Number.NaN
    const effectiveMinutes = Number.isFinite(epochMinutesNum) ? epochMinutesNum : base.epochMinutes
    const epochSeconds = Number.isFinite(epochMinutesNum) ? epochMinutesNum * 60 : base.epochMinutes * 60
    const resolvedSemver = t.semver || base.semver
    const resolvedVersionBuild =
      t.versionBuild || t.version_build || computeVersionBuild(resolvedSemver, epochSeconds)
    const merged: BuildInfo = {
      buildNumber: t.buildNumber || (Number.isFinite(epochMinutesNum) ? formatBuildNumber(epochMinutesNum) : base.buildNumber),
      epochMinutes: effectiveMinutes,
      semver: resolvedSemver,
      gitSha: t.gitSha || base.gitSha,
      versionBuild: resolvedVersionBuild,
      builtAtIso: new Date(effectiveMinutes * 60000).toISOString(),
    }
    return merged
  } catch (_err) {
    return base
  }
}

function computeVersionBuild(semver: string, epochSeconds: number): string {
  const { major, minor } = extractMajorMinor(semver)
  const bucket = Math.floor(Math.max(epochSeconds, 0) / 100) % 10000
  const minorPadded = String(minor).padStart(2, '0')
  const bucketPadded = String(bucket).padStart(4, '0')
  return `v${major}.${minorPadded}${bucketPadded}`
}

function extractMajorMinor(semver: string): { major: number; minor: number } {
  const [majorRaw = '0', minorRaw = '0'] = String(semver ?? '').split('.')
  const major = Number.parseInt(majorRaw, 10)
  const minor = Number.parseInt(minorRaw, 10)
  return {
    major: Number.isFinite(major) ? major : 0,
    minor: Number.isFinite(minor) ? minor : 0,
  }
}
