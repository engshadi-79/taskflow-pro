import { useEffect } from "react";
import { Tabs } from "expo-router";
import * as Notifications from "expo-notifications";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BellIcon, GridIcon, KanbanIcon, MoreIcon, TasksIcon } from "@/components/tab-icons";
import { useAuth } from "@/lib/auth-context";
import { enablePush } from "@/lib/push-registration";

const ACTIVE = "#4f46e5";
const INACTIVE = "#94a3b8";

export default function TabsLayout() {
  // Android's on-screen nav bar (3-button mode especially) sits below the
  // app's own content with edge-to-edge rendering - a fixed paddingBottom
  // put the tab bar right up against those system buttons on some devices.
  // insets.bottom is the actual reserved system-UI height for this device.
  const insets = useSafeAreaInsets();
  const { profile } = useAuth();

  useEffect(() => {
    if (!profile) return;
    // Only re-registers silently if permission was already granted in a
    // previous session (e.g. token rotated) - a first-time grant prompt only
    // ever happens from the explicit toggle in Settings, never on login.
    Notifications.getPermissionsAsync().then(({ status }) => {
      if (status === "granted") enablePush(profile.id, profile.organization_id);
    });
  }, [profile]);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: ACTIVE,
        tabBarInactiveTintColor: INACTIVE,
        tabBarStyle: { height: 54 + insets.bottom, paddingTop: 6, paddingBottom: insets.bottom + 6 },
        tabBarLabelStyle: { fontSize: 9.5, fontWeight: "700" },
      }}
    >
      <Tabs.Screen name="index" options={{ title: "الرئيسية", tabBarIcon: ({ color }) => <GridIcon color={String(color)} /> }} />
      <Tabs.Screen name="tasks" options={{ title: "المهام", tabBarIcon: ({ color }) => <TasksIcon color={String(color)} /> }} />
      <Tabs.Screen name="kanban" options={{ title: "كانبان", tabBarIcon: ({ color }) => <KanbanIcon color={String(color)} /> }} />
      <Tabs.Screen name="notifications" options={{ title: "الإشعارات", tabBarIcon: ({ color }) => <BellIcon color={String(color)} /> }} />
      <Tabs.Screen name="more" options={{ title: "المزيد", tabBarIcon: ({ color }) => <MoreIcon color={String(color)} /> }} />
    </Tabs>
  );
}
