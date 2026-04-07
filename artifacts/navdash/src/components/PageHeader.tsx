import type { ComponentType, ReactNode } from "react";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: string;
  icon: ComponentType<{ className?: string }>;
  badge?: ReactNode;
  children?: ReactNode;
}

export function PageHeader({ title, icon: Icon, badge, children }: PageHeaderProps) {
  return (
    <div className="h-[61px] flex items-center justify-between px-5 border-b border-white/8 flex-shrink-0 bg-black/20">
      <div className="flex items-center gap-3 min-w-0">
        <Icon className="w-[18px] h-[18px] text-cyan-400 flex-shrink-0" />
        <h1 className="text-white font-semibold text-sm tracking-wide leading-none truncate">
          {title}
        </h1>
        {badge && <div className="flex items-center gap-2 flex-shrink-0">{badge}</div>}
      </div>
      {children && (
        <div className="flex items-center gap-2 flex-shrink-0 ml-4">{children}</div>
      )}
    </div>
  );
}
