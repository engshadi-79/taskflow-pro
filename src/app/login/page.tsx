import { getPublicOrganizationBranding } from "@/lib/data/organization";
import { LoginForm } from "@/components/auth/login-form";

// Without this, Next prerenders the branding fetch once at build time,
// baking in whatever logo existed then - a later upload wouldn't show here
// until the next deploy.
export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const branding = await getPublicOrganizationBranding();
  return <LoginForm orgLogoUrl={branding?.logo_url ?? null} />;
}
