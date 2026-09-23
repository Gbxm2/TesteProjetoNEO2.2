import React, { useState, useEffect } from "react";
import { ShieldCheck, Cookie, Settings, Check, X, FileText, ChevronRight } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface CookieConsentBannerProps {
  onOpenPrivacyPolicy: () => void;
}

export interface CookiePreferences {
  essential: boolean; // Sempre true (segurança, sessão, WebSocket/Supabase)
  telemetry: boolean; // Sensores ESP32 e telemetria de integridade física
  analytics: boolean; // Métricas de desempenho do painel
}

const STORAGE_KEY = "ism_cookie_consent_v1";

export default function CookieConsentBanner({ onOpenPrivacyPolicy }: CookieConsentBannerProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [showPreferences, setShowPreferences] = useState(false);
  const [preferences, setPreferences] = useState<CookiePreferences>({
    essential: true,
    telemetry: true,
    analytics: false
  });

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) {
        // Exibe após 1 segundo para entrada suave
        const timer = setTimeout(() => setIsVisible(true), 1000);
        return () => clearTimeout(timer);
      }
    } catch {
      // Ignora erro em ambientes com cookies desabilitados
    }
  }, []);

  const handleAcceptAll = () => {
    const allAccepted: CookiePreferences = {
      essential: true,
      telemetry: true,
      analytics: true
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(allAccepted));
    } catch {}
    setIsVisible(false);
  };

  const handleAcceptEssentialOnly = () => {
    const essentialOnly: CookiePreferences = {
      essential: true,
      telemetry: true, // Necessário para funcionamento da proteção e normas NR-06/NR-12
      analytics: false
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(essentialOnly));
    } catch {}
    setIsVisible(false);
  };

  const handleSaveCustom = () => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
    } catch {}
    setIsVisible(false);
    setShowPreferences(false);
  };

  if (!isVisible) return null;

  return (
    <AnimatePresence>
      <div 
        role="region" 
        aria-label="Aviso de Privacidade e Gestão de Cookies"
        className="fixed bottom-4 left-4 right-4 md:left-8 md:right-8 lg:max-w-3xl lg:left-auto z-50 pointer-events-auto"
      >
        <motion.div
          initial={{ opacity: 0, y: 30, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.98 }}
          transition={{ duration: 0.3 }}
          className="bg-zinc-900/95 backdrop-blur-xl border border-yellow-500/30 rounded-2xl p-5 md:p-6 shadow-2xl shadow-black/80 text-white"
        >
          {!showPreferences ? (
            <div className="flex flex-col gap-4">
              <div className="flex items-start gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-yellow-500/10 border border-yellow-500/30 flex items-center justify-center shrink-0 text-yellow-500 mt-0.5">
                  <Cookie className="w-5 h-5" aria-hidden="true" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-sm font-bold text-white tracking-wide flex items-center gap-1.5">
                      Privacidade, Cookies & Conformidade LGPD
                    </h3>
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-yellow-500/10 text-yellow-400 border border-yellow-500/30 hidden sm:inline-block">
                      Lei 13.709/2018
                    </span>
                  </div>
                  <p className="text-xs text-zinc-300 leading-relaxed">
                    Utilizamos cookies essenciais e dados de telemetria operacional com base legal no cumprimento de dever de segurança (NR-06, NR-12 e CLT) para garantir a integridade física e o monitoramento em tempo real dos trabalhadores.
                  </p>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-white/5">
                <button
                  onClick={onOpenPrivacyPolicy}
                  className="text-xs text-zinc-400 hover:text-yellow-400 underline underline-offset-4 flex items-center gap-1 transition-colors self-start sm:self-center"
                  aria-label="Ler Política de Privacidade e Proteção de Dados completa"
                >
                  <FileText className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Ler Política de Privacidade</span>
                </button>

                <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                  <button
                    onClick={() => setShowPreferences(true)}
                    className="px-3 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold transition-colors flex items-center gap-1.5"
                    aria-label="Personalizar preferências de cookies"
                  >
                    <Settings className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Preferências</span>
                  </button>
                  <button
                    onClick={handleAcceptEssentialOnly}
                    className="px-3 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold transition-colors"
                  >
                    Apenas Essenciais
                  </button>
                  <button
                    onClick={handleAcceptAll}
                    className="px-4 py-2 rounded-xl bg-yellow-500 hover:bg-yellow-400 text-zinc-950 font-bold text-xs shadow-lg shadow-yellow-500/20 transition-all active:scale-95"
                  >
                    Aceitar Todos
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* Painel de Preferências Detalhado */
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-yellow-500" aria-hidden="true" />
                  <h4 className="text-sm font-bold text-white">Preferências de Tratamento de Dados</h4>
                </div>
                <button 
                  onClick={() => setShowPreferences(false)}
                  className="text-zinc-400 hover:text-white p-1"
                  aria-label="Voltar para visão simplificada"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3 text-xs max-h-56 overflow-y-auto pr-1">
                {/* Essenciais */}
                <div className="p-3 bg-zinc-950/60 rounded-xl border border-white/5 flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-bold text-white">Cookies Essenciais de Sessão & RBAC</span>
                      <span className="text-[9px] px-1.5 py-0.2 rounded bg-yellow-500/20 text-yellow-400 font-mono uppercase">Obrigatório</span>
                    </div>
                    <p className="text-zinc-400 text-[11px]">
                      Necessários para manter a autenticação segura, permissões de acesso e conexão em tempo real com o banco Supabase.
                    </p>
                  </div>
                  <input 
                    type="checkbox" 
                    checked={true} 
                    disabled 
                    className="w-4 h-4 mt-1 accent-yellow-500 rounded cursor-not-allowed opacity-75"
                    aria-label="Cookies essenciais obrigatórios"
                  />
                </div>

                {/* Telemetria */}
                <div className="p-3 bg-zinc-950/60 rounded-xl border border-white/5 flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-bold text-white">Telemetria de Segurança Operacional (EPI)</span>
                      <span className="text-[9px] px-1.5 py-0.2 rounded bg-green-500/20 text-green-400 font-mono uppercase">Recomendado</span>
                    </div>
                    <p className="text-zinc-400 text-[11px]">
                      Trata dados de geolocalização e aceleração do ESP32 para conformidade com a NR-06 e disparo de emergências de impacto.
                    </p>
                  </div>
                  <input 
                    type="checkbox" 
                    checked={preferences.telemetry} 
                    onChange={(e) => setPreferences({ ...preferences, telemetry: e.target.checked })}
                    className="w-4 h-4 mt-1 accent-yellow-500 rounded cursor-pointer"
                    aria-label="Permitir telemetria operacional dos capacetes"
                  />
                </div>

                {/* Analíticos */}
                <div className="p-3 bg-zinc-950/60 rounded-xl border border-white/5 flex items-start justify-between gap-3">
                  <div>
                    <span className="font-bold text-white block mb-1">Métricas de Otimização da Interface</span>
                    <p className="text-zinc-400 text-[11px]">
                      Coleta anônima de desempenho da renderização gráfica do mapa e latência de rede.
                    </p>
                  </div>
                  <input 
                    type="checkbox" 
                    checked={preferences.analytics} 
                    onChange={(e) => setPreferences({ ...preferences, analytics: e.target.checked })}
                    className="w-4 h-4 mt-1 accent-yellow-500 rounded cursor-pointer"
                    aria-label="Permitir métricas analíticas anônimas"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-white/5">
                <button
                  onClick={() => setShowPreferences(false)}
                  className="px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSaveCustom}
                  className="px-4 py-1.5 rounded-xl bg-yellow-500 hover:bg-yellow-400 text-zinc-950 font-bold text-xs shadow-lg transition-all"
                >
                  Salvar Minhas Escolhas
                </button>
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
