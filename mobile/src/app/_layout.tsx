import "../global.css";
import { useEffect } from "react";
import { I18nManager } from "react-native";
import { Slot } from "expo-router";
import { AuthProvider } from "@/lib/auth-context";
import { AuthGate } from "@/components/auth-gate";

export default function RootLayout() {
  useEffect(() => {
    if (!I18nManager.isRTL) {
      I18nManager.allowRTL(true);
      I18nManager.forceRTL(true);
      // Native RTL only fully applies after the app relaunches - a fresh
      // dev-client/production install picks this up on its very first
      // launch since this runs before any screen renders.
    }
  }, []);

  return (
    <AuthProvider>
      <AuthGate>
        <Slot />
      </AuthGate>
    </AuthProvider>
  );
}
