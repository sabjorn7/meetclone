// Turn plain-text URLs into clickable links WITHOUT ever trusting user input as HTML.
//
// Security model — the ORDER is load-bearing, do not reorder:
//   1. escapeHtml() neutralises every HTML metacharacter first, so the remaining
//      string contains no raw < > " ' & — it cannot form or break out of a tag.
//   2. Only THEN do we wrap URL substrings in <a>. Because the escaped URL text has
//      no raw quote/angle-bracket, it can neither terminate the href="" attribute nor
//      open a new tag, so the HTML handed to v-html is always safe.
// Never widen the escape set and never linkify before escaping.

const ENT = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export function escapeHtml(input) {
    return String(input == null ? '' : input).replace(/[&<>"']/g, (c) => ENT[c]);
}

// Matches http(s):// or www. URLs. Runs on ALREADY-ESCAPED text, so mid-URL it can
// only ever see inert entities (&amp; etc.), never raw HTML.
const URL_RE = /\b(?:https?:\/\/|www\.)[^\s]+/gi;
// Trailing chars that are usually punctuation, not part of the URL (incl. escaped quotes).
const TRAIL_RE = /(?:[.,;:!?)\]}]|&quot;|&#39;|&gt;|&lt;)+$/;

export function linkifyText(input) {
    const escaped = escapeHtml(input);
    return escaped.replace(URL_RE, (match) => {
        let url = match, trail = '';
        const t = url.match(TRAIL_RE);
        if (t) { trail = t[0]; url = url.slice(0, -trail.length); }
        if (!url) return match;
        const href = /^www\./i.test(url) ? 'https://' + url : url;
        return `<a href="${href}" target="_blank" rel="noopener noreferrer">${url}</a>${trail}`;
    });
}
