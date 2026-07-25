import {expect,test} from 'bun:test';
import {LectorTelemetriaQwen} from '../../../src/proveedores/qwen/navegador/LectorTelemetriaQwen';
import {DetectorProgresoProveedor} from '../../../src/modulos/chat/aplicacion/DetectorProgresoProveedor';
test('telemetría opcional valida versión edad y conversación',async()=>{const t:any={evaluar:async()=>({value:{version:2,proveedor:'qwen',conversacionId:'c',turnoId:'t',estado:'pensando',generando:true,actualizadoEn:1000,ultimoCambioRealEn:900,mutacionesTotales:1,cambiosRelevantes:1,firmaTurno:'f',firmaEstado:'s',disponible:true}})};const r=await new LectorTelemetriaQwen(t,()=>2000).leer('c');expect(r.saludable).toBeTrue();expect(r.valor?.firmaEstado).toBe('s')});
test('ignora bridge incompatible o expirado',async()=>{const t:any={evaluar:async()=>({value:{version:1,actualizadoEn:0}})};expect((await new LectorTelemetriaQwen(t,()=>100000).leer()).valor).toBeUndefined()});
test('detector solo marca progreso ante cambio real',()=>{const d=new DetectorProgresoProveedor(0);expect(d.observar('a',1)).toBeTrue();expect(d.observar('a',100)).toBeFalse();expect(d.edadSinProgreso(101)).toBe(100);expect(d.observar('b',102)).toBeTrue()});
