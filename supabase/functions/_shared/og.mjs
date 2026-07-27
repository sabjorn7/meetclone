// Shared, runtime-agnostic SEO/Open-Graph helpers.
//
// Imported by BOTH:
//   - postbuild.js               (Node 20, build-time static pre-render)
//   - functions/og-render/index.ts (Deno, runtime dynamic pre-render)
//
// So build-time and on-the-fly output are byte-identical. Uses only APIs
// present in both runtimes (global fetch, string ops) — no fs / no Deno.* /
// no Node-only imports.

export const SITE_ORIGIN = 'https://app.meetgu.ru';
export const SUPABASE_URL = 'https://sb.meetgu.ru';
// anon key — public by design (also embedded in the client bundle); same key
// postbuild.js already used for the build-time fetch.
export const SUPABASE_ANON_KEY =
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.ewogICAgInJvbGUiOiAiYW5vbiIsCiAgICAiaXNzIjogInN1cGFiYXNlIiwKICAgICJpYXQiOiAxNzQ1NDQyMDAwLAogICAgImV4cCI6IDE5MDMyMDg0MDAKfQ.6o8FlA2X8jsM4lUKF1mqKSC-v_GX5iE0dY20b6x8bnw';
export const PEERTUBE_ORIGIN = 'https://video.meetgu.ru';

export const DEFAULT_IMAGE = `${SITE_ORIGIN}/images/favicon.png`;
export const DEFAULT_TITLE = 'МитГуру — моя страница';
export const DEFAULT_DESC =
    'Ваши курсы, прогресс обучения и последние материалы на платформе МитГуру.';

export function stripHtml(html) {
    return (html || '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

export function truncate(text, max = 160) {
    const t = text || '';
    if (t.length <= max) return t;
    const cut = t.slice(0, max);
    const lastSpace = cut.lastIndexOf(' ');
    return (lastSpace > 0 ? cut.slice(0, lastSpace) : cut) + '…';
}

// Escape for both HTML text (<title>…</title>) and attribute (content="…")
// contexts. Safe in both — prevents a stray " or < in a Title/Content from
// breaking the meta tags (a latent bug in the old postbuild, which did not
// escape).
export function escapeHtml(s) {
    return String(s ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;');
}

// Courses have no image column — the cover is the promo video's PeerTube
// thumbnail. The thumbnail filename is a separate random UUID (not the video
// id), so we must ask the API. Public GET even for Unlisted videos. Any
// failure (missing id, network, timeout) falls back to the site default so a
// PeerTube hiccup never breaks OG rendering.
export async function resolveCourseImage(videoId) {
    if (!videoId) return DEFAULT_IMAGE;
    try {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 3000);
        const res = await fetch(
            `${PEERTUBE_ORIGIN}/api/v1/videos/${encodeURIComponent(videoId)}`,
            { signal: ctrl.signal }
        );
        clearTimeout(timer);
        if (!res.ok) return DEFAULT_IMAGE;
        const v = await res.json();
        const path = v.previewPath || v.thumbnailPath; // preview = larger, better for OG
        return path ? `${PEERTUBE_ORIGIN}${path}` : DEFAULT_IMAGE;
    } catch {
        return DEFAULT_IMAGE;
    }
}

export function articleSeo(a, origin = SITE_ORIGIN) {
    return {
        title: `${a.Title || ''} — МитГуру`,
        desc: truncate(stripHtml(a.Content)),
        image: a.Image || DEFAULT_IMAGE,
        url: `${origin}/articles/${a.slug}`,
    };
}

export async function courseSeo(c, origin = SITE_ORIGIN) {
    return {
        title: `${c.Title || ''} — МитГуру`,
        desc: truncate(c.Decription || ''), // note: DB column is misspelled "Decription"
        image: await resolveCourseImage(c.video_id),
        url: `${origin}/course/${c.slug}`,
    };
}

export function defaultSeo(origin = SITE_ORIGIN) {
    return { title: DEFAULT_TITLE, desc: DEFAULT_DESC, image: DEFAULT_IMAGE, url: origin };
}

export function fillTemplate(template, seo) {
    return template
        .replaceAll('__SEO_TITLE__', escapeHtml(seo.title))
        .replaceAll('__SEO_DESC__', escapeHtml(seo.desc))
        .replaceAll('__SEO_IMAGE__', escapeHtml(seo.image))
        .replaceAll('__SEO_URL__', escapeHtml(seo.url));
}

// --- runtime (by-slug) PostgREST lookups, used by the edge function ---------

async function restOne(table, query) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}&limit=1`, {
        headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
    });
    if (!res.ok) throw new Error(`PostgREST ${table} -> ${res.status}`);
    const rows = await res.json();
    return rows[0] || null;
}

export function fetchArticleBySlug(slug) {
    return restOne(
        'articles',
        `slug=eq.${encodeURIComponent(slug)}` +
            `&Status=eq.${encodeURIComponent('Опубликовано')}` +
            `&select=Title,Content,Image,slug`
    );
}

export function fetchCourseBySlug(slug) {
    return restOne(
        'course',
        `slug=eq.${encodeURIComponent(slug)}` +
            `&ModStatus=eq.${encodeURIComponent('Опубликовано')}` +
            `&select=Title,Decription,slug,video_id`
    );
}
