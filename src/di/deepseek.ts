import { AdaptadorKimiWebBridge } from "../adaptadores/webbridge/AdaptadorKimiWebBridge";
import { AdaptadorIndexedDB } from "../adaptadores/indexeddb/AdaptadorIndexedDB";
import { AdaptadorApiDeepSeek } from "../adaptadores/api/AdaptadorApiDeepSeek";
import { AdaptadorSesionArchivo } from "../adaptadores/persistencia/AdaptadorSesionArchivo";
import { AdaptadorConsola } from "../adaptadores/cli/AdaptadorConsola";
import { ServicioChatDeepSeek } from "../aplicacion/deepseek/ServicioChatDeepSeek";

let _servicio: ServicioChatDeepSeek | null = null;

export function obtenerServicioChatDeepSeek(): ServicioChatDeepSeek {
  if (_servicio) return _servicio;

  const webbridge = new AdaptadorKimiWebBridge();
  const indexeddb = new AdaptadorIndexedDB(webbridge);
  const sesion = new AdaptadorSesionArchivo();
  const api = new AdaptadorApiDeepSeek(webbridge);
  const salida = new AdaptadorConsola();

  _servicio = new ServicioChatDeepSeek(webbridge, indexeddb, sesion, api, salida);
  return _servicio;
}
