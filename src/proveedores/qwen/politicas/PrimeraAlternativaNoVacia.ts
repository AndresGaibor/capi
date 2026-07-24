export interface AlternativaRespuesta { contenido: string; pensamiento?: string; }
export function primeraAlternativaNoVacia(alternativas: AlternativaRespuesta[]): AlternativaRespuesta | null {
  return alternativas.find((alternativa) => alternativa.contenido.trim().length > 0) ?? null;
}
