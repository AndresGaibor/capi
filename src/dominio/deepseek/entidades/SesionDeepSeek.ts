export interface SesionDeepSeek {
  thumbcache: string;
  awsWafToken: string;
  dsSessionId: string;
  userToken: string;
  authorization: string;
  expiresAt: number;
}

export function sesionEstaExpirada(sesion: SesionDeepSeek): boolean {
  return Date.now() >= sesion.expiresAt - 60_000;
}

export function sesionEsValida(sesion: SesionDeepSeek | null): sesion is SesionDeepSeek {
  if (!sesion) return false;
  return !sesionEstaExpirada(sesion);
}
