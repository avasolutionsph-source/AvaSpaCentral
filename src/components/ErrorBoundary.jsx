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

            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details className="error-details">
                <summary>Error Details (Development Only)</summary>
                <pre>{this.state.error.toString()}</pre>
                <pre>{this.state.errorInfo?.componentStack}</pre>
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
