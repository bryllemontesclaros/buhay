import React from 'react'

/**
 * Global ErrorBoundary to catch rendering exceptions within child components
 * and display a fallback UI instead of unmounting the whole React app tree.
 */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an unexpected error:', error, errorInfo)
  }

  handleReload = () => {
    window.location.reload()
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          padding: '24px',
          textAlign: 'center',
          backgroundColor: 'var(--bg-base, #ffffff)',
          color: 'var(--text-primary, #111111)',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Inter", sans-serif'
        }}>
          <div style={{
            maxWidth: '480px',
            padding: '32px',
            borderRadius: '16px',
            border: '1px solid var(--border-light, #eaeaea)',
            backgroundColor: 'var(--surface, #ffffff)',
            boxShadow: '0 12px 40px rgba(0,0,0,0.08)'
          }}>
            <h2 style={{ fontSize: '22px', fontWeight: 700, marginBottom: '12px' }}>
              Something went wrong
            </h2>
            <p style={{ color: 'var(--text-muted, #666666)', fontSize: '14px', lineHeight: 1.5, marginBottom: '24px' }}>
              An unexpected error occurred while displaying this section. You can try refreshing or resetting the view.
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button
                onClick={this.handleReset}
                style={{
                  padding: '10px 20px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-light, #eaeaea)',
                  backgroundColor: 'transparent',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: '14px'
                }}
              >
                Try Again
              </button>
              <button
                onClick={this.handleReload}
                style={{
                  padding: '10px 20px',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: 'var(--accent, #ff4500)',
                  color: '#ffffff',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: '14px'
                }}
              >
                Reload Page
              </button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
