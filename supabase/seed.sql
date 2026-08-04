-- TaskFlow Pro — Phase 2: seed data for testing the three roles
-- Run this after schema.sql and rls.sql.
--
-- Test accounts created below (password for all three: TaskFlow123!):
--   admin@taskflow.test    -> super_admin
--   manager@taskflow.test  -> department_manager (تقنية المعلومات)
--   employee@taskflow.test -> employee (تقنية المعلومات)
--
-- PART B inserts directly into auth.users, which relies on the exact
-- column layout of Supabase's current GoTrue schema. If it errors on
-- your project (schema drift between Supabase versions), create the
-- three accounts instead via Dashboard -> Authentication -> Users ->
-- Add user, using the emails above and setting each user's metadata
-- to the same fields passed in raw_user_meta_data below. Then run
-- PART C by itself.

create extension if not exists pgcrypto;

-- ============================================================
-- PART A: organization + departments
-- ============================================================
insert into public.organizations (id, name, plan_type) values
  ('11111111-1111-1111-1111-111111111111', 'شركة تجريبية', 'free');

insert into public.departments (id, organization_id, name) values
  ('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 'تقنية المعلومات'),
  ('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', 'الموارد البشرية');

-- ============================================================
-- PART B: auth users (fires handle_new_user -> populates public.users)
-- ============================================================
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, last_sign_in_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
) values
  (
    '00000000-0000-0000-0000-000000000000',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'authenticated', 'authenticated',
    'admin@taskflow.test',
    crypt('TaskFlow123!', gen_salt('bf')),
    now(), now(),
    '{"provider":"email","providers":["email"]}',
    jsonb_build_object(
      'organization_id', '11111111-1111-1111-1111-111111111111',
      'role', 'super_admin',
      'full_name', 'سارة المدير العام',
      'job_title', 'المدير التنفيذي'
    ),
    now(), now(), '', '', '', ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    'authenticated', 'authenticated',
    'manager@taskflow.test',
    crypt('TaskFlow123!', gen_salt('bf')),
    now(), now(),
    '{"provider":"email","providers":["email"]}',
    jsonb_build_object(
      'organization_id', '11111111-1111-1111-1111-111111111111',
      'role', 'department_manager',
      'full_name', 'خالد مدير القسم',
      'department_id', '22222222-2222-2222-2222-222222222222',
      'job_title', 'مدير تقنية المعلومات'
    ),
    now(), now(), '', '', '', ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    'cccccccc-cccc-cccc-cccc-cccccccccccc',
    'authenticated', 'authenticated',
    'employee@taskflow.test',
    crypt('TaskFlow123!', gen_salt('bf')),
    now(), now(),
    '{"provider":"email","providers":["email"]}',
    jsonb_build_object(
      'organization_id', '11111111-1111-1111-1111-111111111111',
      'role', 'employee',
      'full_name', 'ليلى أحمد',
      'department_id', '22222222-2222-2222-2222-222222222222',
      'job_title', 'مطورة برمجيات'
    ),
    now(), now(), '', '', '', ''
  );

insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
values
  (gen_random_uuid(), 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    jsonb_build_object('sub', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'email', 'admin@taskflow.test'),
    'email', now(), now(), now()),
  (gen_random_uuid(), 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    jsonb_build_object('sub', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'email', 'manager@taskflow.test'),
    'email', now(), now(), now()),
  (gen_random_uuid(), 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'cccccccc-cccc-cccc-cccc-cccccccccccc',
    jsonb_build_object('sub', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'email', 'employee@taskflow.test'),
    'email', now(), now(), now());

-- ============================================================
-- PART C: link manager to their department + sample tasks
-- ============================================================
update public.departments
  set manager_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
  where id = '22222222-2222-2222-2222-222222222222';

insert into public.tasks (
  organization_id, title, description, assigned_to, created_by,
  priority, status, start_date, due_date
) values
  (
    '11111111-1111-1111-1111-111111111111',
    'تجهيز تقرير الأداء الشهري',
    'إعداد تقرير أداء فريق تقنية المعلومات لشهر أغسطس',
    'cccccccc-cccc-cccc-cccc-cccccccccccc',
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    'high', 'in_progress', current_date, current_date + interval '3 days'
  ),
  (
    '11111111-1111-1111-1111-111111111111',
    'مراجعة طلبات الدعم الفني',
    'مراجعة التذاكر المفتوحة والرد عليها',
    'cccccccc-cccc-cccc-cccc-cccccccccccc',
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    'medium', 'pending_review', current_date - interval '2 days', current_date - interval '1 day'
  ),
  (
    '11111111-1111-1111-1111-111111111111',
    'تحديث سياسة كلمات المرور',
    null,
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'urgent', 'new', current_date, current_date + interval '7 days'
  );
