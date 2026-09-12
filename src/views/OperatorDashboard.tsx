import React, { useState, useEffect } from 'react';
import { BellRing, Stethoscope } from 'lucide-react';
import { ReceptionDashboard } from './ReceptionDashboard';
import { ConsultorioDashboard } from './ConsultorioDashboard';

export { ReceptionDashboard } from './ReceptionDashboard';
export { ConsultorioDashboard } from './ConsultorioDashboard';

interface OperatorDashboardProps {
  showToast: (type: 'success' | 'error' | 'info', message: string) => void;
  onOpenPlayerSimulation?: (code: string) => void;
  operatorType?: 'reception' | 'consultorio';
}

export const OperatorDashboard: React.FC<OperatorDashboardProps> = ({
  showToast,
  onOpenPlayerSimulation,
  operatorType = 'reception',
}) => {
  const [activeModule, setActiveModule] = useState<'reception' | 'consultorio'>(() => {
    try {
      const saved = localStorage.getItem('indoor_operator_active_module');
      if (saved === 'reception' || saved === 'consultorio') return saved;
    } catch {}
    return operatorType === 'consultorio' ? 'consultorio' : 'reception';
  });

  useEffect(() => {
    if (operatorType) {
      setActiveModule(operatorType);
    }
  }, [operatorType]);

  const handleSwitchModule = (mod: 'reception' | 'consultorio') => {
    setActiveModule(mod);
    try {
      localStorage.setItem('indoor_operator_active_module', mod);
    } catch {}
  };

  return (
    <div className="w-full">
      {/* SELETOR SUPERIOR DE MÓDULO CLÍNICO: RECEPÇÃO (GUICHÊ) x CONSULTÓRIO */}
      <div className="bg-slate-900/90 border-b border-slate-800 px-4 py-2.5">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-[11px] uppercase font-bold text-slate-400 tracking-wider">
              Módulo do Operador:
            </span>
            <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800">
              {/* Botão Recepção (Guichê) */}
              <button
                type="button"
                id="btn-switch-module-reception"
                onClick={() => handleSwitchModule('reception')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  activeModule === 'reception'
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-900/40'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <BellRing className="h-3.5 w-3.5" />
                <span>Recepção (Guichê Automático)</span>
              </button>

              {/* Botão Consultório */}
              <button
                type="button"
                id="btn-switch-module-consultorio"
                onClick={() => handleSwitchModule('consultorio')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  activeModule === 'consultorio'
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-900/40'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <Stethoscope className="h-3.5 w-3.5" />
                <span>Consultório (Digitar Senha)</span>
              </button>
            </div>
          </div>

          <span className="text-[11px] text-slate-500 font-medium">
            {activeModule === 'reception'
              ? 'Senhas sequenciais 001 a 999 geradas automaticamente'
              : 'Digite a senha do paciente individualmente'}
          </span>
        </div>
      </div>

      {/* RENDERIZA O DASHBOARD DO MÓDULO SELECIONADO */}
      {activeModule === 'reception' ? (
        <ReceptionDashboard
          showToast={showToast}
          onOpenPlayerSimulation={onOpenPlayerSimulation}
        />
      ) : (
        <ConsultorioDashboard
          showToast={showToast}
          onOpenPlayerSimulation={onOpenPlayerSimulation}
        />
      )}
    </div>
  );
};
