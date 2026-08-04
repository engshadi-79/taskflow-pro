-- TaskFlow Pro — dashboard redesign: activity log trigger + extra report RPCs
-- Run this after notifications_and_reports.sql.

-- ============================================================
-- activity_log trigger (the table existed since schema.sql but
-- nothing ever wrote to it — this fills "آخر النشاطات" on the
-- dashboard). SECURITY DEFINER because activity_log's insert
-- policy only allows a row where user_id = auth.uid(); running
-- as definer still resolves auth.uid() correctly (it reads the
-- request JWT, unaffected by SECURITY DEFINER), it just bypasses
-- the RLS check itself so the trigger can never be blocked.
-- ============================================================
create function public.log_task_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  status_ar text;
begin
  if TG_OP = 'INSERT' then
    insert into public.activity_log (organization_id, user_id, action_type, entity_type, entity_id, description)
    values (new.organization_id, auth.uid(), 'create', 'task', new.id, 'أنشأ مهمة: ' || new.title);
    return new;
  end if;

  if TG_OP = 'UPDATE' and new.status is distinct from old.status then
    status_ar := case new.status
      when 'new' then 'جديدة'
      when 'in_progress' then 'قيد التنفيذ'
      when 'pending_review' then 'بانتظار المراجعة'
      when 'completed' then 'مكتملة'
      when 'overdue' then 'متأخرة'
      when 'cancelled' then 'ملغاة'
      else new.status
    end;
    insert into public.activity_log (organization_id, user_id, action_type, entity_type, entity_id, description)
    values (new.organization_id, auth.uid(), 'status_change', 'task', new.id, 'حالة المهمة "' || new.title || '" أصبحت: ' || status_ar);
    return new;
  end if;

  return new;
end;
$$;

create trigger tasks_log_activity
  after insert or update on public.tasks
  for each row execute function public.log_task_activity();

-- ============================================================
-- extra report RPCs (SECURITY INVOKER — RLS scopes results
-- automatically, same pattern as notifications_and_reports.sql)
-- ============================================================
create function public.report_weekly_top_employees()
returns table (user_id uuid, full_name text, completed_count bigint)
language sql
security invoker
stable
as $$
  select u.id, u.full_name, count(t.id) as completed_count
  from public.users u
  join public.tasks t
    on t.assigned_to = u.id
    and t.status = 'completed'
    and t.updated_at >= now() - interval '7 days'
  group by u.id, u.full_name
  order by completed_count desc
  limit 4;
$$;

create function public.report_task_distribution_by_department()
returns table (department_name text, task_count bigint)
language sql
security invoker
stable
as $$
  select coalesce(d.name, 'بدون قسم'), count(t.id)
  from public.tasks t
  join public.users u on u.id = t.assigned_to
  left join public.departments d on d.id = u.department_id
  where t.status != 'cancelled'
  group by d.name
  order by count(t.id) desc;
$$;

create function public.report_task_distribution_by_priority()
returns table (priority text, task_count bigint)
language sql
security invoker
stable
as $$
  select priority, count(*) as task_count
  from public.tasks
  where status != 'cancelled'
  group by priority
  order by count(*) desc;
$$;

create function public.report_weekly_trend()
returns table (day date, completed_count bigint)
language sql
security invoker
stable
as $$
  select gs.day, count(t.id)
  from generate_series(current_date - interval '6 days', current_date, interval '1 day') as gs(day)
  left join public.tasks t
    on t.status = 'completed'
    and t.updated_at::date = gs.day::date
  group by gs.day
  order by gs.day;
$$;
