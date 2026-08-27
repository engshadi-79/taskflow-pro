import { useEffect } from "react";
import { useRouter, useSegments } from "expo-router";
import { useAuth } from "@/lib/auth-context";
import { SplashScreen } from "@/components/splash-screen";

/**
 * Standard Expo Router auth-gating pattern: redirect based on session
 * state once it's known, rather than blocking route rendering outright -
 * mirrors src/app/(dashboard)/layout.tsx's redirect() on the web app, just
 * client-side since there's no server request/response cycle here.
 */
export function AuthGate({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    const inAuthGroup = segments[0] === "login";
    if (!session && !inAuthGroup) {
      router.replace("/login");
    } else if (session && inAuthGroup) {
      router.replace("/");
    }
  }, [session, loading, segments, router]);

  if (loading) {
    return <SplashScreen />;
  }

  return <>{children}</>;
}
