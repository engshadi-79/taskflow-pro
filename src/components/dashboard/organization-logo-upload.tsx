"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  removeOrganizationLogo,
  uploadOrganizationLogo,
  type LogoUploadState,
} from "@/lib/actions/organization-settings";
import { CameraIcon, XCircleIcon } from "@/components/shared/icons";

const MAX_BYTES = 3 * 1024 * 1024;

export function OrganizationLogoUpload({
  logoUrl,
  orgName,
}: {
  logoUrl: string | null;
  orgName: string;
}) {
  const [state, formAction, pending] = useActionState<LogoUploadState, FormData>(uploadOrganizationLogo, {});
  const [preview, setPreview] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (!preview) return;
    if (!pending) {
      const id = setTimeout(() => URL.revokeObjectURL(preview), 300);
      return () => clearTimeout(id);
    }
  }, [pending, preview]);

  useEffect(() => {
    if (state.url) router.refresh();
  }, [state.url, router]);

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setLocalError(null);

    if (!file.type.startsWith("image/")) {
      setLocalError("اختر ملف صورة صالح");
      e.target.value = "";
      return;
    }
    if (file.size > MAX_BYTES) {
      setLocalError("حجم الشعار يجب ألا يتجاوز 3 ميجابايت");
      e.target.value = "";
      return;
    }

    setPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
    formRef.current?.requestSubmit();
  }

  const shown = state.error ? logoUrl : preview ?? state.url ?? logoUrl;
  const error = localError ?? state.error;

  return (
    <div className="w-fit">
      <div className="relative">
        {shown ? (
          <img
            src={shown}
            alt={orgName}
            width={84}
            height={84}
            className={`h-[84px] w-[84px] shrink-0 rounded-2xl border border-border object-cover ${pending ? "opacity-60" : ""}`}
          />
        ) : (
          <span
            className={`flex h-[84px] w-[84px] shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-accent-500 to-purple-500 text-[28px] font-extrabold text-white ${pending ? "opacity-60" : ""}`}
          >
            {orgName.trim().slice(0, 1)}
          </span>
        )}

        <form ref={formRef} action={formAction}>
          <input
            ref={inputRef}
            type="file"
            name="logo"
            accept="image/jpeg,image/png,image/webp,image/svg+xml"
            onChange={onPick}
            disabled={pending}
            className="sr-only"
            aria-label="تغيير شعار المؤسسة"
          />
        </form>

        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={pending}
          title="تغيير الشعار"
          aria-label="تغيير الشعار"
          className="absolute -bottom-1 -end-1 flex h-8 w-8 items-center justify-center rounded-full border-2 border-surface bg-accent-600 text-white shadow-md transition-colors hover:bg-accent-700 disabled:opacity-60"
        >
          <CameraIcon className="h-4 w-4" />
        </button>

        {shown && !pending && (
          <button
            type="button"
            onClick={async () => {
              setPreview(null);
              setLocalError(null);
              const result = await removeOrganizationLogo();
              if (result.error) setLocalError(result.error);
              router.refresh();
            }}
            title="إزالة الشعار"
            aria-label="إزالة الشعار"
            className="absolute -top-1 -start-1 flex h-6 w-6 items-center justify-center rounded-full border-2 border-surface bg-brand-red-500 text-white shadow-md hover:bg-brand-red-600"
          >
            <XCircleIcon className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {pending && <p className="mt-2 text-[11px] font-medium text-muted">جارٍ الرفع...</p>}
      {error && (
        <p className="mt-2 text-[11px] font-bold text-brand-red-500" role="alert">
          {error}
        </p>
      )}
      {!error && !pending && <p className="mt-2 text-[11px] text-faint">الحد الأقصى لحجم الشعار: 3 ميجابايت</p>}
    </div>
  );
}
