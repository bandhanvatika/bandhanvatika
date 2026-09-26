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

    const contentType = res.headers.get('content-type') || '';
    let data: any = null;

    if (contentType.includes('application/json')) {
      try {
        data = await res.json();
      } catch {
        data = null;
      }
    }

    if (!res.ok) {
      if (res.status === 401 && !endpoint.includes('/auth/login')) {
        localStorage.removeItem('bv_token');
        localStorage.removeItem('bv_user');
        window.dispatchEvent(new Event('auth:unauthorized'));
      }

      if (data && data.error) {
        return {
          success: false,
          error: data.error,
        };
      }

      let errorMsg = `Server error (${res.status})`;
      if (res.status === 413) {
        errorMsg = 'Uploaded image file is too large. Please choose a smaller photo.';
      } else if (res.status === 502 || res.status === 504) {
        errorMsg = 'Server is currently restarting or taking too long. Please try again in a few seconds.';
      } else if (!data) {
        const text = await res.text().catch(() => '');
        if (text && text.length < 150 && !text.includes('<!DOCTYPE')) {
          errorMsg = text;
        }
      }

      return {
        success: false,
        error: { code: `HTTP_${res.status}`, message: errorMsg },
      };
    }

    return data || { success: true };
  } catch (err: any) {
    return {
      success: false,
      error: { code: 'NETWORK_ERROR', message: err.message || 'Network request failed. Please check your internet connection.' },
    };
  }
}
