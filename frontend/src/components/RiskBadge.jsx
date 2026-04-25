/**
 * RiskBadge
 * ---------
 * Renders a colour-coded badge for a Gemini risk score (1–10).
 *
 * Thresholds:
 *   1–3  → green  (Fair Use / low risk)
 *   4–6  → yellow (Suspicious)
 *   7–10 → red    (Malicious Piracy)
 */

import { ShieldCheck, ShieldAlert, ShieldX } from 'lucide-react';

const TIERS = [
  {
    max:    3,
    label:  'Low Risk',
    color:  'text-google-green',
    bg:     'bg-google-green/10',
    border: 'border-google-green/30',
    hover:  'hover:shadow-glow-green',
    Icon:   ShieldCheck,
  },
  {
    max:    6,
    label:  'Suspicious',
    color:  'text-google-yellow',
    bg:     'bg-google-yellow/10',
    border: 'border-google-yellow/30',
    hover:  'hover:shadow-glow-yellow',
    Icon:   ShieldAlert,
  },
  {
    max:    10,
    label:  'High Risk',
    color:  'text-google-red',
    bg:     'bg-google-red/10',
    border: 'border-google-red/30',
    hover:  'hover:shadow-glow-red',
    Icon:   ShieldX,
  },
];

function getTier(score) {
  return TIERS.find((t) => score <= t.max) ?? TIERS[2];
}

export default function RiskBadge({ score, showLabel = true, size = 'md' }) {
  const tier = getTier(score ?? 5);
  const { label, color, bg, border, hover, Icon } = tier;

  const sizeMap = {
    sm: { badge: 'px-2 py-0.5 text-[10px]', icon: 10 },
    md: { badge: 'px-3 py-1   text-xs',      icon: 12 },
    lg: { badge: 'px-4 py-1.5 text-sm',      icon: 14 },
  };
  const sz = sizeMap[size] ?? sizeMap.md;

  return (
    <span
      id={`risk-badge-${score}`}
      title={`Risk Score: ${score}/10 — ${label}`}
      className={`
        risk-badge border ${sz.badge}
        ${color} ${bg} ${border} ${hover}
        transition-shadow duration-200
      `}
    >
      <Icon size={sz.icon} />
      {showLabel && <span>{label}</span>}
      <span className="font-mono font-black">{score}/10</span>
    </span>
  );
}
