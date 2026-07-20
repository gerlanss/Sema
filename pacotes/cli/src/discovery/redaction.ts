// SEMA-GOVERNED: sema.produto.descoberta_capacidades
// Descrição: redação fail-closed de texto controlado antes de expor payloads públicos de descoberta.

const MARCADOR_REDAÇÃO = "[REDACTED]";

const PADRÕES_SENSÍVEIS: readonly RegExp[] = [
  /\bBearer\s+\S+/iu,
  /-----BEGIN\s+(?:RSA\s+|EC\s+|OPENSSH\s+)?PRIVATE\s+KEY-----/iu,
  /\b(?:sk|ghp|gho|ghu|ghs|github_pat|xoxb|xoxp|xoxa|xoxr|AIza)[_-][A-Za-z0-9_-]{8,}\b/u,
  /\b(?:api[_-]?key|access[_-]?token|refresh[_-]?token|client[_-]?secret|private[_-]?key|password|senha)\b\s*[:=]\s*\S+/iu,
  /(?:^|\s)[A-Za-z]:[\\/][^\r\n]*/u,
  /(?:^|\s)\\\\[^\\\s]+\\[^\s]+/u,
  /(?:^|\s)\/(?:Users|home|root|var|etc|opt|srv|tmp)\/[^\s]*/u,
];

export function contémTextoSensívelDescoberta(valor: string): boolean {
  return PADRÕES_SENSÍVEIS.some((padrão) => padrão.test(valor));
}

export function redigirTextoControladoDescoberta(valor: string | null): string | null {
  if (valor === null) return null;
  return contémTextoSensívelDescoberta(valor) ? MARCADOR_REDAÇÃO : valor;
}

