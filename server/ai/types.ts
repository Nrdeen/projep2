export type AiIntent =
  | 'marketplace_search'
  | 'breed_prices'
  | 'marketplace_help'
  | 'general_livestock'
  | 'casual_chat'
  | 'greeting';

export type AiClarificationStage = 'none' | 'ask_region' | 'ask_budget' | 'execute_search';

export type AiProviderName = 'gemini' | 'mock';

export type AiAttachmentKind = 'image' | 'pdf';

export type AiFeedbackValue = 'up' | 'down' | null;

export interface AiAttachmentMeta {
  id: string;
  kind: AiAttachmentKind;
  mimeType: string;
  name: string;
  sizeBytes: number;
  url: string;
  createdAt: string;
}

export interface AiAttachmentInlineData {
  id: string;
  kind: AiAttachmentKind;
  mimeType: string;
  name: string;
  sizeBytes: number;
  base64Data: string;
}

export interface AiPageContext {
  page?: string;
  listingId?: string | null;
  sellerId?: string | null;
  locale?: 'ar' | 'en';
  filtersSummary?: string | null;
}

export interface AiMarketStats {
  count: number;
  minPrice: number;
  maxPrice: number;
  avgPrice: number;
  medianPrice: number;
  currency: 'SAR';
  breedName?: string;
  regionName?: string;
}

export interface AiChatHistoryItem {
  role: 'user' | 'assistant';
  content: string;
}

export interface AiChatRequest {
  message: string;
  history?: AiChatHistoryItem[];
  conversationId?: string | null;
  attachmentIds?: string[];
  pageContext?: AiPageContext | null;
  locale?: 'ar' | 'en';
  regenerate?: boolean;
}

/** Strictly public, read-only listing summary returned by AI assistant cards. Never contains private seller phones/emails/IDs. */
export interface AiListingCard {
  id: string;
  title: string;
  priceAmount: number;
  currency: 'SAR';
  city: string;
  regionName: string;
  breedName: string;
  categoryName: string;
  ageMonths: number;
  weightKg: number;
  quantity: number;
  vaccinated: boolean;
  isNegotiable: boolean;
  allowPriceOffers: boolean;
  imageUrl: string | null;
  sellerDisplayName: string;
  sellerVerified: boolean;
  likesCount: number;
}

export interface NormalizedSaudiQuery {
  rawQuery: string;
  normalizedText: string;
  searchKeywords: string;
  breedId?: string;
  mentionedBreedIds?: string[];
  categoryId?: string;
  subCategoryId?: string;
  regionId?: string;
  city?: string;
  minPrice?: number;
  maxPrice?: number;
  sex?: 'ذكر' | 'أنثى' | 'قطيع مختلط';
  vaccinatedOnly?: boolean;
  negotiableOnly?: boolean;
  acceptsOffersOnly?: boolean;
  sort?: 'newest' | 'oldest' | 'price_asc' | 'price_desc' | 'most_liked';
  detectedDialectTerms: string[];
}

export interface AiBreedPriceGuide {
  breedId: string;
  breedName: string;
  origin: string;
  avgWeightKg: string;
  priceRangeSar: string;
  summary: string;
  indicativeEntries: Array<{
    ageLabel: string;
    minPriceSar: number;
    maxPriceSar: number;
    marketNote: string;
  }>;
}

export interface AiFocusedSeller {
  userId: string;
  displayName: string;
  verified: boolean;
  regionName?: string;
  city?: string;
  rating?: number;
  specialty?: string;
}

export interface AiMarketplaceContext {
  intent: AiIntent;
  normalizedQuery: NormalizedSaudiQuery;
  turnQuery?: NormalizedSaudiQuery;
  clarificationStage?: AiClarificationStage;
  isFilterModification?: boolean;
  listings: AiListingCard[];
  totalMatchingListings: number;
  breedGuides: AiBreedPriceGuide[];
  helpTopics: string[];
  marketStats?: AiMarketStats | null;
  focusedListing?: (AiListingCard & { description: string; sex: string }) | null;
  focusedSeller?: AiFocusedSeller | null;
  pageContext?: AiPageContext | null;
  hasAttachments?: boolean;
}

export interface AiUsageSnapshot {
  remainingToday: number;
  dailyLimit: number;
  usedToday: number;
  resetAtIso: string;
}

export interface AiStoredMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  attachments?: AiAttachmentMeta[];
  cards?: AiListingCard[];
  stats?: AiMarketStats | null;
  suggestedFollowUps?: string[];
  provider?: AiProviderName;
  feedback?: AiFeedbackValue;
  interrupted?: boolean;
  createdAt: string;
}

export interface AiConversationSummary {
  id: string;
  title: string;
  messageCount: number;
  lastMessagePreview: string;
  createdAt: string;
  updatedAt: string;
}

export interface AiConversationDetail {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: AiStoredMessage[];
}

export interface AiChatResponse {
  reply: string;
  intent: AiIntent;
  cards: AiListingCard[];
  stats?: AiMarketStats | null;
  suggestedFollowUps: string[];
  provider: AiProviderName;
  usage: AiUsageSnapshot;
  conversationId?: string;
  userMessageId?: string;
  assistantMessageId?: string;
  attachments?: AiAttachmentMeta[];
  interrupted?: boolean;
}

export interface AiStatusResponse {
  enabled: boolean;
  mode: 'gemini' | 'fallback' | 'unconfigured';
  geminiConfigured: boolean;
  model: string;
  maxMessageLength: number;
  usage: AiUsageSnapshot;
  limits: {
    maxAttachmentsPerMessage: number;
    maxImageBytes: number;
    maxPdfBytes: number;
    maxAudioBytes: number;
  };
  features: {
    streaming: boolean;
    attachments: boolean;
    stt: boolean;
    tts: boolean;
  };
}

export interface AiConfig {
  enabled: boolean;
  isProduction?: boolean;
  geminiApiKey: string;
  model: string;
  providerMode: 'auto' | 'gemini' | 'mock';
  maxMessageLength: number;
  maxHistoryMessages: number;
  rateLimitPerMinute: number;
  dailyUserQuota: number;
  dailyIpQuota: number;
  timeoutMs: number;
  maxAttachmentsPerMessage: number;
  maxImageBytes: number;
  maxPdfBytes: number;
  maxAudioBytes: number;
  attachmentTtlMs: number;
}

export interface AiProviderInput {
  userMessage: string;
  history: AiChatHistoryItem[];
  systemInstruction: string;
  context: AiMarketplaceContext;
  attachments?: AiAttachmentInlineData[];
  locale?: 'ar' | 'en';
  signal?: AbortSignal;
}

export interface AiProviderOutput {
  text: string;
  provider: AiProviderName;
  cards?: AiListingCard[];
  stats?: AiMarketStats | null;
  toolSearchExecuted?: boolean;
  interrupted?: boolean;
}

export interface AiStreamCallbacks {
  onDelta: (chunkText: string) => void;
  onMeta?: (meta: { cards?: AiListingCard[]; stats?: AiMarketStats | null }) => void;
}

export interface AiProvider {
  readonly name: AiProviderName;
  generateReply(input: AiProviderInput): Promise<AiProviderOutput>;
  generateReplyStream?(
    input: AiProviderInput,
    callbacks: AiStreamCallbacks
  ): Promise<AiProviderOutput>;
  transcribeAudio?(params: {
    audioBuffer: Buffer;
    mimeType: string;
    locale?: 'ar' | 'en';
    signal?: AbortSignal;
  }): Promise<string>;
  synthesizeSpeech?(params: {
    text: string;
    locale?: 'ar' | 'en';
    signal?: AbortSignal;
  }): Promise<{ audioBase64: string; mimeType: string }>;
}
