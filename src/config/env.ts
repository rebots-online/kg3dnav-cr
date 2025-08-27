// SPDX-License-Identifier: Apache-2.0
export type EnvConfig = {
  HKG_MCP_BASE_URL: string
}

// High-port default (per preference): 49160
export function getEnvConfig(): EnvConfig {
  // Vite-style env access
  const fromVite = (import.meta as any)?.env?.VITE_HKG_MCP_BASE_URL as string | undefined
  const base = fromVite || 'http://localhost:49160'
  return { HKG_MCP_BASE_URL: base.replace(/\/$/, '') }
}

