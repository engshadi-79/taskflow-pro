import "react-native-url-polyfill/auto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";

// Same Supabase project as the web app (src/lib/supabase/*) - same tables,
// same RLS policies, same auth users. Session persists in AsyncStorage
// instead of cookies since there's no server/browser boundary here.
const supabaseUrl = "https://cmxlkfjkqsficzbcjbfd.supabase.co";
const supabaseAnonKey = "sb_publishable_4jtQbAxfWAXVaIpt638NDg_BbuXqanA";

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
