import React from 'react';
import { captureError } from '../utils/sentry';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({
      error: error,
      errorInfo: errorInfo
    });
    // Log error to console in development
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    // Send to Sentry in production
    captureError(error, { componentStack: errorInfo?.componentStack });
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          className="error-boundary"
          role="alert"
          aria-live="assertive"
        >
          <div className="error-boundary-content">
            <div className="error-icon" aria-hidden="true">!</div>
            <h1 id="error-title">Something went wrong</h1>
            <p id="error-description">We're sorry, but something unexpected happened. Please try again.</p>

            {this.state.error && (
              <details className="error-details" style={{ marginTop: '1rem', textAlign: 'left', maxWidth: '600px', margin: '1rem auto', fontSize: '0.8rem' }}>
                <summary style={{ cursor: 'pointer', color: '#666' }}>Error Details</summary>
                <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', background: '#f5f5f5', padding: '1rem', borderRadius: '8px', marginTop: '0.5rem' }}>{this.state.error.toString()}</pre>
                <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', background: '#f5f5f5', padding: '1rem', borderRadius: '8px', marginTop: '0.5rem', maxHeight: '200px', overflow: 'auto' }}>{this.state.errorInfo?.componentStack}</pre>
              </details>
            )}

            <div className="error-actions" role="group" aria-label="Error recovery options">
              <button
                className="btn btn-primary"
                onClick={this.handleRetry}
                aria-describedby="error-description"
              >
                Try Again
              </button>
              <button
                className="btn btn-secondary"
                onClick={this.handleGoHome}
              >
                Go to Home
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
