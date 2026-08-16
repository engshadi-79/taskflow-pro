import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/data/profile";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/shared/page-header";
import { KeyIcon } from "@/components/shared/icons";
import { DeveloperSettingsManager } from "@/components/dashboard/developer-settings-manager";
import type { ApiKey, WebhookDelivery, WebhookEndpoint } from "@/lib/types/developer";

export default async function DeveloperSettingsPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "super_admin") redirect("/dashboard");

  const supabase = await createClient();
  const [{ data: apiKeys }, { data: endpoints }, { data: deliveries }] = await Promise.all([
    supabase
      .from("api_keys")
      .select("id, name, key_prefix, last_used_at, revoked_at, created_at")
      .order("created_at", { ascending: false })
      .returns<ApiKey[]>(),
    supabase
      .from("webhook_endpoints")
      .select("id, url, events, is_active, created_at")
      .order("created_at", { ascending: false })
      .returns<WebhookEndpoint[]>(),
    supabase
      .from("webhook_deliveries")
      .select("id, endpoint_id, event_type, status, response_status, error, created_at")
      .order("created_at", { ascending: false })
      .limit(20)
      .returns<WebhookDelivery[]>(),
  ]);

  return (
    <div className="max-w-3xl space-y-4.5">
      <PageHeader
        title="واجهة API والـ Webhooks"
        subtitle="مفاتيح وصول للأنظمة الخارجية، وإشعارات فورية لخدماتك عند وقوع أحداث في منجز"
        variant="navy"
        icon={<KeyIcon className="h-6 w-6" />}
      />
      <DeveloperSettingsManager
        apiKeys={apiKeys ?? []}
        endpoints={endpoints ?? []}
        deliveries={deliveries ?? []}
      />
    </div>
  );
}
