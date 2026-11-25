import { useEffect, useState } from 'react';

interface ListingsHeroBannerProps {
  headingId?: string;
  searchQuery?: string;
  onGoHome?: () => void;
  onBrowseListings?: () => void;
  isEn?: boolean;
}

interface BannerSlide {
  src: string;
  altAr: string;
  altEn: string;
  objectPositionClass: string;
}

const BANNER_SLIDES: BannerSlide[] = [
  {
    src: '/src/assets/images/listings_hero_sheep_pen_1795504704605.jpg',
    altAr: 'أغنام سعودية صحية داخل مراح مشمس',
    altEn: 'Healthy white Saudi Harri sheep in a sunlit livestock pen',
    objectPositionClass: 'object-[28%_45%] sm:object-[25%_42%]',
  },
  {
    src: '/src/assets/images/hero_breeds_discovery_1795031278390.jpg',
    altAr: 'أغنام سعودية أصيلة من سلالات النعيمي والنجدي في مرعى مشمس',
    altEn: 'Authentic Naimi and Najdi Saudi sheep in a golden desert pasture',
    objectPositionClass: 'object-[36%_52%] sm:object-[28%_50%]',
  },
  {
    src: '/src/assets/images/hero_seller_ranch_1795031279075.jpg',
    altAr: 'مراح أغنام سعودي منظم وسط النخيل والحظائر الحجرية النظيفة',
    altEn: 'Organized Saudi sheep ranch surrounded by date palms and clean stone pens',
    objectPositionClass: 'object-[28%_60%] sm:object-[22%_58%]',
  },
  {
    src: '/src/assets/images/hero_green_pasture_sunset_1795288735497.jpg',
    altAr: 'قطيع أغنام في مرعى جبلي أخضر وقت الغروب في المملكة',
    altEn: 'Sheep herd grazing in a green mountain pasture at golden sunset',
    objectPositionClass: 'object-[32%_55%] sm:object-[26%_52%]',
  },
];

const AUTO_SLIDE_INTERVAL_MS = 3800;

// Exact organic torn-paper bottom edge contour inspired by marah-meat.com
const MARAH_TORN_EDGE_PATH =
  'M0,11.8 L8.0,15.1 L16.1,11.8 L24.1,16.4 L32.2,22.3 L40.2,23.6 L48.3,25.5 L56.3,26.2 L64.4,22.9 L72.4,23.6 L80.4,23.6 L88.5,23.6 L96.5,24.2 L104.6,24.9 L112.6,20.9 L120.7,19.6 L128.7,17.7 L136.8,20.9 L144.8,20.9 L152.8,20.9 L160.9,19.6 L168.9,20.9 L177.0,20.9 L185.0,20.9 L193.1,20.9 L201.1,19.6 L209.2,15.7 L217.2,13.1 L225.3,11.8 L233.3,9.2 L241.3,5.9 L249.4,5.9 L257.4,5.9 L265.5,7.2 L273.5,8.5 L281.6,11.1 L289.6,11.8 L297.7,13.1 L305.7,15.7 L313.7,22.9 L321.8,24.9 L329.8,27.5 L337.9,32.7 L345.9,30.1 L354.0,30.1 L362.0,30.1 L370.1,24.2 L378.1,24.9 L386.1,24.9 L394.2,26.2 L402.2,24.9 L410.3,26.8 L418.3,35.3 L426.4,34.7 L434.4,32.7 L442.5,30.1 L450.5,35.3 L458.5,42.5 L466.6,43.2 L474.6,45.8 L482.7,47.1 L490.7,48.4 L498.8,48.4 L506.8,53.7 L514.9,53.7 L522.9,52.4 L530.9,53.7 L539.0,52.4 L547.0,56.3 L555.1,53.7 L563.1,52.4 L571.2,48.4 L579.2,45.8 L587.3,43.2 L595.3,40.6 L603.4,38.0 L611.4,36.7 L619.4,34.7 L627.5,29.5 L635.5,26.8 L643.6,35.3 L651.6,32.7 L659.7,32.7 L667.7,31.4 L675.8,27.5 L683.8,22.3 L691.8,19.6 L699.9,18.3 L707.9,14.4 L716.0,13.7 L724.0,15.7 L732.1,12.4 L740.1,14.4 L748.2,15.7 L756.2,17.0 L764.2,20.9 L772.3,19.6 L780.3,19.6 L788.4,22.3 L796.4,22.3 L804.5,22.9 L812.5,24.9 L820.6,28.8 L828.6,32.1 L836.6,33.4 L844.7,32.7 L852.7,35.3 L860.8,34.0 L868.8,31.4 L876.9,29.5 L884.9,26.8 L893.0,24.9 L901.0,20.9 L909.1,19.0 L917.1,22.9 L925.1,24.9 L933.2,27.5 L941.2,30.1 L949.3,31.4 L957.3,36.0 L965.4,36.7 L973.4,36.0 L981.5,35.3 L989.5,38.6 L997.5,41.9 L1005.6,45.8 L1013.6,49.1 L1021.7,53.7 L1029.7,52.4 L1037.8,48.4 L1045.8,45.8 L1053.9,41.9 L1061.9,37.3 L1069.9,34.0 L1078.0,32.1 L1086.0,33.4 L1094.1,35.3 L1102.1,38.6 L1110.2,39.3 L1118.2,40.6 L1126.3,40.6 L1134.3,40.6 L1142.3,39.3 L1150.4,36.7 L1158.4,38.0 L1166.5,35.3 L1174.5,34.0 L1182.6,32.7 L1190.6,30.1 L1198.7,30.1 L1206.7,30.1 L1214.7,35.3 L1222.8,35.3 L1230.8,34.0 L1238.9,34.0 L1246.9,31.4 L1255.0,28.8 L1263.0,28.8 L1271.1,28.1 L1279.1,35.3 L1287.2,32.7 L1295.2,32.1 L1303.2,34.0 L1311.3,31.4 L1319.3,30.1 L1327.4,27.5 L1335.4,28.8 L1343.5,30.8 L1351.5,36.7 L1359.6,38.6 L1367.6,43.2 L1375.6,41.9 L1383.7,47.1 L1391.7,45.2 L1399.8,44.5 L1407.8,41.9 L1415.9,39.3 L1423.9,35.3 L1432.0,34.0 L1440.0,34.0 L1440,72 L0,72 Z';

export function ListingsHeroBanner({
  headingId = 'directory-page-heading',
  searchQuery = '',
  onGoHome,
  onBrowseListings,
  isEn = false,
}: ListingsHeroBannerProps) {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % BANNER_SLIDES.length);
    }, AUTO_SLIDE_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [activeIndex]);

  const trimmedQuery = searchQuery.trim();

  const subtitle = trimmedQuery
    ? isEn
      ? `Search results for "${trimmedQuery}" — inspect age, weight, vaccination status, and SAR pricing.`
      : `نتائج البحث الحالية عن «${trimmedQuery}» — تصفّح المواصفات والعمر والوزن والتحصين بالريال السعودي.`
    : isEn
    ? 'Carefully raised, veterinary-checked livestock with direct breeder contact across Saudi Arabia.'
    : 'تربية بعناية وتحصين بيطري وتواصل مباشر مع المربين في جميع مناطق المملكة.';

  return (
    <section
      aria-labelledby={headingId}
      className="relative w-full overflow-hidden bg-[#0E261C] min-h-[300px] sm:min-h-[380px] lg:min-h-[440px] flex items-center"
    >
      {/* Auto-Rotating Background Livestock Photographs */}
      {BANNER_SLIDES.map((slide, index) => {
        const isActive = index === activeIndex;
        return (
          <img
            key={slide.src}
            src={slide.src}
            alt={isEn ? slide.altEn : slide.altAr}
            referrerPolicy="no-referrer"
            aria-hidden={!isActive}
            fetchPriority={index === 0 ? 'high' : 'auto'}
            loading={index === 0 ? 'eager' : 'lazy'}
            className={`absolute inset-0 w-full h-full object-cover ${slide.objectPositionClass} transition-[opacity,transform] duration-1000 ease-in-out ${
              isActive ? 'opacity-100 scale-100 z-0' : 'opacity-0 scale-[1.03] z-0 pointer-events-none'
            }`}
          />
        );
      })}

      {/* Emerald-Woodland Contrast Scrim (Mobile) */}
      <div
        aria-hidden="true"
        className="md:hidden absolute inset-0 z-10 pointer-events-none"
        style={{
          background:
            'linear-gradient(to top, rgba(11, 35, 26, 0.90) 0%, rgba(16, 60, 44, 0.66) 55%, rgba(11, 35, 26, 0.34) 100%)',
        }}
      />

      {/* Emerald-Woodland Contrast Scrim (Desktop RTL/LTR) */}
      <div
        aria-hidden="true"
        className="hidden md:block absolute inset-0 z-10 pointer-events-none"
        style={{
          background: isEn
            ? 'linear-gradient(to right, rgba(11, 35, 26, 0.92) 0%, rgba(16, 60, 44, 0.76) 38%, rgba(16, 60, 44, 0.22) 66%, transparent 92%)'
            : 'linear-gradient(to left, rgba(11, 35, 26, 0.92) 0%, rgba(16, 60, 44, 0.76) 38%, rgba(16, 60, 44, 0.22) 66%, transparent 92%)',
        }}
      />

      {/* Foreground Copy & Single Primary CTA */}
      <div className="relative z-20 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-16 sm:pt-12 sm:pb-20">
        <div className="max-w-xl text-start">
          <nav
            aria-label={isEn ? 'Breadcrumb' : 'مسار التنقل'}
            className="mb-3 flex items-center gap-2 text-xs font-semibold text-white/80"
          >
            {onGoHome ? (
              <button
                type="button"
                onClick={onGoHome}
                className="hover:text-[#F4C569] transition-colors cursor-pointer"
              >
                {isEn ? 'Home' : 'الرئيسية'}
              </button>
            ) : (
              <span>{isEn ? 'Home' : 'الرئيسية'}</span>
            )}
            <span aria-hidden="true" className="text-white/45">
              /
            </span>
            <span className="text-[#F4C569]">{isEn ? 'Listings Directory' : 'دليل الإعلانات'}</span>
          </nav>

          <h1
            id={headingId}
            className="font-display text-3xl sm:text-5xl font-black text-white leading-[1.24] tracking-tight drop-shadow-sm"
          >
            {isEn ? (
              <>
                From Verified Saudi Ranches
                <br />
                Directly to Your Choice
              </>
            ) : (
              <>
                من مراح المربين الموثقين
                <br />
                مباشرةً إلى اختيارك
              </>
            )}
          </h1>

          <p className="mt-3 sm:mt-4 text-sm sm:text-base font-medium text-emerald-50/95 leading-relaxed max-w-md">
            {subtitle}
          </p>

          <div className="mt-5 sm:mt-6 flex flex-wrap items-center gap-4">
            {onBrowseListings && (
              <button
                type="button"
                onClick={onBrowseListings}
                className="min-h-[44px] px-7 py-2.5 rounded-lg bg-[#F4C569] hover:bg-[#ffd582] text-[#0B231A] text-sm sm:text-base font-extrabold shadow-lg transition-all cursor-pointer whitespace-nowrap"
              >
                {isEn ? 'Browse Now' : 'تصفّح الآن'}
              </button>
            )}

            {/* Minimal Slide Indicators */}
            <div
              className="flex items-center gap-1"
              role="tablist"
              aria-label={isEn ? 'Banner slides' : 'شرائح البانر'}
            >
              {BANNER_SLIDES.map((slide, index) => {
                const isActive = index === activeIndex;
                return (
                  <button
                    key={slide.src}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    aria-label={isEn ? `Slide ${index + 1}` : `الشريحة ${index + 1}`}
                    onClick={() => setActiveIndex(index)}
                    className="py-2 px-1 flex items-center justify-center cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F4C569] rounded"
                  >
                    <span
                      className={`block h-2 rounded-full transition-all duration-300 ${
                        isActive
                          ? 'w-7 bg-[#F4C569]'
                          : 'w-2 bg-white/45 hover:bg-white/75'
                      }`}
                    />
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Organic Torn-Paper Bottom Edge Matching marah-meat.com */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-px inset-x-0 z-20 overflow-hidden leading-none"
      >
        <svg
          viewBox="0 0 1440 72"
          preserveAspectRatio="none"
          className="block w-full h-8 sm:h-12 lg:h-14"
        >
          <defs>
            <filter id="listings-hero-torn-shadow" x="-2%" y="-25%" width="104%" height="150%">
              <feDropShadow dx="0" dy="-2" stdDeviation="2.5" floodColor="#000000" floodOpacity="0.24" />
            </filter>
          </defs>
          <path
            d={MARAH_TORN_EDGE_PATH}
            filter="url(#listings-hero-torn-shadow)"
            className="fill-[var(--color-canvas)]"
          />
        </svg>
      </div>
    </section>
  );
}
