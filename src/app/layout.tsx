import type { Metadata } from "next";
import { Noto_Kufi_Arabic } from "next/font/google";
import "./globals.css";

// The ACAS portal uses Noto Kufi Arabic throughout, for headings and body alike.
const notoKufi = Noto_Kufi_Arabic({
  variable: "--font-body",
  weight: ["400", "500", "600", "700", "800", "900"],
  subsets: ["arabic", "latin"],
});

export const metadata: Metadata = {
  title: "منجز",
  description: "نظام إدارة مهام الموظفين",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="ar"
      dir="rtl"
      className={`${notoKufi.variable} h-full antialiased`}
      // the boot script below adds `dark` before hydration, which React would
      // otherwise report as a server/client attribute mismatch
      suppressHydrationWarning
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            // 'system' follows the OS preference; anything else (including no
            // stored value) keeps the existing light default.
            __html: `try {
              var t = localStorage.getItem('theme');
              var dark = t === 'dark' || (t === 'system' &&
                window.matchMedia('(prefers-color-scheme: dark)').matches);
              if (dark) document.documentElement.classList.add('dark');
            } catch (e) {}`,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col bg-background text-foreground font-body">
        {children}
      </body>
    </html>
  );
}
