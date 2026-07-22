import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const SITE_ORIGIN = 'https://app.meetgu.ru';
const DEFAULT_IMAGE = `${SITE_ORIGIN}/images/favicon.png`;
const DEFAULT_TITLE = 'МитГуру — моя страница';
const DEFAULT_DESC = 'Ваши курсы, прогресс обучения и последние материалы на платформе МитГуру.';

const SUPABASE_URL = 'https://sb.meetgu.ru';
const SUPABASE_ANON_KEY =
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.ewogICAgInJvbGUiOiAiYW5vbiIsCiAgICAiaXNzIjogInN1cGFiYXNlIiwKICAgICJpYXQiOiAxNzQ1NDQyMDAwLAogICAgImV4cCI6IDE5MDMyMDg0MDAKfQ.6o8FlA2X8jsM4lUKF1mqKSC-v_GX5iE0dY20b6x8bnw';

function stripHtml(html) {
    return (html || '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function truncate(text, max = 160) {
    if (text.length <= max) return text;
    const cut = text.slice(0, max);
    const lastSpace = cut.lastIndexOf(' ');
    return (lastSpace > 0 ? cut.slice(0, lastSpace) : cut) + '…';
}

async function buildCollectionPages() {
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    const [{ data: articles, error: articlesError }, { data: courses, error: coursesError }] = await Promise.all([
        supabase.from('articles').select('id,Title,Content,Image,slug').eq('Status', 'Опубликовано').not('slug', 'is', null),
        supabase.from('course').select('id,Title,Decription,slug').eq('ModStatus', 'Опубликовано').not('slug', 'is', null),
    ]);

    if (articlesError) throw articlesError;
    if (coursesError) throw coursesError;

    return {
        '/article_page': (articles || []).map(a => ({
            path: `articles/${a.slug}`,
            title: `${a.Title} — МитГуру`,
            desc: truncate(stripHtml(a.Content)),
            image: a.Image || DEFAULT_IMAGE,
            url: `${SITE_ORIGIN}/articles/${a.slug}`,
        })),
        '/course_info': (courses || []).map(c => ({
            path: `course/${c.slug}`,
            title: `${c.Title} — МитГуру`,
            desc: truncate(c.Decription || ''),
            image: DEFAULT_IMAGE,
            url: `${SITE_ORIGIN}/course/${c.slug}`,
        })),
    };
}

function renderTemplate(template, { title, desc, image, url }) {
    return template
        .replaceAll('__SEO_TITLE__', title)
        .replaceAll('__SEO_DESC__', desc)
        .replaceAll('__SEO_IMAGE__', image)
        .replaceAll('__SEO_URL__', url);
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

        const template = fs.readFileSync(templatePath, 'utf8');
        const items = collectionPages[collectionName] || [];

        for (const item of items) {
            const html = renderTemplate(template, item);
            fs.mkdirSync(`./dist/${item.path}`, { recursive: true });
            fs.writeFileSync(`./dist/${item.path}/index.html`, html);
        }

        // Keep the original template folder in place (do NOT delete it) — it
        // doubles as the nginx SPA-fallback shell for any slug/uuid not
        // covered by this build (new content published after the last
        // deploy, or the UUID-based legacy-redirect target). Bake in generic
        // site defaults so the file is self-contained.
        const fallback = renderTemplate(template, {
            title: DEFAULT_TITLE,
            desc: DEFAULT_DESC,
            image: DEFAULT_IMAGE,
            url: SITE_ORIGIN,
        });
        fs.writeFileSync(templatePath, fallback);

        console.log(`[postbuild] ${collectionName}: pre-rendered ${items.length} page(s)`);
    }
}

await run();
