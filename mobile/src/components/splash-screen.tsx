import { Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { GRADIENT_PRIMARY } from "@/lib/mobile-theme";

const FEATURE_ICONS = ["📋", "📄", "👥"];

/**
 * Branded loading screen shown while auth state is still resolving
 * (AuthGate's `loading`) and during the one-time RTL-reload flash
 * (_layout.tsx) - replaces the old bare ActivityIndicator in both spots
 * with the same screen, matching the mockup's splash design.
 *
 * Layout-critical flex/centering goes through `style`, not `className` -
 * nativewind's className interop isn't registered for third-party
 * components like expo-linear-gradient's LinearGradient here, so a
 * className-only layout silently falls back to RN's stretch/RTL-start
 * default instead of actually centering.
 */
export function SplashScreen() {
  const insets = useSafeAreaInsets();

  return (
    <LinearGradient
      colors={GRADIENT_PRIMARY}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{
        flex: 1,
        paddingTop: insets.top,
        paddingBottom: insets.bottom,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 32,
      }}
    >
      <View style={{ width: 88, height: 88, alignItems: "center", justifyContent: "center" }}>
        <View
          style={{
            position: "absolute",
            width: 60,
            height: 60,
            borderRadius: 18,
            backgroundColor: "rgba(255,255,255,0.3)",
            transform: [{ rotate: "45deg" }, { translateX: -8 }],
          }}
        />
        <View
          style={{
            position: "absolute",
            width: 60,
            height: 60,
            borderRadius: 18,
            backgroundColor: "rgba(255,255,255,0.95)",
            transform: [{ rotate: "12deg" }, { translateX: 8 }],
          }}
        />
      </View>

      <Text className="mt-7 text-[26px] font-black tracking-wide text-white">MONJEZ</Text>
      <Text className="mt-2 text-center text-[13.5px] font-semibold text-white/85">
        منجز كل أعمالك في مكان واحد
      </Text>

      <View style={{ flexDirection: "row", gap: 16, marginTop: 40 }}>
        {FEATURE_ICONS.map((icon, i) => (
          <View
            key={i}
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              backgroundColor: "rgba(255,255,255,0.2)",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text className="text-[18px]">{icon}</Text>
          </View>
        ))}
      </View>

      <View style={{ position: "absolute", bottom: 56, flexDirection: "row", gap: 6 }}>
        <View style={{ height: 6, width: 20, borderRadius: 3, backgroundColor: "#fff" }} />
        <View style={{ height: 6, width: 6, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.4)" }} />
        <View style={{ height: 6, width: 6, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.4)" }} />
      </View>
    </LinearGradient>
  );
}
