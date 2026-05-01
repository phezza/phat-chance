#!/data/data/com.termux/files/usr/bin/env bash
# Phat Chance tablet diagnostic — paste the full output back to the agent.
# Usage:  bash scripts/diagnose-tablet.sh

set +e

line() { printf '\n========== %s ==========\n' "$1"; }

line "WHERE AM I"
pwd
echo "User: $(whoami)"
echo "Hostname: $(hostname 2>/dev/null || echo unknown)"
echo "Date: $(date)"

line "GIT STATE"
git --no-optional-locks rev-parse --abbrev-ref HEAD 2>&1
git --no-optional-locks log --oneline -10 2>&1
echo "--- remote ---"
git --no-optional-locks remote -v 2>&1
echo "--- status ---"
git --no-optional-locks status -s 2>&1
echo "--- last fetch ---"
git --no-optional-locks log --oneline -3 origin/main 2>&1

line "KEY FILES PRESENT?"
for f in scripts/start-local.mjs artifacts/navdash/public/sw.js artifacts/navdash/vite.config.ts artifacts/navdash/dist/public/sw.js artifacts/navdash/dist/public/index.html; do
  if [ -f "$f" ]; then
    sz=$(wc -c < "$f")
    md=$(md5sum "$f" 2>/dev/null | awk '{print $1}')
    mt=$(date -r "$f" 2>/dev/null || stat -c %y "$f" 2>/dev/null)
    printf "OK    %s  (%s bytes, md5 %s, modified %s)\n" "$f" "$sz" "$md" "$mt"
  else
    printf "MISS  %s\n" "$f"
  fi
done

line "DOES start-local.mjs CONTAIN THE NEW BUILD ID LOGIC?"
grep -nE "BUILD_ID|Stamped service worker|build [0-9]" scripts/start-local.mjs 2>/dev/null | head -20

line "DOES sw.js HAVE __BUILD_ID__ PLACEHOLDER OR A REAL STAMP?"
grep -n "CACHE_VERSION\|__BUILD_ID__" artifacts/navdash/public/sw.js 2>/dev/null
echo "--- in dist (the served version): ---"
grep -n "CACHE_VERSION\|__BUILD_ID__" artifacts/navdash/dist/public/sw.js 2>/dev/null | head -5

line "DOES vite.config.ts HAVE __BUILD_ID__?"
grep -n "__BUILD_ID__\|__BUILD_TIME__" artifacts/navdash/vite.config.ts 2>/dev/null

line "WHAT'S CURRENTLY RUNNING ON PORT 3000?"
ss -lntp 2>/dev/null | grep ":3000 " || netstat -lntp 2>/dev/null | grep ":3000 " || echo "(no ss/netstat available)"

line "PROCESSES MATCHING phat-chance / start-local"
ps aux 2>/dev/null | grep -E "start-local|node|phat" | grep -v grep

line "DONE — paste all of the above back to the agent"
