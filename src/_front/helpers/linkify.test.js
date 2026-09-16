import { describe, it, expect } from 'vitest';
import { escapeHtml, linkifyText } from './linkify.js';

describe('escapeHtml', () => {
    it('escapes all HTML metacharacters', () => {
        expect(escapeHtml(`<b>"&'</b>`)).toBe('&lt;b&gt;&quot;&amp;&#39;&lt;/b&gt;');
    });
    it('handles null/undefined', () => {
        expect(escapeHtml(null)).toBe('');
        expect(escapeHtml(undefined)).toBe('');
    });
});

describe('linkifyText — safety', () => {
    it('never emits a raw script/img tag from user input', () => {
        const out = linkifyText('<script>alert(1)</script><img src=x onerror=alert(1)>');
        expect(out).not.toMatch(/<script/i);
        expect(out).not.toMatch(/<img/i);
        expect(out).toContain('&lt;script&gt;');
    });
    it('cannot break out of the href attribute', () => {
        const out = linkifyText('http://x.com/"><script>alert(1)</script>');
        // the ONLY tags in the output must be our own <a>…</a>
        (out.match(/<[^>]+>/g) || []).forEach((t) => expect(t).toMatch(/^<\/?a(\s|>)/));
        expect(out).not.toContain('"><script');
    });
});

describe('linkifyText — behaviour', () => {
    it('linkifies https URLs', () => {
        expect(linkifyText('см. https://meetgu.ru/x')).toContain(
            '<a href="https://meetgu.ru/x" target="_blank" rel="noopener noreferrer">https://meetgu.ru/x</a>'
        );
    });
    it('prefixes bare www. with https://', () => {
        expect(linkifyText('www.meetgu.ru')).toContain('href="https://www.meetgu.ru"');
    });
    it('keeps trailing sentence punctuation out of the link', () => {
        expect(linkifyText('сайт: https://meetgu.ru.')).toContain('>https://meetgu.ru</a>.');
    });
    it('preserves & in query strings as an entity in href', () => {
        expect(linkifyText('https://x.com/a?b=1&c=2')).toContain('href="https://x.com/a?b=1&amp;c=2"');
    });
    it('leaves plain text and newlines untouched', () => {
        expect(linkifyText('line1\nline2')).toBe('line1\nline2');
    });
});
