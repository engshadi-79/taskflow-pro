import { PageHeader, HeaderChip } from "@/components/shared/page-header";
import { Avatar } from "@/components/shared/avatar";
import {
  InfoIcon,
  EyeIcon,
  GridIcon,
  CheckCircleIcon,
  ChartIcon,
  FolderIcon,
  ChatIcon,
  LockIcon,
  UserIcon,
  BriefcaseIcon,
  UsersIcon,
  ClipboardIcon,
  CheckSquareIcon,
  BoardIcon,
  CalendarIcon,
  BellIcon,
  BookIcon,
  DeviceMobileIcon,
  StarIcon,
  RefreshIcon,
  SparklesIcon,
  GearIcon,
  WhatsappIcon,
  MailIcon,
  FacebookIcon,
  InstagramIcon,
  ClockIcon,
  TrophyIcon,
} from "@/components/shared/icons";

type IconType = typeof InfoIcon;

const COLORS = [
  { bg: "bg-accent-50", text: "text-accent-600", bar: "bg-accent-500" },
  { bg: "bg-teal-50", text: "text-teal-600", bar: "bg-teal-500" },
  { bg: "bg-orange-50", text: "text-orange-600", bar: "bg-orange-500" },
  { bg: "bg-pink-50", text: "text-pink-600", bar: "bg-pink-500" },
  { bg: "bg-purple-50", text: "text-purple-600", bar: "bg-purple-500" },
  { bg: "bg-green-50", text: "text-green-600", bar: "bg-green-500" },
  { bg: "bg-brand-blue-50", text: "text-brand-blue-600", bar: "bg-brand-blue-500" },
  { bg: "bg-brand-red-50", text: "text-brand-red-600", bar: "bg-brand-red-500" },
];

const GOALS: { icon: IconType; label: string }[] = [
  { icon: RefreshIcon, label: "أتمتة العمليات" },
  { icon: GridIcon, label: "رقمنة العمل الإداري" },
  { icon: CheckCircleIcon, label: "دقة البيانات" },
  { icon: ChartIcon, label: "دعم اتخاذ القرار" },
  { icon: FolderIcon, label: "توحيد الأقسام" },
  { icon: ChatIcon, label: "تواصل فعّال" },
  { icon: LockIcon, label: "أمان وصلاحيات" },
];

const AUDIENCES: { icon: IconType; title: string; desc: string }[] = [
  {
    icon: UserIcon,
    title: "الموظفون",
    desc: "استلام المهام ومتابعتها، تسجيل الوقت، المشاركة في الاجتماعات، والتواصل مع الزملاء.",
  },
  {
    icon: BriefcaseIcon,
    title: "مديرو الأقسام",
    desc: "توزيع المهام على الفريق، متابعة الأداء، اعتماد طلبات القسم، وإدارة الحضور.",
  },
  {
    icon: LockIcon,
    title: "المدير العام",
    desc: "رؤية شاملة على كل الأقسام والمهام، التقارير التنفيذية، وإدارة صلاحيات النظام.",
  },
  {
    icon: UsersIcon,
    title: "الجميع",
    desc: "التقويم المشترك، الإشعارات الفورية، المحادثات الداخلية، وقاعدة المعرفة.",
  },
];

const JOURNEY: { icon: IconType; label: string }[] = [
  { icon: ClipboardIcon, label: "إنشاء المهمة" },
  { icon: UserIcon, label: "التوزيع على الموظف" },
  { icon: ClockIcon, label: "التنفيذ والمتابعة" },
  { icon: EyeIcon, label: "المراجعة" },
  { icon: CheckCircleIcon, label: "الاعتماد والأرشفة" },
];

const SERVICES: { icon: IconType; title: string; desc: string }[] = [
  { icon: CheckSquareIcon, title: "إدارة المهام", desc: "إنشاء المهام وتوزيعها ومتابعة حالتها من الإنشاء حتى الاعتماد." },
  { icon: BoardIcon, title: "لوحة كانبان", desc: "نقل المهام بين أعمدة الحالة بسهولة: تخطيط، قيد التنفيذ، مكتملة." },
  { icon: CalendarIcon, title: "الاجتماعات", desc: "جدولة الاجتماعات، إرسال الدعوات، وتوثيق محاضر الاجتماع." },
  { icon: ClipboardIcon, title: "الطلبات والموافقات", desc: "طلبات إدارية بمسار اعتماد متعدد المستويات." },
  { icon: ChartIcon, title: "التقارير والإحصائيات", desc: "لوحات أداء، تقارير SLA، وتصدير إلى Excel وPDF." },
  { icon: UsersIcon, title: "الموارد البشرية", desc: "بيانات الموظفين، الأقسام، الحضور، وتقييم الأداء." },
  { icon: BellIcon, title: "الإشعارات والتواصل", desc: "إشعارات فورية داخل النظام، وعبر واتساب والبريد الإلكتروني." },
  { icon: ChatIcon, title: "المحادثات الداخلية", desc: "دردشة مباشرة بين الموظفين وفرق العمل." },
  { icon: BookIcon, title: "قاعدة المعرفة", desc: "مقالات ووثائق داخلية يسهل الوصول إليها ومشاركتها." },
  { icon: DeviceMobileIcon, title: "تطبيق الجوال", desc: "تطبيق أندرويد مخصص للوصول السريع من أي مكان." },
];

const FEATURES: { icon: IconType; label: string }[] = [
  { icon: StarIcon, label: "واجهة سهلة وحديثة" },
  { icon: BookIcon, label: "دعم كامل للغة العربية RTL" },
  { icon: LockIcon, label: "صلاحيات متعددة المستويات" },
  { icon: RefreshIcon, label: "أتمتة ذكية للعمليات" },
  { icon: DeviceMobileIcon, label: "تصميم متجاوب مع الجوال" },
  { icon: WhatsappIcon, label: "إشعارات فورية وواتساب" },
  { icon: SparklesIcon, label: "مساعد ذكاء اصطناعي مدمج" },
  { icon: GearIcon, label: "تحديثات وتحسينات مستمرة" },
];

const RESPONSIBILITIES = [
  "تصميم معمارية النظام",
  "تصميم وإدارة قواعد البيانات",
  "تطوير الواجهات الأمامية والخلفية",
  "تطوير تطبيق الجوال (React Native)",
  "بناء نظام الصلاحيات والأمان",
  "تطوير التقارير ولوحات المعلومات",
  "أتمتة العمليات الإدارية",
  "الإشراف على التطوير والصيانة المستمرة",
];

function SectionHeading({
  icon,
  children,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex items-center gap-2.5">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px] bg-accent-50 text-accent-600">
        {icon}
      </span>
      <h2 className="text-[15px] font-extrabold text-foreground">{children}</h2>
    </div>
  );
}

function SocialLink({ href, icon }: { href: string; icon: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-surface text-muted transition-colors hover:border-accent-300 hover:bg-accent-50 hover:text-accent-600"
    >
      {icon}
    </a>
  );
}

export default function AboutPage() {
  return (
    <div className="max-w-5xl space-y-4.5">
      <PageHeader
        title="حول نظام منجز"
        subtitle="منصة رقمية متكاملة لإدارة المهام والموظفين والاجتماعات والطلبات الإدارية"
        variant="navy"
        icon={<InfoIcon className="h-6 w-6" />}
      >
        <HeaderChip icon={<LockIcon className="h-3.5 w-3.5" />}>آمن وموثوق</HeaderChip>
        <HeaderChip icon={<CheckCircleIcon className="h-3.5 w-3.5" />}>سهل الاستخدام</HeaderChip>
        <HeaderChip icon={<GridIcon className="h-3.5 w-3.5" />}>متكامل</HeaderChip>
        <HeaderChip icon={<SparklesIcon className="h-3.5 w-3.5" />}>حديث ومتطوّر</HeaderChip>
      </PageHeader>

      {/* نبذة + الرؤية والرسالة */}
      <div className="grid grid-cols-1 gap-4.5 lg:grid-cols-2">
        <section className="rounded-[18px] border border-border bg-surface p-6">
          <SectionHeading icon={<InfoIcon className="h-4 w-4" />}>نبذة عن النظام</SectionHeading>
          <p className="text-[13px] leading-8 text-muted">
            منجز هو نظام متكامل لإدارة المهام والفرق داخل المؤسسات، يرافق المهمة منذ لحظة إنشائها
            وتوزيعها على الموظف المعني، مرورًا بالمتابعة والتنفيذ، وصولًا إلى المراجعة والاعتماد
            النهائي. يوفّر النظام بيئة موحدة تجمع المهام والاجتماعات والطلبات الإدارية والتقارير في
            مكان واحد، بما يرفع كفاءة العمل ويحسّن التواصل بين الإدارة والموظفين.
          </p>
        </section>

        <section className="rounded-[18px] border border-border bg-surface p-6">
          <SectionHeading icon={<EyeIcon className="h-4 w-4" />}>الرؤية والرسالة</SectionHeading>
          <div className="flex gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-accent-600 to-accent-400 text-white">
              <EyeIcon className="h-4.5 w-4.5" />
            </span>
            <div>
              <h6 className="mb-1 text-[13px] font-extrabold text-foreground">الرؤية</h6>
              <p className="text-[12.5px] leading-6 text-muted">
                أن يكون منجز الأداة الرقمية الأولى لإدارة العمل المؤسسي، بما يحقق تحولًا رقميًا
                حقيقيًا في طريقة إنجاز المهام ومتابعتها.
              </p>
            </div>
          </div>
          <div className="mt-4 flex gap-3 border-t border-dashed border-border pt-4">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-orange-500 to-orange-600 text-white">
              <SparklesIcon className="h-4.5 w-4.5" />
            </span>
            <div>
              <h6 className="mb-1 text-[13px] font-extrabold text-foreground">الرسالة</h6>
              <p className="text-[12.5px] leading-6 text-muted">
                تقديم منصة عربية حديثة وآمنة وسهلة الاستخدام، تُبسّط إدارة المهام والفرق، وتدعم
                اتخاذ القرار من خلال تقارير وبيانات لحظية دقيقة.
              </p>
            </div>
          </div>
        </section>
      </div>

      {/* أهداف النظام */}
      <section className="rounded-[18px] border border-border bg-surface p-6">
        <SectionHeading icon={<TrophyIcon className="h-4 w-4" />}>أهداف النظام</SectionHeading>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
          {GOALS.map((g) => (
            <div key={g.label} className="flex flex-col items-center gap-2 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-[14px] bg-accent-50 text-accent-600 transition-transform hover:-translate-y-1">
                <g.icon className="h-5 w-5" />
              </span>
              <span className="text-[11px] font-bold leading-tight text-muted">{g.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* الفئات المستفيدة */}
      <section className="rounded-[18px] border border-border bg-surface p-6">
        <SectionHeading icon={<UsersIcon className="h-4 w-4" />}>الفئات المستفيدة</SectionHeading>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {AUDIENCES.map((a, i) => {
            const c = COLORS[i % COLORS.length];
            return (
              <div
                key={a.title}
                className="rounded-[16px] border border-border bg-background p-5 text-center transition-transform hover:-translate-y-1"
              >
                <span className={`mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full ${c.bg} ${c.text}`}>
                  <a.icon className="h-6 w-6" />
                </span>
                <h6 className="mb-1.5 text-[13px] font-extrabold text-foreground">{a.title}</h6>
                <p className="text-[11.5px] leading-6 text-muted">{a.desc}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* رحلة المهمة */}
      <section className="rounded-[18px] border border-border bg-surface p-6">
        <SectionHeading icon={<RefreshIcon className="h-4 w-4" />}>رحلة المهمة</SectionHeading>
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
          {JOURNEY.map((step, i) => (
            <div key={step.label} className="flex flex-1 items-center gap-3 sm:flex-col sm:text-center">
              <div className="flex items-center gap-3 sm:flex-col">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent-500 text-sm font-black text-white">
                  {i + 1}
                </span>
                <step.icon className="hidden h-4 w-4 text-accent-600 sm:block sm:mt-2" />
              </div>
              <span className="text-[12.5px] font-bold text-foreground sm:mt-1">{step.label}</span>
              {i < JOURNEY.length - 1 && (
                <span className="hidden h-px flex-1 bg-border sm:mt-[-38px] sm:block" />
              )}
            </div>
          ))}
        </div>
      </section>

      {/* الخدمات الرئيسية */}
      <section className="rounded-[20px] border border-border bg-background p-6 sm:p-8">
        <div className="mb-6 text-center">
          <h2 className="text-lg font-black text-foreground sm:text-xl">الخدمات الرئيسية</h2>
          <p className="mx-auto mt-1.5 max-w-md text-[12.5px] text-muted">
            منظومة متكاملة لإدارة جميع احتياجات العمل من مكان واحد
          </p>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {SERVICES.map((s, i) => {
            const c = COLORS[i % COLORS.length];
            return (
              <div
                key={s.title}
                className="relative flex flex-col rounded-[16px] border border-border bg-surface p-5 transition-transform hover:-translate-y-1"
              >
                <span className="absolute top-3 left-3 flex h-6 min-w-[26px] items-center justify-center rounded-md bg-background px-1.5 text-[11px] font-black text-faint">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className={`mb-4 mt-1 flex h-12 w-12 items-center justify-center rounded-[14px] ${c.bg} ${c.text}`}>
                  <s.icon className="h-5 w-5" />
                </span>
                <h6 className="mb-1.5 text-[13px] font-extrabold text-foreground">{s.title}</h6>
                <p className="text-[11.5px] leading-6 text-muted">{s.desc}</p>
                <span className={`mt-3 h-1 w-9 rounded-full ${c.bar}`} />
              </div>
            );
          })}
        </div>
      </section>

      {/* مميزات النظام */}
      <section className="banner-navy relative overflow-hidden rounded-[20px] p-6 text-white sm:p-8">
        <div className="mb-6 flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-[11px] bg-white/15">
            <StarIcon className="h-4.5 w-4.5" />
          </span>
          <h2 className="text-lg font-black">مميزات النظام</h2>
        </div>
        <div className="grid grid-cols-2 gap-5 sm:grid-cols-4">
          {FEATURES.map((f) => (
            <div key={f.label} className="text-center">
              <span className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-[14px] border border-white/15 bg-white/10">
                <f.icon className="h-5 w-5" />
              </span>
              <span className="text-[11.5px] font-medium leading-5 text-white/85">{f.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* فريق التطوير */}
      <section className="rounded-[18px] border border-border bg-surface p-6 sm:p-8">
        <SectionHeading icon={<CheckSquareIcon className="h-4 w-4" />}>فريق تطوير النظام</SectionHeading>
        <div className="mx-auto max-w-xl rounded-[18px] border border-accent-100 bg-gradient-to-br from-accent-50 via-purple-50 to-accent-50 p-6 text-center sm:p-8">
          <Avatar
            name="المهندس شادي القططي"
            size={112}
            className="mx-auto mb-4 border-4 border-white text-3xl shadow-lg"
          />
          <h3 className="text-lg font-black text-foreground">المهندس شادي القططي</h3>
          <p className="mt-1 text-[13px] font-bold text-accent-600">مؤسس ومطور النظام</p>

          <a
            href="mailto:ostoraplus2017@gmail.com"
            className="mt-3 inline-flex items-center gap-2 text-[13px] text-muted transition-colors hover:text-accent-600"
          >
            <MailIcon className="h-4 w-4" /> ostoraplus2017@gmail.com
          </a>

          <div className="mt-4 flex items-center justify-center gap-2.5">
            <SocialLink href="https://www.facebook.com/engshadi1979" icon={<FacebookIcon className="h-4 w-4" />} />
            <SocialLink href="https://instagram.com/eng_shadi201" icon={<InstagramIcon className="h-4 w-4" />} />
            <SocialLink href="https://wa.me/970599021025" icon={<WhatsappIcon className="h-4 w-4" />} />
          </div>

          <div className="mt-6 rounded-[14px] border border-border bg-surface p-5 text-start">
            <p className="text-[12px] leading-7 text-muted">
              يقود رؤية وتصميم وتطوير نظام منجز، ويشرف على جميع مراحله بدءًا من تحليل الاحتياجات
              وتصميم قاعدة البيانات، مرورًا بتطوير الواجهات والخدمات، وصولًا إلى تطبيق الجوال
              والتكامل مع خدمات الإشعارات. يعمل على تطوير النظام باستمرار بما يواكب احتياجات فريق
              العمل ويعزز الإنتاجية اليومية.
            </p>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-2 text-start sm:grid-cols-2">
            {RESPONSIBILITIES.map((r) => (
              <div
                key={r}
                className="flex items-center gap-2 rounded-[10px] border border-border bg-surface px-3 py-2"
              >
                <CheckCircleIcon className="h-4 w-4 shrink-0 text-green-600" />
                <span className="text-[11.5px] font-medium text-foreground">{r}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <p className="pb-4 text-center text-[11px] text-faint">
        تطوير المهندس شادي القططي — نظام منجز · الإصدار 3.0
      </p>
    </div>
  );
}
