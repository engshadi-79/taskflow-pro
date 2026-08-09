"use client";

import { useActionState, useState } from "react";
import { updateOwnProfile, type UpdateOwnProfileState } from "@/lib/actions/users";
import { BIO_MAX_LENGTH } from "@/lib/profile-constants";
import { CheckCircleIcon, UserIcon } from "@/components/shared/icons";
import type { Profile } from "@/lib/types/roles";

const inputClass =
  "w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-accent-500 focus:ring-1 focus:ring-accent-500";

const initialState: UpdateOwnProfileState = {};

/**
 * full_name/phone/secondary_email/bio only, for editing your own row -
 * role, department and active status are the admin's call (ProfileEditForm),
 * never this form's.
 */
export function SelfProfileForm({ profile }: { profile: Profile }) {
  const [state, formAction, pending] = useActionState(updateOwnProfile, initialState);
  // only the live character count needs client state; every field's value on
  // submit still comes from the form itself, not this
  const [bioLength, setBioLength] = useState(profile.bio?.length ?? 0);
  const overLimit = bioLength > BIO_MAX_LENGTH;

  return (
    <div className="rounded-[18px] border border-border bg-surface p-6">
      <div className="mb-4 flex items-center gap-2.5">
        <span className="flex h-8 w-8 items-center justify-center rounded-[9px] bg-accent-50 text-accent-600">
          <UserIcon className="h-4 w-4" />
        </span>
        <h2 className="text-sm font-extrabold text-foreground">بياناتي الشخصية</h2>
      </div>

      <form action={formAction} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-foreground">الاسم الكامل</span>
          <input
            name="full_name"
            defaultValue={profile.full_name}
            required
            className={inputClass}
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-foreground">رقم الهاتف</span>
          <input
            name="phone"
            type="tel"
            defaultValue={profile.phone ?? ""}
            placeholder="اختياري"
            className={inputClass}
          />
        </label>
        <label className="block sm:col-span-2">
          <span className="mb-1.5 block text-sm font-medium text-foreground">
            بريد إلكتروني إضافي
          </span>
          <input
            name="secondary_email"
            type="email"
            defaultValue={profile.secondary_email ?? ""}
            placeholder="اختياري — لا يُستخدم لتسجيل الدخول"
            className={inputClass}
          />
        </label>
        <label className="block sm:col-span-2">
          <span className="mb-1.5 flex items-center justify-between text-sm font-medium text-foreground">
            نبذة عني
            <span className={`text-xs font-bold ${overLimit ? "text-red-600" : "text-muted"}`}>
              {bioLength}/{BIO_MAX_LENGTH}
            </span>
          </span>
          <textarea
            name="bio"
            rows={3}
            maxLength={BIO_MAX_LENGTH}
            defaultValue={profile.bio ?? ""}
            onChange={(e) => setBioLength(e.target.value.length)}
            placeholder="اختياري — جملة أو جملتان عنك"
            className={`${inputClass} resize-none`}
          />
        </label>

        <div className="flex items-center gap-3 sm:col-span-2">
          <button
            type="submit"
            disabled={pending}
            className="rounded-[10px] bg-accent-500 px-4 py-2 text-sm font-extrabold text-white hover:bg-accent-600 disabled:opacity-60"
          >
            {pending ? "جارٍ الحفظ..." : "حفظ التعديلات"}
          </button>

          {state.success && (
            <span className="flex items-center gap-1.5 text-sm font-bold text-green-600">
              <CheckCircleIcon className="h-4 w-4" />
              تم الحفظ
            </span>
          )}
          {state.error && (
            <p className="text-sm text-red-600" role="alert">
              {state.error}
            </p>
          )}
        </div>
      </form>
    </div>
  );
}
