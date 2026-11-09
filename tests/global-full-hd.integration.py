#!/usr/bin/env python3
"""Standalone PG15/PostgREST loopback test. Synthetic data; never loads app env."""
import pathlib,tempfile,os,socket,subprocess,json,time,base64,hmac,hashlib,secrets,urllib.request,urllib.error,concurrent.futures
ROOT=pathlib.Path(__file__).resolve().parents[1];PG=pathlib.Path('/opt/homebrew/opt/postgresql@15/bin');REST=pathlib.Path('/opt/homebrew/bin/postgrest')
def port():
 with socket.socket() as s:s.bind(('127.0.0.1',0));return s.getsockname()[1]
work=pathlib.Path(tempfile.mkdtemp(prefix='mg-global-fhd-pg-',dir='/private/tmp'));work.chmod(0o700)
dbport,apiport=port(),port();started=False;rest=None;results=[]
env={k:v for k,v in os.environ.items() if k in ['PATH','LANG','LC_ALL','TMPDIR']}
env.update(PGHOST='127.0.0.1',PGPORT=str(dbport),PGUSER='fixture_admin',PGDATABASE='global_fhd_fixture',PGPASSFILE=str(work/'no-pass'),PGSERVICEFILE=str(work/'no-service'),PSQLRC=str(work/'no-psqlrc'))
def cmd(args,data=None):
 r=subprocess.run([str(x) for x in args],input=data,text=True,capture_output=True,env=env)
 if r.returncode:raise RuntimeError(r.stderr[:1000])
 return r.stdout.strip()
def sql(q):return cmd([PG/'psql','-X','-v','ON_ERROR_STOP=1','-At'],q)
def denied(q):
 try:sql(q)
 except RuntimeError:return
 raise AssertionError('expected denial')
def check(name,fn):fn();results.append({'name':name,'status':'PASS'});print('PASS '+name,flush=True)
def eq(a,b):assert a==b,(a,b)
A='10000000-0000-4000-8000-000000000001';B='10000000-0000-4000-8000-000000000002'
X='20000000-0000-4000-8000-000000000011';Y='20000000-0000-4000-8000-000000000012';V='30000000-0000-4000-8000-000000000001'
secret=secrets.token_hex(40).encode()
def jwt(role='authenticated',uid=A):
 e=lambda x:base64.urlsafe_b64encode(json.dumps(x,separators=(',',':')).encode()).decode().rstrip('=')
 v=e({'alg':'HS256'})+'.'+e({'role':role,'sub':uid,'exp':int(time.time())+3600})
 return v+'.'+base64.urlsafe_b64encode(hmac.new(secret,v.encode(),hashlib.sha256).digest()).decode().rstrip('=')
def rpc(name,args,role='authenticated',uid=A):
 req=urllib.request.Request('http://127.0.0.1:'+str(apiport)+'/rpc/'+name,method='POST',data=json.dumps(args).encode(),headers={'Content-Type':'application/json','Authorization':'Bearer '+jwt(role,uid)})
 opener=urllib.request.build_opener(urllib.request.ProxyHandler({}))
 try:
  with opener.open(req,timeout=5) as r:return r.status,json.loads(r.read() or b'null')
 except urllib.error.HTTPError as r:return r.code,json.loads(r.read() or b'null')
def reserve(stream=X,owner=A,profile='full_hd'):
 return sql("set role service_role;select public.reserve_stream_video_start_scoped('%s','%s','%s',null)"%(stream,owner,profile)).splitlines()[-1]
def hold(t):sql("set role service_role;select public.hold_stream_video_start('%s')"%t)
def mark(t,stream=X,owner=A,profile='full_hd'):
 sql("set role service_role;select public.mark_stream_video_started_scoped('%s','%s','%s',null,'synthetic-egress','%s','%s')"%(stream,owner,profile,V,t))
def reset():sql("delete from public.stream_video_start_reservations;update public.streams set video_quality='hd',status='ended',livekit_egress_id=null;delete from public.stream_video_runs;update public.stream_video_quality_settings set full_hd_enabled=true")
try:
 cmd([PG/'initdb','-D',work/'cluster','-U','fixture_admin','--auth-local=trust','--auth-host=trust','--no-locale','--encoding=UTF8'])
 cmd([PG/'pg_ctl','-D',work/'cluster','-l',work/'postgres.log','-o',f'-h 127.0.0.1 -p {dbport} -k {work}','-w','start']);started=True
 cmd([PG/'createdb','global_fhd_fixture'])
 sql("""create role anon;create role authenticated;create role service_role bypassrls;create role authenticator login noinherit;grant anon,authenticated,service_role to authenticator;
 create schema auth;create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claims',true)::jsonb->>'sub','')::uuid$$;
 grant usage on schema auth to anon,authenticated,service_role;grant execute on function auth.uid() to anon,authenticated,service_role;
 create table public.users(id uuid primary key);
 create table public.streams(id uuid primary key default gen_random_uuid(),author uuid not null references public.users(id),title text not null,mode text not null default 'solo',status text not null default 'scheduled',visibility text not null default 'public',hidden boolean not null default false,price numeric not null default 0,livekit_egress_id text,peertube_video_id uuid,livekit_room text);
 alter table streams enable row level security;
 create policy fixture_read on streams for select to anon,authenticated using(visibility='public' or author=auth.uid());
 create policy fixture_insert on streams for insert to authenticated with check(author=auth.uid());
 create policy fixture_update on streams for update to authenticated using(author=auth.uid()) with check(author=auth.uid());
 grant select on streams to anon;grant select,insert,update on streams to authenticated;grant all on streams to service_role;
 insert into users values('"""+A+"'),('"+B+"');")
 for name in ['supabase/migrations/pending_stream_video_quality.sql','tests/fixtures/stream-full-hd-scoped-before.sql']:
  cmd([PG/'psql','-X','-v','ON_ERROR_STOP=1','-f',ROOT/name])
 policies=sql("select md5(string_agg(row_to_json(p)::text,',' order by policyname)) from pg_policies p where schemaname='public'")
 acl=sql("select md5(string_agg(proname||coalesce(proacl::text,''),',' order by proname)) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'")
 cmd([PG/'psql','-X','-v','ON_ERROR_STOP=1','-f',ROOT/'supabase/migrations/pending_stream_full_hd_global.sql'])
 check('migration retains exact RLS policies',lambda:eq(sql("select md5(string_agg(row_to_json(p)::text,',' order by policyname)) from pg_policies p where schemaname='public'"),policies))
 check('migration retains exact RPC EXECUTE ACLs',lambda:eq(sql("select md5(string_agg(proname||coalesce(proacl::text,''),',' order by proname)) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'"),acl))
 check('owner verification SQL passes all checks',lambda:eq('FAIL' in cmd([PG/'psql','-X','-v','ON_ERROR_STOP=1','-f',ROOT/'supabase/migrations/verify_stream_full_hd_global.sql']),False))
 check('global enabled, limit one, no personal grants',lambda:eq(sql("select full_hd_enabled::text||':'||max_full_hd_live||':'||(select count(*) from stream_full_hd_test_grants) from stream_video_quality_settings"),'true:1:0'))
 for stream,owner in [(X,A),(Y,B)]:
  sql("set role authenticated;set request.jwt.claims='"+json.dumps({'sub':owner})+"';insert into streams(id,author,title,mode,video_quality) values('%s','%s','Synthetic','multi','full_hd')"%(stream,owner))
 check('two ordinary owners create Full HD directly without grants',lambda:eq(sql("select count(*) from streams where video_quality='full_hd'"),'2'))
 check('HD remains the database default',lambda:eq(sql("insert into streams(author,title) values('%s','Default HD') returning video_quality"%A).splitlines()[0],'hd'))
 check('cannot spoof owner while creating',lambda:denied("set role authenticated;set request.jwt.claims='"+json.dumps({'sub':A})+"';insert into streams(author,title,video_quality) values('%s','Spoof','full_hd')"%B))
 check('wrong actor cannot reserve',lambda:denied("set role service_role;select reserve_stream_video_start_scoped('%s','%s','full_hd',null)"%(X,B)))
 check('browser cannot invoke server start RPC',lambda:denied("set role authenticated;select reserve_stream_video_start_scoped('%s','%s','full_hd',null)"%(X,A)))
 config=work/'postgrest.conf';config.write_text(f'db-uri = "postgres://authenticator@127.0.0.1:{dbport}/global_fhd_fixture"\ndb-schemas = "public"\ndb-anon-role = "anon"\nserver-host = "127.0.0.1"\nserver-port = {apiport}\njwt-secret = "{secret.decode()}"\nlog-level = "crit"\n');config.chmod(0o600)
 log=(work/'postgrest.log').open('w');rest=subprocess.Popen([str(REST),str(config)],stdout=log,stderr=log,env=env)
 for _ in range(100):
  try:
   if rpc('stream_video_quality_capabilities',{})[0]==200:break
  except OSError:pass
  time.sleep(.1)
 check('PostgREST global capability visible to both organizers',lambda:[eq(rpc('stream_video_quality_capabilities',{},uid=u),(200,{'version':1,'full_hd_enabled':True})) for u in [A,B]])
 def rest_lifecycle():
  code,token=rpc('reserve_stream_video_start_scoped',{'p_stream_id':X,'p_actor_id':A,'p_expected_quality':'full_hd','p_expected_egress_id':None},'service_role');eq(code,200)
  eq(rpc('hold_stream_video_start',{'p_token':token},'service_role')[0],204)
  code,_=rpc('mark_stream_video_started_scoped',{'p_stream_id':X,'p_actor_id':A,'p_expected_quality':'full_hd','p_expected_egress_id':None,'p_egress_id':'synthetic-egress','p_video_id':V,'p_reservation':token},'service_role');eq(code,204)
  eq(sql("select status||':'||video_quality from streams where id='%s'"%X),'live:full_hd')
 check('PostgREST reserve → hold → mark succeeds; external Egress represented by synthetic ID',rest_lifecycle)
 check('second Full HD blocked at capacity one',lambda:denied("set role service_role;select reserve_stream_video_start_scoped('%s','%s','full_hd',null)"%(Y,B)))
 check('turning global off does not stop committed run',lambda:(sql('update stream_video_quality_settings set full_hd_enabled=false'),eq(sql("select status from streams where id='%s'"%X),'live')))
 check('disabled flag blocks new Full HD save',lambda:denied("insert into streams(author,title,video_quality) values('%s','Disabled','full_hd')"%A))
 reset();sql("update streams set video_quality='full_hd' where id in ('%s','%s')"%(X,Y))
 def parallel():
  def attempt(pair):
   try:return reserve(*pair)
   except RuntimeError:return None
  with concurrent.futures.ThreadPoolExecutor(2) as pool:out=list(pool.map(attempt,[(X,A),(Y,B)]))
  eq(sum(x is not None for x in out),1)
 check('parallel organizers reserve only one Full HD slot',parallel)
 reset();sql("update streams set video_quality='full_hd' where id='%s'"%X);token=reserve();sql('update stream_video_quality_settings set full_hd_enabled=false')
 check('flag off after reserve blocks hold',lambda:denied("set role service_role;select hold_stream_video_start('%s')"%token))
 reset();sql("update streams set video_quality='full_hd' where id='%s'"%X);token=reserve();hold(token);sql('update stream_video_quality_settings set full_hd_enabled=false')
 check('flag off after hold blocks mark atomically',lambda:denied("set role service_role;select mark_stream_video_started_scoped('%s','%s','full_hd',null,'rejected','%s','%s')"%(X,A,V,token)))
 check('failed mark keeps held reservation and creates no run',lambda:eq(sql("select (select count(*) from stream_video_runs)||':'||(select count(*) from stream_video_start_reservations where expires_at='infinity')"),'0:1'))
 reset();sql('update stream_video_quality_settings set full_hd_enabled=false');token=reserve(profile='hd');hold(token);mark(token,profile='hd')
 check('HD reserve/hold/mark works with Full HD disabled',lambda:eq(sql("select status||':'||video_quality from streams where id='%s'"%X),'live:hd'))
 check('no network/foreign database extensions',lambda:eq(sql("select (select count(*) from pg_foreign_server)||':'||(select count(*) from pg_extension where extname<>'plpgsql')"),'0:0'))
finally:
 if rest:
  rest.terminate();rest.wait(timeout=10);log.close()
 if started:cmd([PG/'pg_ctl','-D',work/'cluster','-m','fast','-w','stop'])
 for p in [dbport,apiport]:
  with socket.socket() as sock:assert sock.connect_ex(('127.0.0.1',p))!=0
 results.append({'name':'temporary services stopped; ports closed','status':'PASS'})
 (work/'results.json').write_text(json.dumps(results,indent=2)+'\n')
print(json.dumps({'pass':len(results),'fail':0,'results':str(work/'results.json')}))
