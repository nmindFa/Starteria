/**
 * Regression: pdfAutofillService.uploadPdf must send the PDF as RAW BYTES with
 * `Content-Type: application/pdf` and the URL-encoded filename in `X-File-Name`.
 *
 * The backend (TASK-006) uses `express.raw({ type: 'application/pdf' })` rather
 * than multer — sending FormData (the legacy V1 shape) causes the controller to
 * reject the upload with `PDF_BODY_MISSING` (400) which the UI surfaces as
 * "No se pudo subir — Algo salió mal". This contract test guards against a
 * regression to the FormData shape.
 */

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

import { uploadPdf } from '../pdfAutofillService';

// Mock the axios `api` client. api.ts exports it both as `api` and as default.
vi.mock('../api', () => {
  const apiInstance = { post: vi.fn(), get: vi.fn(), delete: vi.fn(), put: vi.fn() };
  return {
    default: apiInstance,
    api: apiInstance,
    parseApiError: vi.fn((e: unknown) => ({ code: 'UNKNOWN', message: String(e) })),
  };
});

import { api } from '../api';

const apiPost = api.post as unknown as ReturnType<typeof vi.fn>;

/**
 * jsdom's File doesn't implement arrayBuffer() in older versions; build a polyfilled
 * File-like that exposes the same API uploadPdf uses (`name`, `type`, `size`, `arrayBuffer`).
 */
function makeFile(bytes: Uint8Array, name: string): File {
  const file = new File([bytes], name, { type: 'application/pdf' });
  if (typeof file.arrayBuffer !== 'function') {
    Object.defineProperty(file, 'arrayBuffer', {
      value: () =>
        Promise.resolve(
          bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer,
        ),
      configurable: true,
    });
  }
  return file;
}

describe('pdfAutofillService.uploadPdf — TASK-006 raw-body contract', () => {
  beforeEach(() => {
    apiPost.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('sends an ArrayBuffer body (not FormData) with Content-Type application/pdf', async () => {
    apiPost.mockResolvedValueOnce({
      data: {
        success: true,
        data: { pdfId: 'pdf-1', fileName: 'test.pdf', sizeBytes: 6 },
      },
    });

    const bytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31]);
    const file = makeFile(bytes, 'test.pdf');

    await uploadPdf('proj-1', file);

    expect(apiPost).toHaveBeenCalledTimes(1);
    const [url, body, config] = apiPost.mock.calls[0] as [string, unknown, Record<string, unknown>];

    expect(url).toBe('/initiatives/proj-1/pdfs');
    expect(body).toBeInstanceOf(ArrayBuffer);
    expect(body).not.toBeInstanceOf(FormData);

    const headers = config?.headers as Record<string, string>;
    expect(headers['Content-Type']).toBe('application/pdf');
    expect(headers['X-File-Name']).toBe('test.pdf'); // simple name, no encoding diff
  });

  it('URL-encodes non-ASCII filenames so they survive the HTTP header transport', async () => {
    apiPost.mockResolvedValueOnce({
      data: {
        success: true,
        data: { pdfId: 'pdf-2', fileName: 'Iniciativa-año.pdf', sizeBytes: 6 },
      },
    });

    const file = makeFile(new Uint8Array([0x25, 0x50, 0x44, 0x46]), 'Iniciativa año.pdf');

    await uploadPdf('proj-1', file);

    const [, , config] = apiPost.mock.calls[0] as [string, unknown, Record<string, unknown>];
    const headers = config?.headers as Record<string, string>;
    // Spaces and "ñ" must be percent-encoded.
    expect(headers['X-File-Name']).toBe('Iniciativa%20a%C3%B1o.pdf');
  });

  it('reports upload progress through the optional onProgress callback', async () => {
    apiPost.mockImplementation(async (_url, _body, config) => {
      // Simulate axios firing onUploadProgress at 50% and 100%.
      const onUploadProgress = config?.onUploadProgress as
        | ((e: { loaded: number; total: number }) => void)
        | undefined;
      onUploadProgress?.({ loaded: 50, total: 100 });
      onUploadProgress?.({ loaded: 100, total: 100 });
      return {
        data: { success: true, data: { pdfId: 'pdf-3', fileName: 't.pdf', sizeBytes: 100 } },
      };
    });

    const file = makeFile(new Uint8Array(100), 't.pdf');
    const progressCalls: number[] = [];

    await uploadPdf('proj-1', file, (pct) => progressCalls.push(pct));

    expect(progressCalls).toEqual([50, 100]);
  });
});
