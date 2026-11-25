import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Camera,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  FileText,
  History,
  ImagePlus,
  Loader2,
  Maximize2,
  Mic,
  Minimize2,
  Minus,
  MoreVertical,
  Paperclip,
  PlusSquare,
  RefreshCw,
  RotateCcw,
  Scale,
  Search,
  Send,
  ShieldCheck,
  SlidersHorizontal,
  Square,
  SquarePen,
  ThumbsDown,
  ThumbsUp,
  TrendingUp,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { api } from '../lib/api';
import { formatPriceSar } from '../lib/format';
import { useI18n } from '../lib/i18n';
import type { PageView } from '../lib/router';
import type {
  AiAttachmentMeta,
  AiChatHistoryItem,
  AiConversationSummary,
  AiFeedbackValue,
  AiListingCard,
  AiMarketStats,
  AiPageContext,
  AiUsageSnapshot,
} from '../types/marketplace';
import { SafeImage } from './SafeImage';
import { AiCameraModal } from './ai/AiCameraModal';
import { AiConversationDrawer } from './ai/AiConversationDrawer';
import { SafeMarkdown } from './ai/SafeMarkdown';
import { formatDurationMmSs, useAiVoice, type AiVoiceLangSetting } from './ai/useAiVoice';

const AI_CHAT_ICON_WEBP = '/assets/ai-chat-icon.webp';
const AI_CHAT_ICON_PNG = '/assets/ai-chat-icon.png';
const AI_SETTINGS_STORAGE_KEY = 'mirbah_ai_settings_v1';

interface AiWidgetSettings {
  autoRead: boolean;
  voiceLang: AiVoiceLangSetting;
}

function readSavedSettings(): AiWidgetSettings {
  if (typeof window === 'undefined') return { autoRead: false, voiceLang: 'auto' };
  try {
    const raw = localStorage.getItem(AI_SETTINGS_STORAGE_KEY);
    if (!raw) return { autoRead: false, voiceLang: 'auto' };
    const parsed = JSON.parse(raw) as Partial<AiWidgetSettings>;
    return {
      autoRead: Boolean(parsed.autoRead),
      voiceLang:
        parsed.voiceLang === 'ar-SA' || parsed.voiceLang === 'en-US'
          ? parsed.voiceLang
          : 'auto',
    };
  } catch {
    return { autoRead: false, voiceLang: 'auto' };
  }
}

interface ChatMessageItem {
  id: string;
  serverId?: string;
  role: 'user' | 'assistant';
  content: string;
  attachments?: AiAttachmentMeta[];
  cards?: AiListingCard[];
  stats?: AiMarketStats | null;
  suggestedFollowUps?: string[];
  feedback?: AiFeedbackValue;
  isError?: boolean;
  isStreaming?: boolean;
  interrupted?: boolean;
  retryPrompt?: string;
  retryAttachmentIds?: string[];
}

interface PendingAttachmentItem {
  meta: AiAttachmentMeta;
  localPreviewUrl?: string;
}

interface AiAssistantWidgetProps {
  onSelectListing: (listingId: string) => void;
  onNavigate?: (page: PageView) => void;
  userId?: string | null;
  offsetForBottomBar?: boolean | 'nav' | 'detail';
  pageContext?: AiPageContext | null;
}

function getStorageKey(userId?: string | null) {
  return `mirbah_ai_state_v2:${userId || 'guest'}`;
}

function readSavedWidgetState(userId?: string | null): {
  conversationId: string | null;
  draft: string;
} {
  if (typeof window === 'undefined') return { conversationId: null, draft: '' };
  try {
    const raw = localStorage.getItem(getStorageKey(userId));
    if (!raw) return { conversationId: null, draft: '' };
    const parsed = JSON.parse(raw) as { conversationId?: string | null; draft?: string };
    return {
      conversationId: typeof parsed.conversationId === 'string' ? parsed.conversationId : null,
      draft: typeof parsed.draft === 'string' ? parsed.draft : '',
    };
  } catch {
    return { conversationId: null, draft: '' };
  }
}

function AiAssistantIcon({
  className = 'w-10 h-10',
  alt = '',
}: {
  className?: string;
  alt?: string;
}) {
  const [src, setSrc] = useState(AI_CHAT_ICON_WEBP);

  return (
    <img
      src={src}
      alt={alt}
      aria-hidden={alt === ''}
      referrerPolicy="no-referrer"
      decoding="async"
      onError={() => {
        if (src !== AI_CHAT_ICON_PNG) {
          setSrc(AI_CHAT_ICON_PNG);
        }
      }}
      className={`object-contain select-none ${className}`}
    />
  );
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function AiAssistantWidget({
  onSelectListing,
  onNavigate,
  userId,
  offsetForBottomBar = false,
  pageContext = null,
}: AiAssistantWidgetProps) {
  const { dir, isEn } = useI18n();
  const isRtl = dir === 'rtl';
  const CardChevron = isRtl ? ChevronLeft : ChevronRight;
  const ListingArrow = isRtl ? ArrowLeft : ArrowRight;

  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [headerMenuOpen, setHeaderMenuOpen] = useState(false);
  const [attachMenuOpen, setAttachMenuOpen] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);

  const [conversationId, setConversationId] = useState<string | null>(
    () => readSavedWidgetState(userId).conversationId
  );
  const [conversations, setConversations] = useState<AiConversationSummary[]>([]);
  const [conversationsLoading, setConversationsLoading] = useState(false);
  const [historySearch, setHistorySearch] = useState('');

  const [messages, setMessages] = useState<ChatMessageItem[]>([]);
  const [input, setInput] = useState(() => readSavedWidgetState(userId).draft);
  const [sending, setSending] = useState(false);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [pendingAttachments, setPendingAttachments] = useState<PendingAttachmentItem[]>([]);
  const [composerNotice, setComposerNotice] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [showQuickPrompts, setShowQuickPrompts] = useState(false);
  const [aiSettings, setAiSettings] = useState<AiWidgetSettings>(() => readSavedSettings());
  const [maxMessageLength, setMaxMessageLength] = useState(600);
  const [maxAttachmentsPerMessage, setMaxAttachmentsPerMessage] = useState(4);
  const [maxImageBytes, setMaxImageBytes] = useState(5 * 1024 * 1024);
  const [maxPdfBytes, setMaxPdfBytes] = useState(10 * 1024 * 1024);
  const [serverSttEnabled, setServerSttEnabled] = useState(false);
  const [serverTtsEnabled, setServerTtsEnabled] = useState(false);

  const [usage, setUsage] = useState<AiUsageSnapshot | null>(null);
  const [enabled, setEnabled] = useState(true);
  const [mobileViewportHeight, setMobileViewportHeight] = useState<number | null>(null);
  const [showScrollBottom, setShowScrollBottom] = useState(false);

  const bodyRef = useRef<HTMLDivElement | null>(null);
  const listEndRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const launcherRef = useRef<HTMLButtonElement | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const pdfInputRef = useRef<HTMLInputElement | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const isNearBottomRef = useRef(true);
  const lastOwnerScopeRef = useRef<string>(userId || 'guest');
  const restoredConvIdRef = useRef<string | null>(null);

  const appendTranscriptToInput = useCallback(
    (transcript: string) => {
      const clean = transcript.trim();
      if (!clean) return;
      setInput((prev) => {
        const next = prev.trim() ? `${prev.trim()} ${clean}` : clean;
        return next.slice(0, maxMessageLength);
      });
      window.setTimeout(() => {
        inputRef.current?.focus();
      }, 20);
    },
    [maxMessageLength]
  );

  const voice = useAiVoice({
    isEn,
    voiceLang: aiSettings.voiceLang,
    serverSttEnabled,
    serverTtsEnabled,
    onTranscript: appendTranscriptToInput,
  });

  useEffect(() => {
    try {
      localStorage.setItem(AI_SETTINGS_STORAGE_KEY, JSON.stringify(aiSettings));
    } catch {
      // ignore storage errors
    }
  }, [aiSettings]);

  // Persist active conversation & draft per owner scope (only when scope matches)
  useEffect(() => {
    const scope = userId || 'guest';
    if (lastOwnerScopeRef.current !== scope) return;
    try {
      localStorage.setItem(
        getStorageKey(userId),
        JSON.stringify({
          conversationId,
          draft: input,
        })
      );
    } catch {
      // ignore storage errors
    }
  }, [userId, conversationId, input]);

  // Reset & isolate state cleanly whenever user identity changes
  useEffect(() => {
    const scope = userId || 'guest';
    if (lastOwnerScopeRef.current === scope) return;
    lastOwnerScopeRef.current = scope;

    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    voice.cancelRecording();
    voice.stopSpeaking();

    setSending(false);
    setMessages([]);
    setPendingAttachments((prev) => {
      prev.forEach((p) => {
        if (p.localPreviewUrl) URL.revokeObjectURL(p.localPreviewUrl);
      });
      return [];
    });
    setHistoryOpen(false);
    setComposerNotice(null);

    const saved = readSavedWidgetState(userId);
    restoredConvIdRef.current = null;
    setConversationId(saved.conversationId);
    setInput(saved.draft);
  }, [userId, voice]);

  const fetchStatus = useCallback(async () => {
    try {
      const status = await api.getAiStatus();
      setEnabled(status.enabled);
      setMaxMessageLength(status.maxMessageLength || 600);
      setUsage(status.usage);
      if (status.limits) {
        setMaxAttachmentsPerMessage(status.limits.maxAttachmentsPerMessage);
        setMaxImageBytes(status.limits.maxImageBytes);
        setMaxPdfBytes(status.limits.maxPdfBytes);
      }
      if (status.features) {
        setServerSttEnabled(Boolean(status.features.stt));
        setServerTtsEnabled(Boolean(status.features.tts));
      }
    } catch {
      // Keep default widget readiness if status check fails transiently
    }
  }, []);

  const loadConversations = useCallback(async (q?: string) => {
    setConversationsLoading(true);
    try {
      const res = await api.getAiConversations(q);
      setConversations(res.conversations || []);
    } catch {
      // Keep existing list on transient error
    } finally {
      setConversationsLoading(false);
    }
  }, []);

  const restoreConversation = useCallback(
    async (id: string) => {
      restoredConvIdRef.current = id;
      try {
        const res = await api.getAiConversation(id);
        const conv = res.conversation;
        setConversationId(conv.id);
        setMessages(
          conv.messages.map((m) => ({
            id: m.id,
            serverId: m.id,
            role: m.role,
            content: m.content,
            attachments: m.attachments,
            cards: m.cards,
            stats: m.stats ?? null,
            suggestedFollowUps: m.suggestedFollowUps,
            feedback: m.feedback ?? null,
            interrupted: m.interrupted,
          }))
        );
      } catch (err: unknown) {
        const status = Number((err as any)?.status || 0);
        if (status === 404) {
          restoredConvIdRef.current = null;
          setConversationId(null);
        }
      }
    },
    []
  );

  // When opening, sync status and restore saved conversation if empty
  useEffect(() => {
    if (!open || minimized) return;
    void fetchStatus();
    if (conversationId && messages.length === 0 && restoredConvIdRef.current !== conversationId) {
      void restoreConversation(conversationId);
    }
    const timer = window.setTimeout(() => {
      inputRef.current?.focus();
    }, 80);
    return () => window.clearTimeout(timer);
  }, [open, minimized, userId, conversationId, messages.length, fetchStatus, restoreConversation]);

  // Load history list when drawer is open or search changes
  useEffect(() => {
    if (!open || !historyOpen) return;
    const handle = window.setTimeout(() => {
      void loadConversations(historySearch);
    }, 160);
    return () => window.clearTimeout(handle);
  }, [open, historyOpen, historySearch, loadConversations]);

  // Smart auto-scroll
  const handleBodyScroll = () => {
    const el = bodyRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    const nearBottom = distanceFromBottom < 96;
    isNearBottomRef.current = nearBottom;
    setShowScrollBottom(!nearBottom && messages.length > 0);
  };

  useEffect(() => {
    if (!open || minimized || messages.length === 0) return;
    if (isNearBottomRef.current) {
      listEndRef.current?.scrollIntoView({ behavior: sending ? 'auto' : 'smooth', block: 'end' });
    }
  }, [messages, open, minimized, sending]);

  // Escape handling
  useEffect(() => {
    if (!open || minimized) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (cameraOpen) {
          setCameraOpen(false);
          return;
        }
        if (historyOpen) {
          setHistoryOpen(false);
          return;
        }
        if (attachMenuOpen) {
          setAttachMenuOpen(false);
          return;
        }
        if (headerMenuOpen) {
          setHeaderMenuOpen(false);
          return;
        }
        if (showQuickPrompts) {
          setShowQuickPrompts(false);
          return;
        }
        setOpen(false);
        launcherRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, minimized, cameraOpen, historyOpen, attachMenuOpen, headerMenuOpen, showQuickPrompts]);

  // Lock page scroll on mobile while open
  useEffect(() => {
    if (!open || minimized || window.innerWidth >= 768) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [open, minimized]);

  // Sync height with mobile soft keyboard
  useEffect(() => {
    if (!open || minimized || window.innerWidth >= 768 || !window.visualViewport) {
      setMobileViewportHeight(null);
      return;
    }
    const vv = window.visualViewport;
    const syncHeight = () => {
      setMobileViewportHeight(vv.height);
    };
    syncHeight();
    vv.addEventListener('resize', syncHeight);
    return () => {
      vv.removeEventListener('resize', syncHeight);
      setMobileViewportHeight(null);
    };
  }, [open, minimized]);

  // Auto-resize composer cleanly
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 112)}px`;
  }, [input, open, minimized]);

  const handleUploadFiles = async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    if (fileArray.length === 0) return;
    setComposerNotice(null);
    setAttachMenuOpen(false);

    if (pendingAttachments.length + fileArray.length > maxAttachmentsPerMessage) {
      setComposerNotice(
        isEn
          ? `Maximum ${maxAttachmentsPerMessage} attachments per message.`
          : `الحد الأقصى ${maxAttachmentsPerMessage} مرفقات في الرسالة الواحدة.`
      );
      return;
    }

    setUploadingAttachment(true);
    try {
      for (const file of fileArray) {
        const mime = file.type.toLowerCase();
        const isPdf = mime === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
        const isImage =
          mime === 'image/jpeg' ||
          mime === 'image/png' ||
          mime === 'image/webp' ||
          /\.(jpe?g|png|webp)$/i.test(file.name);

        if (!isPdf && !isImage) {
          setComposerNotice(
            isEn
              ? `Unsupported file "${file.name}". Allowed: JPEG, PNG, WebP, or PDF.`
              : `نوع الملف "${file.name}" غير مدعوم. المسموح: JPEG أو PNG أو WebP أو PDF.`
          );
          continue;
        }

        const maxAllowed = isPdf ? maxPdfBytes : maxImageBytes;
        if (file.size > maxAllowed) {
          setComposerNotice(
            isEn
              ? `File "${file.name}" exceeds the ${Math.round(maxAllowed / (1024 * 1024))}MB limit.`
              : `حجم الملف "${file.name}" يتجاوز الحد المسموح (${Math.round(maxAllowed / (1024 * 1024))} ميجابايت).`
          );
          continue;
        }

        const res = await api.uploadAiAttachment(file);
        const localPreviewUrl =
          res.attachment.kind === 'image' ? URL.createObjectURL(file) : undefined;
        setPendingAttachments((prev) => [
          ...prev,
          { meta: res.attachment, localPreviewUrl },
        ]);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '';
      setComposerNotice(
        msg ||
          (isEn ? 'Failed to upload attachment.' : 'تعذر رفع المرفق، حاول مرة أخرى.')
      );
    } finally {
      setUploadingAttachment(false);
    }
  };

  const removePendingAttachment = async (attachmentId: string) => {
    setPendingAttachments((prev) => {
      const target = prev.find((p) => p.meta.id === attachmentId);
      if (target?.localPreviewUrl) {
        URL.revokeObjectURL(target.localPreviewUrl);
      }
      return prev.filter((p) => p.meta.id !== attachmentId);
    });
    try {
      await api.deleteAiAttachment(attachmentId);
    } catch {
      // Ignore deletion errors for ephemeral files
    }
  };

  const stopGeneration = () => {
    abortControllerRef.current?.abort();
  };

  const sendMessage = async (
    rawText: string,
    options?: { regenerate?: boolean; overrideAttachmentIds?: string[] }
  ) => {
    const trimmed = rawText.trim();
    const attachmentIds = options?.overrideAttachmentIds
      ? options.overrideAttachmentIds
      : pendingAttachments.map((p) => p.meta.id);
    const attachedMetas = options?.overrideAttachmentIds
      ? []
      : pendingAttachments.map((p) => p.meta);

    if ((!trimmed && attachmentIds.length === 0) || sending || uploadingAttachment) return;

    const isRegenerate = Boolean(options?.regenerate);
    const userDisplayText = trimmed || (isEn ? 'Analyze attached file(s)' : 'تحليل المرفقات');
    const streamingMsgId = `ai_stream_${Date.now()}`;
    const userMsgId = `usr_${Date.now()}`;

    const history: AiChatHistoryItem[] = (
      isRegenerate
        ? messages.slice(0, Math.max(0, messages.length - 1))
        : messages
    )
      .filter((m) => !m.isError)
      .slice(-8)
      .map((m) => ({ role: m.role, content: m.content }));

    isNearBottomRef.current = true;
    setShowScrollBottom(false);
    setComposerNotice(null);
    setShowQuickPrompts(false);
    setAttachMenuOpen(false);

    if (isRegenerate) {
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        const base = last && last.role === 'assistant' ? prev.slice(0, -1) : prev;
        return [
          ...base,
          {
            id: streamingMsgId,
            role: 'assistant',
            content: '',
            isStreaming: true,
          },
        ];
      });
    } else {
      const userMsg: ChatMessageItem = {
        id: userMsgId,
        role: 'user',
        content: userDisplayText,
        attachments: attachedMetas.length > 0 ? attachedMetas : undefined,
      };
      setMessages((prev) => [
        ...prev,
        userMsg,
        {
          id: streamingMsgId,
          role: 'assistant',
          content: '',
          isStreaming: true,
        },
      ]);
      setInput('');
      setPendingAttachments((prev) => {
        prev.forEach((p) => {
          if (p.localPreviewUrl) URL.revokeObjectURL(p.localPreviewUrl);
        });
        return [];
      });
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;
    setSending(true);

    try {
      const res = await api.streamAiChat(
        {
          message: trimmed,
          history,
          conversationId,
          attachmentIds,
          pageContext: pageContext
            ? { ...pageContext, locale: isEn ? 'en' : 'ar' }
            : { locale: isEn ? 'en' : 'ar' },
          locale: isEn ? 'en' : 'ar',
          regenerate: isRegenerate,
        },
        {
          signal: controller.signal,
          onMeta: (meta) => {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === streamingMsgId
                  ? {
                      ...m,
                      cards: meta.cards ?? m.cards,
                      stats: meta.stats !== undefined ? meta.stats : m.stats,
                    }
                  : m
              )
            );
          },
          onDelta: (chunk) => {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === streamingMsgId ? { ...m, content: `${m.content}${chunk}` } : m
              )
            );
          },
        }
      );

      setUsage(res.usage);
      if (res.conversationId) {
        setConversationId(res.conversationId);
      }
      setMessages((prev) =>
        prev.map((m) => {
          if (m.id === userMsgId && res.userMessageId) {
            return {
              ...m,
              serverId: res.userMessageId,
              attachments: res.attachments || m.attachments,
            };
          }
          if (m.id === streamingMsgId) {
            return {
              ...m,
              serverId: res.assistantMessageId,
              content: res.reply,
              cards: res.cards,
              stats: res.stats ?? null,
              suggestedFollowUps: res.suggestedFollowUps,
              isStreaming: false,
              interrupted: res.interrupted,
            };
          }
          return m;
        })
      );
      if (aiSettings.autoRead && !res.interrupted && res.reply.trim()) {
        void voice.toggleSpeak(streamingMsgId, res.reply);
      }
    } catch (err: unknown) {
      const isAbort = err instanceof Error && err.name === 'AbortError';
      if (isAbort) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === streamingMsgId
              ? {
                  ...m,
                  content:
                    m.content ||
                    (isEn ? 'Generation stopped.' : 'تم إيقاف الرد.'),
                  isStreaming: false,
                  interrupted: true,
                }
              : m
          )
        );
      } else {
        const msgText =
          err instanceof Error && err.message
            ? err.message
            : isEn
            ? 'Unable to respond right now. Please try again in a moment.'
            : 'تعذر الحصول على رد الآن، يرجى المحاولة بعد لحظات.';
        setMessages((prev) =>
          prev.map((m) =>
            m.id === streamingMsgId
              ? {
                  ...m,
                  content: msgText,
                  isStreaming: false,
                  isError: true,
                  retryPrompt: trimmed,
                  retryAttachmentIds: attachmentIds.length ? attachmentIds : undefined,
                }
              : m
          )
        );
      }
    } finally {
      abortControllerRef.current = null;
      setSending(false);
    }
  };

  const handleRegenerate = () => {
    if (sending) return;
    let lastUserMsg: ChatMessageItem | undefined;
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      if (messages[i].role === 'user') {
        lastUserMsg = messages[i];
        break;
      }
    }
    if (!lastUserMsg) return;
    void sendMessage(lastUserMsg.content, {
      regenerate: true,
      overrideAttachmentIds: lastUserMsg.attachments?.map((a) => a.id),
    });
  };

  const handleCopyMessage = async (msgId: string, content: string) => {
    let copied = false;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(content);
        copied = true;
      }
    } catch {
      copied = false;
    }

    if (!copied) {
      try {
        const ta = document.createElement('textarea');
        ta.value = content;
        ta.setAttribute('readonly', '');
        ta.style.position = 'fixed';
        ta.style.top = '0';
        ta.style.left = '0';
        ta.style.width = '1px';
        ta.style.height = '1px';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.focus({ preventScroll: true });
        ta.select();
        ta.setSelectionRange(0, ta.value.length);
        copied = document.execCommand('copy');
        document.body.removeChild(ta);
      } catch {
        copied = false;
      }
    }

    if (copied) {
      setCopiedId(msgId);
      window.setTimeout(() => {
        setCopiedId((cur) => (cur === msgId ? null : cur));
      }, 1800);
    }
  };

  const handleFeedback = async (msg: ChatMessageItem, nextVal: 'up' | 'down') => {
    const toggled: AiFeedbackValue = msg.feedback === nextVal ? null : nextVal;
    setMessages((prev) =>
      prev.map((m) => (m.id === msg.id ? { ...m, feedback: toggled } : m))
    );
    const targetMsgId = msg.serverId || msg.id;
    if (conversationId && targetMsgId) {
      try {
        await api.sendAiFeedback(conversationId, targetMsgId, toggled);
      } catch {
        // Keep optimistic UI feedback even if server record missed
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void sendMessage(input);
  };

  const handleComposerChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setInput(val);
    if (val === '/') {
      setShowQuickPrompts(true);
    } else if (showQuickPrompts && !val.startsWith('/')) {
      setShowQuickPrompts(false);
    }
  };

  const handleComposerKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      void sendMessage(input);
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const files = Array.from(e.clipboardData?.files || []);
    if (files.length > 0) {
      e.preventDefault();
      void handleUploadFiles(files);
    }
  };

  const handleCardClick = (listingId: string) => {
    onSelectListing(listingId);
    if (window.innerWidth < 768) {
      setOpen(false);
    }
  };

  const handleRouteAction = (target: PageView, fallbackPrompt: string) => {
    if (onNavigate) {
      onNavigate(target);
      setOpen(false);
      return;
    }
    void sendMessage(fallbackPrompt);
  };

  const handleNewConversation = () => {
    abortControllerRef.current?.abort();
    voice.cancelRecording();
    voice.stopSpeaking();
    setSending(false);
    restoredConvIdRef.current = null;
    setConversationId(null);
    setMessages([]);
    setInput('');
    setPendingAttachments((prev) => {
      prev.forEach((p) => {
        if (p.localPreviewUrl) URL.revokeObjectURL(p.localPreviewUrl);
      });
      return [];
    });
    setShowQuickPrompts(false);
    setComposerNotice(null);
    setHistoryOpen(false);
    window.setTimeout(() => {
      inputRef.current?.focus();
    }, 20);
  };

  const handleMinimize = () => {
    setMinimized(true);
    setHeaderMenuOpen(false);
    setAttachMenuOpen(false);
  };

  const handleRestoreFromMinimized = () => {
    setMinimized(false);
    setOpen(true);
  };

  const closeAssistant = () => {
    setMinimized(false);
    setOpen(false);
    setHeaderMenuOpen(false);
    setAttachMenuOpen(false);
    launcherRef.current?.focus();
  };

  const openCamera = () => {
    setAttachMenuOpen(false);
    if (
      typeof navigator !== 'undefined' &&
      navigator.mediaDevices &&
      typeof navigator.mediaDevices.getUserMedia === 'function'
    ) {
      setCameraOpen(true);
    } else {
      cameraInputRef.current?.click();
    }
  };

  if (!enabled) return null;

  const brandTitle = isEn ? 'Mirbah Assistant' : 'مساعد مِرباح';
  const brandSubtitle = isEn ? 'Available to help' : 'متاح لمساعدتك';

  const quickActionCards = isEn
    ? [
        {
          key: 'search',
          title: 'Find livestock',
          subtitle: 'Offers matching your needs',
          Icon: Search,
          onClick: () => void sendMessage('أبي عروض نعيمي بالرياض متوفرة حالياً'),
        },
        {
          key: 'prices',
          title: 'Market prices today',
          subtitle: 'Average price by breed',
          Icon: TrendingUp,
          onClick: () => void sendMessage('كم أسعار النعيمي والحري والنجدي الحالية؟'),
        },
        {
          key: 'compare',
          title: 'Compare breeds',
          subtitle: 'Pick the best fit for you',
          Icon: Scale,
          onClick: () => void sendMessage('قارن لي بين النعيمي والحري والنجدي للذبح والتربية'),
        },
        {
          key: 'post',
          title: 'Post a listing',
          subtitle: 'Draft & confirm clearly',
          Icon: PlusSquare,
          onClick: () =>
            void sendMessage(
              'Help me draft a clear livestock listing with breed, age, weight, price, and confirmation steps before publishing.'
            ),
        },
      ]
    : [
        {
          key: 'search',
          title: 'ابحث عن المواشي',
          subtitle: 'عروض موثقة تناسب طلبك',
          Icon: Search,
          onClick: () => void sendMessage('أبي عروض نعيمي بالرياض متوفرة حالياً'),
        },
        {
          key: 'prices',
          title: 'أسعار السوق اليوم',
          subtitle: 'الأسعار حسب السلالة والمنطقة',
          Icon: TrendingUp,
          onClick: () => void sendMessage('كم أسعار النعيمي والحري والنجدي الحالية؟'),
        },
        {
          key: 'compare',
          title: 'قارن بين السلالات',
          subtitle: 'اكتشف الفروق واختر الأنسب',
          Icon: Scale,
          onClick: () => void sendMessage('قارن لي بين النعيمي والحري والنجدي للذبح والتربية'),
        },
        {
          key: 'post',
          title: 'ساعدني في إضافة إعلان',
          subtitle: 'أنشئ إعلاناً واضحاً وجذاباً',
          Icon: PlusSquare,
          onClick: () =>
            void sendMessage('ساعدني في صياغة إعلان مواشي جديد في مِرباح مع مراجعة التفاصيل قبل النشر'),
        },
      ];

  const promptShortcuts = isEn
    ? [
        { label: 'Naimi offers in Riyadh', prompt: 'أبي نعيمي بالرياض' },
        { label: 'Harri & Najdi prices', prompt: 'كم أسعار الحري والنجدي؟' },
        {
          label: 'Open add listing page',
          action: () => handleRouteAction('add', 'كيف أضيف إعلان جديد في مِرباح؟'),
        },
        {
          label: 'Feast budget calculator',
          action: () => handleRouteAction('feast', 'كيف أقدر عدد الذبائح للوليمة؟'),
        },
      ]
    : [
        { label: 'عروض النعيمي في الرياض', prompt: 'أبي نعيمي بالرياض' },
        { label: 'أسعار الحري والنجدي اليوم', prompt: 'كم أسعار الحري والنجدي؟' },
        {
          label: 'الانتقال لصفحة إضافة إعلان',
          action: () => handleRouteAction('add', 'كيف أضيف إعلان جديد في مِرباح؟'),
        },
        {
          label: 'حاسبة ميزانية الولائم والذبائح',
          action: () => handleRouteAction('feast', 'كيف أقدر عدد الذبائح للوليمة؟'),
        },
      ];

  const showCharCounter = input.length >= Math.floor(maxMessageLength * 0.7);
  const bottomLauncherOffset =
    offsetForBottomBar === 'detail'
      ? 'bottom-[calc(4.85rem+env(safe-area-inset-bottom))] lg:bottom-6'
      : offsetForBottomBar
      ? 'bottom-[calc(4.85rem+env(safe-area-inset-bottom))] md:bottom-6'
      : 'bottom-[max(1.25rem,env(safe-area-inset-bottom))] sm:bottom-6';

  const floatingLauncherPosition =
    offsetForBottomBar === 'detail'
      ? 'right-[calc(1rem+env(safe-area-inset-right))] md:right-6 bottom-[calc(5rem+env(safe-area-inset-bottom))] lg:bottom-6'
      : offsetForBottomBar
      ? 'right-[calc(1rem+env(safe-area-inset-right))] md:right-6 bottom-[calc(5rem+env(safe-area-inset-bottom))] md:bottom-6'
      : 'right-[calc(1rem+env(safe-area-inset-right))] md:right-6 bottom-[calc(1rem+env(safe-area-inset-bottom))] md:bottom-6';

  const lastAssistantIndex = messages.reduce(
    (lastIdx, m, idx) => (m.role === 'assistant' ? idx : lastIdx),
    -1
  );

  return (
    <>
      {/* Minimized Floating Pill */}
      {open && minimized && (
        <div
          dir={dir}
          data-testid="ai-minimized-pill"
          className={`fixed right-4 sm:right-6 z-40 flex items-center gap-2 rounded-full bg-[#103B2D] text-white border border-[#B99A56]/70 shadow-[0_12px_30px_rgba(16,59,45,0.35)] px-3 py-1.5 ${bottomLauncherOffset}`}
        >
          <button
            type="button"
            onClick={handleRestoreFromMinimized}
            data-testid="ai-minimized-restore"
            className="flex items-center gap-2 text-xs font-bold cursor-pointer focus-visible:outline-2 focus-visible:outline-[#B99A56]"
          >
            <AiAssistantIcon className="w-7 h-7 shrink-0" />
            <span className="max-w-[140px] truncate">{brandTitle}</span>
            {sending && (
              <Loader2 size={13} className="animate-spin text-[#D8B66D]" aria-hidden="true" />
            )}
          </button>
          <button
            type="button"
            onClick={closeAssistant}
            aria-label={isEn ? 'Close assistant' : 'إغلاق المساعد'}
            className="w-6 h-6 rounded-full hover:bg-white/15 flex items-center justify-center cursor-pointer"
          >
            <X size={13} aria-hidden="true" />
          </button>
        </div>
      )}

      {/* Floating AI Assistant Launcher Button */}
      {!open && (
        <div dir={dir} className={`fixed z-40 ${floatingLauncherPosition}`}>
          <button
            ref={launcherRef}
            type="button"
            onClick={() => {
              setMinimized(false);
              setOpen(true);
            }}
            aria-label={brandTitle}
            title={brandTitle}
            data-testid="ai-assistant-launcher"
            className="ai-launcher-enter group block h-14 w-14 md:h-[60px] md:w-[60px] lg:h-16 lg:w-16 p-0 bg-transparent border-0 rounded-full cursor-pointer transition-transform duration-200 ease-out hover:scale-105 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-[#B99A56]"
          >
            <AiAssistantIcon className="h-full w-full drop-shadow-[0_3px_8px_rgba(16,59,45,0.16)] transition-[filter] duration-200 ease-out group-hover:drop-shadow-[0_5px_12px_rgba(16,59,45,0.22)]" />
          </button>
        </div>
      )}

      {/* AI Assistant Chat Dialog */}
      {open &&
        !minimized &&
        typeof document !== 'undefined' &&
        createPortal(
          <>
            <div
              className="fixed inset-0 z-[110] bg-black/35 backdrop-blur-[1px] md:hidden"
              onClick={closeAssistant}
              aria-hidden="true"
            />

            <section
              role="dialog"
              aria-modal="true"
              aria-label={brandTitle}
              data-testid="ai-assistant-dialog"
              dir={dir}
              tabIndex={-1}
              style={mobileViewportHeight ? { height: `${mobileViewportHeight}px` } : undefined}
              className={`ai-panel-enter fixed z-[111] flex flex-col bg-[#FCFBF8] dark:bg-[#14201B] text-[#16261E] dark:text-[#EDF3EF] shadow-[0_24px_60px_-14px_rgba(16,59,45,0.32)] inset-0 h-dvh md:inset-auto md:bottom-5 md:right-6 md:rounded-[20px] md:border md:border-[#E5DFD2] dark:md:border-[#293D33] overflow-hidden focus:outline-none transition-[width,height] duration-200 ${
                expanded
                  ? 'md:w-[min(780px,calc(100vw-3rem))] md:h-[min(740px,calc(100dvh-2rem))] md:max-h-[calc(100dvh-2rem)]'
                  : 'md:w-[440px] md:max-w-[calc(100vw-2rem)] md:h-[min(572px,calc(100dvh-2rem))] md:max-h-[calc(100dvh-2rem)]'
              }`}
            >
              {/* Dark Green Branded Header */}
              <header
                data-testid="ai-assistant-header"
                className="relative shrink-0 bg-[#103B2D] px-4 pt-[max(0.7rem,env(safe-area-inset-top))] pb-2.5 md:py-0 md:h-[64px] flex items-center text-white"
              >
                <div className="flex w-full items-center justify-between gap-2 min-w-0">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <AiAssistantIcon className="w-10 h-10 shrink-0" />
                    <div className="min-w-0">
                      <h2 className="font-display text-[15px] font-extrabold text-white leading-tight truncate">
                        {brandTitle}
                      </h2>
                      <p className="text-[11px] font-medium text-white/80 leading-snug truncate">
                        {brandSubtitle}
                      </p>
                    </div>
                  </div>

                  {/* Header Controls: History, Expand, New, Minimize, Close */}
                  <div className="flex items-center gap-0.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setHistoryOpen((prev) => !prev);
                        setHeaderMenuOpen(false);
                      }}
                      aria-label={isEn ? 'Conversation history' : 'سجل المحادثات'}
                      title={isEn ? 'Conversation history' : 'سجل المحادثات'}
                      aria-pressed={historyOpen}
                      data-testid="ai-header-history"
                      className={`hidden sm:flex w-8 h-8 rounded-lg items-center justify-center transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-[#B99A56] ${
                        historyOpen
                          ? 'bg-white/20 text-[#D8B66D]'
                          : 'text-white/80 hover:text-white hover:bg-white/10'
                      }`}
                    >
                      <History size={16} strokeWidth={1.85} aria-hidden="true" />
                    </button>

                    <button
                      type="button"
                      onClick={() => setExpanded((prev) => !prev)}
                      aria-label={
                        expanded
                          ? isEn
                            ? 'Exit fullscreen mode'
                            : 'إنهاء التكبير'
                          : isEn
                          ? 'Expand assistant'
                          : 'تكبير النافذة'
                      }
                      title={
                        expanded
                          ? isEn
                            ? 'Compact view'
                            : 'العرض الافتراضي'
                          : isEn
                          ? 'Expand'
                          : 'تكبير'
                      }
                      data-testid="ai-header-expand"
                      className="hidden md:flex w-8 h-8 rounded-lg text-white/80 hover:text-white hover:bg-white/10 items-center justify-center transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-[#B99A56]"
                    >
                      {expanded ? (
                        <Minimize2 size={15} strokeWidth={1.9} aria-hidden="true" />
                      ) : (
                        <Maximize2 size={15} strokeWidth={1.9} aria-hidden="true" />
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={handleNewConversation}
                      disabled={sending && messages.length === 0}
                      aria-label={isEn ? 'New conversation' : 'محادثة جديدة'}
                      title={isEn ? 'New conversation' : 'محادثة جديدة'}
                      data-testid="ai-header-new"
                      className="hidden sm:flex w-8 h-8 rounded-lg text-white/80 hover:text-white hover:bg-white/10 disabled:opacity-40 items-center justify-center transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-[#B99A56]"
                    >
                      <SquarePen size={16} strokeWidth={1.85} aria-hidden="true" />
                    </button>

                    {/* Compact Overflow Menu for Smaller Screens */}
                    <div className="relative sm:hidden">
                      <button
                        type="button"
                        onClick={() => setHeaderMenuOpen((prev) => !prev)}
                        aria-label={isEn ? 'More options' : 'خيارات إضافية'}
                        title={isEn ? 'More options' : 'خيارات إضافية'}
                        data-testid="ai-header-more"
                        className="w-8 h-8 rounded-lg text-white/85 hover:text-white hover:bg-white/10 flex items-center justify-center cursor-pointer"
                      >
                        <MoreVertical size={17} aria-hidden="true" />
                      </button>

                      {headerMenuOpen && (
                        <div className="absolute end-0 top-full mt-1.5 w-44 rounded-xl border border-[#E5DFD2] dark:border-[#25382F] bg-white dark:bg-[#121D18] text-[#16261E] dark:text-[#EDF3EF] shadow-xl overflow-hidden z-40">
                          <button
                            type="button"
                            onClick={() => {
                              setHistoryOpen((prev) => !prev);
                              setHeaderMenuOpen(false);
                            }}
                            className="w-full px-3 py-2.5 text-xs font-semibold flex items-center gap-2 hover:bg-[#F3EFE4] dark:hover:bg-[#182620] cursor-pointer"
                          >
                            <History size={14} className="text-[#B99A56]" aria-hidden="true" />
                            <span>{isEn ? 'Conversation history' : 'سجل المحادثات'}</span>
                          </button>
                          <button
                            type="button"
                            onClick={handleNewConversation}
                            className="w-full px-3 py-2.5 text-xs font-semibold flex items-center gap-2 hover:bg-[#F3EFE4] dark:hover:bg-[#182620] border-t border-[#E5DFD2]/70 dark:border-[#25382F]/70 cursor-pointer"
                          >
                            <SquarePen size={14} className="text-[#B99A56]" aria-hidden="true" />
                            <span>{isEn ? 'New conversation' : 'محادثة جديدة'}</span>
                          </button>
                        </div>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={handleMinimize}
                      aria-label={isEn ? 'Minimize assistant' : 'تصغير المساعد'}
                      title={isEn ? 'Minimize' : 'تصغير'}
                      data-testid="ai-header-minimize"
                      className="w-8 h-8 rounded-lg text-white/80 hover:text-white hover:bg-white/10 flex items-center justify-center transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-[#B99A56]"
                    >
                      <Minus size={17} strokeWidth={1.9} aria-hidden="true" />
                    </button>

                    <button
                      type="button"
                      onClick={closeAssistant}
                      aria-label={isEn ? 'Close assistant' : 'إغلاق المساعد'}
                      title={isEn ? 'Close' : 'إغلاق'}
                      data-testid="ai-header-close"
                      className="w-8 h-8 rounded-lg text-white/80 hover:text-white hover:bg-white/10 flex items-center justify-center transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-[#B99A56]"
                    >
                      <X size={17} strokeWidth={1.9} aria-hidden="true" />
                    </button>
                  </div>
                </div>
              </header>

              {/* Main Content Area + Overlays */}
              <div className="relative flex-1 min-h-0 flex flex-col">
                {/* Scrollable Chat / Welcome Body */}
                <div
                  ref={bodyRef}
                  onScroll={handleBodyScroll}
                  data-testid="ai-assistant-body"
                  className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden souq-thin-scrollbar px-3.5 py-2.5"
                  aria-live="polite"
                >
                  {messages.length === 0 ? (
                    <div className="flex min-h-full flex-col justify-between gap-2.5">
                      {/* Preserved Compact Welcome Hero */}
                      <div className="text-center pt-0.5">
                        <AiAssistantIcon
                          className="w-16 h-16 mx-auto drop-shadow-[0_6px_14px_rgba(16,59,45,0.16)]"
                        />

                        <p className="mt-1.5 text-[11.5px] font-bold text-[#B99A56] dark:text-[#D8B66D] leading-tight">
                          {isEn ? 'Your smart livestock assistant' : 'مساعدك الذكي في عالم المواشي'}
                        </p>

                        <div className="mt-0.5 flex items-center justify-center gap-3">
                          <span aria-hidden="true" className="h-[1px] w-10 bg-[#B99A56]/40" />
                          <h3 className="font-display text-[19px] font-extrabold text-[#103B2D] dark:text-[#EDF5F0] leading-tight">
                            {isEn ? 'Welcome!' : 'حياك الله!'}
                          </h3>
                          <span aria-hidden="true" className="h-[1px] w-10 bg-[#B99A56]/40" />
                        </div>

                        <p className="mt-1 mx-auto max-w-[34ch] text-[12px] text-[#5F6C65] dark:text-[#9CB0A5] leading-snug">
                          {isEn
                            ? 'Find suitable livestock, compare market prices, and discover verified offers.'
                            : 'أساعدك في العثور على المواشي المناسبة، ومقارنة الأسعار واكتشاف أفضل العروض.'}
                        </p>
                      </div>

                      {/* Preserved Compact 2x2 Quick Action Cards Grid */}
                      <div className="space-y-2 pb-0.5">
                        <h4 className="text-center text-[12.5px] font-extrabold text-[#103B2D] dark:text-[#DCE8E1]">
                          {isEn ? 'How can I help you?' : 'كيف يمكنني مساعدتك؟'}
                        </h4>

                        <div
                          className="grid grid-cols-2 auto-rows-fr gap-2"
                          role="group"
                          aria-label={isEn ? 'Quick assistant actions' : 'خيارات المساعد السريعة'}
                          data-testid="ai-quick-actions-grid"
                        >
                          {quickActionCards.map(({ key, title, subtitle, Icon, onClick }) => (
                            <button
                              key={key}
                              type="button"
                              disabled={sending}
                              onClick={onClick}
                              data-testid={`ai-quick-card-${key}`}
                              className="group flex h-full min-h-[60px] w-full min-w-0 items-center gap-2 sm:gap-2.5 rounded-xl border border-[#E5DFD2] dark:border-[#293D33] bg-white dark:bg-[#1A2922] hover:border-[#B99A56] dark:hover:border-[#B99A56] px-2 sm:px-2.5 py-2 transition-colors duration-150 cursor-pointer disabled:opacity-50 text-start focus-visible:outline-2 focus-visible:outline-[#B99A56]"
                            >
                              <span className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-[#F5F1E6] dark:bg-[#182620] text-[#B99A56] dark:text-[#D8B66D] flex items-center justify-center shrink-0">
                                <Icon size={15} strokeWidth={1.9} aria-hidden="true" />
                              </span>

                              <span className="flex-1 min-w-0">
                                <span className="block font-display text-[11.5px] sm:text-[12.5px] font-bold text-[#103B2D] dark:text-[#EDF3EF] leading-snug">
                                  {title}
                                </span>
                                <span className="mt-0.5 block text-[10px] sm:text-[10.5px] text-[#6C756C] dark:text-[#9CB0A5] leading-tight line-clamp-2">
                                  {subtitle}
                                </span>
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3.5">
                      {messages.map((msg, idx) => {
                        const isLastAssistant = idx === lastAssistantIndex;
                        const isSpeakingThis = voice.playingMessageId === msg.id;
                        const isLoadingSpeechThis = voice.ttsLoadingId === msg.id;

                        return (
                          <div key={msg.id} className="ai-msg-enter space-y-2">
                            {msg.role === 'user' ? (
                              <div className="flex flex-col items-end gap-1.5">
                                {msg.attachments && msg.attachments.length > 0 && (
                                  <div className="flex flex-wrap justify-end gap-1.5 max-w-[85%]">
                                    {msg.attachments.map((att) =>
                                      att.kind === 'image' ? (
                                        <div
                                          key={att.id}
                                          className="w-20 h-20 rounded-xl overflow-hidden border border-[#E5DFD2] dark:border-[#25382F] bg-[#F5F1E6] dark:bg-[#121D18]"
                                        >
                                          <img
                                            src={att.url}
                                            alt={att.name}
                                            className="w-full h-full object-cover"
                                          />
                                        </div>
                                      ) : (
                                        <div
                                          key={att.id}
                                          className="inline-flex items-center gap-1.5 rounded-xl border border-[#E5DFD2] dark:border-[#25382F] bg-white dark:bg-[#14231C] px-2.5 py-1.5 text-[11px] font-semibold text-[#103B2D] dark:text-[#EDF3EF]"
                                        >
                                          <FileText size={13} className="text-[#B99A56]" aria-hidden="true" />
                                          <span className="max-w-[140px] truncate">{att.name}</span>
                                        </div>
                                      )
                                    )}
                                  </div>
                                )}

                                <div className="max-w-[85%] rounded-2xl rounded-ee-md bg-[#103B2D] dark:bg-[#145C42] px-4 py-2.5 text-[13.5px] text-white whitespace-pre-wrap leading-relaxed break-words [overflow-wrap:anywhere]">
                                  {msg.content}
                                </div>
                              </div>
                            ) : (
                              <div className="space-y-2">
                                <div className="flex items-start gap-2.5">
                                  <AiAssistantIcon className="w-8 h-8 shrink-0 mt-0.5" />
                                  <div
                                    className={`flex-1 min-w-0 rounded-2xl rounded-es-md px-4 py-2.5 text-[13.5px] leading-relaxed break-words [overflow-wrap:anywhere] ${
                                      msg.isError
                                        ? 'bg-red-50 dark:bg-red-950/40 text-red-900 dark:text-red-100 border border-red-200 dark:border-red-800/70'
                                        : 'bg-white dark:bg-[#1A2922] border border-[#E5DFD2] dark:border-[#293D33] text-[#16261E] dark:text-[#EDF3EF]'
                                    }`}
                                  >
                                    {msg.isStreaming && !msg.content ? (
                                      <div className="flex gap-1.5 py-1" aria-label={isEn ? 'Typing' : 'يكتب الآن'}>
                                        <span className="h-2 w-2 rounded-full bg-[#103B2D]/45 dark:bg-[#5ED1A1]/65 animate-bounce [animation-delay:0ms]" />
                                        <span className="h-2 w-2 rounded-full bg-[#103B2D]/45 dark:bg-[#5ED1A1]/65 animate-bounce [animation-delay:150ms]" />
                                        <span className="h-2 w-2 rounded-full bg-[#B99A56] animate-bounce [animation-delay:300ms]" />
                                      </div>
                                    ) : msg.isError ? (
                                      <p className="whitespace-pre-wrap">{msg.content}</p>
                                    ) : (
                                      <div>
                                        <SafeMarkdown content={msg.content} />
                                        {msg.isStreaming && (
                                          <span
                                            aria-hidden="true"
                                            className="inline-block w-1.5 h-3.5 ms-1 align-middle bg-[#B99A56] animate-pulse"
                                          />
                                        )}
                                      </div>
                                    )}

                                    {msg.interrupted && !msg.isError && (
                                      <p className="mt-1.5 text-[10.5px] font-medium text-[#7A847E] dark:text-[#93A69C]">
                                        {isEn ? 'Stopped by user' : 'تم إيقاف التوليد'}
                                      </p>
                                    )}

                                    {msg.isError && msg.retryPrompt !== undefined && (
                                      <div className="mt-2">
                                        <button
                                          type="button"
                                          disabled={sending}
                                          onClick={() =>
                                            void sendMessage(msg.retryPrompt!, {
                                              overrideAttachmentIds: msg.retryAttachmentIds,
                                            })
                                          }
                                          className="min-h-[34px] px-2.5 py-1 rounded-lg bg-white dark:bg-[#121D18] border border-red-200 dark:border-red-800 text-xs font-semibold text-red-800 dark:text-red-200 hover:bg-red-100/70 inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                                        >
                                          <RotateCcw size={12} aria-hidden="true" />
                                          <span>{isEn ? 'Try again' : 'إعادة المحاولة'}</span>
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                </div>

                                {/* Real Marketplace Stats Summary Card */}
                                {msg.stats && msg.stats.count > 0 && (
                                  <div
                                    data-testid="ai-market-stats-card"
                                    className="ms-10 rounded-xl border border-[#E5DFD2] dark:border-[#25382F] bg-[#F5F1E6]/65 dark:bg-[#121D18] p-2.5 text-xs"
                                  >
                                    <div className="flex items-center justify-between gap-2 mb-1.5">
                                      <span className="font-display font-bold text-[#103B2D] dark:text-[#EDF3EF] flex items-center gap-1.5">
                                        <TrendingUp size={13} className="text-[#B99A56]" aria-hidden="true" />
                                        <span>
                                          {isEn ? 'Live Market Stats' : 'إحصائيات السوق الفعلية'}
                                          {msg.stats.breedName ? ` · ${msg.stats.breedName}` : ''}
                                          {msg.stats.regionName ? ` (${msg.stats.regionName})` : ''}
                                        </span>
                                      </span>
                                      <span className="text-[11px] font-semibold text-[#5F6C65] dark:text-[#9CB0A5]">
                                        {isEn ? `${msg.stats.count} offers` : `${msg.stats.count} عرض`}
                                      </span>
                                    </div>
                                    <div className="grid grid-cols-3 gap-1.5 text-center">
                                      <div className="rounded-lg bg-white dark:bg-[#16261E] px-2 py-1 border border-[#E5DFD2]/60 dark:border-[#25382F]">
                                        <span className="block text-[10px] text-[#6C756C] dark:text-[#9CB0A5]">
                                          {isEn ? 'Min' : 'الأدنى'}
                                        </span>
                                        <span className="font-bold text-[#103B2D] dark:text-[#5ED1A1] tabular-nums">
                                          {formatPriceSar(msg.stats.minPrice)}
                                        </span>
                                      </div>
                                      <div className="rounded-lg bg-white dark:bg-[#16261E] px-2 py-1 border border-[#E5DFD2]/60 dark:border-[#25382F]">
                                        <span className="block text-[10px] text-[#6C756C] dark:text-[#9CB0A5]">
                                          {isEn ? 'Avg' : 'المتوسط'}
                                        </span>
                                        <span className="font-bold text-[#103B2D] dark:text-[#5ED1A1] tabular-nums">
                                          {formatPriceSar(msg.stats.avgPrice)}
                                        </span>
                                      </div>
                                      <div className="rounded-lg bg-white dark:bg-[#16261E] px-2 py-1 border border-[#E5DFD2]/60 dark:border-[#25382F]">
                                        <span className="block text-[10px] text-[#6C756C] dark:text-[#9CB0A5]">
                                          {isEn ? 'Max' : 'الأعلى'}
                                        </span>
                                        <span className="font-bold text-[#103B2D] dark:text-[#5ED1A1] tabular-nums">
                                          {formatPriceSar(msg.stats.maxPrice)}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                )}

                                {/* Real Marketplace Listing Cards */}
                                {msg.cards && msg.cards.length > 0 && (
                                  <div className="space-y-2 ps-10" data-testid="ai-listing-cards">
                                    {msg.cards.map((card) => {
                                      const metaParts = [card.categoryName, card.breedName, card.city]
                                        .filter(Boolean)
                                        .join(' · ');
                                      return (
                                        <button
                                          key={card.id}
                                          type="button"
                                          onClick={() => handleCardClick(card.id)}
                                          data-testid={`ai-listing-card-${card.id}`}
                                          className="group w-full flex items-center gap-3 rounded-xl border border-[#E5DFD2] dark:border-[#293D33] bg-white dark:bg-[#1A2922] hover:border-[#B99A56] p-2.5 transition-colors cursor-pointer text-start focus-visible:outline-2 focus-visible:outline-[#B99A56]"
                                        >
                                          {card.imageUrl && (
                                            <div className="relative h-13 w-13 shrink-0 overflow-hidden rounded-lg bg-[#F3EFE4] dark:bg-[#182620]">
                                              <SafeImage
                                                src={card.imageUrl}
                                                alt={card.title}
                                                width={52}
                                                height={52}
                                                className="h-full w-full object-cover"
                                              />
                                            </div>
                                          )}

                                          <div className="flex-1 min-w-0 space-y-0.5">
                                            <div className="flex items-center gap-1">
                                              <p className="font-display text-[13px] font-bold text-[#16261E] dark:text-[#EDF3EF] truncate">
                                                {card.title}
                                              </p>
                                              {card.sellerVerified && (
                                                <ShieldCheck
                                                  size={13}
                                                  className="text-[#103B2D] dark:text-[#5ED1A1] shrink-0"
                                                  aria-label={isEn ? 'Verified breeder' : 'مربي موثق'}
                                                />
                                              )}
                                            </div>

                                            {metaParts && (
                                              <p className="text-[11px] text-[#6C756C] dark:text-[#9CB0A5] truncate">
                                                {metaParts}
                                              </p>
                                            )}

                                            <p className="text-xs font-extrabold text-[#103B2D] dark:text-[#5ED1A1] tabular-nums">
                                              {formatPriceSar(card.priceAmount)}
                                            </p>
                                          </div>

                                          <span className="shrink-0 inline-flex items-center gap-0.5 text-xs font-bold text-[#B99A56] dark:text-[#D8B66D] group-hover:underline whitespace-nowrap">
                                            <span>{isEn ? 'View' : 'عرض'}</span>
                                            <ListingArrow size={12} aria-hidden="true" />
                                          </span>
                                        </button>
                                      );
                                    })}
                                  </div>
                                )}

                                {/* Assistant Message Action Toolbar */}
                                {!msg.isStreaming && !msg.isError && msg.content && (
                                  <div className="ps-10 flex items-center gap-1 text-[#78827B] dark:text-[#9CB0A5]">
                                    <button
                                      type="button"
                                      onClick={() => void handleCopyMessage(msg.id, msg.content)}
                                      aria-label={isEn ? 'Copy response' : 'نسخ الرد'}
                                      title={isEn ? 'Copy' : 'نسخ'}
                                      data-testid={`ai-msg-copy-${msg.id}`}
                                      className="h-7 px-2 rounded-lg hover:bg-[#F3EFE4] dark:hover:bg-[#182620] hover:text-[#103B2D] dark:hover:text-[#D8B66D] inline-flex items-center gap-1 text-[11px] transition-colors cursor-pointer"
                                    >
                                      {copiedId === msg.id ? (
                                        <>
                                          <Check size={12} className="text-[#103B2D] dark:text-[#5ED1A1]" aria-hidden="true" />
                                          <span className="text-[#103B2D] dark:text-[#5ED1A1] font-semibold">
                                            {isEn ? 'Copied' : 'تم النسخ'}
                                          </span>
                                        </>
                                      ) : (
                                        <Copy size={12} aria-hidden="true" />
                                      )}
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => void voice.toggleSpeak(msg.id, msg.content)}
                                      aria-label={
                                        isSpeakingThis
                                          ? isEn
                                            ? 'Stop reading aloud'
                                            : 'إيقاف القراءة'
                                          : isEn
                                          ? 'Read response aloud'
                                          : 'قراءة الرد صوتياً'
                                      }
                                      title={
                                        isSpeakingThis
                                          ? isEn
                                            ? 'Stop'
                                            : 'إيقاف'
                                          : isEn
                                          ? 'Read aloud'
                                          : 'استماع'
                                      }
                                      data-testid={`ai-msg-tts-${msg.id}`}
                                      className={`h-7 w-7 rounded-lg hover:bg-[#F3EFE4] dark:hover:bg-[#182620] flex items-center justify-center transition-colors cursor-pointer ${
                                        isSpeakingThis
                                          ? 'text-[#103B2D] dark:text-[#D8B66D] bg-[#F5F1E6] dark:bg-[#182620]'
                                          : 'hover:text-[#103B2D] dark:hover:text-[#D8B66D]'
                                      }`}
                                    >
                                      {isLoadingSpeechThis ? (
                                        <Loader2 size={12} className="animate-spin" aria-hidden="true" />
                                      ) : isSpeakingThis ? (
                                        <VolumeX size={13} aria-hidden="true" />
                                      ) : (
                                        <Volume2 size={13} aria-hidden="true" />
                                      )}
                                    </button>

                                    {isLastAssistant && (
                                      <button
                                        type="button"
                                        disabled={sending}
                                        onClick={handleRegenerate}
                                        aria-label={isEn ? 'Regenerate response' : 'إعادة توليد الرد'}
                                        title={isEn ? 'Regenerate' : 'إعادة التوليد'}
                                        data-testid="ai-msg-regenerate"
                                        className="h-7 w-7 rounded-lg hover:bg-[#F3EFE4] dark:hover:bg-[#182620] hover:text-[#103B2D] dark:hover:text-[#D8B66D] disabled:opacity-40 flex items-center justify-center transition-colors cursor-pointer"
                                      >
                                        <RefreshCw size={12} aria-hidden="true" />
                                      </button>
                                    )}

                                    <div className="flex items-center gap-0.5 ms-1">
                                      <button
                                        type="button"
                                        onClick={() => void handleFeedback(msg, 'up')}
                                        aria-label={isEn ? 'Helpful response' : 'رد مفيد'}
                                        aria-pressed={msg.feedback === 'up'}
                                        title={isEn ? 'Like' : 'أعجبني'}
                                        data-testid={`ai-msg-like-${msg.id}`}
                                        className={`h-7 w-7 rounded-lg hover:bg-[#F3EFE4] dark:hover:bg-[#182620] flex items-center justify-center transition-colors cursor-pointer ${
                                          msg.feedback === 'up'
                                            ? 'text-[#103B2D] dark:text-[#5ED1A1] bg-[#F5F1E6] dark:bg-[#182620]'
                                            : ''
                                        }`}
                                      >
                                        <ThumbsUp size={12} aria-hidden="true" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => void handleFeedback(msg, 'down')}
                                        aria-label={isEn ? 'Unhelpful response' : 'رد غير مفيد'}
                                        aria-pressed={msg.feedback === 'down'}
                                        title={isEn ? 'Dislike' : 'لم يعجبني'}
                                        data-testid={`ai-msg-dislike-${msg.id}`}
                                        className={`h-7 w-7 rounded-lg hover:bg-[#F3EFE4] dark:hover:bg-[#182620] flex items-center justify-center transition-colors cursor-pointer ${
                                          msg.feedback === 'down'
                                            ? 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30'
                                            : ''
                                        }`}
                                      >
                                        <ThumbsDown size={12} aria-hidden="true" />
                                      </button>
                                    </div>
                                  </div>
                                )}

                                {/* Dynamic Follow-up Prompt Buttons */}
                                {!msg.isStreaming &&
                                  msg.suggestedFollowUps &&
                                  msg.suggestedFollowUps.length > 0 && (
                                    <div className="flex flex-wrap gap-1.5 ps-10 pt-0.5">
                                      {msg.suggestedFollowUps.map((promptText) => (
                                        <button
                                          key={promptText}
                                          type="button"
                                          disabled={sending}
                                          onClick={() => void sendMessage(promptText)}
                                          className="min-h-[32px] rounded-lg border border-[#E5DFD2] dark:border-[#293D33] bg-white dark:bg-[#1A2922] hover:bg-[#F3EFE4] dark:hover:bg-[#21332B] hover:border-[#B99A56] px-3 py-1 text-xs font-medium text-[#16261E] dark:text-[#EDF3EF] transition-colors cursor-pointer disabled:opacity-50"
                                        >
                                          {promptText}
                                        </button>
                                      ))}
                                    </div>
                                  )}
                              </div>
                            )}
                          </div>
                        );
                      })}

                      <div ref={listEndRef} />
                    </div>
                  )}
                </div>

                {/* Smart Scroll-to-Bottom Pill */}
                {showScrollBottom && !historyOpen && (
                  <button
                    type="button"
                    onClick={() => {
                      isNearBottomRef.current = true;
                      setShowScrollBottom(false);
                      listEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
                    }}
                    aria-label={isEn ? 'Scroll to latest messages' : 'النزول لآخر الرسائل'}
                    className="absolute bottom-3 end-4 z-10 w-8 h-8 rounded-full bg-white dark:bg-[#14231C] border border-[#E5DFD2] dark:border-[#25382F] shadow-md text-[#103B2D] dark:text-[#D8B66D] flex items-center justify-center hover:border-[#B99A56] cursor-pointer"
                  >
                    <ArrowDown size={15} aria-hidden="true" />
                  </button>
                )}

                {/* Conversation History Overlay Drawer */}
                <AiConversationDrawer
                  open={historyOpen}
                  isEn={isEn}
                  conversations={conversations}
                  loading={conversationsLoading}
                  activeConversationId={conversationId}
                  searchQuery={historySearch}
                  onSearchChange={setHistorySearch}
                  onSelect={(id) => void restoreConversation(id)}
                  onNewConversation={handleNewConversation}
                  onRename={async (id, title) => {
                    const res = await api.renameAiConversation(id, title);
                    setConversations((prev) =>
                      prev.map((c) => (c.id === id ? res.conversation : c))
                    );
                  }}
                  onDelete={async (id) => {
                    await api.deleteAiConversation(id);
                    setConversations((prev) => prev.filter((c) => c.id !== id));
                    if (conversationId === id) {
                      handleNewConversation();
                    }
                  }}
                  onClose={() => setHistoryOpen(false)}
                />

                {/* Live Camera Capture Overlay */}
                <AiCameraModal
                  open={cameraOpen}
                  isEn={isEn}
                  onClose={() => setCameraOpen(false)}
                  onCapture={(file) => void handleUploadFiles([file])}
                  onFallbackFilePicker={() => cameraInputRef.current?.click()}
                />
              </div>

              {/* Compact Bottom Composer & Footer */}
              <form
                onSubmit={handleSubmit}
                data-testid="ai-assistant-footer"
                className="relative shrink-0 border-t border-[#E5DFD2] dark:border-[#293D33] bg-[#FCFBF8] dark:bg-[#14201B] px-3.5 pt-2 pb-[max(0.65rem,env(safe-area-inset-bottom))]"
              >
                {/* Hidden File Inputs */}
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  className="hidden"
                  data-testid="ai-file-input-image"
                  onChange={(e) => {
                    if (e.target.files) void handleUploadFiles(e.target.files);
                    e.target.value = '';
                  }}
                />
                <input
                  ref={cameraInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  data-testid="ai-file-input-camera"
                  onChange={(e) => {
                    if (e.target.files) void handleUploadFiles(e.target.files);
                    e.target.value = '';
                  }}
                />
                <input
                  ref={pdfInputRef}
                  type="file"
                  accept="application/pdf,.pdf"
                  multiple
                  className="hidden"
                  data-testid="ai-file-input-pdf"
                  onChange={(e) => {
                    if (e.target.files) void handleUploadFiles(e.target.files);
                    e.target.value = '';
                  }}
                />

                {/* Settings & Quick Prompts Popover */}
                {showQuickPrompts && (
                  <div
                    data-testid="ai-settings-popover"
                    className="absolute bottom-full left-3.5 right-3.5 mb-2 rounded-2xl border border-[#E5DFD2] dark:border-[#293D33] bg-white dark:bg-[#1A2922] shadow-xl overflow-hidden z-20"
                  >
                    <div className="px-4 py-2.5 bg-[#F5F1E6]/85 dark:bg-[#14201B] border-b border-[#E5DFD2] dark:border-[#293D33] space-y-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-display text-xs font-extrabold text-[#103B2D] dark:text-[#EDF3EF]">
                          {isEn ? 'Assistant Settings' : 'إعدادات المساعد'}
                        </span>
                        <button
                          type="button"
                          onClick={() => setShowQuickPrompts(false)}
                          aria-label={isEn ? 'Close settings' : 'إغلاق الإعدادات'}
                          className="w-6 h-6 rounded-lg text-[#6C756C] dark:text-[#9CB0A5] hover:bg-black/5 dark:hover:bg-white/10 flex items-center justify-center cursor-pointer"
                        >
                          <X size={13} aria-hidden="true" />
                        </button>
                      </div>

                      {/* Auto-read toggle */}
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-xs font-semibold text-[#16261E] dark:text-[#EDF3EF]">
                          {isEn ? 'Auto-read responses' : 'قراءة الردود تلقائياً'}
                        </span>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={aiSettings.autoRead}
                          data-testid="ai-setting-autoread"
                          onClick={() =>
                            setAiSettings((prev) => ({ ...prev, autoRead: !prev.autoRead }))
                          }
                          className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors cursor-pointer ${
                            aiSettings.autoRead
                              ? 'bg-[#103B2D] dark:bg-[#B99A56]'
                              : 'bg-[#D6D0C4] dark:bg-[#293D33]'
                          }`}
                        >
                          <span
                            className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                              aiSettings.autoRead
                                ? isRtl
                                  ? '-translate-x-4.5'
                                  : 'translate-x-4.5'
                                : isRtl
                                ? '-translate-x-1'
                                : 'translate-x-1'
                            }`}
                          />
                        </button>
                      </div>

                      {/* Voice recognition language selector */}
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-[#16261E] dark:text-[#EDF3EF]">
                          {isEn ? 'Voice language' : 'لغة الإدخال الصوتي'}
                        </span>
                        <div className="inline-flex rounded-lg border border-[#E5DFD2] dark:border-[#293D33] bg-white dark:bg-[#14201B] p-0.5 text-[11px] font-semibold">
                          {(
                            [
                              { id: 'auto', label: isEn ? 'Auto' : 'تلقائي', testId: 'ai-setting-voicelang-auto' },
                              { id: 'ar-SA', label: 'العربية', testId: 'ai-setting-voicelang-ar' },
                              { id: 'en-US', label: 'EN', testId: 'ai-setting-voicelang-en' },
                            ] as const
                          ).map((opt) => (
                            <button
                              key={opt.id}
                              type="button"
                              data-testid={opt.testId}
                              aria-pressed={aiSettings.voiceLang === opt.id}
                              onClick={() =>
                                setAiSettings((prev) => ({ ...prev, voiceLang: opt.id }))
                              }
                              className={`px-2 py-0.5 rounded-md transition-colors cursor-pointer ${
                                aiSettings.voiceLang === opt.id
                                  ? 'bg-[#103B2D] text-white dark:bg-[#B99A56] dark:text-[#14201B]'
                                  : 'text-[#5F6C65] dark:text-[#9CB0A5] hover:text-[#103B2D] dark:hover:text-white'
                              }`}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="px-4 pt-2 pb-1 text-[10.5px] font-bold text-[#7A847E] dark:text-[#93A69C]">
                      {isEn ? 'Quick prompts' : 'اختصارات سريعة'}
                    </div>
                    {promptShortcuts.map((item) => (
                      <button
                        key={item.label}
                        type="button"
                        onClick={() => {
                          setShowQuickPrompts(false);
                          if (item.action) {
                            item.action();
                          } else if (item.prompt) {
                            void sendMessage(item.prompt);
                          }
                        }}
                        className="flex w-full items-center justify-between gap-2 px-4 py-2 text-start text-xs font-semibold text-[#16261E] dark:text-[#EDF3EF] hover:bg-[#F3EFE4] dark:hover:bg-[#21332B] transition-colors cursor-pointer border-t border-[#E5DFD2]/70 dark:border-[#293D33]/70"
                      >
                        <span>{item.label}</span>
                        <CardChevron size={14} className="text-[#B99A56] shrink-0" aria-hidden="true" />
                      </button>
                    ))}
                  </div>
                )}

                {/* Attachment Picker Popover */}
                {attachMenuOpen && (
                  <div
                    data-testid="ai-attach-popover"
                    className="absolute bottom-full start-3.5 mb-2 w-52 rounded-2xl border border-[#E5DFD2] dark:border-[#25382F] bg-white dark:bg-[#121D18] shadow-xl overflow-hidden z-20"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setAttachMenuOpen(false);
                        imageInputRef.current?.click();
                      }}
                      data-testid="ai-attach-image"
                      className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-xs font-semibold text-[#16261E] dark:text-[#EDF3EF] hover:bg-[#F3EFE4] dark:hover:bg-[#182620] border-b border-[#E5DFD2]/70 dark:border-[#25382F]/70 cursor-pointer"
                    >
                      <ImagePlus size={15} className="text-[#B99A56]" aria-hidden="true" />
                      <span>{isEn ? 'Upload image' : 'إرفاق صورة'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={openCamera}
                      data-testid="ai-attach-camera"
                      className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-xs font-semibold text-[#16261E] dark:text-[#EDF3EF] hover:bg-[#F3EFE4] dark:hover:bg-[#182620] border-b border-[#E5DFD2]/70 dark:border-[#25382F]/70 cursor-pointer"
                    >
                      <Camera size={15} className="text-[#B99A56]" aria-hidden="true" />
                      <span>{isEn ? 'Take photo' : 'التقاط بالكاميرا'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setAttachMenuOpen(false);
                        pdfInputRef.current?.click();
                      }}
                      data-testid="ai-attach-pdf"
                      className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-xs font-semibold text-[#16261E] dark:text-[#EDF3EF] hover:bg-[#F3EFE4] dark:hover:bg-[#182620] cursor-pointer"
                    >
                      <FileText size={15} className="text-[#B99A56]" aria-hidden="true" />
                      <span>{isEn ? 'Upload PDF document' : 'إرفاق ملف PDF'}</span>
                    </button>
                  </div>
                )}

                {/* Inline Notice / Voice Permission / Upload Error */}
                {(composerNotice || voice.voiceError) && (
                  <div
                    role="alert"
                    data-testid="ai-composer-notice"
                    className="mb-1.5 flex items-center justify-between gap-2 rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 px-3 py-1.5 text-[11px] font-medium text-amber-900 dark:text-amber-200"
                  >
                    <span className="truncate">{voice.voiceError || composerNotice}</span>
                    <button
                      type="button"
                      onClick={() => {
                        setComposerNotice(null);
                        voice.clearVoiceError();
                      }}
                      aria-label={isEn ? 'Dismiss notice' : 'إغلاق التنبيه'}
                      className="shrink-0 hover:opacity-75 cursor-pointer"
                    >
                      <X size={13} aria-hidden="true" />
                    </button>
                  </div>
                )}

                {/* Pending Attachment Preview Strip */}
                {pendingAttachments.length > 0 && (
                  <div
                    data-testid="ai-attachment-preview-strip"
                    className="mb-1.5 flex items-center gap-2 overflow-x-auto pb-0.5 souq-thin-scrollbar"
                  >
                    {pendingAttachments.map(({ meta, localPreviewUrl }) => (
                      <div
                        key={meta.id}
                        data-testid={`ai-pending-attachment-${meta.id}`}
                        className="relative shrink-0 flex items-center gap-2 rounded-xl border border-[#E5DFD2] dark:border-[#25382F] bg-white dark:bg-[#121D18] p-1 pe-6"
                      >
                        {meta.kind === 'image' ? (
                          <img
                            src={localPreviewUrl || meta.url}
                            alt={meta.name}
                            className="w-9 h-9 rounded-lg object-cover"
                          />
                        ) : (
                          <span className="w-9 h-9 rounded-lg bg-[#F5F1E6] dark:bg-[#182620] text-[#B99A56] flex items-center justify-center">
                            <FileText size={16} aria-hidden="true" />
                          </span>
                        )}
                        <div className="max-w-[110px] min-w-0">
                          <p className="text-[11px] font-semibold text-[#103B2D] dark:text-[#EDF3EF] truncate">
                            {meta.name}
                          </p>
                          <p dir="ltr" className="text-[9.5px] text-[#7A847E] dark:text-[#8CA095] text-start tabular-nums">
                            {formatFileSize(meta.sizeBytes)}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => void removePendingAttachment(meta.id)}
                          aria-label={isEn ? 'Remove attachment' : 'حذف المرفق'}
                          data-testid={`ai-remove-attachment-${meta.id}`}
                          className="absolute top-1 end-1 w-4 h-4 rounded-full bg-[#103B2D]/85 text-white flex items-center justify-center hover:bg-red-600 cursor-pointer"
                        >
                          <X size={10} aria-hidden="true" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Live Voice Recording Indicator Strip */}
                {(voice.recording || voice.transcribing) && (
                  <div
                    data-testid="ai-recording-bar"
                    className="mb-1.5 flex items-center justify-between gap-2 rounded-xl border border-red-200 dark:border-red-900 bg-red-50/85 dark:bg-red-950/35 px-3 py-1.5 text-xs"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="h-2.5 w-2.5 rounded-full bg-red-600 animate-pulse shrink-0" />
                      <span className="font-mono font-bold text-red-700 dark:text-red-300 tabular-nums shrink-0">
                        {formatDurationMmSs(voice.durationSeconds)}
                      </span>
                      <span className="text-[11px] text-red-900/80 dark:text-red-200 truncate">
                        {voice.transcribing
                          ? isEn
                            ? 'Transcribing speech...'
                            : 'جاري تحويل الصوت لنص...'
                          : voice.interimText ||
                            (isEn ? 'Listening... speak clearly' : 'جاري الاستماع... تحدث بوضوح')}
                      </span>
                    </div>
                    {voice.recording && (
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={voice.cancelRecording}
                          aria-label={isEn ? 'Cancel recording' : 'إلغاء التسجيل'}
                          data-testid="ai-recording-cancel"
                          className="h-6 px-2 rounded-md text-[11px] font-semibold text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/40 cursor-pointer"
                        >
                          {isEn ? 'Cancel' : 'إلغاء'}
                        </button>
                        <button
                          type="button"
                          onClick={voice.stopRecording}
                          aria-label={isEn ? 'Done recording' : 'إنهاء التسجيل'}
                          data-testid="ai-recording-stop"
                          className="h-6 px-2 rounded-md bg-[#103B2D] text-white text-[11px] font-semibold hover:bg-[#0B2B20] cursor-pointer"
                        >
                          {isEn ? 'Insert' : 'إدراج'}
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Compact Composer Box */}
                <div
                  data-testid="ai-composer-box"
                  className="flex min-h-[54px] items-center gap-1 rounded-2xl border border-[#E5DFD2] dark:border-[#293D33] bg-white dark:bg-[#1A2922] px-2 py-1.5 focus-within:border-[#B99A56] transition-colors"
                >
                  <button
                    type="button"
                    disabled={sending || uploadingAttachment}
                    onClick={() => {
                      setAttachMenuOpen((prev) => !prev);
                      setShowQuickPrompts(false);
                    }}
                    aria-expanded={attachMenuOpen}
                    aria-label={isEn ? 'Attach image, camera or PDF' : 'إرفاق صورة أو كاميرا أو PDF'}
                    title={isEn ? 'Attach image, camera or PDF' : 'إرفاق صورة أو كاميرا أو PDF'}
                    data-testid="ai-attach-trigger"
                    className="w-8 h-8 rounded-xl self-end flex items-center justify-center text-[#78827B] dark:text-[#9CB0A5] hover:text-[#103B2D] dark:hover:text-[#D8B66D] hover:bg-[#F3EFE4] dark:hover:bg-[#21332B] disabled:opacity-40 transition-colors cursor-pointer shrink-0"
                  >
                    {uploadingAttachment ? (
                      <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                    ) : (
                      <Paperclip size={16} aria-hidden="true" />
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setShowQuickPrompts((prev) => !prev);
                      setAttachMenuOpen(false);
                    }}
                    aria-expanded={showQuickPrompts}
                    aria-label={isEn ? 'Assistant settings & quick prompts' : 'إعدادات المساعد والخيارات السريعة'}
                    title={isEn ? 'Settings & quick prompts' : 'الإعدادات والخيارات السريعة'}
                    data-testid="ai-settings-trigger"
                    className="w-8 h-8 rounded-xl self-end flex items-center justify-center text-[#78827B] dark:text-[#9CB0A5] hover:text-[#103B2D] dark:hover:text-[#D8B66D] hover:bg-[#F3EFE4] dark:hover:bg-[#21332B] transition-colors cursor-pointer shrink-0"
                  >
                    <SlidersHorizontal size={15} aria-hidden="true" />
                  </button>

                  <textarea
                    ref={inputRef}
                    rows={1}
                    value={input}
                    maxLength={maxMessageLength}
                    onChange={handleComposerChange}
                    onKeyDown={handleComposerKeyDown}
                    onPaste={handlePaste}
                    placeholder={
                      isEn ? 'Ask anything about the market...' : 'اسألني عن أي شيء يخص السوق...'
                    }
                    aria-label={
                      isEn ? 'Ask anything about the market' : 'اسألني عن أي شيء يخص السوق'
                    }
                    data-testid="ai-assistant-input"
                    disabled={sending}
                    style={{ maxHeight: 112 }}
                    className="flex-1 min-w-0 resize-none bg-transparent py-1.5 px-1 text-[13.5px] text-[#16261E] dark:text-[#EDF3EF] placeholder:text-[#868F89] dark:placeholder:text-[#7D9186] focus:outline-none leading-snug souq-thin-scrollbar"
                  />

                  <button
                    type="button"
                    disabled={sending || voice.transcribing}
                    onClick={() =>
                      voice.recording ? voice.stopRecording() : void voice.startRecording()
                    }
                    aria-label={
                      voice.recording
                        ? isEn
                          ? 'Stop recording'
                          : 'إيقاف التسجيل'
                        : isEn
                        ? 'Voice input'
                        : 'إدخال صوتي'
                    }
                    title={
                      voice.recording
                        ? isEn
                          ? 'Stop recording'
                          : 'إيقاف التسجيل'
                        : isEn
                        ? 'Voice input'
                        : 'تسجيل صوتي'
                    }
                    data-testid="ai-mic-button"
                    className={`w-8 h-8 rounded-xl self-end flex items-center justify-center transition-colors cursor-pointer shrink-0 disabled:opacity-40 ${
                      voice.recording
                        ? 'bg-red-100 dark:bg-red-950/60 text-red-600 dark:text-red-400'
                        : 'text-[#78827B] dark:text-[#9CB0A5] hover:text-[#103B2D] dark:hover:text-[#D8B66D] hover:bg-[#F3EFE4] dark:hover:bg-[#182620]'
                    }`}
                  >
                    <Mic size={16} aria-hidden="true" />
                  </button>

                  {sending ? (
                    <button
                      type="button"
                      onClick={stopGeneration}
                      aria-label={isEn ? 'Stop response' : 'إيقاف الرد'}
                      title={isEn ? 'Stop' : 'إيقاف'}
                      data-testid="ai-assistant-stop"
                      className="w-9 h-9 rounded-full self-end bg-red-600 hover:bg-red-700 text-white flex items-center justify-center shrink-0 transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-[#B99A56]"
                    >
                      <Square size={14} fill="currentColor" aria-hidden="true" />
                    </button>
                  ) : (
                    <button
                      type="submit"
                      disabled={
                        uploadingAttachment ||
                        (!input.trim() && pendingAttachments.length === 0)
                      }
                      aria-label={isEn ? 'Send' : 'إرسال'}
                      data-testid="ai-assistant-send"
                      className="w-9 h-9 rounded-full self-end bg-[#103B2D] hover:bg-[#0B2B20] dark:bg-[#145C42] dark:hover:bg-[#197352] text-white disabled:bg-[#EDE9DE] disabled:text-[#8E9690] dark:disabled:bg-[#1B2B24] dark:disabled:text-[#66786E] flex items-center justify-center shrink-0 transition-colors cursor-pointer disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-[#B99A56]"
                    >
                      <Send
                        size={16}
                        strokeWidth={2}
                        aria-hidden="true"
                        className={isRtl ? '-scale-x-100' : ''}
                      />
                    </button>
                  )}
                </div>

                <div className="mt-1.5 px-1 flex items-center justify-between gap-2 text-[10.5px] text-[#7A847E] dark:text-[#93A69C] tabular-nums">
                  <span className="truncate">
                    {isEn
                      ? 'Assistant may make mistakes; verify important details.'
                      : 'قد يخطئ المساعد، تحقق من المعلومات المهمة.'}
                  </span>
                  <span className="shrink-0 flex items-center gap-2">
                    {showCharCounter && (
                      <span>
                        {input.length}/{maxMessageLength}
                      </span>
                    )}
                    {usage && (
                      <span>
                        {isEn
                          ? `${usage.remainingToday} / ${usage.dailyLimit}`
                          : `${usage.remainingToday} / ${usage.dailyLimit} رسالة`}
                      </span>
                    )}
                  </span>
                </div>
              </form>
            </section>
          </>,
          document.body
        )}
    </>
  );
}
