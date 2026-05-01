import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);

if ("serviceWorker" in navigator && import.meta.env.PROD) {
  let initialController = navigator.serviceWorker.controller;
  let reloadGuard = false;

  // When a brand-new service worker takes over an already-loaded page,
  // reload once so the user sees the new build instead of stale code.
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (reloadGuard) return;
    if (initialController === null) {
      // First-time install — no previous controller to swap; nothing to reload.
      initialController = navigator.serviceWorker.controller;
      return;
    }
    reloadGuard = true;
    window.location.reload();
  });

  // Belt-and-braces: if the SW posts an update message, reload as well.
  navigator.serviceWorker.addEventListener("message", (event) => {
    if (event.data?.type === "SW_UPDATED" && !reloadGuard) {
      reloadGuard = true;
      window.location.reload();
    }
  });

  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then((reg) => {
        // Poll for updates every 5 minutes while the PWA is open.
        setInterval(() => {
          reg.update().catch(() => undefined);
        }, 5 * 60 * 1000);
      })
      .catch((err) => {
        console.warn("Service worker registration failed:", err);
      });
  });
}
