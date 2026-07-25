import { scriptUtilidadesDom } from "../../compartido/scripts/utilidadesDom";
import { SELECTORES_DEEPSEEK } from "../selectores/SelectoresDeepSeek";

export const scriptEstadoStreamingDeepSeek = () => `(() => {
  ${scriptUtilidadesDom()}
  const S=${JSON.stringify(SELECTORES_DEEPSEEK)};
  const captura=window.__capiDeepSeekCompletion;
  const fusionar=(actual,parte)=>{
    if(!parte)return actual;
    if(!actual)return parte;
    if(parte===actual||actual.endsWith(parte))return actual;
    if(parte.startsWith(actual))return parte;
    if(actual.startsWith(parte))return actual;
    let solape=Math.min(actual.length,parte.length);
    while(solape>0&&!actual.endsWith(parte.slice(0,solape)))solape--;
    return actual+parte.slice(solape);
  };
  const extraer=raw=>{
    let resultado='';
    const visitar=v=>{
      if(!v||typeof v!=='object')return;
      if(Array.isArray(v)){v.forEach(visitar);return;}
      for(const choice of (Array.isArray(v.choices)?v.choices:[])){
        const p=typeof choice?.delta?.content==='string'?choice.delta.content:typeof choice?.message?.content==='string'?choice.message.content:'';
        resultado=fusionar(resultado,p);
      }
      for(const [k,c] of Object.entries(v)){
        if(k==='choices')continue;
        if(typeof c==='string'&&/^(response|answer)$/i.test(k))resultado=fusionar(resultado,c);
        else if(c&&typeof c==='object')visitar(c);
      }
    };
    for(const linea of String(raw||'').replaceAll(String.fromCharCode(13),'').split(String.fromCharCode(10))){
      const dato=linea.replace(/^data:\\s*/,'').trim(); if(!dato||dato==='[DONE]')continue;
      try{visitar(JSON.parse(dato));}catch{}
    }
    return resultado;
  };
  const raiz=document.querySelector('main')||document;
  const asistentesRol=[...raiz.querySelectorAll('[data-message-role="assistant"],[data-role="assistant"]')];
  const asistentesClase=[...raiz.querySelectorAll('[data-testid*="assistant-message" i],.ds-message--assistant,[class*="assistant-message" i]')];
  const ultimo=asistentesRol.at(-1)||asistentesClase.at(-1)||raiz;
  const thinkNodes=[...ultimo.querySelectorAll('[data-testid*="thinking" i],[class*="thinking"],[class*="reasoning"]')];
  const domNode=__capiDom.primeroVisible(S.respuestaCandidatos,ultimo)||ultimo.querySelector(S.respuestaCandidatos.join(','));
  const think=__capiDom.textoLimpio(thinkNodes.at(-1));
  const capturada=extraer(captura?.raw);
  const dom=__capiDom.textoLimpio(__capiDom.clonarSinRuido(domNode));
  const response=capturada||dom;
  const stop=__capiDom.primeroVisible(S.detenerCandidatos,document);
  const warning=__capiDom.primeroVisible(['[role="alert"]','.ds-button--warning','[data-testid*="error" i]'],ultimo);
  const toolbar=__capiDom.primeroVisible(['[role="toolbar"]','button[aria-label*="copy" i]','button[aria-label*="copiar" i]'],ultimo) || ultimo.querySelector('[role="toolbar"],button[aria-label*="copy" i],button[aria-label*="copiar" i]');
  const input=__capiDom.primeroVisible(S.entrada,document);
  const inputDisponible=!!input&&!input.disabled&&input.getAttribute('aria-disabled')!=='true';
  const done=captura?.done?!!response:(!!response&&!stop&&(!!toolbar||inputDisponible));
  return {think,response,done,isAssistant:!!think||!!response||!!stop||!!warning,isError:!!warning||!!captura?.error,errorMessage:captura?.error||__capiDom.textoLimpio(warning)||'Server is busy.',extractionStrategy:capturada?'sse':dom?'dom':'none'};
})()`;
