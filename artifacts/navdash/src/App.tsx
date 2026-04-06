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
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Compass,
  Wind as WindIcon,
  Radio,
  Gauge,
  Settings as SettingsIcon,
  Anchor,
} from "lucide-react";

const queryClient = new QueryClient();

const navItems = [
  { path: "/", label: "Dashboard", icon: LayoutDashboard },
  { path: "/navigation", label: "Navigation", icon: Compass },
  { path: "/wind", label: "Wind", icon: WindIcon },
  { path: "/instruments", label: "Instruments", icon: Gauge },
  { path: "/ais", label: "AIS", icon: Radio },
  { path: "/settings", label: "Settings", icon: SettingsIcon },
];

function NavLink({ path, label, Icon }: { path: string; label: string; Icon: React.ComponentType<{ className?: string }> }) {
  const [location] = useLocation();
  const isActive = path === "/" ? location === "/" : location.startsWith(path);
  return (
    <Link href={path}>
      <div
        className={cn(
          "flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer select-none",
          isActive
            ? "bg-cyan-500/15 text-cyan-400 border border-cyan-500/25"
            : "text-white/40 hover:text-white/70 hover:bg-white/5 border border-transparent"
        )}
        data-testid={`nav-${label.toLowerCase()}`}
      >
        <Icon className="w-4 h-4 flex-shrink-0" />
        <span className="hidden md:block">{label}</span>
      </div>
    </Link>
  );
}

function AppShell() {
  return (
    <div className="flex flex-col h-screen overflow-hidden bg-[#070d1a] text-white">
      <header className="flex items-center gap-4 px-4 py-3 border-b border-white/8 bg-black/30 backdrop-blur-sm flex-shrink-0">
        <div className="flex items-center gap-2.5 mr-4">
          <div className="w-7 h-7 rounded-lg bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center">
            <Anchor className="w-4 h-4 text-cyan-400" />
          </div>
          <span className="font-bold text-white text-sm tracking-wide hidden sm:block">NavDash</span>
        </div>
        <nav className="flex items-center gap-1 flex-1 overflow-x-auto">
          {navItems.map(({ path, label, icon: Icon }) => (
            <NavLink key={path} path={path} label={label} Icon={Icon} />
          ))}
        </nav>
        <div className="flex-shrink-0">
          <StatusBar />
        </div>
      </header>
      <main className="flex-1 overflow-y-auto">
        <Switch>
          <Route path="/" component={Dashboard} />
          <Route path="/navigation" component={Navigation} />
          <Route path="/wind" component={Wind} />
          <Route path="/instruments" component={Instruments} />
          <Route path="/ais" component={AIS} />
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
