"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  removeAvatar,
  uploadAvatar,
  type AvatarUploadState,
} from "@/lib/actions/users";
import { Avatar } from "@/components/shared/avatar";
import { CameraIcon, XCircleIcon } from "@/components/shared/icons";

const MAX_BYTES = 3 * 1024 * 1024;

/**
 * Own-profile-only control: the avatar circle with a camera badge that opens
 * a file picker, an instant local preview while the upload runs, and a small
 * remove action once a photo exists. Every other place in the app just
 * renders <Avatar> read-only.
 */
export function AvatarUpload({
  avatarUrl,
  fullName,
}: {
  avatarUrl: string | null;
  fullName: string;
}) {
  const [state, formAction, pending] = useActionState<AvatarUploadState, FormData>(
    uploadAvatar,
    {}
  );
  const [preview, setPreview] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();

  // release the object URL once the real upload result lands, whichever way
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
      setLocalError("حجم الصورة يجب ألا يتجاوز 3 ميجابايت");
      e.target.value = "";
      return;
    }

    setPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
    formRef.current?.requestSubmit();
  }

  // Derived, not stored: once a submission settles as an error, the optimistic
  // preview it produced is no longer trusted, even though the blob URL is
  // still sitting in `preview` until the next pick overwrites it. Showing it
  // next to the error text would claim the upload worked when it didn't, and
  // would offer to remove a photo the server never received.
  const shown = state.error ? avatarUrl : preview ?? state.url ?? avatarUrl;
  const error = localError ?? state.error;

  return (
    <div className="mx-auto mb-3.5 w-fit">
      <div className="relative">
        <Avatar
          src={shown}
          name={fullName}
          size={84}
          gradient="from-accent-500 to-purple-500"
          className={`text-[28px] ${pending ? "opacity-60" : ""}`}
        />

        <form ref={formRef} action={formAction}>
          <input
            ref={inputRef}
            type="file"
            name="avatar"
            accept="image/jpeg,image/png,image/webp"
            onChange={onPick}
            disabled={pending}
            className="sr-only"
            aria-label="تغيير الصورة الشخصية"
          />
        </form>

        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={pending}
          title="تغيير الصورة"
          aria-label="تغيير الصورة"
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
              const result = await removeAvatar();
              if (result.error) setLocalError(result.error);
              router.refresh();
            }}
            title="إزالة الصورة"
            aria-label="إزالة الصورة"
            className="absolute -top-1 -start-1 flex h-6 w-6 items-center justify-center rounded-full border-2 border-surface bg-brand-red-500 text-white shadow-md hover:bg-brand-red-600"
          >
            <XCircleIcon className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {pending && (
        <p className="mt-2 text-center text-[11px] font-medium text-muted">
          جارٍ الرفع...
        </p>
      )}
      {error && (
        <p className="mt-2 text-center text-[11px] font-bold text-brand-red-500" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
