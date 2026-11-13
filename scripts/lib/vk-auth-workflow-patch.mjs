// Pure transformation: no network, database, n8n API or credential changes.
export function vkIdentity(token, profile) {
    const vkId = String(token?.user_id || '');
    const user = profile?.user;
    if (!/^\d+$/.test(vkId) || String(user?.user_id || '') !== vkId) throw new Error('VK identity mismatch');
    const supplied = typeof user.email === 'string' ? user.email.trim().toLowerCase() : '';
    if (supplied && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(supplied)) throw new Error('Invalid VK email');
    return { vkId, email: supplied || `vk${vkId}@vk.meetgu.ru` };
}

export function requireEmailConflict(error) {
    const status = Number(error?.status || error?.httpCode || error?.statusCode);
    const detail = `${error?.code || ''} ${error?.message || ''}`;
    if (![400, 409, 422].includes(status) || !/\b(email_exists|user_already_exists)\b/.test(detail)) {
        throw new Error('VK account creation failed; not an email conflict');
    }
}

export function existingVkAccount(rows, identity) {
    if (rows.length !== 1) throw new Error('Existing VK account is missing or ambiguous');
    const row = rows[0];
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(row.id || '')
        || typeof row.email !== 'string' || row.email.trim().toLowerCase() !== identity.email
        || (row.vk_id != null && row.vk_id !== '' && String(row.vk_id) !== identity.vkId)) {
        throw new Error('Existing account does not match VK identity');
    }
    return { id: row.id, email: row.email, vk_id: identity.vkId };
}

export function patchVkAuth(workflow) {
    if (workflow.id !== 'fmdgagExCONpVxja' || workflow.updatedAt !== '2026-10-06T12:46:05.080Z') {
        throw new Error('VK_Auth changed; review the current workflow before patching');
    }
    const w = structuredClone(workflow);
    const node = name => {
        const matches = w.nodes.filter(n => n.name === name);
        if (matches.length !== 1) throw new Error('Missing/ambiguous node: ' + name);
        return matches[0];
    };
    if (node('Webhook1').parameters.path !== 'auth_vk'
        || node('HTTP Request').parameters.url !== 'https://sb.meetgu.ru/auth/v1/admin/users'
        || node('Update a row1').parameters.tableId !== 'users'
        || w.connections['HTTP Request'].main[1][0].node !== 'HTTP Request5') {
        throw new Error('Unexpected VK baseline');
    }
    const next = name => ({ node: name, type: 'main', index: 0 });
    const edge = (...branches) => ({ main: branches.map(names => names.map(next)) });
    const identity = `$('Code').item.json`;

    // Keep the existing password generation and add a single canonical identity.
    node('Code').parameters.jsCode = vkIdentity.toString() + '\n'
        + `const identity = vkIdentity($('VK Get Access Token').item.json, $('HTTP Request1').item.json);\n`
        + `const password = Array(10).fill(0).map(() => Math.floor(Math.random()*16).toString(16)).join('');\n`
        + `return [{json:{...identity,password},pairedItem:{item:0}}];`;
    node('HTTP Request').parameters.jsonBody = `={{ {email:${identity}.email,password:${identity}.password} }}`;

    // Link the newly created UUID before optional avatar I/O. No Photo write here.
    const initial = node('Update a row');
    initial.parameters.fieldsUi.fieldValues = initial.parameters.fieldsUi.fieldValues
        .filter(f => f.fieldId !== 'Photo').map(f => f.fieldId === 'vk_id' ? { ...f, fieldValue: `={{ ${identity}.vkId }}` } : f);
    w.connections['HTTP Request'] = edge(['Update a row'], ['Require email conflict']);
    w.connections['Update a row'] = edge(['HTTP Request4']);

    const conflict = {
        id: 'vk-require-email-conflict', name: 'Require email conflict', type: 'n8n-nodes-base.code', typeVersion: 2,
        position: [1040, 640], parameters: { jsCode: requireEmailConflict.toString()
            + '\nrequireEmailConflict($input.first().json.error);\nreturn [{json:{},pairedItem:{item:0}}];' },
    };
    const lookup = structuredClone(node('Check Public.users.vk.id'));
    Object.assign(lookup, { id: 'vk-find-existing-email', name: 'Find existing VK email', position: [1260, 640], alwaysOutputData: true });
    lookup.parameters.filters = { conditions: [{ keyName: 'email', condition: 'eq', keyValue: `={{ ${identity}.email }}` }] };
    const guard = {
        id: 'vk-validate-existing-account', name: 'Validate existing VK account', type: 'n8n-nodes-base.code', typeVersion: 2,
        position: [1480, 640], parameters: { jsCode: existingVkAccount.toString()
            + `\nconst account=existingVkAccount($input.all().map(i=>i.json), ${identity});\nreturn [{json:account,pairedItem:{item:0}}];` },
    };
    w.nodes.push(conflict, lookup, guard);
    w.connections[conflict.name] = edge([lookup.name]);
    w.connections[lookup.name] = edge([guard.name]);
    w.connections[guard.name] = edge(['Update a row1']);
    const retry = node('Update a row1');
    retry.parameters.filters = { conditions: [{ keyName: 'id', condition: 'eq', keyValue: "={{ $('Validate existing VK account').item.json.id }}" }] };
    // A retry must not overwrite the existing role, name, photo, email or UUID.
    retry.parameters.fieldsUi.fieldValues = [{ fieldId: 'vk_id', fieldValue: `={{ ${identity}.vkId }}` }];
    w.connections['Update a row1'] = edge(['HTTP Request5']);

    for (const [download, upload, initialUpdate, saveName, otp] of [
        ['HTTP Request4', 'HTTP Request6', 'Update a row', 'Save new VK avatar', 'HTTP Request2'],
        ['HTTP Request5', 'HTTP Request7', 'Update a row1', 'Save existing VK avatar', 'HTTP Request8'],
    ]) {
        for (const name of [download, upload]) {
            const n = node(name);
            n.onError = 'continueErrorOutput';
            n.parameters.options = { ...n.parameters.options, timeout: 5000 };
        }
        const save = structuredClone(node(initialUpdate));
        Object.assign(save, { id: 'vk-' + (initialUpdate === 'Update a row' ? 'new' : 'existing') + '-avatar', name: saveName,
            position: [node(upload).position[0] + 200, node(upload).position[1]], onError: 'continueRegularOutput' });
        save.parameters.fieldsUi.fieldValues = [{ fieldId: 'Photo', fieldValue:
            `={{ (() => { const key=$json.Key; if(typeof key!=='string'||!key.startsWith('profile/')) throw new Error('Avatar upload returned no key'); return 'https://sb.meetgu.ru/storage/v1/object/public/'+key; })() }}` }];
        w.nodes.push(save);
        w.connections[download] = edge([upload], [otp]);
        w.connections[upload] = edge([saveName], [otp]);
        w.connections[saveName] = edge([otp]);
        node(otp).parameters.jsonBody = `={{ {type:'recovery',email:${identity}.email,redirect_to:'https://app.meetgu.ru/reset_pw'} }}`;
    }
    // Keep the established vk_id branch and its stored email unchanged.
    // Return the canonical email from GoTrue, without relying on identities[0].
    for (const name of ['Edit Fields', 'Edit Fields1', 'Edit Fields2']) {
        node(name).parameters.assignments.assignments.find(a => a.name === 'email').value = '={{ $json.email }}';
    }
    return w;
}
