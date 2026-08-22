import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { UpdatePasswordForm } from "@/components/auth/update-password-form";

// The reset-email link only ever reaches this page after /auth/callback has
// already exchanged its code for a session - no session here means an
// expired/already-used link, not a page someone can just type the URL to.
export default async function UpdatePasswordPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?error=reset");
  }

  return <UpdatePasswordForm />;
}
