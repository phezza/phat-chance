import L from "leaflet";

export function makeBoatIcon(headingDeg?: number): L.DivIcon {
  const rot = headingDeg ?? 0;
  return L.divIcon({
    className: "boat-icon",
    html: `<div style="transform: rotate(${rot}deg); transform-origin: center; width:32px; height:32px;">
      <svg width="32" height="32" viewBox="0 0 32 32">
        <polygon points="16,2 26,28 16,22 6,28" fill="#22d3ee" stroke="#0a1628" stroke-width="1.5"/>
      </svg>
    </div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });
}

export function getAISShipColor(type?: number): string {
  if (type == null) return "#94a3b8";
  if (type >= 70 && type < 80) return "#f59e0b";
  if (type >= 80 && type < 90) return "#ef4444";
  if (type >= 60 && type < 70) return "#3b82f6";
  if (type === 36 || type === 37) return "#22d3ee";
  if (type === 30) return "#22c55e";
  if (type >= 50 && type < 60) return "#a78bfa";
  return "#94a3b8";
}

export function makeAISIcon(opts: {
  color: string;
  headingDeg?: number;
  cogDeg?: number;
  selected?: boolean;
  label?: string;
  threatColor?: string;
  threatPulse?: boolean;
}): L.DivIcon {
  const { color, headingDeg, cogDeg, selected, label, threatColor, threatPulse } = opts;
  const rot = headingDeg ?? cogDeg ?? 0;
  const hasDir = headingDeg != null || cogDeg != null;

  const threatRing = threatColor
    ? `<circle cx="14" cy="14" r="13" fill="none" stroke="${threatColor}" stroke-width="2.5" stroke-opacity="${threatPulse ? 0.95 : 0.85}"${threatPulse ? ` style="animation: aisPulse 1.2s ease-in-out infinite;"` : ""}/>`
    : "";

  const selRing = selected
    ? `<circle cx="14" cy="14" r="13" fill="none" stroke="#22d3ee" stroke-width="1.5" stroke-opacity="0.9"/>`
    : "";

  const base = `<circle cx="14" cy="14" r="11" fill="${color}" fill-opacity="0.18" stroke="${color}" stroke-width="1" stroke-opacity="0.5"/>`;

  const arrow = hasDir
    ? `<polygon points="14,3 18,15 14,12 10,15" fill="${color}" stroke="#0a1628" stroke-width="0.75" transform="rotate(${rot} 14 14)"/>`
    : `<circle cx="14" cy="14" r="4" fill="${color}" stroke="#0a1628" stroke-width="0.75"/>`;

  const labelEl = label
    ? `<div style="position:absolute; left:34px; top:50%; transform:translateY(-50%); white-space:nowrap; font-size:10px; font-weight:600; color:#e2e8f0; text-shadow: 0 1px 2px rgba(0,0,0,0.9), 0 0 3px rgba(0,0,0,0.7); pointer-events:none;">${label}</div>`
    : "";

  return L.divIcon({
    className: "ais-marker",
    html: `<div style="position:relative; width:28px; height:28px;">
      <svg width="28" height="28" viewBox="0 0 28 28" style="overflow:visible">
        ${base}
        ${threatRing}
        ${selRing}
        ${arrow}
      </svg>
      ${labelEl}
    </div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

export function makeWaypointIcon(index: number, total: number): L.DivIcon {
  const isFirst = index === 0;
  const isLast = index === total - 1;
  const bg = isFirst ? "#22c55e" : isLast ? "#ef4444" : "#a78bfa";
  return L.divIcon({
    className: "wp-icon",
    html: `<div style="width:24px; height:24px; border-radius:50%; background:${bg}; border:2px solid #0a1628; display:flex; align-items:center; justify-content:center; font-size:11px; font-weight:700; color:#0a1628; box-shadow: 0 0 6px ${bg}80; cursor:pointer;">${index + 1}</div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
}
