const getApiUrl = (): string => {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    const href = window.location.href || '';
    
    // Direct backends are standard local dev or the absolute Cloud Run backend URL itself.
    // Sandbox environments like googleusercontent.com, withgoogle.com, aistudio.google, or port-forwarding subdomains (e.g. 3000-xxx)
    // are NOT direct backends. For those, we must use the absolute Cloud Run url to connect directly to the Express server.
    const isDirectBackend = !!(hostname && (
      hostname.includes('localhost') || 
      hostname.includes('127.0.0.1') || 
      (hostname.includes('run.app') && !hostname.includes('3000-') && !/\d+-/.test(hostname))
    ));

    // If we are NOT on a direct backend (e.g. we are inside a sandboxed iframe with an opaque origin where hostname is empty,
    // or we are on googleusercontent.com, withgoogle.com, etc.), we MUST use the absolute backend URL.
    // Otherwise, standard relative fetches will be made to the sandbox target (e.g. googleusercontent.com/api/...) and fail.
    if (!isDirectBackend) {
      const isPre = 
        href.includes('ais-pre') || 
        href.includes('-pre-') || 
        href.includes('pre-') ||
        (typeof document !== 'undefined' && (
          document.referrer.includes('ais-pre') ||
          document.referrer.includes('-pre-') ||
          document.referrer.includes('pre-')
        ));
      if (isPre) {
        return 'https://ais-pre-lygy44gzfdl3sscb7yvlge-643827784442.asia-southeast1.run.app';
      } else {
        return 'https://ais-dev-lygy44gzfdl3sscb7yvlge-643827784442.asia-southeast1.run.app';
      }
    }
  }
  return '';
};

export const API_URL = getApiUrl();

export function resolveUrl(url: string | null | undefined): string {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) {
    return url;
  }
  if (API_URL) {
    return `${API_URL}${url}`;
  }
  if (typeof window !== 'undefined') {
    return `${window.location.origin}${url}`;
  }
  return url;
}

export async function apiRequest(endpoint: string, options: any = {}) {
  const token = localStorage.getItem('token');

  const headers: any = {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
    ...options.headers,
  };

  // If body is FormData, delete Content-Type to let browser set it with boundary
  if (options.body instanceof FormData) {
    delete headers['Content-Type'];
  } else if (options.body && typeof options.body === 'object') {
    // If body is an object (and not null), stringify it
    options.body = JSON.stringify(options.body);
  }

  // Handle explicitly undefined Content-Type
  if (options.headers && options.headers['Content-Type'] === undefined) {
    delete headers['Content-Type'];
  }

  const response = await fetch(`${API_URL}/api${endpoint}`, {
    ...options,
    headers,
  });

  const contentType = response.headers.get('content-type');
  const isJson = contentType && contentType.includes('application/json');

  if (!response.ok) {
    if (isJson) {
      const error = await response.json();
      
      if (response.status === 403) {
        throw new Error(`${error.message || 'Akses ditolak (403)'}. (Role Anda: ${error.currentRole || 'Unknown'})`);
      }
      
      throw new Error(error.message || `Error ${response.status}: Something went wrong`);
    } else {
      const text = await response.text();
      console.error(`Error ${response.status} Non-JSON response:`, text);
      
      if (text.includes('Cookie check') || text.includes('Action required to load your app')) {
        throw new Error('Sesi AI Studio berakhir atau diblokir oleh browser. Silakan segarkan halaman atau aktifkan cookies pihak ketiga.');
      }
      
      throw new Error(`Error ${response.status}: Server mengembalikan format yang tidak dikenali.`);
    }
  }

  if (!isJson) {
    const text = await response.text();
    
    // Detect platform cookie check/auth redirect in 200 OK responses
    if (text.includes('Cookie check') || text.includes('Action required to load your app')) {
      throw new Error('Sesi AI Studio berakhir atau diblokir oleh browser. Silakan segarkan halaman atau aktifkan cookies pihak ketiga.');
    }

    console.error('Unexpected non-JSON response:', text);
    throw new Error('Server returned an unexpected format (not JSON).');
  }

  return response.json();
}
