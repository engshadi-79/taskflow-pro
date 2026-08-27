function base(children: React.ReactNode) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className="h-6 w-6">
      {children}
    </svg>
  );
}

export const KanbanIcon = () =>
  base(
    <>
      <rect x="3" y="4" width="6" height="16" rx="1.5" />
      <rect x="9" y="4" width="6" height="10" rx="1.5" />
      <rect x="15" y="4" width="6" height="13" rx="1.5" />
    </>
  );

export const ChartIcon = () =>
  base(
    <>
      <path strokeLinecap="round" d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
    </>
  );

export const ShieldIcon = () =>
  base(
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3Z"
    />
  );

export const BellIcon = () =>
  base(
    <>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 8a6 6 0 1 1 12 0c0 3.5 1.5 5.5 1.5 6.5H4.5C4.5 13.5 6 11.5 6 8Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.5 17.5a2.5 2.5 0 0 0 5 0" />
    </>
  );

export const DownloadIcon = () =>
  base(
    <>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v12m0 0 4-4m-4 4-4-4" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
    </>
  );

export const MoonIcon = () =>
  base(<path strokeLinecap="round" strokeLinejoin="round" d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5Z" />);

export const SparklesIcon = () =>
  base(
    <>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v4M12 17v4M3 12h4M17 12h4" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8a4 4 0 0 0 4 4 4 4 0 0 0-4 4 4 4 0 0 0-4-4 4 4 0 0 0 4-4Z" />
    </>
  );

export const ZapIcon = () =>
  base(<path strokeLinecap="round" strokeLinejoin="round" d="M13 3 4 14h6l-1 7 9-11h-6l1-7Z" />);

export const PhoneIcon = () =>
  base(
    <>
      <rect x="7" y="2.5" width="10" height="19" rx="2.5" />
      <path strokeLinecap="round" d="M11 18.5h2" />
    </>
  );

export const PlugIcon = () =>
  base(
    <>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 3v5M15 3v5M7 8h10v3a5 5 0 0 1-10 0V8Z" />
      <path strokeLinecap="round" d="M12 16v5" />
    </>
  );

export const UserPlusIcon = () =>
  base(
    <>
      <circle cx="9" cy="8" r="3.5" />
      <path strokeLinecap="round" d="M3 20c0-3.5 2.7-6 6-6s6 2.5 6 6" />
      <path strokeLinecap="round" d="M18 8v6M15 11h6" />
    </>
  );

export const CheckIcon = () =>
  base(<path strokeLinecap="round" strokeLinejoin="round" d="m4 12 5 5L20 6" />);
