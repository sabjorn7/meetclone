import { messageLinks } from './messageLinks.js';

const UUID = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const SLUG = /^[\p{L}\p{N}_-]{1,180}$/u;
export function internalChatLink(href) {
    let u;
    try { u = new URL(href); } catch { return null; }
    if (!['http:', 'https:'].includes(u.protocol) || u.hostname !== 'app.meetgu.ru' || u.port || u.username || u.password) return null;
    const path = u.pathname.replace(/\/$/, '');
    let type, field, value;
    const one = key => u.searchParams.getAll(key).length === 1 ? u.searchParams.get(key) : null;
    const course = path.match(/^\/course\/([^/]+)$/);
    const event = path.match(/^\/event\/([^/]+)$/);
    try {
        if (course) { type = 'course'; value = decodeURIComponent(course[1]); field = UUID.test(value) ? 'id' : 'slug'; }
        else if (event) { type = 'event'; field = 'slug'; value = decodeURIComponent(event[1]); }
        else if (path === '/course_info') { type = 'course'; field = 'id'; value = one('course'); }
        else if (path === '/course-demo') { type = 'course'; value = one('slug') || one('id'); field = UUID.test(value) ? 'id' : 'slug'; }
        else if (path === '/events') { type = 'event'; field = 'id'; value = one('event'); }
        else if (path === '/club') { type = 'club'; field = 'id'; value = one('club'); }
        else if (path === '/streams') { type = 'stream'; field = 'id'; value = one('stream'); }
        else if (path === '/profile_page' || path === '/profile-demo') { type = 'profile'; field = 'id'; value = one('user'); }
    } catch { return null; }
    if (!value || !(field === 'id' ? UUID : SLUG).test(value)) return null;
    if (field === 'id') value = value.toLowerCase();
    return { type, field, value, key: `${type}:${field}:${value}` };
}
export function firstInternalChatLink(text) {
    for (const part of messageLinks(text)) {
        if (!part.href) continue;
        const target = internalChatLink(part.href);
        if (target) return target;
    }
    return null;
}
export function publicObjectHref(type, id) {
    const value = encodeURIComponent(id);
    const paths = { course: `/course/${value}`, event: `/events?event=${value}`, club: `/club?club=${value}`, stream: `/streams?stream=${value}`, profile: `/profile_page?user=${value}` };
    return paths[type] ? `https://app.meetgu.ru${paths[type]}` : null;
}
