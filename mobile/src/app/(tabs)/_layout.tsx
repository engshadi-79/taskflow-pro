import { Tabs } from "expo-router";
import { BellIcon, GridIcon, KanbanIcon, MoreIcon, TasksIcon } from "@/components/tab-icons";

const ACTIVE = "#4f46e5";
const INACTIVE = "#94a3b8";

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: ACTIVE,
        tabBarInactiveTintColor: INACTIVE,
        tabBarStyle: { height: 62, paddingTop: 6, paddingBottom: 8 },
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
