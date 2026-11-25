import {
  BREED_LABEL_BY_ID,
  REGION_LABEL_BY_ID,
} from './saudiQueryNormalizer';
import type {
  AiProvider,
  AiProviderInput,
  AiProviderOutput,
  AiStreamCallbacks,
} from './types';

function formatSar(amount: number): string {
  return `${Math.round(amount).toLocaleString('en-US')} ر.س`;
}

export class MockAiProvider implements AiProvider {
  readonly name = 'mock' as const;

  async generateReply(input: AiProviderInput): Promise<AiProviderOutput> {
    const { context, userMessage, attachments } = input;
    const {
      intent,
      listings,
      totalMatchingListings,
      breedGuides,
      normalizedQuery,
      clarificationStage,
      marketStats,
      focusedListing,
      focusedSeller,
    } = context;
    const norm = normalizedQuery.normalizedText;
    const isEnglishPrompt =
      input.locale === 'en' && !/[\u0600-\u06FF]/.test(userMessage);

    if (attachments && attachments.length > 0) {
      const names = attachments.map((a) => a.name).join('، ');
      return {
        provider: 'mock',
        text: isEnglishPrompt
          ? [
              `Received attachment(s): ${names}.`,
              'Note: Multimodal visual/PDF analysis requires Gemini API (`GEMINI_API_KEY`) to be enabled on the server. I can only describe visible traits once Gemini is active and never issue veterinary diagnoses or definitive weight/age/price claims from images alone.',
              listings.length > 0
                ? `Here are ${listings.length} matching published marketplace listings:`
                : 'Tell me the breed or region and I can search published marketplace listings right away.',
            ].join('\n')
          : [
              `استلمت المرفقات (${names}).`,
              'ملاحظة: تحليل الصور ومستندات PDF يعتمد على مزود Gemini عندما يكون مفتاح `GEMINI_API_KEY` مفعّلاً على الخادم، ولا أقدم تشخيصاً بيطرياً أو أحكاماً قاطعة للعمر أو الوزن أو السعر من الصور.',
              listings.length > 0
                ? `في الوقت نفسه، إليك ${listings.length} إعلانات منشورة مرتبطة في السوق:`
                : 'يمكنك كتابة السلالة أو المنطقة وسأعرض لك العروض المنشورة المطابقة فوراً.',
            ].join('\n'),
        ...(listings.length > 0 ? { cards: listings } : {}),
        ...(marketStats ? { stats: marketStats } : {}),
      };
    }

    if (focusedListing && /(?:هذا\s+الاعلان|الاعلان\s+الحالي|تفاصيله|السوم\s+عليه|this\s+listing)/iu.test(norm || userMessage)) {
      return {
        provider: 'mock',
        text: [
          `بخصوص الإعلان الحالي **${focusedListing.title}**:`,
          `• السعر المطلوب: ${formatSar(focusedListing.priceAmount)} (${focusedListing.isNegotiable ? 'قابل للتفاوض' : 'سعر محدد'}).`,
          `• المواصفات: ${focusedListing.breedName}، العمر ${focusedListing.ageMonths} شهر، الوزن التقريبي ${focusedListing.weightKg} كجم، الكمية ${focusedListing.quantity}، ${focusedListing.vaccinated ? 'محصّن' : 'التحصين غير محدد'}.`,
          `• البائع: ${focusedListing.sellerDisplayName}${focusedListing.sellerVerified ? ' (مربي موثق)' : ''}.`,
        ].join('\n'),
        cards: [focusedListing],
      };
    }

    if (focusedSeller && /(?:هذا\s+المربي|هذا\s+البائع|صفحة\s+المربي|this\s+seller|this\s+breeder)/iu.test(norm || userMessage)) {
      return {
        provider: 'mock',
        text: [
          `المربي الذي تتصفحه الآن: **${focusedSeller.displayName}**${focusedSeller.verified ? ' (مربي موثق)' : ''}.`,
          focusedSeller.regionName
            ? `• الموقع العام: ${focusedSeller.regionName}${focusedSeller.city ? ` - ${focusedSeller.city}` : ''}.`
            : '',
          focusedSeller.specialty ? `• التخصص: ${focusedSeller.specialty}.` : '',
        ]
          .filter(Boolean)
          .join('\n'),
      };
    }

    if (marketStats && marketStats.count > 0) {
      return {
        provider: 'mock',
        text: [
          `إحصائيات السوق الفعلية من **${marketStats.count}** إعلان منشور${marketStats.breedName ? ` لسلالة ${marketStats.breedName}` : ''}${marketStats.regionName ? ` في ${marketStats.regionName}` : ''}:`,
          `• أقل سعر: **${formatSar(marketStats.minPrice)}** | الوسيط: **${formatSar(marketStats.medianPrice)}** | المتوسط: **${formatSar(marketStats.avgPrice)}** | أعلى سعر: **${formatSar(marketStats.maxPrice)}**.`,
        ].join('\n'),
        stats: marketStats,
      };
    }

    if (intent === 'greeting') {
      if (/السلام عليكم|سلام عليكم|سلام\b/u.test(norm)) {
        return {
          provider: 'mock',
          text: 'وعليكم السلام ورحمة الله وبركاته، حيّاك الله! كيف أقدر أساعدك؟',
        };
      }
      if (/صباح الخير|صباح النور/u.test(norm)) {
        return {
          provider: 'mock',
          text: 'صباح النور! حيّاك الله في مِرباح.',
        };
      }
      if (/مساء الخير|مساء النور/u.test(norm)) {
        return {
          provider: 'mock',
          text: 'مساء النور والسرور! حيّاك الله، كيف أقدر أخدمك اليوم؟',
        };
      }
      return {
        provider: 'mock',
        text: 'هلا والله وحيّاك! تحت أمرك، وش حاب تسأل عنه اليوم؟',
      };
    }

    if (intent === 'casual_chat') {
      if (/كيف\s+حالك|كيفك|شلونك|وش\s+اخبارك|اخبارك|علومك/u.test(norm)) {
        return {
          provider: 'mock',
          text: 'الحمد لله بخير، تسلم على سؤالك! كيف أقدر أخدمك اليوم؟',
        };
      }
      if (/وش\s+اسمك|ما\s+اسمك|من\s+انت|مين\s+انت|عرفني\s+عليك/u.test(norm)) {
        return {
          provider: 'mock',
          text: 'أنا المساعد الذكي لمِرباح، أساعدك في البحث عن المواشي والسلالات والأسعار واستخدام المنصة.',
        };
      }
      if (/انت\s+(?:انسان|بشر|حقيقي|روبوت|بوت|ذكاء)/u.test(norm)) {
        return {
          provider: 'mock',
          text: 'لا، أنا مساعد ذكاء اصطناعي في مِرباح، لكن أقدر أساعدك بكل سرور.',
        };
      }
      if (/مشكور|مشكوره|شكرا|يعطيك\s+العافيه|ما\s+قصرت|تسلم|جزاك\s+الله|بيض\s+الله/u.test(norm)) {
        return {
          provider: 'mock',
          text: 'العفو، حياك الله! إذا احتجت أي شيء ثاني أنا موجود.',
        };
      }
      if (/طفشان|ملل|زهقان|ضاق\s+صدري/u.test(norm)) {
        return {
          provider: 'mock',
          text: 'الله يعينك! ودك نسولف شوي، أو أساعدك بشيء في السوق؟',
        };
      }
      if (/مع\s+السلامه|فمان\s+الله|تصبح\s+على\s+خير/u.test(norm)) {
        return {
          provider: 'mock',
          text: 'في أمان الله، ونشوفك على خير!',
        };
      }
      if (/[A-Za-z]{4,}/.test(userMessage) && !/[\u0600-\u06FF]/.test(userMessage)) {
        return {
          provider: 'mock',
          text: 'Hello! I am the Mirbah assistant. Happy to chat or help you find Saudi livestock breeds, prices, or listings.',
        };
      }
      return {
        provider: 'mock',
        text: 'حيّاك الله! يسعدني الحديث معك، وإذا احتجت مساعدة في أي موضوع أو في مِرباح فأنا حاضر.',
      };
    }

    if (intent === 'marketplace_help') {
      if (/(?:صياغة|صياغه|كتابة|كتابه|تجهيز|انشاء)\s+اعلان|ساعدني\s+في\s+(?:صياغة|صياغه|اضافة|اضافه)/u.test(norm)) {
        return {
          provider: 'mock',
          text: [
            '**نموذج مقترح لصياغة إعلان مواشي واضح في مِرباح:**',
            '• **العنوان المقترح:** «جذعان [السلالة] طيبة — العمر [X] شهر — [المدينة]»',
            '• **أبرز تفاصيل الوصف:** اذكر السلالة، العمر، الوزن التقريبي، الكمية، حالة التحصين، وإمكانية التفاوض أو السوم مع صور واضحة من زوايا متعددة.',
            '• **ملاحظة مهمة:** يرجى مراجعة البيانات وتأكيدها بنفسك داخل صفحة **«أضف إعلانك»** قبل النشر، ولا يتم نشر أي إعلان تلقائياً دون موافقتك.',
          ].join('\n'),
        };
      }
      if (/draft\s+(?:a\s+)?(?:clear\s+)?(?:livestock\s+)?listing|(?:how\s+to|help\s+me)\s+(?:create|write|post|publish)\s+(?:a\s+)?listing|before\s+publishing/iu.test(norm)) {
        return {
          provider: 'mock',
          text: [
            '**Suggested Livestock Listing Structure on Mirbah:**',
            '• **Clear Title:** Include breed, age/category, and city (e.g., "Naimi Young Rams — 8 Months — Riyadh").',
            '• **Key Description Details:** State breed, approximate age and weight, quantity, vaccination status, negotiable pricing/offers, and clear photos.',
            '• **Confirmation Step:** Always review and explicitly confirm all details inside the **Add Listing** form before publishing—nothing is published automatically without your confirmation.',
          ].join('\n'),
        };
      }
      if (/تعديل|اعدل|حذف|اضيف|انشر/u.test(norm)) {
        return {
          provider: 'mock',
          text: [
            'تقدر تضيف إعلانك أو تعدله بسهولة:',
            '• من زر «أضف إعلانك» تعبّي بيانات الحلال (السلالة، العمر، الوزن، التحصين، الصور والسعر) وتحفظه كمسودة أو ترسله للمراجعة بعد تأكيدك.',
            '• ولتعديل إعلان سابق أو تغيير حالته لمباع، ادخل إلى «لوحة حسابي» ثم «إعلاناتي».',
          ].join('\n'),
        };
      }
      return {
        provider: 'mock',
        text: [
          'إليك خطوات التعامل في مِرباح:',
          '• للتفاوض أو إظهار رقم البائع: افتح الإعلان وسجل دخولك لتقديم عرض سعر (سوم) أو مراسلة المربي مباشرة.',
          '• الدفع والمعاينة: لا يوجد دفع إلكتروني داخل المنصة، ويتم البيع والشراء بعد المعاينة المباشرة والاتفاق.',
        ].join('\n'),
      };
    }

    if (intent === 'breed_prices') {
      const targetGuides = breedGuides.slice(0, 5);
      if (targetGuides.length === 0) {
        return {
          provider: 'mock',
          text: 'يمكنك مراجعة دليل السلالات والأسعار الاسترشادية من القائمة الرئيسية للاطلاع على أحدث النطاقات السعرية.',
        };
      }
      const isCompare = /(?:(?:ال)?فرق\s+بين|قارن|مقارن|ايهما\s+افضل|compare)/iu.test(norm);
      const lines = targetGuides.map((g) =>
        isCompare && g.summary
          ? `• **${g.breedName}** (${g.origin}): ${g.summary} (متوسط الوزن ${g.avgWeightKg}، المدى الاسترشادي ${g.priceRangeSar}).`
          : `• **${g.breedName}** (${g.origin}): المدى الاسترشادي ${g.priceRangeSar}، متوسط الوزن ${g.avgWeightKg}.`
      );
      return {
        provider: 'mock',
        text: [
          isCompare
            ? 'أبرز الفروقات والبيانات المسجلة في دليل السلالات:'
            : 'الأسعار الاسترشادية المسجلة حالياً في دليل السلالات:',
          ...lines,
          'إذا حاب أبحث لك عن عروض فعلية بسعر معين في منطقتك، خبرني بالسلالة والمنطقة.',
        ].join('\n'),
      };
    }

    if (intent === 'marketplace_search') {
      if (clarificationStage === 'ask_region') {
        const breedName = normalizedQuery.breedId
          ? BREED_LABEL_BY_ID[normalizedQuery.breedId]
          : undefined;
        return {
          provider: 'mock',
          text: breedName
            ? `أكيد، تبحث عن ${breedName} — في أي منطقة تبحث؟`
            : 'أكيد، في أي منطقة تبحث؟',
        };
      }

      if (clarificationStage === 'ask_budget') {
        const breedName = normalizedQuery.breedId
          ? BREED_LABEL_BY_ID[normalizedQuery.breedId] || ''
          : '';
        const regionName = normalizedQuery.city
          ? normalizedQuery.city
          : normalizedQuery.regionId
          ? REGION_LABEL_BY_ID[normalizedQuery.regionId] || ''
          : '';
        return {
          provider: 'mock',
          text: `تمام، تبحث عن ${breedName ? `${breedName} ` : ''}${regionName ? `في ${regionName}` : ''}. عندك ميزانية معينة؟`.trim(),
        };
      }

      if (listings.length > 0) {
        const filterHint =
          normalizedQuery.detectedDialectTerms.length > 0
            ? ` (${normalizedQuery.detectedDialectTerms.join('، ')})`
            : '';
        const topLines = listings.slice(0, 3).map(
          (l) =>
            `• **${l.title}** — ${formatSar(l.priceAmount)} (${l.regionName}${
              l.city ? ` - ${l.city}` : ''
            }${l.sellerVerified ? ' · مربي موثق' : ''})`
        );
        return {
          provider: 'mock',
          text: [
            `لقيت ${totalMatchingListings} إعلان منشور${filterHint}:`,
            ...topLines,
            'تقدر تفتح أي بطاقة بالأسفل للتفاصيل أو تعديل الشروط في أي وقت.',
          ].join('\n'),
        };
      }

      return {
        provider: 'mock',
        text: 'ما لقيت حالياً إعلانات منشورة مطابقة تماماً لهذه المعايير. جرب توسيع نطاق السعر أو اختيار منطقة ثانية، وراح أبحث لك فوراً.',
      };
    }

    if (/تحصين|تطعيم|دموي|معوي|بيطر|صحه|فحص|معاينه/u.test(norm)) {
      return {
        provider: 'mock',
        text: [
          'عند معاينة الحلال قبل الشراء تأكد من:',
          '1. التحصينات الأساسية (الدموي والمعوي والجدري حسب الموسم).',
          '2. نشاط الحلال وسلامة العيون والأنف والقوائم والأسنان (لتقدير العمر).',
          '3. المعاينة المباشرة قبل الاتفاق المالي.',
        ].join('\n'),
      };
    }

    return {
      provider: 'mock',
      text: 'أهلاً بك! يسعدني أساعدك سواء في البحث عن المواشي حسب السلالة والمنطقة والسعر أو في الاستفسار عن السلالات والمنصة.',
    };
  }

  async generateReplyStream(
    input: AiProviderInput,
    callbacks: AiStreamCallbacks
  ): Promise<AiProviderOutput> {
    const out = await this.generateReply(input);
    const metaCards = out.cards?.length ? out.cards : input.context.listings;
    if (metaCards?.length || out.stats || input.context.marketStats) {
      callbacks.onMeta?.({
        ...(metaCards?.length && input.context.clarificationStage !== 'ask_region' && input.context.clarificationStage !== 'ask_budget'
          ? { cards: metaCards }
          : {}),
        ...(out.stats || input.context.marketStats
          ? { stats: out.stats || input.context.marketStats }
          : {}),
      });
    }

    const words = out.text.split(/(\s+)/);
    let sent = '';
    for (const token of words) {
      if (input.signal?.aborted) {
        return {
          ...out,
          text: sent.trim(),
          interrupted: true,
        };
      }
      sent += token;
      callbacks.onDelta(token);
      await new Promise((r) => setTimeout(r, 8));
    }
    return out;
  }
}
