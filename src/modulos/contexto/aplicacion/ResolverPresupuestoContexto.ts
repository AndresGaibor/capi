export interface PresupuestoContexto { proveedor:string; modelo:string; maxBytes:number; maxTokens:number; caracteresPorToken:number; origen:"solicitado"|"modelo"|"proveedor"|"predeterminado"; }
const MIB=1024*1024;
const POR_MODELO:Record<string,{bytes:number;tokens:number;cpt:number}>={
 "qwen:preview":{bytes:4*MIB,tokens:850000,cpt:3.6},"qwen:max":{bytes:6*MIB,tokens:850000,cpt:3.6},"qwen:plus":{bytes:8*MIB,tokens:850000,cpt:3.6},
 "deepseek:expert":{bytes:8*MIB,tokens:890880,cpt:3.7},"deepseek:vision":{bytes:4*MIB,tokens:220000,cpt:3.7},"deepseek:default":{bytes:4*MIB,tokens:890880,cpt:3.7},
};
const POR_PROVEEDOR:Record<string,{bytes:number;tokens:number;cpt:number}>={qwen:{bytes:4*MIB,tokens:850000,cpt:3.6},deepseek:{bytes:4*MIB,tokens:890880,cpt:3.7}};
export function resolverPresupuestoContexto(proveedor:string,modelo?:string,solicitado?:number):PresupuestoContexto{const p=proveedor.toLowerCase(),m=(modelo??"default").toLowerCase();const base=POR_MODELO[`${p}:${m}`]??POR_PROVEEDOR[p]??{bytes:4*MIB,tokens:256000,cpt:4};const maxBytes=solicitado!=null?Math.max(1024,solicitado):base.bytes;return{proveedor:p,modelo:m,maxBytes,maxTokens:base.tokens,caracteresPorToken:base.cpt,origen:solicitado!=null?"solicitado":POR_MODELO[`${p}:${m}`]?"modelo":POR_PROVEEDOR[p]?"proveedor":"predeterminado"};}
