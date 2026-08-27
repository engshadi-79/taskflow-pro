import "../global.css";
import { useEffect, useState } from "react";
import { I18nManager } from "react-native";
import * as Updates from "expo-updates";
import * as Notifications from "expo-notifications";
import { Slot, useRouter, type Href } from "expo-router";
import { AuthProvider } from "@/lib/auth-context";
import { AuthGate } from "@/components/auth-gate";
import { SplashScreen } from "@/components/splash-screen";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

function useNotificationTapNavigation() {
  const router = useRouter();

  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const url = response.notification.request.content.data?.url as string | undefined;
      if (url) router.push(url as Href);
    });
    return () => sub.remove();
  }, [router]);
}

export default function RootLayout() {
  useNotificationTapNavigation();
  // I18nManager.forceRTL() only takes effect on the *next* cold start, not
  // the current render - without an immediate reload, a fresh install
  // renders one full pass in LTR (mirrored tab order, misaligned headers)
  // before ever picking up RTL, and simply backgrounding/foregrounding the
  // app (not a true kill+relaunch) never fixes it. Reloading right here,
  // once, makes it self-correct with no manual restart needed.
  const [reloading, setReloading] = useState(false);

  useEffect(() => {
    if (I18nManager.isRTL) return;
    I18nManager.allowRTL(true);
    I18nManager.forceRTL(true);
    setReloading(true);
    Updates.reloadAsync().catch(() => setReloading(false));
  }, []);

  if (reloading) {
    return <SplashScreen />;
  }

  return (
    <AuthProvider>
      <AuthGate>
        <Slot />
      </AuthGate>
    </AuthProvider>
  );
}
