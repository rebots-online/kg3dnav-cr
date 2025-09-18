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
  const builtAtIso = new Date(minutes * 60000).toISOString()
  return { buildNumber, epochMinutes: minutes, semver, gitSha, builtAtIso }
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
    }
    const epochMinutesFromPayload = t.epochMinutes ?? t.epoch
    const epochMinutesNum =
      typeof epochMinutesFromPayload === 'string' ? Number.parseInt(epochMinutesFromPayload, 10) : Number.NaN
    const effectiveMinutes = Number.isFinite(epochMinutesNum) ? epochMinutesNum : base.epochMinutes
    const merged: BuildInfo = {
      buildNumber: t.buildNumber || (Number.isFinite(epochMinutesNum) ? formatBuildNumber(epochMinutesNum) : base.buildNumber),
      epochMinutes: effectiveMinutes,
      semver: t.semver || base.semver,
      gitSha: t.gitSha || base.gitSha,
      builtAtIso: new Date(effectiveMinutes * 60000).toISOString(),
    }
    return merged
  } catch (_err) {
    return base
  }
}
