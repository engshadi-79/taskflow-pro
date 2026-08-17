import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/data/profile";
import { DemoSeedButton } from "@/components/dashboard/demo-seed-button";

/**
 * One-off utility page (not in the sidebar) - seeds a realistic demo
 * scenario (departments, employees, a project, tasks, meetings) modeled on
 * a real project proposal the user provided, so they can test-drive the
 * app with meaningful data instead of an empty state. super_admin only.
 */
export default async function DemoSeedPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "super_admin") redirect("/dashboard");

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="font-display text-[20px] text-foreground">سيناريو تجريبي: التمكين الاقتصادي - غزة</h1>
        <p className="mt-1 text-[13px] text-muted">
          ينشئ 5 أقسام، 10 موظفين بحسابات دخول حقيقية، مشروعًا واحدًا بـ4 مراحل، 27 مهمة، و4 اجتماعات، بناءً على
          مستند المشروع المرفق. يعمل مرة واحدة فقط لكل مؤسسة.
        </p>
      </div>
      <DemoSeedButton />
    </div>
  );
}
