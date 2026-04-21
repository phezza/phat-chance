# Phat Chance — Local Boat Install

This is the marine navigation dashboard. To talk to your **NavLink2** it must
run on a device that's on the same WiFi network as the NavLink2 (laptop, Mac
mini, Raspberry Pi, etc). A cloud-hosted version cannot reach the NavLink2's
private LAN IP.

Once it's running on a "boat server" device, every phone / tablet / laptop on
the boat WiFi can open it in a browser, and iPhones/iPads can install it to
the home screen as an app (PWA).

---

## One-time setup on the boat server

1. **Install Node.js 20+** and **pnpm 9+**
   - Node: https://nodejs.org (pick the LTS)
   - pnpm: `npm install -g pnpm`
2. **Get the code** onto the boat server (clone this repo or copy the folder).
3. From the project root, install dependencies:

   ```bash
   pnpm install
   ```

## Start it

```bash
pnpm run start:local
```

This builds the UI + server, then starts everything on **port 3000**. You'll
see a banner showing the LAN URLs:

```
========================================================
  Phat Chance is running. Open from any device on this WiFi:
    http://localhost:3000
    http://192.168.1.42:3000        <-- use this from other devices
========================================================
```

To use a different port:

```bash
PORT=8080 pnpm run start:local
```

To skip the rebuild on a fast restart (after the first build):

```bash
pnpm run start:local:fast
```

## Connect to NavLink2

1. Open `http://<boat-server-ip>:<port>` from any device on the boat WiFi.
2. Go to **Settings** and pick a connection mode:
   - **Signal K Server** — host `192.168.1.1`, port `3000` (NavLink2 default).
     Browser connects to NavLink2 directly via WebSocket.
   - **Direct NMEA TCP** — host `192.168.1.1`, port `10110`. The boat server
     opens the TCP connection and relays the data to your browser.

(Use whichever IP / port the NavLink2 is actually configured for.)

## Add to iPhone home screen (PWA)

1. On the iPhone, open Safari and go to `http://<boat-server-ip>:<port>`.
2. Tap the **Share** button → **Add to Home Screen** → **Add**.
3. Launch from the home screen icon. The app runs full-screen with the
   status bar styled to match the dashboard.

The same works on iPad. On Android, Chrome shows an "Install app" prompt.

## Run as a permanent boat service

To keep the dashboard running even when no terminal is open, use a process
manager. Quick option using `pm2`:

```bash
npm install -g pm2
pm2 start "pnpm run start:local" --name phat-chance
pm2 startup       # follow the printed command to enable on boot
pm2 save
```

On Linux (Raspberry Pi), you can alternatively create a small `systemd`
service that runs `pnpm run start:local` from the project directory.

## Notes

- The boat server is the only device that needs the code. All other devices
  just open it in a browser.
- The dashboard remembers your connection settings per browser / device
  (stored in `localStorage`).
- If you connect via Signal K and your iPhone shows nothing, double-check
  that the NavLink2 IP/port is reachable (open `http://192.168.1.1:3000`
  in Safari first).
