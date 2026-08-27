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
  SparklesIcon,
  ZapIcon,
  PhoneIcon,
  PlugIcon,
  UserPlusIcon,
  CheckIcon,
} from "@/components/landing/icons";
import { AnimatedBackground } from "@/components/shared/animated-background";

gsap.registerPlugin(ScrollTrigger, useGSAP);

const FEATURES = [
  {
    icon: ShieldIcon,
    color: "pink",
    title: "صلاحيات دقيقة",
    desc: "كل دور يرى فقط ما يخصه — محمي على مستوى قاعدة البيانات نفسها، لا الواجهة فقط.",
  },
  {
    icon: DownloadIcon,
    color: "purple",
    title: "تصدير Excel بضغطة",
    desc: "صدّر تقاريرك الكاملة، أو حوّل أي ملف Excel حسب قالبك الخاص، في ثوانٍ.",
  },
  {
    icon: MoonIcon,
    color: "accent",
    title: "عربي بالكامل، وضع ليلي",
    desc: "واجهة RTL أصيلة من الجذور، مع وضع ليلي مريح للعين عند الحاجة.",
  },
];

const STATS = [
  { value: 3, suffix: "", label: "مستويات صلاحيات محمية على مستوى قاعدة البيانات" },
  { value: 3, suffix: "", label: "محاولات تلقائية لإعادة تشغيل أي أتمتة فشلت" },
  { value: 100, suffix: "٪", label: "عربي بالكامل — واجهة و RTL أصيلة" },
  { value: 24, suffix: "/7", label: "وصول فوري من الجوال، حتى بلا اتصال" },
];

const STEPS = [
  { n: "١", title: "أنشئ مهمة", desc: "حدّد العنوان والمسؤول والأولوية والموعد في نموذج واحد بسيط." },
  {
    n: "٢",
    title: "تابع ودَع الأتمتة تعمل",
    desc: "كانبان وقوالب أتمتة جاهزة تصعّد وتذكّر تلقائيًا، والمساعد الذكي يجيبك عن أي سؤال حول الأداء.",
  },
  { n: "٣", title: "راجع واعتمد", desc: "وافق أو ارفض مع ملاحظات، وتابع كل شيء في تقارير تلقائية." },
];

const INTEGRATIONS = [
  {
    icon: PlugIcon,
    color: "accent",
    title: "واجهة API",
    desc: "مفاتيح وصول آمنة لربط أنظمتك الخارجية — إنشاء وقراءة المهام برمجيًا.",
  },
  {
    icon: ZapIcon,
    color: "green",
    title: "Slack وMicrosoft Teams",
    desc: "وجّه أي حدث (مهمة جديدة، تغيّر حالة، اكتمال) كرسالة فورية لقناتك مباشرة.",
  },
  {
    icon: UserPlusIcon,
    color: "purple",
    title: "دعوة الزملاء بضغطة",
    desc: "رابط دعوة بدور وقسم محدَّدين — من يفتحه ينضم لمؤسستك فورًا، بلا موافقة يدوية.",
  },
];

const PLANS = [
  {
    name: "مجانية",
    tag: null,
    desc: "لتجربة منجز والبدء بفريق صغير.",
    items: ["حتى 5 مقاعد", "فترة تجريبية 14 يومًا", "كل ميزات إدارة المهام والتقارير", "المساعد الذكي والأتمتة"],
  },
  {
    name: "مدفوعة",
    tag: "الأنسب للفرق النامية",
    desc: "لمؤسسة بلا حدود على عدد الأعضاء أو الوقت.",
    items: ["مقاعد غير محدودة", "بلا فترة تجريبية محدودة", "كل شيء في الخطة المجانية", "دعم أولوية من الفريق"],
  },
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
          <nav className="hidden items-center gap-7 text-sm font-bold text-muted lg:flex">
            <a href="#features" className="hover:text-foreground">المميزات</a>
            <a href="#ai" className="hover:text-foreground">الذكاء الاصطناعي</a>
            <a href="#how" className="hover:text-foreground">كيف يعمل</a>
            <a href="#pricing" className="hover:text-foreground">الخطط</a>
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
        <AnimatedBackground intensity="hero" />
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
          <div className="hero-fade mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-accent-300/40 bg-accent-50 px-4 py-1.5 text-xs font-extrabold text-accent-600">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent-500" />
            منصة عربية متكاملة — مهام، أتمتة، ومساعد ذكي
          </div>
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
            منصة عربية بالكامل لإدارة عمل فريقك — كانبان وتقارير، أتمتة تعمل وحدها، مساعد ذكي
            يجيبك عن بياناتك الحقيقية، وتطبيق جوال يعمل حتى بلا اتصال.
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
      <section className="reveal-section relative overflow-hidden border-y border-border bg-surface px-6 py-14">
        <AnimatedBackground intensity="subtle" />
        <div className="relative mx-auto grid max-w-5xl grid-cols-2 gap-8 text-center sm:grid-cols-4">
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

      {/* FEATURES — alternating showcase */}
      <section id="features" className="reveal-section px-6 py-24">
        <div className="mx-auto max-w-6xl">
          <div className="reveal-item mx-auto mb-16 max-w-2xl text-center">
            <h2 className="font-display text-3xl font-black text-foreground sm:text-4xl">
              كل ما يحتاجه فريقك، في مكان واحد
            </h2>
            <p className="mt-3 text-muted">مبني على صلاحيات حقيقية، لا واجهة تجميلية فقط.</p>
          </div>

          <div className="space-y-20">
            {/* showcase 1: kanban */}
            <div className="grid items-center gap-10 lg:grid-cols-2">
              <div className="reveal-item order-2 lg:order-1">
                <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-accent-50 text-accent-500">
                  <KanbanIcon />
                </div>
                <h3 className="mb-3 font-display text-2xl font-black text-foreground">
                  لوحة كانبان تفاعلية
                </h3>
                <p className="text-[15px] leading-relaxed text-muted">
                  اسحب مهامك بين الحالات الخمس بسحب وإفلات حقيقي — كل حركة تحدّث قاعدة البيانات
                  فورًا، وليست مجرد واجهة تجميلية. كل عضو يرى فقط ما يخصه حسب صلاحياته.
                </p>
              </div>
              <div className="reveal-item order-1 lg:order-2">
                <div className="rounded-2xl border border-border bg-surface p-4 shadow-xl">
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: "جديدة", color: "bg-faint", items: 1 },
                      { label: "قيد التنفيذ", color: "bg-accent-500", items: 2 },
                      { label: "مكتملة", color: "bg-green-500", items: 3 },
                    ].map((col) => (
                      <div key={col.label} className="rounded-xl bg-background p-2.5">
                        <div className="mb-2 flex items-center gap-1.5 px-1">
                          <span className={`h-1.5 w-1.5 rounded-full ${col.color}`} />
                          <span className="text-[10px] font-extrabold text-muted">{col.label}</span>
                        </div>
                        <div className="space-y-1.5">
                          {Array.from({ length: col.items }).map((_, i) => (
                            <div key={i} className="h-10 rounded-lg border border-border bg-surface p-1.5">
                              <div className="mb-1 h-1.5 w-3/4 rounded-full bg-border" />
                              <div className="h-1.5 w-1/2 rounded-full bg-border" />
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* showcase 2: reports */}
            <div className="grid items-center gap-10 lg:grid-cols-2">
              <div className="reveal-item">
                <div className="rounded-2xl border border-border bg-surface p-6 shadow-xl">
                  <div className="mb-4 flex items-center justify-between">
                    <span className="text-xs font-extrabold text-muted">أداء الفريق</span>
                    <span className="rounded-full bg-green-50 px-2.5 py-1 text-[10px] font-extrabold text-green-600">
                      ▲ 32٪
                    </span>
                  </div>
                  <svg viewBox="0 0 280 100" className="h-24 w-full" preserveAspectRatio="none">
                    <polyline
                      points="0,80 40,70 80,75 120,45 160,55 200,25 240,35 280,10"
                      fill="none"
                      stroke="#ff8a5c"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-lg bg-background p-2">
                      <div className="font-display text-lg font-black text-foreground">24</div>
                      <div className="text-[10px] text-faint">منجزة</div>
                    </div>
                    <div className="rounded-lg bg-background p-2">
                      <div className="font-display text-lg font-black text-foreground">78٪</div>
                      <div className="text-[10px] text-faint">إنجاز</div>
                    </div>
                    <div className="rounded-lg bg-background p-2">
                      <div className="font-display text-lg font-black text-foreground">2.3</div>
                      <div className="text-[10px] text-faint">يوم متوسط</div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="reveal-item">
                <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-orange-50 text-orange-500">
                  <ChartIcon />
                </div>
                <h3 className="mb-3 font-display text-2xl font-black text-foreground">
                  تقارير ولوحات بيانات حقيقية
                </h3>
                <p className="text-[15px] leading-relaxed text-muted">
                  تتبع الأداء، أكثر الموظفين إنجازًا، ونسبة التأخير — كل الأرقام محسوبة مباشرة
                  من قاعدة البيانات لحظة بلحظة، مع تصدير Excel كامل بضغطة واحدة.
                </p>
              </div>
            </div>

            {/* showcase 3: notifications */}
            <div className="grid items-center gap-10 lg:grid-cols-2">
              <div className="reveal-item order-2 lg:order-1">
                <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-pink-50 text-pink-500">
                  <BellIcon />
                </div>
                <h3 className="mb-3 font-display text-2xl font-black text-foreground">
                  إشعارات فورية عبر Realtime
                </h3>
                <p className="text-[15px] leading-relaxed text-muted">
                  تنبيه لحظي عند إسناد مهمة، تغيير حالتها، أو اعتمادها — يصل فورًا دون تحديث
                  الصفحة، ومهام مجدولة تذكّرك قبل الموعد النهائي تلقائيًا.
                </p>
              </div>
              <div className="reveal-item order-1 lg:order-2">
                <div className="space-y-2.5 rounded-2xl border border-border bg-surface p-4 shadow-xl">
                  {[
                    { c: "bg-pink-500", t: "تم إسناد مهمة جديدة إليك", time: "الآن" },
                    { c: "bg-accent-500", t: "مهمة بانتظار مراجعتك", time: "قبل 5 د" },
                    { c: "bg-green-500", t: "تم اعتماد مهمتك", time: "قبل ساعة" },
                  ].map((n, i) => (
                    <div key={i} className="flex items-center gap-3 rounded-xl bg-background p-3">
                      <span className={`h-8 w-8 shrink-0 rounded-full ${n.c}`} />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[13px] font-bold text-foreground">{n.t}</div>
                        <div className="text-[11px] text-faint">{n.time}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* supporting grid */}
          <div className="mt-20 grid grid-cols-1 gap-5 sm:grid-cols-3">
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

      {/* AI + AUTOMATION */}
      <section id="ai" className="reveal-section relative overflow-hidden bg-surface px-6 py-24">
        <AnimatedBackground intensity="subtle" />
        <div className="relative mx-auto max-w-6xl">
          <div className="reveal-item mx-auto mb-16 max-w-2xl text-center">
            <h2 className="font-display text-3xl font-black text-foreground sm:text-4xl">
              الذكاء الاصطناعي والأتمتة — يعملان نيابةً عنك
            </h2>
            <p className="mt-3 text-muted">لا مجرد أدوات، بل فريق إضافي يراقب ويقترح ويصلح تلقائيًا.</p>
          </div>

          <div className="space-y-20">
            {/* AI assistant */}
            <div className="grid items-center gap-10 lg:grid-cols-2">
              <div className="reveal-item order-2 lg:order-1">
                <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-purple-50 text-purple-500">
                  <SparklesIcon />
                </div>
                <h3 className="mb-3 font-display text-2xl font-black text-foreground">
                  مساعد ذكي يعرف بياناتك فعلًا
                </h3>
                <p className="text-[15px] leading-relaxed text-muted">
                  اسأله عن حِمل أي موظف، أو مهام معرّضة للتأخير، أو لخّص اجتماعًا — يجيب من بيانات
                  مؤسستك الحقيقية، ويقترح إجراءات لا يُنفّذ أيًّا منها إلا بتأكيدك الصريح.
                </p>
              </div>
              <div className="reveal-item order-1 lg:order-2">
                <div className="rounded-2xl border border-border bg-background p-4 shadow-xl">
                  <div className="mb-3 flex items-center gap-2 rounded-xl bg-gradient-to-l from-accent-500 to-purple-500 px-3.5 py-2.5 text-white">
                    <SparklesIcon />
                    <span className="text-[12.5px] font-extrabold">المساعد الذكي</span>
                  </div>
                  <div className="space-y-2">
                    <div className="mr-auto max-w-[85%] rounded-xl bg-accent-600 px-3 py-2 text-[12.5px] text-white">
                      من عنده أكبر عدد مهام متأخرة؟
                    </div>
                    <div className="ml-auto max-w-[90%] rounded-xl bg-surface px-3 py-2 text-[12.5px] text-foreground">
                      قسم المبيعات لديه 4 مهام متأخرة. أقترح تصعيدها لمدير القسم الآن.
                    </div>
                    <div className="ml-auto flex max-w-[90%] items-center gap-2 rounded-xl border border-accent-200 bg-accent-50 px-3 py-2">
                      <span className="text-[11.5px] font-bold text-accent-700">تأكيد الإجراء؟</span>
                      <span className="rounded-full bg-accent-600 px-2.5 py-1 text-[10.5px] font-extrabold text-white">
                        تأكيد
                      </span>
                      <span className="rounded-full bg-white px-2.5 py-1 text-[10.5px] font-extrabold text-muted">
                        تجاهل
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* automation */}
            <div className="grid items-center gap-10 lg:grid-cols-2">
              <div className="reveal-item">
                <div className="rounded-2xl border border-border bg-background p-4 shadow-xl">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-[12px] font-extrabold text-foreground">تصعيد المهام المتأخرة</span>
                    <span className="rounded-full bg-orange-50 px-2.5 py-1 text-[10px] font-extrabold text-orange-600">
                      محاولة 2 من 3
                    </span>
                  </div>
                  <div className="space-y-2">
                    {["تنبيه عند إنشاء مهمة عاجلة", "تصعيد المهام المتأخرة لمدير القسم", "تنبيه مبكر عند اقتراب SLA"].map(
                      (t) => (
                        <div key={t} className="flex items-center gap-2.5 rounded-xl bg-surface px-3 py-2.5">
                          <ZapIcon />
                          <span className="text-[12px] font-bold text-foreground">{t}</span>
                        </div>
                      )
                    )}
                  </div>
                </div>
              </div>
              <div className="reveal-item">
                <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-green-50 text-green-600">
                  <ZapIcon />
                </div>
                <h3 className="mb-3 font-display text-2xl font-black text-foreground">
                  أتمتة لا تتوقف عند أول فشل
                </h3>
                <p className="text-[15px] leading-relaxed text-muted">
                  أي قاعدة أتمتة فشلت تُعاد تلقائيًا حتى 3 محاولات قبل التوقف، وتبدأ من معرض 7
                  قوالب جاهزة (تصعيد، تنبيه SLA، متابعة تلقائية بعد الاكتمال) بدل البناء من الصفر.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* MOBILE + OFFLINE */}
      <section className="reveal-section relative overflow-hidden px-6 py-24">
        <AnimatedBackground intensity="subtle" />
        <div
          aria-hidden
          className="animate-blob-1 absolute top-10 -start-20 h-72 w-72 rounded-full bg-green-500/15 blur-3xl"
        />
        <div className="relative mx-auto grid max-w-6xl items-center gap-10 lg:grid-cols-2">
          <div className="reveal-item order-2 flex justify-center lg:order-1">
            <div className="w-[220px] rounded-[32px] border-4 border-foreground bg-surface p-2.5 shadow-2xl">
              <div className="rounded-[22px] bg-background p-3">
                <div className="mb-3 rounded-lg bg-orange-50 px-2.5 py-2 text-center text-[10.5px] font-extrabold text-orange-600">
                  غير متصل — سيُزامَن التغيير عند عودة الاتصال
                </div>
                <div className="space-y-2">
                  {["مراجعة تقرير الأداء", "تحديث حالة مشروع", "الرد على تعليق"].map((t) => (
                    <div key={t} className="rounded-lg border border-border bg-surface p-2.5">
                      <div className="mb-1 h-1.5 w-2/3 rounded-full bg-border" />
                      <div className="text-[10.5px] font-bold text-foreground">{t}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
          <div className="reveal-item order-1 lg:order-2">
            <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-green-50 text-green-600">
              <PhoneIcon />
            </div>
            <h3 className="mb-3 font-display text-2xl font-black text-foreground">
              تطبيق جوال يعمل حتى بلا اتصال
            </h3>
            <p className="text-[15px] leading-relaxed text-muted">
              انقطع الاتصال أثناء العمل؟ إرسال المهمة للمراجعة، قرار الاعتماد، أو إضافة تعليق —
              كلها تُحفظ محليًا وتُزامَن تلقائيًا فور عودة الاتصال، بنفس صلاحياتك تمامًا، بلا فقدان
              أي تعديل.
            </p>
          </div>
        </div>
      </section>

      {/* INTEGRATIONS */}
      <section className="reveal-section px-6 py-24">
        <div className="mx-auto max-w-6xl">
          <div className="reveal-item mx-auto mb-14 max-w-2xl text-center">
            <h2 className="font-display text-3xl font-black text-foreground sm:text-4xl">
              يتكامل مع أدواتك، وينمو مع فريقك
            </h2>
          </div>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
            {INTEGRATIONS.map((f) => {
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

      {/* HOW IT WORKS — dark contrast band */}
      <section id="how" className="reveal-section relative overflow-hidden bg-foreground px-6 py-24">
        <AnimatedBackground intensity="subtle" />
        <div
          aria-hidden
          className="animate-blob-2 absolute -top-20 end-0 h-80 w-80 rounded-full bg-accent-500/25 blur-3xl"
        />
        <div className="relative mx-auto max-w-5xl">
          <div className="reveal-item mx-auto mb-16 max-w-2xl text-center">
            <h2 className="font-display text-3xl font-black text-white sm:text-4xl">
              كيف يعمل منجز؟
            </h2>
          </div>
          <div className="grid grid-cols-1 gap-10 sm:grid-cols-3">
            {STEPS.map((s, i) => (
              <div key={s.n} className="reveal-item relative text-center">
                {i < STEPS.length - 1 && (
                  <div className="absolute top-7 hidden h-px w-full bg-gradient-to-l from-accent-500/60 to-transparent sm:block" style={{ insetInlineStart: "50%" }} />
                )}
                <div className="relative mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-accent-500 font-display text-xl font-black text-white shadow-[0_0_24px_rgba(99,102,241,0.55)]">
                  {s.n}
                </div>
                <h3 className="mb-1.5 text-base font-extrabold text-white">{s.title}</h3>
                <p className="text-sm leading-relaxed text-white/60">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section id="pricing" className="reveal-section px-6 py-24">
        <div className="mx-auto max-w-4xl">
          <div className="reveal-item mx-auto mb-14 max-w-2xl text-center">
            <h2 className="font-display text-3xl font-black text-foreground sm:text-4xl">الخطط</h2>
            <p className="mt-3 text-muted">ابدأ مجانًا، وترقَّ متى احتجت فريقك الأكبر.</p>
          </div>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            {PLANS.map((plan) => (
              <div
                key={plan.name}
                className={`reveal-item relative rounded-[22px] border p-7 ${
                  plan.tag
                    ? "border-accent-400 bg-gradient-to-b from-accent-50 to-surface shadow-xl"
                    : "border-border bg-surface"
                }`}
              >
                {plan.tag && (
                  <span className="absolute -top-3 right-7 rounded-full bg-accent-500 px-3 py-1 text-[11px] font-extrabold text-white">
                    {plan.tag}
                  </span>
                )}
                <h3 className="font-display text-xl font-black text-foreground">{plan.name}</h3>
                <p className="mt-1.5 text-sm text-muted">{plan.desc}</p>
                <ul className="mt-5 space-y-2.5">
                  {plan.items.map((item) => (
                    <li key={item} className="flex items-center gap-2.5 text-[13.5px] text-foreground">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-green-50 text-green-600">
                        <CheckIcon />
                      </span>
                      {item}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/login"
                  className={`mt-7 block rounded-full px-6 py-3 text-center text-sm font-extrabold transition-transform hover:scale-[1.03] ${
                    plan.tag ? "bg-accent-500 text-white hover:bg-accent-600" : "border border-border bg-background text-foreground"
                  }`}
                >
                  ابدأ الآن
                </Link>
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
        <AnimatedBackground intensity="subtle" />
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
