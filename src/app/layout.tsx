import type { Metadata } from "next";
import { Cairo, Tajawal } from "next/font/google";
import "./globals.css";

const cairo = Cairo({
  variable: "--font-display",
  weight: ["600", "700", "800", "900"],
  subsets: ["arabic", "latin"],
});

const tajawal = Tajawal({
  variable: "--font-body",
  weight: ["300", "400", "500", "700", "800"],
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
      className={`${cairo.variable} ${tajawal.variable} h-full antialiased`}
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `try {
              if (localStorage.getItem('theme') === 'dark') {
                document.documentElement.classList.add('dark');
              }
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
