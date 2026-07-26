import { describe, expect, test } from "bun:test";
import { DeepSeekSesion } from "../../../src/proveedores/deepseek/servicios/DeepSeekSesion";
import { DeepSeekConversaciones } from "../../../src/proveedores/deepseek/servicios/DeepSeekConversaciones";
import { DeepSeekClienteConversaciones } from "../../../src/proveedores/deepseek/servicios/DeepSeekClienteConversaciones";
import { DeepSeekLectorHistorial } from "../../../src/proveedores/deepseek/servicios/DeepSeekLectorHistorial";
class T { i=0; constructor(private vals:any[]){} async estaDisponible(){return true} async navegar(){} async evaluar<T>(){return{value:this.vals[Math.min(this.i++,this.vals.length-1)] as T}} async cerrarSesion(){} }
describe('servicios DeepSeek',()=>{
 test('importa sesión',async()=>{const t=new T([{'ds-session-id':'d'},' {"authorization":"Bearer x"} ']);const repo:any={guardar:async(s:any)=>{repo.s=s},cargar:()=>null};const s=await new DeepSeekSesion(t,repo,async()=>{}).importar();expect(s.authorization).toBe('Bearer x')});
 test('lista conversaciones',async()=>{const t=new T([{data:{biz_data:{chat_sessions:[{id:'1',title:'T',updated_at:1,model_type:'m'}]}}}]);const ses:any={obtener:async()=>({authorization:'x'})};const r=await new DeepSeekConversaciones(new DeepSeekClienteConversaciones(t,ses),new DeepSeekLectorHistorial(t)).listar();expect(r[0]?.id).toBe('1')});
 test('obtiene mensajes',async()=>{const registro={data:{chat_session:{id:'1',title:'T'},chat_messages:[{role:'user',fragments:[{type:'REQUEST',content:'h'}]}]}};const t=new T([registro]);const r=await new DeepSeekConversaciones({listar:async()=>[]} as any,new DeepSeekLectorHistorial(t)).mensajes('1');expect(r?.mensajes[0]?.contenido).toBe('h')});
 test('importar NO cierra sesion (preserva tabs del navegador)',async()=>{let cerradas=0;class TNoCierra{i=0;constructor(private vals:any[]){}async estaDisponible(){return true}async navegar(){}async evaluar<T>(){return{value:this.vals[Math.min(this.i++,this.vals.length-1)] as T}}async cerrarSesion(){cerradas++}}const t=new TNoCierra([{'ds-session-id':'d'},' {"authorization":"Bearer x"} ']);const repo:any={guardar:async()=>{},cargar:()=>null};await new DeepSeekSesion(t,repo,async()=>{}).importar();expect(cerradas).toBe(0)});
});
