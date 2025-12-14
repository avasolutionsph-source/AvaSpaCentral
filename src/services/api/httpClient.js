/**
 * HTTP Client
 *
 * Generic HTTP client for API communication with:
 * - Automatic auth headers
 * - Request timeout
 * - Retry logic
 * - Error handling
 */

import { getApiConfig } from './config';

class HttpClient {
  /**
   * Make an HTTP request
   * @param {string} endpoint - API endpoint (e.g., '/users')
   * @param {object} options - Fetch options
   * @returns {Promise<any>} Response data
   */
  async request(endpoint, options = {}) {
    const config = getApiConfig();
    const url = `${config.baseUrl}${endpoint}`;

    // Build headers
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers
    };

    // Add auth token if available
    const token = localStorage.getItem('token');
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    // Create abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), config.timeout);

    try {
      const response = await fetch(url, {
        ...options,
        headers,
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      // Handle non-OK responses
      if (!response.ok) {
        const errorBody = await response.text();
        let errorMessage;
        try {
          const errorJson = JSON.parse(errorBody);
          errorMessage = errorJson.message || errorJson.error || `HTTP ${response.status}`;
        } catch {
          errorMessage = errorBody || `HTTP ${response.status}`;
        }
        throw new HttpError(response.status, errorMessage);
      }

      // Return JSON or empty object for 204 No Content
      if (response.status === 204) {
        return {};
      }

      return await response.json();

    } catch (error) {
      clearTimeout(timeoutId);

      if (error.name === 'AbortError') {
        throw new HttpError(408, 'Request timeout');
      }

      if (error instanceof HttpError) {
        throw error;
      }

      // Network error
      throw new HttpError(0, error.message || 'Network error');
    }
  }

  /**
   * Make a GET request
   */
  async get(endpoint, params = {}) {
    const queryString = new URLSearchParams(params).toString();
    const url = queryString ? `${endpoint}?${queryString}` : endpoint;
    return this.request(url, { method: 'GET' });
  }

  /**
   * Make a POST request
   */
  async post(endpoint, data) {
    return this.request(endpoint, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  /**
   * Make a PUT request
   */
  async put(endpoint, data) {
    return this.request(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }

  /**
   * Make a PATCH request
   */
  async patch(endpoint, data) {
    return this.request(endpoint, {
      method: 'PATCH',
      body: JSON.stringify(data)
    });
  }

  /**
   * Make a DELETE request
   */
  async delete(endpoint) {
    return this.request(endpoint, { method: 'DELETE' });
  }

  /**
   * Health check - test if API is reachable
   * @returns {Promise<boolean>} True if API is reachable
   */
  async healthCheck() {
    try {
      const config = getApiConfig();
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout for health check

      const response = await fetch(`${config.baseUrl}/health`, {
        method: 'GET',
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Retry a request with exponential backoff
   * @param {Function} requestFn - Function that returns a promise
   * @param {number} maxRetries - Maximum number of retries
   * @returns {Promise<any>} Response data
   */
  async withRetry(requestFn, maxRetries = 3) {
    const config = getApiConfig();
    let lastError;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await requestFn();
      } catch (error) {
        lastError = error;

        // Don't retry client errors (4xx)
        if (error instanceof HttpError && error.status >= 400 && error.status < 500) {
          throw error;
        }

        // Don't retry on last attempt
        if (attempt === maxRetries) {
          break;
        }

        // Exponential backoff
        const delay = config.retryDelay * Math.pow(2, attempt);
        console.log(`[HttpClient] Retry ${attempt + 1}/${maxRetries} in ${delay}ms`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw lastError;
  }
}

/**
 * Custom HTTP error class
 */
export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
  }

  get isNetworkError() {
    return this.status === 0;
  }

  get isTimeout() {
    return this.status === 408;
  }

  get isUnauthorized() {
    return this.status === 401;
  }

  get isNotFound() {
    return this.status === 404;
  }

  get isServerError() {
    return this.status >= 500;
  }
}

// Export singleton instance
const httpClient = new HttpClient();
export default httpClient;
