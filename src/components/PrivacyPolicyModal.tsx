import React, { useEffect } from "react";
import { Shield, X, Lock, FileText, CheckCircle2, UserCheck, Bell, Scale, Cpu } from "lucide-react";
import { motion } from "motion/react";

interface PrivacyPolicyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function PrivacyPolicyModal({ isOpen, onClose }: PrivacyPolicyModalProps) {
  // Fechar no ESC para acessibilidade
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div 
      role="dialog" 
      aria-modal="true" 
      aria-labelledby="privacy-policy-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-4xl bg-zinc-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden my-6 text-white"
      >
        {/* Header */}
        <div className="p-6 border-b border-white/10 flex items-center justify-between bg-zinc-950/70">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-yellow-500/10 border border-yellow-500/30 flex items-center justify-center text-yellow-500">
              <Shield className="w-6 h-6" aria-hidden="true" />
            </div>
            <div>
              <h2 id="privacy-policy-title" className="text-xl font-bold tracking-tight">
                Política de Privacidade, Proteção de Dados & Diretrizes LGPD
              </h2>
              <p className="text-xs text-zinc-400">
                Segurança Operacional de EPIs Inteligentes • Lei Geral de Proteção de Dados (Lei nº 13.709/2018)
              </p>
            </div>
          </div>
          
          <button 
            onClick={onClose}
            className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
            aria-label="Fechar modal de política de privacidade"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content with Smooth Scrolling */}
        <div className="p-6 md:p-8 space-y-6 text-xs text-zinc-300 max-h-[70vh] overflow-y-auto custom-scrollbar leading-relaxed">
          {/* Introdução & Bases Legais */}
          <section className="space-y-2">
            <div className="flex items-center gap-2 text-yellow-400 font-bold text-sm uppercase tracking-wider">
              <Scale className="w-4 h-4" />
              <h3>1. Fundamentação Legal e Finalidade do Sistema</h3>
            </div>
            <p>
              O <strong>Industrial Safety Monitor (ISM)</strong> é uma plataforma dedicada à preservação da vida e incolumidade física de trabalhadores industriais mediante uso de Capacetes de Segurança Inteligentes instrumentados com microcontrolador ESP32 e sensores telemétricos (acelerometria, vibração, ruído e geoposicionamento).
            </p>
            <p>
              O tratamento de dados pessoais de funcionários e operadores apoia-se estritamente nas seguintes bases legais estabelecidas no <strong>Art. 7º da LGPD (Lei nº 13.709/2018)</strong>:
            </p>
            <ul className="list-disc pl-5 space-y-1 text-zinc-300">
              <li><strong>Inciso II — Cumprimento de Obrigação Legal ou Regulatória:</strong> Aplicação das Normas Regulamentadoras do Ministério do Trabalho e Emprego, em especial a <strong>NR-06 (Equipamentos de Proteção Individual - EPI)</strong> e <strong>NR-12 (Segurança no Trabalho em Máquinas e Equipamentos)</strong>.</li>
              <li><strong>Inciso IX — Proteção da Vida ou da Incolumidade Física do Titular ou de Terceiros:</strong> Detecção imediata de quedas bruscas, impactos mecânicos superiores a 4G e emissão de alertas de socorro em tempo real.</li>
              <li><strong>Inciso I — Consentimento e Legítimo Interesse:</strong> Gestão de credenciais de usuários e perfis administrativos (RBAC) do Centro de Operações Industriais (COI).</li>
            </ul>
          </section>

          {/* Dados Tratados */}
          <section className="space-y-2">
            <div className="flex items-center gap-2 text-yellow-400 font-bold text-sm uppercase tracking-wider">
              <Cpu className="w-4 h-4" />
              <h3>2. Dados Coletados e Princípio da Minimização</h3>
            </div>
            <p>
              Em obediência ao princípio da necessidade (Art. 6º, III), o sistema coleta unicamente os dados indispensáveis ao monitoramento de segurança:
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
              <div className="p-3 rounded-xl bg-zinc-950/60 border border-white/5">
                <strong className="text-white block mb-1">Dados Telemétricos do Hardware (ESP32)</strong>
                <p className="text-[11px] text-zinc-400">Aceleração instantânea (MPU6050), pico em Força G, pontuação ponderada de risco, indicação booleana de vibração e nível sonoro, além de coordenadas GNSS/GPS para localização em caso de sinistro.</p>
              </div>
              <div className="p-3 rounded-xl bg-zinc-950/60 border border-white/5">
                <strong className="text-white block mb-1">Dados Cadastrais de Operadores e Usuários</strong>
                <p className="text-[11px] text-zinc-400">Nome completo, matrícula, turno de trabalho, contato de emergência e nível de privilégio no sistema (Master, Admin Empresa ou Visualizador). O CPF é armazenado de forma protegida e mascarado para operadores não autorizados.</p>
              </div>
            </div>
          </section>

          {/* Cibersegurança & Armazenamento */}
          <section className="space-y-2">
            <div className="flex items-center gap-2 text-yellow-400 font-bold text-sm uppercase tracking-wider">
              <Lock className="w-4 h-4" />
              <h3>3. Segurança da Informação e Criptografia</h3>
            </div>
            <p>
              Em estrita conformidade com o <strong>Art. 46 da LGPD</strong>, aplicamos medidas técnicas e administrativas aptas a proteger os dados contra acessos não autorizados:
            </p>
            <ul className="list-disc pl-5 space-y-1 text-zinc-300">
              <li><strong>Criptografia de Senhas:</strong> Todas as senhas de acesso passam por algoritmo criptográfico com Salt único (SHA-256 / Web Crypto API), impedindo armazenamento de credenciais em texto puro.</li>
              <li><strong>Controle de Acesso Baseado em Papéis (RBAC):</strong> Usuários com perfil <em>Viewer</em> têm acesso estritamente restrito para leitura de telemetria sem privilégios de alteração. Perfis <em>Company Admin</em> e <em>Master</em> possuem restrições auditadas.</li>
              <li><strong>Proteção do Tráfego:</strong> Comunicação bidirecional segura com o banco de dados PostgreSQL do Supabase e conexões via WebSocket com suporte a TLS/SSL.</li>
            </ul>
          </section>

          {/* Direitos do Titular */}
          <section className="space-y-2">
            <div className="flex items-center gap-2 text-yellow-400 font-bold text-sm uppercase tracking-wider">
              <UserCheck className="w-4 h-4" />
              <h3>4. Direitos dos Titulares de Dados (Art. 18 da LGPD)</h3>
            </div>
            <p>
              O trabalhador ou operador cadastrado no sistema tem direito a solicitar a qualquer momento ao Encarregado de Proteção de Dados (DPO / SESMT):
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-2 text-center">
              <div className="p-2.5 rounded-xl bg-zinc-950/60 border border-white/5">
                <span className="font-bold text-white block">Confirmação & Acesso</span>
                <span className="text-[10px] text-zinc-400">Verificação de quais dados e telemetrias estão vinculados ao seu registro</span>
              </div>
              <div className="p-2.5 rounded-xl bg-zinc-950/60 border border-white/5">
                <span className="font-bold text-white block">Correção de Dados</span>
                <span className="text-[10px] text-zinc-400">Atualização de telefone de emergência, turno ou matrícula</span>
              </div>
              <div className="p-2.5 rounded-xl bg-zinc-950/60 border border-white/5">
                <span className="font-bold text-white block">Transparência & Laudo</span>
                <span className="text-[10px] text-zinc-400">Emissão do laudo técnico de conformidade com normas regulamentadoras</span>
              </div>
            </div>
          </section>

          {/* Acessibilidade Web */}
          <section className="space-y-2">
            <div className="flex items-center gap-2 text-yellow-400 font-bold text-sm uppercase tracking-wider">
              <Bell className="w-4 h-4" />
              <h3>5. Acessibilidade Web (WCAG 2.1 e eMAG)</h3>
            </div>
            <p>
              A interface do Safety Monitor foi construída seguindo as diretrizes internacionais de acessibilidade <strong>Web Content Accessibility Guidelines (WCAG 2.1 nível AA)</strong> e o Modelo de Acessibilidade em Governo Eletrônico (eMAG), contemplando alto contraste visual para ambientes industriais, suporte a leitores de tela com regiões vivas (<code>aria-live</code>) para anúncios instantâneos de acidentes e navegabilidade plena por teclado.
            </p>
          </section>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-white/10 bg-zinc-950/70 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-zinc-400 text-[11px]">
            <CheckCircle2 className="w-4 h-4 text-green-500" />
            <span>Documento em vigor • Última revisão: 2026</span>
          </div>
          <button
            onClick={onClose}
            className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-yellow-500 hover:bg-yellow-400 text-zinc-950 font-bold text-xs uppercase tracking-wider shadow-lg transition-all"
          >
            Entendido e Conforme
          </button>
        </div>
      </motion.div>
    </div>
  );
}
