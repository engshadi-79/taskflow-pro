import { useState } from "react";
import { ActivityIndicator, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useAuth } from "@/lib/auth-context";

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
    <View className="flex-1 justify-center bg-background px-6">
      <View className="mb-10 items-center">
        <View className="mb-4 h-16 w-16 items-center justify-center rounded-[18px] bg-accent-500">
          <Text className="text-2xl font-black text-white">م</Text>
        </View>
        <Text className="text-xl font-black text-foreground">منجز</Text>
        <Text className="mt-1 text-[13px] font-semibold text-muted">سجّل الدخول للوصول إلى مهامك</Text>
      </View>

      <View className="gap-3">
        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder="البريد الإلكتروني"
          placeholderTextColor="#94a3b8"
          autoCapitalize="none"
          keyboardType="email-address"
          className="rounded-[12px] border border-border bg-surface px-4 py-3.5 text-[14px] text-foreground"
        />
        <TextInput
          value={password}
          onChangeText={setPassword}
          placeholder="كلمة المرور"
          placeholderTextColor="#94a3b8"
          secureTextEntry
          className="rounded-[12px] border border-border bg-surface px-4 py-3.5 text-[14px] text-foreground"
        />

        {error && <Text className="text-center text-[12.5px] font-semibold text-brand-red-600">{error}</Text>}

        <TouchableOpacity
          onPress={handleSubmit}
          disabled={pending}
          className="mt-2 items-center rounded-[12px] bg-accent-500 py-3.5 disabled:opacity-60"
        >
          {pending ? <ActivityIndicator color="#fff" /> : <Text className="text-[14px] font-extrabold text-white">تسجيل الدخول</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );
}
