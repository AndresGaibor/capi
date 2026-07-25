import { describe, expect, test, vi } from "bun:test";
import { ControlEjecucionChat } from "../../src/modulos/chat/aplicacion/ControlEjecucionChat";

describe("ControlEjecucionChat", () => {
  test("lanza error si ya hay 3 ejecuciones simultaneas", () => {
    const mockRepo = {
      adquirirEjecucion: vi.fn().mockReturnValue(false),
      adquirirOcupacion: vi.fn(),
      renovarEjecucion: vi.fn(),
      renovarOcupacion: vi.fn(),
      liberarEjecucion: vi.fn(),
      liberarOcupacion: vi.fn(),
    };
    const control = new ControlEjecucionChat(mockRepo);

    expect(() => control.iniciar({ proyectoId: "p1", proveedorId: "qwen" }))
      .toThrow("Ya existen 3 envíos simultáneos");
    expect(mockRepo.liberarEjecucion).not.toHaveBeenCalled();
  });

  test("retorna ocupacionFallida=true si la conversacion esta ocupada", () => {
    const mockRepo = {
      adquirirEjecucion: vi.fn().mockReturnValue(true),
      adquirirOcupacion: vi.fn().mockReturnValue(false),
      renovarEjecucion: vi.fn(),
      renovarOcupacion: vi.fn(),
      liberarEjecucion: vi.fn(),
      liberarOcupacion: vi.fn(),
    };
    const control = new ControlEjecucionChat(mockRepo);

    const result = control.iniciar({ proyectoId: "p1", proveedorId: "qwen", conversacionId: "c1" });

    expect(result.ocupacionFallida).toBe(true);
    expect(control.procesoId).toBeDefined();
    expect(mockRepo.liberarEjecucion).not.toHaveBeenCalled();
  });

  test("inicia correctamente sin ocupacion", () => {
    const mockRepo = {
      adquirirEjecucion: vi.fn().mockReturnValue(true),
      adquirirOcupacion: vi.fn(),
      renovarEjecucion: vi.fn(),
      renovarOcupacion: vi.fn(),
      liberarEjecucion: vi.fn(),
      liberarOcupacion: vi.fn(),
    };
    const control = new ControlEjecucionChat(mockRepo);

    const result = control.iniciar({ proyectoId: "p1", proveedorId: "qwen" });

    expect(result.ocupacionFallida).toBe(false);
    expect(result.procesoId).toBeDefined();
    expect(mockRepo.adquirirOcupacion).not.toHaveBeenCalled();
  });

  test("inicia correctamente con ocupacion exitosa", () => {
    const mockRepo = {
      adquirirEjecucion: vi.fn().mockReturnValue(true),
      adquirirOcupacion: vi.fn().mockReturnValue(true),
      renovarEjecucion: vi.fn(),
      renovarOcupacion: vi.fn(),
      liberarEjecucion: vi.fn(),
      liberarOcupacion: vi.fn(),
    };
    const control = new ControlEjecucionChat(mockRepo);

    const result = control.iniciar({ proyectoId: "p1", proveedorId: "qwen", conversacionId: "c1" });

    expect(result.ocupacionFallida).toBe(false);
    expect(result.procesoId).toBeDefined();
    expect(mockRepo.adquirirOcupacion).toHaveBeenCalled();
  });

  test("libera recursos al llamar liberar", () => {
    const mockRepo = {
      adquirirEjecucion: vi.fn().mockReturnValue(true),
      adquirirOcupacion: vi.fn().mockReturnValue(true),
      renovarEjecucion: vi.fn(),
      renovarOcupacion: vi.fn(),
      liberarEjecucion: vi.fn(),
      liberarOcupacion: vi.fn(),
    };
    const control = new ControlEjecucionChat(mockRepo);

    control.iniciar({ proyectoId: "p1", proveedorId: "qwen", conversacionId: "c1" });
    control.liberar();

    expect(mockRepo.liberarOcupacion).toHaveBeenCalledWith("c1", expect.any(String), "qwen");
    expect(mockRepo.liberarEjecucion).toHaveBeenCalled();
  });

  test("acepta opciones personalizadas de limite y ttl", () => {
    const mockRepo = {
      adquirirEjecucion: vi.fn().mockReturnValue(true),
      adquirirOcupacion: vi.fn(),
      renovarEjecucion: vi.fn(),
      renovarOcupacion: vi.fn(),
      liberarEjecucion: vi.fn(),
      liberarOcupacion: vi.fn(),
    };
    const control = new ControlEjecucionChat(mockRepo);

    control.iniciar({ proyectoId: "p1", proveedorId: "qwen" }, { limiteConcurrentes: 5, ttlMs: 60_000 });

    expect(mockRepo.adquirirEjecucion).toHaveBeenCalledWith(expect.any(String), expect.any(Number), 60_000, expect.any(Number), 5);
  });
});

test("detecta pérdida de lease durante renovación", () => {
  const repo:any={adquirirEjecucion:()=>true,adquirirOcupacion:()=>true,renovarEjecucion:()=>true,renovarOcupacion:()=>false,liberarEjecucion:()=>{},liberarOcupacion:()=>{}};
  const control=new ControlEjecucionChat(repo);
  control.iniciar({proyectoId:"p",proveedorId:"qwen",conversacionId:"c"},{ttlMs:90_000});
  expect(control.renovarAhora(90_000)).toBeFalse();
  expect(()=>control.verificarLease()).toThrow("lease");
  control.liberar();
});
