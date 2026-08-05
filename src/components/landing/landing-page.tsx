"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import {
  KanbanIcon,
  ChartIcon,
  ShieldIcon,
  BellIcon,
  DownloadIcon,
  MoonIcon,
} from "@/components/landing/icons";

gsap.registerPlugin(ScrollTrigger, useGSAP);

const FEATURES = [
  {
    icon: KanbanIcon,
    color: "accent",
    title: "لوحة كانبان تفاعلية",
    desc: "اسحب مهامك بين الحالات بسحب وإفلات حقيقي يحدّث قاعدة البيانات فورًا.",
  },
  {
    icon: ChartIcon,
    color: "orange",
    title: "تقارير ولوحات بيانات",
    desc: "تتبع الأداء والإنتاجية بأرقام حقيقية محدّثة لحظة بلحظة.",
  },
  {
    icon: ShieldIcon,
    color: "pink",
    title: "صلاحيات دقيقة",
    desc: "كل دور يرى فقط ما يخصه — محمي على مستوى قاعدة البيانات نفسها، لا الواجهة فقط.",
  },
  {
    icon: BellIcon,
    color: "green",
    title: "إشعارات فورية",
    desc: "تنبيهات لحظية عبر Realtime عند كل إسناد أو تحديث على مهامك.",
  },
  {
    icon: DownloadIcon,
    color: "purple",
    title: "تصدير Excel بضغطة",
    desc: "صدّر تقاريرك الكاملة كملف Excel جاهز للمشاركة في ثانية.",
  },
  {
    icon: MoonIcon,
    color: "accent",
    title: "عربي بالكامل، وضع ليلي",
    desc: "واجهة RTL أصيلة من الجذور، مع وضع ليلي مريح للعين عند الحاجة.",
  },
];

const STATS = [
  { value: 3, suffix: "", label: "مستويات صلاحيات" },
  { value: 5, suffix: "", label: "حالات لكل مهمة تتبعها لحظيًا" },
  { value: 100, suffix: "٪", label: "عربي بالكامل — واجهة و RTL" },
  { value: 24, suffix: "/7", label: "وصول فوري من أي جهاز" },
];

const STEPS = [
  { n: "١", title: "أنشئ مهمة", desc: "حدّد العنوان والمسؤول والأولوية والموعد في نموذج واحد بسيط." },
  { n: "٢", title: "تابع التقدم", desc: "عبر لوحة كانبان أو قائمة المهام — كل عضو يرى ما يخصه فقط." },
  { n: "٣", title: "راجع واعتمد", desc: "وافق أو ارفض مع ملاحظات، وتابع كل شيء في تقارير تلقائية." },
];

const colorClasses: Record<string, string> = {
  accent: "bg-accent-50 text-accent-500",
  orange: "bg-orange-50 text-orange-500",
  pink: "bg-pink-50 text-pink-500",
  green: "bg-green-50 text-green-600",
  purple: "bg-purple-50 text-purple-500",
};

export function LandingPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mockupRef = useRef<HTMLDivElement>(null);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();

      mm.add("(prefers-reduced-motion: no-preference)", () => {
        gsap.from(".hero-word", {
          opacity: 0,
          y: 28,
          duration: 0.6,
          stagger: 0.05,
          ease: "power2.out",
        });
        gsap.from(".hero-fade", {
          opacity: 0,
          y: 16,
          duration: 0.5,
          delay: 0.35,
          stagger: 0.1,
          ease: "power2.out",
        });
        gsap.from(".hero-mockup", {
          opacity: 0,
          y: 24,
          scale: 0.96,
          duration: 0.8,
          delay: 0.25,
          ease: "power2.out",
        });

        gsap.utils.toArray<HTMLElement>(".reveal-section").forEach((section) => {
          gsap.from(section.querySelectorAll(".reveal-item"), {
            opacity: 0,
            y: 24,
            duration: 0.5,
            stagger: 0.08,
            ease: "power2.out",
            scrollTrigger: { trigger: section, start: "top 85%" },
          });
        });

        const statEls = gsap.utils.toArray<HTMLElement>(".stat-num");
        const statObserver = new IntersectionObserver(
          (entries) => {
            entries.forEach((entry) => {
              if (!entry.isIntersecting) return;
              const el = entry.target as HTMLElement;
              statObserver.unobserve(el);

              const target = Number(el.dataset.value);
              const suffix = el.dataset.suffix ?? "";
              const obj = { val: 0 };
              gsap.to(obj, {
                val: target,
                duration: 1.3,
                ease: "power2.out",
                onUpdate: () => {
                  el.textContent = Math.round(obj.val).toString() + suffix;
                },
              });
            });
          },
          { threshold: 0.4 }
        );
        statEls.forEach((el) => statObserver.observe(el));

        let handleMove: ((e: MouseEvent) => void) | undefined;
        let handleLeave: (() => void) | undefined;
        const card = mockupRef.current;

        if (card) {
          const xTo = gsap.quickTo(card, "rotateY", { duration: 0.5, ease: "power3.out" });
          const yTo = gsap.quickTo(card, "rotateX", { duration: 0.5, ease: "power3.out" });

          handleMove = (e: MouseEvent) => {
            const r = card.getBoundingClientRect();
            xTo(((e.clientX - r.left - r.width / 2) / r.width) * 14);
            yTo(-((e.clientY - r.top - r.height / 2) / r.height) * 14);
          };
          handleLeave = () => {
            xTo(0);
            yTo(0);
          };
          card.addEventListener("mousemove", handleMove);
          card.addEventListener("mouseleave", handleLeave);
        }

        return () => {
          statObserver.disconnect();
          if (card && handleMove && handleLeave) {
            card.removeEventListener("mousemove", handleMove);
            card.removeEventListener("mouseleave", handleLeave);
          }
        };
      });

      return () => mm.revert();
    },
    { scope: containerRef }
  );

  return (
    <div ref={containerRef} className="min-h-dvh overflow-x-hidden bg-background">
      {/* NAVBAR */}
      <header
        className={`sticky top-0 z-30 transition-colors duration-300 ${
          scrolled ? "bg-surface/80 backdrop-blur-md border-b border-border" : "bg-transparent"
        }`}
      >
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2.5 font-display text-xl font-black text-foreground">
            <span className="flex h-8 w-8 items-center justify-center rounded-[9px] bg-foreground text-sm text-surface">
              م
            </span>
            منجز
          </div>
          <nav className="hidden items-center gap-8 text-sm font-bold text-muted sm:flex">
            <a href="#features" className="hover:text-foreground">المميزات</a>
            <a href="#how" className="hover:text-foreground">كيف يعمل</a>
          </nav>
          <Link
            href="/login"
            className="rounded-full bg-accent-500 px-5 py-3 text-sm font-extrabold text-white transition-transform hover:scale-105 hover:bg-accent-600"
          >
            تسجيل الدخول
          </Link>
        </div>
      </header>

      {/* HERO */}
      <section className="relative overflow-hidden px-6 pb-24 pt-16 sm:pt-24">
        <div
          aria-hidden
          className="animate-blob-1 absolute -top-24 -start-24 h-96 w-96 rounded-full bg-accent-500/25 blur-3xl"
        />
        <div
          aria-hidden
          className="animate-blob-2 absolute top-32 -end-32 h-[28rem] w-[28rem] rounded-full bg-pink-500/20 blur-3xl"
        />
        <div
          aria-hidden
          className="animate-blob-1 absolute bottom-0 start-1/3 h-72 w-72 rounded-full bg-green-500/15 blur-3xl"
        />

        <div className="relative mx-auto max-w-4xl text-center">
          <h1 className="font-display text-4xl font-black leading-tight text-foreground sm:text-6xl">
            {"منجز — حيث تتحوّل".split(" ").map((w, i) => (
              <span key={i} className="hero-word me-3 inline-block">
                {w}
              </span>
            ))}
            <br />
            {"مهامك إلى إنجازات".split(" ").map((w, i) => (
              <span key={i} className="hero-word me-3 inline-block text-accent-500">
                {w}
              </span>
            ))}
          </h1>
          <p className="hero-fade mx-auto mt-6 max-w-xl text-lg text-muted">
            منصة عربية بالكامل لإدارة مهام الفرق — كانبان، تقارير، إشعارات لحظية، وصلاحيات
            محمية من جذور قاعدة البيانات.
          </p>
          <div className="hero-fade mt-9 flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/login"
              className="rounded-full bg-accent-500 px-8 py-3.5 text-[15px] font-extrabold text-white shadow-lg shadow-accent-500/25 transition-transform hover:scale-105 hover:bg-accent-600"
            >
              ابدأ الآن مجانًا
            </Link>
            <a
              href="#features"
              className="rounded-full border border-border bg-surface px-8 py-3.5 text-[15px] font-extrabold text-foreground transition-colors hover:bg-accent-50"
            >
              استكشف المميزات
            </a>
          </div>
        </div>

        {/* decorative dashboard mockup */}
        <div className="relative mx-auto mt-16 max-w-3xl" style={{ perspective: "1200px" }}>
          <div
            ref={mockupRef}
            className="hero-mockup rounded-[22px] border border-border bg-surface p-5 shadow-2xl"
            style={{ transformStyle: "preserve-3d" }}
          >
            <div className="mb-4 flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-pink-500" />
              <span className="h-3 w-3 rounded-full bg-orange-500" />
              <span className="h-3 w-3 rounded-full bg-green-500" />
            </div>
            <div className="grid grid-cols-4 gap-3">
              <div className="col-span-1 rounded-xl bg-gradient-to-br from-accent-500 to-accent-600 p-4 text-white">
                <div className="text-2xl font-black">24</div>
                <div className="mt-1 text-[11px] opacity-90">مهمة منجزة</div>
              </div>
              <div className="col-span-1 rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 p-4 text-white">
                <div className="text-2xl font-black">56</div>
                <div className="mt-1 text-[11px] opacity-90">مهام جديدة</div>
              </div>
              <div className="col-span-1 rounded-xl bg-gradient-to-br from-pink-500 to-pink-600 p-4 text-white">
                <div className="text-2xl font-black">9</div>
                <div className="mt-1 text-[11px] opacity-90">أعضاء نشطون</div>
              </div>
              <div className="col-span-1 rounded-xl bg-gradient-to-br from-green-500 to-green-600 p-4 text-white">
                <div className="text-2xl font-black">78٪</div>
                <div className="mt-1 text-[11px] opacity-90">معدل الإنجاز</div>
              </div>
            </div>
            <div className="mt-3 space-y-2 rounded-xl border border-border p-3">
              {[
                { w: "70%", c: "bg-accent-500" },
                { w: "45%", c: "bg-purple-500" },
                { w: "85%", c: "bg-green-500" },
              ].map((row, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-border">
                    <div className={`h-full rounded-full ${row.c}`} style={{ width: row.w }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* STATS */}
      <section className="reveal-section border-y border-border bg-surface px-6 py-14">
        <div className="mx-auto grid max-w-5xl grid-cols-2 gap-8 text-center sm:grid-cols-4">
          {STATS.map((s) => (
            <div key={s.label} className="reveal-item">
              <div
                className="stat-num font-display text-4xl font-black text-accent-500"
                data-value={s.value}
                data-suffix={s.suffix}
              >
                {s.value}
                {s.suffix}
              </div>
              <div className="mt-2 text-sm text-muted">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" className="reveal-section px-6 py-24">
        <div className="mx-auto max-w-6xl">
          <div className="reveal-item mx-auto mb-14 max-w-2xl text-center">
            <h2 className="font-display text-3xl font-black text-foreground sm:text-4xl">
              كل ما يحتاجه فريقك، في مكان واحد
            </h2>
            <p className="mt-3 text-muted">مبني على صلاحيات حقيقية، لا واجهة تجميلية فقط.</p>
          </div>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => {
              const Icon = f.icon;
              return (
                <div
                  key={f.title}
                  className="reveal-item group rounded-2xl border border-border bg-surface p-6 transition-all duration-300 hover:-translate-y-1.5 hover:shadow-xl"
                >
                  <div
                    className={`mb-4 flex h-12 w-12 items-center justify-center rounded-xl ${colorClasses[f.color]}`}
                  >
                    <Icon />
                  </div>
                  <h3 className="mb-1.5 text-base font-extrabold text-foreground">{f.title}</h3>
                  <p className="text-sm leading-relaxed text-muted">{f.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how" className="reveal-section bg-surface px-6 py-24">
        <div className="mx-auto max-w-5xl">
          <div className="reveal-item mx-auto mb-14 max-w-2xl text-center">
            <h2 className="font-display text-3xl font-black text-foreground sm:text-4xl">
              كيف يعمل منجز؟
            </h2>
          </div>
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-3">
            {STEPS.map((s) => (
              <div key={s.n} className="reveal-item text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-accent-500 font-display text-xl font-black text-white">
                  {s.n}
                </div>
                <h3 className="mb-1.5 text-base font-extrabold text-foreground">{s.title}</h3>
                <p className="text-sm leading-relaxed text-muted">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="reveal-section relative overflow-hidden px-6 py-24">
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-br from-accent-500 via-purple-500 to-pink-500 opacity-95"
        />
        <div className="relative mx-auto max-w-2xl text-center text-white">
          <h2 className="reveal-item font-display text-3xl font-black sm:text-4xl">
            جاهز تنظّم فريقك؟
          </h2>
          <p className="reveal-item mt-3 text-white/85">
            أنشئ حسابك الآن وابدأ في تنظيم مهام فريقك خلال دقائق.
          </p>
          <Link
            href="/login"
            className="reveal-item mt-8 inline-block rounded-full bg-white px-9 py-3.5 text-[15px] font-extrabold text-accent-700 transition-transform hover:scale-105"
          >
            أنشئ حسابك الآن
          </Link>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-border px-6 py-8 text-center text-sm text-muted">
        <div className="mb-2 flex items-center justify-center gap-2 font-display font-extrabold text-foreground">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-foreground text-[11px] text-surface">
            م
          </span>
          منجز
        </div>
        © {new Date().getFullYear()} منجز. جميع الحقوق محفوظة.
      </footer>
    </div>
  );
}
