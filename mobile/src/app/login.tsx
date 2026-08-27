import { useState } from "react";
import { ActivityIndicator, Alert, Text, TextInput, TouchableOpacity, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Path } from "react-native-svg";
import { useAuth } from "@/lib/auth-context";
import { GRADIENT_PRIMARY } from "@/lib/mobile-theme";

function GoogleMark() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24">
      <Path
        fill="#4285F4"
        d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.47a5.53 5.53 0 0 1-2.4 3.63v3h3.88c2.27-2.09 3.57-5.17 3.57-8.82Z"
      />
      <Path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.07 7.95-2.91l-3.88-3c-1.08.72-2.46 1.15-4.07 1.15-3.13 0-5.78-2.11-6.73-4.95H1.26v3.1A12 12 0 0 0 12 24Z"
      />
      <Path fill="#FBBC05" d="M5.27 14.29a7.2 7.2 0 0 1 0-4.58v-3.1H1.26a12 12 0 0 0 0 10.78l4.01-3.1Z" />
      <Path
        fill="#EA4335"
        d="M12 4.75c1.76 0 3.34.6 4.58 1.79l3.44-3.44C17.95 1.19 15.24 0 12 0 7.31 0 3.25 2.69 1.26 6.61l4.01 3.1C6.22 6.86 8.87 4.75 12 4.75Z"
      />
    </Svg>
  );
}

// Google sign-in and mobile self-signup aren't wired yet (the web app's
// OAuth deep-link handshake needs its own phase) - shown for visual parity
// with the mockup, with an honest "not yet" instead of a silently dead tap.
function notYetAvailable() {
  Alert.alert("قريبًا", "هذه الميزة غير متاحة من التطبيق بعد - استخدم الموقع الإلكتروني حاليًا.");
}

export default function LoginScreen() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (!email || !password) return;
    setPending(true);
    setError(null);
    const result = await signIn(email.trim(), password);
    setPending(false);
    if (result.error) setError(result.error);
    // On success, AuthGate's session listener handles the redirect.
  }

  return (
    <View className="flex-1 bg-surface px-6 pt-16">
      <View className="mb-8 flex-row items-center justify-between">
        <View className="flex-row items-center gap-2.5">
          <LinearGradient
            colors={GRADIENT_PRIMARY}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ width: 34, height: 34, borderRadius: 10 }}
            className="items-center justify-center"
          >
            <Text className="text-[15px] font-black text-white">م</Text>
          </LinearGradient>
          <Text className="text-[16px] font-black text-foreground">MONJEZ</Text>
        </View>
        <TouchableOpacity onPress={notYetAvailable} className="rounded-full border border-border px-3 py-1.5">
          <Text className="text-[11.5px] font-bold text-muted">العربية ⌄</Text>
        </TouchableOpacity>
      </View>

      <Text className="text-[22px] font-black text-foreground">مرحبًا بك في منجز</Text>
      <Text className="mt-1.5 text-[13.5px] font-semibold text-muted">سجّل دخولك لبدء رحلتك الإنتاجية</Text>

      <TouchableOpacity
        onPress={notYetAvailable}
        className="mt-7 flex-row items-center justify-center gap-2.5 rounded-[12px] border border-border bg-surface py-3.5"
      >
        <GoogleMark />
        <Text className="text-[13.5px] font-bold text-foreground">الدخول باستخدام Google</Text>
      </TouchableOpacity>

      <View className="my-5 flex-row items-center gap-3">
        <View className="h-px flex-1 bg-border" />
        <Text className="text-[11.5px] font-bold text-faint">أو</Text>
        <View className="h-px flex-1 bg-border" />
      </View>

      <View className="gap-4">
        <View>
          <Text className="mb-1.5 text-[12.5px] font-bold text-foreground">البريد الإلكتروني</Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            placeholderTextColor="#94a3b8"
            autoCapitalize="none"
            keyboardType="email-address"
            className="rounded-[12px] border border-border bg-background px-4 py-3.5 text-[14px] text-foreground"
          />
        </View>

        <View>
          <View className="mb-1.5 flex-row items-center justify-between">
            <Text numberOfLines={1} className="shrink-0 text-[12.5px] font-bold text-foreground">
              كلمة المرور
            </Text>
            <TouchableOpacity onPress={notYetAvailable}>
              <Text numberOfLines={1} className="shrink-0 text-[11.5px] font-bold text-accent-600">
                نسيت كلمة المرور؟
              </Text>
            </TouchableOpacity>
          </View>
          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            placeholderTextColor="#94a3b8"
            secureTextEntry
            className="rounded-[12px] border border-border bg-background px-4 py-3.5 text-[14px] text-foreground"
          />
        </View>

        {error && <Text className="text-center text-[12.5px] font-semibold text-brand-red-600">{error}</Text>}

        <TouchableOpacity
          onPress={handleSubmit}
          disabled={pending}
          className="mt-1 items-center rounded-[12px] bg-accent-500 py-4 disabled:opacity-60"
        >
          {pending ? <ActivityIndicator color="#fff" /> : <Text className="text-[14.5px] font-extrabold text-white">تسجيل الدخول</Text>}
        </TouchableOpacity>
      </View>

      <View className="mt-6 flex-row items-center justify-center gap-1.5">
        <Text className="text-[12.5px] font-semibold text-muted">ليس لديك حساب؟</Text>
        <TouchableOpacity onPress={notYetAvailable}>
          <Text className="text-[12.5px] font-extrabold text-accent-600">إنشاء حساب</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
