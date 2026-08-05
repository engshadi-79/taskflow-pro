import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/data/profile";
import { LandingPage } from "@/components/landing/landing-page";

export default async function Home() {
  const profile = await getCurrentProfile();

  if (profile) {
    redirect("/dashboard");
  }

  return <LandingPage />;
}
