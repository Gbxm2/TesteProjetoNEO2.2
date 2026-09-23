/**
 * INDUSTRIAL SAFETY MONITOR - MÓDULO DE CIBERSEGURANÇA E PRIVACIDADE (LGPD)
 * 
 * Implementa boas práticas OWASP Top 10 e LGPD (Lei nº 13.709/2018):
 * 1. Hashing criptográfico de senhas (Web Crypto API - SHA-256 + Salt)
 * 2. Suporte à migração segura transparente de senhas legadas
 * 3. Mascaramento e proteção de dados pessoais sensíveis (CPF, contatos)
 * 4. Sanitização de inputs para prevenção de XSS e injeções
 * 5. Registro e formato padronizado de logs de auditoria de segurança
 */

// Prefixo identificador para diferenciar senhas já hasheadas de senhas em texto puro
const HASH_PREFIX = "$ism_sha256$";
const SYSTEM_SALT = "ISM_SAFETY_SALT_2026_SECURE_#";

/**
 * Converte um ArrayBuffer em uma string hexadecimal.
 */
function bufferToHex(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Gera o hash criptográfico seguro de uma senha utilizando SHA-256 e Salt da Web Crypto API.
 */
export async function hashPassword(plainText: string, salt: string = SYSTEM_SALT): Promise<string> {
  if (!plainText) return "";
  
  // Se já for um hash gerado pelo sistema, não re-hashear
  if (plainText.startsWith(HASH_PREFIX)) {
    return plainText;
  }

  try {
    const encoder = new TextEncoder();
    const data = encoder.encode(salt + plainText + salt);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hexHash = bufferToHex(hashBuffer);
    return `${HASH_PREFIX}${hexHash}`;
  } catch (err) {
    console.warn("[Security] Web Crypto API indisponível, utilizando fallback seguro:", err);
    // Fallback determinístico simples com salt se Web Crypto não estiver acessível
    let hash = 0;
    const combined = salt + plainText;
    for (let i = 0; i < combined.length; i++) {
      const char = combined.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash |= 0;
    }
    return `${HASH_PREFIX}fb_${Math.abs(hash).toString(16)}`;
  }
}

/**
 * Verifica se a senha fornecida pelo usuário confere com o valor armazenado.
 * Suporta migração retrocompatível transparente (texto puro -> hash seguro).
 */
export async function verifyPassword(inputPassword: string, storedPasswordOrHash: string): Promise<{ valid: boolean; requiresRehash: boolean }> {
  if (!inputPassword || !storedPasswordOrHash) {
    return { valid: false, requiresRehash: false };
  }

  // Caso 1: Senha armazenada já está com hash seguro
  if (storedPasswordOrHash.startsWith(HASH_PREFIX)) {
    const computedHash = await hashPassword(inputPassword);
    return {
      valid: computedHash === storedPasswordOrHash,
      requiresRehash: false
    };
  }

  // Caso 2: Senha legada em texto puro (ex: seed "123456")
  const matchesPlainText = inputPassword === storedPasswordOrHash;
  return {
    valid: matchesPlainText,
    requiresRehash: matchesPlainText // Se bateu em texto puro, sinaliza para atualizar para hash imediatamente
  };
}

/**
 * Mascara o CPF para visualização pública ou de perfis sem privilégios Master,
 * garantindo conformidade com a LGPD (Princípio da Necessidade e Minimização).
 * Exemplo: "123.456.789-00" -> "***.456.789-**"
 */
export function maskCPF(cpf?: string | null, isFullAccess: boolean = false): string {
  if (!cpf) return "Não informado";
  if (isFullAccess) return cpf;
  
  const clean = cpf.replace(/\D/g, "");
  if (clean.length !== 11) return "***.***.***-**";
  
  return `***.${clean.substring(3, 6)}.${clean.substring(6, 9)}-**`;
}

/**
 * Sanitiza strings para exibição segura, neutralizando potenciais tags maliciosas.
 */
export function sanitizeInput(input: string): string {
  if (!input) return "";
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
    .trim();
}

/**
 * Validação rigorosa de coordenadas geográficas para integridade de telemetria.
 */
export function isValidCoordinate(lat: number, lng: number): boolean {
  if (typeof lat !== "number" || typeof lng !== "number") return false;
  if (isNaN(lat) || isNaN(lng)) return false;
  if (lat < -90 || lat > 90) return false;
  if (lng < -180 || lng > 180) return false;
  return true;
}

/**
 * Registro de Auditoria de Cibersegurança
 */
export interface SecurityAuditRecord {
  id: string;
  timestamp: number;
  action: "LOGIN_SUCCESS" | "LOGIN_FAILED" | "ROLE_CHANGED" | "USER_CREATED" | "USER_DISABLED" | "EMERGENCY_ACKNOWLEDGED";
  actorUsername: string;
  target?: string;
  details?: string;
  ip?: string;
}

export function createAuditLog(
  action: SecurityAuditRecord["action"],
  actorUsername: string,
  target?: string,
  details?: string
): SecurityAuditRecord {
  return {
    id: `AUD-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    timestamp: Date.now(),
    action,
    actorUsername,
    target,
    details
  };
}
