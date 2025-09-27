// SPDX-License-Identifier: Apache-2.0
import { create } from 'zustand'

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

export type LogEntry = {
  id: string
  timestamp: string
  level: LogLevel
  source: string
  message: string
  detail?: unknown
}

type LogStoreState = {
  entries: LogEntry[]
  isVisible: boolean
  dock: 'left' | 'right'
  width: number
  autoScroll: boolean
  unreadErrorCount: number
  append: (entry: Omit<LogEntry, 'id' | 'timestamp'> & { id?: string; timestamp?: string }) => void
  clear: () => void
  setVisible: (value: boolean) => void
  setDock: (value: 'left' | 'right') => void
  setWidth: (width: number) => void
  setAutoScroll: (value: boolean) => void
  consumeErrorBadge: () => void
}

const MAX_ENTRIES = 500

function ensureId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export const useLogStore = create<LogStoreState>()((set) => ({
  entries: [],
  isVisible: false,
  dock: 'right',
  width: 360,
  autoScroll: true,
  unreadErrorCount: 0,
  append: (entry) => {
    const timestamp = entry.timestamp ?? new Date().toISOString()
    const id = entry.id ?? ensureId('log')
    const normalized: LogEntry = {
      ...entry,
      id,
      timestamp,
    }
    set((state) => {
      const entries = [...state.entries, normalized]
      if (entries.length > MAX_ENTRIES) entries.splice(0, entries.length - MAX_ENTRIES)
      const unreadErrorCount =
        normalized.level === 'error' ? state.unreadErrorCount + 1 : state.unreadErrorCount
      return {
        entries,
        unreadErrorCount,
      }
    })
  },
  clear: () => set({ entries: [], unreadErrorCount: 0 }),
  setVisible: (value) =>
    set((state) => ({
      isVisible: value,
      unreadErrorCount: value ? 0 : state.unreadErrorCount,
    })),
  setDock: (value) => set({ dock: value }),
  setWidth: (width) => {
    const clamped = Math.min(640, Math.max(240, Math.round(width)))
    set({ width: clamped })
  },
  setAutoScroll: (value) => set({ autoScroll: value }),
  consumeErrorBadge: () => set({ unreadErrorCount: 0 }),
}))

export const useLogEntries = () => useLogStore((state) => state.entries)

export const useLogPanelState = () =>
  useLogStore((state) => ({
    isVisible: state.isVisible,
    dock: state.dock,
    width: state.width,
    autoScroll: state.autoScroll,
    unreadErrorCount: state.unreadErrorCount,
    setVisible: state.setVisible,
    setDock: state.setDock,
    setWidth: state.setWidth,
    setAutoScroll: state.setAutoScroll,
    clear: state.clear,
    consumeErrorBadge: state.consumeErrorBadge,
  }))

function appendLog(level: LogLevel, source: string, message: string, detail?: unknown) {
  useLogStore.getState().append({ level, source, message, detail })
}

export const logDebug = (source: string, message: string, detail?: unknown) =>
  appendLog('debug', source, message, detail)
export const logInfo = (source: string, message: string, detail?: unknown) =>
  appendLog('info', source, message, detail)
export const logWarn = (source: string, message: string, detail?: unknown) =>
  appendLog('warn', source, message, detail)
export const logError = (source: string, message: string, detail?: unknown) =>
  appendLog('error', source, message, detail)

