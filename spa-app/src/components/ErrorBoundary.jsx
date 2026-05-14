import React from 'react';
import { captureError } from '../utils/sentry';

// A chunk-load failure usually means the user has an old index.html that
// references chunk hashes from a previous deploy. Hard-reloading once
// pulls a fresh index.html which lists the current chunk filenames.
const CHUNK_RELOAD_KEY = '__chunk_reload_attempted_at';
const isChunkLoadError = (error) => {
  const msg = (error?.message || '').toLowerCase();
  const name = (error?.name || '').toLowerCase();
  return (
    name === 'chunkloaderror' ||
    msg.includes('failed to fetch dynamically imported module') ||
    msg.includes('loading chunk') ||
    msg.includes('loading css chunk') ||
    msg.includes('importing a module script failed') ||
    msg.includes('expected a javascript module script') ||
    // Vite's vendor-pdf preloader throws this when a CSS chunk referenced
    // by a route's lazy import has been unpublished — i.e. the user is on
    // an old index.html after a deploy and the hashed filename no longer
    // exists on the server. Same fix as the other chunk-load failures:
    // hard reload to pull a fresh index.html with current hashes.
    msg.includes('unable to preload css')
  );
};

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    if (isChunkLoadError(error)) {
      // Avoid an infinite reload loop if the new deploy is also broken.
      const last = Number(sessionStorage.getItem(CHUNK_RELOAD_KEY) || 0);
      if (Date.now() - last > 30_000) {
        sessionStorage.setItem(CHUNK_RELOAD_KEY, String(Date.now()));
        window.location.reload();
        return;
      }
    }

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
