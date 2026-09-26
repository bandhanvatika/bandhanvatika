const API_BASE = '/api/v1';

export async function apiRequest<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<{ success: boolean; data?: T; error?: { code: string; message: string }; [key: string]: any }> {
  const token = localStorage.getItem('bv_token');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const res = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
    });

    const data = await res.json();
    if (!res.ok) {
      if (res.status === 401 && !endpoint.includes('/auth/login')) {
        localStorage.removeItem('bv_token');
        localStorage.removeItem('bv_user');
        window.dispatchEvent(new Event('auth:unauthorized'));
      }
      return {
        success: false,
        error: data.error || { code: 'HTTP_ERROR', message: `Request failed with status ${res.status}` },
      };
    }

    return data;
  } catch (err: any) {
    return {
      success: false,
      error: { code: 'NETWORK_ERROR', message: err.message || 'Network request failed' },
    };
  }
}
