// Return plain text/link tokens; never interpret message text as HTML.
export function messageLinks(value) {
    const text = typeof value === 'string' ? value : '';
    const parts = [];
    const pattern = /(?:https?:\/\/|www\.)[^\s<>"'`«»“”]+/giu;
    let cursor = 0;
    for (const match of text.matchAll(pattern)) {
        const start = match.index;
        // Do not link inside another scheme, address or word.
        if (start && /[\p{L}\p{N}_@:/.-]/u.test(text[start - 1])) continue;
        let label = match[0];
        for (;;) {
            const before = label;
            label = label.replace(/[.,!?;:…]+$/u, '');
            for (const [open, close] of [['(', ')'], ['[', ']'], ['{', '}']]) {
                while (label.endsWith(close) && label.split(close).length > label.split(open).length) label = label.slice(0, -1);
            }
            if (label === before) break;
        }
        let url;
        try { url = new URL(/^www\./i.test(label) ? 'https://' + label : label); } catch { continue; }
        if (!['http:', 'https:'].includes(url.protocol) || !url.hostname || url.username || url.password) continue;
        if (start > cursor) parts.push({ text: text.slice(cursor, start) });
        parts.push({ text: label, href: url.href });
        cursor = start + label.length;
    }
    if (cursor < text.length) parts.push({ text: text.slice(cursor) });
    return parts;
}
