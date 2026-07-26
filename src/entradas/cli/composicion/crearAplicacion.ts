import { RegistroProveedores } from "../../../nucleo/proveedores/RegistroProveedores";
import { TransporteWebBridge } from "../../../plataforma/webbridge/TransporteWebBridge";
import { GestorPestanas } from "../../../plataforma/webbridge/GestorPestanas";
import { QwenPaginaChat } from "../../../proveedores/qwen/navegador/QwenPaginaChat";
import { ProveedorQwen } from "../../../proveedores/qwen/ProveedorQwen";
import { ProveedorDeepSeek } from "../../../proveedores/deepseek/ProveedorDeepSeek";
import { DeepSeekPaginaChat } from "../../../proveedores/deepseek/navegador/DeepSeekPaginaChat";
import { DeepSeekSesion } from "../../../proveedores/deepseek/servicios/DeepSeekSesion";
import { DeepSeekConversaciones } from "../../../proveedores/deepseek/servicios/DeepSeekConversaciones";
import { DeepSeekClienteConversaciones } from "../../../proveedores/deepseek/servicios/DeepSeekClienteConversaciones";
import { DeepSeekLectorHistorial } from "../../../proveedores/deepseek/servicios/DeepSeekLectorHistorial";
import { SesionDeepSeekArchivo } from "../../../plataforma/persistencia/SesionDeepSeekArchivo";
import { EnviarMensajeConContexto } from "../../../modulos/chat/aplicacion/EnviarMensajeConContexto";
import { GestorContextoProyecto } from "../../../modulos/conversaciones/aplicacion/GestorContextoProyecto";
import { detectarProyectoActual } from "../../../modulos/proyectos/aplicacion/DetectarProyecto";
import { RepositorioContextoSqlite } from "../../../plataforma/persistencia/RepositorioContextoSqlite";
import { homedir } from "node:os";
import { join } from "node:path";
import { ListarModelos } from "../../../modulos/modelos/aplicacion/ListarModelos";
import { ListarConversaciones } from "../../../modulos/conversaciones/aplicacion/ListarConversaciones";
import { ObtenerMensajes } from "../../../modulos/conversaciones/aplicacion/ObtenerMensajes";
import { ImportarSesion } from "../../../modulos/sesiones/aplicacion/ImportarSesion";
import { DiagnosticarPagina } from "../../../modulos/diagnostico/aplicacion/DiagnosticarPagina";
import { DiagnosticarCompleto } from "../../../modulos/diagnostico/aplicacion/DiagnosticarCompleto";
import { EmpaquetadorContexto } from "../../../modulos/contexto/aplicacion/EmpaquetadorContexto";
import { ConsultarHistorialProyecto } from "../../../modulos/historial/aplicacion/ConsultarHistorialProyecto";
import { VerificarContratosProveedor } from "../../../modulos/diagnostico/aplicacion/VerificarContratosProveedor";
import { GestionarEstadoProyecto } from "../../../modulos/mantenimiento/aplicacion/GestionarEstadoProyecto";
import { ChatGPTPaginaChat } from "../../../proveedores/chatgpt/navegador/ChatGPTPaginaChat";
import { ProveedorChatGPT } from "../../../proveedores/chatgpt/ProveedorChatGPT";

const cierresPendientes: Array<() => void> = [];
let signalHandlersRegistrados = false;

export function registrarCleanup(fn: () => void): void {
  cierresPendientes.push(fn);
}

function limpiarRecursosPendientes(): void {
  while (cierresPendientes.length) {
    const cierre = cierresPendientes.shift();
    try { cierre?.(); } catch {}
  }
}

export function registrarSignalHandlers(): void {
  if (signalHandlersRegistrados) return;
  signalHandlersRegistrados = true;
  const manejador = (senaal: NodeJS.Signals, codigo: number, mensaje: string) => () => {
    if (cierresPendientes.length === 0) {
      process.exit(codigo);
    }
    process.stderr.write(`\n${mensaje}\n`);
    try { limpiarRecursosPendientes(); } catch {}
    process.exit(codigo);
  };
  process.on("SIGINT", manejador("SIGINT", 130, "Señal SIGINT recibida; limpiando recursos y saliendo."));
  process.on("SIGTERM", manejador("SIGTERM", 143, "Señal SIGTERM recibida; limpiando recursos y saliendo."));
  process.on("SIGHUP", manejador("SIGHUP", 129, "Señal SIGHUP recibida; limpiando recursos y saliendo."));
}

export function crearAplicacion() {
  const transporte = new TransporteWebBridge();
  const proveedores = new RegistroProveedores();
  const gestorPestanas = new GestorPestanas(transporte);
  proveedores.registrar(new ProveedorQwen(new QwenPaginaChat(transporte, gestorPestanas)));
  proveedores.registrar(new ProveedorChatGPT(new ChatGPTPaginaChat(transporte)));
  const sesionDeepSeek = new DeepSeekSesion(transporte, new SesionDeepSeekArchivo());
  proveedores.registrar(new ProveedorDeepSeek(new DeepSeekPaginaChat(transporte, gestorPestanas), new DeepSeekConversaciones(new DeepSeekClienteConversaciones(transporte, sesionDeepSeek), new DeepSeekLectorHistorial(transporte)), sesionDeepSeek));
  const rutaDatos = process.env.CAPI_DATA_DIR ?? join(homedir(), ".local", "share", "capi");
  const repositorioContexto = new RepositorioContextoSqlite(join(rutaDatos, "contexto.sqlite"));
  const gestorContexto = new GestorContextoProyecto(repositorioContexto, () => detectarProyectoActual());
  const empaquetadorContexto = new EmpaquetadorContexto(join(rutaDatos, "contexto-cache"));
  registrarSignalHandlers();
  registrarCleanup(() => {
    try { repositorioContexto.cerrar(); } catch {}
  });
  return {
    proveedores,
    gestorPestanas,
    repositorioContexto,
    gestorContexto,
    empaquetadorContexto,
    enviarMensaje: new EnviarMensajeConContexto(proveedores, gestorContexto, repositorioContexto, empaquetadorContexto),
    listarModelos: new ListarModelos(proveedores),
    listarConversaciones: new ListarConversaciones(proveedores),
    obtenerMensajes: new ObtenerMensajes(proveedores),
    importarSesion: new ImportarSesion(proveedores),
    diagnosticarPagina: new DiagnosticarPagina(proveedores),
    diagnosticarCompleto: new DiagnosticarCompleto(proveedores, gestorContexto, repositorioContexto),
    verificarContratosProveedor: new VerificarContratosProveedor(proveedores),
    consultarHistorialProyecto: new ConsultarHistorialProyecto(repositorioContexto, gestorContexto),
    gestionarEstadoProyecto: new GestionarEstadoProyecto(repositorioContexto),
  };
}
