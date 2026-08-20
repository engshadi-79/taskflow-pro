import { useRouter, type Href } from "expo-router";
import { Text, TouchableOpacity, View } from "react-native";
import { MobileHeader } from "@/components/mobile-header";
import { useAuth } from "@/lib/auth-context";

const ITEMS: { key: string; href: Href; label: string; tint: string; icon: string; managerOnly?: boolean }[] = [
  { key: "calendar", href: "/more/calendar", label: "التقويم", tint: "bg-purple-50", icon: "📅" },
  { key: "projects", href: "/more/projects/index", label: "المشاريع", tint: "bg-pink-50", icon: "💼" },
  { key: "workload", href: "/more/workload", label: "الحمل الوظيفي", tint: "bg-accent-50", icon: "📊", managerOnly: true },
  { key: "meetings", href: "/more/meetings/index", label: "الاجتماعات", tint: "bg-orange-50", icon: "🗓" },
  { key: "chat", href: "/more/chat/index", label: "المحادثات", tint: "bg-teal-50", icon: "💬" },
  { key: "requests", href: "/more/requests", label: "الطلبات والموافقات", tint: "bg-green-50", icon: "✅" },
  { key: "reports", href: "/more/reports", label: "التقارير والأداء", tint: "bg-brand-blue-50", icon: "📈" },
  { key: "profile", href: "/more/profile", label: "الملف الشخصي", tint: "bg-accent-50", icon: "👤" },
  { key: "settings", href: "/more/settings", label: "الإعدادات", tint: "bg-background", icon: "⚙️" },
];

export default function MoreScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  const isManagerRole = profile?.role !== "employee";

  return (
    <View className="flex-1 bg-background">
      <MobileHeader title="المزيد" />
      <View className="flex-row flex-wrap gap-3 px-4 pb-6">
        {ITEMS.filter((item) => !item.managerOnly || isManagerRole).map((item) => (
          <TouchableOpacity
            key={item.key}
            onPress={() => router.push(item.href)}
            style={{ width: "31%" }}
            className="items-center gap-2 rounded-[16px] bg-surface p-4 shadow"
          >
            <View className={`h-11 w-11 items-center justify-center rounded-[13px] ${item.tint}`}>
              <Text className="text-[20px]">{item.icon}</Text>
            </View>
            <Text className="text-center text-[11.5px] font-bold text-foreground">{item.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}
