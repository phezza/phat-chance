import { useRef, useEffect } from "react";

interface GaugeRingProps {
  value: number;
  min?: number;
  max?: number;
  unit?: string;
  label?: string;
  size?: number;
  color?: string;
  thickness?: number;
  showTicks?: boolean;
}

export function GaugeRing({
  value,
  min = 0,
  max = 100,
  unit = "",
  label = "",
  size = 160,
  color = "#22d3ee",
  thickness = 10,
  showTicks = true,
}: GaugeRingProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.scale(dpr, dpr);

    const cx = size / 2;
    const cy = size / 2;
    const r = (size - thickness * 2 - 4) / 2;

    ctx.clearRect(0, 0, size, size);

    const startAngle = Math.PI * 0.75;
    const endAngle = Math.PI * 2.25;
    const range = endAngle - startAngle;

    ctx.beginPath();
    ctx.arc(cx, cy, r, startAngle, endAngle);
    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.lineWidth = thickness;
    ctx.lineCap = "round";
    ctx.stroke();

    const pct = Math.max(0, Math.min(1, (value - min) / (max - min)));
    const valAngle = startAngle + range * pct;

    ctx.beginPath();
    ctx.arc(cx, cy, r, startAngle, valAngle);
    ctx.strokeStyle = color;
    ctx.lineWidth = thickness;
    ctx.lineCap = "round";
    ctx.shadowBlur = 12;
    ctx.shadowColor = color;
    ctx.stroke();
    ctx.shadowBlur = 0;

    if (showTicks) {
      const ticks = 5;
      for (let i = 0; i <= ticks; i++) {
        const angle = startAngle + (range * i) / ticks;
        const inner = r - thickness - 2;
        const outer = r - thickness - 8;
        const x1 = cx + Math.cos(angle) * inner;
        const y1 = cy + Math.sin(angle) * inner;
        const x2 = cx + Math.cos(angle) * outer;
        const y2 = cy + Math.sin(angle) * outer;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.strokeStyle = "rgba(255,255,255,0.25)";
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }

    ctx.fillStyle = "#ffffff";
    ctx.font = `bold ${size * 0.22}px 'Share Tech Mono', monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(Number.isFinite(value) ? value.toFixed(1) : "--", cx, cy - size * 0.04);

    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.font = `${size * 0.1}px sans-serif`;
    ctx.fillText(unit, cx, cy + size * 0.16);

    if (label) {
      ctx.fillStyle = "rgba(255,255,255,0.4)";
      ctx.font = `${size * 0.09}px sans-serif`;
      ctx.fillText(label, cx, cy + size * 0.3);
    }
  }, [value, min, max, unit, label, size, color, thickness, showTicks]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: size, height: size }}
      data-testid={`gauge-${label.toLowerCase().replace(/\s+/g, "-")}`}
    />
  );
}
