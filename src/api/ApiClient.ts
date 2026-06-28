import {
  AppError,
  createAppError,
  ErrorType,
  mapStatusToErrorType,
} from "../models/AppError";

/**
 * Request interceptor function type
 */
type RequestInterceptor = (
  config: RequestConfig,
) => Promise<RequestConfig> | RequestConfig;

/**
 * Response interceptor function type
 */
type ResponseInterceptor<T = any> = (
  response: ApiResponse<T>,
) => Promise<ApiResponse<T>> | ApiResponse<T>;

/**
 * Error interceptor function type
 */
type ErrorInterceptor = (error: AppError) => Promise<AppError> | AppError;

/**
 * Configuration for API requests
 */
export interface RequestConfig extends Omit<RequestInit, "signal"> {
  url?: string;
  params?: Record<string, string | number | boolean>;
  timeout?: number; // milliseconds
  skipAuth?: boolean; // Skip auth header injection
}

/**
 * Standard API response structure
 */
export interface ApiResponse<T = any> {
  data: T;
  status: number;
  headers: Headers;
  config: RequestConfig;
}

/**
 * API Client configuration
 */
export interface ApiClientConfig {
  baseURL: string;
  timeout?: number; // Default timeout in milliseconds
  headers?: Record<string, string>;
  certificatePinning?: CertificatePinningConfig;
}

/**
 * Certificate pinning configuration
 * NOTE: Requires a development build - does not work in Expo Gow3
 */
export interface CertificatePinningConfig {
  enabled: boolean;
  pins: Array<{
    hostname: string;
    pin: string; // SHA256 hash of the certificate's public key
  }>;
}

/**
 * Singleton API client for all network requests
 * Features:
 * - Request/Response interceptors
 * - Automatic token injection
 * - Request timeout with AbortController
 * - Certificate pinning hook (requires dev build)
 * - Normalized error handling
 */
export class ApiClient {
  private static instance: ApiClient;
  private config: ApiClientConfig;
  private requestInterceptors: RequestInterceptor[] = [];
  private responseInterceptors: ResponseInterceptor[] = [];
  private errorInterceptors: ErrorInterceptor[] = [];
  private accessToken: string | null = null;

  private constructor(config: ApiClientConfig) {
    this.config = {
      timeout: 30000, // 30 seconds default
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      ...config,
    };

    // Initialize certificate pinning if configured
    this.initializeCertificatePinning();
  }

  /**
   * Get singleton instance of ApiClient
   * If no config is provided, uses default configuration
   */
  public static getInstance(config?: ApiClientConfig): ApiClient {
    if (!ApiClient.instance) {
      // Use provided config or default config
      const defaultConfig: ApiClientConfig = {
        baseURL: 'http://localhost:3000',
        timeout: 30000,
        headers: {},
        certificatePinning: {
          enabled: false,
          pins: [],
        },
      };

      ApiClient.instance = new ApiClient(config || defaultConfig);
    }

    // If instance exists but new config is provided, log a warning
    if (config && ApiClient.instance) {
      console.warn('[ApiClient] Instance already exists. Ignoring new config.');
    }

    return ApiClient.instance;
  }

  /**
   * Initialize certificate pinning
   * IMPORTANT: This is a hook point for certificate pinning implementation
   * Actual implementation requires:
   * 1. expo-build-properties in app.json/app.config.js
   * 2. A certificate pinning library (e.g., react-native-cert-pinner)
   * 3. A custom development build (does not work in Expo Go)
   *
   * Implementation steps for production:
   * 1. Install: expo install expo-build-properties
   * 2. Configure in app.config.js:
   *    plugins: [
   *      ['expo-build-properties', {
   *        android: { networkSecurityConfig: './network_security_config.xml' },
   *        ios: { NSAppTransportSecurity: { NSPinnedDomains: {...} } }
   *      }]
   *    ]
   * 3. Add certificate pins for your API domains
   * 4. Build with: eas build --profile development
   */
  private initializeCertificatePinning(): void {
    if (this.config.certificatePinning?.enabled) {
      // In a real implementation, this would configure the native pinning module
      console.log(
        "[ApiClient] Certificate pinning configured (requires dev build)",
      );

      // Document the pins for reference
      this.config.certificatePinning.pins.forEach((pin) => {
        console.log(`[ApiClient] Pin configured for ${pin.hostname}`);
      });

      // NOTE: In production, you would initialize the native module here:
      // CertPinner.initialize(this.config.certificatePinning.pins);
    }
  }

  /**
   * Set the access token for authenticated requests
   */
  public setAccessToken(token: string | null): void {
    this.accessToken = token;
  }

  /**
   * Add a request interceptor
   */
  public addRequestInterceptor(interceptor: RequestInterceptor): void {
    this.requestInterceptors.push(interceptor);
  }

  /**
   * Add a response interceptor
   */
  public addResponseInterceptor(interceptor: ResponseInterceptor): void {
    this.responseInterceptors.push(interceptor);
  }

  /**
   * Add an error interceptor
   */
  public addErrorInterceptor(interceptor: ErrorInterceptor): void {
    this.errorInterceptors.push(interceptor);
  }

  /**
   * Clear all interceptors
   */
  public clearInterceptors(): void {
    this.requestInterceptors = [];
    this.responseInterceptors = [];
    this.errorInterceptors = [];
  }

  /**
   * Build full URL with query parameters
   */
  private buildURL(
    endpoint: string,
    params?: Record<string, string | number | boolean>,
  ): string {
    const url = new URL(endpoint, this.config.baseURL);

    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        url.searchParams.append(key, String(value));
      });
    }

    return url.toString();
  }

  /**
   * Apply request interceptors
   */
  private async applyRequestInterceptors(
    config: RequestConfig,
  ): Promise<RequestConfig> {
    let modifiedConfig = { ...config };

    for (const interceptor of this.requestInterceptors) {
      modifiedConfig = await interceptor(modifiedConfig);
    }

    return modifiedConfig;
  }

  /**
   * Apply response interceptors
   */
  private async applyResponseInterceptors<T>(
    response: ApiResponse<T>,
  ): Promise<ApiResponse<T>> {
    let modifiedResponse = response;

    for (const interceptor of this.responseInterceptors) {
      modifiedResponse = await interceptor(modifiedResponse);
    }

    return modifiedResponse;
  }

  /**
   * Apply error interceptors
   */
  private async applyErrorInterceptors(error: AppError): Promise<AppError> {
    let modifiedError = error;

    for (const interceptor of this.errorInterceptors) {
      modifiedError = await interceptor(modifiedError);
    }

    return modifiedError;
  }

  /**
   * Main request method with timeout support
   */
  public async request<T = any>(
    endpoint: string,
    config: RequestConfig = {},
  ): Promise<ApiResponse<T>> {
    // Apply request interceptors
    const interceptedConfig = await this.applyRequestInterceptors(config);

    // Build full URL
    const url = this.buildURL(endpoint, interceptedConfig.params);

    // Set up timeout with AbortController
    const timeout = interceptedConfig.timeout || this.config.timeout || 30000;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    // Prepare headers
    const headers = new Headers({
      ...this.config.headers,
      ...interceptedConfig.headers,
    });

    // Add auth header if token exists and not skipped
    if (this.accessToken && !interceptedConfig.skipAuth) {
      headers.set("Authorization", `Bearer ${this.accessToken}`);
    }

    // Never log sensitive headers
    const logSafeHeaders = Object.fromEntries(
      Array.from(headers.entries()).map(([key, value]) => [
        key,
        key.toLowerCase() === "authorization" ? "[REDACTED]" : value,
      ]),
    );

    try {
      const response = await fetch(url, {
        ...interceptedConfig,
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Parse response
      const contentType = response.headers.get("content-type");
      let data: T;

      if (contentType?.includes("application/json")) {
        data = await response.json();
      } else {
        data = (await response.text()) as unknown as T;
      }

      // Handle HTTP errors
      if (!response.ok) {
        const errorType = mapStatusToErrorType(response.status);
        const error = createAppError(
          errorType,
          `HTTP ${response.status}: ${response.statusText}`,
          response.status,
          { response: data },
          response.headers.get("x-request-id") || undefined,
        );

        throw await this.applyErrorInterceptors(error);
      }

      // Create API response
      const apiResponse: ApiResponse<T> = {
        data,
        status: response.status,
        headers: response.headers,
        config: interceptedConfig,
      };

      // Apply response interceptors
      return await this.applyResponseInterceptors(apiResponse);
    } catch (error) {
      clearTimeout(timeoutId);

      // Handle different error types
      if ((error as Error).name === "AbortError") {
        const timeoutError = createAppError(
          ErrorType.TIMEOUT,
          `Request timeout after ${timeout}ms`,
          undefined,
          error,
        );
        throw await this.applyErrorInterceptors(timeoutError);
      }

      if (error instanceof TypeError && error.message.includes("fetch")) {
        const networkError = createAppError(
          ErrorType.NETWORK,
          "Network request failed. Please check your connection.",
          undefined,
          error,
        );
        throw await this.applyErrorInterceptors(networkError);
      }

      // If it's already an AppError, re-throw
      if ((error as AppError).type) {
        throw error;
      }

      // Unknown error
      const unknownError = createAppError(
        ErrorType.UNKNOWN,
        "An unexpected error occurred",
        undefined,
        error,
      );
      throw await this.applyErrorInterceptors(unknownError);
    }
  }

  /**
   * Convenience methods for common HTTP verbs
   */
  public async get<T = any>(
    endpoint: string,
    config?: RequestConfig,
  ): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { ...config, method: "GET" });
  }

  public async post<T = any>(
    endpoint: string,
    data?: any,
    config?: RequestConfig,
  ): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      ...config,
      method: "POST",
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  public async put<T = any>(
    endpoint: string,
    data?: any,
    config?: RequestConfig,
  ): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      ...config,
      method: "PUT",
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  public async patch<T = any>(
    endpoint: string,
    data?: any,
    config?: RequestConfig,
  ): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      ...config,
      method: "PATCH",
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  public async delete<T = any>(
    endpoint: string,
    config?: RequestConfig,
  ): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { ...config, method: "DELETE" });
  }
}
