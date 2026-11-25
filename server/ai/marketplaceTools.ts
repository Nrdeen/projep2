import { validateAndParseListingQuery } from '../../src/lib/listing-search';
import type { MarketplaceRepository } from '../repositories/types';
import {
  BREED_LABEL_BY_ID,
  normalizeSaudiQuery,
  REGION_LABEL_BY_ID,
  resolveConversationalQuery,
} from './saudiQueryNormalizer';
import type {
  AiBreedPriceGuide,
  AiChatHistoryItem,
  AiFocusedSeller,
  AiListingCard,
  AiMarketStats,
  AiMarketplaceContext,
  AiPageContext,
  NormalizedSaudiQuery,
} from './types';

export class AiToolExecutionError extends Error {
  constructor(
    message: string,
    public readonly toolName: string,
    public readonly causeError?: unknown
  ) {
    super(message);
    this.name = 'AiToolExecutionError';
  }
}

function toSafeCard(
  listing: any,
  regionsMap: Map<string, string>,
  breedsMap: Map<string, string>,
  categoriesMap: Map<string, string>,
  sellersMap: Map<string, { displayName: string; verified: boolean }>
): AiListingCard {
  const seller = sellersMap.get(listing.sellerId);
  const firstImg =
    Array.isArray(listing.images) && listing.images.length > 0 ? listing.images[0]?.url : null;

  return {
    id: String(listing.id),
    title: String(listing.title),
    priceAmount: Number(listing.priceAmount) || 0,
    currency: 'SAR',
    city: String(listing.city || ''),
    regionName: regionsMap.get(listing.regionId) || '',
    breedName: breedsMap.get(listing.breedId) || '',
    categoryName: categoriesMap.get(listing.categoryId) || '',
    ageMonths: Number(listing.ageMonths) || 0,
    weightKg: Number(listing.weightKg) || 0,
    quantity: Number(listing.quantity) || 1,
    vaccinated: Boolean(listing.vaccinated),
    isNegotiable: Boolean(listing.isNegotiable),
    allowPriceOffers: Boolean(listing.allowPriceOffers ?? listing.isNegotiable),
    imageUrl: typeof firstImg === 'string' && firstImg ? firstImg : null,
    sellerDisplayName: seller?.displayName || 'مربي مسجل',
    sellerVerified: Boolean(seller?.verified),
    likesCount: Number(listing.likesCount) || 0,
  };
}

function buildQueryParams(
  nq: NormalizedSaudiQuery,
  includeCity: boolean,
  includeKeywords: boolean
): Record<string, string> {
  const params: Record<string, string> = {
    status: 'Published',
    limit: '5',
    offset: '0',
    sort: nq.sort || 'newest',
  };
  if (nq.breedId) params.breedId = nq.breedId;
  if (nq.categoryId) params.categoryId = nq.categoryId;
  if (nq.subCategoryId) params.subCategoryId = nq.subCategoryId;
  if (nq.regionId) params.regionId = nq.regionId;
  if (includeCity && nq.city) params.city = nq.city;
  if (nq.minPrice !== undefined) params.minPrice = String(nq.minPrice);
  if (nq.maxPrice !== undefined) params.maxPrice = String(nq.maxPrice);
  if (nq.sex) params.sex = nq.sex;
  if (nq.vaccinatedOnly) params.vaccinatedOnly = 'true';
  if (nq.negotiableOnly) params.negotiableOnly = 'true';
  if (nq.acceptsOffersOnly) params.acceptsOffersOnly = 'true';
  if (includeKeywords && nq.searchKeywords) params.q = nq.searchKeywords;
  return params;
}

const VALID_SEX_VALUES = new Set(['ذكر', 'أنثى', 'قطيع مختلط']);

function buildLookupMaps(bootstrap: Awaited<ReturnType<MarketplaceRepository['getBootstrap']>>) {
  const regionsMap = new Map<string, string>();
  for (const r of bootstrap.regions || []) regionsMap.set(r.id, r.name);

  const breedsMap = new Map<string, string>();
  for (const b of bootstrap.breeds || []) breedsMap.set(b.id, b.name);

  const categoriesMap = new Map<string, string>();
  for (const c of bootstrap.categories || []) categoriesMap.set(c.id, c.name);

  const sellersMap = new Map<string, { displayName: string; verified: boolean }>();
  for (const s of bootstrap.sellers || []) {
    sellersMap.set(s.userId, {
      displayName: s.displayName || 'مربي مسجل',
      verified: s.verificationStatus === 'Verified',
    });
  }

  return { regionsMap, breedsMap, categoriesMap, sellersMap };
}

export async function gatherMarketplaceContext(
  repo: MarketplaceRepository,
  userMessage: string,
  history: AiChatHistoryItem[] = [],
  options: { pageContext?: AiPageContext | null; hasAttachments?: boolean } = {}
): Promise<AiMarketplaceContext> {
  const resolution = resolveConversationalQuery(userMessage, history);
  let { intent, mergedQuery: nq, turnQuery, clarificationStage, isFilterModification } =
    resolution;

  // When attachments are present, never classify as pure greeting/chitchat so multimodal tools remain enabled
  if (options.hasAttachments && (intent === 'greeting' || intent === 'casual_chat')) {
    intent = 'general_livestock';
    clarificationStage = 'none';
  }

  // Casual greetings and small talk never trigger expensive marketplace queries
  if ((intent === 'greeting' || intent === 'casual_chat') && !options.pageContext?.listingId) {
    return {
      intent,
      normalizedQuery: nq,
      turnQuery,
      clarificationStage: 'none',
      isFilterModification: false,
      listings: [],
      totalMatchingListings: 0,
      breedGuides: [],
      helpTopics: [],
      pageContext: options.pageContext || null,
      hasAttachments: Boolean(options.hasAttachments),
    };
  }

  let bootstrap: Awaited<ReturnType<MarketplaceRepository['getBootstrap']>>;
  try {
    // Read-only public bootstrap (viewer = null) guarantees zero private data exposure
    bootstrap = await repo.getBootstrap(null, null);
  } catch (err) {
    throw new AiToolExecutionError(
      'تعذر جلب بيانات السوق حالياً، حاول مرة أخرى بعد قليل.',
      'getBootstrap',
      err
    );
  }

  const { regionsMap, breedsMap, categoriesMap, sellersMap } = buildLookupMaps(bootstrap);

  const indicativeByBreed = new Map<string, any[]>();
  for (const item of bootstrap.indicativePrices || []) {
    const arr = indicativeByBreed.get(item.breedId) || [];
    arr.push(item);
    indicativeByBreed.set(item.breedId, arr);
  }

  const allGuides: AiBreedPriceGuide[] = (bootstrap.breeds || []).map((b: any) => ({
    breedId: String(b.id),
    breedName: String(b.name),
    origin: String(b.origin || ''),
    avgWeightKg: String(b.avgWeightKg || ''),
    priceRangeSar: String(b.priceRangeSar || ''),
    summary: String(b.summary || ''),
    indicativeEntries: (indicativeByBreed.get(b.id) || []).map((ip) => ({
      ageLabel: String(ip.ageLabel || ''),
      minPriceSar: Number(ip.minPriceSar) || 0,
      maxPriceSar: Number(ip.maxPriceSar) || 0,
      marketNote: String(ip.marketNote || ''),
    })),
  }));

  const mentionedBreedIds =
    nq.mentionedBreedIds && nq.mentionedBreedIds.length > 0
      ? nq.mentionedBreedIds
      : nq.breedId
      ? [nq.breedId]
      : [];
  const relevantGuides =
    mentionedBreedIds.length > 0
      ? allGuides.filter((g) => mentionedBreedIds.includes(g.breedId))
      : allGuides;

  let focusedListing: AiMarketplaceContext['focusedListing'] = null;
  if (options.pageContext?.listingId) {
    try {
      const found = await repo.getListingById(options.pageContext.listingId, null);
      if (found && found.status === 'Published') {
        focusedListing = {
          ...toSafeCard(found, regionsMap, breedsMap, categoriesMap, sellersMap),
          description: String(found.description || '').slice(0, 500),
          sex: String(found.sex || ''),
        };
      }
    } catch {
      // Non-fatal if listing no longer exists
    }
  }

  let focusedSeller: AiFocusedSeller | null = null;
  if (options.pageContext?.sellerId) {
    const rawSeller = (bootstrap.sellers || []).find(
      (s: any) => String(s.userId) === String(options.pageContext?.sellerId)
    );
    if (rawSeller) {
      focusedSeller = {
        userId: String(rawSeller.userId),
        displayName: String(rawSeller.displayName || 'مربي مسجل'),
        verified: rawSeller.verificationStatus === 'Verified',
        ...(rawSeller.regionId ? { regionName: regionsMap.get(rawSeller.regionId) || '' } : {}),
        ...(rawSeller.city ? { city: String(rawSeller.city) } : {}),
        ...(typeof rawSeller.rating === 'number' ? { rating: rawSeller.rating } : {}),
        ...(rawSeller.specialty ? { specialty: String(rawSeller.specialty) } : {}),
      };
    }
  }

  let listings: AiListingCard[] = [];
  let totalMatchingListings = 0;

  if (intent === 'marketplace_search' && clarificationStage === 'execute_search') {
    const runSearch = async (params: Record<string, string>) => {
      const parsed = validateAndParseListingQuery(params);
      if (!parsed.ok) return { listings: [], totalCount: 0 };
      try {
        // Always pass viewer = null so only Published listings from active sellers are queried
        return await repo.queryListings(parsed.value, null);
      } catch (err) {
        throw new AiToolExecutionError(
          'تعذر البحث في الإعلانات حالياً بسبب خلل مؤقت في جلب البيانات، حاول مرة أخرى بعد قليل.',
          'queryListings',
          err
        );
      }
    };

    let result = await runSearch(buildQueryParams(nq, true, true));

    // If strict keyword+city returned 0, relax keyword first, then city (keeping breed/region/price/sex)
    if (result.totalCount === 0 && nq.searchKeywords) {
      result = await runSearch(buildQueryParams(nq, true, false));
    }
    if (result.totalCount === 0 && nq.city) {
      result = await runSearch(buildQueryParams(nq, false, false));
    }

    totalMatchingListings = result.totalCount;
    listings = (result.listings || [])
      .filter((l: any) => l && l.status === 'Published')
      .slice(0, 4)
      .map((l: any) => toSafeCard(l, regionsMap, breedsMap, categoriesMap, sellersMap));
  }

  let marketStats: AiMarketStats | null = null;
  const asksMarketStats =
    /(?:احصائيات|متوسط\s+السوق|متوسط\s+الاسعار|اقل\s+واعلى|احسب\s+السوق|market\s+stats|average\s+price)/iu.test(
      nq.normalizedText || userMessage
    );
  if (asksMarketStats) {
    try {
      const statsRes = await executeGetMarketStatsTool(repo, {
        breed: nq.breedId ? BREED_LABEL_BY_ID[nq.breedId] : undefined,
        region: nq.regionId ? REGION_LABEL_BY_ID[nq.regionId] : undefined,
      });
      if (statsRes.stats.count > 0) {
        marketStats = statsRes.stats;
      }
    } catch {
      // Keep non-fatal; guides remain available
    }
  }

  const helpTopics =
    intent === 'marketplace_help'
      ? [
          'إضافة إعلان جديد أو تعديله من زر "أضف إعلانك" أو "لوحة حسابي" مع إمكانية الحفظ كمسودة أو الإرسال للمراجعة',
          'التفاوض وتقديم السوم عبر زر "تقديم عرض سعر للمربي" أو المراسلة المباشرة داخل صفحة الإعلان',
          'إظهار رقم البائع متاح للمستخدمين المسجلين لحماية خصوصية المربين',
          'التعامل المالي يتم مباشرة عند المعاينة والاتفاق ولا توجد مدفوعات إلكترونية داخل المنصة',
          'توثيق المربي يتم عبر طلب التوثيق ومراجعة المشرفين من لوحة الإدارة',
        ]
      : [];

  return {
    intent,
    normalizedQuery: nq,
    turnQuery,
    clarificationStage,
    isFilterModification,
    listings,
    totalMatchingListings,
    breedGuides: relevantGuides,
    helpTopics,
    marketStats,
    focusedListing,
    focusedSeller,
    pageContext: options.pageContext || null,
    hasAttachments: Boolean(options.hasAttachments),
  };
}

export interface ToolSearchArgs {
  query?: string;
  breed?: string;
  region?: string;
  city?: string;
  minPrice?: number;
  maxPrice?: number;
  sex?: string;
  vaccinatedOnly?: boolean;
  negotiableOnly?: boolean;
  sort?: string;
  limit?: number;
}

const VALID_SORTS = new Set(['newest', 'oldest', 'price_asc', 'price_desc', 'most_liked']);

/**
 * Read-only Gemini function-calling executor for searching ONLY Published marketplace listings.
 * Always queries with viewer = null so drafts, pending/rejected listings, and private fields are excluded.
 */
export async function executeSearchPublishedListingsTool(
  repo: MarketplaceRepository,
  rawArgs: Record<string, unknown>
): Promise<{
  totalMatchingListings: number;
  cards: AiListingCard[];
  listingsSummary: Array<{
    id: string;
    title: string;
    priceSar: number;
    breed: string;
    region: string;
    city: string;
    ageMonths: number;
    weightKg: number;
    quantity: number;
    vaccinated: boolean;
    negotiable: boolean;
    sellerDisplayName: string;
    sellerVerified: boolean;
  }>;
}> {
  const args = (rawArgs || {}) as ToolSearchArgs;
  const combinedHint = [args.query, args.breed, args.region, args.city]
    .filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
    .join(' ');
  const nq = normalizeSaudiQuery(combinedHint);

  if (typeof args.minPrice === 'number' && Number.isFinite(args.minPrice) && args.minPrice >= 0) {
    nq.minPrice = Math.round(args.minPrice);
  }
  if (typeof args.maxPrice === 'number' && Number.isFinite(args.maxPrice) && args.maxPrice > 0) {
    nq.maxPrice = Math.round(args.maxPrice);
  }
  if (typeof args.sex === 'string' && VALID_SEX_VALUES.has(args.sex.trim())) {
    nq.sex = args.sex.trim() as NormalizedSaudiQuery['sex'];
  }
  if (typeof args.vaccinatedOnly === 'boolean') {
    nq.vaccinatedOnly = args.vaccinatedOnly;
  }
  if (typeof args.negotiableOnly === 'boolean') {
    nq.negotiableOnly = args.negotiableOnly;
  }
  if (typeof args.sort === 'string' && VALID_SORTS.has(args.sort)) {
    nq.sort = args.sort as NormalizedSaudiQuery['sort'];
  }

  const limitNum =
    typeof args.limit === 'number' && Number.isFinite(args.limit)
      ? Math.max(1, Math.min(4, Math.round(args.limit)))
      : 4;

  let bootstrap: Awaited<ReturnType<MarketplaceRepository['getBootstrap']>>;
  try {
    bootstrap = await repo.getBootstrap(null, null);
  } catch (err) {
    throw new AiToolExecutionError(
      'تعذر البحث في الإعلانات حالياً بسبب خلل مؤقت في جلب البيانات، حاول مرة أخرى بعد قليل.',
      'searchPublishedListings',
      err
    );
  }

  const { regionsMap, breedsMap, categoriesMap, sellersMap } = buildLookupMaps(bootstrap);

  const runSearch = async (params: Record<string, string>) => {
    params.limit = String(limitNum);
    const parsed = validateAndParseListingQuery(params);
    if (!parsed.ok) return { listings: [], totalCount: 0 };
    try {
      return await repo.queryListings(parsed.value, null);
    } catch (err) {
      throw new AiToolExecutionError(
        'تعذر البحث في الإعلانات حالياً بسبب خلل مؤقت في جلب البيانات، حاول مرة أخرى بعد قليل.',
        'searchPublishedListings',
        err
      );
    }
  };

  let result = await runSearch(buildQueryParams(nq, true, true));
  if (result.totalCount === 0 && nq.searchKeywords) {
    result = await runSearch(buildQueryParams(nq, true, false));
  }
  if (result.totalCount === 0 && nq.city) {
    result = await runSearch(buildQueryParams(nq, false, false));
  }

  const cards = (result.listings || [])
    .filter((l: any) => l && l.status === 'Published')
    .slice(0, limitNum)
    .map((l: any) => toSafeCard(l, regionsMap, breedsMap, categoriesMap, sellersMap));

  return {
    totalMatchingListings: result.totalCount,
    cards,
    listingsSummary: cards.map((c) => ({
      id: c.id,
      title: c.title,
      priceSar: c.priceAmount,
      breed: c.breedName,
      region: c.regionName,
      city: c.city,
      ageMonths: c.ageMonths,
      weightKg: c.weightKg,
      quantity: c.quantity,
      vaccinated: c.vaccinated,
      negotiable: c.isNegotiable,
      sellerDisplayName: c.sellerDisplayName,
      sellerVerified: c.sellerVerified,
    })),
  };
}

function extractRequestedBreedIds(rawArgs: Record<string, unknown>): string[] {
  const parts: string[] = [];
  if (typeof rawArgs?.breed === 'string' && rawArgs.breed.trim()) {
    parts.push(rawArgs.breed.trim());
  }
  if (Array.isArray(rawArgs?.breeds)) {
    for (const item of rawArgs.breeds) {
      if (typeof item === 'string' && item.trim()) parts.push(item.trim());
    }
  }
  if (parts.length === 0) return [];
  const nq = normalizeSaudiQuery(parts.join(' '));
  if (nq.mentionedBreedIds && nq.mentionedBreedIds.length > 0) {
    return nq.mentionedBreedIds;
  }
  return nq.breedId ? [nq.breedId] : [];
}

/**
 * Read-only Gemini function-calling executor returning indicative Saudi livestock breed price guides.
 */
export async function executeGetBreedPriceGuidesTool(
  repo: MarketplaceRepository,
  rawArgs: Record<string, unknown>
): Promise<{ guides: AiBreedPriceGuide[] }> {
  const requestedBreedIds = extractRequestedBreedIds(rawArgs || {});

  let bootstrap: Awaited<ReturnType<MarketplaceRepository['getBootstrap']>>;
  try {
    bootstrap = await repo.getBootstrap(null, null);
  } catch (err) {
    throw new AiToolExecutionError(
      'تعذر جلب دليل الأسعار حالياً، حاول مرة أخرى بعد قليل.',
      'getBreedPriceGuides',
      err
    );
  }

  const indicativeByBreed = new Map<string, any[]>();
  for (const item of bootstrap.indicativePrices || []) {
    const arr = indicativeByBreed.get(item.breedId) || [];
    arr.push(item);
    indicativeByBreed.set(item.breedId, arr);
  }

  const allGuides: AiBreedPriceGuide[] = (bootstrap.breeds || []).map((b: any) => ({
    breedId: String(b.id),
    breedName: String(b.name),
    origin: String(b.origin || ''),
    avgWeightKg: String(b.avgWeightKg || ''),
    priceRangeSar: String(b.priceRangeSar || ''),
    summary: String(b.summary || ''),
    indicativeEntries: (indicativeByBreed.get(b.id) || []).map((ip) => ({
      ageLabel: String(ip.ageLabel || ''),
      minPriceSar: Number(ip.minPriceSar) || 0,
      maxPriceSar: Number(ip.maxPriceSar) || 0,
      marketNote: String(ip.marketNote || ''),
    })),
  }));

  const filtered =
    requestedBreedIds.length > 0
      ? allGuides.filter((g) => requestedBreedIds.includes(g.breedId))
      : allGuides;
  return { guides: filtered.length > 0 ? filtered : allGuides };
}

/**
 * Computes real marketplace statistics strictly from Published listings matching optional breed/region filters.
 * Never fabricates numbers; returns count: 0 when no matching published listings exist.
 */
export async function executeGetMarketStatsTool(
  repo: MarketplaceRepository,
  rawArgs: Record<string, unknown>
): Promise<{ stats: AiMarketStats }> {
  const breedHint = typeof rawArgs?.breed === 'string' ? rawArgs.breed.trim() : '';
  const regionHint = typeof rawArgs?.region === 'string' ? rawArgs.region.trim() : '';
  const nq = normalizeSaudiQuery([breedHint, regionHint].filter(Boolean).join(' '));

  let bootstrap: Awaited<ReturnType<MarketplaceRepository['getBootstrap']>>;
  try {
    bootstrap = await repo.getBootstrap(null, null);
  } catch (err) {
    throw new AiToolExecutionError(
      'تعذر حساب إحصائيات السوق حالياً.',
      'getMarketStats',
      err
    );
  }
  const { regionsMap, breedsMap } = buildLookupMaps(bootstrap);

  const queryParams: Record<string, string> = {
    status: 'Published',
    limit: '100',
    offset: '0',
    sort: 'newest',
  };
  if (nq.breedId) queryParams.breedId = nq.breedId;
  if (nq.regionId) queryParams.regionId = nq.regionId;

  const parsed = validateAndParseListingQuery(queryParams);
  if (!parsed.ok) {
    return {
      stats: { count: 0, minPrice: 0, maxPrice: 0, avgPrice: 0, medianPrice: 0, currency: 'SAR' },
    };
  }

  let res;
  try {
    res = await repo.queryListings(parsed.value, null);
  } catch (err) {
    throw new AiToolExecutionError(
      'تعذر حساب إحصائيات السوق من الإعلانات المنشورة.',
      'getMarketStats',
      err
    );
  }

  const prices = (res.listings || [])
    .filter((l: any) => l && l.status === 'Published' && Number(l.priceAmount) > 0)
    .map((l: any) => Number(l.priceAmount))
    .sort((a, b) => a - b);

  if (prices.length === 0) {
    return {
      stats: {
        count: 0,
        minPrice: 0,
        maxPrice: 0,
        avgPrice: 0,
        medianPrice: 0,
        currency: 'SAR',
        ...(nq.breedId ? { breedName: breedsMap.get(nq.breedId) || BREED_LABEL_BY_ID[nq.breedId] } : {}),
        ...(nq.regionId ? { regionName: regionsMap.get(nq.regionId) || REGION_LABEL_BY_ID[nq.regionId] } : {}),
      },
    };
  }

  const minPrice = prices[0];
  const maxPrice = prices[prices.length - 1];
  const sum = prices.reduce((acc, p) => acc + p, 0);
  const avgPrice = Math.round(sum / prices.length);
  const mid = Math.floor(prices.length / 2);
  const medianPrice =
    prices.length % 2 === 1 ? prices[mid] : Math.round((prices[mid - 1] + prices[mid]) / 2);

  return {
    stats: {
      count: prices.length,
      minPrice,
      maxPrice,
      avgPrice,
      medianPrice,
      currency: 'SAR',
      ...(nq.breedId ? { breedName: breedsMap.get(nq.breedId) || BREED_LABEL_BY_ID[nq.breedId] } : {}),
      ...(nq.regionId ? { regionName: regionsMap.get(nq.regionId) || REGION_LABEL_BY_ID[nq.regionId] } : {}),
    },
  };
}

/**
 * Compares specific published listings by IDs or top matching published listings alongside breed price guides.
 */
export async function executeCompareListingsOrBreedsTool(
  repo: MarketplaceRepository,
  rawArgs: Record<string, unknown>
): Promise<{
  cards: AiListingCard[];
  guides: AiBreedPriceGuide[];
}> {
  const rawIds = Array.isArray(rawArgs?.listingIds)
    ? rawArgs.listingIds.filter((x): x is string => typeof x === 'string' && x.trim().length > 0).slice(0, 4)
    : [];
  const requestedBreedIds = extractRequestedBreedIds(rawArgs || {});

  let bootstrap: Awaited<ReturnType<MarketplaceRepository['getBootstrap']>>;
  try {
    bootstrap = await repo.getBootstrap(null, null);
  } catch (err) {
    throw new AiToolExecutionError('تعذر جلب بيانات المقارنة حالياً.', 'compareListingsOrBreeds', err);
  }

  const { regionsMap, breedsMap, categoriesMap, sellersMap } = buildLookupMaps(bootstrap);
  const cards: AiListingCard[] = [];

  if (rawIds.length > 0) {
    for (const id of rawIds) {
      const found = await repo.getListingById(id, null);
      if (found && found.status === 'Published') {
        cards.push(toSafeCard(found, regionsMap, breedsMap, categoriesMap, sellersMap));
      }
    }
  } else if (requestedBreedIds.length > 1) {
    const seenIds = new Set<string>();
    const perBreedLimit = Math.max(1, Math.floor(4 / requestedBreedIds.length));
    for (const breedId of requestedBreedIds) {
      const breedName = breedsMap.get(breedId) || BREED_LABEL_BY_ID[breedId] || breedId;
      const search = await executeSearchPublishedListingsTool(repo, {
        breed: breedName,
        sort: 'newest',
        limit: perBreedLimit,
      });
      for (const card of search.cards) {
        if (!seenIds.has(card.id) && cards.length < 4) {
          seenIds.add(card.id);
          cards.push(card);
        }
      }
    }
  } else {
    const breedName =
      requestedBreedIds.length === 1
        ? breedsMap.get(requestedBreedIds[0]) || BREED_LABEL_BY_ID[requestedBreedIds[0]]
        : typeof rawArgs?.breed === 'string'
        ? rawArgs.breed.trim()
        : undefined;
    const search = await executeSearchPublishedListingsTool(repo, {
      breed: breedName,
      sort: 'newest',
      limit: 4,
    });
    cards.push(...search.cards);
  }

  const guidesOut = await executeGetBreedPriceGuidesTool(repo, rawArgs || {});
  return { cards, guides: guidesOut.guides };
}
