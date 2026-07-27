# og-render — dynamic Open-Graph pre-render

Fixes: newly-published articles/courses show generic OG (favicon + default
description) in link previews until the next deploy, because `postbuild.js` is
**build-time** SSG. This edge function renders correct OG **on the fly** for any
slug that doesn't yet have a static prerender, closing the "shared before the
rebuild" gap (social platforms cache OG on first fetch).

## How it fits together

```
GET /articles/<slug>  or  /course/<slug>
        │
   nginx: try_files $uri $uri/ @og
        ├── static dir exists  → serve prerender (fast path, unchanged)
        └── cache-miss         → @og → proxy_pass (proxy_cache) → this function
                                        │
                                        ├─ query Supabase by slug (PostgREST, anon)
                                        ├─ course image = PeerTube preview (video_id)
                                        ├─ fetch <origin>/<coll>/_seo.tmpl.html
                                        └─ fill __SEO_*__ → text/html
```

- **Not found / any error →** returns the generic shell (never 500 to a crawler).
- Served to **everyone** (no user-agent cloaking). Real users get the same SPA
  shell that hydrates normally; crawlers read the injected meta.
- On the next deploy, `postbuild.js` bakes the slug static and this stops being hit.
- Render logic is shared with `postbuild.js` via `../_shared/og.mjs`, so
  build-time and runtime output are identical. Course og:image now comes from the
  PeerTube preview thumbnail (`GET video.meetgu.ru/api/v1/videos/<video_id>` →
  `previewPath`) instead of always the favicon.

## Deploy the function (one-time, from the server / a machine with supabase CLI)

```bash
# public endpoint — no JWT (nginx is the only caller, PostgREST auth is inside)
supabase functions deploy og-render --no-verify-jwt --project-ref <ref>
# self-hosted: point the CLI at your instance, or drop the folder into the
# functions volume your edge-runtime container serves and restart it.

# smoke test (bypassing nginx):
curl -s "https://sb.meetgu.ru/functions/v1/og-render?type=article&slug=manualnaya-terapiya-telo-i-psihika" \
  | grep -o '<meta property="og:title[^>]*>'
```

`_seo.tmpl.html` is produced by `postbuild.js` on the next site deploy, so deploy
the site (or push to main) at least once after merging before the function can
fetch a template. Until then it falls back to the generic shell.

## nginx (apply via SSH, then `nginx -t && nginx -s reload`)

```nginx
# ── http {} context (once) ───────────────────────────────────────────────
proxy_cache_path /var/cache/nginx/og levels=1:2 keys_zone=og_cache:10m
                 max_size=200m inactive=1h use_temp_path=off;

map $uri $og_type {
    ~^/articles/  article;
    ~^/course/    course;
    default       "";
}
map $uri $og_slug {
    ~^/articles/([^/]+)/?$  $1;
    ~^/course/([^/]+)/?$    $1;
    default                 "";
}

# ── inside server { } for app.meetgu.ru (and test.meetgu.ru) ─────────────
# IMPORTANT: put these BEFORE any catch-all `location /` SPA fallback.

location ~ ^/(articles|course)/[^/]+/?$ {
    try_files $uri $uri/ @og;
}

location @og {
    resolver 127.0.0.53 ipv6=off;      # <-- your resolver (systemd-resolved here); or 127.0.0.1 / 8.8.8.8
    set $og_upstream "https://sb.meetgu.ru/functions/v1/og-render?type=$og_type&slug=$og_slug";
    proxy_pass $og_upstream;

    proxy_ssl_server_name on;
    proxy_set_header Host sb.meetgu.ru;
    proxy_set_header X-Forwarded-Host $host;   # so og:url / template origin match the real domain

    proxy_cache        og_cache;
    proxy_cache_key     "$host:$og_type:$og_slug";
    proxy_cache_valid   200 10m;
    proxy_cache_valid   400 404 1m;
    proxy_cache_use_stale error timeout updating;
    add_header X-OG-Cache $upstream_cache_status;
}
```

```bash
mkdir -p /var/cache/nginx/og && chown -R www-data:www-data /var/cache/nginx/og   # (nginx user)
```

If you keep JWT verification on the function instead of `--no-verify-jwt`, add to
`location @og`:

```nginx
proxy_set_header apikey        "<ANON_KEY>";
proxy_set_header Authorization "Bearer <ANON_KEY>";
```

## Verify after applying

```bash
# a slug that has NO static prerender (freshly published, or force one):
curl -sk "https://app.meetgu.ru/articles/<new-slug>" | grep -oE '<meta property="og:(title|description|image)"[^>]*>'
# expect the article's real title/description/image, and header X-OG-Cache: MISS then HIT
```
