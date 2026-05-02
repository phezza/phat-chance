# Phat Chance — Boat Setup Guide

This dashboard runs on an **Android tablet** mounted at the helm. The tablet is both the server (talks to the NavLink2 over WiFi) and the display. No laptop, no Raspberry Pi, no extra hardware.

If you'd rather run it on a different device (Windows / macOS / Linux laptop, mini PC, travel router), see [Other devices](#other-devices) at the bottom.

---

## What you need

- An Android tablet (Android 7 or newer)
- A 12V → USB power outlet at the helm to keep it charged
- Your boat WiFi already configured to talk to the NavLink2 (you should be able to ping `192.168.1.47` from the tablet)

---

## One-time install on the Android tablet

### 1. Install Termux (the Linux environment)

**Important:** install Termux from **F-Droid**, NOT the Google Play Store version (the Play Store version is abandoned and broken).

1. On the tablet, open Chrome and go to <https://f-droid.org>
2. Download and install F-Droid (you'll need to allow installs from unknown sources)
3. In F-Droid, search for and install:
   - **Termux**
   - **Termux:Boot** (lets the dashboard auto-start when the tablet powers on)
   - **Termux:API** (optional, for keep-screen-on from the terminal)

### 2. Install Node.js, git, and pnpm

Open Termux and run:

```bash
pkg update -y && pkg upgrade -y
pkg install -y nodejs git
npm install -g pnpm
```

### 3. Get the dashboard code

```bash
cd ~
git clone <your-repo-url> phat-chance
cd phat-chance
pnpm install
```

(If you don't have a git repo, copy the project folder onto the tablet via USB cable into `/sdcard/Download/` and then `cp -r /sdcard/Download/phat-chance ~/`.)

### 4. Test it

```bash
termux-wake-lock                # stops Android killing Termux when screen sleeps
pnpm run start:local
```

You should see something like:

```
✓ Phat Chance running
   Local:   http://localhost:3000
   Network: http://192.168.1.50:3000
```

Now open Chrome on the same tablet and go to **http://localhost:3000** — the dashboard loads. It can also be opened from your phone or any other device on the boat WiFi using the `Network:` URL above.

When you're done testing, stop the server with `Ctrl+C` and release the wake lock with `termux-wake-unlock`.

---

## Make it auto-start when the tablet powers on

So you never have to think about it again.

```bash
mkdir -p ~/.termux/boot
cat > ~/.termux/boot/start-phat-chance <<'EOF'
#!/data/data/com.termux/files/usr/bin/sh
termux-wake-lock
cd ~/phat-chance
pnpm run start:local:fast >> ~/phat-chance.log 2>&1
EOF
chmod +x ~/.termux/boot/start-phat-chance
```

Reboot the tablet. After it boots, open Chrome → `http://localhost:3000` — the dashboard should load. Termux:Boot ran the script in the background.

To check the logs later: `tail -f ~/phat-chance.log` in Termux.

---

## Add the dashboard to the home screen (PWA install)

So it opens fullscreen with no browser bars, like a native app.

1. In Chrome, open `http://localhost:3000`
2. Tap the **⋮** menu in the top-right
3. Tap **"Install app"** (or "Add to Home Screen")
4. Confirm the name "Phat Chance"
5. The app icon now lives on the tablet's home screen and launcher
6. Tap it — fullscreen dashboard, no Chrome chrome

---

## Helm-display tweaks

These turn the tablet into a permanently-on chartplotter.

### Stay awake while charging

Settings → System → **Developer options** → **Stay awake while charging** = ON.

(To enable Developer options: Settings → About tablet → tap "Build number" 7 times.)

### Keep screen on from inside the dashboard

In the dashboard, go to **Settings → Display** and tick **"Keep screen on while dashboard is open"**. The browser will hold a wake lock as long as the tab is visible — even without the developer setting above.

### Lock to landscape

Pull down the quick-settings panel and tap the rotation lock icon while the tablet is in your preferred orientation.

### Hide the navigation bar (full-screen)

If your tablet supports gesture navigation, enable it in Settings → System → Gestures so the dashboard fills the entire screen.

---

## First connection to the NavLink2

1. Make sure the tablet is on the same WiFi as the NavLink2 (`192.168.1.x`)
2. Open the dashboard → **Settings**
3. Pick **Direct NMEA TCP** mode
4. Host: `192.168.1.47`
5. Port: `2000`
6. Tap **Save & Connect**
7. The status badge in the bottom-left should turn green ("Connected") and you'll see live NMEA sentences scroll in the **Live NMEA Stream** panel below

If it says "Error" or "Connecting" forever:
- Verify you can reach the NavLink2: in Termux run `ping 192.168.1.47`
- Verify port 2000 is open: in Termux run `nc -vz 192.168.1.47 2000` — should say "succeeded"
- Check the NavLink2's web config (default <http://192.168.1.47>) and make sure NMEA-over-TCP is enabled and the port matches

---

## Updating the dashboard

One command does it all — pulls the latest code, reinstalls any new dependencies, and stops the running server so the Termux:Boot script picks up the new build on next launch:

```bash
cd ~/phat-chance
pnpm run update
```

Then either reboot the tablet, or just run `pnpm run start:local` again to start it back up immediately.

(If you'd rather do it the manual way: `git pull && pnpm install && pkill -f start-local`.)

---

## Other devices

The same `pnpm run start:local` command works on:

- **Any Linux/macOS/Windows laptop** — useful for testing at home before going to the boat
- **A Raspberry Pi** (any model with WiFi) — same install steps as Android above, but skip Termux: just install Node 20+ and pnpm directly with `apt install nodejs && npm i -g pnpm`
- **A GL.iNet travel router** — possible if the router runs OpenWrt with sufficient storage (rare for the cheap models, fine for the £70+ ones)

The only requirement is that the device:
1. Is on the same WiFi as the NavLink2 (so it can open `192.168.1.47:2000`)
2. Stays powered on while you want the dashboard to work
3. Can run Node.js 20+

---

## Troubleshooting

**"Termux killed in background"** — you forgot `termux-wake-lock`, or Android battery optimizer is killing Termux. Settings → Apps → Termux → Battery → "Unrestricted".

**"Port already in use"** — another instance is running. Kill it: `pkill -f start-local` then start again.

**"pnpm: command not found" after reboot** — npm's global bin isn't on PATH in the boot shell. Add this to the top of `~/.termux/boot/start-phat-chance`:
```
export PATH="$PATH:$(npm config get prefix)/bin"
```

**Dashboard loads but no data** — see "First connection" above. The `Connecting` badge in the bottom-left of every page is your first diagnostic.

**Want to access from your phone/another tablet** — they just need to be on the boat WiFi too, then open `http://<tablet-ip>:3000`. Find the tablet's IP in Termux with `ifconfig wlan0` or in Android Settings → About → Status → IP address.
