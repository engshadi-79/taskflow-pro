import { createAdminClient } from "@/lib/supabase/admin";
import { AnimatedBackground } from "@/components/shared/animated-background";
import { InviteAcceptForm } from "@/components/auth/invite-accept-form";

const ROLE_LABEL: Record<string, string> = {
  employee: "موظف",
  department_manager: "مدير قسم",
};

export default async function InvitePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;

  // Unauthenticated visitor holding a random, unguessable invite code -
  // same "safe pre-login lookup" shape as getPublicOrganizationBranding()
  // in src/lib/data/organization.ts. Re-checks the exact same validity
  // conditions as redeem_organization_invite() (organization_invites.sql)
  // so a dead link shows a clear message instead of a broken form.
  const supabase = createAdminClient();
  const { data: invite } = await supabase
    .from("organization_invites")
    .select("id, organization_id, role, department_id, max_uses, use_count, expires_at, revoked_at")
    .eq("code", code)
    .maybeSingle();

  const isValid =
    !!invite &&
    !invite.revoked_at &&
    new Date(invite.expires_at) > new Date() &&
    (invite.max_uses === null || invite.use_count < invite.max_uses);

  let orgName: string | null = null;
  let departmentName: string | null = null;
  if (isValid && invite) {
    const [{ data: org }, { data: department }] = await Promise.all([
      supabase.from("organizations").select("name").eq("id", invite.organization_id).single(),
      invite.department_id
        ? supabase.from("departments").select("name").eq("id", invite.department_id).single()
        : Promise.resolve({ data: null }),
    ]);
    orgName = org?.name ?? null;
    departmentName = department?.name ?? null;
  }

  return (
    <main className="relative flex flex-1 items-center justify-center overflow-hidden bg-background px-4">
      <AnimatedBackground intensity="hero" />
      <div
        aria-hidden
        className="animate-blob-1 absolute -top-24 -start-24 h-96 w-96 rounded-full bg-accent-500/25 blur-3xl"
      />
      <div
        aria-hidden
        className="animate-blob-2 absolute -bottom-24 -end-24 h-96 w-96 rounded-full bg-pink-500/20 blur-3xl"
      />

      <div className="relative w-full max-w-sm rounded-[20px] border border-border bg-surface/90 p-8 shadow-2xl backdrop-blur-md">
        {isValid && invite && orgName ? (
          <InviteAcceptForm
            code={code}
            organizationName={orgName}
            roleLabel={ROLE_LABEL[invite.role] ?? invite.role}
            departmentName={departmentName}
          />
        ) : (
          <div className="text-center">
            <span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-2xl">
              ⚠️
            </span>
            <h1 className="font-display text-lg font-black text-foreground">رابط الدعوة غير صالح</h1>
            <p className="mt-2 text-sm text-muted">انتهت صلاحية هذا الرابط أو تم استخدامه بالكامل أو أُلغِي.</p>
          </div>
        )}
      </div>
    </main>
  );
}
