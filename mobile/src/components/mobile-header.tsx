import { useRouter } from "expo-router";
import { Text, TouchableOpacity, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BackIcon } from "@/components/tab-icons";
import { GRADIENT_PRIMARY } from "@/lib/mobile-theme";

function BackButton({ light }: { light?: boolean }) {
  const router = useRouter();
  return (
    <TouchableOpacity
      onPress={() => router.back()}
      className={`h-8 w-8 items-center justify-center rounded-full ${light ? "bg-white/15" : "bg-background"}`}
    >
      <BackIcon color={light ? "#fff" : "#1a202c"} />
    </TouchableOpacity>
  );
}

/**
 * Same two variants as the web app's mobile-header.tsx. Both add
 * insets.top explicitly (rather than a fixed pt-*) - these screens sit
 * directly under the status bar with no navigator header of their own
 * (headerShown: false), so nothing else accounts for that inset, and a
 * fixed value renders too short/overlapping on edge-to-edge Android.
 */
export function MobileHeader({
  title,
  subtitle,
  back,
  gradient,
  chips,
  action,
}: {
  title: string;
  subtitle?: string;
  back?: boolean;
  gradient?: boolean;
  chips?: React.ReactNode;
  action?: React.ReactNode;
}) {
  const insets = useSafeAreaInsets();

  if (gradient) {
    return (
      <LinearGradient
        colors={GRADIENT_PRIMARY}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        // Layout-critical spacing goes through `style`, not `className` -
        // see splash-screen.tsx's own note on why LinearGradient's
        // className interop can't be relied on for this.
        style={{ paddingTop: insets.top + 12, paddingBottom: 16, paddingHorizontal: 16 }}
      >
        <View className="mb-3 flex-row items-center gap-2.5">
          {back && <BackButton light />}
          {subtitle && <Text className="text-[13px] font-bold text-white/90">{subtitle}</Text>}
        </View>
        <Text className="text-[17px] font-extrabold leading-snug text-white">{title}</Text>
        {chips && <View className="mt-2.5 flex-row flex-wrap gap-2">{chips}</View>}
      </LinearGradient>
    );
  }

  return (
    <View className="bg-background px-4 pb-2.5" style={{ paddingTop: insets.top + 12 }}>
      <View className="flex-row items-center justify-between gap-2.5">
        <View className="flex-row items-center gap-2.5">
          {back && <BackButton />}
          <Text className="text-[20px] font-extrabold text-foreground">{title}</Text>
        </View>
        {action}
      </View>
      {subtitle && <Text className="mt-1 text-[12.5px] font-medium text-muted">{subtitle}</Text>}
    </View>
  );
}
