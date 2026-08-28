import { useEffect, useState } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { MobileHeader } from "@/components/mobile-header";
import { BellIcon } from "@/components/tab-icons";
import { useAuth } from "@/lib/auth-context";
import { checkPushStatus, disablePush, enablePush, type PushStatus } from "@/lib/push-registration";

export default function SettingsScreen() {
  const { profile, signOut } = useAuth();
  const [status, setStatus] = useState<PushStatus>("checking");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    checkPushStatus().then(setStatus);
  }, []);

  async function toggle() {
    if (!profile || pending) return;
    setPending(true);
    setError(null);
    const result = status === "on" ? await disablePush() : await enablePush(profile.id, profile.organization_id);
    if (result.error) {
      setError(result.error);
    } else {
      setStatus(status === "on" ? "off" : "on");
    }
    setPending(false);
  }

  const on = status === "on";

  return (
    <View className="flex-1 bg-background">
      <MobileHeader title="الإعدادات" back />
      <View className="gap-3 px-4 pb-6">
        <View className="flex-row items-center gap-3 rounded-[14px] bg-surface p-3.5 shadow">
          <View className="h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[10px] bg-accent-50">
            <BellIcon color="#4f46e5" size={16} />
          </View>
          <View className="flex-1">
            <Text className="text-[13px] font-bold text-foreground">تنبيهات فورية على الجوال</Text>
            <Text className="mt-0.5 text-[11px] font-semibold text-faint">تصلك حتى لو التطبيق مقفول</Text>
            {error && <Text className="mt-1 text-[11px] font-semibold text-brand-red-600">{error}</Text>}
          </View>
          <TouchableOpacity
            onPress={toggle}
            disabled={pending || status === "checking"}
            className="h-[23px] w-10 shrink-0 flex-row items-center rounded-full px-0.5"
            style={{
              backgroundColor: on ? "#4f46e5" : "#e2e8f0",
              opacity: pending || status === "checking" ? 0.6 : 1,
              justifyContent: on ? "flex-end" : "flex-start",
            }}
          >
            <View className="h-[19px] w-[19px] rounded-full bg-white" />
          </TouchableOpacity>
        </View>

        <TouchableOpacity onPress={signOut} className="items-center rounded-[14px] bg-surface p-3.5 shadow">
          <Text className="text-[13px] font-bold text-brand-red-600">تسجيل الخروج</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
