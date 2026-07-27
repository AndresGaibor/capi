import { createHash } from "node:crypto";
import { appendFileSync, existsSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";

export interface ArtefactoAgente {
  path: string;
  bytes: number;
  hash: string;
  partial: boolean;
}

const UMBRAL_INLINE = 64 * 1024;

export class AcumuladorRespuestaArchivo {
  private readonly temporal: string;
  private readonly final: string;
  private bytes = 0;
  private vista = "";
  private cerrado = false;

  constructor(private readonly requestId: string, private readonly cwd = process.cwd()) {
    const directorio = join(cwd, ".capi", "artifacts", "chat");
    mkdirSync(directorio, { recursive: true });
    this.temporal = join(directorio, `${requestId}.part`);
    this.final = join(directorio, `${requestId}.md`);
    writeFileSync(this.temporal, "", "utf8");
  }

  escribir(contenido: string, reemplazo = false): void {
    if (this.cerrado) return;
    if (reemplazo) {
      writeFileSync(this.temporal, contenido, "utf8");
      this.bytes = Buffer.byteLength(contenido);
      this.vista = contenido.slice(0, 4096);
      return;
    }
    appendFileSync(this.temporal, contenido, "utf8");
    this.bytes += Buffer.byteLength(contenido);
    if (this.vista.length < 4096) this.vista += contenido.slice(0, 4096 - this.vista.length);
  }

  vistaPrevia(): string { return this.bytes > UMBRAL_INLINE ? this.vista : readFileSync(this.temporal, "utf8"); }

  finalizar(partial: boolean): ArtefactoAgente | undefined {
    if (this.cerrado) return undefined;
    this.cerrado = true;
    if (this.bytes <= UMBRAL_INLINE) {
      if (existsSync(this.temporal)) unlinkSync(this.temporal);
      return undefined;
    }
    renameSync(this.temporal, this.final);
    const contenido = readFileSync(this.final);
    const hash = `sha256:${createHash("sha256").update(contenido).digest("hex")}`;
    return { path: relative(this.cwd, this.final), bytes: contenido.byteLength, hash, partial };
  }

  limpiar(): void {
    if (this.cerrado) return;
    this.cerrado = true;
    if (existsSync(this.temporal)) unlinkSync(this.temporal);
  }
}
