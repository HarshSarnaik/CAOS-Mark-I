import { useState, useEffect, useCallback } from 'react';
import {
  Radio, RefreshCw, AlertCircle, Filter, Search,
  TrendingUp, ShieldAlert, ShieldX, ShieldCheck, Upload,
} from 'lucide-react';
import { fetchEvents, verifyAsset } from '../api';
import EventCard from '../components/EventCard';
import RiskBadge from '../components/RiskBadge';

/* ── Animated radar SVG ─────────────────────────────────────────────────── */
function RadarDisplay({ eventCount }) {
  return (
    <div className="relative flex items-center justify-center w-56 h-56 mx-auto">

      {/* Static rings */}
      {[1, 0.67, 0.35].map((scale, i) => (
        <div
          key={i}
          className="absolute rounded-full border border-google-green/20"
          style={{ inset: `${(1 - scale) * 50}%` }}
        />
      ))}

      {/* Pulsing glow rings */}
      {[0, 0.8, 1.6].map((delay, i) => (
        <div
          key={`ring-${i}`}
          className="absolute inset-0 rounded-full border border-google-green/30"
          style={{ animation: `radar-ring 2.5s ease-out ${delay}s infinite` }}
        />
      ))}

      {/* Crosshairs */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-full h-px bg-google-green/15" />
      </div>
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="h-full w-px bg-google-green/15" />
      </div>

      {/* Sweep arm */}
      <svg className="absolute inset-0 w-full h-full radar-sweep" viewBox="0 0 200 200">
        <defs>
          <radialGradient id="sweepGrad" cx="50%" cy="50%" r="50%">
            <stop offset="0%"   stopColor="#34A853" stopOpacity="0" />
            <stop offset="100%" stopColor="#34A853" stopOpacity="0.3" />
          </radialGradient>
        </defs>
        {/* Sweep sector (~60°) */}
        <path
          d="M 100 100 L 100 10 A 90 90 0 0 1 177.9 145 Z"
          fill="url(#sweepGrad)"
        />
        {/* Sweep leading edge */}
        <line x1="100" y1="100" x2="100" y2="10"
              stroke="#34A853" strokeWidth="1.5" strokeOpacity="0.7" />
      </svg>

      {/* Centre dot */}
      <div className="relative z-10 flex flex-col items-center">
        <div className="w-3 h-3 rounded-full bg-google-green shadow-glow-green dot-pulse mb-2" />
        <span className="text-2xl font-black text-white font-mono">{eventCount}</span>
        <span className="text-[10px] text-surface-400 uppercase tracking-widest">Events</span>
      </div>

      {/* Blip dots (decorative) */}
      {[
        { top: '20%', left: '65%', color: 'bg-google-red'    },
        { top: '55%', left: '75%', color: 'bg-google-yellow' },
        { top: '70%', left: '30%', color: 'bg-google-red'    },
        { top: '30%', left: '25%', color: 'bg-google-green'  },
      ].map((blip, i) => (
        <div
          key={i}
          className={`absolute w-2 h-2 rounded-full ${blip.color} dot-pulse`}
          style={{ top: blip.top, left: blip.left, animationDelay: `${i * 0.4}s` }}
        />
      ))}
    </div>
  );
}

/* ── Stat card ───────────────────────────────────────────────────────────── */
function StatCard({ icon, value, label, iconBg }) {
  return (
    <div className="glass-card p-4 flex items-center gap-4">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${iconBg}`}>
        {icon}
      </div>
      <div>
        <p className="text-xl font-black text-white font-mono">{value}</p>
        <p className="text-xs text-surface-400">{label}</p>
      </div>
    </div>
  );
}

/* ── Verify panel ────────────────────────────────────────────────────────── */
function VerifyPanel({ onNewEvent }) {
  const [open,        setOpen]        = useState(false);
  const [file,        setFile]        = useState(null);
  const [suspectUrl,  setSuspectUrl]  = useState('');
  const [accountName, setAccountName] = useState('');
  const [sigLen,      setSigLen]      = useState('');
  const [status,      setStatus]      = useState('idle');
  const [errMsg,      setErrMsg]      = useState('');
  const inputRef = useRef(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file || !suspectUrl || !accountName || !sigLen) return;
    setStatus('loading');
    setErrMsg('');
    try {
      const result = await verifyAsset(file, suspectUrl, accountName, parseInt(sigLen));
      onNewEvent(result);
      setStatus('done');
    } catch (err) {
      setErrMsg(err.message);
      setStatus('error');
    }
  };

  if (!open) {
    return (
      <button
        id="open-verify-panel-btn"
        onClick={() => setOpen(true)}
        className="btn-secondary flex items-center gap-2"
      >
        <Upload size={14} /> Verify Suspect Image
      </button>
    );
  }

  return (
    <form
      id="verify-form"
      onSubmit={handleSubmit}
      className="glass-card p-5 space-y-4 animate-fade-in-up border border-google-yellow/20 w-full max-w-xl"
    >
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-white flex items-center gap-2">
          <ShieldAlert size={16} className="text-google-yellow" /> Verify Asset
        </h3>
        <button type="button" onClick={() => setOpen(false)}
                className="text-surface-500 hover:text-white transition-colors">✕</button>
      </div>

      {/* File picker */}
      <div>
        <label className="block text-xs text-surface-400 mb-1">Suspect Image</label>
        <div
          onClick={() => inputRef.current?.click()}
          className="cursor-pointer border-2 border-dashed border-surface-600 rounded-xl p-4
                     flex items-center gap-3 hover:border-google-yellow/50 transition-colors"
        >
          <input ref={inputRef} type="file" accept="image/*" className="hidden"
                 onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          <Upload size={16} className="text-surface-400 flex-shrink-0" />
          <span className="text-sm text-surface-400 truncate">
            {file ? file.name : 'Click to select suspect image'}
          </span>
        </div>
      </div>

      <input id="verify-suspect-url"   value={suspectUrl}   onChange={(e) => setSuspectUrl(e.target.value)}
             type="url" placeholder="Suspect URL (https://…)" className="input-field" required />
      <input id="verify-account-name"  value={accountName}  onChange={(e) => setAccountName(e.target.value)}
             type="text" placeholder="Account / Entity Name" className="input-field" required />
      <input id="verify-sig-len"       value={sigLen}        onChange={(e) => setSigLen(e.target.value)}
             type="number" min="1" max="128" placeholder="Signature length (chars)" className="input-field" required />

      {status === 'error' && (
        <p className="text-xs text-google-red flex items-center gap-1">
          <AlertCircle size={12} /> {errMsg}
        </p>
      )}
      {status === 'done' && (
        <p className="text-xs text-google-green">✓ Verification complete — event logged above.</p>
      )}

      <button
        id="verify-submit-btn" type="submit"
        disabled={status === 'loading'}
        className="btn-primary w-full justify-center"
      >
        {status === 'loading'
          ? <><span className="caos-spinner scale-75" /> Analysing…</>
          : <><ShieldAlert size={14} /> Run Gemini Forensics</>
        }
      </button>
    </form>
  );
}

/* ── Filters ─────────────────────────────────────────────────────────────── */
const FILTER_OPTIONS = [
  { value: 'all',     label: 'All',          Icon: Filter     },
  { value: 'low',     label: '1–3 Safe',     Icon: ShieldCheck },
  { value: 'mid',     label: '4–6 Suspicious', Icon: ShieldAlert },
  { value: 'high',    label: '7–10 Critical', Icon: ShieldX   },
];

function filterEvents(events, filter, search) {
  let out = [...events];
  if (filter === 'low')  out = out.filter((e) => (e.risk_score ?? 5) <= 3);
  if (filter === 'mid')  out = out.filter((e) => { const s = e.risk_score ?? 5; return s >= 4 && s <= 6; });
  if (filter === 'high') out = out.filter((e) => (e.risk_score ?? 5) >= 7);
  if (search.trim()) {
    const q = search.toLowerCase();
    out = out.filter((e) =>
      (e.suspect_url ?? '').toLowerCase().includes(q) ||
      (e.account_name ?? '').toLowerCase().includes(q) ||
      (e.extracted_signature ?? '').toLowerCase().includes(q)
    );
  }
  return out;
}

/* ── Main page ───────────────────────────────────────────────────────────── */
export default function RadarPage() {
  const [events,    setEvents]    = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState('');
  const [filter,    setFilter]    = useState('all');
  const [search,    setSearch]    = useState('');
  const [lastFetch, setLastFetch] = useState(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError('');
    try {
      const data = await fetchEvents(100);
      setEvents(data.events ?? []);
      setLastFetch(new Date());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial + auto-refresh every 30 s
  useEffect(() => {
    load();
    const id = setInterval(() => load(true), 30_000);
    return () => clearInterval(id);
  }, [load]);

  const handleNewEvent = (result) => {
    // Optimistically prepend the newly verified event
    const ev = {
      event_id:            result.event_id,
      asset_id:            result.asset_id,
      suspect_url:         result.suspect_url,
      account_name:        result.account_name,
      extracted_signature: result.extracted_signature,
      timestamp:           result.timestamp,
      ...result.forensics,
    };
    setEvents((prev) => [ev, ...prev]);
  };

  const visible = filterEvents(events, filter, search);

  // Stats
  const highRisk  = events.filter((e) => (e.risk_score ?? 0) >= 7).length;
  const midRisk   = events.filter((e) => { const s = e.risk_score ?? 0; return s >= 4 && s <= 6; }).length;
  const safeCount = events.filter((e) => (e.risk_score ?? 10) <= 3).length;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12">

      {/* ── Hero ── */}
      <div className="mb-10 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full
                        bg-google-green/10 border border-google-green/20 mb-5">
          <Radio size={13} className="text-google-green" />
          <span className="text-xs font-semibold text-google-green tracking-wide uppercase">
            Live  ·  Auto-refresh every 30s
          </span>
        </div>
        <h1 className="text-4xl sm:text-5xl font-black text-white mb-3 leading-tight">
          Global{' '}
          <span className="bg-gradient-to-r from-google-green to-google-blue bg-clip-text text-transparent">
            Radar
          </span>
        </h1>
        <p className="text-surface-400 max-w-lg mx-auto">
          Real-time detection dashboard.  Every suspect redistribution event, scored
          and classified by Gemini AI.
        </p>
      </div>

      {/* ── Radar + stats ── */}
      <div className="grid lg:grid-cols-3 gap-8 mb-10 items-center">

        {/* Radar widget */}
        <div className="glass-card p-6 flex flex-col items-center gap-4 lg:col-span-1">
          <p className="text-xs font-semibold text-surface-400 uppercase tracking-widest">
            Detection Radar
          </p>
          <RadarDisplay eventCount={events.length} />
          {lastFetch && (
            <p className="text-[10px] text-surface-600">
              Last sync: {lastFetch.toLocaleTimeString()}
            </p>
          )}
        </div>

        {/* Stats */}
        <div className="lg:col-span-2 grid sm:grid-cols-3 gap-4">
          <StatCard
            icon={<ShieldX     size={20} className="text-google-red" />}
            value={highRisk}
            label="High Risk (7–10)"
            iconBg="bg-google-red/20"
          />
          <StatCard
            icon={<ShieldAlert size={20} className="text-google-yellow" />}
            value={midRisk}
            label="Suspicious (4–6)"
            iconBg="bg-google-yellow/20"
          />
          <StatCard
            icon={<ShieldCheck size={20} className="text-google-green" />}
            value={safeCount}
            label="Safe / Fair Use (1–3)"
            iconBg="bg-google-green/20"
          />

          {/* Verify panel */}
          <div className="sm:col-span-3">
            <VerifyPanel onNewEvent={handleNewEvent} />
          </div>
        </div>
      </div>

      {/* ── Controls bar ── */}
      <div className="flex flex-wrap gap-3 mb-6 items-center">

        {/* Search */}
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-surface-400" />
          <input
            id="radar-search"
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search URL, account, signature…"
            className="input-field pl-9 h-9 text-xs"
          />
        </div>

        {/* Filter pills */}
        <div className="flex gap-1.5 flex-wrap">
          {FILTER_OPTIONS.map(({ value, label, Icon: Ico }) => (
            <button
              key={value}
              id={`filter-${value}`}
              onClick={() => setFilter(value)}
              className={`
                flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
                transition-all duration-150
                ${filter === value
                  ? 'bg-google-blue text-white'
                  : 'bg-surface-800 text-surface-400 hover:text-white hover:bg-surface-700'
                }
              `}
            >
              <Ico size={11} /> {label}
            </button>
          ))}
        </div>

        {/* Refresh */}
        <button
          id="radar-refresh-btn"
          onClick={() => load()}
          disabled={loading}
          className="btn-secondary h-9 px-3 text-xs"
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* ── Events list ── */}
      {loading && events.length === 0 ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="skeleton h-32" style={{ animationDelay: `${i * 0.1}s` }} />
          ))}
        </div>
      ) : error ? (
        <div className="glass-card p-8 text-center space-y-3">
          <AlertCircle size={32} className="text-google-red mx-auto" />
          <p className="text-google-red font-semibold">Failed to load events</p>
          <p className="text-surface-400 text-sm">{error}</p>
          <button onClick={() => load()} className="btn-secondary mx-auto">
            <RefreshCw size={14} /> Retry
          </button>
        </div>
      ) : visible.length === 0 ? (
        <div className="glass-card p-12 text-center space-y-3">
          <TrendingUp size={40} className="text-surface-600 mx-auto" />
          <p className="text-surface-300 font-semibold">No events found</p>
          <p className="text-surface-500 text-sm">
            {events.length === 0
              ? 'Run your first verification to see results here.'
              : 'Try adjusting the filter or search term.'}
          </p>
        </div>
      ) : (
        <>
          <p className="text-xs text-surface-500 mb-4">
            Showing {visible.length} of {events.length} events
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {visible.map((event, i) => (
              <EventCard key={event.event_id} event={event} index={i} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
