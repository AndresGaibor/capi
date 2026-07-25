export interface RespuestaHistorialQwen {
  contenido: string;
  pensamiento: string;
  terminado: boolean;
  modelo?: string;
  turnoId?: string;
}

export function scriptRespuestaHistorialQwen(conversacionId: string): string {
  return `(async()=>{try{
    const respuesta=await fetch('/api/v2/chats/'+encodeURIComponent(${JSON.stringify(conversacionId)}));
    if(!respuesta.ok)return{contenido:'',pensamiento:'',terminado:false};
    const cuerpo=await respuesta.json();
    const mensajes=cuerpo?.data?.chat?.messages||[];
    let ultimoUsuario=-1;
    for(let i=0;i<mensajes.length;i++)if(String(mensajes[i]?.role||'').toLowerCase()==='user')ultimoUsuario=i;
    if(ultimoUsuario<0)return{contenido:'',pensamiento:'',terminado:false};
    const asistente=mensajes.slice(ultimoUsuario+1).find(m=>String(m?.role||'').toLowerCase()==='assistant');
    if(!asistente)return{contenido:'',pensamiento:'',terminado:false};
    const fases=Array.isArray(asistente.content_list)?asistente.content_list:[];
    const respuestas=fases.filter(f=>String(f?.phase||'').toLowerCase()==='answer').map(f=>String(f?.content||''));
    const pensamientos=fases.filter(f=>/think|reason/i.test(String(f?.phase||''))).map(f=>String(f?.content||''));
    const contenido=(String(asistente.content||'').trim()||respuestas.join('').trim());
    const pensamiento=(String(asistente.reasoning_content||'').trim()||pensamientos.join('').trim());
    const terminado=!!asistente.done||fases.some(f=>String(f?.status||'').toLowerCase()==='finished');
    return{contenido,pensamiento,terminado,modelo:String(asistente.modelName||asistente.model||''),turnoId:String(asistente.id||asistente.turn_id||'')};
  }catch{return{contenido:'',pensamiento:'',terminado:false}}})()`;
}

export function scriptConfirmarPromptHistorialQwen(conversacionId: string, huella: string): string {
  return `(async()=>{try{
    const respuesta=await fetch('/api/v2/chats/'+encodeURIComponent(${JSON.stringify(conversacionId)}));
    if(!respuesta.ok)return false;
    const cuerpo=await respuesta.json();
    const mensajes=cuerpo?.data?.chat?.messages||[];
    return mensajes.some(m=>String(m?.role||'').toLowerCase()==='user'&&String(m?.content||'').includes(${JSON.stringify(huella)}));
  }catch{return false}})()`;
}
