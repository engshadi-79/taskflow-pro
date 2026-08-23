import { WhatsappIcon } from "@/components/shared/icons";

const SUPPORT_WHATSAPP_NUMBER = "970599021025";
const SUPPORT_WHATSAPP_MESSAGE = "مرحبًا، أحتاج مساعدة بخصوص نظام منجز";

/** Site-wide floating support bubble - a plain link, no client-side state
 *  needed, so this stays a server component like the rest of the shell. */
export function WhatsappFloatingButton() {
  const href = `https://wa.me/${SUPPORT_WHATSAPP_NUMBER}?text=${encodeURIComponent(SUPPORT_WHATSAPP_MESSAGE)}`;

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      aria-label="تواصل معنا عبر واتساب"
      title="تواصل معنا عبر واتساب"
      className="fixed bottom-40 end-5 z-30 flex h-11 w-11 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg shadow-black/25 transition-transform hover:scale-110"
    >
      <WhatsappIcon className="h-5 w-5" />
    </a>
  );
}
