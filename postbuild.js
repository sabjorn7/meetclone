import fs from 'fs';
import { createClient } from '@supabase/supabase-js';
import {
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    articleSeo,
    courseSeo,
    defaultSeo,
    fillTemplate,
} from './supabase/functions/_shared/og.mjs';

async function buildCollectionPages() {
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    const [{ data: articles, error: articlesError }, { data: courses, error: coursesError }] =
        await Promise.all([
            supabase
                .from('articles')
                .select('id,Title,Content,Image,slug')
                .eq('Status', 'Опубликовано')
                .not('slug', 'is', null),
            supabase
                .from('course')
                .select('id,Title,Decription,slug,video_id')
                .eq('ModStatus', 'Опубликовано')
                .not('slug', 'is', null),
        ]);

    if (articlesError) throw articlesError;
    if (coursesError) throw coursesError;

    return {
        '/article_page': (articles || []).map(a => ({ path: `articles/${a.slug}`, ...articleSeo(a) })),
        // courseSeo is async (resolves the PeerTube thumbnail per course).
        '/course_info': await Promise.all(
            (courses || []).map(async c => ({ path: `course/${c.slug}`, ...(await courseSeo(c)) }))
        ),
    };
}

async function run() {
    let collectionPages = {};
    try {
        collectionPages = await buildCollectionPages();
    } catch (e) {
        console.warn('[postbuild] Supabase fetch failed, skipping SEO pre-render:', e.message);
    }

    for (const collectionName of ['/article_page', '/course_info']) {
        const templatePath = `./dist${collectionName}/index.html`;
        if (!fs.existsSync(templatePath)) continue;

        // At this point the built entry still carries the __SEO_*__ placeholders.
        const template = fs.readFileSync(templatePath, 'utf8');
        const items = collectionPages[collectionName] || [];

        for (const item of items) {
            const html = fillTemplate(template, item);
            fs.mkdirSync(`./dist/${item.path}`, { recursive: true });
            fs.writeFileSync(`./dist/${item.path}/index.html`, html);
        }

        // Persist the placeholder template so the `og-render` edge function can
        // fetch it at runtime and fill OG tags for slugs published AFTER this
        // build (the nginx cache-miss path). Stays in sync with this build's
        // asset hashes because it's the very template we just used.
        fs.writeFileSync(`./dist${collectionName}/_seo.tmpl.html`, template);

        // Overwrite the entry with generic site defaults. It doubles as the
        // nginx graceful-degradation shell if the dynamic endpoint is down, and
        // as the target for UUID-based (non-slug) hits.
        const fallback = fillTemplate(template, defaultSeo());
        fs.writeFileSync(templatePath, fallback);

        console.log(
            `[postbuild] ${collectionName}: pre-rendered ${items.length} page(s) + _seo.tmpl.html`
        );
    }
}

await run();
