// Dynamic Open-Graph pre-render for article/course detail pages that were
// published AFTER the last static build (postbuild.js is build-time SSG, so a
// freshly-published slug has no dist/<...>/<slug>/index.html yet).
//
// nginx routes only cache-misses here (see functions/og-render/README.md).
// Served to everyone — no user-agent cloaking: crawlers read the injected OG
// meta, real users get the same SPA shell that then hydrates normally. On the
// next deploy, postbuild bakes the slug static again and this stops being hit.
//
// Self-hosted deploy: copy this folder + ../_shared into the edge-runtime's
// volumes/functions/ and restart it (see README) — NOT `supabase functions
// deploy` (that's the Cloud-only flow). JWT verification stays ON; nginx keeps
// the endpoint reachable by forwarding the public anon key, so the runtime is
// untouched.

import {
    SITE_ORIGIN,
    articleSeo,
    courseSeo,
    defaultSeo,
    fillTemplate,
    fetchArticleBySlug,
    fetchCourseBySlug,
} from '../_shared/og.mjs';

const TMPL_TTL_MS = 5 * 60 * 1000;
const tmplCache = new Map<string, { html: string; at: number }>();

// Fetch the placeholder SPA shell that postbuild persisted next to the entry
// (dist/article_page/_seo.tmpl.html, dist/course_info/_seo.tmpl.html). Fetching
// it live keeps the function in lock-step with the current build's asset hashes
// — nothing hardcoded here to drift.
async function getTemplate(origin: string, type: string): Promise<string> {
    const coll = type === 'course' ? 'course_info' : 'article_page';
    const key = `${origin}/${coll}`;
    const hit = tmplCache.get(key);
    if (hit && Date.now() - hit.at < TMPL_TTL_MS) return hit.html;

    const res = await fetch(`${origin}/${coll}/_seo.tmpl.html`);
    if (!res.ok) throw new Error(`template ${coll} -> ${res.status}`);
    const html = await res.text();
    tmplCache.set(key, { html, at: Date.now() });
    return html;
}

function htmlResponse(html: string, status = 200): Response {
    return new Response(html, {
        status,
        headers: {
            'content-type': 'text/html; charset=utf-8',
            // nginx proxy_cache does the real caching; this just hints crawlers.
            'cache-control': 'public, max-age=300',
        },
    });
}

Deno.serve(async (req: Request) => {
    const url = new URL(req.url);
    const type = url.searchParams.get('type') || '';
    const slug = url.searchParams.get('slug') || '';
    // nginx forwards the public host so og:url / template origin are correct on
    // both app.meetgu.ru and test.meetgu.ru.
    const fwdHost = req.headers.get('x-forwarded-host');
    const origin = fwdHost ? `https://${fwdHost}` : SITE_ORIGIN;

    if (type !== 'article' && type !== 'course') {
        return htmlResponse('Bad request: type must be "article" or "course"', 400);
    }

    try {
        const tmpl = await getTemplate(origin, type);
        let seo;
        if (type === 'article') {
            const a = slug ? await fetchArticleBySlug(slug) : null;
            seo = a ? articleSeo(a, origin) : defaultSeo(origin);
        } else {
            const c = slug ? await fetchCourseBySlug(slug) : null;
            seo = c ? await courseSeo(c, origin) : defaultSeo(origin);
        }
        return htmlResponse(fillTemplate(tmpl, seo));
    } catch (err) {
        // Never 500 to a crawler. Try the generic shell; if even that fails,
        // return a minimal valid document.
        console.error('[og-render]', (err as Error)?.message ?? err);
        try {
            const tmpl = await getTemplate(origin, type);
            return htmlResponse(fillTemplate(tmpl, defaultSeo(origin)));
        } catch {
            return htmlResponse(
                '<!doctype html><html lang="ru"><head><meta charset="utf-8">' +
                    '<title>МитГуру</title></head><body></body></html>'
            );
        }
    }
});
