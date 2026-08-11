-- MONJEZ V2 — P10: Analytics V2 — "Review Rejection Rate" metric.
-- Run after schema.sql, rls.sql.
--
-- reviewTask (src/lib/actions/tasks.ts) only ever logged a decision as a
-- task_comments row, and only when the reviewer typed notes - approvals
-- routinely have none (notes are optional there), so comments alone
-- undercount approvals and would skew any rate computed from them. This
-- adds a small dedicated table reviewTask now always writes to (regardless
-- of whether notes were given), the same way this project already tracks
-- audit-style facts in a purpose-built table rather than inferring them
-- from unrelated data.

create table public.task_reviews (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  reviewer_id uuid references public.users(id) on delete set null,
  decision text not null check (decision in ('approve', 'reject')),
  note text,
  created_at timestamptz not null default now()
);

create index task_reviews_task_id_idx on public.task_reviews(task_id);

alter table public.task_reviews enable row level security;

-- visibility follows the parent task, same shape as task_comments/task_attachments
create policy task_reviews_select on public.task_reviews
  for select using (exists (select 1 from public.tasks t where t.id = task_id));

create policy task_reviews_insert on public.task_reviews
  for insert with check (
    exists (select 1 from public.tasks t where t.id = task_id) and reviewer_id = auth.uid()
  );

create or replace function public.report_review_rejection_rate(
  p_since timestamptz default null,
  p_until timestamptz default null,
  p_department_id uuid default null
)
returns table (total_reviews bigint, rejected_count bigint, rejection_rate numeric)
language sql
security invoker
stable
as $$
  select
    count(*),
    count(*) filter (where r.decision = 'reject'),
    case when count(*) = 0 then 0 else round(100.0 * count(*) filter (where r.decision = 'reject') / count(*), 1) end
  from public.task_reviews r
  join public.tasks t on t.id = r.task_id
  where (p_since is null or r.created_at >= p_since)
    and (p_until is null or r.created_at < p_until)
    and (
      p_department_id is null
      or t.assigned_to in (select id from public.users where department_id = p_department_id)
    );
$$;
