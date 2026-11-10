-- OWNER MANUAL ONLY. Accept the existing Prodamus short-link host payform.ru.
-- Exact hosts only; no SQL data updates, no new orders, no callbacks.
begin;
set local lock_timeout='3s';
create or replace function public.checkout_acquire_link(p_order_id uuid,p_actor_id uuid,p_lease uuid) returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare o checkout_private.orders%rowtype;legacy public."order"%rowtype;
begin
 select * into o from checkout_private.orders where order_id=p_order_id for update;
 if not found then
  select * into legacy from public."order" where id=p_order_id;
  if not found or legacy.owner is distinct from p_actor_id then raise exception 'not_owner' using errcode='42501';end if;
  if legacy.paid is true then return jsonb_build_object('completed',true,'order_id',p_order_id);end if;
  if legacy."pageUrl" ~ '^https://(meetguru[.]payform[.]ru|payform[.]ru)([/?#]|$)' then return jsonb_build_object('payLink',legacy."pageUrl",'order_id',p_order_id);end if;
  raise exception 'legacy_link_unavailable';
 end if;
 if o.owner_id is distinct from p_actor_id then raise exception 'not_owner' using errcode='42501';end if;
 if o.status='fulfilled' then return jsonb_build_object('completed',true,'order_id',o.order_id);end if;
 if o.status<>'pending' then raise exception 'checkout_%',o.status;end if;
 if o.total=0 then return jsonb_build_object('zero',true,'order_id',o.order_id);end if;
 if o.pay_link is not null then return jsonb_build_object('payLink',o.pay_link,'order_id',o.order_id);end if;
 if o.lease_until>clock_timestamp() then raise exception 'payment_link_in_progress';end if;
 update checkout_private.orders set lease_id=p_lease,lease_until=clock_timestamp()+interval '30 seconds' where order_id=p_order_id;
 return jsonb_build_object('order_id',o.order_id,'total',o.total,'lines',(select jsonb_agg(jsonb_build_object('name',name,'price',price,'quantity',1) order by shop_id) from checkout_private.items where order_id=p_order_id));
end$$;


create or replace function public.checkout_store_link(p_order_id uuid,p_actor_id uuid,p_lease uuid,p_link text) returns void
language plpgsql security definer set search_path=pg_catalog as $$
begin
 if p_link !~ '^https://(meetguru[.]payform[.]ru|payform[.]ru)([/?#]|$)' then raise exception 'invalid_payment_link';end if;
 update checkout_private.orders set pay_link=p_link,lease_until=null where order_id=p_order_id and owner_id=p_actor_id and lease_id=p_lease and status='pending';
 if not found then raise exception 'payment_link_lease_lost';end if;
 update public."order" set "pageUrl"=p_link where id=p_order_id;
end$$;

notify pgrst,'reload schema';
commit;
