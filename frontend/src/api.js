import axios from 'axios';

/**
 * Axios instance pre-configured for the CAOS-Mark FastAPI backend.
 *
 * In development Vite proxies /api → http://localhost:8000.
 * In production set VITE_API_BASE_URL to your Cloud Run URL.
 */
const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? '/api',
  timeout: 60_000,            // 60 s — watermarking can take a few seconds
  headers: { Accept: 'application/json' },
});

// Global error interceptor — surface FastAPI detail messages
api.interceptors.response.use(
  (res) => res,
  (err) => {
    const detail =
      err?.response?.data?.detail ??
      err?.message              ??
      'An unexpected error occurred.';
    return Promise.reject(new Error(detail));
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// Typed helper functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /protect
 * Embeds an invisible CAOS watermark into the image.
 *
 * @param {File}   file    Image file to watermark.
 * @param {string} label   Signature label (e.g. "GSC-2024-SPORTS-001").
 * @param {(pct: number) => void} onProgress  Upload progress callback.
 * @returns {Promise<{ blob: Blob, headers: Record<string,string> }>}
 */
export async function protectAsset(file, label, onProgress) {
  const form = new FormData();
  form.append('file', file);
  form.append('label', label);

  const response = await api.post('/protect', form, {
    responseType: 'blob',
    onUploadProgress: (e) => {
      if (onProgress && e.total) onProgress(Math.round((e.loaded / e.total) * 100));
    },
  });

  const headers = {};
  [
    'x-asset-id',
    'x-asset-url',
    'x-original-url',
    'x-signature-label',
    'x-signature-length',
  ].forEach((h) => {
    headers[h] = response.headers[h] ?? '';
  });

  return { blob: response.data, headers };
}

/**
 * POST /verify
 * Extracts the watermark from a suspect image and runs Gemini forensics.
 *
 * @param {File}   file         Suspect image.
 * @param {string} suspectUrl   URL where suspect content was found.
 * @param {string} accountName  Account / entity name.
 * @param {number} sigLen       Expected signature length in characters.
 * @returns {Promise<object>}   Full forensics report.
 */
export async function verifyAsset(file, suspectUrl, accountName, sigLen) {
  const form = new FormData();
  form.append('file',         file);
  form.append('suspect_url',  suspectUrl);
  form.append('account_name', accountName);
  form.append('sig_len',      String(sigLen));

  const { data } = await api.post('/verify', form);
  return data;
}

/**
 * GET /events
 * Fetch verification events for the Radar dashboard.
 *
 * @param {number} limit  Max events to retrieve (default 50).
 * @returns {Promise<{ events: object[], count: number }>}
 */
export async function fetchEvents(limit = 50) {
  const { data } = await api.get('/events', { params: { limit } });
  return data;
}

export default api;
