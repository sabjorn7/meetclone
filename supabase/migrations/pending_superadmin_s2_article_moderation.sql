-- S2 (/superadmin rebuild) — article moderation RPCs + test fixtures. Run in Supabase Studio.
-- SECURITY DEFINER + internal admin gate + queue-only guard (same pattern as S1 course RPCs).
-- Each action ALSO writes an audit row into articles_logs (creator = auth.uid() = the moderator)
-- and appends its id to articles.ModLogs (uuid[]) — preserving the existing audit pattern (130 rows).
-- VOLATILE (they mutate).

-- ── RPCs ─────────────────────────────────────────────────────────────────────
create or replace function public.admin_approve_article(p_article uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_status text; v_log uuid;
begin
  if not exists (select 1 from public.users where id = auth.uid() and (role='admin' or superadmin is true)) then
    raise exception 'forbidden' using errcode='42501';
  end if;
  select "Status" into v_status from public.articles where id = p_article;
  if v_status is null then raise exception 'article not found' using errcode='P0002'; end if;
  if v_status not in ('Отправлено на модерацию','На модерации') then
    raise exception 'article not in moderation queue (status=%)', v_status using errcode='22023';
  end if;
  insert into public.articles_logs (article, status, creator)
    values (p_article, 'Опубликовано', auth.uid()) returning id into v_log;
  update public.articles
     set "Status"='Опубликовано', "Edit_Comment"='',
         "ModLogs" = coalesce("ModLogs", array[]::uuid[]) || v_log
   where id = p_article;
  return jsonb_build_object('id', p_article, 'status', 'Опубликовано');
end $$;

create or replace function public.admin_return_article(p_article uuid, p_comment text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_status text; v_log uuid;
begin
  if not exists (select 1 from public.users where id = auth.uid() and (role='admin' or superadmin is true)) then
    raise exception 'forbidden' using errcode='42501';
  end if;
  if p_comment is null or btrim(p_comment) = '' then raise exception 'comment required' using errcode='22023'; end if;
  select "Status" into v_status from public.articles where id = p_article;
  if v_status is null then raise exception 'article not found' using errcode='P0002'; end if;
  if v_status not in ('Отправлено на модерацию','На модерации') then
    raise exception 'article not in moderation queue (status=%)', v_status using errcode='22023';
  end if;
  insert into public.articles_logs (article, status, creator, comment)
    values (p_article, 'Отправлено на доработку', auth.uid(), p_comment) returning id into v_log;
  update public.articles
     set "Status"='Отправлено на доработку', "Edit_Comment"=p_comment, "Date_Version"=now(),
         "ModLogs" = coalesce("ModLogs", array[]::uuid[]) || v_log
   where id = p_article;
  return jsonb_build_object('id', p_article, 'status', 'Отправлено на доработку');
end $$;

grant execute on function public.admin_approve_article(uuid)      to authenticated;
grant execute on function public.admin_return_article(uuid, text) to authenticated;


-- ── TEST FIXTURE ─────────────────────────────────────────────────────────────
-- Safe test article owned by the admin, sitting in the moderation queue.
-- (If articles.id has no default, prepend  id => gen_random_uuid()  to the column list.)
-- NOTE: there is already 1 REAL article in the queue ('На модерации') — during the live test
-- act ONLY on the '[ТЕСТ]' row, never the real one.
insert into public.articles ("Title", "Content", "Creator", "Status", "Category", "slug")
values ('[ТЕСТ] Модерация статьи — не читать', '<p>Тестовая статья для проверки модерации.</p>',
        'b689d683-f143-47db-a5b0-5940d7f52b02', 'Отправлено на модерацию', 'Тест', 'test-moderation-s2')
returning id;   -- ← note this id for verification

-- Between the two live-button tests, put the test article back into the queue:
--   update public.articles set "Status"='Отправлено на модерацию', "Edit_Comment"=''
--     where "Title"='[ТЕСТ] Модерация статьи — не читать';

-- Verify status + audit log at any time (LOG should gain one row per action, creator = admin):
--   select id, "Title", "Status", "Edit_Comment", "ModLogs"
--     from public.articles where "Title"='[ТЕСТ] Модерация статьи — не читать';
--   select article, status, creator, comment, created_at from public.articles_logs
--     where article = '<test-id>' order by created_at;

-- CLEANUP after both tests pass (delete audit rows first to satisfy the FK, then the article):
--   delete from public.articles_logs where article = '<test-id>';
--   delete from public.articles where id = '<test-id>';
