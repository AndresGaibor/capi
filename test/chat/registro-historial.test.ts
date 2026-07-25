import { describe, expect, test, vi } from "bun:test";
import { RegistroChatHistorial } from "../../src/modulos/chat/aplicacion/RegistroChatHistorial";

describe("RegistroChatHistorial", () => {
  test("inicia historial con datos correctos", () => {
    const mockRepo = {
      iniciarEjecucionHistorial: vi.fn(),
      finalizarEjecucionHistorial: vi.fn(),
      registrarConversacion: vi.fn(),
      guardarSnapshotContexto: vi.fn(),
      registrarAdjuntosConfirmados: vi.fn(),
      obtenerResumenConversacion: vi.fn().mockReturnValue(null),
      guardarResumenConversacion: vi.fn(),
    };
    const registro = new RegistroChatHistorial(mockRepo);

    registro.iniciar({
      historialId: "h1",
      proyectoId: "p1",
      proveedorId: "qwen",
      modelo: "max",
      conversacionId: "c1",
      rama: "main",
      commitGit: "abc123",
      contextoHash: "hash1",
      archivos: ["a.ts", "b.ts"],
    });

    expect(mockRepo.iniciarEjecucionHistorial).toHaveBeenCalled();
    const calls = mockRepo.iniciarEjecucionHistorial.mock.calls;
    expect(calls.length).toBeGreaterThan(0);
    const call = calls[0]![0]!;
    expect(call.id).toBe("h1");
    expect(call.proyectoLocalId).toBe("p1");
    expect(call.proveedor).toBe("qwen");
    expect(call.modelo).toBe("max");
  });

  test("registra conversacion, snapshot y resumen", () => {
    const mockRepo = {
      iniciarEjecucionHistorial: vi.fn(),
      finalizarEjecucionHistorial: vi.fn(),
      registrarConversacion: vi.fn(),
      guardarSnapshotContexto: vi.fn(),
      registrarAdjuntosConfirmados: vi.fn(),
      obtenerResumenConversacion: vi.fn().mockReturnValue(null),
      guardarResumenConversacion: vi.fn(),
    };
    const registro = new RegistroChatHistorial(mockRepo);

    registro.registrarConversacionYAdjuntos({
      conversacionId: "c1",
      proyectoId: "p1",
      proveedorId: "qwen",
      modelo: "max",
      archivos: ["contexto.txt"],
      adjuntosNativos: [],
      paquete: { archivos: [{ ruta: "contexto.txt", hash: "hash1" }] },
      prompt: "hola mundo",
      respuesta: "hola!",
    });

    expect(mockRepo.registrarConversacion).toHaveBeenCalled();
    expect(mockRepo.guardarSnapshotContexto).toHaveBeenCalled();
    expect(mockRepo.guardarResumenConversacion).toHaveBeenCalled();
  });

  test("registra adjuntos nativos", () => {
    const mockRepo = {
      iniciarEjecucionHistorial: vi.fn(),
      finalizarEjecucionHistorial: vi.fn(),
      registrarConversacion: vi.fn(),
      guardarSnapshotContexto: vi.fn(),
      registrarAdjuntosConfirmados: vi.fn(),
      obtenerResumenConversacion: vi.fn().mockReturnValue(null),
      guardarResumenConversacion: vi.fn(),
    };
    const registro = new RegistroChatHistorial(mockRepo);

    registro.registrarConversacionYAdjuntos({
      conversacionId: "c1",
      proyectoId: "p1",
      proveedorId: "qwen",
      archivos: [],
      adjuntosNativos: [],
      prompt: "analiza",
      respuesta: "es una foto",
    });

    expect(mockRepo.registrarAdjuntosConfirmados).not.toHaveBeenCalled();
  });

  test("finaliza historial con estado completado", () => {
    const mockRepo = {
      iniciarEjecucionHistorial: vi.fn(),
      finalizarEjecucionHistorial: vi.fn(),
      registrarConversacion: vi.fn(),
      guardarSnapshotContexto: vi.fn(),
      registrarAdjuntosConfirmados: vi.fn(),
      obtenerResumenConversacion: vi.fn().mockReturnValue(null),
      guardarResumenConversacion: vi.fn(),
    };
    const registro = new RegistroChatHistorial(mockRepo);

    registro.finalizar({
      historialId: "h1",
      estado: "completada",
      conversacionId: "c1",
      modelo: "max",
      contextoHash: "hash1",
      archivos: ["a.ts"],
      respuestaCaracteres: 100,
    });

    expect(mockRepo.finalizarEjecucionHistorial).toHaveBeenCalled();
    const calls = mockRepo.finalizarEjecucionHistorial.mock.calls;
    expect(calls.length).toBeGreaterThan(0);
    const call = calls[0]!;
    expect(call[1]!.estado).toBe("completada");
    expect(call[1]!.respuestaCaracteres).toBe(100);
  });

  test("finaliza historial con estado fallida e incluye error", () => {
    const mockRepo = {
      iniciarEjecucionHistorial: vi.fn(),
      finalizarEjecucionHistorial: vi.fn(),
      registrarConversacion: vi.fn(),
      guardarSnapshotContexto: vi.fn(),
      registrarAdjuntosConfirmados: vi.fn(),
      obtenerResumenConversacion: vi.fn().mockReturnValue(null),
      guardarResumenConversacion: vi.fn(),
    };
    const registro = new RegistroChatHistorial(mockRepo);

    registro.finalizar({
      historialId: "h1",
      estado: "fallida",
      archivos: [],
      respuestaCaracteres: 0,
      error: "timeout",
    });

    expect(mockRepo.finalizarEjecucionHistorial).toHaveBeenCalled();
    const calls = mockRepo.finalizarEjecucionHistorial.mock.calls;
    expect(calls.length).toBeGreaterThan(0);
    const call = calls[0]!;
    expect(call[1]!.estado).toBe("fallida");
    expect(call[1]!.error).toBe("timeout");
  });
});
