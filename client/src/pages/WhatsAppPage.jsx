import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Search, Send, Loader2, FileText, Trash2 } from 'lucide-react';
import api from '../services/api';
import { useConfirmModal } from '../components/ConfirmModal';

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

const WhatsAppPage = () => {
  const [conversations, setConversations] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [search, setSearch] = useState('');
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef(null);
  const { ConfirmModalComponent, openModal } = useConfirmModal();

  const filteredConversations = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return conversations;
    return conversations.filter((c) => (
      c.profileName?.toLowerCase().includes(term) ||
      c.phone?.toLowerCase().includes(term) ||
      c.lastMessageText?.toLowerCase().includes(term)
    ));
  }, [conversations, search]);

  const selectedConversation = conversations.find((c) => c.id === selectedId) || null;

  const loadConversations = async () => {
    try {
      const { data } = await api.get('/whatsapp/conversations');
      const nextConversations = Array.isArray(data) ? data : [];
      setConversations(nextConversations);
      setSelectedId((prev) => {
        if (prev && nextConversations.some((conv) => conv.id === prev)) return prev;
        return nextConversations[0]?.id ?? null;
      });
    } catch (error) {
      console.error('Error cargando conversaciones:', error);
    } finally {
      setLoadingConversations(false);
    }
  };

  const loadMessages = async (conversationId) => {
    if (!conversationId) return;
    setLoadingMessages(true);
    try {
      const { data } = await api.get(`/whatsapp/conversations/${conversationId}/messages`);
      setMessages(data || []);
    } catch (error) {
      console.error('Error cargando mensajes:', error);
    } finally {
      setLoadingMessages(false);
    }
  };

  useEffect(() => {
    loadConversations();
    const interval = setInterval(loadConversations, 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    loadMessages(selectedId);
    api.post(`/whatsapp/conversations/${selectedId}/read`).catch(() => {});
    const interval = setInterval(() => loadMessages(selectedId), 8000);
    return () => clearInterval(interval);
  }, [selectedId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!draft.trim() || !selectedConversation) return;
    try {
      setSending(true);
      await api.post(`/whatsapp/conversations/${selectedConversation.id}/messages`, { text: draft });
      setDraft('');
      await loadMessages(selectedConversation.id);
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
        await loadConversations();
      },
    });
  };

  return (
    <div className="flex h-screen bg-slate-50">
      <aside className="w-80 border-r border-slate-200 bg-white flex flex-col">
        <div className="p-4 border-b border-slate-100">
          <h1 className="text-lg font-black text-slate-800">WhatsApp</h1>
          <div className="mt-3 relative">
            <Search size={16} className="absolute left-3 top-3 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 py-2 text-sm font-semibold outline-none focus:ring-2 ring-teal-500"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loadingConversations ? (
            <div className="flex justify-center items-center h-full text-slate-400">
              <Loader2 className="animate-spin" />
            </div>
          ) : (
            filteredConversations.map((conv) => {
              const isActive = conv.id === selectedId;
              return (
                <button
                  key={conv.id}
                  type="button"
                  onClick={() => setSelectedId(conv.id)}
                  className={`w-full text-left px-4 py-3 border-b border-slate-100 transition-all ${
                    isActive ? 'bg-teal-50' : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <p className="font-bold text-slate-800 text-sm">{conv.profileName || conv.phone}</p>
                    <span className="text-[10px] text-slate-400 font-semibold">{formatDate(conv.lastMessageAt)}</span>
                  </div>
                  <div className="flex justify-between items-center gap-2">
                    <p className="text-xs text-slate-500 truncate flex-1">{conv.lastMessageText || 'Sin mensajes'}</p>
                    {conv.unreadCount > 0 && (
                      <span className="text-[10px] font-black bg-red-600 text-white rounded-full px-2 py-0.5">
                        {conv.unreadCount}
                      </span>
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </aside>

      <section className="flex-1 flex flex-col">
        <header className="p-4 border-b border-slate-200 bg-white flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-black text-slate-800">
              {selectedConversation ? (selectedConversation.profileName || selectedConversation.phone) : 'Selecciona una conversación'}
            </p>
            {selectedConversation && (
              <p className="text-xs text-slate-400 font-semibold">{selectedConversation.phone}</p>
            )}
          </div>
          {selectedConversation && (
            <button
              type="button"
              onClick={handleDeleteConversation}
              className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-600 transition hover:bg-red-100"
            >
              <Trash2 size={14} />
              Borrar
            </button>
          )}
        </header>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {loadingMessages ? (
            <div className="flex justify-center text-slate-400">
              <Loader2 className="animate-spin" />
            </div>
          ) : (
            messages.map((msg) => {
              const isOutbound = msg.direction === 'outbound';
              return (
                <div key={msg.id} className={`flex ${isOutbound ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-md rounded-2xl px-4 py-3 shadow-sm ${
                    isOutbound ? 'bg-teal-600 text-white' : 'bg-white border border-slate-200 text-slate-700'
                  }`}>
                    {msg.mediaUrl && (
                      isImage(msg) ? (
                        <img src={msg.mediaUrl} alt="media" className="rounded-xl mb-2 max-h-60" />
                      ) : (
                        <a href={msg.mediaUrl} target="_blank" rel="noreferrer" className={`flex items-center gap-2 text-sm font-bold ${isOutbound ? 'text-white' : 'text-teal-600'}`}>
                          <FileText size={16} />
                          {msg.mediaName || 'Archivo'}
                        </a>
                      )
                    )}
                    {msg.text && (
                      <p className="text-sm font-semibold whitespace-pre-wrap">{msg.text}</p>
                    )}
                    <div className="mt-2 text-[10px] text-right opacity-70">
                      {formatTime(msg.createdAt)}
                    </div>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="p-4 border-t border-slate-200 bg-white">
          <div className="flex gap-3 items-center">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Escribe un mensaje..."
              className="flex-1 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold outline-none focus:ring-2 ring-teal-500"
            />
            <button
              onClick={handleSend}
              disabled={sending || !draft.trim()}
              className="px-5 py-3 rounded-2xl bg-teal-600 text-white font-black flex items-center gap-2 disabled:opacity-60"
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
