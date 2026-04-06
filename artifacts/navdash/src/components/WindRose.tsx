import { useEffect, useRef } from "react";

interface WindRoseProps {
  apparentAngle?: number;
  apparentSpeed?: number;
  trueAngle?: number;
  trueSpeed?: number;
  size?: number;
}

export function WindRose({
  apparentAngle,
  apparentSpeed,
  trueAngle,
  trueSpeed,
  size = 200,
}: WindRoseProps) {
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
    const r = size / 2 - 16;

    ctx.clearRect(0, 0, size, size);

    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(255,255,255,0.1)";
    ctx.lineWidth = 1;
    ctx.stroke();

    for (let i = 1; i <= 3; i++) {
      ctx.beginPath();
      ctx.arc(cx, cy, (r * i) / 3, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(255,255,255,0.06)";
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    for (let deg = 0; deg < 360; deg += 30) {
      const angle = (deg * Math.PI) / 180;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.sin(angle) * r, cy - Math.cos(angle) * r);
      ctx.strokeStyle = "rgba(255,255,255,0.06)";
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    const drawArrow = (angleDeg: number, speed: number, maxSpeed: number, color: string) => {
      const angle = (angleDeg * Math.PI) / 180;
      const len = Math.max(20, Math.min(r * 0.9, (speed / maxSpeed) * r * 0.9));
      const ex = cx + Math.sin(angle) * len;
      const ey = cy - Math.cos(angle) * len;

      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(ex, ey);
      ctx.strokeStyle = color;
      ctx.lineWidth = 2.5;
      ctx.shadowBlur = 10;
      ctx.shadowColor = color;
      ctx.stroke();
      ctx.shadowBlur = 0;

      const headLen = 12;
      const headAngle = Math.PI / 6;
      const a1 = Math.atan2(ey - cy, ex - cx);
      ctx.beginPath();
      ctx.moveTo(ex, ey);
      ctx.lineTo(ex - headLen * Math.cos(a1 - headAngle), ey - headLen * Math.sin(a1 - headAngle));
      ctx.lineTo(ex - headLen * Math.cos(a1 + headAngle), ey - headLen * Math.sin(a1 + headAngle));
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();
    };

    if (trueAngle != null && trueSpeed != null) {
      drawArrow(trueAngle, trueSpeed, 40, "rgba(34,211,238,0.6)");
    }

    if (apparentAngle != null && apparentSpeed != null) {
      drawArrow(apparentAngle, apparentSpeed, 40, "#22d3ee");
    }

    ctx.beginPath();
    ctx.arc(cx, cy, 4, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.fill();

    const labels = ["FWD", "90°", "180°", "270°"];
    const labelAngles = [0, 90, 180, 270];
    for (let i = 0; i < 4; i++) {
      const angle = (labelAngles[i] * Math.PI) / 180;
      const lx = cx + Math.sin(angle) * (r + 10);
      const ly = cy - Math.cos(angle) * (r + 10);
      ctx.fillStyle = "rgba(255,255,255,0.35)";
      ctx.font = `9px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(labels[i], lx, ly);
    }
  }, [apparentAngle, apparentSpeed, trueAngle, trueSpeed, size]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: size, height: size }}
      data-testid="wind-rose"
    />
  );
}
