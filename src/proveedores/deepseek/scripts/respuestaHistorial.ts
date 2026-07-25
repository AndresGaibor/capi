export function scriptRespuestaHistorialDeepSeek(conversacionId: string): string {
  return `(async()=>{try{
    const token=JSON.parse(localStorage.getItem('userToken')||'{}').value||'';
    if(!token)return{contenido:'',terminado:false};
    const respuesta=await fetch('/api/v0/chat/history_messages?chat_session_id='+encodeURIComponent(${JSON.stringify(conversacionId)}),{headers:{Authorization:'Bearer '+token}});
    if(!respuesta.ok)return{contenido:'',terminado:false};
    const cuerpo=await respuesta.json();
    const mensajes=cuerpo?.data?.biz_data?.chat_messages||[];
    const rol=m=>String(m?.role||m?.sender||'').toUpperCase();
    const contenido=m=>{
      if(typeof m?.content==='string')return m.content;
      const fragmentos=Array.isArray(m?.fragments)?m.fragments:[];
      return fragmentos.filter(f=>String(f?.type||'').toUpperCase()==='RESPONSE').map(f=>String(f?.content||'')).join('');
    };
    let ultimoUsuario=-1;
    for(let i=0;i<mensajes.length;i++)if(rol(mensajes[i])==='USER')ultimoUsuario=i;
    if(ultimoUsuario<0)return{contenido:'',terminado:false};
    const asistente=mensajes.slice(ultimoUsuario+1).find(m=>rol(m)==='ASSISTANT'&&contenido(m).trim());
    if(!asistente)return{contenido:'',terminado:false};
    return{contenido:contenido(asistente).trim(),terminado:String(asistente?.status||'').toUpperCase()==='FINISHED'};
  }catch{return{contenido:'',terminado:false}}})()`;
}
