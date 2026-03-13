/**
 * FileStorageAdapter — Abstracción para almacenamiento de archivos raw de tacógrafo
 * 
 * Permite desacoplar el almacenamiento de archivos del servicio de importación.
 * Implementaciones disponibles:
 *   - LocalFileStorageAdapter: filesystem local (desarrollo)
 *   - TmpStorageAdapter: /tmp para Vercel serverless (fallback)
 *   - (futuro) SupabaseStorageAdapter: Supabase Storage bucket (producción)
 */

import fs from 'fs';
import path from 'path';

// ====================================
// Interfaz
// ====================================

export interface StorageSaveResult {
  path: string;
  provider: string;
}

export interface FileStorageAdapter {
  readonly provider: string;
  save(buffer: Buffer, fileName: string): Promise<StorageSaveResult>;
  exists(filePath: string): Promise<boolean>;
  getUrl(filePath: string): Promise<string | null>;
  delete(filePath: string): Promise<void>;
}

// ====================================
// Local Filesystem Adapter (desarrollo)
// ====================================

export class LocalFileStorageAdapter implements FileStorageAdapter {
  readonly provider = 'local';
  private baseDir: string;

  constructor(baseDir?: string) {
    this.baseDir = baseDir || path.join(process.cwd(), 'public', 'uploads', 'tacografo');
  }

  async save(buffer: Buffer, fileName: string): Promise<StorageSaveResult> {
    if (!fs.existsSync(this.baseDir)) {
      fs.mkdirSync(this.baseDir, { recursive: true });
    }
    const safeName = `${Date.now()}_${fileName.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const filePath = path.join(this.baseDir, safeName);
    fs.writeFileSync(filePath, buffer);
    return { path: `/uploads/tacografo/${safeName}`, provider: this.provider };
  }

  async exists(filePath: string): Promise<boolean> {
    const fullPath = path.join(process.cwd(), 'public', filePath);
    return fs.existsSync(fullPath);
  }

  async getUrl(filePath: string): Promise<string | null> {
    const fullPath = path.join(process.cwd(), 'public', filePath);
    return fs.existsSync(fullPath) ? filePath : null;
  }

  async delete(filePath: string): Promise<void> {
    const fullPath = path.join(process.cwd(), 'public', filePath);
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
    }
  }
}

// ====================================
// Tmp Adapter (Vercel serverless)
// ====================================

export class TmpStorageAdapter implements FileStorageAdapter {
  readonly provider = 'tmp';
  private baseDir: string;

  constructor() {
    this.baseDir = '/tmp/tacografo';
  }

  async save(buffer: Buffer, fileName: string): Promise<StorageSaveResult> {
    if (!fs.existsSync(this.baseDir)) {
      fs.mkdirSync(this.baseDir, { recursive: true });
    }
    const safeName = `${Date.now()}_${fileName.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const filePath = path.join(this.baseDir, safeName);
    fs.writeFileSync(filePath, buffer);
    return { path: `/tmp/tacografo/${safeName}`, provider: this.provider };
  }

  async exists(filePath: string): Promise<boolean> {
    return fs.existsSync(filePath);
  }

  async getUrl(filePath: string): Promise<string | null> {
    return fs.existsSync(filePath) ? filePath : null;
  }

  async delete(filePath: string): Promise<void> {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }
}

// ====================================
// Factory — selecciona el adapter según el entorno
// ====================================

const IS_VERCEL = !!process.env.VERCEL;

let _defaultAdapter: FileStorageAdapter | null = null;

export function getStorageAdapter(): FileStorageAdapter {
  if (!_defaultAdapter) {
    _defaultAdapter = IS_VERCEL ? new TmpStorageAdapter() : new LocalFileStorageAdapter();
  }
  return _defaultAdapter;
}

/**
 * Para testing o inyección de dependencias
 */
export function setStorageAdapter(adapter: FileStorageAdapter): void {
  _defaultAdapter = adapter;
}
