#!/usr/bin/env python3
"""Actual PostgreSQL/PostgREST; synthetic data and local processes only."""
import importlib.util,pathlib,json,uuid,subprocess,concurrent.futures,time
ROOT=pathlib.Path(__file__).resolve().parents[1]
sp=importlib.util.spec_from_file_location('checkout_stand',ROOT/'tests/helpers/checkout_stand.py');m=importlib.util.module_from_spec(sp);sp.loader.exec_module(m)
s=m.Stand()
def uid():return str(uuid.uuid4())
def literal(v):return "'"+str(v).replace("'","''")+"'"
def sql(q):return s.sql(q)
def auth(u,q):return "set role authenticated;set request.jwt.claim.sub="+literal(u)+';'+q
def call(u,name,args):
 raw=sql(auth(u,'select public.'+name+'('+args+');')).splitlines()[-1]
 try:return json.loads(raw)
 except json.JSONDecodeError:return raw
def denied(fn):
 try:fn()
 except RuntimeError:return
 raise AssertionError('expected denial')
def buyer(role='Ученик'):
 u=uid();sql('insert into users(id,role) values('+literal(u)+','+literal(role)+')');return u
def products(capacity=1):
 owner=buyer('Спикер');c,ec,sc,e,t,chat,recording=[uid() for _ in range(7)]
 sql("insert into chats(id,users,read) values('%s','{}','{}');"%chat+
  "insert into course(id,owner,\"Title\",\"Category\",\"Price\",\"DurationLong\",\"DurationPrice\") values('%s','%s','Course','Курсы',1000,2,200),('%s','%s','Event backing','Мероприятия',2000,12,0),('%s','%s','Stream backing','Трансляции',3000,3,0),('%s','%s','Recording','Курсы',0,0,0);"%(c,owner,ec,owner,sc,owner,recording,owner)+
  "insert into events(id,owner,title,price,deposit_percent,capacity,backing_course_id,chat) values('%s','%s','Event',2000,25,%s,'%s','%s');"%(e,owner,'null' if capacity is None else capacity,ec,chat)+
  "insert into streams(id,author,title,price,backing_course_id,access_months,scheduled_at,chat,recording_course) values('%s','%s','Stream',3000,'%s',3,now(),'%s','%s')"%(t,owner,sc,chat,recording))
 return dict(owner=owner,course=c,event=e,stream=t,event_course=ec,stream_course=sc,chat=chat,recording=recording)
def add(u,kind,id,payment='full',renewal=False):
 return call(u,'cart_add_product',','.join([literal(kind),literal(id),literal(payment),'true' if renewal else 'false','true']))
def prepare(u,code=None,key=None):
 rows=call(u,'cart_get','');ids=[x['id'] for x in rows]
 return call(u,'checkout_prepare',literal(key or uid())+',array['+','.join(literal(x) for x in ids)+']::uuid[],'+('null' if code is None else literal(code)))
def plan(order):
 rows=json.loads(sql("select json_agg(json_build_object('shop_id',sh.id,'course_id',sh.course_id,'price',sh.price,'author_id',c.owner,'author_commission',u.\"authorCommission\")) from shop sh join course c on c.id=sh.course_id join users u on u.id=c.owner join public.\"order\" o on sh.id::text=any(o.course_positions) where o.id="+literal(order)))
 js="let s='';for await(const c of process.stdin)s+=c;console.log(JSON.stringify(JSON.parse(s).map(x=>({...x,author_amount:(x.price*x.author_commission/100).toFixed(2)}))))"
 return json.loads(subprocess.run(['node','--input-type=module','-e',js],input=json.dumps(rows),text=True,capture_output=True,check=True).stdout)
def fulfill(order,payment=None,proof=None):
 payment=payment or 'synthetic-'+order;proof=proof or uid()
 sql("insert into payment_audit(id,order_id,event,detail) values('%s','%s','ok','{\"sig_valid\":true,\"payment_status\":\"success\",\"verify\":{\"ok\":true}}') on conflict do nothing"%(proof,order))
 return json.loads(sql("set role service_role;select fulfill_paid_course_order(%s,%s,%s,%s::jsonb)"%(literal(order),literal(payment),literal(proof),literal(json.dumps(plan(order))))).splitlines()[-1])
def state(order):
 return json.loads(sql("select json_build_object('paid',o.paid,'sales',(select count(*) from sales where position::text=any(o.course_positions)),'access',(select count(*) from user_course where \"user\"=o.owner),'receipt',(select count(*) from order_access_fulfillments where order_id=o.id),'regs',(select count(*) from event_registrations where \"user\"=o.owner and status='paid')) from public.\"order\" o where id="+literal(order)))
try:
 s.start();s.cmd([m.PG/'psql','-X','-v','ON_ERROR_STOP=1','-f',ROOT/'tests/fixtures/unified-checkout.sql'])
 s.cmd([m.PG/'psql','-X','-v','ON_ERROR_STOP=1','-f',ROOT/'supabase/migrations/pending_unified_checkout.sql'])
 s.cmd([m.PG/'psql','-X','-v','ON_ERROR_STOP=1','-f',ROOT/'supabase/migrations/pending_checkout_payform_link_host.sql'])
 def accepted():
  for host in ['payform.ru','meetguru.payform.ru']:
   p=products();u=buyer();add(u,'course',p['course']);o=prepare(u);lease=uid();url='https://'+host+'/synthetic-only/'
   sql("set role service_role;select checkout_acquire_link(%s,%s,%s)"%(literal(o['order_id']),literal(u),literal(lease)))
   sql("set role service_role;select checkout_store_link(%s,%s,%s,%s)"%(literal(o['order_id']),literal(u),literal(lease),literal(url)))
   result=json.loads(sql("set role service_role;select checkout_acquire_link(%s,%s,%s)"%(literal(o['order_id']),literal(u),literal(uid()))).splitlines()[-1]);assert result['payLink']==url
   assert state(o['order_id'])==dict(paid=False,sales=0,access=0,receipt=0,regs=0)
 s.check('both exact Prodamus hosts saved and reused; no payment/access/sales/credit effects',accepted)
 def rejected():
  p=products();u=buyer();add(u,'course',p['course']);o=prepare(u);lease=uid();sql("set role service_role;select checkout_acquire_link(%s,%s,%s)"%(literal(o['order_id']),literal(u),literal(lease)))
  for url in ['https://payform.ru.evil.invalid/x','http://payform.ru/x','https://user:password@payform.ru/x','https://payform.ru:8443/x','https://evilpayform.ru/x']:
   denied(lambda:sql("set role service_role;select checkout_store_link(%s,%s,%s,%s)"%(literal(o['order_id']),literal(u),literal(lease),literal(url))))
  denied(lambda:sql("set role authenticated;select checkout_store_link(%s,%s,%s,'https://payform.ru/x')"%(literal(o['order_id']),literal(u),literal(lease))))
 s.check('lookalikes HTTP userinfo ports and browser role cannot persist payment URLs',rejected)
 def legacy():
  u=buyer();o=uid();sql("insert into public.\"order\"(id,owner,summ,\"pageUrl\") values(%s,%s,100,'https://payform.ru/synthetic-legacy/')"%(literal(o),literal(u)))
  result=json.loads(sql("set role service_role;select checkout_acquire_link(%s,%s,%s)"%(literal(o),literal(u),literal(uid()))).splitlines()[-1]);assert result['payLink']=='https://payform.ru/synthetic-legacy/'
  denied(lambda:sql("set role service_role;select checkout_acquire_link(%s,%s,%s)"%(literal(o),literal(buyer()),literal(uid()))))
 s.check('legacy Prodamus short links remain owner-bound and resumable',legacy)
finally:
 s.check('temporary services stopped; loopback ports closed',s.stop)
 out=s.tmp/'payform-host-results.json';out.write_text(json.dumps(s.results,indent=2)+'\n');print(json.dumps({'pass':sum(x['status']=='PASS' for x in s.results),'fail':sum(x['status']=='FAIL' for x in s.results),'results':str(out)}))
if any(x['status']=='FAIL' for x in s.results):raise SystemExit(1)
