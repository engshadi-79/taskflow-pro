"use client";

import { ChatIcon } from "@/components/shared/icons";

/** Opens the same floating ChatWidget popup (mounted separately in the layout) instead of navigating to the full page. */
export function ChatQuickAccessButton() {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event("monjez:toggle-chat-widget"))}
      aria-label="المحادثات"
      className="flex h-10 w-10 items-center justify-center rounded-full bg-teal-50 text-teal-600 transition-colors hover:brightness-95"
    >
      <ChatIcon className="h-[19px] w-[19px]" />
    </button>
  );
}
