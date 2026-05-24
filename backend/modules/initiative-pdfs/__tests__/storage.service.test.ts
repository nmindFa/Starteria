import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { LocalDiskPdfStorage } from '../storage.service';

/**
 * Storage smoke tests — exercise the round-trip + a sanitisation failure path.
 * Each test runs against a fresh tmp dir so they can run in parallel.
 */
describe('LocalDiskPdfStorage', () => {
  let rootDir: string;
  let storage: LocalDiskPdfStorage;

  beforeEach(async () => {
    rootDir = await fs.mkdtemp(path.join(os.tmpdir(), 'pdf-storage-'));
    storage = new LocalDiskPdfStorage(rootDir);
  });

  afterEach(async () => {
    await fs.rm(rootDir, { recursive: true, force: true });
  });

  it('rejects construction with an empty rootDir', () => {
    expect(() => new LocalDiskPdfStorage('')).toThrow(/rootDir/);
  });

  it('saves, reads, reports metadata, and deletes a PDF round-trip', async () => {
    const payload = Buffer.from('%PDF-1.7\n... fake bytes ...');

    const meta = await storage.savePdf({
      projectId: 'cprojectid000000000000000',
      pdfId: 'pdf-uuid-abc',
      fileName: 'plan.pdf',
      mimeType: 'application/pdf',
      bytes: payload,
    });

    expect(meta.fileKey).toMatch(/initiative-pdfs\/cprojectid000000000000000\/pdf-uuid-abc\/original\.pdf$/);
    expect(meta.fileSize).toBe(payload.byteLength);

    expect(await storage.exists(meta.fileKey)).toBe(true);

    const read = await storage.readPdf(meta.fileKey);
    expect(read.equals(payload)).toBe(true);

    const stat = await storage.getMetadata(meta.fileKey);
    expect(stat?.fileSize).toBe(payload.byteLength);

    await storage.deletePdf(meta.fileKey);
    expect(await storage.exists(meta.fileKey)).toBe(false);
    expect(await storage.getMetadata(meta.fileKey)).toBeNull();
  });

  it('deletePdf is idempotent on missing files', async () => {
    await expect(
      storage.deletePdf('initiative-pdfs/does/not/exist/original.pdf'),
    ).resolves.toBeUndefined();
  });

  it('refuses path-traversal segments that sanitise to empty / dot-only', async () => {
    // `..` and `/` are stripped, leaving the segment empty -> the guard fires.
    await expect(
      storage.savePdf({
        projectId: '../',
        pdfId: 'pdf',
        fileName: 'x.pdf',
        mimeType: 'application/pdf',
        bytes: Buffer.from('x'),
      }),
    ).rejects.toThrow(/invalid path segment/);
  });

  it('sanitises path-traversal characters out of segments so writes land under the root', async () => {
    // `../escape` -> `escape` after stripping non-alphanumeric chars. The
    // resulting fileKey stays under the storage root.
    const meta = await storage.savePdf({
      projectId: '../escape',
      pdfId: 'pdf',
      fileName: 'x.pdf',
      mimeType: 'application/pdf',
      bytes: Buffer.from('x'),
    });
    expect(meta.fileKey).toBe('initiative-pdfs/escape/pdf/original.pdf');
  });

  it('refuses fileKeys that escape the root directory', async () => {
    await expect(storage.readPdf('../../etc/passwd')).rejects.toThrow();
  });
});
