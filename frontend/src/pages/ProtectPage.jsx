import { useState, useRef, useCallback } from 'react';
import {
  Upload, Shield, Download, CheckCircle2, AlertCircle,
  Image as ImageIcon, X, Hash, Zap, Lock,
} from 'lucide-react';
import { protectAsset } from '../api';

/* ── Drag-and-drop upload zone ──────────────────────────────────────────── */
function UploadZone({ file, onFile }) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef(null);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f && f.type.startsWith('image/')) onFile(f);
  }, [onFile]);

  const handleChange = (e) => {
    const f = e.target.files?.[0];
    if (f) onFile(f);
  };

  return (
    <div
      id="upload-zone"
      role="button"
      tabIndex={0}
      aria-label="Upload image to protect"
      onClick={() => inputRef.current?.click()}
      onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      className={`
        relative flex flex-col items-center justify-center gap-4
        rounded-2xl border-2 border-dashed cursor-pointer
        transition-all duration-300 min-h-52
        ${dragging
          ? 'border-google-blue bg-google-blue/10 scale-[1.01]'
          : file
          ? 'border-google-green/50 bg-google-green/5'
          : 'border-surface-600 bg-surface-800/40 hover:border-surface-500 hover:bg-surface-800/60'
        }
      `}
    >
      <input
        ref={inputRef}
        id="image-file-input"
        type="file"
        accept="image/jpeg,image/png,image/webp,image/tiff"
        className="hidden"
        onChange={handleChange}
      />

      {file ? (
        <>
          <div className="flex items-center gap-3 px-4">
            <div className="w-10 h-10 rounded-lg bg-google-green/20 flex items-center justify-center">
              <CheckCircle2 size={20} className="text-google-green" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-white truncate max-w-xs">{file.name}</p>
              <p className="text-xs text-surface-400">
                {(file.size / 1024 / 1024).toFixed(2)} MB · {file.type}
              </p>
            </div>
            <button
              id="clear-file-btn"
              onClick={(e) => { e.stopPropagation(); onFile(null); }}
              className="p-1 rounded-lg text-surface-400 hover:text-google-red hover:bg-google-red/10
                         transition-all duration-150"
            >
              <X size={16} />
            </button>
          </div>
          <p className="text-xs text-surface-500">Click to change file</p>
        </>
      ) : (
        <>
          <div className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-all duration-300
            ${dragging ? 'bg-google-blue/20 scale-110' : 'bg-surface-700/60'}`}>
            {dragging
              ? <Upload size={28} className="text-google-blue animate-bounce" />
              : <ImageIcon size={28} className="text-surface-400" />
            }
          </div>
          <div className="text-center px-4">
            <p className="text-sm font-semibold text-white mb-1">
              {dragging ? 'Drop to upload' : 'Drag & drop your image'}
            </p>
            <p className="text-xs text-surface-400">
              or <span className="text-google-blue underline underline-offset-2">browse files</span>
              &nbsp;· JPEG, PNG, WebP, TIFF · Max 20 MB
            </p>
          </div>
        </>
      )}

      {/* Animated corner accents */}
      {['top-2 left-2', 'top-2 right-2', 'bottom-2 left-2', 'bottom-2 right-2'].map((pos, i) => (
        <div key={i} className={`absolute ${pos} w-3 h-3 rounded-sm border-2
          ${dragging ? 'border-google-blue' : 'border-surface-600'} transition-colors duration-300`} />
      ))}
    </div>
  );
}

/* ── Progress bar ────────────────────────────────────────────────────────── */
function ProgressBar({ pct }) {
  return (
    <div className="w-full bg-surface-700 rounded-full h-1.5 overflow-hidden">
      <div
        className="h-full bg-gradient-to-r from-google-blue via-google-green to-google-blue
                   transition-all duration-300 rounded-full"
        style={{ width: `${pct}%`, backgroundSize: '200% 100%' }}
      />
    </div>
  );
}

/* ── Success panel ───────────────────────────────────────────────────────── */
function SuccessPanel({ downloadUrl, headers, onReset }) {
  const assetId     = headers['x-asset-id']        ?? '—';
  const sigLabel    = headers['x-signature-label']  ?? '—';
  const sigLen      = headers['x-signature-length'] ?? '—';

  return (
    <div id="protect-success-panel"
         className="glass-card p-6 space-y-5 animate-fade-in-up border border-google-green/20">

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-google-green/20 flex items-center justify-center">
          <CheckCircle2 size={20} className="text-google-green" />
        </div>
        <div>
          <h3 className="font-bold text-white">Asset Protected!</h3>
          <p className="text-xs text-surface-400">CAOS watermark successfully embedded</p>
        </div>
      </div>

      {/* Metadata */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: 'Asset ID',    value: assetId.slice(0, 8) + '…', mono: true },
          { label: 'Signature',   value: sigLabel, mono: false },
          { label: 'Sig Length',  value: `${sigLen} chars`, mono: true },
          { label: 'Key Iters',   value: 'Protected', mono: true },
        ].map(({ label, value, mono }) => (
          <div key={label} className="bg-surface-700/40 rounded-xl px-3 py-2">
            <p className="text-[10px] uppercase tracking-wider text-surface-500 mb-0.5">{label}</p>
            <p className={`text-sm text-white truncate ${mono ? 'font-mono' : 'font-medium'}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <a
          id="download-watermarked-btn"
          href={downloadUrl}
          download
          className="btn-primary flex-1 justify-center"
        >
          <Download size={15} /> Download Watermarked
        </a>
        <button id="protect-reset-btn" onClick={onReset} className="btn-secondary">
          <X size={15} /> New
        </button>
      </div>

      <p className="text-[11px] text-surface-500 text-center">
        Keep the <span className="text-google-yellow font-semibold">signature label</span> and{' '}
        <span className="text-google-yellow font-semibold">length ({sigLen})</span> — you'll need
        them for verification.
      </p>
    </div>
  );
}

/* ── Main page ───────────────────────────────────────────────────────────── */
export default function ProtectPage() {
  const [file,     setFile]     = useState(null);
  const [label,    setLabel]    = useState('');
  const [status,   setStatus]   = useState('idle');   // idle | uploading | success | error
  const [progress, setProgress] = useState(0);
  const [result,   setResult]   = useState(null);    // { downloadUrl, headers }
  const [errMsg,   setErrMsg]   = useState('');

  const canSubmit = file && label.trim().length > 0 && status !== 'uploading';

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;

    setStatus('uploading');
    setProgress(0);
    setErrMsg('');

    try {
      const { blob, headers } = await protectAsset(file, label.trim(), setProgress);
      const downloadUrl = URL.createObjectURL(blob);
      setResult({ downloadUrl, headers });
      setStatus('success');
    } catch (err) {
      setErrMsg(err.message);
      setStatus('error');
    }
  };

  const reset = () => {
    setFile(null); setLabel(''); setStatus('idle');
    setProgress(0); setResult(null); setErrMsg('');
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12">

      {/* ── Hero ── */}
      <div className="mb-12 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full
                        bg-google-blue/10 border border-google-blue/20 mb-5">
          <Lock size={13} className="text-google-blue" />
          <span className="text-xs font-semibold text-google-blue tracking-wide uppercase">
            Arnold's Cat Map + DCT Steganography
          </span>
        </div>
        <h1 className="text-4xl sm:text-5xl font-black text-white mb-4 leading-tight">
          Shield Your{' '}
          <span className="bg-gradient-to-r from-google-blue to-google-green
                           bg-clip-text text-transparent">
            Digital Assets
          </span>
        </h1>
        <p className="text-surface-400 max-w-xl mx-auto text-lg">
          Embed an invisible, mathematically secure watermark into any image.
          Powered by chaotic cryptography — invisible to the eye, impossible to erase.
        </p>
      </div>

      {/* ── Two-column layout ── */}
      <div className="grid lg:grid-cols-2 gap-8 max-w-5xl mx-auto">

        {/* Left: form */}
        <div className="space-y-6">

          {/* Stat pills */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { icon: <Zap size={14} />,    label: 'DCT-QIM',     desc: 'Embed method',     color: 'text-google-blue'   },
              { icon: <Hash size={14} />,   label: 'Arnold Map',  desc: 'Key scrambler',    color: 'text-google-yellow' },
              { icon: <Shield size={14} />, label: 'YCbCr',       desc: 'Colour space',     color: 'text-google-green'  },
            ].map(({ icon, label: l, desc, color }) => (
              <div key={l} className="glass-card p-3 text-center">
                <span className={color}>{icon}</span>
                <p className="text-xs font-bold text-white mt-1">{l}</p>
                <p className="text-[10px] text-surface-500">{desc}</p>
              </div>
            ))}
          </div>

          {/* Form */}
          <form id="protect-form" onSubmit={handleSubmit} className="glass-card p-6 space-y-5">
            <h2 className="font-bold text-lg text-white flex items-center gap-2">
              <Shield size={18} className="text-google-blue" /> Embed Watermark
            </h2>

            {/* Upload zone */}
            <UploadZone file={file} onFile={setFile} />

            {/* Label input */}
            <div>
              <label htmlFor="signature-label" className="block text-sm font-medium text-surface-300 mb-1.5">
                Signature Label
              </label>
              <div className="relative">
                <Hash size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-surface-400" />
                <input
                  id="signature-label"
                  type="text"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="e.g. GSC-2024-SPORTS-001"
                  maxLength={128}
                  className="input-field pl-9"
                  required
                />
              </div>
              <p className="text-[11px] text-surface-500 mt-1">
                {label.length}/128 chars — this is your ownership fingerprint.
              </p>
            </div>

            {/* Progress */}
            {status === 'uploading' && (
              <div className="space-y-2">
                <div className="flex justify-between text-xs text-surface-400">
                  <span>Embedding watermark…</span>
                  <span>{progress}%</span>
                </div>
                <ProgressBar pct={progress} />
              </div>
            )}

            {/* Error */}
            {status === 'error' && (
              <div className="flex items-start gap-3 p-3 rounded-xl bg-google-red/10
                              border border-google-red/30 text-sm text-google-red">
                <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
                <span>{errMsg}</span>
              </div>
            )}

            <button
              id="protect-submit-btn"
              type="submit"
              disabled={!canSubmit}
              className="btn-primary w-full justify-center py-3.5 text-base"
            >
              {status === 'uploading'
                ? <><span className="caos-spinner scale-75" /> Processing…</>
                : <><Shield size={16} /> Protect Asset</>
              }
            </button>
          </form>
        </div>

        {/* Right: result or placeholder */}
        <div>
          {status === 'success' && result ? (
            <SuccessPanel
              downloadUrl={result.downloadUrl}
              headers={result.headers}
              onReset={reset}
            />
          ) : (
            <div className="glass-card p-8 flex flex-col items-center justify-center
                            min-h-80 text-center gap-4">
              <div className="w-20 h-20 rounded-full bg-surface-700/60 flex items-center
                              justify-center animate-glow-pulse">
                <Shield size={36} className="text-surface-500" />
              </div>
              <div>
                <p className="text-surface-300 font-semibold">Protected asset will appear here</p>
                <p className="text-xs text-surface-500 mt-1">
                  Upload an image and add a signature label to get started.
                </p>
              </div>

              {/* How it works */}
              <div className="mt-4 text-left w-full space-y-2">
                {[
                  { step: '01', text: 'Upload your media asset',                     color: 'bg-google-blue'   },
                  { step: '02', text: 'Set a unique ownership signature',             color: 'bg-google-yellow' },
                  { step: '03', text: 'CAOS engine embeds invisible DCT watermark',   color: 'bg-google-green'  },
                  { step: '04', text: 'Download & distribute with confidence',        color: 'bg-google-red'    },
                ].map(({ step, text, color }) => (
                  <div key={step} className="flex items-center gap-3 text-xs text-surface-400">
                    <span className={`w-6 h-6 rounded-md ${color} flex items-center justify-center
                                      text-[10px] font-black text-white flex-shrink-0`}>
                      {step}
                    </span>
                    {text}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
