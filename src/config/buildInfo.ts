// SPDX-License-Identifier: Apache-2.0
import type { BuildInfo } from '../types/knowledge'

// Vite build-time constants should be defined in vite config via define: {
//   __BUILD_EPOCH__: JSON.stringify(Math.floor(Date.now()/1000)),
//   __BUILD_SEMVER__: JSON.stringify(process.env.npm_package_version || '0.0.0-dev'),
//   __GIT_SHA__: JSON.stringify(process.env.GIT_COMMIT || 'unknown')
// }
// This module also provides runtime fallbacks when those are not injected.

declare const __BUILD_EPOCH__: number
declare const __BUILD_SEMVER__: string
declare const __GIT_SHA__: string

export function getBuildInfo(): BuildInfo {
  const epoch = (typeof __BUILD_EPOCH__ !== 'undefined' ? __BUILD_EPOCH__ : Math.floor(Date.now() / 1000)) as number
  const semver = (typeof __BUILD_SEMVER__ !== 'undefined' ? __BUILD_SEMVER__ : '0.0.0-dev') as string
  const gitSha = (typeof __GIT_SHA__ !== 'undefined' ? __GIT_SHA__ : 'unknown') as string
  const builtAtIso = new Date(epoch * 1000).toISOString()
  return { epoch, semver, gitSha, builtAtIso }
}

// Optional: augment build info from Tauri at runtime when available.
export async function fetchBuildInfo(): Promise<BuildInfo> {
  const base = getBuildInfo()
  try {
    const { invoke } = await import('@tauri-apps/api/core')
    const t = (await invoke('get_build_info')) as { epoch: string; semver: string; gitSha: string }
    const epochNum = Number.parseInt(t.epoch, 10)
    const merged: BuildInfo = {
      epoch: Number.isFinite(epochNum) ? epochNum : base.epoch,
      semver: t.semver || base.semver,
      gitSha: t.gitSha || base.gitSha,
      builtAtIso: new Date((Number.isFinite(epochNum) ? epochNum : base.epoch) * 1000).toISOString(),
    }
    return merged
  } catch (_err) {
    return base
  }
}

