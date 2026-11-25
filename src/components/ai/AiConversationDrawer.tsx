import { useEffect, useState } from 'react';
import {
  Check,
  MessageSquare,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import type { AiConversationSummary } from '../../types/marketplace';

interface AiConversationDrawerProps {
  open: boolean;
  isEn: boolean;
  conversations: AiConversationSummary[];
  loading: boolean;
  activeConversationId: string | null;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onSelect: (id: string) => void;
  onNewConversation: () => void;
  onRename: (id: string, title: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onClose: () => void;
}

export function AiConversationDrawer({
  open,
  isEn,
  conversations,
  loading,
  activeConversationId,
  searchQuery,
  onSearchChange,
  onSelect,
  onNewConversation,
  onRename,
  onDelete,
  onClose,
}: AiConversationDrawerProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setEditingId(null);
      setConfirmDeleteId(null);
    }
  }, [open]);

  if (!open) return null;

  const formatDate = (iso: string) => {
    try {
      return new Intl.DateTimeFormat(isEn ? 'en-US' : 'ar-SA', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date(iso));
    } catch {
      return '';
    }
  };

  const commitRename = async (id: string) => {
    const trimmed = editTitle.trim();
    if (!trimmed) {
      setEditingId(null);
      return;
    }
    setBusyId(id);
    try {
      await onRename(id, trimmed);
      setEditingId(null);
    } finally {
      setBusyId(null);
    }
  };

  const commitDelete = async (id: string) => {
    setBusyId(id);
    try {
      await onDelete(id);
      setConfirmDeleteId(null);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div
      data-testid="ai-history-drawer"
      className="absolute inset-0 z-20 flex flex-col bg-[#FCFBF8] dark:bg-[#14201B]"
    >
      {/* Drawer Header */}
      <div className="shrink-0 flex items-center justify-between gap-2 px-3.5 py-2.5 border-b border-[#E5DFD2] dark:border-[#293D33] bg-[#F5F1E6]/75 dark:bg-[#1A2922]">
        <div className="flex items-center gap-2 min-w-0">
          <MessageSquare size={15} className="text-[#103B2D] dark:text-[#D8B66D] shrink-0" aria-hidden="true" />
          <h3 className="font-display text-[13px] font-extrabold text-[#103B2D] dark:text-[#EDF3EF] truncate">
            {isEn ? 'Conversation history' : 'سجل المحادثات'}
          </h3>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => {
              onNewConversation();
              onClose();
            }}
            data-testid="ai-history-new"
            className="h-7 px-2.5 rounded-lg bg-[#103B2D] text-white text-[11px] font-bold inline-flex items-center gap-1 hover:bg-[#0B2B20] transition-colors cursor-pointer"
          >
            <Plus size={13} aria-hidden="true" />
            <span>{isEn ? 'New' : 'جديدة'}</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label={isEn ? 'Close history' : 'إغلاق السجل'}
            className="w-7 h-7 rounded-lg text-[#5F6C65] dark:text-[#9CB0A5] hover:bg-[#EDE9DE] dark:hover:bg-[#1E2F27] flex items-center justify-center cursor-pointer"
          >
            <X size={15} aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="shrink-0 px-3.5 py-2 border-b border-[#E5DFD2]/70 dark:border-[#25382F]/70">
        <div className="relative flex items-center">
          <Search
            size={14}
            className="absolute start-3 text-[#7A847E] dark:text-[#8CA095] pointer-events-none"
            aria-hidden="true"
          />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            data-testid="ai-history-search"
            placeholder={isEn ? 'Search conversations...' : 'ابحث في المحادثات...'}
            aria-label={isEn ? 'Search conversations' : 'ابحث في المحادثات'}
            className="w-full rounded-xl border border-[#E5DFD2] dark:border-[#293D33] bg-white dark:bg-[#1A2922] ps-8 pe-3 py-1.5 text-xs text-[#16261E] dark:text-[#EDF3EF] placeholder:text-[#868F89] focus:outline-none focus:border-[#B99A56]"
          />
        </div>
      </div>

      {/* List */}
      <div className="flex-1 min-h-0 overflow-y-auto souq-thin-scrollbar px-3.5 py-2.5 space-y-2">
        {loading ? (
          <div className="space-y-2 py-2">
            {[1, 2, 3].map((n) => (
              <div
                key={n}
                className="h-14 rounded-xl bg-[#F3EFE4]/80 dark:bg-[#14231C] animate-pulse"
              />
            ))}
          </div>
        ) : conversations.length === 0 ? (
          <div className="py-10 text-center space-y-1.5">
            <p className="text-xs font-semibold text-[#5F6C65] dark:text-[#9CB0A5]">
              {searchQuery.trim()
                ? isEn
                  ? 'No matching conversations found.'
                  : 'لا توجد محادثات مطابقة للبحث.'
                : isEn
                ? 'No saved conversations yet.'
                : 'لا توجد محادثات محفوظة بعد.'}
            </p>
            <p className="text-[11px] text-[#7A847E] dark:text-[#7E9287]">
              {isEn
                ? 'Start a message and it will be saved here automatically.'
                : 'ابدأ أي محادثة وسيتم حفظها هنا تلقائياً لخصوصيتك.'}
            </p>
          </div>
        ) : (
          conversations.map((conv) => {
            const isActive = conv.id === activeConversationId;
            const isEditing = editingId === conv.id;
            const isConfirmingDelete = confirmDeleteId === conv.id;
            const isBusy = busyId === conv.id;

            return (
              <div
                key={conv.id}
                data-testid={`ai-history-item-${conv.id}`}
                className={`rounded-xl border p-2.5 transition-colors ${
                  isActive
                    ? 'border-[#B99A56] bg-[#F5F1E6]/70 dark:bg-[#1F3129]'
                    : 'border-[#E5DFD2] dark:border-[#293D33] bg-white dark:bg-[#1A2922] hover:border-[#B99A56]/70'
                }`}
              >
                {isEditing ? (
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          void commitRename(conv.id);
                        } else if (e.key === 'Escape') {
                          setEditingId(null);
                        }
                      }}
                      autoFocus
                      maxLength={80}
                      data-testid="ai-history-rename-input"
                      className="flex-1 min-w-0 rounded-lg border border-[#B99A56] bg-white dark:bg-[#0E1814] px-2 py-1 text-xs text-[#16261E] dark:text-[#EDF3EF] focus:outline-none"
                    />
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => void commitRename(conv.id)}
                      aria-label={isEn ? 'Save title' : 'حفظ العنوان'}
                      className="w-7 h-7 rounded-lg bg-[#103B2D] text-white flex items-center justify-center cursor-pointer"
                    >
                      <Check size={13} aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      aria-label={isEn ? 'Cancel rename' : 'إلغاء التعديل'}
                      className="w-7 h-7 rounded-lg text-[#5F6C65] hover:bg-[#EDE9DE] dark:hover:bg-[#1E2F27] flex items-center justify-center cursor-pointer"
                    >
                      <X size={13} aria-hidden="true" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-start justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        onSelect(conv.id);
                        onClose();
                      }}
                      className="flex-1 min-w-0 text-start cursor-pointer"
                    >
                      <p className="font-display text-[12.5px] font-bold text-[#103B2D] dark:text-[#EDF3EF] truncate">
                        {conv.title}
                      </p>
                      {conv.lastMessagePreview && (
                        <p className="mt-0.5 text-[11px] text-[#6C756C] dark:text-[#9CB0A5] truncate">
                          {conv.lastMessagePreview.replace(/[*_`#>]+/g, '').trim()}
                        </p>
                      )}
                      <div className="mt-1 flex items-center gap-2 text-[10px] text-[#7A847E] dark:text-[#8CA095]">
                        <span>{formatDate(conv.updatedAt)}</span>
                        <span>·</span>
                        <span>
                          {isEn
                            ? `${conv.messageCount} msgs`
                            : `${conv.messageCount} رسالة`}
                        </span>
                      </div>
                    </button>

                    <div className="flex items-center gap-1 shrink-0">
                      {isConfirmingDelete ? (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => void commitDelete(conv.id)}
                            data-testid={`ai-history-confirm-delete-${conv.id}`}
                            className="px-2 py-1 rounded-md bg-red-600 text-white text-[10.5px] font-bold hover:bg-red-700 cursor-pointer"
                          >
                            {isEn ? 'Delete' : 'تأكيد'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(null)}
                            className="px-1.5 py-1 rounded-md text-[10.5px] text-[#5F6C65] dark:text-[#9CB0A5] hover:bg-[#EDE9DE] dark:hover:bg-[#1E2F27] cursor-pointer"
                          >
                            {isEn ? 'No' : 'إلغاء'}
                          </button>
                        </div>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingId(conv.id);
                              setEditTitle(conv.title);
                              setConfirmDeleteId(null);
                            }}
                            aria-label={isEn ? 'Rename conversation' : 'تغيير اسم المحادثة'}
                            title={isEn ? 'Rename' : 'إعادة التسمية'}
                            data-testid={`ai-history-rename-${conv.id}`}
                            className="w-7 h-7 rounded-lg text-[#6C756C] dark:text-[#9CB0A5] hover:text-[#103B2D] dark:hover:text-[#D8B66D] hover:bg-[#F3EFE4] dark:hover:bg-[#1E2F27] flex items-center justify-center cursor-pointer"
                          >
                            <Pencil size={13} aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setConfirmDeleteId(conv.id);
                              setEditingId(null);
                            }}
                            aria-label={isEn ? 'Delete conversation' : 'حذف المحادثة'}
                            title={isEn ? 'Delete' : 'حذف'}
                            data-testid={`ai-history-delete-${conv.id}`}
                            className="w-7 h-7 rounded-lg text-[#6C756C] dark:text-[#9CB0A5] hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 flex items-center justify-center cursor-pointer"
                          >
                            <Trash2 size={13} aria-hidden="true" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
