/**
 * Storage abstraction for initiative PDFs.
 *
 * V1 (this file): LocalDiskPdfStorage — writes to `${LOCAL_STORAGE_DIR}/initiative-pdfs/{projectId}/{pdfId}/original.pdf`.
 *
 * TODO(ADR-007): swap LocalDiskPdfStorage for an S3PresignedStorage implementation
 *   (see SPEC-002 §Storage layer and ADR-012). The interface IPdfStorage was
 *   designed to make that swap drop-in — DO NOT widen it with disk-specific
 *   primitives. Anything that touches a real filesystem path belongs ONLY in
 *   LocalDiskPdfStorage.
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';

export interface PdfStorageMetadata {
  fileKey: string;
  fileSize: number;
  mimeType: string;
}

export interface SavePdfInput {
  projectId: string;
  pdfId: string;
  fileName: string;
  mimeType: string;
  bytes: Buffer;
}

export interface IPdfStorage {
  savePdf(input: SavePdfInput): Promise<PdfStorageMetadata>;
  readPdf(fileKey: string): Promise<Buffer>;
  deletePdf(fileKey: string): Promise<void>;
  exists(fileKey: string): Promise<boolean>;
  getMetadata(fileKey: string): Promise<PdfStorageMetadata | null>;
}

/**
 * Sanitise a single path segment so it cannot escape the storage root.
 * Allows alphanumeric, dash, underscore. Strips path separators and ".." traversal.
 */
function safeSegment(raw: string): string {
  const cleaned = raw.replace(/[^a-zA-Z0-9_-]/g, '');
  if (!cleaned || cleaned === '.' || cleaned === '..') {
    throw new Error(`storage: invalid path segment "${raw}"`);
  }
  return cleaned;
}

/**
 * Disk-backed PDF storage. Filesystem layout is:
 *
 *   ${rootDir}/initiative-pdfs/{projectId}/{pdfId}/original.pdf
 *
 * The constructor is the ONLY place that talks to disk root configuration.
 */
export class LocalDiskPdfStorage implements IPdfStorage {
  private readonly rootDir: string;

  constructor(rootDir: string) {
    if (!rootDir) {
      throw new Error('LocalDiskPdfStorage requires a non-empty rootDir');
    }
    this.rootDir = path.resolve(rootDir);
  }

  /** Returns the relative key stored on the `InitiativePdf.fileKey` column. */
  private keyFor(projectId: string, pdfId: string): string {
    const project = safeSegment(projectId);
    const pdf = safeSegment(pdfId);
    return path.posix.join('initiative-pdfs', project, pdf, 'original.pdf');
  }

  /** Resolves a `fileKey` to an absolute path, refusing keys that escape `rootDir`. */
  private absolutePath(fileKey: string): string {
    const normalized = path.normalize(fileKey).replace(/^[\\/]+/, '');
    const abs = path.resolve(this.rootDir, normalized);
    if (!abs.startsWith(this.rootDir + path.sep) && abs !== this.rootDir) {
      throw new Error(`storage: fileKey "${fileKey}" escapes root`);
    }
    return abs;
  }

  async savePdf(input: SavePdfInput): Promise<PdfStorageMetadata> {
    const fileKey = this.keyFor(input.projectId, input.pdfId);
    const abs = this.absolutePath(fileKey);
    await fs.mkdir(path.dirname(abs), { recursive: true });
    await fs.writeFile(abs, input.bytes);
    return {
      fileKey,
      fileSize: input.bytes.byteLength,
      mimeType: input.mimeType,
    };
  }

  async readPdf(fileKey: string): Promise<Buffer> {
    const abs = this.absolutePath(fileKey);
    return fs.readFile(abs);
  }

  async deletePdf(fileKey: string): Promise<void> {
    const abs = this.absolutePath(fileKey);
    try {
      await fs.unlink(abs);
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      // Idempotent: missing file is treated as already-deleted.
      if (code === 'ENOENT') return;
      throw err;
    }
    // Best-effort cleanup of the now-empty pdfId directory; ignore if not empty.
    try {
      await fs.rmdir(path.dirname(abs));
    } catch {
      /* directory not empty or already gone — ignore */
    }
  }

  async exists(fileKey: string): Promise<boolean> {
    const abs = this.absolutePath(fileKey);
    try {
      await fs.access(abs);
      return true;
    } catch {
      return false;
    }
  }

  async getMetadata(fileKey: string): Promise<PdfStorageMetadata | null> {
    const abs = this.absolutePath(fileKey);
    try {
      const stat = await fs.stat(abs);
      return {
        fileKey,
        fileSize: stat.size,
        // mimeType is not stored on disk; callers re-source it from the DB row.
        mimeType: 'application/pdf',
      };
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code === 'ENOENT') return null;
      throw err;
    }
  }
}
