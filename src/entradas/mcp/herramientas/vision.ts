import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";
import { crearAplicacion } from "../../cli/composicion/crearAplicacion";
import {
  promptAnalisisVision,
  promptComparacionVision,
  type TipoAnalisisVision,
} from "../../../modulos/vision/aplicacion/PlantillasVision";

function textoJson(data: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
    structuredContent: data as Record<string, unknown>,
  };
}

function parsearJsonModelo(texto: string): unknown {
  try {
    return JSON.parse(
      texto
        .replace(/^```json\s*/i, "")
        .replace(/```\s*$/, "")
        .trim(),
    );
  } catch {
    return undefined;
  }
}

export async function ejecutarVisionMcp(entrada: {
  imagenes: string[];
  prompt: string;
  provider?: "qwen" | "deepseek";
  model?: string;
  timeoutMs?: number;
}) {
  const app = crearAplicacion();
  let response = "",
    reasoning = "",
    activeModel: string | undefined,
    conversationId: string | undefined;
  for await (const event of app.enviarMensaje.ejecutar(
    entrada.provider ?? "qwen",
    {
      prompt: entrada.prompt,
      modelo: entrada.model,
      imagenes: entrada.imagenes,
      forzarNueva: true,
      permitirFallback: true,
      timeoutMs: entrada.timeoutMs ?? 180000,
      opciones: { razonamiento: false, busquedaWeb: false },
    },
  )) {
    if (event.tipo === "respuesta") response += event.contenido;
    else if (event.tipo === "pensamiento") reasoning += event.contenido;
    else if (event.tipo === "modelo") activeModel = event.nombre;
    else if (event.tipo === "conversacion") conversationId = event.id;
  }
  return {
    response,
    parsed: parsearJsonModelo(response),
    reasoning: reasoning || undefined,
    provider: entrada.provider ?? "qwen",
    model: activeModel ?? entrada.model,
    conversationId,
  };
}

export function registrarHerramientasVision(server: McpServer): void {
  server.registerTool(
    "capi_vision_analyze",
    {
      description:
        "Analiza una imagen y devuelve JSON autosuficiente para un agente que no tiene visión. No inventa contenido y conserva incertidumbres.",
      inputSchema: {
        image: z.string(),
        type: z
          .enum(["descripcion", "ocr", "ui", "diagrama", "tabla"])
          .optional()
          .default("descripcion"),
        instruction: z.string().optional(),
        provider: z.enum(["qwen", "deepseek"]).optional().default("qwen"),
        model: z.string().optional(),
        timeoutMs: z
          .number()
          .int()
          .min(1000)
          .max(1800000)
          .optional()
          .default(180000),
      },
    },
    async ({ image, type, instruction, provider, model, timeoutMs }) =>
      textoJson(
        await ejecutarVisionMcp({
          imagenes: [image],
          prompt: promptAnalisisVision(type as TipoAnalisisVision, instruction),
          provider,
          model,
          timeoutMs,
        }),
      ),
  );

  server.registerTool(
    "capi_vision_compare",
    {
      description:
        "Compara dos imágenes en orden antes/después y devuelve diferencias, mejoras, regresiones e incertidumbres.",
      inputSchema: {
        before: z.string(),
        after: z.string(),
        instruction: z.string().optional(),
        provider: z.enum(["qwen", "deepseek"]).optional().default("qwen"),
        model: z.string().optional(),
        timeoutMs: z
          .number()
          .int()
          .min(1000)
          .max(1800000)
          .optional()
          .default(180000),
      },
    },
    async ({ before, after, instruction, provider, model, timeoutMs }) =>
      textoJson(
        await ejecutarVisionMcp({
          imagenes: [before, after],
          prompt: promptComparacionVision(instruction),
          provider,
          model,
          timeoutMs,
        }),
      ),
  );
}
