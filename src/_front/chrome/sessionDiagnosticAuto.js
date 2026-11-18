import { createDiagnosticTransport } from './sessionDiagnosticTransport.js';
// Delivery policy for the existing recorder, not a second event recorder.
// Wire v1: stage-label-event-point-span-start-ms-outcome-status-loading.
export const STAGE_CODES = ['route-transition','page-unload','auth','auth-init','http','body','page-load','page-await','processing','api-queue','api-call','existing-error','context'];
export const LABEL_CODES = ['', 'HomePage','AllCoursesPage','CoursePage','MyCoursePage','ClubsPage','ArticlesPage','UsersPage','ProfilePage','ProfileEditPage','ArticlePage','EventsPage','getSession','getUser','refreshSession','setSession','signOut','signInWithPassword','signUp','verifyOtp','exchangeCodeForSession','home','all_course','course','my_courses','clubs','articles','article','users','profile','profile_page','events','streams','faq','login','registration','other','rest','auth','api'];
const EVENTS = ['begin','end','loading-false','window_error','resource_error','pending','unhandled_rejection'];
const OUTCOMES = ['', 'ok','error','cancelled','superseded'];
const integer = (value, max) => Number.isFinite(value) ? Math.max(0, Math.min(max, Math.floor(value))) : 0;
export function encodeSnapshot(snapshot, release, reason) {
    if (!/^[0-9a-f]{7,40}$/.test(release) || !Number.isInteger(reason) || reason < 1 || reason > 7) return null;
    const all = [...snapshot.events.slice(-44), ...snapshot.pending.map(e => ({...e,event:'pending'}))];
    const rows = all.slice(-44).map(e => [
        Math.max(1, STAGE_CODES.indexOf(e.stage)+1), Math.max(0,LABEL_CODES.indexOf(e.label)),
        Math.max(0,EVENTS.indexOf(e.event)), integer(e.point,99), Number.isInteger(e.id) && e.id>0 ? ((e.id-1)%9999)+1 : 0,
        integer(e.at ?? e.start,9999999), integer(e.ms,9999999), Math.max(0,OUTCOMES.indexOf(e.outcome)),
        Number.isInteger(e.status) && e.status>=100 && e.status<=599 ? e.status : 0,
        e.loading===true ? 2 : e.loading===false ? 1 : 0,
    ].join('-'));
    if (!rows.length) rows.push('13-0-0-0-0-0-0-0-0-0');
    let truncated = all.length > rows.length;
    const build = () => `1.${release}.${reason}.${truncated?1:0}.${integer(snapshot.dropped,99999)}.${rows.join('_')}`;
    while (build().length > 1100 && rows.length > 1) { rows.shift(); truncated=true; }
    return build();
}
export function createAutomaticDiagnostic({ recorder, fetch, release, now=()=>Date.now(), hiddenMs=()=>0,
    visible=()=>true, online=()=>true, random=Math.random, schedule=setTimeout, cancel=clearTimeout, transport }) {
    const shared = transport || createDiagnosticTransport({fetch,release,now,visible,online,random,schedule,cancel});
    let timer=null, last=now(), hidden=hiddenMs(), awake=0;
    const age=new Map();
    shared.onStop(()=>{age.clear();recorder.clear();if(timer!==null)cancel(timer);timer=null;});
    const recording=()=>!shared.state().stopped;
    const stop=()=>shared.stop();
    async function trigger(reason) {
        const snapshot=recorder.snapshot();
        await shared.send(reason,encodeSnapshot(snapshot,release,reason),`${snapshot.navigation}:${reason}`);
    }
    function tick() {
        timer=null;
        const state=shared.state();
        if(state.stopped || !state.selected)return;
        const config=state.config;
        const current=now(), h=hiddenMs(), delta=current-last;
        const suspended=!visible() || h!==hidden || delta<0 || delta>3000;
        last=current;hidden=h;
        if(suspended){awake=0;age.clear();}
        else awake+=delta;
        if(!suspended && awake>=3000){
            const snapshot=recorder.snapshot(), live=new Set();
            const pageReady=snapshot.pageReady===true;
            for(const e of snapshot.pending){
                if(e.navigation!==snapshot.navigation)continue;
                const kind=['auth','auth-init'].includes(e.stage)?'auth':['http','body'].includes(e.stage)?'http':['route-transition','page-unload'].includes(e.stage)?'route':e.stage==='page-load'?'page':null;
                // Ignore optional background HTTP/Auth work once the primary page is ready.
                if(!kind || (['http','auth'].includes(kind) && pageReady) || (kind==='page' && e.loading!==true))continue;
                live.add(e.id);age.set(e.id,(age.get(e.id)||0)+delta);
                if(age.get(e.id)>=config.thresholdMs[kind])void trigger({auth:3,http:4,page:5,route:6}[kind]);
            }
            for(const id of age.keys())if(!live.has(id))age.delete(id);
        }
        // Expired permission fails closed. Refresh only for selected foreground documents.
        if(now()-state.lastConfig>=60000 && visible() && !state.busy)void shared.refresh();
        if(!shared.state().stopped)timer=schedule(tick,1000);
    }
    return {
        recording,
        async start(){if(await shared.start() && !shared.state().stopped){last=now();hidden=hiddenMs();timer=schedule(tick,1000);
            const early=recorder.snapshot().events.find(e=>e.stage==='existing-error');
            if(early)void trigger(early.event==='resource_error'?2:1);}},
        error(type){ if(['window_error','vue_error','unhandled_rejection'].includes(type))void trigger(1);else if(type==='resource_error')void trigger(2); },
        stop,
        state:()=>({...shared.state(),pendingAges:age.size}),
    };
}
