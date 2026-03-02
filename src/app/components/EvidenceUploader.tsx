import React, { useState, useRef } from 'react';
import { Upload, Link2, FileText, Image, Film, AlertCircle, CheckCircle2, X, Loader2 } from 'lucide-react';

interface EvidenceUploaderProps {
  onUpload?: (file: { name: string; type: string; size?: string; url?: string }) => void;
  accept?: string;
  maxSizeMB?: number;
}

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf', 'video/mp4'];
const ALLOWED_EXTS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'pdf', 'mp4'];

export function EvidenceUploader({ onUpload, maxSizeMB = 50 }: EvidenceUploaderProps) {
  const [mode, setMode] = useState<'file' | 'link'>('file');
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [linkValue, setLinkValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const validateFile = (file: File): string | null => {
    const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
    if (!ALLOWED_EXTS.includes(ext)) {
      return `Tipo de archivo no permitido (.${ext}). Sube PDF, imagen (JPG, PNG, GIF, WEBP) o video MP4.`;
    }
    if (file.size > maxSizeMB * 1024 * 1024) {
      return `El archivo pesa más de ${maxSizeMB} MB. Usa un archivo más ligero o sube un link.`;
    }
    return null;
  };

  const handleFile = (file: File) => {
    setError(null);
    setSuccess(null);
    const err = validateFile(file);
    if (err) { setError(err); return; }

    setUploading(true);
    setProgress(0);
    const interval = setInterval(() => {
      setProgress(p => {
        if (p >= 100) {
          clearInterval(interval);
          setUploading(false);
          setSuccess(`"${file.name}" subido correctamente.`);
          const sizeKB = file.size / 1024;
          const sizeStr = sizeKB > 1024 ? `${(sizeKB / 1024).toFixed(1)} MB` : `${sizeKB.toFixed(0)} KB`;
          onUpload?.({ name: file.name, type: file.type, size: sizeStr });
          return 100;
        }
        return p + 20;
      });
    }, 250);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleLink = () => {
    if (!linkValue.trim()) { setError('Pega un link válido antes de continuar.'); return; }
    if (!linkValue.startsWith('http')) { setError('El link debe comenzar con http:// o https://'); return; }
    setSuccess('Link registrado correctamente.');
    onUpload?.({ name: linkValue, type: 'Link', url: linkValue });
    setLinkValue('');
    setError(null);
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <button
          onClick={() => setMode('file')}
          className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors ${mode === 'file' ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'}`}
          style={{ fontWeight: 500 }}
        >
          <Upload size={13} /> Subir archivo
        </button>
        <button
          onClick={() => setMode('link')}
          className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors ${mode === 'link' ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'}`}
          style={{ fontWeight: 500 }}
        >
          <Link2 size={13} /> Pegar link
        </button>
      </div>

      {mode === 'file' && (
        <div
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => !uploading && inputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${dragOver ? 'border-indigo-400 bg-indigo-50' : 'border-slate-200 bg-slate-50 hover:border-slate-300'} ${uploading ? 'pointer-events-none opacity-70' : ''}`}
        >
          <input ref={inputRef} type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png,.gif,.webp,.mp4" onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
          {uploading ? (
            <div className="space-y-2">
              <Loader2 size={20} className="text-indigo-500 animate-spin mx-auto" />
              <p className="text-xs text-slate-500">Subiendo… {progress}%</p>
              <div className="h-1 bg-slate-200 rounded-full mx-4"><div className="h-1 bg-indigo-500 rounded-full transition-all" style={{ width: `${progress}%` }} /></div>
            </div>
          ) : (
            <>
              <Upload size={20} className="text-slate-400 mx-auto mb-2" />
              <p className="text-xs text-slate-600" style={{ fontWeight: 500 }}>Arrastra tu archivo aquí o haz clic para seleccionar</p>
              <p className="text-xs text-slate-400 mt-1">PDF, imagen (JPG, PNG) o video MP4 · Máx. {maxSizeMB} MB</p>
            </>
          )}
        </div>
      )}

      {mode === 'link' && (
        <div className="flex gap-2">
          <input
            type="url"
            value={linkValue}
            onChange={e => { setLinkValue(e.target.value); setError(null); }}
            placeholder="https://drive.google.com/…"
            className="flex-1 text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <button onClick={handleLink} className="bg-indigo-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors" style={{ fontWeight: 500 }}>
            Guardar
          </button>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 p-2.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
          <AlertCircle size={13} className="mt-0.5 shrink-0" />
          {error}
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2 p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-700">
          <CheckCircle2 size={13} className="shrink-0" />
          {success}
        </div>
      )}
    </div>
  );
}
