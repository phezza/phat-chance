import { useState } from "react";
import { Switch, Route, Router as WouterRouter, Link, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SignalKProvider } from "@/lib/SignalKContext";
import { StatusBar } from "@/components/StatusBar";
import { Dashboard } from "@/pages/Dashboard";
import { Navigation } from "@/pages/Navigation";
import { Wind } from "@/pages/Wind";
import { AIS } from "@/pages/AIS";
import { Instruments } from "@/pages/Instruments";
import { Settings } from "@/pages/Settings";
import { Tracking } from "@/pages/Tracking";
import { Autopilot } from "@/pages/Autopilot";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Compass,
  Wind as WindIcon,
  Radio,
  Gauge,
  Settings as SettingsIcon,
  Anchor,
  Route as RouteIcon,
  Cpu,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
} from "lucide-react";

const queryClient = new QueryClient();

const navItems = [
  { path: "/", label: "Dashboard", icon: LayoutDashboard },
  { path: "/navigation", label: "Navigation", icon: Compass },
  { path: "/wind", label: "Wind", icon: WindIcon },
  { path: "/instruments", label: "Instruments", icon: Gauge },
  { path: "/ais", label: "AIS", icon: Radio },
  { path: "/tracking", label: "Tracking", icon: RouteIcon },
  { path: "/autopilot", label: "Autopilot", icon: Cpu },
  { path: "/settings", label: "Settings", icon: SettingsIcon },
];

function NavItem({
  path,
  label,
  Icon,
  collapsed,
  onClick,
}: {
  path: string;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
  collapsed: boolean;
  onClick?: () => void;
}) {
  const [location] = useLocation();
  const isActive = path === "/" ? location === "/" : location.startsWith(path);

  return (
    <Link href={path} onClick={onClick}>
      <div
        title={collapsed ? label : undefined}
        className={cn(
          "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all cursor-pointer select-none group relative",
          collapsed ? "justify-center" : "justify-start",
          isActive
            ? "bg-cyan-500/15 text-cyan-400 border border-cyan-500/25"
            : "text-white/45 hover:text-white/80 hover:bg-white/6 border border-transparent"
        )}
        data-testid={`nav-${label.toLowerCase()}`}
      >
        <Icon className="w-4 h-4 flex-shrink-0" />
        {!collapsed && <span className="truncate">{label}</span>}
        {collapsed && (
          <span className="absolute left-full ml-3 px-2 py-1 rounded-lg bg-[#0d1e38] border border-white/12 text-white text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 shadow-lg">
            {label}
          </span>
        )}
      </div>
    </Link>
  );
}

function Sidebar({
  collapsed,
  onToggle,
  onNavClick,
}: {
  collapsed: boolean;
  onToggle: () => void;
  onNavClick?: () => void;
}) {
  return (
    <aside
      className={cn(
        "flex flex-col h-full bg-black/30 backdrop-blur-sm border-r border-white/8 transition-all duration-300 ease-in-out flex-shrink-0",
        collapsed ? "w-[60px]" : "w-[200px]"
      )}
    >
      <div className={cn("flex items-center gap-2.5 px-3 py-4 border-b border-white/8 flex-shrink-0", collapsed ? "justify-center" : "justify-start")}>
        <div className="w-7 h-7 rounded-lg bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center flex-shrink-0">
          <Anchor className="w-4 h-4 text-cyan-400" />
        </div>
        {!collapsed && (
          <span className="font-bold text-white text-sm tracking-wide truncate">Phat Chance</span>
        )}
      </div>

      <nav className="flex-1 flex flex-col gap-1 p-2 overflow-y-auto overflow-x-hidden">
        {navItems.map(({ path, label, icon: Icon }) => (
          <NavItem
            key={path}
            path={path}
            label={label}
            Icon={Icon}
            collapsed={collapsed}
            onClick={onNavClick}
          />
        ))}
      </nav>

      <div className="flex-shrink-0 border-t border-white/8">
        <div className={cn("px-2 py-3", collapsed ? "flex justify-center" : "")}>
          <StatusBar compact={collapsed} />
        </div>

        <button
          onClick={onToggle}
          className={cn(
            "w-full flex items-center gap-2 px-3 py-2.5 text-white/30 hover:text-white/60 hover:bg-white/5 transition-colors border-t border-white/8",
            collapsed ? "justify-center" : "justify-end"
          )}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <>
              <span className="text-xs font-mono">Collapse</span>
              <ChevronLeft className="w-4 h-4" />
            </>
          )}
        </button>
      </div>
    </aside>
  );
}

function MobileHeader({ onOpen }: { onOpen: () => void }) {
  return (
    <header className="flex items-center gap-3 px-4 py-3 border-b border-white/8 bg-black/30 backdrop-blur-sm flex-shrink-0 lg:hidden">
      <button
        onClick={onOpen}
        className="w-9 h-9 rounded-lg flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 border border-white/10 transition-colors"
        aria-label="Open menu"
      >
        <Menu className="w-4 h-4" />
      </button>
      <div className="flex items-center gap-2.5">
        <div className="w-7 h-7 rounded-lg bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center">
          <Anchor className="w-4 h-4 text-cyan-400" />
        </div>
        <span className="font-bold text-white text-sm tracking-wide">Phat Chance</span>
      </div>
      <div className="flex-1 flex justify-end">
        <StatusBar />
      </div>
    </header>
  );
}

function MobileDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <>
      <div
        className={cn(
          "fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity duration-300 lg:hidden",
          open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        )}
        onClick={onClose}
      />
      <div
        className={cn(
          "fixed top-0 left-0 bottom-0 z-50 flex flex-col bg-[#070d1a] border-r border-white/10 shadow-2xl transition-transform duration-300 ease-in-out lg:hidden w-64",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex items-center justify-between px-4 py-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center">
              <Anchor className="w-4 h-4 text-cyan-400" />
            </div>
            <span className="font-bold text-white tracking-wide">Phat Chance</span>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <nav className="flex flex-col gap-1 p-3 flex-1 overflow-y-auto">
          {navItems.map(({ path, label, icon: Icon }) => (
            <NavItem key={path} path={path} label={label} Icon={Icon} collapsed={false} onClick={onClose} />
          ))}
        </nav>
        <div className="p-4 border-t border-white/10">
          <StatusBar />
        </div>
      </div>
    </>
  );
}

function AppShell() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-[#070d1a] text-white">
      <div className="hidden lg:flex h-full">
        <Sidebar
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed((c) => !c)}
        />
      </div>

      <MobileHeader onOpen={() => setMobileOpen(true)} />
      <MobileDrawer open={mobileOpen} onClose={() => setMobileOpen(false)} />

      <div className="flex flex-col flex-1 min-w-0 h-full lg:h-auto">
        <div className="hidden lg:block flex-1 overflow-y-auto h-full">
          <Switch>
            <Route path="/" component={Dashboard} />
            <Route path="/navigation" component={Navigation} />
            <Route path="/wind" component={Wind} />
            <Route path="/instruments" component={Instruments} />
            <Route path="/ais" component={AIS} />
            <Route path="/tracking" component={Tracking} />
            <Route path="/autopilot" component={Autopilot} />
            <Route path="/settings" component={Settings} />
          </Switch>
        </div>
        <div className="lg:hidden flex-1 overflow-y-auto">
          <Switch>
            <Route path="/" component={Dashboard} />
            <Route path="/navigation" component={Navigation} />
            <Route path="/wind" component={Wind} />
            <Route path="/instruments" component={Instruments} />
            <Route path="/ais" component={AIS} />
            <Route path="/tracking" component={Tracking} />
            <Route path="/autopilot" component={Autopilot} />
            <Route path="/settings" component={Settings} />
          </Switch>
        </div>
      </div>
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <SignalKProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <AppShell />
          </WouterRouter>
          <Toaster />
        </SignalKProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
