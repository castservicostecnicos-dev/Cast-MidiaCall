import React, { useState, useEffect, useRef } from 'react';
import {
  Stethoscope,
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
  Keyboard,
  Hash,
  History,
} from 'lucide-react';
import { api } from '../lib/api';
import { PlayerDiagnosticView, DiagnosticPlayerData } from '../components/PlayerDiagnosticView';

interface ConsultorioDashboardProps {
  showToast: (type: 'success' | 'error' | 'info', message: string) => void;
  onOpenPlayerSimulation?: (code: string) => void;
}

export const ConsultorioDashboard: React.FC<ConsultorioDashboardProps> = ({
  showToast,
  onOpenPlayerSimulation,
}) => {
  // Tabs: 'calls' | 'diagnostic'
  const [activeTab, setActiveTab] = useState<'calls' | 'diagnostic'>('calls');

  const [players, setPlayers] = useState<DiagnosticPlayerData[]>([]);

  // Persistent Player selection via localStorage
  const [selectedPlayerId, setSelectedPlayerId] = useState<string>(() => {
    try {
      return localStorage.getItem('indoor_consultorio_player_id') || localStorage.getItem('indoor_op_player_id') || '';
    } catch {
      return '';
    }
  });

  // Target for deep diagnosis
  const [diagnosticPlayerId, setDiagnosticPlayerId] = useState<string>('');

  // 1. CAMPO SEPARADO PARA A SENHA DO PACIENTE
  const [ticketInput, setTicketInput] = useState<string>('');

  // 2. CAMPO SEPARADO PARA A FRASE / IDENTIFICAÇÃO DO CONSULTÓRIO (FIXO)
  const [callText, setCallText] = useState<string>(() => {
    try {
      return (
        localStorage.getItem('indoor_consultorio_call_text') ||
        'Consultório 01 - Por favor entrar'
      );
    } catch {
      return 'Consultório 01 - Por favor entrar';
    }
  });

  // Recent called tickets in this session for fast re-calling
  const [recentTickets, setRecentTickets] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('indoor_consultorio_recent_tickets');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [isPriority, setIsPriority] = useState<boolean>(false);
  const [duration, setDuration] = useState<number>(10);
  const [isCalling, setIsCalling] = useState<boolean>(false);
  const [lastCallDelivered, setLastCallDelivered] = useState<boolean | null>(null);
  const [lastCallTime, setLastCallTime] = useState<string | null>(null);
  const [lastCalledDisplay, setLastCalledDisplay] = useState<string | null>(null);

  const ticketInputRef = useRef<HTMLInputElement>(null);

  // Sync fixed phrase and chosen player persistently in localStorage
  useEffect(() => {
    try {
      if (callText !== undefined) {
        localStorage.setItem('indoor_consultorio_call_text', callText);
      }
      if (selectedPlayerId) {
        localStorage.setItem('indoor_consultorio_player_id', selectedPlayerId);
      }
    } catch {}
  }, [callText, selectedPlayerId]);

  const loadData = async () => {
    try {
      const res = await api.getOperatorDashboard();
      setPlayers(res.players);
      if (res.players.length > 0 && !selectedPlayerId) {
        setSelectedPlayerId(res.players[0].id);
      }
    } catch (err: any) {
      showToast('error', err.message || 'Erro ao carregar dados do consultório.');
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(() => {
      api.getOperatorDashboard()
        .then((res) => setPlayers(res.players))
        .catch(() => {});
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleTriggerCall = async (overridePriority?: boolean) => {
    if (!selectedPlayerId) {
      showToast('error', 'Selecione um player de exibição.');
      return;
    }

    const cleanTicket = ticketInput.trim();
    if (!cleanTicket) {
      showToast('error', 'Digite a senha do paciente a ser chamado no consultório.');
      ticketInputRef.current?.focus();
      return;
    }

    const priorityToSend = overridePriority !== undefined ? overridePriority : isPriority;
    setIsCalling(true);
    try {
      const res = await api.triggerCall({
        playerId: selectedPlayerId,
        phrase: callText.trim(),
        ticket: cleanTicket,
        duration,
        isPriority: priorityToSend,
        callSource: 'consultorio',
      });

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
      setLastCalledDisplay(res.call.phrase);

      // Save to recent tickets
      setRecentTickets((prev) => {
        const next = [cleanTicket, ...prev.filter((t) => t !== cleanTicket)].slice(0, 6);
        try {
          localStorage.setItem('indoor_consultorio_recent_tickets', JSON.stringify(next));
        } catch {}
        return next;
      });

      showToast(
        'success',
        priorityToSend
          ? `Chamada PREFERENCIAL enviada para a TV: ${res.call.phrase}`
          : `Chamada enviada com sucesso: ${res.call.phrase}`
      );
    } catch (err: any) {
      showToast('error', err.message || 'Falha ao enviar chamada do consultório.');
    } finally {
      setIsCalling(false);
    }
  };

  const triggerCallRef = useRef(handleTriggerCall);
  useEffect(() => {
    triggerCallRef.current = handleTriggerCall;
  });

  // Global Keyboard shortcuts: [N] for Normal, [P] for Priority when outside inputs
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

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
      {/* NAVEGAÇÃO POR ABAS: CONSULTÓRIO x DIAGNÓSTICO */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-700 pb-4 mb-6">
        <div className="flex items-center gap-2 bg-slate-900/80 p-1.5 rounded-xl border border-slate-800">
          <button
            type="button"
            id="tab-consultorio-calls"
            onClick={() => setActiveTab('calls')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition cursor-pointer ${
              activeTab === 'calls'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-900/40'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Stethoscope className="h-4 w-4" />
            <span>Consultório (Atendimento Médico)</span>
          </button>

          <button
            type="button"
            id="tab-consultorio-diagnostic"
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
            title="Atualizar status dos players"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white border border-slate-700 text-xs font-semibold cursor-pointer transition shadow-xs"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span className="hidden xs:inline">Atualizar</span>
          </button>
        </div>
      </div>

      {activeTab === 'calls' && (
        <div className="space-y-5 animate-in fade-in duration-150">
          {/* BANNER EXPLICATIVO DO CONSULTÓRIO */}
          <div className="rounded-2xl border border-blue-600/40 bg-gradient-to-r from-blue-950/50 via-slate-900 to-slate-900 p-4 sm:p-5 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-xl bg-blue-500/20 text-blue-400 shrink-0 mt-0.5">
                <Stethoscope className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-bold text-white tracking-wide">
                  Terminal de Chamada do Consultório
                </h3>
                <p className="text-xs text-slate-300 mt-0.5 leading-relaxed">
                  Digite a <strong>senha do paciente</strong> que aguarda na sala de espera. O sistema anexará automaticamente o número da senha à identificação do seu consultório e disparará na tela da TV.
                </p>
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

          {/* 2. CAMPOS SEPARADOS: SENHA (CAMPO 1) E IDENTIFICAÇÃO DO CONSULTÓRIO (CAMPO 2) */}
          <div className="rounded-xl border border-slate-700 bg-slate-800 p-5 shadow-sm space-y-4">
            {/* CAMPO 1: SENHA DO PACIENTE (DIGITADO SEPARADAMENTE) */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-black uppercase tracking-widest text-amber-400 flex items-center gap-1.5">
                  <Hash className="h-4 w-4 text-amber-400" />
                  <span>2. Senha do Paciente (Campo Separado) *</span>
                </label>

                {ticketInput && (
                  <button
                    type="button"
                    onClick={() => {
                      setTicketInput('');
                      ticketInputRef.current?.focus();
                    }}
                    className="text-[11px] text-slate-400 hover:text-rose-400 underline cursor-pointer flex items-center gap-1"
                  >
                    <RotateCcw className="h-3 w-3" />
                    Limpar Senha
                  </button>
                )}
              </div>

              <div className="relative">
                <input
                  ref={ticketInputRef}
                  id="input-consultorio-ticket"
                  type="text"
                  value={ticketInput}
                  onChange={(e) => setTicketInput(e.target.value.toUpperCase())}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleTriggerCall(false);
                    }
                  }}
                  placeholder="Ex: 001, N015, P003, 042..."
                  autoFocus
                  className="w-full rounded-xl border-2 border-amber-500/80 bg-slate-950 px-5 py-3.5 text-2xl font-mono font-black text-amber-300 placeholder-slate-600 focus:border-amber-400 focus:ring-2 focus:ring-amber-500/30 focus:outline-none transition tracking-wider shadow-inner"
                />
              </div>

              {/* Histórico rápido de senhas recentes chamadas pelo consultório */}
              {recentTickets.length > 0 && (
                <div className="mt-2.5 flex items-center gap-2 flex-wrap text-[11px] text-slate-400">
                  <span className="flex items-center gap-1 text-slate-400">
                    <History className="h-3 w-3 text-slate-500" />
                    Senhas Recentes:
                  </span>
                  {recentTickets.map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => {
                        setTicketInput(t);
                        ticketInputRef.current?.focus();
                      }}
                      className="px-2 py-0.5 rounded-md bg-slate-900 hover:bg-slate-700 text-amber-300 font-mono font-bold border border-slate-700 cursor-pointer transition"
                    >
                      {t}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* CAMPO 2: FRASE / IDENTIFICAÇÃO DO CONSULTÓRIO (FIXO E SEPARADO) */}
            <div className="pt-2 border-t border-slate-700/80">
              <div className="flex items-center justify-between mb-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
                  <Sparkles className="h-4 w-4 text-blue-400" />
                  <span>3. Identificação do Consultório (Frase Fixa)</span>
                </label>

                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 rounded-md bg-blue-950/90 border border-blue-700/80 px-2 py-0.5 text-[11px] font-bold text-blue-300">
                    <Pin className="h-3 w-3 text-blue-400" />
                    Frase Salva
                  </span>
                  {callText && (
                    <button
                      type="button"
                      onClick={() => setCallText('Consultório 01 - Por favor entrar')}
                      className="text-[11px] text-slate-400 hover:text-white underline cursor-pointer"
                      title="Restaurar padrão"
                    >
                      Padrão
                    </button>
                  )}
                </div>
              </div>

              <input
                id="input-consultorio-phrase"
                type="text"
                value={callText}
                onChange={(e) => setCallText(e.target.value)}
                placeholder="Ex: Consultório 01 - Dr. Roberto / Sala 03 - Triagem..."
                className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white placeholder-slate-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none transition shadow-inner"
              />
            </div>

            {/* Visualização de Prévia na TV */}
            <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-700/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
              <span className="text-slate-400 font-medium">Visualização da Chamada na TV:</span>
              <div className="font-mono font-bold text-white bg-slate-950 px-3.5 py-1.5 rounded-lg border border-slate-700 text-sm">
                {ticketInput.trim() ? (
                  <>
                    Senha <span className="text-amber-300">{ticketInput.trim()}</span> - {callText.trim() || 'Consultório'}
                  </>
                ) : (
                  <span className="text-slate-500 font-normal italic">
                    (Digite a senha acima para visualizar a chamada combinada)
                  </span>
                )}
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
                    <span>Atendimento Preferencial</span>
                    {isPriority && (
                      <span className="bg-amber-500 text-slate-950 text-[9px] font-black px-1.5 py-0.2 rounded uppercase">
                        Ativa
                      </span>
                    )}
                  </h4>
                  <p className="text-[11px] text-amber-300/80">
                    Destaque dourado e alerta sonoro de prioridade na tela da TV
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

          {/* 3. BOTÕES DE DISPARO DA CHAMADA */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl bg-slate-900/80 border border-slate-800 text-xs text-slate-400 shadow-inner">
              <div className="flex items-center gap-2">
                <Keyboard className="h-4 w-4 text-blue-400 shrink-0" />
                <span className="font-semibold text-slate-300">
                  Dica de Atalho:
                </span>
              </div>
              <div className="flex items-center gap-2 font-mono text-[11px]">
                <span className="text-slate-400">
                  Pressione <kbd className="font-bold text-white bg-slate-800 px-1.5 py-0.5 rounded border border-slate-600">Enter</kbd> no campo da senha para chamar
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Botão Chamar Normal */}
              <button
                id="btn-consultorio-call-normal"
                type="button"
                disabled={isCalling || !ticketInput.trim() || !selectedPlayerId}
                onClick={() => handleTriggerCall(false)}
                className="flex items-center justify-between gap-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 py-4 px-5 text-xs sm:text-sm font-extrabold uppercase tracking-wider text-white shadow-lg shadow-blue-900/40 focus:ring-2 focus:ring-blue-500/50 transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed group"
                title="Chamar paciente para o consultório"
              >
                <div className="flex items-center gap-2.5">
                  <Send className="h-4 w-4 shrink-0" />
                  <span>
                    {isCalling
                      ? 'Enviando chamada...'
                      : ticketInput.trim()
                      ? `[ CHAMAR SENHA ${ticketInput.trim()} ]`
                      : '[ CHAMAR NORMAL ]'}
                  </span>
                </div>
                <span className="shrink-0 flex items-center gap-1 bg-blue-700/90 border border-blue-400/40 px-2.5 py-1 rounded-md text-[11px] font-mono font-bold tracking-normal text-blue-100 shadow-inner group-hover:bg-blue-800 transition">
                  <Keyboard className="h-3 w-3" />
                  Enter
                </span>
              </button>

              {/* Botão Chamar Preferencial */}
              <button
                id="btn-consultorio-call-priority"
                type="button"
                disabled={isCalling || !ticketInput.trim() || !selectedPlayerId}
                onClick={() => handleTriggerCall(true)}
                className="flex items-center justify-between gap-2.5 rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 py-4 px-5 text-xs sm:text-sm font-black uppercase tracking-wider text-slate-950 shadow-lg shadow-amber-950/50 transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed group"
                title="Chamar paciente preferencial para o consultório"
              >
                <div className="flex items-center gap-2.5">
                  <Star className="h-4 w-4 fill-slate-950 shrink-0" />
                  <span>
                    {isCalling
                      ? 'Enviando chamada...'
                      : ticketInput.trim()
                      ? `[ PREFERENCIAL: ${ticketInput.trim()} ]`
                      : '[ CHAMAR PREFERENCIAL ]'}
                  </span>
                </div>
                <span className="shrink-0 flex items-center gap-1 bg-amber-700/80 border border-slate-950/40 px-2.5 py-1 rounded-md text-[11px] font-mono font-black tracking-normal text-slate-950 shadow-inner group-hover:bg-amber-800/80 transition">
                  <Keyboard className="h-3 w-3" />
                  Prioritário
                </span>
              </button>
            </div>

            {/* Confirmação de Envio */}
            {lastCallDelivered !== null && (
              <div className="mt-2 text-center text-xs font-medium text-emerald-400 flex items-center justify-center gap-2 bg-emerald-950/30 border border-emerald-900/50 py-2.5 px-4 rounded-xl">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>
                  Chamada <strong>{lastCalledDisplay}</strong> transmitida com sucesso para o player {selectedPlayer ? `(${selectedPlayer.name})` : ''} às {lastCallTime}.
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
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Consultório</span>
              <p className="text-xl font-black text-blue-400 mt-0.5 truncate">{callText.split('-')[0].trim()}</p>
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
    </div>
  );
};
