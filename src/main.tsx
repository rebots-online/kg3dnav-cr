// SPDX-License-Identifier: Apache-2.0
import React from 'react'
import ReactDOM from 'react-dom/client'
import AppShell from './components/AppShell'

class ErrorBoundary extends React.Component<{}, { hasError: boolean; error?: any }> {
  constructor(props: {}) {
    super(props)
    this.state = { hasError: false }
  }
  static getDerivedStateFromError(error: any) {
    return { hasError: true, error }
  }
  componentDidCatch(error: any, errorInfo: any) {
    console.error('App Error:', error, errorInfo)
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 20, background: '#000', color: '#fff', fontFamily: 'monospace', height: '100vh' }}>
          <h1>3D Knowledge Graph Navigator — Error</h1>
          <pre style={{ color: '#ff6b6b', whiteSpace: 'pre-wrap' }}>{String(this.state.error)}</pre>
        </div>
      )
    }
    return this.props.children as any
  }
}

const root = ReactDOM.createRoot(document.getElementById('root')!)
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <AppShell />
    </ErrorBoundary>
  </React.StrictMode>
)

