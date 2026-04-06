import { useEffect, useRef } from "react";

interface CompassRoseProps {
  heading: number;
  size?: number;
  showWindDir?: boolean;
  windAngle?: number;
  windSpeed?: number;
  label?: string;
}

export function CompassRose({
  heading,
  size = 220,
  showWindDir = false,
  windAngle,
  windSpeed,
  label = "HDG",
}: CompassRoseProps) {
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
    const r = size / 2 - 8;

    ctx.clearRect(0, 0, size, size);

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate((-heading * Math.PI) / 180);

    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(255,255,255,0.12)";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    const cardinals = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
    const cardColors = ["#ef4444", "rgba(255,255,255,0.6)", "rgba(255,255,255,0.6)", "rgba(255,255,255,0.6)", "rgba(255,255,255,0.6)", "rgba(255,255,255,0.6)", "rgba(255,255,255,0.6)", "rgba(255,255,255,0.6)"];
    for (let i = 0; i < 8; i++) {
      const angle = (i * Math.PI * 2) / 8;
      const x = Math.sin(angle) * (r - 20);
      const y = -Math.cos(angle) * (r - 20);
      ctx.fillStyle = cardColors[i];
      ctx.font = `bold ${i % 2 === 0 ? 13 : 10}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(cardinals[i], x, y);
    }

    for (let deg = 0; deg < 360; deg += 5) {
      const angle = (deg * Math.PI) / 180;
      const isMajor = deg % 10 === 0;
      const inner = r - (isMajor ? 14 : 10);
      const outer = r - 4;
      ctx.beginPath();
      ctx.moveTo(Math.sin(angle) * inner, -Math.cos(angle) * inner);
      ctx.lineTo(Math.sin(angle) * outer, -Math.cos(angle) * outer);
      ctx.strokeStyle = isMajor ? "rgba(255,255,255,0.35)" : "rgba(255,255,255,0.15)";
      ctx.lineWidth = isMajor ? 1.5 : 0.8;
      ctx.stroke();
    }

    ctx.restore();

    const needleLen = r * 0.55;
    const needleWidth = 6;
    ctx.save();
    ctx.translate(cx, cy);

    ctx.beginPath();
    ctx.moveTo(0, -needleLen);
    ctx.lineTo(-needleWidth / 2, needleWidth);
    ctx.lineTo(needleWidth / 2, needleWidth);
    ctx.closePath();
    ctx.fillStyle = "#ef4444";
    ctx.shadowBlur = 8;
    ctx.shadowColor = "#ef4444";
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(0, needleLen * 0.7);
    ctx.lineTo(-needleWidth / 2, needleWidth);
    ctx.lineTo(needleWidth / 2, needleWidth);
    ctx.closePath();
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.shadowBlur = 0;
    ctx.fill();

    ctx.restore();

    if (showWindDir && windAngle != null) {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate((windAngle * Math.PI) / 180);
      const wLen = r * 0.45;

      ctx.beginPath();
      ctx.moveTo(0, -wLen);
      ctx.lineTo(-4, -wLen + 14);
      ctx.lineTo(4, -wLen + 14);
      ctx.closePath();
      ctx.fillStyle = "#22d3ee";
      ctx.shadowBlur = 8;
      ctx.shadowColor = "#22d3ee";
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.restore();
    }

    ctx.beginPath();
    ctx.arc(cx, cy, 6, 0, Math.PI * 2);
    ctx.fillStyle = "#1e293b";
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.5)";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = "#ffffff";
    ctx.font = `bold ${size * 0.14}px 'Share Tech Mono', monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText(`${Math.round(((heading % 360) + 360) % 360)}°`, cx, cy + r * 0.55);
    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.font = `${size * 0.08}px sans-serif`;
    ctx.fillText(label, cx, cy + r * 0.75);
  }, [heading, size, showWindDir, windAngle, windSpeed, label]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: size, height: size }}
      data-testid="compass-rose"
    />
  );
}
