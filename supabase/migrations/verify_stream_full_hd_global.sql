-- Read-only verification after the owner applies pending_stream_full_hd_global.sql.
select 'global_full_hd_enabled_limit_one' as check_name,
 case when exists(select 1 from public.stream_video_quality_settings where singleton and full_hd_enabled and max_full_hd_live=1) then 'PASS' else 'FAIL' end as result
union all
select 'hd_default',case when exists(select 1 from information_schema.columns where table_schema='public' and table_name='streams' and column_name='video_quality' and column_default like '%hd%') then 'PASS' else 'FAIL' end
union all
select 'rls_preserved',case when (select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname in ('streams','stream_video_quality_settings','stream_video_runs','stream_video_start_reservations') and c.relrowsecurity)=4 then 'PASS' else 'FAIL' end
union all
select 'no_personal_grant_dependencies',case when (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('guard_stream_video_quality','stream_full_hd_test_allowed','reserve_stream_video_start_scoped','hold_stream_video_start','mark_stream_video_started_scoped') and pg_get_functiondef(p.oid) not like '%stream_full_hd_test_grants%')=5 then 'PASS' else 'FAIL' end
union all
select 'private_start_rpc_acl',case when not has_function_privilege('anon','public.reserve_stream_video_start_scoped(uuid,uuid,text,text)','execute') and not has_function_privilege('authenticated','public.reserve_stream_video_start_scoped(uuid,uuid,text,text)','execute') and has_function_privilege('service_role','public.reserve_stream_video_start_scoped(uuid,uuid,text,text)','execute') then 'PASS' else 'FAIL' end
union all
select 'private_mark_rpc_acl',case when not has_function_privilege('anon','public.mark_stream_video_started_scoped(uuid,uuid,text,text,text,uuid,uuid)','execute') and not has_function_privilege('authenticated','public.mark_stream_video_started_scoped(uuid,uuid,text,text,text,uuid,uuid)','execute') and has_function_privilege('service_role','public.mark_stream_video_started_scoped(uuid,uuid,text,text,text,uuid,uuid)','execute') then 'PASS' else 'FAIL' end
union all
select 'guard_enabled',case when exists(select 1 from pg_trigger where tgrelid='public.streams'::regclass and tgname='guard_stream_video_quality' and tgenabled='O') then 'PASS' else 'FAIL' end;

select public.stream_video_quality_capabilities();
