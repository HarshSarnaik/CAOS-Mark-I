import { useState } from 'react';
import {
  ChevronDown, ChevronUp, ExternalLink, User,
  Clock, Fingerprint, AlertTriangle, CheckCircle, Scale,
} from 'lucide-react';
import RiskBadge from './RiskBadge';

const VERDICT_META = {
  'Fair Use': {
    Icon:  CheckCircle,
    color: 'text-google-green',
    bg:    'bg-google-green/10',
  },
  'Suspicious': {
    Icon:  AlertTriangle,
    color: 'text-google-yellow',
    bg:    'bg-google-yellow/10',
  },
  'Malicious Piracy': {
    Icon:  AlertTriangle,
    color: 'text-google-red',
    bg:    'bg-google-red/10',
  },
};

const ACTION_COLORS = {
  'Monitor':       'text-google-green  bg-google-green/10  border-google-green/30',
  'DMCA Notice':   'text-google-yellow bg-google-yellow/10 border-google-yellow/30',
  'Legal Action':  'text-google-red    bg-google-red/10    border-google-red/30',
};

function fmtDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

export default function EventCard({ event, index = 0 }) {
  const [expanded, setExpanded] = useState(false);

  const {
    event_id, suspect_url, account_name,
    extracted_signature, verdict, risk_score,
    reasoning, recommended_action, confidence, timestamp,
  } = event;

  const verdictMeta = VERDICT_META[verdict] ?? VERDICT_META['Suspicious'];
  const { Icon: VerdictIcon, color: vColor } = verdictMeta;
  const actionColor = ACTION_COLORS[recommended_action] ?? ACTION_COLORS['Monitor'];

  return (
    <article
      id={`event-card-${event_id}`}
      className="glass-card gradient-border overflow-hidden event-card-enter"
      style={{ animationDelay: `${index * 60}ms` }}
    >
      {/* ── Header ── */}
      <div className="p-4 flex items-start gap-4">

        {/* Risk score ring */}
        <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-surface-700/60
                        flex items-center justify-center border border-surface-600">
          <span className={`font-black text-lg font-mono ${
            risk_score >= 7 ? 'text-google-red' :
            risk_score >= 4 ? 'text-google-yellow' : 'text-google-green'
          }`}>
            {risk_score}
          </span>
        </div>

        <div className="flex-1 min-w-0">
          {/* Verdict row */}
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <VerdictIcon size={14} className={`flex-shrink-0 ${vColor}`} />
            <span className={`text-sm font-semibold ${vColor}`}>{verdict ?? '—'}</span>
            <RiskBadge score={risk_score} size="sm" showLabel={false} />
          </div>

          {/* URL */}
          {suspect_url && (
            <a
              href={suspect_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-surface-300
                         hover:text-google-blue transition-colors duration-150 truncate"
            >
              <ExternalLink size={10} className="flex-shrink-0" />
              <span className="truncate">{suspect_url}</span>
            </a>
          )}
        </div>

        {/* Expand toggle */}
        <button
          id={`toggle-${event_id}`}
          onClick={() => setExpanded((p) => !p)}
          aria-expanded={expanded}
          className="flex-shrink-0 p-1.5 rounded-lg text-surface-400
                     hover:text-white hover:bg-surface-700 transition-all duration-150"
        >
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
      </div>

      {/* ── Meta row ── */}
      <div className="px-4 pb-3 flex flex-wrap gap-3 text-[11px] text-surface-400">
        {account_name && (
          <span className="flex items-center gap-1">
            <User size={10} /> {account_name}
          </span>
        )}
        <span className="flex items-center gap-1">
          <Clock size={10} /> {fmtDate(timestamp)}
        </span>
        {confidence != null && (
          <span className="flex items-center gap-1">
            <Scale size={10} /> {Math.round(confidence * 100)}% confidence
          </span>
        )}
        {recommended_action && (
          <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-semibold ${actionColor}`}>
            {recommended_action}
          </span>
        )}
      </div>

      {/* ── Expanded details ── */}
      {expanded && (
        <div className="border-t border-surface-700/60 px-4 py-4 space-y-3
                        animate-fade-in-up">

          {/* Reasoning */}
          {reasoning && (
            <div>
              <p className="text-[10px] uppercase tracking-wider text-surface-500 mb-1 font-semibold">
                Gemini Reasoning
              </p>
              <p className="text-sm text-surface-300 leading-relaxed">{reasoning}</p>
            </div>
          )}

          {/* Signature */}
          {extracted_signature && (
            <div>
              <p className="text-[10px] uppercase tracking-wider text-surface-500 mb-1 font-semibold flex items-center gap-1">
                <Fingerprint size={10} /> Extracted Signature
              </p>
              <code className="block font-mono text-xs bg-surface-900 rounded-lg px-3 py-2
                               text-google-blue border border-surface-700 break-all">
                {extracted_signature}
              </code>
            </div>
          )}

          {/* Event ID */}
          <p className="text-[10px] text-surface-600 font-mono">ID: {event_id}</p>
        </div>
      )}
    </article>
  );
}
