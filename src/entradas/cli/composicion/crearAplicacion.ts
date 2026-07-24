import { RegistroProveedores } from "../../../nucleo/proveedores/RegistroProveedores";
import { TransporteWebBridge } from "../../../plataforma/webbridge/TransporteWebBridge";
import { QwenPaginaChat } from "../../../proveedores/qwen/navegador/QwenPaginaChat";
import { ProveedorQwen } from "../../../proveedores/qwen/ProveedorQwen";
import { ProveedorDeepSeek } from "../../../proveedores/deepseek/ProveedorDeepSeek";
import { DeepSeekPaginaChat } from "../../../proveedores/deepseek/navegador/DeepSeekPaginaChat";
import { DeepSeekSesion } from "../../../proveedores/deepseek/servicios/DeepSeekSesion";
import { DeepSeekConversaciones } from "../../../proveedores/deepseek/servicios/DeepSeekConversaciones";
import { SesionDeepSeekArchivo } from "../../../plataforma/persistencia/SesionDeepSeekArchivo";
import { EnviarMensajeStreaming } from "../../../modulos/chat/aplicacion/EnviarMensajeStreaming";
import { ListarModelos } from "../../../modulos/modelos/aplicacion/ListarModelos";
import { ListarConversaciones } from "../../../modulos/conversaciones/aplicacion/ListarConversaciones";
import { ObtenerMensajes } from "../../../modulos/conversaciones/aplicacion/ObtenerMensajes";
import { ImportarSesion } from "../../../modulos/sesiones/aplicacion/ImportarSesion";
import { DiagnosticarPagina } from "../../../modulos/diagnostico/aplicacion/DiagnosticarPagina";

export function crearAplicacion() {
  const transporte = new TransporteWebBridge();
  const proveedores = new RegistroProveedores();
  proveedores.registrar(new ProveedorQwen(new QwenPaginaChat(transporte)));
  const sesionDeepSeek = new DeepSeekSesion(transporte, new SesionDeepSeekArchivo());
  proveedores.registrar(new ProveedorDeepSeek(new DeepSeekPaginaChat(transporte), new DeepSeekConversaciones(transporte, sesionDeepSeek), sesionDeepSeek));
  return {
    proveedores,
    enviarMensaje: new EnviarMensajeStreaming(proveedores),
    listarModelos: new ListarModelos(proveedores),
    listarConversaciones: new ListarConversaciones(proveedores),
    obtenerMensajes: new ObtenerMensajes(proveedores),
    importarSesion: new ImportarSesion(proveedores),
    diagnosticarPagina: new DiagnosticarPagina(proveedores),
  };
}
