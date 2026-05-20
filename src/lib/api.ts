const API_URL = '';

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
