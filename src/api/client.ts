import type { AppConfig } from '../config';

export type ApiEnvelope<T> = {
  status: 'success' | 'error';
  data?: T;
  message?: string;
  has_more?: boolean;
  timestamp?: string;
};

export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export type ApiPage<T> = {
  data: T;
  hasMore: boolean;
};

export type ApiClientOptions = {
  config: AppConfig;
  getAuthToken: () => string | null;
  onUnauthorized?: () => void;
};

export class ChatPalezApiClient {
  private readonly baseUrl: URL;
  private readonly getAuthToken: () => string | null;
  private readonly onUnauthorized?: () => void;

  constructor(options: ApiClientOptions) {
    this.baseUrl = new URL('/apis/php/', options.config.origin);
    this.getAuthToken = options.getAuthToken;
    this.onUnauthorized = options.onUnauthorized;
  }

  async get<T>(path: string, query?: Record<string, string | number | boolean | undefined>): Promise<T> {
    const url = this.buildUrl(path, query);
    return this.request<T>(url, { method: 'GET' });
  }

  async getPage<T>(path: string, query?: Record<string, string | number | boolean | undefined>): Promise<ApiPage<T>> {
    const url = this.buildUrl(path, query);
    const envelope = await this.requestEnvelope<T>(url, { method: 'GET' });
    return { data: envelope.data as T, hasMore: Boolean(envelope.has_more) };
  }

  async post<T>(path: string, body?: unknown): Promise<T> {
    const url = this.buildUrl(path);
    return this.request<T>(url, {
      method: 'POST',
      body: body === undefined ? undefined : JSON.stringify(body)
    });
  }

  async postForm<T>(path: string, body: FormData): Promise<T> {
    const url = this.buildUrl(path);
    return this.request<T>(url, { method: 'POST', body });
  }

  async postFormWithProgress<T>(
    path: string,
    body: FormData,
    onProgress?: (loaded: number, total: number | null) => void,
    timeoutMs = 120000
  ): Promise<T> {
    const url = this.buildUrl(path);
    const token = this.getAuthToken();

    return new Promise<T>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', url.toString(), true);
      xhr.setRequestHeader('Accept', 'application/json');
      xhr.setRequestHeader('X-Requested-With', 'XMLHttpRequest');
      xhr.setRequestHeader('x-mobile-client', 'chatpalez-mobile-v1');
      xhr.timeout = timeoutMs;
      if (token) xhr.setRequestHeader('x-auth-token', token);

      xhr.upload.addEventListener('progress', (event) => {
        onProgress?.(event.loaded, event.lengthComputable ? event.total : null);
      });

      xhr.addEventListener('error', () => reject(new ApiError('Unable to reach ChatPalez. Check your connection and try again.', 0)));
      xhr.addEventListener('timeout', () => reject(new ApiError('The attachment upload timed out. Check your connection and try again.', 408)));
      xhr.addEventListener('abort', () => reject(new ApiError('The upload was cancelled.', 0)));
      xhr.addEventListener('load', () => {
        let envelope: ApiEnvelope<T> | null = null;
        try {
          envelope = JSON.parse(xhr.responseText) as ApiEnvelope<T>;
        } catch {
          // Normalize below.
        }
        if (xhr.status === 401 && token) this.onUnauthorized?.();
        if (xhr.status < 200 || xhr.status >= 300 || envelope?.status === 'error') {
          reject(new ApiError(envelope?.message || `ChatPalez request failed (${xhr.status}).`, xhr.status));
          return;
        }
        if (!envelope || envelope.status !== 'success') {
          reject(new ApiError('ChatPalez returned an unexpected response.', xhr.status));
          return;
        }
        resolve(envelope.data as T);
      });
      xhr.send(body);
    });
  }

  async downloadWithProgress(url: string, onProgress?: (loaded: number, total: number | null) => void): Promise<Blob> {
    const token = this.getAuthToken();
    return new Promise<Blob>((resolve, reject) => {
      const xhr = new XMLHttpRequest(); xhr.open('GET', url, true); xhr.responseType = 'blob';
      xhr.setRequestHeader('Accept', '*/*'); xhr.setRequestHeader('x-mobile-client', 'chatpalez-mobile-v1'); if (token) xhr.setRequestHeader('x-auth-token', token);
      xhr.addEventListener('progress', (event) => onProgress?.(event.loaded, event.lengthComputable ? event.total : null));
      xhr.addEventListener('error', () => reject(new ApiError('Unable to download the attachment.', 0)));
      xhr.addEventListener('abort', () => reject(new ApiError('The download was cancelled.', 0)));
      xhr.addEventListener('load', () => { if (xhr.status < 200 || xhr.status >= 300) { reject(new ApiError('Attachment download failed (' + xhr.status + ').', xhr.status)); return; } resolve(xhr.response as Blob); });
      xhr.send();
    });
  }

  async delete<T>(path: string): Promise<T> {
    const url = this.buildUrl(path);
    return this.request<T>(url, { method: 'DELETE' });
  }

  private buildUrl(path: string, query?: Record<string, string | number | boolean | undefined>): URL {
    const normalized = path.replace(/^\/+/, '');
    const url = new URL(normalized, this.baseUrl);
    if (query) {
      for (const [key, value] of Object.entries(query)) {
        if (value !== undefined) url.searchParams.set(key, String(value));
      }
    }
    return url;
  }

  private async request<T>(url: URL, init: RequestInit): Promise<T> {
    const envelope = await this.requestEnvelope<T>(url, init);
    return envelope.data as T;
  }

  private async requestEnvelope<T>(url: URL, init: RequestInit): Promise<ApiEnvelope<T>> {
    const headers = new Headers(init.headers);
    headers.set('Accept', 'application/json');
    headers.set('x-mobile-client', 'chatpalez-mobile-v1');

    if (init.body !== undefined && !(init.body instanceof FormData)) headers.set('Content-Type', 'application/json');

    const token = this.getAuthToken();
    if (token) headers.set('x-auth-token', token);

    let response: Response;
    try {
      response = await fetch(url, {
        ...init,
        headers,
        credentials: 'include'
      });
    } catch {
      throw new ApiError('Unable to reach ChatPalez. Check your connection and try again.', 0);
    }

    let envelope: ApiEnvelope<T> | null = null;
    try {
      envelope = (await response.json()) as ApiEnvelope<T>;
    } catch {
      // Fall through to normalized HTTP error below.
    }

    if (!response.ok || envelope?.status === 'error') {
      if (response.status === 401 && token) this.onUnauthorized?.();
      throw new ApiError(envelope?.message || `ChatPalez request failed (${response.status}).`, response.status);
    }

    if (!envelope || envelope.status !== 'success') {
      throw new ApiError('ChatPalez returned an unexpected response.', response.status);
    }

    return envelope;
  }
}
