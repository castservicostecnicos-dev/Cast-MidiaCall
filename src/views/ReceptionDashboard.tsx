import React, { useState, useEffect, useRef } from 'react';
import {
  BellRing,
  Send,
  Clock,
  Sparkles,
  CheckCircle2,
  Monitor,
  Star,
  Pin,
  RefreshCw,
  RotateCcw,
  Activity,
  AlertTriangle,
  ChevronRight,
  Keyboard,
  Hash,
  ArrowRight,
  ShieldAlert,
  X,
} from 'lucide-react';
import { api } from '../lib/api';
import { TicketStatus } from '../types';
import { PlayerDiagnosticView, DiagnosticPlayerData } from '../components/PlayerDiagnosticView';

interface ReceptionDashboardProps {
  showToast: (type: 'success' | 'error' | 'info', message: string) => void;
  onOpenPlayerSimulation?: (code: string) => void;
}

export const ReceptionDashboard: React.FC<ReceptionDashboardProps> = ({
  showToast,
  onOpenPlayerSimulation,
}) => {
  // Tabs: 'calls' | 'diagnostic'
  const [activeTab, setActiveTab] = useState<'calls' | 'diagnostic'>('calls');

  const [players, setPlayers] = useState<DiagnosticPlayerData[]>([]);

  // Persistent Player selection via localStorage
  const [selectedPlayerId, setSelectedPlayerId] = useState<string>(() => {
    try {
      return localStorage.getItem('indoor_reception_player_id') || localStorage.getItem('indoor_op_player_id') || '';
    } catch {
      return '';
    }
  });

  // Target for diagnosis
  const [diagnosticPlayerId, setDiagnosticPlayerId] = useState<string>('');

  // Persistent Phrase: Fixed for Reception (Guichê)
  const [callText, setCallText] = useState<string>(() => {
    try {
      return (
        localStorage.getItem('indoor_reception_call_text') ||
        'Guichê 01 - Favor comparecer'
      );
    } catch {
      return 'Guichê 01 - Favor comparecer';
    }
  });

  // Ticket Counter State (001 to 999, independent sequences for normal and priority, daily reset at 00:00h)
  const [ticketStatus, setTicketStatus] = useState<TicketStatus | null>(null);
  const [loadingTicket, setLoadingTicket] = useState<boolean>(false);
  const [isResetModalOpen, setIsResetModalOpen] = useState<boolean>(false);
  const [resetTarget, setResetTarget] = useState<'all' | 'normal' | 'priority'>('all');

  const [isPriority, setIsPriority] = useState<boolean>(false);
  const [duration, setDuration] = useState<number>(10);
  const [isCalling, setIsCalling] = useState<boolean>(false);
  const [lastCallDelivered, setLastCallDelivered] = useState<boolean | null>(null);
  const [lastCallTime, setLastCallTime] = useState<string | null>(null);
  const [lastCalledTicket, setLastCalledTicket] = useState<string | null>(null);

  // Sync fixed phrase and chosen player persistently in localStorage
  useEffect(() => {
    try {
      if (callText !== undefined) {
        localStorage.setItem('indoor_reception_call_text', callText);
      }
      if (selectedPlayerId) {
        localStorage.setItem('indoor_reception_player_id', selectedPlayerId);
      }
    } catch {}
  }, [callText, selectedPlayerId]);

  const loadTicketStatus = async () => {
    try {
      setLoadingTicket(true);
      const res = await api.getTicketStatus();
      setTicketStatus(res);
    } catch (err) {
      console.warn('Could not load ticket status:', err);
    } finally {
      setLoadingTicket(false);
    }
  };

  const loadData = async () => {
    try {
      const res = await api.getOperatorDashboard();
      setPlayers(res.players);
      if (res.players.length > 0 && !selectedPlayerId) {
        setSelectedPlayerId(res.players[0].id);
      }
      await loadTicketStatus();
    } catch (err: any) {
      showToast('error', err.message || 'Erro ao carregar dados da recepção.');
    }
  };

  useEffect(() => {
    loadData();
    // Poll players and ticket status every 8s to keep all guichês synchronized
    const interval = setInterval(() => {
      api.getOperatorDashboard()
        .then((res) => setPlayers(res.players))
        .catch(() => {});
      api.getTicketStatus()
        .then((res) => setTicketStatus(res))
        .catch(() => {});
    }, 8000);
    return () => clearInterval(interval);
  }, []);

  const handleResetTicketCounter = async () => {
    try {
      const res = await api.resetTicketCounter(resetTarget);
      setTicketStatus(res);
      showToast('success', res.message || 'Contador de senhas reiniciado com sucesso!');
      setIsResetModalOpen(false);
    } catch (err: any) {
      showToast('error', err.message || 'Erro ao reiniciar contador de senhas.');
    }
  };

  const handleTriggerCall = async (overridePriority?: boolean) => {
    if (!selectedPlayerId) {
      showToast('error', 'Selecione um player de exibição.');
      return;
    }
    if (!callText.trim()) {
      showToast('error', 'Informe a frase de atendimento do guichê.');
      return;
    }

    const priorityToSend = overridePriority !== undefined ? overridePriority : isPriority;
    setIsCalling(true);
    try {
      const res = await api.triggerCall({
        playerId: selectedPlayerId,
        phrase: callText.trim(),
        duration,
        isPriority: priorityToSend,
        autoTicket: true,
        callSource: 'reception',
      });

      if (res.ticketStatus) {
        setTicketStatus(res.ticketStatus);
      } else {
        loadTicketStatus();
      }

      // Synchronize immediately with all open tabs and windows in the browser
      try {
        if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
          const bc = new BroadcastChannel('indoor_media_calls');
          bc.postMessage({ type: 'CALL_EVENT', call: res.call });
          bc.close();
        }
      } catch {}

      try {
        localStorage.setItem(
          'indoor_last_call',
          JSON.stringify({ call: res.call, timestamp: Date.now() })
        );
      } catch {}

      setLastCallDelivered(res.delivered);
      const nowStr = new Date().toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
      setLastCallTime(nowStr);
      setLastCalledTicket(res.call.ticket || null);

      showToast(
        'success',
        priorityToSend
          ? `Chamada PREFERENCIAL gerada com sucesso: ${res.call.phrase}`
          : `Chamada NORMAL gerada com sucesso: ${res.call.phrase}`
      );
    } catch (err: any) {
      showToast('error', err.message || 'Falha ao disparar chamada no guichê.');
    } finally {
      setIsCalling(false);
    }
  };

  // Keyboard shortcut ref
  const triggerCallRef = useRef(handleTriggerCall);
  useEffect(() => {
    triggerCallRef.current = handleTriggerCall;
  });

  // Global shortcuts: [N] for Normal call, [P] for Priority call
  useEffect(() => {
    if (activeTab !== 'calls') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }
      if (e.ctrlKey || e.altKey || e.metaKey) return;

      if (e.key === 'n' || e.key === 'N') {
        e.preventDefault();
        triggerCallRef.current(false);
      } else if (e.key === 'p' || e.key === 'P') {
        e.preventDefault();
        triggerCallRef.current(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [activeTab]);

  const selectedPlayer = players.find((p) => p.id === selectedPlayerId);
  const activeDiagnosticPlayer =
    players.find((p) => p.id === (diagnosticPlayerId || selectedPlayerId)) ||
    selectedPlayer ||
    players[0];

  const onlinePlayersCount = players.filter((p) => p.is_online).length;
  const offlinePlayersCount = players.length - onlinePlayersCount;

  const nextPure = ticketStatus?.formattedNextPure || '001';
  const nextNormal = ticketStatus?.formattedNextNormal || '001';
  const nextPriority = ticketStatus?.formattedNextPriority || 'P001';

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
      {/* NAVEGAÇÃO POR ABAS: RECEPÇÃO / GUICHÊ x DIAGNÓSTICO */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-700 pb-4 mb-6">
        <div className="flex items-center gap-2 bg-slate-900/80 p-1.5 rounded-xl border border-slate-800">
          <button
            type="button"
            id="tab-reception-calls"
            onClick={() => setActiveTab('calls')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition cursor-pointer ${
              activeTab === 'calls'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-900/40'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <BellRing className="h-4 w-4" />
            <span>Recepção (Guichê)</span>
          </button>

          <button
            type="button"
            id="tab-reception-diagnostic"
            onClick={() => setActiveTab('diagnostic')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition cursor-pointer ${
              activeTab === 'diagnostic'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-900/40'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Activity className="h-4 w-4" />
            <span>Diagnóstico das Telas</span>
            {offlinePlayersCount > 0 && (
              <span className="ml-1 px-1.5 py-0.2 rounded-full bg-rose-500 text-white text-[9px] font-black animate-pulse">
                {offlinePlayersCount} off
              </span>
            )}
          </button>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          <button
            type="button"
            onClick={loadData}
            title="Atualizar status e senhas"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white border border-slate-700 text-xs font-semibold cursor-pointer transition shadow-xs"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loadingTicket ? 'animate-spin' : ''}`} />
            <span className="hidden xs:inline">Atualizar</span>
          </button>
        </div>
      </div>

      {activeTab === 'calls' && (
        <div className="space-y-5 animate-in fade-in duration-150">
          {/* PAINEL DE CONTROLE DE SENHAS SEQUENCIAIS (COMPARTILHADA POR TODOS OS GUICHÊS) */}
          {/* PAINEL DE CONTROLE DE SENHAS SEQUENCIAIS (SEQUÊNCIAS INDEPENDENTES NORMAL E PREFERENCIAL) */}
          <div className="rounded-2xl border-2 border-blue-600/60 bg-gradient-to-br from-slate-900 via-slate-850 to-blue-950/40 p-5 shadow-xl relative overflow-hidden">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="p-1.5 rounded-lg bg-blue-500/20 text-blue-400">
                    <Hash className="h-5 w-5" />
                  </span>
                  <div>
                    <h2 className="text-base sm:text-lg font-black text-white tracking-wide">
                      Painel de Senhas do Guichê (Sequências Independentes)
                    </h2>
                    <p className="text-xs text-slate-400">
                      Normal (001 a 999) e Preferencial (P001 a P999) possuem contagens totalmente independentes.
                    </p>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-slate-300 font-medium">
                  <span className="bg-slate-800/90 text-blue-300 px-2.5 py-1 rounded-md border border-blue-800/60">
                    • Fila Normal: <strong>001 a 999</strong> (própria sequência)
                  </span>
                  <span className="bg-slate-800/90 text-amber-300 px-2.5 py-1 rounded-md border border-amber-800/60">
                    • Fila Preferencial: <strong>P001 a P999</strong> (própria sequência)
                  </span>
                  <span className="bg-slate-800/80 px-2.5 py-1 rounded-md border border-slate-700">
                    • Reinício diário às: <strong>00:00h</strong>
                  </span>
                  {ticketStatus?.lastResetDate && (
                    <span className="bg-slate-900/90 text-slate-400 px-2.5 py-1 rounded-md border border-slate-700 font-mono text-[10px]">
                      Data: {ticketStatus.lastResetDate}
                    </span>
                  )}
                </div>
              </div>

              {/* Cards de Visualização da Próxima Senha */}
              <div className="flex items-center gap-3">
                <div className="text-center bg-slate-950/80 border border-blue-500/60 rounded-xl px-4 py-2.5 min-w-[110px] shadow-md">
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
                    Próx. Normal
                  </span>
                  <span className="text-3xl font-mono font-black text-blue-400 tracking-wider">
                    {nextNormal}
                  </span>
                </div>

                <div className="text-center bg-slate-950/80 border border-amber-500/60 rounded-xl px-4 py-2.5 min-w-[110px] shadow-md">
                  <span className="text-[10px] uppercase font-bold text-amber-400 tracking-wider block">
                    Próx. Preferencial
                  </span>
                  <span className="text-3xl font-mono font-black text-amber-300 tracking-wider">
                    {nextPriority}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => setIsResetModalOpen(true)}
                  title="Reiniciar manualmente o contador de senhas"
                  className="px-2.5 py-2 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white border border-slate-700 text-[11px] font-semibold transition cursor-pointer flex flex-col items-center justify-center gap-1"
                >
                  <RotateCcw className="h-3.5 w-3.5 text-amber-400" />
                  <span className="text-[10px]">Zerar</span>
                </button>
              </div>
            </div>
          </div>

          {/* 1. SELEÇÃO DO PLAYER DESTINO */}
          <div className="rounded-xl border border-slate-700 bg-slate-800 p-4 shadow-sm">
            <div className="flex items-center justify-between mb-2.5 flex-wrap gap-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
                <Monitor className="h-4 w-4 text-blue-400" />
                <span>1. Tela da TV de Exibição</span>
              </label>

              {selectedPlayer && (
                <div className="flex items-center gap-3">
                  <a
                    href={`/?player=${encodeURIComponent(selectedPlayer.code)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-400 hover:text-blue-300 font-bold underline flex items-center gap-1 cursor-pointer"
                    title="Abre a tela da TV em nova aba para acompanhar as chamadas ao vivo"
                  >
                    Abrir TV ↗
                  </a>
                  {onOpenPlayerSimulation && (
                    <button
                      type="button"
                      onClick={() => onOpenPlayerSimulation(selectedPlayer.code)}
                      className="text-xs text-slate-400 hover:text-slate-200 cursor-pointer hidden sm:inline"
                    >
                      (simular)
                    </button>
                  )}
                </div>
              )}
            </div>

            {players.length === 0 ? (
              <p className="text-xs text-slate-400 py-2">
                Nenhum player cadastrado na sua empresa.
              </p>
            ) : players.length === 1 ? (
              <div className="flex items-center justify-between p-3 rounded-lg border border-blue-500/60 bg-blue-950/30">
                <div className="flex items-center gap-2.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                  <div>
                    <span className="font-bold text-white text-sm">
                      {players[0].name}
                    </span>
                    <span className="ml-2 font-mono text-[10px] text-blue-400 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-700 font-bold">
                      {players[0].code}
                    </span>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {players[0].location || 'Localização padrão'}
                    </p>
                  </div>
                </div>

                <span
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                    players[0].is_online
                      ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800'
                      : 'bg-rose-950/80 text-rose-300 border border-rose-800'
                  }`}
                >
                  {players[0].is_online ? 'Online' : 'Offline'}
                </span>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                {players.map((p) => {
                  const isSelected = p.id === selectedPlayerId;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setSelectedPlayerId(p.id)}
                      className={`flex items-center justify-between p-3 rounded-xl border text-left transition cursor-pointer ${
                        isSelected
                          ? 'border-blue-500 bg-blue-950/50 ring-1 ring-blue-500 shadow-xs'
                          : 'border-slate-700/80 bg-slate-900/60 hover:bg-slate-900'
                      }`}
                    >
                      <div className="truncate pr-1">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-white text-xs truncate">
                            {p.name}
                          </span>
                          <span className="font-mono text-[9px] text-blue-400 bg-slate-950 px-1 py-0.2 rounded border border-slate-800 font-bold">
                            {p.code}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5 truncate">
                          {p.location || 'Sem local'}
                        </p>
                      </div>

                      <span
                        className={`shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                          p.is_online
                            ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800'
                            : 'bg-rose-950/80 text-rose-300 border border-rose-800'
                        }`}
                      >
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${
                            p.is_online ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'
                          }`}
                        />
                        {p.is_online ? 'Online' : 'Off'}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* 2. FRASE FIXA DO GUICHÊ & PREVIEW DA CHAMADA AUTOMÁTICA */}
          <div className="rounded-xl border border-slate-700 bg-slate-800 p-5 shadow-sm space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
                  <Sparkles className="h-4 w-4 text-amber-400" />
                  <span>2. Identificação do Guichê / Frase Fixa</span>
                </label>

                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 rounded-md bg-blue-950/90 border border-blue-700/80 px-2 py-0.5 text-[11px] font-bold text-blue-300">
                    <Pin className="h-3 w-3 text-blue-400" />
                    Frase Salva do Guichê
                  </span>
                  {callText && (
                    <button
                      type="button"
                      onClick={() => setCallText('Guichê 01 - Favor comparecer')}
                      className="text-[11px] text-slate-400 hover:text-white underline cursor-pointer"
                      title="Restaurar padrão"
                    >
                      Padrão
                    </button>
                  )}
                </div>
              </div>

              <input
                id="input-reception-phrase"
                type="text"
                value={callText}
                onChange={(e) => setCallText(e.target.value)}
                placeholder="Ex: Guichê 01 - Favor comparecer / Recepção Central..."
                className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm font-semibold text-white placeholder-slate-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none transition shadow-inner"
              />

              {/* Preview da chamada */}
              <div className="mt-3 p-3 rounded-xl bg-slate-900/90 border border-slate-800 flex items-center justify-between flex-wrap gap-2 text-xs">
                <span className="text-slate-400 font-medium">Como aparecerá na TV:</span>
                <span className="font-mono font-bold text-white bg-slate-950 px-3 py-1 rounded-lg border border-slate-700 text-xs sm:text-sm">
                  Senha <span className="text-amber-400">{isPriority ? nextPriority : nextNormal}</span> - {callText.trim() || 'Guichê'}
                </span>
              </div>
            </div>

            {/* Fila / Atendimento Preferencial */}
            <div
              className={`rounded-xl border p-3.5 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                isPriority
                  ? 'border-amber-500/80 bg-amber-950/40'
                  : 'border-amber-900/40 bg-amber-950/15'
              }`}
            >
              <div className="flex items-start gap-2.5">
                <div className="p-1.5 rounded-lg bg-amber-500/20 text-amber-400 shrink-0 mt-0.5 sm:mt-0">
                  <Star className="h-4 w-4 fill-amber-400" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-amber-200 uppercase tracking-wide flex items-center gap-1.5">
                    <span>Fila Preferencial</span>
                    {isPriority && (
                      <span className="bg-amber-500 text-slate-950 text-[9px] font-black px-1.5 py-0.2 rounded uppercase">
                        Ativa
                      </span>
                    )}
                  </h4>
                  <p className="text-[11px] text-amber-300/80">
                    Gera senha com prefixo P ({nextPriority}) e alerta dourado na TV
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsPriority(!isPriority)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                    isPriority
                      ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/30'
                      : 'bg-slate-900 border border-slate-700 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <Star className={`h-3.5 w-3.5 ${isPriority ? 'fill-slate-950' : ''}`} />
                  <span>{isPriority ? 'PREFERENCIAL MARCADO' : 'Marcar Preferencial'}</span>
                </button>
              </div>
            </div>

            {/* Tempo de Duração na Tela */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-slate-700/80 pt-3.5">
              <div className="flex items-center gap-2 text-xs text-slate-300">
                <Clock className="h-4 w-4 text-slate-400 shrink-0" />
                <span className="text-xs font-medium">Tempo de exibição na tela:</span>
              </div>
              <div className="flex items-center gap-1.5 bg-slate-900 p-1 rounded-lg border border-slate-700 self-start sm:self-auto">
                {[5, 10, 15, 20].map((sec) => (
                  <button
                    key={sec}
                    type="button"
                    onClick={() => setDuration(sec)}
                    className={`min-h-[36px] px-3 py-1 rounded-md text-xs font-bold uppercase transition cursor-pointer ${
                      duration === sec
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {sec}s
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 3. BOTÕES DE DISPARO RÁPIDO COM SENHA AUTOMÁTICA */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl bg-slate-900/80 border border-slate-800 text-xs text-slate-400 shadow-inner">
              <div className="flex items-center gap-2">
                <Keyboard className="h-4 w-4 text-blue-400 shrink-0" />
                <span className="font-semibold text-slate-300">
                  Atalhos de Teclado (fora de campos de texto):
                </span>
              </div>
              <div className="flex items-center gap-2 font-mono text-[11px]">
                <span className="inline-flex items-center gap-1.5 bg-slate-800 border border-slate-700 px-2.5 py-0.5 rounded-md text-blue-300">
                  <kbd className="font-bold text-white bg-slate-900 px-1 py-0.2 rounded border border-slate-600">N</kbd>
                  <span>Chamar Próxima Normal ({nextNormal})</span>
                </span>
                <span className="inline-flex items-center gap-1.5 bg-slate-800 border border-slate-700 px-2.5 py-0.5 rounded-md text-amber-300">
                  <kbd className="font-bold text-white bg-slate-900 px-1 py-0.2 rounded border border-slate-600">P</kbd>
                  <span>Chamar Próxima Preferencial ({nextPriority})</span>
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Botão Chamar Normal com Senha Automática */}
              <button
                id="btn-reception-call-normal"
                type="button"
                disabled={isCalling || !callText.trim() || !selectedPlayerId}
                onClick={() => handleTriggerCall(false)}
                className="flex items-center justify-between gap-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 py-4 px-5 text-xs sm:text-sm font-extrabold uppercase tracking-wider text-white shadow-lg shadow-blue-900/40 focus:ring-2 focus:ring-blue-500/50 transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed group"
                title="Chama a próxima senha normal sequencial e envia para a tela"
              >
                <div className="flex items-center gap-2.5">
                  <Send className="h-4 w-4 shrink-0" />
                  <span>{isCalling ? 'Gerando chamada...' : `[ CHAMAR SENHA ${nextNormal} ]`}</span>
                </div>
                <span className="shrink-0 flex items-center gap-1 bg-blue-700/90 border border-blue-400/40 px-2.5 py-1 rounded-md text-[11px] font-mono font-bold tracking-normal text-blue-100 shadow-inner group-hover:bg-blue-800 transition">
                  <Keyboard className="h-3 w-3" />
                  Tecla N
                </span>
              </button>

              {/* Botão Chamar Preferencial com Senha Automática */}
              <button
                id="btn-reception-call-priority"
                type="button"
                disabled={isCalling || !callText.trim() || !selectedPlayerId}
                onClick={() => handleTriggerCall(true)}
                className="flex items-center justify-between gap-2.5 rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 py-4 px-5 text-xs sm:text-sm font-black uppercase tracking-wider text-slate-950 shadow-lg shadow-amber-950/50 transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed group"
                title="Chama a próxima senha preferencial sequencial e envia para a tela"
              >
                <div className="flex items-center gap-2.5">
                  <Star className="h-4 w-4 fill-slate-950 shrink-0" />
                  <span>{isCalling ? 'Gerando chamada...' : `[ CHAMAR SENHA ${nextPriority} ]`}</span>
                </div>
                <span className="shrink-0 flex items-center gap-1 bg-amber-700/80 border border-slate-950/40 px-2.5 py-1 rounded-md text-[11px] font-mono font-black tracking-normal text-slate-950 shadow-inner group-hover:bg-amber-800/80 transition">
                  <Keyboard className="h-3 w-3" />
                  Tecla P
                </span>
              </button>
            </div>

            {/* Confirmação de Envio */}
            {lastCallDelivered !== null && (
              <div className="mt-2 text-center text-xs font-medium text-emerald-400 flex items-center justify-center gap-2 bg-emerald-950/30 border border-emerald-900/50 py-2.5 px-4 rounded-xl">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>
                  Senha {lastCalledTicket ? <strong>{lastCalledTicket}</strong> : ''} transmitida com sucesso para o player {selectedPlayer ? `(${selectedPlayer.name})` : ''} às {lastCallTime}.
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ABA DE DIAGNÓSTICO DOS PLAYERS */}
      {activeTab === 'diagnostic' && (
        <div className="space-y-6 animate-in fade-in duration-150">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 rounded-xl border border-slate-700 bg-slate-800">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total de Telas</span>
              <p className="text-xl font-black text-white mt-0.5">{players.length}</p>
            </div>
            <div className="p-3 rounded-xl border border-emerald-900/50 bg-emerald-950/20">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">Online</span>
              <p className="text-xl font-black text-emerald-300 mt-0.5">{onlinePlayersCount}</p>
            </div>
            <div className="p-3 rounded-xl border border-rose-900/50 bg-rose-950/20">
              <span className="text-[10px] font-bold uppercase tracking-wider text-rose-400">Offline</span>
              <p className="text-xl font-black text-rose-300 mt-0.5">{offlinePlayersCount}</p>
            </div>
            <div className="p-3 rounded-xl border border-slate-700 bg-slate-800">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Próx. Senha</span>
              <p className="text-xl font-black text-amber-400 mt-0.5">{nextNormal}</p>
            </div>
          </div>

          {activeDiagnosticPlayer && (
            <PlayerDiagnosticView
              player={activeDiagnosticPlayer}
              allPlayers={players}
              onSelectPlayer={(id) => {
                setDiagnosticPlayerId(id);
                setSelectedPlayerId(id);
              }}
              onRefresh={loadData}
              onOpenSimulation={onOpenPlayerSimulation}
              showToast={showToast}
            />
          )}
        </div>
      )}

      {/* Modal de Seleção e Confirmação para Reiniciar Contador */}
      {isResetModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-slate-800 border border-slate-700 p-5 sm:p-6 shadow-2xl text-slate-100 animate-in fade-in">
            <div className="flex items-start justify-between border-b border-slate-700 pb-3 mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20 shrink-0">
                  <RotateCcw className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-wider text-white">Reiniciar Contador de Senhas</h3>
                  <p className="text-[11px] text-slate-400">Normal e Preferencial possuem sequências independentes (001 a 999).</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsResetModalOpen(false)}
                className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-700 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 mb-6">
              <label className="text-xs font-semibold text-slate-300 block">Qual fila deseja reiniciar?</label>

              <div className="space-y-2">
                <label
                  className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition ${
                    resetTarget === 'all'
                      ? 'border-blue-500 bg-blue-950/40 text-white shadow-xs'
                      : 'border-slate-700 bg-slate-900/60 text-slate-300 hover:bg-slate-900'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="radio"
                      name="resetTarget"
                      value="all"
                      checked={resetTarget === 'all'}
                      onChange={() => setResetTarget('all')}
                      className="text-blue-600 focus:ring-blue-500 cursor-pointer"
                    />
                    <div>
                      <span className="text-xs font-bold block">Ambas as Filas (Normal e Preferencial)</span>
                      <span className="text-[11px] text-slate-400 block">Zera ambas as sequências para 001 e P001</span>
                    </div>
                  </div>
                </label>

                <label
                  className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition ${
                    resetTarget === 'normal'
                      ? 'border-blue-500 bg-blue-950/40 text-white shadow-xs'
                      : 'border-slate-700 bg-slate-900/60 text-slate-300 hover:bg-slate-900'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="radio"
                      name="resetTarget"
                      value="normal"
                      checked={resetTarget === 'normal'}
                      onChange={() => setResetTarget('normal')}
                      className="text-blue-600 focus:ring-blue-500 cursor-pointer"
                    />
                    <div>
                      <span className="text-xs font-bold block text-blue-300">Apenas Fila Normal</span>
                      <span className="text-[11px] text-slate-400 block">Reinicia para 001. A preferencial ({nextPriority}) não altera.</span>
                    </div>
                  </div>
                </label>

                <label
                  className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition ${
                    resetTarget === 'priority'
                      ? 'border-amber-500 bg-amber-950/40 text-white shadow-xs'
                      : 'border-slate-700 bg-slate-900/60 text-slate-300 hover:bg-slate-900'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="radio"
                      name="resetTarget"
                      value="priority"
                      checked={resetTarget === 'priority'}
                      onChange={() => setResetTarget('priority')}
                      className="text-amber-500 focus:ring-amber-500 cursor-pointer"
                    />
                    <div>
                      <span className="text-xs font-bold block text-amber-300">Apenas Fila Preferencial</span>
                      <span className="text-[11px] text-slate-400 block">Reinicia para P001. A normal ({nextNormal}) não altera.</span>
                    </div>
                  </div>
                </label>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-700">
              <button
                type="button"
                onClick={() => setIsResetModalOpen(false)}
                className="px-4 py-2.5 rounded-lg border border-slate-600 bg-slate-700 text-xs font-bold uppercase tracking-wider text-slate-300 hover:text-white hover:bg-slate-600 transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleResetTicketCounter}
                className="px-5 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider text-white bg-amber-600 hover:bg-amber-500 transition cursor-pointer shadow-sm"
              >
                Confirmar Reinício
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
