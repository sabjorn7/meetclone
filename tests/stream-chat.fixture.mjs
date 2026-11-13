import fs from 'node:fs';
import { parse } from 'acorn';
import { createClient } from '@supabase/supabase-js';

export const streamId = 'd86a0c44-247f-4c24-954e-7fa7987df82f';
export function messages(count) {
    return Array.from({ length: count }, (_, i) => ({
        id: `00000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`,
        // Ties span entire page boundaries. Preserve sub-millisecond precision.
        created_at: `2026-11-12T19:00:00.${String(Math.floor(i / 245)).padStart(6, '0')}+00:00`,
        stream: streamId, owner: 'owner', text: `Сообщение ${i + 1}`, deleted: false,
    }));
}

export function mockDatabase(initial, { cap = Infinity } = {}) {
    const state = { rows: initial, calls: [], fail: false, failOn: 0, failSend: false, hold: null, active: 0, maxActive: 0 };
    const fetch = async input => {
        const url = new URL(typeof input === 'string' ? input : input.url);
        const q = url.searchParams;
        state.calls.push(Object.fromEntries(q));
        state.active++; state.maxActive = Math.max(state.maxActive, state.active);
        try {
            if (state.hold) await state.hold;
            if (state.fail || state.calls.length === state.failOn) return new Response(JSON.stringify({ message: 'fixture offline' }), { status: 503 });
            if (url.pathname.endsWith('/users')) return new Response('[]', { status: 200 });
            let rows = state.rows.filter(row => row.stream === q.get('stream')?.slice(3) && row.deleted === false);
            const cursor = q.get('or');
            if (cursor) {
                const match = /^\(created_at\.(lt|gt)\.(.*),and\(created_at\.eq\.(.*),id\.(lt|gt)\.(.*)\)\)$/.exec(cursor);
                if (!match || match[2] !== match[3] || match[1] !== match[4]) throw Error('Unexpected cursor: ' + cursor);
                const ascending = match[1] === 'gt';
                rows = rows.filter(row => ascending
                    ? row.created_at > match[2] || (row.created_at === match[2] && row.id > match[5])
                    : row.created_at < match[2] || (row.created_at === match[2] && row.id < match[5]));
            }
            const order = q.get('order');
            if (!['created_at.desc,id.desc', 'created_at.asc,id.asc'].includes(order)) throw Error('Expected stable order');
            const direction = order.includes('.asc') ? 1 : -1;
            rows.sort((a, b) => direction * (a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id)));
            return new Response(JSON.stringify(rows.slice(0, Math.min(Number(q.get('limit')), cap))), { status: 200 });
        } finally { state.active--; }
    };
    const client = createClient('https://fixture.invalid', 'fixture-public-key', {
        global: { fetch }, auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    return { state, client };
}

export function functionsFrom(file, names) {
    const source = fs.readFileSync(file, 'utf8');
    const script = file.endsWith('.vue') ? source.match(/<script setup>([\s\S]*?)<\/script>/)[1] : source;
    const ast = parse(script, { ecmaVersion: 'latest', sourceType: 'module' });
    return ast.body.flatMap(node => {
        const f = node.type === 'ExportNamedDeclaration' ? node.declaration : node;
        return f?.type === 'FunctionDeclaration' && names.includes(f.id.name) ? [script.slice(f.start, f.end)] : [];
    }).join('\n');
}
