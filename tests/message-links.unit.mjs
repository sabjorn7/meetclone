import assert from 'node:assert/strict';
import { messageLinks } from '../src/_front/helpers/messageLinks.js';
const cases=[
 ['Привет  всем!\nСледующая строка',[]],
 ['https://example.com',['https://example.com/']],
 ['http://example.com/a и www.example.org.', ['http://example.com/a','https://www.example.org/']],
 ['Ссылка: https://example.com/?q=1&x=2!', ['https://example.com/?q=1&x=2']],
 ['(https://example.com/test).', ['https://example.com/test']],
 ['https://example.com/a_(b)).', ['https://example.com/a_(b)']],
 ['https://example.com/a,\n  www.example.org?x=1&y=2;', ['https://example.com/a','https://www.example.org/?x=1&y=2']],
 ['javascript:alert(1) data:text/html,<script>alert(1)</script>',[]],
 ['javascript:https://example.com data:https://example.com',[]],
 ['<img src=x onerror=alert(1)> «https://example.com»', ['https://example.com/']],
 ['https://user:password@example.com www. http://',[]],
 ['https://пример.рф/путь', ['https://xn--e1afmkfd.xn--p1ai/%D0%BF%D1%83%D1%82%D1%8C']],
];
for(const [text,hrefs] of cases){const p=messageLinks(text);assert.equal(p.map(x=>x.text).join(''),text);assert.deepEqual(p.filter(x=>x.href).map(x=>x.href),hrefs)}
console.log(JSON.stringify({pass:cases.length}));
