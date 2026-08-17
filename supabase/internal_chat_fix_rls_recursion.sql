-- Fix: "infinite recursion detected in policy for relation
-- conversation_participants"
--
-- conversation_participants_select's own USING clause queried
-- conversation_participants again (aliased cp2) to check membership.
-- Postgres re-applies that same table's RLS policy to that nested query,
-- which nested-queries the table again, forever - a classic self-
-- referencing RLS policy. Every other policy in internal_chat.sql that
-- checked "(select 1 from conversation_participants where ...)" as a
-- plain nested subquery has the identical problem for the same reason
-- (evaluating it forces conversation_participants' own recursive policy
-- to run), not just the one on conversation_participants itself.
--
-- Fix: the membership check now lives in one SECURITY DEFINER function.
-- A SECURITY DEFINER function executes as its owner (the migration role,
-- which owns these tables) - table owners are not subject to their own
-- table's RLS unless FORCE ROW LEVEL SECURITY is set (it isn't here), so
-- the function's internal query bypasses RLS entirely instead of
-- re-triggering it. This is the same reason current_org_id()/
-- current_user_role() (rls.sql) are SECURITY DEFINER rather than plain
-- views.

create or replace function public.is_conversation_participant(p_conversation_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.conversation_participants
    where conversation_id = p_conversation_id and user_id = auth.uid()
  );
$$;

drop policy conversations_select on public.conversations;
create policy conversations_select on public.conversations
  for select using (public.is_conversation_participant(id));

drop policy conversation_participants_select on public.conversation_participants;
create policy conversation_participants_select on public.conversation_participants
  for select using (public.is_conversation_participant(conversation_id));

drop policy chat_messages_select on public.chat_messages;
create policy chat_messages_select on public.chat_messages
  for select using (public.is_conversation_participant(conversation_id));

drop policy chat_messages_insert on public.chat_messages;
create policy chat_messages_insert on public.chat_messages
  for insert with check (
    sender_id = auth.uid() and public.is_conversation_participant(conversation_id)
  );

drop policy chat_message_attachments_select on public.chat_message_attachments;
create policy chat_message_attachments_select on public.chat_message_attachments
  for select using (
    exists (
      select 1 from public.chat_messages m
      where m.id = message_id and public.is_conversation_participant(m.conversation_id)
    )
  );

drop policy chat_message_attachments_insert on public.chat_message_attachments;
create policy chat_message_attachments_insert on public.chat_message_attachments
  for insert with check (
    exists (
      select 1 from public.chat_messages m
      where m.id = message_id and m.sender_id = auth.uid() and public.is_conversation_participant(m.conversation_id)
    )
  );

drop policy chat_attachments_storage_select on storage.objects;
create policy chat_attachments_storage_select on storage.objects
  for select using (
    bucket_id = 'task-attachments'
    and (storage.foldername(name))[1] = 'chat'
    and public.is_conversation_participant((storage.foldername(name))[2]::uuid)
  );

drop policy chat_attachments_storage_insert on storage.objects;
create policy chat_attachments_storage_insert on storage.objects
  for insert with check (
    bucket_id = 'task-attachments'
    and (storage.foldername(name))[1] = 'chat'
    and owner = auth.uid()
    and public.is_conversation_participant((storage.foldername(name))[2]::uuid)
  );
