import { ejecutarSmokeDurableProveedor, type EscenarioDurable, type ProveedorDurable } from './lib/smokeDurableProveedor';
const proveedor=(process.argv[2]??'qwen') as ProveedorDurable;
const escenario=(process.argv[3]??'background') as EscenarioDurable;
if(!['qwen','deepseek','chatgpt'].includes(proveedor))throw new Error('Proveedor inválido');
if(!['background','kill','pestana','cancelacion'].includes(escenario))throw new Error('Escenario inválido');
console.log(JSON.stringify(await ejecutarSmokeDurableProveedor({proveedor,escenario})));
