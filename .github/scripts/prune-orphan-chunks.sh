#!/usr/bin/env bash
#
# Prune orphaned (unreferenced) hashed chunks from a deployed web root — BY REFERENCE, never by age.
#
# Why by reference: the deploy keeps old hashed chunks on disk (assets/ is excluded from rsync --delete)
# so already-open tabs don't 404 on a lazy chunk. Over many deploys the superseded versions accumulate.
# They cannot be pruned by mtime — rsync runs with -c and skips unchanged files, so content-stable vendor
# chunks keep an OLD mtime while still being referenced; deleting by age 404s the live app (incident
# f721233). The only safe discriminator is reachability from the live HTML entry points.
#
# Algorithm: seed the reachable set with every asset basename referenced by any live *.html, then follow
# references found INSIDE reachable .js/.css (this is where Vite/Rolldown write dynamic-import chunk names)
# to a fixpoint. Anything in assets/ not reachable is an orphan. Orphans are MOVED to a sibling backup dir
# (not hard-deleted) so a mistake is one `mv` away from recovery.
#
# Usage: bash prune-orphan-chunks.sh <web-root> <dry_run: true|false>
set -euo pipefail

ROOT="${1:?usage: prune-orphan-chunks.sh <web-root> <dry_run>}"
DRY="${2:-true}"

echo "=== prune $ROOT (dry_run=$DRY) ==="
if [ ! -d "$ROOT/assets" ]; then echo "no assets/ under $ROOT — skip"; exit 0; fi
cd "$ROOT"

# Refuse to run where there is no HTML at all — without entry points EVERYTHING looks orphaned.
if [ -z "$(find . -maxdepth 3 -name '*.html' -print -quit)" ]; then
  echo "no *.html under $ROOT — refusing to prune (would classify every chunk as orphan)"; exit 1
fi

W="$(mktemp -d)"
trap 'rm -rf "$W"' EXIT

# All asset FILE basenames (flat dir).
find assets -maxdepth 1 -type f -printf '%f\n' | sort -u > "$W/all.txt"
TOTAL=$(wc -l < "$W/all.txt")

# Seed: asset basenames referenced by any live *.html.
grep -rhoF -f "$W/all.txt" --include='*.html' . 2>/dev/null | sort -u > "$W/html.txt" || true
cp "$W/html.txt" "$W/reach.txt"

# BFS to a fixpoint: follow references inside already-reachable files.
while :; do
  before=$(wc -l < "$W/reach.txt")
  : > "$W/files.txt"
  while read -r b; do [ -f "assets/$b" ] && echo "assets/$b"; done < "$W/reach.txt" > "$W/files.txt"
  if [ -s "$W/files.txt" ]; then
    xargs -a "$W/files.txt" grep -hoF -f "$W/all.txt" 2>/dev/null | sort -u > "$W/found.txt" || true
    sort -u "$W/reach.txt" "$W/found.txt" -o "$W/reach.txt"
  fi
  after=$(wc -l < "$W/reach.txt")
  [ "$before" = "$after" ] && break
done
REACH=$(wc -l < "$W/reach.txt")

# Orphans = all − reachable.
comm -23 "$W/all.txt" "$W/reach.txt" > "$W/orphans.txt"
ORPH=$(wc -l < "$W/orphans.txt")
echo "total=$TOTAL  reachable=$REACH  orphans=$ORPH"

# TRIPWIRE: an HTML-referenced asset must never be an orphan (true by construction — assert anyway).
if comm -12 "$W/html.txt" "$W/orphans.txt" | grep -q .; then
  echo "ABORT: HTML-referenced asset(s) classified as orphan — refusing to touch anything:"
  comm -12 "$W/html.txt" "$W/orphans.txt"
  exit 1
fi

if [ "$ORPH" -eq 0 ]; then echo "nothing to prune"; exit 0; fi
echo "--- orphans ($ORPH) ---"; cat "$W/orphans.txt"
SIZE="$( (cd assets && xargs -a "$W/orphans.txt" du -ch 2>/dev/null | tail -1 | cut -f1) )"
echo "orphan total size: ${SIZE:-?}"

if [ "$DRY" != "false" ]; then
  echo "DRY RUN — nothing moved. Re-run with dry_run=false to apply."
  exit 0
fi

BAK="${ROOT}-orphans-bak-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BAK"
moved=0
while read -r b; do [ -f "assets/$b" ] && mv "assets/$b" "$BAK/" && moved=$((moved+1)); done < "$W/orphans.txt"
echo "moved $moved file(s) → $BAK ($(du -sh "$BAK" | cut -f1))"

# POST-MOVE sanity: every still-reachable asset must still be on disk.
missing=0
while read -r b; do [ -f "assets/$b" ] || { echo "POST-MOVE MISSING (reachable!): $b"; missing=$((missing+1)); }; done < "$W/reach.txt"
if [ "$missing" -ne 0 ]; then
  echo "ERROR: $missing reachable asset(s) went missing — restore from $BAK immediately."; exit 1
fi
echo "post-move OK: all $REACH reachable assets present; assets/ now $(find assets -maxdepth 1 -type f | wc -l) files, $(du -sh assets | cut -f1)"
echo "backup kept at $BAK — delete it once the site is confirmed healthy."
