import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, FileText, Loader2, Paperclip, Search, Send, Trash2, X } from 'lucide-react';
import api from '../services/api';
import { useConfirmModal } from '../components/ConfirmModal';

const ACCEPTED_FILE_TYPES = [
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
  '.gif',
  '.pdf',
  '.doc',
  '.docx',
  '.xls',
  '.xlsx',
  '.txt',
].join(',');

const formatTime = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
};

const formatDate = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('es-AR');
};

const isImage = (message) => {
  const mime = message.mediaMime || '';
  return mime.startsWith('image/');
};

const isSticker = (message) => message.type === 'sticker';
const isReaction = (message) => message.type === 'reaction';
const shouldRenderTextBlock = (message) => {
  if (!message.text) return false;
  if (isSticker(message) && message.text === '[Sticker]') return false;
  return true;
};

const isMobileViewport = () => {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(max-width: 1023px)').matches;
};

const areConversationListsEqual = (previous, next) => {
  if (previous.length !== next.length) return false;

  return previous.every((conversation, index) => {
    const candidate = next[index];
    return candidate
      && conversation.id === candidate.id
      && conversation.unreadCount === candidate.unreadCount
      && conversation.profileName === candidate.profileName
      && conversation.phone === candidate.phone
      && conversation.lastMessageAt === candidate.lastMessageAt
      && conversation.lastMessageText === candidate.lastMessageText;
  });
};

const areMessagesEqual = (previous, next) => {
  if (previous.length !== next.length) return false;

  return previous.every((message, index) => {
    const candidate = next[index];
    return candidate
      && message.id === candidate.id
      && message.type === candidate.type
      && message.text === candidate.text
      && message.mediaUrl === candidate.mediaUrl
      && message.mediaMime === candidate.mediaMime
      && message.mediaName === candidate.mediaName
      && message.status === candidate.status
      && message.createdAt === candidate.createdAt;
  });
};

const isNearBottom = (element) => {
  if (!element) return true;
  return element.scrollHeight - element.scrollTop - element.clientHeight < 96;
};

const WhatsAppPage = () => {
  const [conversations, setConversations] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [mobileViewport, setMobileViewport] = useState(isMobileViewport);
  const [messages, setMessages] = useState([]);
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [search, setSearch] = useState('');
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [attachment, setAttachment] = useState(null);

  const messagesContainerRef = useRef(null);
  const fileInputRef = useRef(null);
  const textareaRef = useRef(null);
  const selectedIdRef = useRef(null);
  const mobileViewportRef = useRef(mobileViewport);
  const shouldStickToBottomRef = useRef(true);
  const { ConfirmModalComponent, openModal } = useConfirmModal();

  const filteredConversations = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return conversations;
    return conversations.filter((conversation) => (
      conversation.profileName?.toLowerCase().includes(term)
      || conversation.phone?.toLowerCase().includes(term)
      || conversation.lastMessageText?.toLowerCase().includes(term)
    ));
  }, [conversations, search]);

  const selectedConversation = conversations.find((conversation) => conversation.id === selectedId) || null;
  const showConversationList = !selectedConversation;

  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  useEffect(() => {
    mobileViewportRef.current = mobileViewport;
  }, [mobileViewport]);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.style.height = '0px';
    const nextHeight = Math.min(Math.max(textarea.scrollHeight, 56), 168);
    textarea.style.height = `${nextHeight}px`;
    textarea.style.overflowY = textarea.scrollHeight > 168 ? 'auto' : 'hidden';
  }, [draft]);

  const resetAttachment = () => {
    setAttachment(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const syncSelectedConversation = useCallback((nextConversations) => {
    setSelectedId((previousSelectedId) => {
      if (previousSelectedId && nextConversations.some((conversation) => conversation.id === previousSelectedId)) {
        return previousSelectedId;
      }

      if (mobileViewportRef.current) {
        return null;
      }

      return nextConversations[0]?.id ?? null;
    });
  }, []);

  const loadConversations = useCallback(async ({ silent = true } = {}) => {
    if (!silent) setLoadingConversations(true);

    try {
      const { data } = await api.get('/whatsapp/conversations');
      const nextConversations = Array.isArray(data) ? data : [];

      setConversations((previous) => (
        areConversationListsEqual(previous, nextConversations) ? previous : nextConversations
      ));
      syncSelectedConversation(nextConversations);
    } catch (error) {
      console.error('Error cargando conversaciones:', error);
    } finally {
      if (!silent) setLoadingConversations(false);
    }
  }, [syncSelectedConversation]);

  const loadMessages = useCallback(async (conversationId, { silent = true, forceStickToBottom = false } = {}) => {
    if (!conversationId) return;
    if (!silent) setLoadingMessages(true);

    const container = messagesContainerRef.current;
    const shouldStickToBottom = forceStickToBottom || isNearBottom(container);

    try {
      const { data } = await api.get(`/whatsapp/conversations/${conversationId}/messages`);
      const nextMessages = Array.isArray(data) ? data : [];

      setMessages((previous) => {
        if (areMessagesEqual(previous, nextMessages)) {
          return previous;
        }

        shouldStickToBottomRef.current = shouldStickToBottom || nextMessages.length > previous.length;
        return nextMessages;
      });
    } catch (error) {
      console.error('Error cargando mensajes:', error);
    } finally {
      if (!silent) setLoadingMessages(false);
    }
  }, []);

  useEffect(() => {
    const handleResize = () => {
      const nextMobileViewport = isMobileViewport();
      setMobileViewport(nextMobileViewport);

      if (!nextMobileViewport && !selectedIdRef.current && conversations.length > 0) {
        setSelectedId(conversations[0].id);
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [conversations]);

  useEffect(() => {
    loadConversations({ silent: false });
    const interval = setInterval(() => {
      loadConversations();
    }, 12000);

    return () => clearInterval(interval);
  }, [loadConversations]);

  useEffect(() => {
    if (!selectedId) return undefined;

    shouldStickToBottomRef.current = true;
    loadMessages(selectedId, { silent: false, forceStickToBottom: true });
    api.post(`/whatsapp/conversations/${selectedId}/read`).catch(() => {});

    const interval = setInterval(() => {
      loadMessages(selectedId, { forceStickToBottom: false });
    }, 6000);

    return () => clearInterval(interval);
  }, [loadMessages, selectedId]);

  useEffect(() => {
    if (!shouldStickToBottomRef.current) return;

    const container = messagesContainerRef.current;
    if (!container) return;

    requestAnimationFrame(() => {
      container.scrollTop = container.scrollHeight;
      shouldStickToBottomRef.current = false;
    });
  }, [messages]);

  const handleAttachmentChange = (event) => {
    const nextFile = event.target.files?.[0] || null;
    if (!nextFile) return;
    setAttachment(nextFile);
  };

  const handleSend = async () => {
    if ((!draft.trim() && !attachment) || !selectedConversation) return;

    try {
      setSending(true);

      if (attachment) {
        const payload = new FormData();
        if (draft.trim()) payload.append('text', draft);
        payload.append('file', attachment);
        await api.post(`/whatsapp/conversations/${selectedConversation.id}/messages`, payload, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      } else {
        await api.post(`/whatsapp/conversations/${selectedConversation.id}/messages`, { text: draft });
      }

      setDraft('');
      resetAttachment();
      shouldStickToBottomRef.current = true;
      await loadMessages(selectedConversation.id, { forceStickToBottom: true });
      await loadConversations();
    } catch (error) {
      alert(error?.response?.data?.message || 'No se pudo enviar el mensaje.');
    } finally {
      setSending(false);
    }
  };

  const handleDeleteConversation = () => {
    if (!selectedConversation) return;

    openModal({
      title: 'Eliminar conversación',
      message: 'Esta acción borrará la conversación y todos sus mensajes. ¿Deseas continuar?',
      confirmText: 'Eliminar',
      danger: true,
      icon: Trash2,
      onConfirm: async () => {
        await api.delete(`/whatsapp/conversations/${selectedConversation.id}`);
        setMessages([]);
        setSelectedId(null);
        resetAttachment();
        await loadConversations();
      },
    });
  };

  return (
    <div className="flex h-dvh min-h-dvh overflow-hidden bg-slate-50">
      <aside className={`${showConversationList ? 'flex' : 'hidden'} min-h-0 w-full flex-col bg-white lg:flex lg:w-80 lg:border-r lg:border-slate-200`}>
        <div className="border-b border-slate-100 p-4">
          <h1 className="text-lg font-black text-slate-800">WhatsApp</h1>
          <div className="relative mt-3">
            <Search size={16} className="absolute left-3 top-3 text-slate-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar conversaciones..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm font-semibold outline-none focus:ring-2 ring-teal-500"
            />
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {loadingConversations ? (
            <div className="flex h-full items-center justify-center text-slate-400">
              <Loader2 className="animate-spin" />
            </div>
          ) : (
            filteredConversations.map((conversation) => {
              const isActive = conversation.id === selectedId;

              return (
                <button
                  key={conversation.id}
                  type="button"
                  onClick={() => setSelectedId(conversation.id)}
                  className={`w-full border-b border-slate-100 px-4 py-3 text-left transition-all ${
                    isActive ? 'bg-teal-50' : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <p className="truncate pr-3 text-sm font-bold text-slate-800">
                      {conversation.profileName || conversation.phone}
                    </p>
                    <span className="text-[10px] font-semibold text-slate-400">{formatDate(conversation.lastMessageAt)}</span>
                  </div>
                  <div className="mt-1 flex items-center justify-between gap-2">
                    <p className="flex-1 truncate text-xs text-slate-500">{conversation.lastMessageText || 'Sin mensajes'}</p>
                    {conversation.unreadCount > 0 && (
                      <span className="rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-black text-white">
                        {conversation.unreadCount}
                      </span>
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </aside>

      <section className={`${selectedConversation ? 'flex' : 'hidden'} min-h-0 min-w-0 flex-1 flex-col overflow-hidden lg:flex`}>
        <header className="shrink-0 flex items-center justify-between gap-3 border-b border-slate-200 bg-white p-3 sm:p-4">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => setSelectedId(null)}
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-slate-600 lg:hidden"
              aria-label="Volver a conversaciones"
            >
              <ArrowLeft size={18} />
            </button>
            <div className="min-w-0">
              <p className="truncate text-sm font-black text-slate-800">
                {selectedConversation ? (selectedConversation.profileName || selectedConversation.phone) : 'Selecciona una conversación'}
              </p>
              {selectedConversation && (
                <p className="truncate text-xs font-semibold text-slate-400">{selectedConversation.phone}</p>
              )}
            </div>
          </div>

          {selectedConversation && (
            <button
              type="button"
              onClick={handleDeleteConversation}
              className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-600 transition hover:bg-red-100"
            >
              <Trash2 size={14} />
              <span className="hidden sm:inline">Borrar</span>
            </button>
          )}
        </header>

        <div className="relative min-h-0 flex-1 overflow-hidden bg-[linear-gradient(180deg,rgba(240,253,250,0.9),rgba(248,250,252,1))]">
          <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-12 bg-gradient-to-b from-slate-50 via-slate-50/90 to-transparent" />
          <div
            ref={messagesContainerRef}
            className="min-h-0 h-full overflow-y-auto overscroll-contain px-3 pb-3 pt-6 [scrollbar-gutter:stable] sm:px-6 sm:pb-6 sm:pt-8"
          >
            <div className="flex min-h-full flex-col justify-end gap-4">
              {loadingMessages ? (
                <div className="flex justify-center py-10 text-slate-400">
                  <Loader2 className="animate-spin" />
                </div>
              ) : messages.length === 0 ? (
                <div className="flex flex-1 items-end justify-center py-10 text-center">
                  <div className="rounded-3xl border border-slate-200 bg-white/80 px-5 py-4 text-sm font-semibold text-slate-500 shadow-sm backdrop-blur-sm">
                    Todavia no hay mensajes en esta conversacion.
                  </div>
                </div>
              ) : (
                messages.map((message) => {
                  const isOutbound = message.direction === 'outbound';
                  const renderAsReaction = isReaction(message);

                  return (
                    <div key={message.id} className={`flex ${isOutbound ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[85%] rounded-3xl px-4 py-3 shadow-sm sm:max-w-xl ${
                        renderAsReaction
                          ? (isOutbound ? 'bg-amber-100 text-slate-800' : 'border border-amber-200 bg-amber-50 text-slate-800')
                          : (isOutbound ? 'bg-teal-600 text-white' : 'border border-slate-200 bg-white text-slate-700')
                      }`}>
                        {message.mediaUrl && (
                          isImage(message) ? (
                            <img
                              src={message.mediaUrl}
                              alt={message.mediaName || 'media'}
                              className={`mb-2 max-h-72 rounded-2xl ${isSticker(message) ? 'bg-transparent object-contain p-1' : ''}`}
                            />
                          ) : (
                            <a
                              href={message.mediaUrl}
                              target="_blank"
                              rel="noreferrer"
                              className={`mb-2 inline-flex items-center gap-2 text-sm font-bold ${isOutbound ? 'text-white' : 'text-teal-600'}`}
                            >
                              <FileText size={16} />
                              {message.mediaName || 'Archivo'}
                            </a>
                          )
                        )}

                        {shouldRenderTextBlock(message) && (
                          <p className={`whitespace-pre-wrap break-words text-sm font-semibold ${renderAsReaction ? 'text-base' : ''}`}>{message.text}</p>
                        )}

                        <div className="mt-2 text-right text-[10px] opacity-70">
                          {formatTime(message.createdAt)}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        <div className="sticky bottom-0 z-20 shrink-0 border-t border-slate-200 bg-white/95 p-3 shadow-[0_-12px_32px_rgba(15,23,42,0.08)] backdrop-blur sm:p-4">
          {attachment && (
            <div className="mb-3 flex items-center justify-between gap-3 rounded-2xl border border-teal-100 bg-teal-50 px-4 py-3">
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-teal-700">Adjunto listo</p>
                <p className="truncate text-sm font-bold text-slate-700">{attachment.name}</p>
              </div>
              <button
                type="button"
                onClick={resetAttachment}
                className="rounded-full p-2 text-slate-500 transition hover:bg-white hover:text-slate-800"
                aria-label="Quitar adjunto"
              >
                <X size={16} />
              </button>
            </div>
          )}

          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex gap-3 sm:flex-1 sm:items-end">
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPTED_FILE_TYPES}
                onChange={handleAttachmentChange}
                className="hidden"
              />

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={!selectedConversation || sending}
                className="shrink-0 rounded-2xl border border-slate-200 bg-slate-50 p-3 text-slate-500 transition hover:border-teal-200 hover:text-teal-600 disabled:opacity-60"
                aria-label="Adjuntar archivo"
              >
                <Paperclip size={18} />
              </button>

              <div className="flex-1 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 focus-within:ring-2 ring-teal-500">
                <textarea
                  ref={textareaRef}
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  placeholder="Escribe o pega el mensaje tal como quieres enviarlo..."
                  rows={1}
                  className="min-h-[56px] w-full resize-none bg-transparent text-sm font-semibold text-slate-700 outline-none placeholder:text-slate-400"
                />
                <p className="mt-2 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
                  El chat queda apoyado abajo y el texto sube como en la app.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleSend}
              disabled={sending || (!draft.trim() && !attachment) || !selectedConversation}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-teal-600 px-5 py-3 font-black text-white disabled:opacity-60 sm:w-auto"
            >
              {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              Enviar
            </button>
          </div>
        </div>
      </section>

      {ConfirmModalComponent}
    </div>
  );
};

export default WhatsAppPage;
