import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CallApiService } from '../services/CallApiService';

describe('CallApiService', () => {
  let apiService: CallApiService;
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.resetAllMocks();
    global.fetch = mockFetch;
    apiService = new CallApiService('http://localhost:8080/api/v1');
  });

  it('createCall sends POST /calls and returns response', async () => {
    const mockResponse = {
      callId: 'CALL-1001',
      status: 'CREATED',
      caller: 'Alice',
      receiver: 'Bob',
      createdAt: '2026-09-19T03:00:00Z'
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse
    });

    const result = await apiService.createCall('Alice', 'Bob');

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe('http://localhost:8080/api/v1/calls');
    expect(options.method).toBe('POST');
    expect(JSON.parse(options.body)).toEqual({ caller: 'Alice', receiver: 'Bob' });
    expect(result.callId).toBe('CALL-1001');
    expect(result.status).toBe('CREATED');
  });

  it('startCall sends POST /calls/{id}/start and returns status ACTIVE', async () => {
    const mockResponse = {
      callId: 'CALL-1001',
      status: 'ACTIVE',
      startedAt: '2026-09-19T03:00:05Z'
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse
    });

    const result = await apiService.startCall('CALL-1001');

    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:8080/api/v1/calls/CALL-1001/start',
      expect.objectContaining({ method: 'POST' })
    );
    expect(result.status).toBe('ACTIVE');
  });

  it('getCall sends GET /calls/{id} and returns call details', async () => {
    const mockResponse = {
      callId: 'CALL-1001',
      caller: 'Alice',
      receiver: 'Bob',
      status: 'COMPLETED',
      durationSec: 120,
      decision: 'HUMAN'
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse
    });

    const result = await apiService.getCall('CALL-1001');

    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:8080/api/v1/calls/CALL-1001',
      expect.objectContaining({ method: 'GET' })
    );
    expect(result.callId).toBe('CALL-1001');
    expect(result.durationSec).toBe(120);
  });

  it('endCall sends POST /calls/{id}/end with reason and returns status ENDED', async () => {
    const mockResponse = {
      callId: 'CALL-1001',
      status: 'ENDED',
      endedAt: '2026-09-19T03:02:00Z'
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse
    });

    const result = await apiService.endCall('CALL-1001', 'USER_ENDED');

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe('http://localhost:8080/api/v1/calls/CALL-1001/end');
    expect(options.method).toBe('POST');
    const body = JSON.parse(options.body);
    expect(body.reason).toBe('USER_ENDED');
    expect(result.status).toBe('ENDED');
  });

  it('getRecentCalls sends GET /calls and returns list of calls', async () => {
    const mockResponse = {
      calls: [
        { callId: 'CALL-1', caller: 'A', receiver: 'B', status: 'COMPLETED', createdAt: '2026-09-19T02:00:00Z' }
      ],
      totalElements: 1,
      page: 0,
      size: 10
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse
    });

    const calls = await apiService.getRecentCalls();
    expect(calls).toHaveLength(1);
    expect(calls[0].callId).toBe('CALL-1');
  });

  it('translates HTTP 404 response to CallApiError', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      json: async () => ({
        status: 404,
        code: 'CALL_NOT_FOUND',
        message: 'Call session not found: CALL-9999'
      })
    });

    await expect(apiService.getCall('CALL-9999')).rejects.toMatchObject({
      status: 404,
      code: 'CALL_NOT_FOUND',
      message: 'Call session not found: CALL-9999'
    });
  });

  it('translates network fetch failure into NETWORK_ERROR CallApiError', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Failed to fetch'));

    await expect(apiService.checkHealth()).rejects.toMatchObject({
      status: 0,
      code: 'NETWORK_ERROR',
      message: 'Failed to fetch'
    });
  });
});
