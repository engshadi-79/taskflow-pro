"use client";

import { useEffect, useRef, useState } from "react";
import { confirmAiAction, rejectAiAction } from "@/lib/actions/ai";
import { CheckIcon, CloseIcon, SendIcon, SparklesIcon, XCircleIcon } from "@/components/shared/icons";

type SuggestionRow = {
  id: string;
  action_type: string;
  summary: string;
  target_id: string;
  status: "pending" | "confirmed" | "rejected";
};

type ChatMessage = {
  id: string;
  role: "user" | "assistant" | "error";
  content: string;
  suggestions?: SuggestionRow[];
};

const MAX_HISTORY_TURNS = 10;

/**
 * Lets a component anywhere else in the dashboard (e.g. a decision card's
 * "اسأل المساعد عن هذا" button) open this panel with a ready-made question,
 * without prop-drilling or a context provider - AiAssistantPanel is mounted
 * once at the dashboard layout level, a sibling of every page's own
 * content, not an ancestor. Same window CustomEvent pattern already used
 * for presence-tracker.tsx -> online-now-widget.tsx.
 */
export const ASK_ASSISTANT_EVENT = "monjez:ai-assistant-ask";

export function AiAssistantPanel() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, sending]);

  // send closes over messages/sending, both of which change on every
  // render - keeping this ref current lets the ASK_ASSISTANT_EVENT
  // listener below (registered once, via an empty deps array so it isn't
  // re-subscribed on every keystroke) always call the *latest* send
  // instead of a stale closure that would keep reading `sending` as
  // whatever it was at mount time forever.
  const sendRef = useRef<(overrideText?: string) => Promise<void>>(async () => {});

  useEffect(() => {
    function onAsk(e: Event) {
      const question = (e as CustomEvent<string>).detail;
      if (!question) return;
      setOpen(true);
      void sendRef.current(question);
    }
    window.addEventListener(ASK_ASSISTANT_EVENT, onAsk);
    return () => window.removeEventListener(ASK_ASSISTANT_EVENT, onAsk);
  }, []);

  async function send(overrideText?: string) {
    const text = (overrideText ?? input).trim();
    if (!text || sending) return;

    const userMsg: ChatMessage = { id: crypto.randomUUID(), role: "user", content: text };
    const history = [...messages, userMsg]
      .filter((m) => m.role === "user" || m.role === "assistant")
      .slice(-MAX_HISTORY_TURNS)
      .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setSending(true);

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, history: history.slice(0, -1) }),
      });
      const data = await res.json();

      if (!res.ok) {
        setMessages((prev) => [
          ...prev,
          { id: crypto.randomUUID(), role: "error", content: data.error ?? "حدث خطأ غير متوقع" },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: "assistant",
            content: data.reply,
            suggestions: data.suggestions ?? [],
          },
        ]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: "error", content: "تعذر الاتصال بالمساعد الذكي" },
      ]);
    } finally {
      setSending(false);
    }
  }

  // Keeps sendRef pointing at the latest send (which closes over
  // messages/sending/input) after every render - writing to a ref during
  // render itself is flagged by react-hooks/refs, an effect with no deps
  // is the sanctioned place for this "always current callback" pattern.
  useEffect(() => {
    sendRef.current = send;
  });

  function updateSuggestion(messageId: string, suggestionId: string, status: "confirmed" | "rejected") {
    setMessages((prev) =>
      prev.map((m) =>
        m.id !== messageId
          ? m
          : { ...m, suggestions: m.suggestions?.map((s) => (s.id === suggestionId ? { ...s, status } : s)) }
      )
    );
  }

  async function handleConfirm(messageId: string, suggestion: SuggestionRow) {
    const result = await confirmAiAction(suggestion.id);
    if (result.error) {
      setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: "error", content: result.error! }]);
      return;
    }
    updateSuggestion(messageId, suggestion.id, "confirmed");
  }

  async function handleReject(messageId: string, suggestion: SuggestionRow) {
    await rejectAiAction(suggestion.id);
    updateSuggestion(messageId, suggestion.id, "rejected");
  }

  return (
    <div ref={wrapRef} className="fixed bottom-5 end-5 z-50">
      {open && (
        <div
          role="dialog"
          aria-label="المساعد الذكي"
          className="mb-3 flex h-[min(70vh,560px)] w-[min(92vw,380px)] flex-col overflow-hidden rounded-[18px] border border-border bg-surface shadow-2xl shadow-black/20"
        >
          <div className="banner-violet flex items-center justify-between gap-3 px-4 py-3.5 text-white">
            <div className="flex items-center gap-2">
              <SparklesIcon className="h-5 w-5" />
              <div>
                <div className="text-[15px] font-black">المساعد الذكي</div>
                <div className="text-[11.5px] font-medium text-white/75">مرتبط ببياناتك وصلاحياتك</div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="إغلاق"
              className="flex h-8 w-8 items-center justify-center rounded-full bg-white/25 text-white transition-colors hover:bg-white/40"
            >
              <CloseIcon className="h-4 w-4" />
            </button>
          </div>

          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
            {messages.length === 0 && (
              <p className="text-[13px] leading-6 text-muted">
                اسألني عن أداء الأقسام، حمل العمل، المهام المعرضة للتأخير، أو اطلب تلخيص اجتماع أو مشروع. لن أُنفّذ أي
                تغيير على بياناتك إلا بعد أن تؤكده بنفسك.
              </p>
            )}

            {messages.map((m) => (
              <div key={m.id} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
                <div className="max-w-[88%] space-y-2">
                  <div
                    className={`whitespace-pre-wrap rounded-[14px] px-3.5 py-2.5 text-[13px] leading-6 ${
                      m.role === "user"
                        ? "bg-accent-600 text-white"
                        : m.role === "error"
                        ? "bg-pink-50 text-pink-600"
                        : "bg-background text-foreground"
                    }`}
                  >
                    {m.content}
                  </div>

                  {m.suggestions?.map((s) => (
                    <div
                      key={s.id}
                      className="rounded-[14px] border border-accent-200 bg-accent-50 px-3.5 py-3 text-[12.5px]"
                    >
                      <p className="font-bold text-accent-700">{s.summary}</p>
                      {s.status === "pending" && (
                        <div className="mt-2.5 flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleConfirm(m.id, s)}
                            className="inline-flex items-center gap-1.5 rounded-full bg-accent-600 px-3 py-1.5 text-[12px] font-extrabold text-white transition-colors hover:bg-accent-700"
                          >
                            <CheckIcon className="h-3.5 w-3.5" />
                            تأكيد
                          </button>
                          <button
                            type="button"
                            onClick={() => handleReject(m.id, s)}
                            className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-[12px] font-extrabold text-muted transition-colors hover:bg-background"
                          >
                            <XCircleIcon className="h-3.5 w-3.5" />
                            تجاهل
                          </button>
                        </div>
                      )}
                      {s.status === "confirmed" && (
                        <p className="mt-2 text-[12px] font-bold text-green-600">تم التنفيذ</p>
                      )}
                      {s.status === "rejected" && <p className="mt-2 text-[12px] font-bold text-muted">تم التجاهل</p>}
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {sending && <p className="text-[12.5px] text-faint">جارٍ التفكير...</p>}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
            className="flex items-center gap-2 border-t border-border p-3"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="اكتب سؤالك..."
              disabled={sending}
              className="flex-1 rounded-full border border-border bg-background px-3.5 py-2 text-[13px] outline-none focus:border-accent-500"
            />
            <button
              type="submit"
              disabled={sending || !input.trim()}
              aria-label="إرسال"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-600 text-white transition-colors hover:bg-accent-700 disabled:opacity-40"
            >
              <SendIcon className="h-4 w-4" />
            </button>
          </form>
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label="المساعد الذكي"
        className="flex h-11 w-11 items-center justify-center rounded-full bg-accent-600 text-white shadow-xl shadow-black/25 transition-transform hover:scale-105"
      >
        {open ? <CloseIcon className="h-4 w-4" /> : <SparklesIcon className="h-5 w-5" />}
      </button>
    </div>
  );
}
