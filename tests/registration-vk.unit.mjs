import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';
import { isRegistrationEmail, suggestRegistrationEmail, confirmationRedirect, confirmationSession } from '../src/_front/auth/registration.js';
import { readVkResponse } from '../src/_front/auth/vkResponse.js';
import { patchVkAuth } from '../scripts/lib/vk-auth-workflow-patch.mjs';

const before = JSON.parse(fs.readFileSync(new URL('../reviews/2026-11-13-registration-vk/vk-auth.before.review.json', import.meta.url)));
const candidate = patchVkAuth(before);
const uuid = '11111111-1111-4111-8111-111111111111';
const other = '22222222-2222-4222-8222-222222222222';

test('email: normal, explicit typos, unknown domains and invalid format', () => {
    for (const email of ['user@mail.ru', 'user+course@gmail.com', 'user@unknown-company.education']) {
        assert.equal(isRegistrationEmail(email), true);
        assert.equal(suggestRegistrationEmail(email), null);
    }
    for (const [from, to] of [['user@mail.ruy','user@mail.ru'], ['User@GMAIL.CON','User@gmail.com'], ['user@gmial.com','user@gmail.com'], ['user@yandex.ry','user@yandex.ru']]) {
        assert.equal(suggestRegistrationEmail(from), to);
        assert.equal(isRegistrationEmail(from), true); // A suggestion must not block submission.
    }
    for (const email of ['', 'name', 'a@@mail.ru', 'a b@mail.ru', '@mail.ru', 'a@']) assert.equal(isRegistrationEmail(email), false);
});

test('confirmation callback: wait for session, reject missing session and expired link', async () => {
    assert.equal(confirmationRedirect('https://app.meetgu.ru'), 'https://app.meetgu.ru/login?email_confirmation=1');
    let initialized = false;
    const session = { user: { id: uuid } };
    assert.equal(await confirmationSession({ getSession: async () => { await Promise.resolve(); initialized=true; return {data:{session}}; } }), session);
    assert(initialized);
    await assert.rejects(confirmationSession({getSession:async()=>({data:{session:null}})}), /missing/);
    await assert.rejects(confirmationSession(null), /not ready/);
    let called = false;
    await assert.rejects(confirmationSession({getSession:()=>{called=true;}}, '#error=access_denied&error_code=otp_expired'), /failed/);
    assert.equal(called,false);
});

test('VK response: HTTP failure, HTML, missing credentials and error do not reach verifyOTP', async () => {
    const good={email:'vk42@vk.meetgu.ru',otp:'123456'};
    assert.deepEqual(await readVkResponse({ok:true,json:async()=>good}),good);
    assert.deepEqual(await readVkResponse({ok:true,json:async()=>({...good,error:'null'})}),good);
    for (const response of [{ok:false}, {ok:true,json:async()=>{throw Error('HTML');}}, ...[null,{},[],{email:'x'}, {...good,error:'failure'}, {...good,otp:123456}, {...good,email:'broken'}, {...good,otp:'wrong'}].map(value=>({ok:true,json:async()=>value}))]) {
        let verified=false;
        await assert.rejects((async()=>{await readVkResponse(response);verified=true;})());
        assert.equal(verified,false);
    }
});

// Run the actual candidate nodes and expressions against in-memory GoTrue/public.users/Storage.
// No production requests, credentials, real OTPs, purchases or n8n execution API.
function runWorkflow(options={}) {
    const email=options.noEmail?'vk42@vk.meetgu.ru':'learner@example.test';
    const publicRows=structuredClone(options.rows||[]);
    const authRows=structuredClone(options.authRows||publicRows.map(r=>({id:r.id,email:r.email})));
    const purchases=structuredClone(options.purchases||[{owner:uuid,course:'paid-course',expires:'2030-01-01'}]);
    const snapshot=JSON.stringify(purchases),calls=[],outputs=new Map();
    const nodes=new Map(candidate.nodes.map(n=>[n.name,n]));
    let input=[{json:{}}],name='Webhook1',result;
    const execute=(source,current)=>vm.runInNewContext(source,{
        $json:current?.[0]?.json||{},
        $input:{first:()=>current[0],all:()=>current},
        $:n=>({item:outputs.get(n)?.[0],first:()=>outputs.get(n)?.[0],all:()=>outputs.get(n)||[]}),
    },{timeout:1000});
    const value=(source,current)=>{
        if(typeof source!=='string'||!source.startsWith('='))return source;
        if(source.startsWith('={{')&&source.endsWith('}}')&&!source.slice(3,-2).includes('}}'))return execute('('+source.slice(3,-2)+')',current);
        if(!source.startsWith('={\n'))return source.slice(1).replace(/{{([\s\S]*?)}}/g,(_m,expr)=>String(execute('('+expr+')',current)));
        const substituted=source.slice(1).replace(/{{([\s\S]*?)}}/g,(_m,expr)=>JSON.stringify(execute('('+expr+')',current)).slice(1,-1));
        return JSON.parse(substituted);
    };
    try {
        for(let count=0;name&&count<60;count++) {
            const n=nodes.get(name);assert(n,'unknown node '+name);calls.push(name);let output,branch=0;
            try {
                if(n.type.endsWith('.webhook'))output=[{json:{body:{authCode:'synthetic',DeviceId:'synthetic',codeVerifier:'synthetic'}}}];
                else if(name==='VK Get Access Token')output=[{json:{user_id:42}}];
                else if(name==='HTTP Request1')output=[{json:{user:{user_id:options.wrongSubject?99:42,...(!options.noEmail?{email}:{}),...(options.claimedVerified?{email_verified:true,verified:true}:{}),first_name:'VK',last_name:'User',avatar:options.avatarMissing?'':'https://avatar.example.test/image.jpg'}}}];
                else if(n.type.endsWith('.code'))output=execute('(function(){'+n.parameters.jsCode+'})()',input);
                else if(n.type.endsWith('.if')){branch=input[0]?.json.id?0:1;output=input;}
                else if(n.type.endsWith('.supabase')) {
                    const p=n.parameters;assert.equal(p.tableId,'users');
                    const filters=p.filters.conditions.map(f=>({name:f.keyName,value:value(f.keyValue,input)}));
                    if(filters.some(f=>f.value===undefined||f.value===null||f.value===''))throw Error('Unsafe empty filter');
                    if(name==='Update a row1'&&options.changeLinkAfterGuard)publicRows[0].vk_id='99';
                    const found=name==='Check Public.users.vk.id'&&options.initialVkMiss?[]:publicRows.filter(r=>filters.every(f=>String(r[f.name])===String(f.value)));
                    if(p.operation==='get')output=found.map(json=>({json:{...json}}));
                    else {
                        assert.equal(p.operation,'update');assert.equal(filters[0].name,'id');
                        if(n.name.startsWith('Save ')&&options.photoWriteError)throw Error('Avatar write failed');
                        for(const r of found)for(const f of p.fieldsUi.fieldValues)r[f.fieldId]=value(f.fieldValue,input);
                        output=found.map(json=>({json:{...json}}));
                    }
                }
                else if(name==='HTTP Request') {
                    const body=value(n.parameters.jsonBody,input);
                    if(options.createError)throw options.createError;
                    if(authRows.some(r=>r.email===body.email))throw {status:422,code:'ERR_BAD_REQUEST',message:'422 - {"error_code":"email_exists"}'};
                    const row={id:other,email:body.email};authRows.push({...row});publicRows.push({...row,role:null,vk_id:null});output=[{json:{...row}}];
                }
                else if(['HTTP Request4','HTTP Request5'].includes(name)) {
                    if(options.avatar404||options.avatarMissing)throw Error('404 avatar');output=[{json:{},binary:{data:'synthetic'}}];
                }
                else if(['HTTP Request6','HTTP Request7'].includes(name)) {
                    if(options.uploadError)throw Error('Storage unavailable');output=[{json:options.uploadWithoutKey?{}:{Key:'profile/synthetic.jpg'}}];
                }
                else if(['HTTP Request2','HTTP Request3','HTTP Request8'].includes(name)) {
                    const body=value(n.parameters.jsonBody,input);const target=authRows.find(r=>r.email===body.email);
                    if(!target)throw Error('OTP target missing');output=[{json:{id:target.id,email:target.email,email_otp:'123456'}}];
                }
                else if(n.type.endsWith('.set'))output=[{json:Object.fromEntries(n.parameters.assignments.assignments.map(a=>[a.name,value(a.value,input)]))}];
                else throw Error('Unexpected mock node '+name);
                if(!output.length&&n.alwaysOutputData)output=[{json:{}}];
            } catch(error) {
                if(n.onError==='continueErrorOutput'){branch=1;output=[{json:{error:typeof error==='object'?{status:error.status,code:error.code,message:error.message}:{message:String(error)}}}];}
                else if(n.onError==='continueRegularOutput')output=[{json:{error:'optional failure'}}];
                else throw error;
            }
            outputs.set(name,output);result=output?.[0]?.json;
            const targets=candidate.connections[name]?.main?.[branch]||[];
            assert(targets.length<=1,'test graph must have one next node');
            name=output.length?targets[0]?.node:undefined;input=output;
        }
        assert(!name,'workflow cycle');
        assert.equal(JSON.stringify(purchases),snapshot);
        return {result:structuredClone(result),publicRows,authRows,purchases,calls};
    } catch(error) {error.workflowCalls=calls;error.workflowState={publicRows,authRows,purchases};throw error;}
}

test('new VK registration: linked UUID and OTP with healthy avatar',()=>{
    const r=runWorkflow();assert.equal(r.result.email,'learner@example.test');assert.equal(r.result.otp,'123456');
    assert.equal(r.publicRows[0].id,other);assert.equal(r.publicRows[0].vk_id,'42');assert.equal(r.publicRows[0].role,'Ученик');
    assert.equal(r.publicRows[0].Photo,'https://sb.meetgu.ru/storage/v1/object/public/profile/synthetic.jpg');
    assert(r.calls.indexOf('Update a row')<r.calls.indexOf('HTTP Request4'));
});

for(const failure of ['avatar404','avatarMissing','uploadError','uploadWithoutKey','photoWriteError'])test('optional avatar: '+failure+' does not prevent OTP',()=>{
    const r=runWorkflow({[failure]:true});assert.equal(r.result.otp,'123456');assert.equal(r.publicRows[0].vk_id,'42');assert.equal(r.publicRows[0].Photo,undefined);
});

test('missing VK email: consistent fallback and repeated login keeps UUID',()=>{
    const first=runWorkflow({noEmail:true,avatar404:true});assert.equal(first.result.email,'vk42@vk.meetgu.ru');
    const again=runWorkflow({noEmail:true,rows:first.publicRows,authRows:first.authRows});
    assert.equal(again.publicRows[0].id,first.publicRows[0].id);assert.equal(again.publicRows.length,1);assert.equal(again.authRows.length,1);
    assert(!again.calls.includes('HTTP Request'));assert.equal(again.result.otp,'123456');
});

test('linked purchased account: stored email wins when VK email is absent/changed; no profile writes',()=>{
    const row={id:uuid,email:'original@example.test',vk_id:'42',role:'Спикер',Name:'Existing',Photo:'existing.jpg'};
    for(const noEmail of [true,false]){
        const r=runWorkflow({noEmail,rows:[row]});assert.deepEqual(r.publicRows,[row]);assert.equal(r.result.email,row.email);
        assert.deepEqual(r.purchases,[{owner:uuid,course:'paid-course',expires:'2030-01-01'}]);assert(!r.calls.includes('HTTP Request1'));
    }
});

for(const noEmail of [false,true])test('email collision with unlinked account refuses OTP and preserves purchases; noEmail='+noEmail,()=>{
    const row={id:uuid,email:noEmail?'vk42@vk.meetgu.ru':'learner@example.test',vk_id:null,role:'Спикер',Name:'Original',Photo:'existing.jpg'};
    assert.throws(()=>runWorkflow({noEmail,rows:[row],avatar404:true}),e=>{
        assert.equal(e.code,'VK_ACCOUNT_LINK_REQUIRED');assert.deepEqual(e.workflowState.publicRows,[row]);
        assert.equal(e.workflowState.authRows.length,1);assert.equal(e.workflowState.purchases[0].owner,uuid);
        for(const name of ['Update a row1','HTTP Request8','HTTP Request5'])assert(!e.workflowCalls.includes(name));return true;
    });
});

test('conflicting vk_id and mismatched VK subject fail closed',()=>{
    assert.throws(()=>runWorkflow({rows:[{id:uuid,email:'learner@example.test',vk_id:'99'}]}),/does not match/);
    assert.throws(()=>runWorkflow({wrongSubject:true}),/identity mismatch/);
});

test('healthy avatar on retry preserves purchased UUID, role and name',()=>{
    const row={id:uuid,email:'learner@example.test',vk_id:'42',role:'Спикер',Name:'Original',Photo:'old.jpg'};
    const r=runWorkflow({rows:[row],initialVkMiss:true});assert.equal(r.publicRows[0].id,uuid);assert.equal(r.publicRows[0].role,'Спикер');
    assert.equal(r.publicRows[0].Name,'Original');assert.equal(r.publicRows[0].vk_id,'42');assert.equal(r.purchases[0].owner,uuid);
});

test('claimed VK email_verified/verified never authorizes a new link',()=>{
    const row={id:uuid,email:'learner@example.test',vk_id:null,role:'Спикер'};
    assert.throws(()=>runWorkflow({rows:[row],claimedVerified:true}),e=>e.code==='VK_ACCOUNT_LINK_REQUIRED'&&!e.workflowCalls.includes('HTTP Request8'));
});

test('a vk_id changed after validation cannot be overwritten or issue OTP',()=>{
    const row={id:uuid,email:'learner@example.test',vk_id:'42',role:'Спикер'};
    const r=runWorkflow({rows:[row],initialVkMiss:true,changeLinkAfterGuard:true});
    assert.equal(r.publicRows[0].vk_id,'99');assert.equal(r.publicRows[0].id,uuid);assert(!r.calls.includes('HTTP Request8'));
});

test('ambiguous public email match is rejected instead of linking multiple UUIDs',()=>{
    assert.throws(()=>runWorkflow({rows:[{id:uuid,email:'learner@example.test',vk_id:null},{id:other,email:'learner@example.test',vk_id:null}]}),/ambiguous/);
});

test('unrelated create errors never trigger email lookup/linking',()=>{
    for(const createError of [{status:500,message:'Internal server error'},{status:403,message:'Forbidden'},{status:422,message:'Invalid email'}]) {
        try{runWorkflow({createError});assert.fail('expected failure');}catch(e){assert(!e.workflowCalls.includes('Find existing VK email'));}
    }
});

test('patch scope: no purchases/access nodes, no mutations of source, stable credential fields and existing vk_id branch',()=>{
    assert.equal(before.nodes.length,22);assert.equal(candidate.nodes.length,27);
    assert.deepEqual(candidate.connections.If,before.connections.If);
    for(const n of before.nodes){const after=candidate.nodes.find(a=>a.id===n.id);assert(after);assert.deepEqual(after.credentials,n.credentials);
        for(const key of ['jsonHeaders','headerParameters'])assert.deepEqual(after.parameters[key],n.parameters[key]);}
    assert.deepEqual(candidate.nodes.find(n=>n.name==='HTTP Request3'),before.nodes.find(n=>n.name==='HTTP Request3'));
    for(const n of candidate.nodes.filter(n=>n.type.endsWith('.supabase')))assert.equal(n.parameters.tableId,'users');
    assert.throws(()=>patchVkAuth({...before,updatedAt:'changed'}),/changed/);
    const review=JSON.parse(fs.readFileSync(new URL('../reviews/2026-11-13-registration-vk/vk-auth.after.review.json',import.meta.url)));
    assert.deepEqual(candidate,review);
});
