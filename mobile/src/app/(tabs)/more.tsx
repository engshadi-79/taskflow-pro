import { Text, View } from "react-native";
import { MobileHeader } from "@/components/mobile-header";

export default function MoreScreen() {
  return (
    <View className="flex-1 bg-background">
      <MobileHeader title="المزيد" />
      <View className="flex-1 items-center justify-center px-6">
        <Text className="text-center text-[13px] text-muted">قريبًا — قيد التطوير في المرحلة القادمة</Text>
      </View>
    </View>
  );
}
