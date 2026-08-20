import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { Platform } from "react-native";
import { supabase } from "@/lib/supabase";

export type PushStatus = "checking" | "off" | "on";

async function ensureAndroidChannel() {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync("default", {
    name: "الإشعارات",
    importance: Notifications.AndroidImportance.MAX,
  });
}

async function getExpoPushToken(): Promise<string | null> {
  const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
  if (!projectId) return null;
  try {
    const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
    return data;
  } catch {
    return null;
  }
}

export async function checkPushStatus(): Promise<PushStatus> {
  const { status: permission } = await Notifications.getPermissionsAsync();
  if (permission !== "granted") return "off";
  const token = await getExpoPushToken();
  if (!token) return "off";
  const { data } = await supabase.from("expo_push_tokens").select("id").eq("token", token).maybeSingle();
  return data ? "on" : "off";
}

export async function enablePush(userId: string, organizationId: string): Promise<{ error?: string }> {
  const { status: existing } = await Notifications.getPermissionsAsync();
  const permission = existing === "granted" ? existing : (await Notifications.requestPermissionsAsync()).status;
  if (permission !== "granted") return { error: "لم يتم منح إذن الإشعارات" };

  await ensureAndroidChannel();
  const token = await getExpoPushToken();
  if (!token) return { error: "تعذر الحصول على رمز الجهاز" };

  const { error } = await supabase
    .from("expo_push_tokens")
    .upsert({ organization_id: organizationId, user_id: userId, token }, { onConflict: "token" });
  return error ? { error: "تعذر تفعيل الإشعارات" } : {};
}

export async function disablePush(): Promise<{ error?: string }> {
  const token = await getExpoPushToken();
  if (!token) return {};
  const { error } = await supabase.from("expo_push_tokens").delete().eq("token", token);
  return error ? { error: "تعذر إلغاء تفعيل الإشعارات" } : {};
}
