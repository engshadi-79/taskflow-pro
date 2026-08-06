"use client";

import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";

/** `unsupported` is folded in so callers branch on one value, not two. */
export type SystemNotificationPermission =
  | "unsupported"
  | "default"
  | "granted"
  | "denied";

export type SystemNotificationPrefs = {
  /** Master switch, separate from the in-app notification list. */
  enabled: boolean;
  /** Suppress OS toasts while the tab is focused, to avoid double-notifying. */
  onlyWhenHidden: boolean;
  /** Play a short chime alongside the toast. */
  sound: boolean;
};

export type ShowNotificationInput = {
  body?: string;
  icon?: string;
  /** Same tag replaces an existing toast instead of stacking a duplicate. */
  tag?: string;
  /** In-app path to open when the toast is clicked. */
  url?: string;
  sound?: boolean;
  /** Show even while the tab is focused, ignoring `onlyWhenHidden`. */
  force?: boolean;
};

/** Why a call did or did not surface a toast — easier to act on than a boolean. */
export type ShowNotificationResult =
  | "shown"
  | "unsupported"
  | "disabled"
  | "denied"
  | "permission-not-granted"
  | "suppressed-tab-focused"
  | "failed";

export const DEFAULT_PREFS: SystemNotificationPrefs = {
  // On by default for every user. The browser's own permission prompt is
  // the real gate here - flipping this to true does not, and cannot, skip
  // it. See requestPermissionOnFirstInteraction below.
  enabled: true,
  onlyWhenHidden: true,
  sound: true,
};

const PREFS_KEY = "monjez:system-notifications";
const PREFS_EVENT = "monjez:system-notifications-changed";
const PERMISSION_EVENT = "monjez:notification-permission-changed";
const AUTO_PROMPT_KEY = "monjez:notification-auto-prompted";
const DEFAULT_ICON = "/icon-notification.svg";

/* ---------------------------------------------------------------- prefs store */

// useSyncExternalStore requires a referentially stable snapshot, so the parsed
// object is cached and only rebuilt when it actually changes.
let prefsCache: SystemNotificationPrefs | null = null;

function readPrefs(): SystemNotificationPrefs {
  if (prefsCache) return prefsCache;
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    const parsed = raw ? (JSON.parse(raw) as Partial<SystemNotificationPrefs>) : null;
    prefsCache =
      parsed && typeof parsed === "object"
        ? { ...DEFAULT_PREFS, ...parsed }
        : DEFAULT_PREFS;
  } catch {
    prefsCache = DEFAULT_PREFS;
  }
  return prefsCache;
}

function writePrefs(patch: Partial<SystemNotificationPrefs>) {
  const next = { ...readPrefs(), ...patch };
  prefsCache = next;
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(next));
  } catch {
    // storage disabled: the change still applies for this page
  }
  window.dispatchEvent(new Event(PREFS_EVENT));
}

function subscribePrefs(onChange: () => void) {
  function onStorage(e: StorageEvent) {
    if (e.key !== PREFS_KEY) return;
    prefsCache = null; // another tab wrote: re-read on next snapshot
    onChange();
  }
  window.addEventListener(PREFS_EVENT, onChange);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(PREFS_EVENT, onChange);
    window.removeEventListener("storage", onStorage);
  };
}

function getServerPrefs() {
  return DEFAULT_PREFS;
}

/* ----------------------------------------------------------- permission store */

function subscribePermission(onChange: () => void) {
  window.addEventListener(PERMISSION_EVENT, onChange);
  return () => window.removeEventListener(PERMISSION_EVENT, onChange);
}

function getPermission(): SystemNotificationPermission {
  if (!("Notification" in window)) return "unsupported";
  return window.Notification.permission;
}

function getServerPermission(): SystemNotificationPermission {
  return "default";
}

/**
 * Browsers refuse to grant Notification permission without a user gesture -
 * some auto-deny a request fired on page load outright, and a denial cannot
 * be undone from code afterward. So "enabled by default for every user"
 * cannot mean "silently start showing toasts": it means asking at the
 * earliest gesture the browser will honour, which is the user's first
 * click/keypress after landing in the dashboard, rather than making them
 * dig into Settings to flip a switch first.
 *
 * Fires at most once per browser (localStorage-gated), and the listener
 * itself is a module-level singleton so mounting this hook in several
 * components at once - the bell and the settings dialog both use it - never
 * attaches it twice.
 */
let autoPromptArmed = false;

function armAutoPromptOnFirstInteraction() {
  if (autoPromptArmed) return;
  if (!("Notification" in window)) return;
  if (window.Notification.permission !== "default") return;
  if (!readPrefs().enabled) return; // user already turned it off explicitly

  try {
    if (localStorage.getItem(AUTO_PROMPT_KEY)) return;
  } catch {
    // storage unavailable: fall through and arm anyway, best-effort
  }

  autoPromptArmed = true;

  async function onFirstInteraction() {
    document.removeEventListener("pointerdown", onFirstInteraction, true);
    document.removeEventListener("keydown", onFirstInteraction, true);
    try {
      localStorage.setItem(AUTO_PROMPT_KEY, "1");
    } catch {
      // best-effort: worst case this fires again next visit
    }
    if (window.Notification.permission === "default") {
      await window.Notification.requestPermission();
      window.dispatchEvent(new Event(PERMISSION_EVENT));
    }
  }

  document.addEventListener("pointerdown", onFirstInteraction, {
    once: true,
    capture: true,
  });
  document.addEventListener("keydown", onFirstInteraction, {
    once: true,
    capture: true,
  });
}

/* ------------------------------------------------------------------- chime */

function playChime() {
  try {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctor) return;

    const ctx = new Ctor();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const t = ctx.currentTime;

    osc.type = "sine";
    osc.frequency.setValueAtTime(880, t);
    osc.frequency.exponentialRampToValueAtTime(1320, t + 0.12);
    // ramp instead of a hard start/stop, which would click
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.07, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.24);

    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.25);
    osc.onended = () => void ctx.close();
  } catch {
    // autoplay policy or no audio device: the toast still shows
  }
}

/* -------------------------------------------------------------------- hook */

export function useSystemNotifications({
  onOpen,
  defaultIcon = DEFAULT_ICON,
}: {
  /** Preferred over a full page load, e.g. Next's router.push. */
  onOpen?: (url: string) => void;
  defaultIcon?: string;
} = {}) {
  const prefs = useSyncExternalStore(subscribePrefs, readPrefs, getServerPrefs);
  const permission = useSyncExternalStore(
    subscribePermission,
    getPermission,
    getServerPermission
  );

  const supported = permission !== "unsupported";

  // Both call sites (the topbar bell and the settings dialog) only ever
  // mount inside the authenticated dashboard, so arming here is exactly
  // "the first interaction after opening the site" for a signed-in user -
  // it never runs on the public landing or login pages, which don't use
  // this hook at all.
  useEffect(() => {
    armAutoPromptOnFirstInteraction();
  }, []);

  /**
   * Must be called from a user gesture. Chrome ignores (and some browsers
   * auto-deny) permission prompts raised on load, and a prompt the user did
   * not ask for is the fastest way to a permanent block.
   */
  const requestPermission = useCallback(async (): Promise<SystemNotificationPermission> => {
    if (!("Notification" in window)) return "unsupported";
    try {
      const result = await window.Notification.requestPermission();
      window.dispatchEvent(new Event(PERMISSION_EVENT));
      return result;
    } catch {
      window.dispatchEvent(new Event(PERMISSION_EVENT));
      return getPermission();
    }
  }, []);

  const showNotification = useCallback(
    (title: string, input: ShowNotificationInput = {}): ShowNotificationResult => {
      if (!("Notification" in window)) return "unsupported";
      if (!readPrefs().enabled) return "disabled";

      const current = window.Notification.permission;
      if (current === "denied") return "denied";
      if (current !== "granted") return "permission-not-granted";

      // A hidden tab always gets the toast; that is the whole point of it.
      const hidden = document.visibilityState === "hidden";
      if (!hidden && readPrefs().onlyWhenHidden && !input.force) {
        return "suppressed-tab-focused";
      }

      try {
        const toast = new window.Notification(title, {
          body: input.body,
          icon: input.icon ?? defaultIcon,
          tag: input.tag,
          lang: "ar",
          dir: "rtl",
        });

        toast.onclick = () => {
          toast.close();
          window.focus();
          const url = input.url;
          if (!url) return;
          if (onOpen) onOpen(url);
          else window.location.assign(url);
        };

        if (input.sound ?? readPrefs().sound) playChime();
        return "shown";
      } catch {
        return "failed";
      }
    },
    [defaultIcon, onOpen]
  );

  /**
   * Turning the switch on asks for permission first and only commits when it
   * is granted, so the UI never claims to be on while the browser blocks it.
   */
  const setEnabled = useCallback(
    async (next: boolean): Promise<SystemNotificationPermission> => {
      if (!next) {
        writePrefs({ enabled: false });
        return getPermission();
      }
      if (!("Notification" in window)) return "unsupported";

      let state = window.Notification.permission as SystemNotificationPermission;
      if (state === "default") state = await requestPermission();

      writePrefs({ enabled: state === "granted" });
      return state;
    },
    [requestPermission]
  );

  const setOnlyWhenHidden = useCallback((next: boolean) => {
    writePrefs({ onlyWhenHidden: next });
  }, []);

  const setSound = useCallback((next: boolean) => {
    writePrefs({ sound: next });
  }, []);

  return useMemo(
    () => ({
      supported,
      permission,
      prefs,
      /** True only when a toast could actually be raised right now. */
      active: supported && prefs.enabled && permission === "granted",
      requestPermission,
      showNotification,
      setEnabled,
      setOnlyWhenHidden,
      setSound,
    }),
    [
      supported,
      permission,
      prefs,
      requestPermission,
      showNotification,
      setEnabled,
      setOnlyWhenHidden,
      setSound,
    ]
  );
}
