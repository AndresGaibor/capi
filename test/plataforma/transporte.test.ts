import { expect, test } from "bun:test";
import { TransporteWebBridge } from "../../src/plataforma/webbridge/TransporteWebBridge";
test('TransporteWebBridge delega',async()=>{const c:any={estaDisponible:async()=>true,navegar:async()=>({success:true}),evaluar:async()=>({value:1}),cdp:async()=>2,cerrarSesion:async()=>{}};const t=new TransporteWebBridge(c);expect(await t.estaDisponible()).toBeTrue();await t.navegar('x');expect((await t.evaluar<number>('x')).value).toBe(1);expect(await t.cdp?.<number>('x')).toBe(2);await t.cerrarSesion?.()});
