-- APPLIED.
--
-- Phase 4 prerequisite: chats has no column identifying who created it, which
-- is needed to enforce "only the creator can remove other participants /
-- delete the group" (the rule confirmed earlier in this project). Purely
-- additive, nullable - existing rows (all 1:1, and the two test groups
-- created before this column existed) just get creator = NULL, which is
-- fine: the frontend only gates creator-only actions for is_group = true
-- chats, and any pre-existing group without a recorded creator simply won't
-- expose remove-other-participant/delete-group actions until it's recreated
-- or backfilled by hand if ever needed.

begin;

alter table public.chats
  add column if not exists creator uuid references public.users(id);

commit;
