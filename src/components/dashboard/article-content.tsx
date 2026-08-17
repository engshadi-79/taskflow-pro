import { InfoIcon, AlertIcon } from "@/components/shared/icons";
import type { ReactNode } from "react";

const STEP_LINE = /^\d+\)\s*/;

/** "quoted" segments render bold (without the quote marks), matching how every seeded article quotes button/field labels. */
function renderInline(text: string): ReactNode {
  const parts = text.split(/("[^"]+")/g);
  return parts.map((part, i) =>
    part.startsWith('"') && part.endsWith('"') ? (
      <strong key={i} className="font-extrabold text-foreground">
        {part.slice(1, -1)}
      </strong>
    ) : (
      <span key={i}>{part}</span>
    )
  );
}

/**
 * Renders the plain-text article content (whitespace-pre-wrap in the DB)
 * as structured HTML: a block of consecutive "1) ..." lines becomes a
 * numbered step list with circular badges, lines starting with ℹ️/⚠️
 * become colored callout boxes, everything else is a plain paragraph.
 */
export function ArticleContent({ content }: { content: string }) {
  if (!content.trim()) return <p className="text-muted">لا يوجد محتوى</p>;

  const blocks = content.split(/\n\s*\n/);
  let key = 0;
  const nodes: ReactNode[] = [];

  for (const block of blocks) {
    const lines = block.split("\n").filter((l) => l.trim());
    if (lines.length === 0) continue;

    if (lines.every((l) => STEP_LINE.test(l.trim()))) {
      nodes.push(
        <ol key={key++} className="my-4 space-y-3">
          {lines.map((l, i) => (
            <li key={i} className="flex items-start gap-3">
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent-500 text-[12px] font-extrabold text-white">
                {i + 1}
              </span>
              <span className="text-[14.5px] leading-7 text-foreground">
                {renderInline(l.trim().replace(STEP_LINE, ""))}
              </span>
            </li>
          ))}
        </ol>
      );
      continue;
    }

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith("ℹ️")) {
        nodes.push(
          <div
            key={key++}
            className="my-3 flex items-start gap-2.5 rounded-[12px] border border-accent-100 bg-accent-50 px-4 py-3 text-[13.5px] text-accent-700"
          >
            <InfoIcon className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{renderInline(trimmed.replace(/^ℹ️\s*/, ""))}</span>
          </div>
        );
      } else if (trimmed.startsWith("⚠️")) {
        nodes.push(
          <div
            key={key++}
            className="my-3 flex items-start gap-2.5 rounded-[12px] border border-orange-100 bg-orange-50 px-4 py-3 text-[13.5px] text-orange-700"
          >
            <AlertIcon className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{renderInline(trimmed.replace(/^⚠️\s*/, ""))}</span>
          </div>
        );
      } else {
        nodes.push(
          <p key={key++} className="text-[14.5px] leading-7 text-foreground">
            {renderInline(trimmed)}
          </p>
        );
      }
    }
  }

  return <div className="space-y-1">{nodes}</div>;
}
