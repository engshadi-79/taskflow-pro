-- TaskFlow Pro — notify the assignee on every Kanban status change.
-- Run this after notifications_and_reports.sql (it replaces that file's
-- notify_task_event function; the trigger binding itself is untouched).
--
-- Before this, only three status transitions notified the assignee
-- (-> completed, -> overdue, pending_review -> in_progress as a rejection).
-- Dragging a card into 'new' or straight into 'in_progress' produced no
-- notification at all. This adds a generic fallback for every other
-- transition, so any status change made anywhere (Kanban drag, the task
-- detail page, approve/reject) reaches the assignee - the trigger fires on
-- the tasks table itself, not on a specific UI action.

create or replace function public.notify_task_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  status_label text;
begin
  if TG_OP = 'INSERT' then
    insert into public.notifications (user_id, task_id, type, message)
    values (new.assigned_to, new.id, 'task_assigned', 'تم إسناد مهمة جديدة إليك: ' || new.title);
    return new;
  end if;

  if TG_OP = 'UPDATE' then
    if new.assigned_to is distinct from old.assigned_to then
      insert into public.notifications (user_id, task_id, type, message)
      values (new.assigned_to, new.id, 'task_assigned', 'تم إسناد مهمة إليك: ' || new.title);
    end if;

    if new.status is distinct from old.status then
      if new.status = 'pending_review' and new.created_by is not null then
        -- the assignee submitted this themselves: notify the reviewer, not them
        insert into public.notifications (user_id, task_id, type, message)
        values (new.created_by, new.id, 'task_pending_review', 'مهمة بانتظار مراجعتك: ' || new.title);
      elsif new.status = 'completed' then
        insert into public.notifications (user_id, task_id, type, message)
        values (new.assigned_to, new.id, 'task_completed', 'تم اعتماد مهمتك: ' || new.title);
      elsif new.status = 'in_progress' and old.status = 'pending_review' then
        insert into public.notifications (user_id, task_id, type, message)
        values (new.assigned_to, new.id, 'task_rejected', 'تم رفض مهمتك، راجع الملاحظات: ' || new.title);
      elsif new.status = 'overdue' then
        insert into public.notifications (user_id, task_id, type, message)
        values (new.assigned_to, new.id, 'task_overdue', 'المهمة متأخرة: ' || new.title);
      elsif auth.uid() is distinct from new.assigned_to then
        -- catch-all: every other transition (e.g. into 'new', or straight
        -- into 'in_progress' without having been in review) still reaches
        -- the assignee, naming the status it moved to - but only when
        -- someone else made the change. The assignee can drag their own
        -- card between new/in_progress/pending_review themselves, and
        -- notifying them about their own action would just be noise.
        status_label := case new.status
          when 'new' then 'جديدة'
          when 'in_progress' then 'قيد التنفيذ'
          when 'pending_review' then 'بانتظار المراجعة'
          when 'completed' then 'مكتملة'
          when 'overdue' then 'متأخرة'
          when 'cancelled' then 'ملغاة'
          else new.status
        end;
        insert into public.notifications (user_id, task_id, type, message)
        values (
          new.assigned_to, new.id, 'task_status_changed',
          'تم تغيير حالة مهمتك "' || new.title || '" إلى: ' || status_label
        );
      end if;
    end if;

    return new;
  end if;

  return new;
end;
$$;
