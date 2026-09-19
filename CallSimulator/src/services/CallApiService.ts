import {
  CreateCallRequest,
  CreateCallResponse,
  StartCallResponse,
  EndCallRequest,
  EndCallResponse,
  CallDetailsResponse,
  CallSummary,
  PagedCallsResponse,
  HealthResponse,
  CallApiError
} from '../types';

export class CallApiService {
  private baseUrl: string;

  constructor(baseUrl?: string) {
    const defaultUrl = typeof window !== 'undefined'
      ? `${window.location.protocol}//${window.location.hostname}:8080/api/v1`
      : 'http://localhost:8080/api/v1';
    this.baseUrl = baseUrl || import.meta.env.VITE_BACKEND_URL || defaultUrl;
  }

  private generateRequestId(): string {
    return 'sim-' + Math.random().toString(36).substring(2, 10);
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const headers = new Headers(options.headers || {});
    
    if (!headers.has('Content-Type') && options.body && !(options.body instanceof FormData)) {
      headers.set('Content-Type', 'application/json');
    }
    if (!headers.has('X-Request-ID')) {
      headers.set('X-Request-ID', this.generateRequestId());
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers
      });

      if (!response.ok) {
        let errorBody: Partial<CallApiError> = {};
        try {
          errorBody = await response.json();
        } catch {
          // ignore non-json error responses
        }

        const error: CallApiError = {
          status: response.status,
          code: errorBody.code || `HTTP_${response.status}`,
          message: errorBody.message || `Request failed with status ${response.status}`,
          timestamp: errorBody.timestamp
        };
        throw error;
      }

      return (await response.json()) as T;
    } catch (err: unknown) {
      if ((err as CallApiError).status) {
        throw err;
      }
      // Network or CORS errors
      const networkError: CallApiError = {
        status: 0,
        code: 'NETWORK_ERROR',
        message: err instanceof Error ? err.message : 'Failed to connect to Spring Boot backend'
      };
      throw networkError;
    }
  }

  /**
   * Create a new simulated call session on Spring Boot.
   */
  async createCall(caller: string, receiver: string): Promise<CreateCallResponse> {
    const payload: CreateCallRequest = { caller, receiver };
    return this.request<CreateCallResponse>('/calls', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  /**
   * Start the call session (transitions from CREATED to ACTIVE).
   */
  async startCall(callId: string): Promise<StartCallResponse> {
    return this.request<StartCallResponse>(`/calls/${encodeURIComponent(callId)}/start`, {
      method: 'POST'
    });
  }

  /**
   * Retrieve current call session state and details.
   */
  async getCall(callId: string): Promise<CallDetailsResponse> {
    return this.request<CallDetailsResponse>(`/calls/${encodeURIComponent(callId)}`, {
      method: 'GET'
    });
  }

  /**
   * End an active call session.
   */
  async endCall(callId: string, reason: string = 'USER_ENDED'): Promise<EndCallResponse> {
    const payload: EndCallRequest = {
      endedAt: new Date().toISOString(),
      reason
    };
    return this.request<EndCallResponse>(`/calls/${encodeURIComponent(callId)}/end`, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  /**
   * Retrieve recent call sessions for dialer history.
   */
  async getRecentCalls(): Promise<CallSummary[]> {
    try {
      const paged = await this.request<PagedCallsResponse>('/calls?page=0&size=10', {
        method: 'GET'
      });
      return paged.content || paged.calls || [];
    } catch {
      return [];
    }
  }

  /**
   * Check Spring Boot backend composite health.
   */
  async checkHealth(): Promise<HealthResponse> {
    return this.request<HealthResponse>('/health', {
      method: 'GET'
    });
  }
}

// Export singleton instance
export const callApiService = new CallApiService();
