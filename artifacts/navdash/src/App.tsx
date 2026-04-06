import { useState, useEffect } from "react";
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
  Menu,
  X,
  Route as RouteIcon,
  Cpu,
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

function NavLink({
  path,
  label,
  Icon,
  onClick,
  compact,
}: {
  path: string;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
  onClick?: () => void;
  compact?: boolean;
}) {
  const [location] = useLocation();
  const isActive = path === "/" ? location === "/" : location.startsWith(path);
  return (
    <Link href={path} onClick={onClick}>
      <div
        className={cn(
          "flex items-center gap-2.5 rounded-lg font-medium transition-all cursor-pointer select-none",
          compact ? "px-3 py-2 text-sm" : "px-4 py-3 text-base",
          isActive
            ? "bg-cyan-500/15 text-cyan-400 border border-cyan-500/25"
            : "text-white/50 hover:text-white/80 hover:bg-white/5 border border-transparent"
        )}
        data-testid={`nav-${label.toLowerCase()}`}
      >
        <Icon className={cn("flex-shrink-0", compact ? "w-4 h-4" : "w-5 h-5")} />
        <span>{label}</span>
      </div>
    </Link>
  );
}

function MobileDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  return (
    <>
      <div
        className={cn(
          "fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity duration-300",
          open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        )}
        onClick={onClose}
        data-testid="drawer-backdrop"
      />
      <div
        className={cn(
          "fixed top-0 left-0 bottom-0 z-50 w-72 flex flex-col bg-[#070d1a] border-r border-white/10 shadow-2xl transition-transform duration-300 ease-in-out",
          open ? "translate-x-0" : "-translate-x-full"
        )}
        data-testid="mobile-drawer"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center">
              <Anchor className="w-4 h-4 text-cyan-400" />
            </div>
            <span className="font-bold text-white tracking-wide">Phat Chance</span>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 transition-colors"
            data-testid="button-close-drawer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <nav className="flex flex-col gap-1 p-3 flex-1 overflow-y-auto">
          {navItems.map(({ path, label, icon: Icon }) => (
            <NavLink key={path} path={path} label={label} Icon={Icon} onClick={onClose} />
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
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-[#070d1a] text-white">
      <header className="flex items-center gap-3 px-4 py-3 border-b border-white/8 bg-black/30 backdrop-blur-sm flex-shrink-0">
        <button
          onClick={() => setDrawerOpen(true)}
          className="w-9 h-9 rounded-lg flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 border border-white/10 transition-colors lg:hidden flex-shrink-0"
          data-testid="button-burger-menu"
          aria-label="Open menu"
        >
          <Menu className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-2.5 flex-shrink-0">
          <div className="w-7 h-7 rounded-lg bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center hidden lg:flex">
            <Anchor className="w-4 h-4 text-cyan-400" />
          </div>
          <span className="font-bold text-white text-sm tracking-wide hidden lg:block">Phat Chance</span>
        </div>

        <nav className="hidden lg:flex items-center gap-1 flex-1 overflow-x-auto">
          {navItems.map(({ path, label, icon: Icon }) => (
            <NavLink key={path} path={path} label={label} Icon={Icon} compact />
          ))}
        </nav>

        <div className="flex-1 lg:flex-none flex justify-end lg:justify-start">
          <StatusBar />
        </div>
      </header>

      <MobileDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />

      <main className="flex-1 overflow-y-auto">
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
      </main>
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
