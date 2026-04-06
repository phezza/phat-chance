import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface DataTileProps {
  label: string;
  value: string | ReactNode;
  unit?: string;
  subValue?: string;
  color?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
  "data-testid"?: string;
}

export function DataTile({
  label,
  value,
  unit,
  subValue,
  color = "#22d3ee",
  size = "md",
  className,
  "data-testid": testId,
}: DataTileProps) {
  const sizes = {
    sm: { value: "text-2xl", label: "text-xs", unit: "text-sm", sub: "text-xs" },
    md: { value: "text-4xl", label: "text-xs", unit: "text-lg", sub: "text-xs" },
    lg: { value: "text-6xl", label: "text-sm", unit: "text-2xl", sub: "text-sm" },
  };
  const s = sizes[size];

  return (
    <div
      className={cn(
        "relative flex flex-col items-center justify-center rounded-xl p-4 bg-white/5 border border-white/10 overflow-hidden",
        className
      )}
      data-testid={testId ?? `tile-${label.toLowerCase().replace(/\s+/g, "-")}`}
    >
      <div
        className="absolute inset-0 opacity-5 pointer-events-none"
        style={{ background: `radial-gradient(ellipse at center, ${color} 0%, transparent 70%)` }}
      />
      <div className={cn("text-white/40 uppercase tracking-widest font-medium mb-1", s.label)}>
        {label}
      </div>
      <div className="flex items-baseline gap-1">
        <span
          className={cn("font-mono font-bold tabular-nums leading-none", s.value)}
          style={{ color }}
        >
          {value}
        </span>
        {unit && (
          <span className={cn("text-white/50 font-medium", s.unit)}>{unit}</span>
        )}
      </div>
      {subValue && (
        <div className={cn("text-white/35 mt-1", s.sub)}>{subValue}</div>
      )}
    </div>
  );
}
