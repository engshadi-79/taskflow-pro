import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/data/profile";

export default async function OwnProfilePage() {
  const profile = await getCurrentProfile();

  if (!profile) {
    redirect("/login");
  }

  redirect(`/dashboard/profile/${profile.id}`);
}
