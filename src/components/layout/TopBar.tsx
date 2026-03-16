import { Menu, Search, Bell, User, Users, MessageSquare, Kanban, HelpCircle, LogOut } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import type { SearchResults } from '../../types/index';
import { cn, getChannelColor, getChannelLabel, getStageColor, getStageLabel, formatCurrency } from '../../lib/utils';
import { useSocket } from '../../contexts/SocketContext';
import { useAuth } from '../../contexts/AuthContext';
import HelpModal from '../HelpModal';

interface TopBarProps {
  title: string;
  onMenuClick: () => void;
}

export default function TopBar({ title, onMenuClick }: TopBarProps) {
  const [showHelp, setShowHelp] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<SearchResults | null>(null);
  const [showResults, setShowResults] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadConvs, setUnreadConvs] = useState<any[]>([]);
  const [loadingNotifs, setLoadingNotifs] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { totalUnread } = useSocket();
  const { user, signOut } = useAuth();

  const hasResults = results && (
    results.contacts.length > 0 ||
    results.conversations.length > 0 ||
    results.deals.length > 0
  );

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!searchQuery.trim() || searchQuery.length < 2) {
      setResults(null);
      setShowResults(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await api.globalSearch(searchQuery);
        setResults(data);
        setShowResults(true);
      } catch {
        setResults(null);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [searchQuery]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowResults(false);
      }
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setShowNotifications(false);
      }
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setShowProfile(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  async function handleBellClick() {
    if (showNotifications) {
      setShowNotifications(false);
      return;
    }
    setShowNotifications(true);
    if (totalUnread > 0) {
      setLoadingNotifs(true);
      try {
        const data = await api.getConversations({ status: 'open' });
        const withUnread = (Array.isArray(data) ? data : [])
          .filter((c: any) => c.unread_count > 0)
          .sort((a: any, b: any) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime())
          .slice(0, 6);
        setUnreadConvs(withUnread);
      } catch { /* ignore */ }
      finally { setLoadingNotifs(false); }
    }
  }

  function close() {
    setShowResults(false);
    setSearchQuery('');
    setResults(null);
  }

  return (
    <header className="bg-white border-b border-slate-200 px-4 lg:px-6 py-3 flex items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <button onClick={onMenuClick} className="lg:hidden text-slate-500 hover:text-slate-700">
          <Menu className="w-6 h-6" />
        </button>
        <h1 className="text-lg font-bold text-slate-800 hidden sm:block">{title}</h1>
      </div>

      {/* Global Search */}
      <div ref={searchRef} className="relative flex-1 max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          placeholder="Buscar contactos, chats, deals..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onFocus={() => hasResults && setShowResults(true)}
          className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />

        {showResults && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-50 max-h-80 overflow-y-auto">
            {loading && <div className="px-4 py-3 text-sm text-slate-400 text-center">Buscando...</div>}

            {!loading && !hasResults && (
              <div className="px-4 py-3 text-sm text-slate-400 text-center">Sin resultados para "{searchQuery}"</div>
            )}

            {!loading && results && results.contacts.length > 0 && (
              <div>
                <div className="flex items-center gap-1.5 px-3 pt-2.5 pb-1">
                  <Users className="w-3 h-3 text-slate-400" />
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Contactos</span>
                </div>
                {results.contacts.map((c) => (
                  <button key={c.id} onClick={() => { navigate(`/app/contacts/${c.id}`); close(); }} className="w-full text-left px-4 py-2 hover:bg-slate-50 flex items-center gap-3 transition-colors">
                    <div className="w-7 h-7 bg-blue-100 rounded-full flex items-center justify-center text-xs font-bold text-blue-600 shrink-0">{c.name.charAt(0)}</div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-slate-800 truncate">{c.name}</div>
                      <div className="text-xs text-slate-400 truncate">{c.phone || c.email}</div>
                    </div>
                    <span className={cn('px-1.5 py-0.5 rounded text-[10px] font-medium shrink-0', getStageColor(c.pipeline_stage))}>{getStageLabel(c.pipeline_stage)}</span>
                  </button>
                ))}
              </div>
            )}

            {!loading && results && results.conversations.length > 0 && (
              <div className={results.contacts.length > 0 ? 'border-t border-slate-50' : ''}>
                <div className="flex items-center gap-1.5 px-3 pt-2.5 pb-1">
                  <MessageSquare className="w-3 h-3 text-slate-400" />
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Conversaciones</span>
                </div>
                {results.conversations.map((c) => (
                  <button key={c.id} onClick={() => { navigate(`/app/inbox/${c.id}`); close(); }} className="w-full text-left px-4 py-2 hover:bg-slate-50 flex items-center gap-3 transition-colors">
                    <div className="w-7 h-7 bg-green-100 rounded-full flex items-center justify-center shrink-0">
                      <MessageSquare className="w-3.5 h-3.5 text-green-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-slate-800 truncate">{c.contact_name}</div>
                      <div className="text-xs text-slate-400 truncate">{c.last_message || 'Sin mensajes'}</div>
                    </div>
                    <span className={cn('px-1.5 py-0.5 rounded text-[10px] font-medium shrink-0', getChannelColor(c.channel))}>{getChannelLabel(c.channel)}</span>
                  </button>
                ))}
              </div>
            )}

            {!loading && results && results.deals.length > 0 && (
              <div className={(results.contacts.length > 0 || results.conversations.length > 0) ? 'border-t border-slate-50' : ''}>
                <div className="flex items-center gap-1.5 px-3 pt-2.5 pb-1">
                  <Kanban className="w-3 h-3 text-slate-400" />
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Deals</span>
                </div>
                {results.deals.map((d) => (
                  <button key={d.id} onClick={() => { navigate('/app/pipeline'); close(); }} className="w-full text-left px-4 py-2 hover:bg-slate-50 flex items-center gap-3 transition-colors">
                    <div className="w-7 h-7 bg-orange-100 rounded-full flex items-center justify-center shrink-0">
                      <Kanban className="w-3.5 h-3.5 text-orange-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-slate-800 truncate">{d.title}</div>
                      <div className="text-xs text-slate-400 truncate">{d.contact_name}</div>
                    </div>
                    <div className="text-right shrink-0">
                      {d.value > 0 && <div className="text-xs font-semibold text-emerald-600">{formatCurrency(d.value)}</div>}
                      <span className={cn('px-1.5 py-0.5 rounded text-[10px] font-medium', getStageColor(d.stage))}>{getStageLabel(d.stage)}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
            <div className="h-2" />
          </div>
        )}
      </div>

      {/* Right side */}
      <div className="flex items-center gap-2">
        {/* Help button */}
        <button
          onClick={() => setShowHelp(true)}
          className="p-2 text-slate-400 hover:text-purple-500 hover:bg-purple-50 rounded-full transition-colors"
          title="Guía de uso"
        >
          <HelpCircle className="w-5 h-5" />
        </button>
        <div ref={notifRef} className="relative">
          <button
            onClick={handleBellClick}
            className="p-2 text-slate-400 hover:text-blue-500 hover:bg-blue-50 rounded-full transition-colors relative"
            title={totalUnread > 0 ? `${totalUnread} mensajes sin leer` : 'Notificaciones'}
          >
            <Bell className="w-5 h-5" />
            {totalUnread > 0 && (
              <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[9px] font-bold min-w-[16px] h-[16px] rounded-full flex items-center justify-center px-0.5">
                {totalUnread > 9 ? '9+' : totalUnread}
              </span>
            )}
          </button>

          {/* Notification dropdown */}
          {showNotifications && (
            <div className="absolute right-0 top-full mt-2 w-80 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden">
              <div className="px-4 py-2.5 border-b border-slate-100 flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-700">
                  {totalUnread > 0 ? `${totalUnread} sin leer` : 'Sin mensajes nuevos'}
                </span>
                <button
                  onClick={() => { navigate('/app/inbox'); setShowNotifications(false); }}
                  className="text-xs text-blue-500 hover:underline"
                >
                  Ver todo el inbox
                </button>
              </div>
              {loadingNotifs && (
                <div className="px-4 py-3 text-xs text-slate-400 text-center">Cargando...</div>
              )}
              {!loadingNotifs && unreadConvs.length === 0 && totalUnread === 0 && (
                <div className="px-4 py-4 text-xs text-slate-400 text-center">
                  No tienes mensajes sin leer 🎉
                </div>
              )}
              {!loadingNotifs && unreadConvs.map((conv) => (
                <button
                  key={conv.id}
                  onClick={() => { navigate(`/app/inbox/${conv.id}`); setShowNotifications(false); }}
                  className="w-full text-left px-4 py-3 hover:bg-slate-50 border-b border-slate-50 last:border-b-0 flex items-start gap-3 transition-colors"
                >
                  <div className="w-7 h-7 bg-blue-100 rounded-full flex items-center justify-center shrink-0 mt-0.5 text-xs font-bold text-blue-600">
                    {(conv.contact_name ?? '?').charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-xs font-semibold text-slate-800 truncate">{conv.contact_name}</span>
                      {conv.unread_count > 0 && (
                        <span className="bg-red-500 text-white text-[9px] font-bold min-w-[16px] h-[16px] rounded-full flex items-center justify-center px-0.5 shrink-0">
                          {conv.unread_count > 9 ? '9+' : conv.unread_count}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 truncate mt-0.5">{conv.last_message || 'Sin mensajes'}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
        <div ref={profileRef} className="relative">
          <button
            onClick={() => setShowProfile(v => !v)}
            className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center border border-slate-200 transition-colors"
            title="Mi perfil"
          >
            <User className="w-5 h-5 text-slate-400" />
          </button>

          {showProfile && (
            <div className="absolute right-0 top-full mt-2 w-56 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100">
                <p className="text-[10px] text-slate-400 uppercase tracking-wider font-medium">Sesión activa</p>
                <p className="text-xs font-semibold text-slate-700 truncate mt-0.5">{user?.email}</p>
              </div>
              <button
                onClick={async () => { await signOut(); setShowProfile(false); }}
                className="w-full text-left flex items-center gap-2 px-4 py-3 text-sm text-red-500 hover:bg-red-50 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Cerrar sesión
              </button>
            </div>
          )}
        </div>
      </div>

      {showHelp && <HelpModal onClose={() => setShowHelp(false)} />}
    </header>
  );
}
