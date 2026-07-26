import { ejecutarProcesoConTimeout } from './ejecutarProcesoConTimeout';
import { crearEntornoSmokeAislado, crearMarcadorSmoke, rutaCliSmoke, type EjecutorSmoke, type EntornoSmokeAislado } from './smokeDeterminista';

export type ProveedorDurable='qwen'|'deepseek'|'chatgpt';
export type EscenarioDurable='background'|'kill'|'pestana'|'cancelacion';
interface Tarea {id:string;estado:string;pid?:number;conversacionId?:string;respuestaParcial?:string;modo?:string;estrategia?:string;cancelacionSolicitada?:boolean;}
interface ConfigProveedor {modelo:string;host:string;url:(id:string)=>string;selectorUsuario:string;}
const configs:Record<ProveedorDurable,ConfigProveedor>={
 qwen:{modelo:process.env.CAPI_QWEN_SMOKE_MODEL??'qwen3.7-max',host:'chat.qwen.ai',url:id=>`https://chat.qwen.ai/c/${id}`,selectorUsuario:'.qwen-chat-message-user'},
 deepseek:{modelo:process.env.CAPI_DEEPSEEK_SMOKE_MODEL??'default',host:'chat.deepseek.com',url:id=>`https://chat.deepseek.com/a/chat/s/${id}`,selectorUsuario:'.ds-message--user,[data-role="user"]'},
 chatgpt:{modelo:process.env.CAPI_CHATGPT_SMOKE_MODEL??'auto',host:'chatgpt.com',url:id=>`https://chatgpt.com/c/${id}`,selectorUsuario:'[data-message-author-role="user"]'},
};
export function normalizarConversacionSmoke(proveedor:ProveedorDurable,id:string):{url:string;identificador:string}{
 if(proveedor==='chatgpt'){
  try{const url=new URL(id);const identificador=url.pathname.match(/\/c\/([^/?#]+)/)?.[1]??id;return{url:`https://chatgpt.com/c/${identificador}`,identificador}}catch{return{url:`https://chatgpt.com/c/${id.replace(/^c\//,'')}`,identificador:id.replace(/^c\//,'')}}
 }
 const url=configs[proveedor].url(id);
 return{url,identificador:id};
}
const dormir=(ms:number)=>new Promise(r=>setTimeout(r,ms));
const parseJson=(s:string)=>{for(const linea of s.trim().split('\n').reverse())try{return JSON.parse(linea)}catch{};throw new Error('Salida JSON ausente')};
async function cli(ejecutar:EjecutorSmoke,entorno:EntornoSmokeAislado,args:string[],timeout=30_000){const r=await ejecutar(['bun','run',rutaCliSmoke(),...args],timeout,{cwd:entorno.directorio,env:entorno.env});if(r.timeout)throw new Error(`Timeout: ${args.join(' ')}`);if(r.exitCode!==0)throw new Error(r.stderr||r.stdout);return r;}
async function estado(ejecutar:EjecutorSmoke,entorno:EntornoSmokeAislado,id:string){return parseJson((await cli(ejecutar,entorno,['tareas','estado',id])).stdout) as Tarea;}
async function esperar(ejecutar:EjecutorSmoke,entorno:EntornoSmokeAislado,id:string,p:(t:Tarea)=>boolean,timeoutMs:number){const fin=Date.now()+timeoutMs;let t:Tarea|undefined;while(Date.now()<fin){t=await estado(ejecutar,entorno,id);if(p(t))return t;await dormir(500)}throw new Error(`La tarea ${id} no alcanzó el estado esperado; último=${t?.estado}`)}
async function crearBackground(proveedor:ProveedorDurable,escenario:EscenarioDurable,marcador:string,ejecutar:EjecutorSmoke,entorno:EntornoSmokeAislado,intento=1){const c=configs[proveedor];const prompt=escenario==='background'?(intento===1?`Confirma la conexión respondiendo exactamente con ${marcador}, sin texto adicional.`:`Prueba técnica: escribe únicamente ${marcador}.`):escenario==='cancelacion'?`Escribe un ensayo de 3000 palabras y termina con ${marcador}`:`Escribe una explicación de 1800 palabras y termina exactamente con ${marcador}`;const args=['chat','enviar','--proveedor',proveedor,'--modelo',c.modelo,'--nueva','--background','--output','json'];if(proveedor==='qwen')args.push('--razonamiento=false');args.push(prompt);const r=await cli(ejecutar,entorno,args);return String(parseJson(r.stdout).taskId)}
async function webbridge(session:string,action:string,args:Record<string,unknown>={}){const r=await fetch('http://127.0.0.1:10086/command',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({session,action,args}),signal:AbortSignal.timeout(15_000)});const j=await r.json() as any;if(!j.ok)throw new Error(`WebBridge ${action}: ${JSON.stringify(j.error)}`);return j.data;}
async function seleccionarConversacion(entorno:EntornoSmokeAislado,proveedor:ProveedorDurable,id:string){const c=configs[proveedor],sesion=entorno.env.CAPI_WEBBRIDGE_SESSION!,normalizada=normalizarConversacionSmoke(proveedor,id);const inventario=await webbridge(sesion,'list_tabs').catch(()=>({tabs:[]}));const tab=(inventario.tabs??[]).find((t:any)=>String(t.url??'').includes(c.host)&&String(t.url??'').includes(normalizada.identificador));if(tab?.url)await webbridge(sesion,'find_tab',{url:tab.url,active:false});else await webbridge(sesion,'navigate',{url:normalizada.url,newTab:true,group_title:'Smoke durable CAPI'});for(let i=0;i<30;i++){const d=await webbridge(sesion,'evaluate',{code:`location.pathname.includes(${JSON.stringify(normalizada.identificador)})`}).catch(()=>({value:false}));if(d.value)return;await dormir(500)}throw new Error('La conversación no quedó activa en WebBridge')}
async function contarPrompt(entorno:EntornoSmokeAislado,proveedor:ProveedorDurable,id:string,marcador:string){
 await seleccionarConversacion(entorno,proveedor,id);
 const sesion=entorno.env.CAPI_WEBBRIDGE_SESSION!;
 if(proveedor==='deepseek'){
  const codigo=`(async()=>{try{const token=JSON.parse(localStorage.getItem('userToken')||'{}').value||'';const r=await fetch('/api/v0/chat/history_messages?chat_session_id='+encodeURIComponent(${JSON.stringify(id)}),{headers:{Authorization:'Bearer '+token}});const j=await r.json();const ms=j?.data?.biz_data?.chat_messages||[];const texto=m=>typeof m?.content==='string'?m.content:(Array.isArray(m?.fragments)?m.fragments.map(f=>String(f?.content||'')).join(''):'');return ms.filter(m=>String(m?.role||'').toUpperCase()==='USER'&&texto(m).includes(${JSON.stringify(marcador)})).length}catch{return -1}})()`;
  for(let i=0;i<20;i++){const d=await webbridge(sesion,'evaluate',{code:codigo});const cantidad=Number(d.value??-1);if(cantidad>=0)return cantidad;await dormir(500)}
  return -1;
 }
 if(proveedor==='qwen'){
  const codigo=`(async()=>{try{const r=await fetch('/api/v2/chats/'+encodeURIComponent(${JSON.stringify(id)}));const j=await r.json();const ms=j?.data?.chat?.messages||[];return ms.filter(m=>String(m?.role||'').toLowerCase()==='user'&&String(m?.content||'').includes(${JSON.stringify(marcador)})).length}catch{return -1}})()`;
  for(let i=0;i<20;i++){const d=await webbridge(sesion,'evaluate',{code:codigo});const cantidad=Number(d.value??-1);if(cantidad>=0)return cantidad;await dormir(500)}
  return -1;
 }
 const selector=configs[proveedor].selectorUsuario;
 let cantidad=0;
 for(let i=0;i<30;i++){const d=await webbridge(sesion,'evaluate',{code:`[...document.querySelectorAll(${JSON.stringify(selector)})].filter(e=>(e.textContent||'').includes(${JSON.stringify(marcador)})).length`});cantidad=Number(d.value??0);if(cantidad>0)return cantidad;await dormir(500)}
 return cantidad;
}
async function cerrarPestana(entorno:EntornoSmokeAislado,proveedor:ProveedorDurable,id:string){
 await seleccionarConversacion(entorno,proveedor,id);
 const resultado=await webbridge(entorno.env.CAPI_WEBBRIDGE_SESSION!,'close_tab');
 if(resultado?.closed===false)throw new Error('WebBridge no cerró la pestaña seleccionada');
}
export async function ejecutarSmokeDurableProveedor(op:{proveedor:ProveedorDurable;escenario:EscenarioDurable;timeoutMs?:number;ejecutar?:EjecutorSmoke}){
 const ejecutar=op.ejecutar??((c,t,o)=>ejecutarProcesoConTimeout(c,t,o));const entorno=crearEntornoSmokeAislado(`${op.proveedor}-${op.escenario}`);const marcador=crearMarcadorSmoke(`${op.proveedor}_${op.escenario}`);const timeout=op.timeoutMs??180_000;let id='';let intentos=0;let vaciosProveedor=0;
 try{
  while(true){intentos++;id=await crearBackground(op.proveedor,op.escenario,marcador,ejecutar,entorno,intentos);const activa=await esperar(ejecutar,entorno,id,t=>!!t.conversacionId&&!!t.pid||['completada','fallida','cancelada','requiere_usuario'].includes(t.estado),timeout);const conv=activa.conversacionId;
   if(!conv)throw new Error(`La tarea terminó como ${activa.estado} sin conversationId`);
   if(op.escenario==='kill'){if(!activa.pid)throw new Error('PID ausente para kill');process.kill(activa.pid,'SIGKILL');await dormir(1000);await cli(ejecutar,entorno,['tareas','reanudar',id,'--output','jsonl'],timeout)}
   if(op.escenario==='pestana')await cerrarPestana(entorno,op.proveedor,conv);
   if(op.escenario==='cancelacion'){await cli(ejecutar,entorno,['tareas','cancelar',id]);const fin=await esperar(ejecutar,entorno,id,t=>['cancelada','fallida','completada'].includes(t.estado),timeout);if(fin.estado!=='cancelada')throw new Error(`Cancelación terminó como ${fin.estado}`);return{ok:true,proveedor:op.proveedor,escenario:op.escenario,taskId:id,conversationId:conv,estado:fin.estado,duplicados:await contarPrompt(entorno,op.proveedor,conv,marcador),intentos,vaciosProveedor}}
   const fin=await esperar(ejecutar,entorno,id,t=>['completada','fallida','cancelada','requiere_usuario'].includes(t.estado),timeout);
   if(fin.estado==='requiere_usuario'&&op.proveedor==='qwen'&&op.escenario==='background'&&intentos<2){vaciosProveedor++;continue}
   if(fin.estado!=='completada')throw new Error(`Ejecución terminó como ${fin.estado}`);const respuesta=(fin.respuestaParcial??'').trim();if(!respuesta)throw new Error('La ejecución completó sin respuesta semántica');if(/Saltar$|Acknowledging the signal|Explorando profundamente|Maintaining focus/i.test(respuesta))throw new Error('La respuesta contiene texto de interfaz o pensamiento');const duplicados=await contarPrompt(entorno,op.proveedor,conv,marcador);if(duplicados!==1)throw new Error(`Prompt duplicado: ${duplicados}`);return{ok:true,proveedor:op.proveedor,escenario:op.escenario,taskId:id,conversationId:conv,estado:fin.estado,modo:fin.modo,estrategia:fin.estrategia,duplicados,intentos,vaciosProveedor,marcadorRespondido:respuesta.includes(marcador),respuestaCaracteres:respuesta.length};
  }
 }finally{if(id){try{const actual=await estado(ejecutar,entorno,id);if(!['completada','fallida','cancelada','requiere_usuario'].includes(actual.estado)){await cli(ejecutar,entorno,['tareas','cancelar',id],10_000);await dormir(1000)}}catch{}}entorno.limpiar()}
}
