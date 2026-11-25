import { useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpLeft,
  ArrowUpRight,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  Clock,
  FileText,
  Heart,
  HelpCircle,
  LayoutDashboard,
  Lock,
  Search,
  ShieldCheck,
} from 'lucide-react';
import type { Article, FAQ } from '../types/marketplace';
import { useI18n } from '../lib/i18n';
import type { PageView } from '../lib/router';
import { DynamicHeroBanner } from './DynamicHeroBanner';
import { Modal } from './Modal';
import { SafeImage } from './SafeImage';

interface GuidesViewProps {
  articles: Article[];
  onNavigate: (page: PageView) => void;
}

export function GuidesView({ articles, onNavigate }: GuidesViewProps) {
  const { dir, isEn } = useI18n();
  const DirArrow = isEn ? ArrowRight : ArrowLeft;
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [openArticle, setOpenArticle] = useState<Article | null>(null);

  const categories = useMemo(
    () => Array.from(new Set(articles.map((a) => a.category).filter(Boolean))),
    [articles]
  );

  const visibleArticles = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return articles.filter((a) => {
      if (selectedCategory !== 'all' && a.category !== selectedCategory) return false;
      if (!q) return true;
      return (
        a.title.toLowerCase().includes(q) ||
        a.excerpt.toLowerCase().includes(q) ||
        a.category.toLowerCase().includes(q)
      );
    });
  }, [articles, selectedCategory, searchQuery]);

  return (
    <section dir={dir} className="bg-[var(--color-canvas)] transition-colors">
      <DynamicHeroBanner
        pageKey="guides"
        breadcrumbs={[
          { label: isEn ? 'Home' : 'الرئيسية', onClick: () => onNavigate('home') },
          { label: isEn ? 'Guides & Articles' : 'الأدلة والمقالات' },
        ]}
        contextLabel={
          isEn
            ? `${articles.length} field guides`
            : `${articles.length} دليل ومقال عملي`
        }
        actions={
          <button
            type="button"
            onClick={() => onNavigate('breeds')}
            className="min-h-[42px] px-4 py-2 rounded-xl bg-[#E6B85C] hover:bg-[#F0C670] text-[#0C261B] text-xs sm:text-sm font-extrabold inline-flex items-center gap-2 cursor-pointer"
          >
            <BookOpen size={15} aria-hidden="true" />
            <span>{isEn ? 'Breeds & Market Prices' : 'دليل السلالات والأسعار'}</span>
            <DirArrow size={14} aria-hidden="true" />
          </button>
        }
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-7">
        {/* Filter + Search Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[var(--color-surface)] p-4 rounded-2xl border border-[var(--color-border)]">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setSelectedCategory('all')}
              className={`min-h-[36px] px-3.5 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                selectedCategory === 'all'
                  ? 'bg-[var(--color-green)] text-white'
                  : 'bg-[var(--color-canvas)] text-[var(--color-muted)] hover:text-[var(--color-ink)]'
              }`}
            >
              {isEn ? 'All Topics' : 'جميع المواضيع'} ({articles.length})
            </button>
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`min-h-[36px] px-3.5 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                  selectedCategory === cat
                    ? 'bg-[var(--color-green)] text-white'
                    : 'bg-[var(--color-canvas)] text-[var(--color-muted)] hover:text-[var(--color-ink)]'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="relative w-full md:w-72">
            <Search
              size={15}
              className="absolute start-3 top-1/2 -translate-y-1/2 text-[var(--color-muted)] pointer-events-none"
              aria-hidden="true"
            />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={isEn ? 'Search livestock guides...' : 'ابحث في الأدلة والمقالات...'}
              className="w-full h-10 ps-9 pe-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-canvas)] text-xs sm:text-sm text-[var(--color-ink)] focus:outline-none focus:border-[var(--color-green-ink)]"
            />
          </div>
        </div>

        {visibleArticles.length === 0 ? (
          <div className="rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] p-10 text-center space-y-2">
            <p className="font-display text-lg font-bold text-[var(--color-ink)]">
              {isEn ? 'No guides matched your search' : 'لا توجد مقالات مطابقة للبحث'}
            </p>
            <button
              type="button"
              onClick={() => {
                setSelectedCategory('all');
                setSearchQuery('');
              }}
              className="text-xs font-bold text-[var(--color-green-ink)] hover:underline cursor-pointer"
            >
              {isEn ? 'Show all guides' : 'عرض جميع الأدلة'}
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {visibleArticles.map((article) => (
              <article
                key={article.id}
                className="group bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] hover:border-[var(--color-gold)] overflow-hidden flex flex-col justify-between transition-all duration-150 hover:-translate-y-0.5 hover:shadow-md"
              >
                <div>
                  <div className="aspect-[16/9] bg-[var(--color-cream)] overflow-hidden">
                    <SafeImage
                      src={article.imageUrl}
                      alt={article.title}
                      width={800}
                      height={450}
                      loading="lazy"
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                    />
                  </div>
                  <div className="p-5 space-y-2.5">
                    <div className="flex items-center justify-between gap-2 text-[11px] text-[var(--color-muted)]">
                      <span className="font-bold text-[var(--color-green-ink)]">{article.category}</span>
                      <span className="inline-flex items-center gap-1 tabular-nums">
                        <Clock size={12} aria-hidden="true" />
                        <span>
                          {isEn
                            ? `${article.readTimeMinutes} min read`
                            : `${article.readTimeMinutes} دقائق قراءة`}
                        </span>
                      </span>
                    </div>
                    <h2 className="font-display text-lg font-extrabold text-[var(--color-ink)] leading-snug">
                      {article.title}
                    </h2>
                    <p className="text-xs sm:text-sm text-[var(--color-muted)] leading-relaxed line-clamp-3">
                      {article.excerpt}
                    </p>
                  </div>
                </div>

                <div className="px-5 pb-5 pt-3 border-t border-[var(--color-border)]/70">
                  <button
                    type="button"
                    onClick={() => setOpenArticle(article)}
                    className="min-h-[40px] w-full px-4 rounded-xl bg-[var(--color-cream)]/70 hover:bg-[var(--color-green)] text-[var(--color-green-ink)] hover:text-white text-xs font-bold inline-flex items-center justify-between gap-2 transition-colors cursor-pointer"
                  >
                    <span>{isEn ? 'Read Full Guide' : 'اقرأ الدليل بالكامل'}</span>
                    <DirArrow size={14} aria-hidden="true" />
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      <Modal
        open={Boolean(openArticle)}
        onClose={() => setOpenArticle(null)}
        title={openArticle?.title || ''}
        subtitle={
          openArticle
            ? `${openArticle.category} · ${
                isEn
                  ? `${openArticle.readTimeMinutes} min`
                  : `${openArticle.readTimeMinutes} دقائق قراءة`
              }`
            : undefined
        }
        size="lg"
      >
        {openArticle && (
          <div className="space-y-4">
            <div className="aspect-[16/9] rounded-xl overflow-hidden bg-[var(--color-cream)]">
              <SafeImage
                src={openArticle.imageUrl}
                alt={openArticle.title}
                width={800}
                height={450}
                className="w-full h-full object-cover"
              />
            </div>
            <p className="text-sm font-semibold text-[var(--color-ink)] leading-relaxed">
              {openArticle.excerpt}
            </p>
            <div className="text-sm text-[var(--color-muted)] leading-loose whitespace-pre-line border-t border-[var(--color-border)] pt-4">
              {openArticle.content}
            </div>
            <div className="pt-3 border-t border-[var(--color-border)] flex flex-wrap justify-between items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  setOpenArticle(null);
                  onNavigate('listings');
                }}
                className="min-h-[40px] px-4 py-2 rounded-xl bg-[var(--color-green)] text-white text-xs font-bold cursor-pointer"
              >
                {isEn ? 'Browse Matching Listings' : 'استعراض العروض المتاحة الآن'}
              </button>
              <button
                type="button"
                onClick={() => setOpenArticle(null)}
                className="min-h-[40px] px-4 py-2 rounded-xl border border-[var(--color-border)] text-xs font-bold cursor-pointer"
              >
                {isEn ? 'Close' : 'إغلاق'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </section>
  );
}

interface HelpCenterViewProps {
  faqs: FAQ[];
  onNavigate: (page: PageView) => void;
}

export function HelpCenterView({ faqs, onNavigate }: HelpCenterViewProps) {
  const { dir, isEn } = useI18n();
  const DirArrow = isEn ? ArrowRight : ArrowLeft;
  const [query, setQuery] = useState('');
  const [openId, setOpenId] = useState<string | null>(faqs[0]?.id || null);

  const visibleFaqs = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return faqs;
    return faqs.filter(
      (f) => f.question.toLowerCase().includes(q) || f.answer.toLowerCase().includes(q)
    );
  }, [faqs, query]);

  return (
    <section dir={dir} className="bg-[var(--color-canvas)] transition-colors">
      <DynamicHeroBanner
        pageKey="help"
        breadcrumbs={[
          { label: isEn ? 'Home' : 'الرئيسية', onClick: () => onNavigate('home') },
          { label: isEn ? 'Help Center & FAQ' : 'مركز المساعدة والأسئلة الشائعة' },
        ]}
        contextLabel={`${faqs.length} ${isEn ? 'verified answers' : 'سؤال شائع'}`}
        actions={
          <>
            <button
              type="button"
              onClick={() => onNavigate('contact')}
              className="min-h-[42px] px-4 py-2 rounded-xl bg-[#E6B85C] hover:bg-[#F0C670] text-[#0C261B] text-xs sm:text-sm font-extrabold inline-flex items-center gap-2 cursor-pointer"
            >
              <span>{isEn ? 'Contact Support Team' : 'تواصل مع فريق الدعم'}</span>
              <DirArrow size={14} aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => onNavigate('rules')}
              className="min-h-[42px] px-4 py-2 rounded-xl border border-white/30 bg-[#0B2A1E]/80 text-white text-xs sm:text-sm font-bold cursor-pointer"
            >
              {isEn ? 'Listing Rules & Moderation' : 'شروط النشر والمراجعة'}
            </button>
          </>
        }
      />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-6">
        <div className="relative">
          <Search
            size={16}
            className="absolute start-3.5 top-1/2 -translate-y-1/2 text-[var(--color-muted)] pointer-events-none"
            aria-hidden="true"
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={
              isEn
                ? 'Search questions about listings, verification, commission...'
                : 'ابحث في الأسئلة الشائعة عن الإعلانات، التوثيق، أو العمولة...'
            }
            className="w-full h-12 ps-10 pe-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] text-sm text-[var(--color-ink)] focus:outline-none focus:border-[var(--color-green-ink)]"
          />
        </div>

        <div className="space-y-3">
          {visibleFaqs.map((item) => {
            const expanded = openId === item.id;
            return (
              <article
                key={item.id}
                className="rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] overflow-hidden"
              >
                <button
                  type="button"
                  aria-expanded={expanded}
                  onClick={() => setOpenId(expanded ? null : item.id)}
                  className="w-full p-5 text-start flex items-center justify-between gap-4 cursor-pointer hover:bg-[var(--color-cream)]/40 transition-colors"
                >
                  <span className="font-display text-sm sm:text-base font-extrabold text-[var(--color-ink)]">
                    {item.question}
                  </span>
                  <ChevronDown
                    size={18}
                    className={`shrink-0 text-[var(--color-green-ink)] transition-transform duration-150 ${
                      expanded ? 'rotate-180' : ''
                    }`}
                    aria-hidden="true"
                  />
                </button>
                {expanded && (
                  <div className="px-5 pb-5 pt-1 text-sm text-[var(--color-muted)] leading-relaxed border-t border-[var(--color-border)]/60">
                    {item.answer}
                  </div>
                )}
              </article>
            );
          })}
        </div>

        <div className="rounded-2xl bg-[var(--color-cream)]/70 border border-[var(--color-border)] p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <HelpCircle size={22} className="text-[var(--color-green-ink)] shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              <h2 className="font-display text-base font-extrabold text-[var(--color-ink)]">
                {isEn ? 'Still need direct help?' : 'لم تجد إجابة سؤالك؟'}
              </h2>
              <p className="text-xs sm:text-sm text-[var(--color-muted)]">
                {isEn
                  ? 'Send a direct inquiry to our marketplace team with your phone or reference ID.'
                  : 'راسل فريق دعم مِرباح مباشرة وسنرد عليك في أقرب وقت.'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('contact')}
            className="min-h-[42px] px-5 py-2 rounded-xl bg-[var(--color-green)] hover:bg-[var(--color-green-hover)] text-white text-xs sm:text-sm font-bold whitespace-nowrap cursor-pointer shrink-0"
          >
            {isEn ? 'Contact Support' : 'تواصل معنا'}
          </button>
        </div>
      </div>
    </section>
  );
}

interface PolicyViewProps {
  mode: 'about' | 'rules' | 'privacy' | 'terms';
  onNavigate: (page: PageView) => void;
}

export function PolicyInfoView({ mode, onNavigate }: PolicyViewProps) {
  const { dir, isEn } = useI18n();
  const DirArrow = isEn ? ArrowRight : ArrowLeft;

  const contentMap = {
    about: {
      eyebrow: isEn ? 'Saudi Identity & Mission' : 'عن منصة مِرباح',
      sections: [
        {
          icon: ShieldCheck,
          title: isEn ? 'Direct Breeder-to-Buyer Marketplace' : 'سوق سعودي من المربي إلى المشتري',
          points: isEn
            ? [
                'Structured specs: breed, head count, age in months, approximate weight, vaccination status, and SAR pricing.',
                'Covers all 13 Saudi regions with verified breeder screening and authentic buyer reviews.',
                'No random middlemen or hidden broker markups.',
              ]
            : [
                'مواصفات منظمة تشمل السلالة، العدد، العمر بالأشهر، الوزن التقريبي، حالة التحصين، والسعر بالريال السعودي.',
                'تغطية شاملة لجميع مناطق المملكة الـ 13 مع نظام توثيق المربين وتقييمات المشترين الفعلية.',
                'تواصل مباشر بين البائع والمشتري بدون وسطاء عشوائيين.',
              ],
        },
        {
          icon: CheckCircle2,
          title: isEn ? 'Smart Tools & Transparent Commission' : 'أدوات تخطيط ذكية وعمولة واضحة',
          points: isEn
            ? [
                'Includes Feast Calculator, Carcass Weight Yield, Transport Cost Estimator, and Herd Feed Planner.',
                '100% free listing publication; only a 1% marketplace fee applies after an actual completed sale.',
              ]
            : [
                'حاسبات مجانية مدمجة: حاسبة الولائم، الأوزان والتصافي، تكلفة النقل، ومخطط الأعلاف والقطيع.',
                'نشر الإعلانات مجاني، وتُحتسب عمولة المنصة (1%) بعد إتمام البيع الفعلي فقط.',
              ],
        },
      ],
    },
    rules: {
      eyebrow: isEn ? 'Listing Moderation Standards' : 'ضوابط جودة الإعلانات والمراجعة',
      sections: [
        {
          icon: FileText,
          title: isEn ? 'Mandatory Specification Rules' : 'ضوابط المواصفات والصور المطلوبة',
          points: isEn
            ? [
                'Photos must clearly depict the actual livestock offered—no stock photos or misleading edits.',
                'Age in months, approximate weight, head count, region, and SAR price must reflect the real herd.',
                'Sold or unavailable listings must be updated promptly from My Account.',
              ]
            : [
                'يجب إرفاق صور حقيقية وواضحة للمواشي المعروضة وعدم استخدام صور مقتبسة أو مضللة.',
                'يشترط دقة البيانات المسجلة للعمر بالأشهر، الوزن التقريبي، العدد، المنطقة، والسعر بالريال السعودي.',
                'يلتزم البائع بتحديث حالة الإعلان إلى «مباع» فور إتمام الصفقة حفاظاً على وقت المشترين.',
              ],
        },
        {
          icon: ShieldCheck,
          title: isEn ? 'Moderation & Reporting' : 'المراجعة الإدارية ونظام البلاغات',
          points: isEn
            ? [
                'Duplicate, spam, or off-topic listings are rejected with clear moderation reasons.',
                'Any member can report inaccurate specifications directly from the listing detail page.',
              ]
            : [
                'ترفض الإدارة الإعلانات المكررة أو الوهمية أو المخالفة للضوابط مع توضيح سبب الرفض.',
                'يمكن لأي مستخدم الإبلاغ الفوري من صفحة الإعلان لمراجعة أي محتوى غير مطابق.',
              ],
        },
      ],
    },
    privacy: {
      eyebrow: isEn ? 'Member Privacy & Security' : 'سياسة الخصوصية وحماية البيانات',
      sections: [
        {
          icon: Lock,
          title: isEn ? 'How Account & Contact Data Are Protected' : 'حماية بيانات الحسابات وأرقام التواصل',
          points: isEn
            ? [
                'Phone numbers and account details are stored securely; direct phone reveals are rate-limited and protected.',
                'Passwords are hashed and protected with CSRF tokens and secure HTTP sessions.',
                'In-app conversations keep price offers and agreements logged safely without exposing sensitive info.',
              ]
            : [
                'تُحفظ بيانات الحساب وأرقام الجوال بأمان ولا يُكشف رقم البائع إلا عند الطلب المنظم من صفحة العرض.',
                'تخضع الجلسات لحماية متقدمة عبر التشفير ورموز التحقق لمنع الوصول غير المصرح به.',
                'تُحفظ سجل المحادثات وعروض السعر داخل المنصة لتوثيق التفاهم بين الطرفين.',
              ],
        },
      ],
    },
    terms: {
      eyebrow: isEn ? 'Terms & Service Agreement' : 'الشروط والأحكام واتفاقية الخدمة',
      sections: [
        {
          icon: FileText,
          title: isEn ? 'Marketplace Terms & 1% Fee Agreement' : 'أحكام الاستخدام ونظام العمولة 1%',
          points: isEn
            ? [
                'Mirbah serves as a specialized digital platform connecting livestock breeders and buyers directly.',
                'Buyers are advised to inspect livestock visually or request a veterinary check before final payment.',
                'Sellers agree to the 1% platform commission upon completed sales facilitated through the platform.',
              ]
            : [
                'يعمل مِرباح كمنصة رقمية منظمة لربط المربين بالمشترين في المملكة العربية السعودية.',
                'يُوصى بالمعاينة المباشرة أو طلب الفحص البيطري قبل تسليم المبلغ النهائي واستلام القطيع.',
                'يلتزم البائع بسداد عمولة المنصة (1%) عن البيعات المكتملة عبر الموقع، وتُدار عبر حاسبة السداد واللوحة.',
              ],
        },
      ],
    },
  }[mode];

  if (mode === 'about') {
    const DiagonalArrow = dir === 'rtl' ? ArrowUpLeft : ArrowUpRight;
    const aboutSteps = [
      {
        num: '01',
        title: isEn ? 'For Livestock Buyers' : 'للباحثين والمشترين',
        body: isEn
          ? 'Browse active livestock listings without even needing to sign in first; compare options by Saudi region, species, breed, age, approximate weight, and SAR price.'
          : 'تصفّح الإعلانات المنشورة بسهولة دون الحاجة لتسجيل الدخول مسبقاً؛ وقارن الخيارات حسب المنطقة، النوع، السلالة، العمر، الوزن التقريبي، والسعر بالريال السعودي.',
      },
      {
        num: '02',
        title: isEn ? 'For Breeders & Sellers' : 'للمربين والبائعين',
        body: isEn
          ? 'Publish detailed livestock listings with real photos and videos under your chosen membership package, receive direct offers, and manage your herd from your dashboard.'
          : 'أنشئ إعلانات حلالك بالصور والفيديو عبر حسابك الشخصي أو باقة المربي، وتابع مشاهداتك واستقبل رسائل المهتمين مباشرة من لوحة التحكم.',
      },
      {
        num: '03',
        title: isEn ? 'Direct Contact & Support' : 'التواصل والدعم المباشر',
        body: isEn
          ? 'Connect directly with sellers via phone, WhatsApp, or in-app chat from any listing page. Use our reporting and support center whenever assistance is needed.'
          : 'تواصل مباشرة مع البائع من صفحة الإعلان عبر الهاتف أو واتساب أو المحادثة الفورية، واستخدم قنوات الدعم والبلاغات في حال احتجت لأي مساعدة.',
      },
    ];

    const mobileHighlights = [
      {
        icon: Search,
        title: isEn ? 'Explore Listings Effortlessly' : 'استكشف الإعلانات بسهولة',
        desc: isEn
          ? 'Filter listings by Saudi region, species, breed, age, and SAR price.'
          : 'ابحث واستعرض العروض حسب المنطقة، النوع، السلالة، العمر، والسعر بالريال السعودي.',
      },
      {
        icon: Heart,
        title: isEn ? 'Quick Access to Favorites' : 'وصول سريع للمفضلة',
        desc: isEn
          ? 'Save listings you are interested in and return to compare them anytime.'
          : 'احفظ الإعلانات التي تهمك وعد إليها لمقارنة الأسعار والمواصفات في أي وقت.',
      },
      {
        icon: LayoutDashboard,
        title: isEn ? 'Manage Your Account Anywhere' : 'أدِر حسابك أينما كنت',
        desc: isEn
          ? 'Control your listings, messages, offers, and smart breeder calculators from one place.'
          : 'تحكّم بإعلاناتك ورسائلك وعروض الأسعار والحاسبات الذكية من مكان واحد.',
      },
    ];

    const aboutFaqs = [
      {
        num: '01',
        q: isEn ? 'What is Mirbah and what is its goal?' : 'ما هي منصة مِرباح وما هدفها؟',
        a: isEn
          ? 'Mirbah is a Saudi digital livestock marketplace built to bring breeders, sellers, and buyers together in an organized platform with transparent specs and SAR pricing benchmarks.'
          : 'مِرباح منصة سعودية رقمية متخصصة تجمع المربين والبائعين والمشترين في مكان واحد منظم بمواصفات واضحة للعمر والوزن والتحصين والأسعار الاسترشادية بالريال السعودي.',
      },
      {
        num: '02',
        q: isEn ? 'Who can use Mirbah?' : 'من يمكنه استخدام مِرباح؟',
        a: isEn
          ? 'Anyone searching for sheep, goats, or breeding rams across Saudi Arabia can browse listings, while individual breeders and commercial farm owners can register to publish and promote listings.'
          : 'يمكن لجميع الباحثين والمشترين تصفح العروض في كافة مناطق المملكة، كما يمكن للأفراد والمربين وأصحاب المراحات التجارية التسجيل لنشر الإعلانات والتواصل المباشر.',
      },
      {
        num: '03',
        q: isEn ? 'What is the difference between free and Pro/Max plans?' : 'ما الفرق بين الباقة المجانية وباقات برو وماكس؟',
        a: isEn
          ? 'The Start package lets breeders publish free listings seamlessly, while Pro and Max plans unlock higher listing limits, video uploads, priority search visibility, and monthly Boost credits.'
          : 'تتيح باقة البداية النشر المجاني بسهولة، بينما توفر باقات برو وماكس عدداً أكبر من الإعلانات النشطة، وإضافة الفيديو، وأولوية الظهور في نتائج البحث، ورصيد تمييز شهري.',
      },
      {
        num: '04',
        q: isEn ? 'Does Mirbah own or directly sell the livestock?' : 'هل مِرباح هو البائع المباشر للمواشي المعروضة؟',
        a: isEn
          ? 'No. Mirbah is the specialized digital platform where breeders and sellers publish their listings. Each seller is responsible for the accuracy of livestock details and condition.'
          : 'لا. مِرباح هو المنصة الرقمية التي يعرض فيها المربون والبائعون مواشيهم، ويتحمل صاحب الإعلان مسؤولية دقة البيانات والمواصفات المعروضة.',
      },
      {
        num: '05',
        q: isEn ? 'Who handles inspection, payment, and livestock transport?' : 'من يتولى المعاينة والدفع ونقل الحلال؟',
        a: isEn
          ? 'Agreement, inspection, payment, and transport take place directly between buyer and seller. We recommend verifying livestock health and details before finalizing payment, with a clear 1% seller fee upon completed sales.'
          : 'تتم المعاينة والاتفاق على السعر والدفع والنقل مباشرة بين البائع والمشتري، ونوصي دوماً بالمعاينة والتأكد قبل السداد النهائي، مع عمولة واضحة 1% على البائع بعد إتمام البيع عبر المنصة فقط.',
      },
      {
        num: '06',
        q: isEn ? 'How can I reach the Mirbah team?' : 'كيف يمكنني التواصل مع فريق مِرباح؟',
        a: isEn
          ? 'You can reach our team anytime through the Contact Us page, direct phone (+966 56 441 9966), WhatsApp, or email (kkfjahdali@icloud.com).'
          : 'يمكنك التواصل معنا في أي وقت عبر صفحة «تواصل معنا» لإرسال تذكرة برقم مرجعي، أو عبر الاتصال المباشر وواتساب على الرقم (+966 56 441 9966) والبريد الإلكتروني.',
      },
    ];

    return (
      <div dir={dir} className="bg-[var(--color-surface)] transition-colors">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          {/* 1. Editorial Page Header */}
          <header className="border-b border-[var(--color-border)] pb-12 pt-12 sm:pb-16 sm:pt-16">
            <p className="mb-4 text-xs font-extrabold tracking-wide text-[var(--color-gold-hover)] dark:text-[var(--color-gold)]">
              {isEn ? 'Digital Livestock Marketplace' : 'سوق المواشي الرقمي في المملكة'}
            </p>
            <h1 className="font-display text-4xl font-black tracking-tight text-[var(--color-ink)] sm:text-5xl">
              {isEn ? 'About Us' : 'من نحن'}
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-[var(--color-muted)]">
              {isEn
                ? 'We bring livestock buyers and breeders together in one organized Saudi marketplace, making it easy to compare options and connect directly.'
                : 'نجمع الباحثين عن الحلال مع المربين والبائعين في منصة سعودية واحدة؛ لنسهّل استعراض الخيارات ومقارنة المواصفات والتواصل المباشر.'}
            </p>
          </header>

          {/* 2. Asymmetric Intro + Numbered 01 / 02 / 03 List */}
          <section aria-labelledby="about-meet-heading" className="py-14 sm:py-20">
            <div className="grid gap-12 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-20">
              <div className="lg:pe-6">
                <span
                  className="mb-5 block h-1 w-12 rounded-full bg-[var(--color-gold)]"
                  aria-hidden="true"
                />
                <h2
                  id="about-meet-heading"
                  className="max-w-md font-display text-[30px] font-black leading-tight tracking-tight text-[var(--color-ink)] sm:text-[36px] text-balance"
                >
                  {isEn ? 'Meet Mirbah' : 'تعرّف على مِرباح'}
                </h2>
                <p className="mt-5 max-w-xl text-[16px] leading-8 text-[var(--color-muted)]">
                  {isEn
                    ? 'Mirbah is a dedicated platform that makes discovering livestock listings and reaching trusted breeders straightforward across all 13 Saudi regions.'
                    : 'مِرباح منصة متخصصة تجعل الوصول إلى إعلانات الحلال والتواصل مع المربين الموثوقين أمراً سهلاً ومنظماً في كافة مناطق المملكة الـ ١٣. يمكن للمشترين مقارنة العروض بدقة، وللبائعين عرض مواشيهم بتفاصيل كاملة.'}
                </p>
                <p className="mt-4 max-w-xl text-[15px] leading-7 text-[var(--color-muted)]">
                  {isEn
                    ? 'We provide the trusted digital listing and messaging environment. Livestock inspection, sale terms, payment, and transport are agreed directly between buyer and seller.'
                    : 'نحن نوفر بيئة النشر والتواصل الموثوقة، مع حاسبات ذكية للولائم والأوزان والنقل والأعلاف. بينما تبقى المعاينة، اتفاق البيع، السداد، والنقل قراراً مباشراً بين المشتري والبائع.'}
                </p>
                <button
                  type="button"
                  onClick={() => onNavigate('listings')}
                  className="mt-8 inline-flex items-center gap-2 border-b-2 border-[var(--color-gold)] pb-1 text-sm font-bold text-[var(--color-ink)] transition-colors hover:text-[var(--color-green-ink)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--color-gold)] cursor-pointer"
                >
                  <span>{isEn ? 'Browse Active Listings' : 'تصفح الإعلانات'}</span>
                  <DirArrow className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>

              <div className="border-t border-[var(--color-border)]">
                {aboutSteps.map((step) => (
                  <div
                    key={step.num}
                    className="grid gap-3 border-b border-[var(--color-border)] py-6 sm:grid-cols-[3rem_1fr] sm:gap-5 sm:py-7"
                  >
                    <span
                      aria-hidden="true"
                      className="text-xs font-extrabold tabular-nums text-[var(--color-gold-hover)] dark:text-[var(--color-gold)]"
                    >
                      {step.num}
                    </span>
                    <div>
                      <h3 className="font-display text-lg font-bold text-[var(--color-ink)]">
                        {step.title}
                      </h3>
                      <p className="mt-2 max-w-lg text-[14px] leading-7 text-[var(--color-muted)]">
                        {step.body}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* 3. Mobile / Platform Showcase Banner (Matches Celebim Phone Mockup Card) */}
          <section
            aria-labelledby="about-platform-showcase"
            className="mb-16 overflow-hidden rounded-3xl border border-[var(--color-gold)]/35 bg-[var(--color-cream)]/60 sm:mb-20"
          >
            <div className="grid lg:grid-cols-[0.9fr_1.1fr]">
              {/* Phone Frame Visual */}
              <div className="relative flex min-h-[280px] items-center justify-center overflow-hidden bg-[var(--color-cream)] p-10 sm:min-h-[360px]">
                <div
                  className="absolute -start-20 -top-20 h-52 w-52 rounded-full bg-[var(--color-green)]/10"
                  aria-hidden="true"
                />
                <div
                  className="absolute -bottom-24 -end-16 h-64 w-64 rounded-full bg-[var(--color-surface)]/75"
                  aria-hidden="true"
                />

                <div className="relative flex w-[216px] flex-col items-center rounded-[2.5rem] border-[8px] border-[#103C2C] bg-[var(--color-surface)] px-5 pb-7 pt-8 shadow-[0_24px_60px_rgba(16,60,44,0.22)]">
                  <span
                    className="absolute top-2 h-1.5 w-16 rounded-full bg-[#103C2C]"
                    aria-hidden="true"
                  />
                  <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-[var(--color-cream)] text-[var(--color-green-ink)] border border-[var(--color-border)]">
                    <ShieldCheck size={38} strokeWidth={1.8} aria-hidden="true" />
                  </div>
                  <p className="mt-5 font-display text-lg font-black text-[var(--color-ink)]">
                    {isEn ? 'Mirbah' : 'مِرباح'}
                  </p>
                  <p className="mt-1 text-center text-xs leading-5 text-[var(--color-muted)]">
                    {isEn
                      ? 'Your digital livestock market right in your pocket.'
                      : 'سوق المواشي الرقمي بين يديك في كل وقت.'}
                  </p>
                  <button
                    type="button"
                    onClick={() => onNavigate('listings')}
                    className="mt-6 rounded-full bg-[var(--color-green)] hover:bg-[var(--color-green-hover)] px-5 py-2 text-xs font-bold text-white transition-colors cursor-pointer whitespace-nowrap"
                  >
                    {isEn ? 'Explore Market' : 'تصفح السوق الآن'}
                  </button>
                </div>
              </div>

              {/* Platform Highlights Content */}
              <div className="p-6 sm:p-10 lg:p-12">
                <p className="text-[11px] font-extrabold tracking-wide text-[var(--color-gold-hover)] dark:text-[var(--color-gold)]">
                  {isEn ? 'SEAMLESS MOBILE EXPERIENCE' : 'تجربة متكاملة على الجوال'}
                </p>
                <h2
                  id="about-platform-showcase"
                  className="mt-3 font-display text-3xl font-black tracking-tight text-[var(--color-ink)] sm:text-4xl text-balance"
                >
                  {isEn ? 'Carry Mirbah With You' : 'مِرباح معك أينما كنت'}
                </h2>
                <p className="mt-4 max-w-xl text-[15px] leading-7 text-[var(--color-muted)]">
                  {isEn
                    ? 'Access live Saudi livestock listings quickly from your phone, track offers, and use smart planning calculators wherever you are.'
                    : 'تصفّح عروض المواشي من جوالك بسرعة وسهولة، وتابع رسائلك وعروضك وحاسباتك الذكية أينما كنت في المملكة.'}
                </p>

                <div className="mt-8 space-y-5">
                  {mobileHighlights.map((item) => {
                    const Icon = item.icon;
                    return (
                      <div key={item.title} className="flex gap-4">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-green-ink)] shadow-xs">
                          <Icon size={18} aria-hidden="true" />
                        </div>
                        <div>
                          <h3 className="text-sm font-bold text-[var(--color-ink)]">
                            {item.title}
                          </h3>
                          <p className="mt-1 text-sm leading-6 text-[var(--color-muted)]">
                            {item.desc}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-8 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => onNavigate('add')}
                    className="inline-flex min-h-[46px] items-center justify-center gap-2 rounded-xl bg-[var(--color-green)] hover:bg-[var(--color-green-hover)] px-6 py-2.5 text-sm font-bold text-white transition-colors cursor-pointer whitespace-nowrap"
                  >
                    <span>{isEn ? 'Post a Listing Now' : 'أضف إعلانك الآن'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onNavigate('services')}
                    className="inline-flex min-h-[46px] items-center justify-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-green-ink)] px-5 py-2.5 text-sm font-bold text-[var(--color-ink)] hover:text-[var(--color-green-ink)] transition-colors cursor-pointer whitespace-nowrap"
                  >
                    <span>{isEn ? 'Smart Calculators' : 'حاسبات وخدمات المربين'}</span>
                  </button>
                </div>
              </div>
            </div>
          </section>

          {/* 4. Editorial Numbered FAQ Section */}
          <section
            id="about-faq"
            aria-labelledby="about-faq-heading"
            className="py-10 sm:py-14"
          >
            <div className="grid gap-10 lg:grid-cols-[minmax(0,0.75fr)_minmax(0,1.25fr)] lg:gap-16 xl:gap-24">
              <div className="lg:pt-1">
                <div className="mb-6 flex items-center gap-3">
                  <span className="h-px w-8 bg-[var(--color-gold)]" aria-hidden="true" />
                  <span className="text-[11px] font-extrabold tracking-wide text-[var(--color-gold-hover)] dark:text-[var(--color-gold)]">
                    {isEn ? 'Get to know us' : 'تعرّف على مِرباح'}
                  </span>
                </div>
                <h2
                  id="about-faq-heading"
                  className="max-w-md font-display text-[30px] font-black leading-[1.15] tracking-tight text-[var(--color-ink)] sm:text-[36px] text-balance"
                >
                  {isEn
                    ? 'Frequently Asked About Mirbah'
                    : 'كل ما يهمك معرفته عن مِرباح'}
                </h2>
                <p className="mt-5 max-w-md text-[15px] leading-7 text-[var(--color-muted)]">
                  {isEn
                    ? 'Clear answers on how our marketplace operates, membership options, and our role in livestock transactions.'
                    : 'إجابات موجزة حول أهداف المنصة، نظام العضوية والباقات، وآلية البيع والشراء المباشر.'}
                </p>

                <div className="mt-8 pt-5 border-t border-[var(--color-border)]">
                  <p className="text-[13px] leading-6 text-[var(--color-muted)]">
                    {isEn ? 'Did not find your answer here?' : 'لم تجد الإجابة التي تبحث عنها؟'}
                  </p>
                  <button
                    type="button"
                    onClick={() => onNavigate('contact')}
                    className="mt-1 inline-flex items-center gap-1.5 text-[14px] font-bold text-[var(--color-green-ink)] underline-offset-4 hover:underline cursor-pointer"
                  >
                    <span>{isEn ? 'Contact us' : 'تواصل معنا'}</span>
                    <DiagonalArrow className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              </div>

              <div className="border-t border-[var(--color-border)]">
                {aboutFaqs.map((faq) => (
                  <details
                    key={faq.num}
                    className="group border-b border-[var(--color-border)]"
                  >
                    <summary className="flex cursor-pointer list-none items-start gap-4 py-5 text-start marker:hidden focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-gold)] sm:gap-5 sm:py-6 [&::-webkit-details-marker]:hidden">
                      <span
                        aria-hidden="true"
                        className="mt-1 shrink-0 text-[12px] font-bold tabular-nums tracking-wide text-[var(--color-gold-hover)] dark:text-[var(--color-gold)]"
                      >
                        {faq.num}
                      </span>
                      <span className="flex-1 text-[15px] font-bold leading-6 text-[var(--color-ink)] transition-colors group-hover:text-[var(--color-green-ink)] sm:text-[17px]">
                        {faq.q}
                      </span>
                      <span
                        aria-hidden="true"
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[var(--color-border)] text-[var(--color-green-ink)] transition-colors group-open:border-[var(--color-green)] group-open:bg-[var(--color-green)] group-open:text-white"
                      >
                        <span className="relative block h-3 w-3 transition-transform duration-200 group-open:rotate-45">
                          <span className="absolute inset-x-0 top-1/2 h-[1.5px] -translate-y-1/2 bg-current" />
                          <span className="absolute inset-y-0 left-1/2 w-[1.5px] -translate-x-1/2 bg-current" />
                        </span>
                      </span>
                    </summary>
                    <p className="pb-6 ps-9 pe-6 text-[14px] leading-7 text-[var(--color-muted)] sm:ps-10 sm:pe-12">
                      {faq.a}
                    </p>
                  </details>
                ))}
              </div>
            </div>
          </section>

          {/* 5. Bottom CTA Strip */}
          <div className="flex flex-col gap-6 border-t border-[var(--color-border)] py-12 sm:flex-row sm:items-center sm:justify-between sm:py-16">
            <div>
              <p className="text-xs font-extrabold tracking-wide text-[var(--color-gold-hover)] dark:text-[var(--color-gold)]">
                {isEn ? 'Next step' : 'الخطوة التالية'}
              </p>
              <h2 className="mt-2 font-display text-2xl font-black text-[var(--color-ink)]">
                {isEn ? 'Take your place on Mirbah.' : 'احجز مكانك في مِرباح.'}
              </h2>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => onNavigate('add')}
                className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-[var(--color-green)] hover:bg-[var(--color-green-hover)] px-5 py-3 text-sm font-bold text-white transition-colors cursor-pointer whitespace-nowrap"
              >
                {isEn ? 'Start Posting a Listing' : 'ابدأ بنشر إعلانك'}
              </button>
              <button
                type="button"
                onClick={() => onNavigate('contact')}
                className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-[var(--color-border)] px-5 py-3 text-sm font-bold text-[var(--color-ink)] transition-colors hover:border-[var(--color-green-ink)] hover:text-[var(--color-green-ink)] cursor-pointer whitespace-nowrap"
              >
                {isEn ? 'Get in Touch' : 'تواصل معنا'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <section dir={dir} className="bg-[var(--color-canvas)] transition-colors">
      <DynamicHeroBanner
        pageKey={mode}
        breadcrumbs={[
          { label: isEn ? 'Home' : 'الرئيسية', onClick: () => onNavigate('home') },
          { label: contentMap.eyebrow },
        ]}
        actions={
          <button
            type="button"
            onClick={() => onNavigate('listings')}
            className="min-h-[42px] px-4 py-2 rounded-xl bg-[#E6B85C] hover:bg-[#F0C670] text-[#0C261B] text-xs sm:text-sm font-extrabold inline-flex items-center gap-2 cursor-pointer"
          >
            <span>{isEn ? 'Browse Active Listings' : 'تصفح الإعلانات الآن'}</span>
            <DirArrow size={14} aria-hidden="true" />
          </button>
        }
      />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-6">
        {contentMap.sections.map((sec) => {
          const Icon = sec.icon;
          return (
            <article
              key={sec.title}
              className="rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] p-6 sm:p-7 space-y-4"
            >
              <div className="flex items-center gap-3">
                <span className="w-10 h-10 rounded-xl bg-[var(--color-cream)] border border-[var(--color-border)] text-[var(--color-green-ink)] flex items-center justify-center shrink-0">
                  <Icon size={20} aria-hidden="true" />
                </span>
                <h2 className="font-display text-xl font-extrabold text-[var(--color-ink)]">
                  {sec.title}
                </h2>
              </div>
              <ul className="space-y-2.5 text-sm text-[var(--color-muted)]">
                {sec.points.map((pt) => (
                  <li key={pt} className="flex items-start gap-2.5 leading-relaxed">
                    <CheckCircle2
                      size={15}
                      className="text-[var(--color-green-ink)] shrink-0 mt-1"
                      aria-hidden="true"
                    />
                    <span>{pt}</span>
                  </li>
                ))}
              </ul>
            </article>
          );
        })}

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-[var(--color-cream)]/70 border border-[var(--color-border)] p-5">
          <div className="flex flex-wrap gap-2">
            {(
              [
                { page: 'about' as const, label: isEn ? 'About Us' : 'من نحن' },
                { page: 'rules' as const, label: isEn ? 'Listing Rules' : 'شروط النشر' },
                { page: 'privacy' as const, label: isEn ? 'Privacy Policy' : 'سياسة الخصوصية' },
                { page: 'terms' as const, label: isEn ? 'Terms & Agreement' : 'الشروط والأحكام' },
                { page: 'help' as const, label: isEn ? 'Help Center' : 'مركز المساعدة' },
              ]
            ).map((navItem) => (
              <button
                key={navItem.page}
                type="button"
                onClick={() => onNavigate(navItem.page)}
                className={`min-h-[36px] px-3 py-1 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
                  mode === navItem.page
                    ? 'bg-[var(--color-green)] text-white'
                    : 'bg-[var(--color-surface)] text-[var(--color-green-ink)] border border-[var(--color-border)] hover:border-[var(--color-gold)]'
                }`}
              >
                {navItem.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => onNavigate('contact')}
            className="text-xs font-bold text-[var(--color-green-ink)] hover:underline cursor-pointer"
          >
            {isEn ? 'Questions? Contact Support' : 'لديك استفسار؟ تواصل معنا'}
          </button>
        </div>
      </div>
    </section>
  );
}
