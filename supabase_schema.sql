-- ============================================================
-- INDUSTRIAL SAFETY MONITOR - SCHEMA SUPABASE (POSTGRESQL)
-- Trabalho de Conclusão de Curso (TCC)
-- Sistema de Monitoramento em Tempo Real com Capacetes Inteligentes (ESP32)
-- ============================================================

-- Habilitar extensões úteis
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. TABELA DE EMPRESAS
CREATE TABLE IF NOT EXISTS companies (
    id TEXT PRIMARY KEY DEFAULT ('COMP-' || substr(md5(random()::text), 1, 8)),
    name TEXT NOT NULL,
    cnpj TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. TABELA DE USUÁRIOS E CONTROLE DE ACESSO (RBAC)
-- Perfis: 'MASTER' (Admin Geral), 'COMPANY_ADMIN' (Gestor da Empresa), 'VIEWER' (Somente Leitura)
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY DEFAULT ('USR-' || substr(md5(random()::text), 1, 8)),
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('MASTER', 'COMPANY_ADMIN', 'VIEWER')),
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    cpf TEXT,
    position TEXT,
    department TEXT,
    email TEXT,
    phone TEXT,
    company_id TEXT REFERENCES companies(id) ON DELETE SET NULL,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. TABELA DE CAPACETES INTELIGENTES (DISPOSITIVOS IOT / ESP32)
CREATE TABLE IF NOT EXISTS helmets (
    id TEXT PRIMARY KEY,
    serial_number TEXT UNIQUE NOT NULL,
    mac_address TEXT,
    firmware_version TEXT DEFAULT 'v1.0.4',
    battery INTEGER DEFAULT 100 CHECK (battery >= 0 AND battery <= 100),
    status TEXT DEFAULT 'AVAILABLE' CHECK (status IN ('AVAILABLE', 'IN_USE', 'MAINTENANCE', 'INACTIVE')),
    last_calibration TIMESTAMPTZ,
    next_inspection TIMESTAMPTZ,
    assigned_employee_id TEXT,
    company_id TEXT REFERENCES companies(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. TABELA DE FUNCIONÁRIOS / OPERADORES DE CAMPO
CREATE TABLE IF NOT EXISTS employees (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    cpf TEXT,
    matricula TEXT,
    role_function TEXT,
    department TEXT,
    shift TEXT,
    emergency_contact TEXT,
    status TEXT DEFAULT 'OFFLINE' CHECK (status IN ('ONLINE', 'OFFLINE', 'EMERGENCY', 'UNSTABLE', 'INACTIVE')),
    lat DOUBLE PRECISION DEFAULT -23.5505,
    lng DOUBLE PRECISION DEFAULT -46.6333,
    last_seen BIGINT DEFAULT 0,
    battery INTEGER DEFAULT 100,
    assigned_helmet_id TEXT REFERENCES helmets(id) ON DELETE SET NULL,
    company_id TEXT REFERENCES companies(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. TABELA DE TELEMETRIA E HISTÓRICO DE SENSORES (MPU6050, SW-420, FC-04, NEO-6M)
CREATE TABLE IF NOT EXISTS telemetry_logs (
    id BIGSERIAL PRIMARY KEY,
    helmet_id TEXT,
    employee_id TEXT,
    aceleracao DOUBLE PRECISION DEFAULT 0.0,
    aceleracao_g DOUBLE PRECISION DEFAULT 1.0,
    pico_g DOUBLE PRECISION DEFAULT 1.0,
    pontuacao INTEGER DEFAULT 0,
    vibracao BOOLEAN DEFAULT FALSE,
    som BOOLEAN DEFAULT FALSE,
    gps_valido BOOLEAN DEFAULT FALSE,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    altitude DOUBLE PRECISION DEFAULT 0.0,
    satelites INTEGER DEFAULT 0,
    ip_origem TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. TABELA DE EVENTOS DE ACIDENTES / ALERTAS DE IMPACTO
CREATE TABLE IF NOT EXISTS accident_events (
    id TEXT PRIMARY KEY DEFAULT ('ACC-' || substr(md5(random()::text), 1, 8)),
    timestamp BIGINT NOT NULL,
    employee_id TEXT NOT NULL,
    employee_name TEXT NOT NULL,
    aceleracao_g DOUBLE PRECISION NOT NULL,
    pico_g DOUBLE PRECISION NOT NULL,
    pontuacao INTEGER NOT NULL,
    lat DOUBLE PRECISION,
    lng DOUBLE PRECISION,
    vibracao BOOLEAN DEFAULT FALSE,
    som BOOLEAN DEFAULT FALSE,
    acknowledged BOOLEAN DEFAULT FALSE,
    acknowledged_by TEXT,
    acknowledged_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. TABELA DE NORMAS REGULAMENTADORAS (NR-06 e NR-12)
CREATE TABLE IF NOT EXISTS safety_guidelines (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    category TEXT NOT NULL,
    compliance_status TEXT DEFAULT 'CONFORME' CHECK (compliance_status IN ('CONFORME', 'ATENCAO', 'CRITICO')),
    last_audit TIMESTAMPTZ DEFAULT NOW(),
    details JSONB DEFAULT '{}'::jsonb
);

-- ============================================================
-- ÍNDICES PARA ALTA PERFORMANCE
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_telemetry_employee_time ON telemetry_logs (employee_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_telemetry_created_at ON telemetry_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_accidents_timestamp ON accident_events (timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_employees_status ON employees (status);
CREATE INDEX IF NOT EXISTS idx_helmets_status ON helmets (status);

-- ============================================================
-- ROW LEVEL SECURITY (RLS) - PERMISSIVO PARA DEMONSTRAÇÃO
-- ============================================================
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE helmets ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE telemetry_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE accident_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE safety_guidelines ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso livre para a chave anon do Supabase no Frontend
CREATE POLICY "Allow public access to companies" ON companies FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public access to users" ON users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public access to helmets" ON helmets FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public access to employees" ON employees FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public access to telemetry_logs" ON telemetry_logs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public access to accident_events" ON accident_events FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public access to safety_guidelines" ON safety_guidelines FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- DADOS INICIAIS (SEED DATA)
-- ============================================================

-- Empresa Modelo
INSERT INTO companies (id, name, cnpj)
VALUES ('COMP-001', 'Indústria Segura do Brasil S.A.', '12.345.678/0001-90')
ON CONFLICT (id) DO NOTHING;

-- Usuários Padrão para Demonstração da Banca do TCC
INSERT INTO users (id, username, password, role, first_name, last_name, cpf, position, department, email, phone, company_id, active)
VALUES 
('USR-001', 'adminmaster', '123456', 'MASTER', 'Administrador', 'Master', '000.111.222-33', 'Engenheiro Chefe de Sistemas / Dono', 'Diretoria de Tecnologia & Inovação', 'adminmaster@industrial.com', '(11) 99999-0000', 'COMP-001', true),
('USR-002', 'Gbxm', '123456', 'COMPANY_ADMIN', 'Gabriel', 'Araújo', '123.456.789-00', 'Engenheiro de Segurança / Admin COI', 'Centro de Operações Industriais (COI)', 'gbxm.seguranca@industrial.com', '(11) 98765-4321', 'COMP-001', true),
('USR-003', 'visualizador', '123456', 'VIEWER', 'Auditor', 'Visualizador', '999.888.777-66', 'Técnico de Monitoramento / Fiscal', 'Auditoria Externa de Segurança', 'visualizador@industrial.com', '(11) 91234-5678', 'COMP-001', true)
ON CONFLICT (username) DO NOTHING;

-- Capacetes Inteligentes (EPIs com Sensores ESP32)
INSERT INTO helmets (id, serial_number, mac_address, firmware_version, battery, status, last_calibration, next_inspection, assigned_employee_id, company_id)
VALUES 
('HELM-001', 'CAP-2026-ESP01', '24:6F:28:B4:7E:10', 'v1.0.4', 95, 'IN_USE', NOW() - INTERVAL '30 days', NOW() + INTERVAL '150 days', 'EMP001', 'COMP-001'),
('HELM-002', 'CAP-2026-ESP02', '24:6F:28:B4:7E:11', 'v1.0.4', 80, 'AVAILABLE', NOW() - INTERVAL '15 days', NOW() + INTERVAL '165 days', NULL, 'COMP-001'),
('HELM-003', 'CAP-2026-ESP03', '24:6F:28:B4:7E:12', 'v1.0.3', 65, 'AVAILABLE', NOW() - INTERVAL '45 days', NOW() + INTERVAL '135 days', NULL, 'COMP-001'),
('HELM-004', 'CAP-2026-ESP04', '24:6F:28:B4:7E:13', 'v1.0.4', 90, 'MAINTENANCE', NOW() - INTERVAL '90 days', NOW() + INTERVAL '90 days', NULL, 'COMP-001')
ON CONFLICT (id) DO NOTHING;

-- Operadores de Campo
INSERT INTO employees (id, name, cpf, matricula, role_function, department, shift, emergency_contact, status, lat, lng, last_seen, battery, assigned_helmet_id, company_id)
VALUES 
('EMP001', 'Gabriel Araújo', '123.456.789-00', 'IND-1044', 'Operador Industrial / Protótipo ESP32', 'Usinagem & Linha de Montagem', '1º Turno (06h - 14h)', '(11) 98888-1111 (Esposa - Mariana)', 'ONLINE', -23.5505, -46.6333, EXTRACT(EPOCH FROM NOW()) * 1000, 95, 'HELM-001', 'COMP-001'),
('EMP002', 'Gustavo Felix', '234.567.890-11', 'IND-1045', 'Técnico de Manutenção Mecânica', 'Manutenção Central', '2º Turno (14h - 22h)', '(11) 97777-2222 (Mãe - Cláudia)', 'OFFLINE', -23.5515, -46.6343, 0, 80, 'HELM-002', 'COMP-001'),
('EMP003', 'Fabio Akira', '345.678.901-22', 'IND-1046', 'Inspetor de Qualidade & Processos', 'Qualidade & Auditoria', '1º Turno (06h - 14h)', '(11) 96666-3333 (Irmão - Roberto)', 'OFFLINE', -23.5525, -46.6353, 0, 65, 'HELM-003', 'COMP-001'),
('EMP004', 'Fabio Pelissari', '456.789.012-33', 'IND-1047', 'Eletricista de Alta Tensão', 'Subestação Elétrica', '3º Turno (22h - 06h)', '(11) 95555-4444 (Esposa - Fernanda)', 'OFFLINE', -23.5535, -46.6363, 0, 90, NULL, 'COMP-001')
ON CONFLICT (id) DO NOTHING;

-- Normas Regulamentadoras NR-06 (EPI) e NR-12 (Segurança de Máquinas)
INSERT INTO safety_guidelines (id, code, title, description, category, compliance_status, last_audit, details)
VALUES 
('GUIDE-01', 'NR-06.1', 'Certificado de Aprovação (CA) de Capacetes', 'Obrigatoriedade de equipamentos com Certificado de Aprovação válido emitido pelo Ministério do Trabalho para atenuação de impacto mecânico.', 'EPI - Proteção da Cabeça', 'CONFORME', NOW(), '{"ca_exigido": true, "norma_referencia": "ABNT NBR 8221:2019"}'::jsonb),
('GUIDE-02', 'NR-06.2', 'Inspeção e Substituição Periódica de Carneira e Casco', 'Inspeção visual periódica contra trincas, deformações térmicas, fadiga do polietileno e higienização dos sistemas de suspensão.', 'EPI - Conservação', 'CONFORME', NOW(), '{"frequencia_dias": 180, "responsavel": "SESMT"}'::jsonb),
('GUIDE-03', 'NR-12.1', 'Sistemas de Parada de Emergência e Delimitação', 'Instalação e monitoramento contínuo de dispositivos de emergência em zonas com risco mecânico, esmagamento e prensagem.', 'Máquinas e Equipamentos', 'CONFORME', NOW(), '{"categoria_seguranca": "Categoria 4 (PLe)", "monitoramento_remoto": true}'::jsonb),
('GUIDE-04', 'NR-12.2', 'Detecção Rápida de Queda e Impactos em Operadores', 'Protocolo de alerta e desativação automática de maquinário pesado ao detectar impactos superiores a 4G ou desaceleração abrupta.', 'Intertravamento', 'CONFORME', NOW(), '{"limite_g_seguro": 4.0, "tempo_resposta_ms": 250}'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- Evento de Teste de Impacto Inicial
INSERT INTO accident_events (id, timestamp, employee_id, employee_name, aceleracao_g, pico_g, pontuacao, lat, lng, vibracao, som, acknowledged)
VALUES 
('ACC-001', EXTRACT(EPOCH FROM NOW() - INTERVAL '2 hours') * 1000, 'EMP001', 'Gabriel Araújo', 12.4, 14.8, 85, -23.5505, -46.6333, true, true, false)
ON CONFLICT (id) DO NOTHING;

-- 8. TABELA DE AUDITORIA DE CIBERSEGURANÇA E CONFORMIDADE (LGPD)
CREATE TABLE IF NOT EXISTS security_audit_logs (
    id TEXT PRIMARY KEY DEFAULT ('AUD-' || substr(md5(random()::text), 1, 10)),
    timestamp BIGINT NOT NULL,
    action TEXT NOT NULL,
    actor_username TEXT NOT NULL,
    target TEXT,
    details TEXT,
    ip TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE security_audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public access to security_audit_logs" ON security_audit_logs FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- HABILITAR SUPABASE REALTIME (COMUNICAÇÃO BIDIRECIONAL)
-- ============================================================
-- Permite que qualquer alteração manual ou via SQL na raiz do Supabase
-- seja imediatamente propagada para a aplicação Safety Monitor via WebSocket Realtime!

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;
END $$;

-- Adiciona tabelas à publicação de Realtime
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE users, employees, helmets, accident_events, safety_guidelines;
  EXCEPTION
    WHEN duplicate_object THEN
      -- Tabelas já presentes na publicação
      NULL;
  END;
END $$;

-- REPLICA IDENTITY FULL garante que eventos de UPDATE e DELETE transmitam todos os campos antigos e novos
ALTER TABLE users REPLICA IDENTITY FULL;
ALTER TABLE employees REPLICA IDENTITY FULL;
ALTER TABLE helmets REPLICA IDENTITY FULL;
ALTER TABLE accident_events REPLICA IDENTITY FULL;
ALTER TABLE safety_guidelines REPLICA IDENTITY FULL;

-- Mensagem de confirmação
SELECT 'Schema do Industrial Safety Monitor com Realtime Bidirecional e Cibersegurança configurados com sucesso!' AS status;

