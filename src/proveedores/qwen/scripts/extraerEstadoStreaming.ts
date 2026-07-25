import { scriptUtilidadesDom } from "../../compartido/scripts/utilidadesDom";
import { SELECTORES_QWEN } from "../selectores/SelectoresQwen";

export function scriptExtraerEstadoStreamingQwen(): string {
  return `(() => {
    ${scriptUtilidadesDom()}
    const S = ${JSON.stringify(SELECTORES_QWEN)};
    const raiz = document.querySelector('main') || document;
    const mensajes = [...raiz.querySelectorAll(S.mensaje.join(','))];
    let promptEsperado=''; try { promptEsperado=sessionStorage.getItem('__capiQwenPrompt')||''; } catch {}
    const huella=promptEsperado.slice(0,120).trim();
    let indiceUsuario=-1;
    if (huella) for(let i=mensajes.length-1;i>=0;i--){
      const m=mensajes[i], texto=__capiDom.textoLimpio(m);
      const asistente=m.matches(S.asistente.join(',')) || !!m.querySelector(S.asistente.join(','));
      if(!asistente && texto.includes(huella)){indiceUsuario=i;break;}
    }
    let asistentes=mensajes.filter((m,i)=>i>indiceUsuario&&(m.matches(S.asistente.join(','))||!!m.querySelector(S.asistente.join(','))));
    if(!asistentes.length){
      asistentes=[...raiz.querySelectorAll(S.asistente.join(','))];
    }
    const lastAssistant=asistentes.at(-1)||null;
    const cajas=lastAssistant?[...lastAssistant.querySelectorAll('.response-message-box')]:[];
    const scopes=cajas.length>1?cajas:[lastAssistant].filter(Boolean);
    const respuestas=scopes.map(scope=>{
      const nodo=__capiDom.primeroVisible(S.contenido,scope) || scope.querySelector(S.contenido.join(','));
      if(nodo) return __capiDom.textoLimpio(__capiDom.clonarSinRuido(nodo));
      return __capiDom.textoLimpio(__capiDom.clonarSinRuido(scope));
    }).filter(Boolean);
    const pensamientos=scopes.map(scope=>{
      const nodo=__capiDom.primeroVisible(S.pensamiento,scope) || scope.querySelector(S.pensamiento.join(','));
      return __capiDom.textoLimpio(nodo);
    }).filter(Boolean);
    let response=respuestas[0]||'';
    const think=pensamientos[0]||'';
    if(response && think && response.startsWith(think)) response=response.slice(think.length).trim();
    const stop=__capiDom.primeroVisible(S.detenerCandidatos,document);
    const toolbar=lastAssistant && (__capiDom.primeroVisible(S.toolbar,lastAssistant) || lastAssistant.querySelector(S.toolbar.join(',')));
    const erroresGlobales=[...document.querySelectorAll('[role="alert"],.qwen-alert,.qwen-messsage-status,[data-testid*="error" i],[class*="toast" i],[class*="message-notice" i]')];
    const errorNode=(lastAssistant?.querySelector('[role="alert"],.qwen-alert,.qwen-messsage-status,[data-testid*="error" i]')||null)
      || erroresGlobales.find(n=>/conversaci[oó]n ha sido eliminada|conversation (?:was|has been) deleted|alta demanda|high demand|server is busy|error/i.test(__capiDom.textoLimpio(n)))
      || null;
    const isError=!!errorNode;
    const input=__capiDom.primeroVisible(S.entrada,document);
    const inputDisponible=!!input && !input.disabled && input.getAttribute('aria-disabled')!=='true';
    const done=isError || (!!response && !stop && (!!toolbar || inputDisponible));
    return { think, response, done, isGenerating:!!stop, isAssistant:!!lastAssistant, isError,
      errorMessage:__capiDom.textoLimpio(errorNode)||(isError?'Error en la respuesta de Qwen':''),
      isDualResponse:cajas.length>1, alternativeCount:cajas.length, extractionStrategy: response ? (lastAssistant?.querySelector(S.contenido.join(','))?'semantic':'structural') : 'none' };
  })()`;
}
