import { ErrorPaginaProveedor } from "../../../nucleo/errores/ErroresAplicacion";
import type { TransporteNavegador } from "../../../plataforma/webbridge/TransporteNavegador";
import { SesionDeepSeekArchivo } from "../../../plataforma/persistencia/SesionDeepSeekArchivo";
import type { SesionDeepSeek } from "../tipos";
const dormir=(ms:number)=>new Promise(r=>setTimeout(r,ms));
export class DeepSeekSesion {
  constructor(private readonly transporte: TransporteNavegador, private readonly repositorio: SesionDeepSeekArchivo, private readonly pausa: (ms:number)=>Promise<unknown> = dormir) {}
  async importar(): Promise<SesionDeepSeek> {
    await this.transporte.navegar('https://chat.deepseek.com',true,'CAPI Login'); await this.pausa(5000);
    const cookies=(await this.transporte.evaluar<Record<string,string>>("Object.fromEntries(document.cookie.split(';').map(c=>{const [k,...v]=c.trim().split('=');return[k,v.join('=')]}))")).value ?? {};
    const body=(await this.transporte.evaluar<string>('document.body.innerText')).value ?? '';
    const token=(pat:string)=>body.match(new RegExp('"'+pat+'"\s*:\s*"([^"]+)"'))?.[1] ?? '';
    const sesion:SesionDeepSeek={thumbcache:cookies.thumbcache??'',awsWafToken:cookies['aws-waf-token']??'',dsSessionId:cookies['ds-session-id']??'',userToken:token('user_token'),authorization:token('authorization'),expiresAt:Date.now()+3*60*60*1000};
    if(!sesion.authorization && !sesion.userToken) throw new ErrorPaginaProveedor('No se encontraron credenciales de sesión de DeepSeek');
    await this.repositorio.guardar(sesion); return sesion;
  }
  async obtener(): Promise<SesionDeepSeek> { const s=this.repositorio.cargar(); if(s && s.expiresAt>Date.now()) return s; return this.importar(); }
}
