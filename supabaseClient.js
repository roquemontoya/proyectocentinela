// Cliente Supabase de la rama de prueba: SOLO LECTURA.
const supabaseUrl = 'https://zgzhudcdxoentmfgdncf.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpnemh1ZGNkeG9lbnRtZmdkbmNmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ2OTU4MzgsImV4cCI6MjEwMDI3MTgzOH0.f1_BZa7BjMxRSc74WIK4A3NwjhBJM9sCjEGe_KpztLg';
export const MODO_PRUEBA_SOLO_LECTURA = true;
const original = window.supabase.createClient(supabaseUrl, supabaseKey);
const writes = new Set(['insert','upsert','update','delete']);
const blocked = () => Promise.resolve({data:null,error:{message:'Bloqueado: esta rama es de solo lectura y no puede escribir en Supabase.',code:'READ_ONLY_TEST_MODE'}});
function wrapQuery(q) {
  return new Proxy(q,{get(t,p) {
    if (writes.has(p)) return () => blocked();
    const v=Reflect.get(t,p,t);
    return typeof v==='function' ? (...a)=>wrapQuery(v.apply(t,a)) : v;
  }});
}
const storage = new Proxy(original.storage,{get(t,p) {
  const v=Reflect.get(t,p,t);
  if(p==='from') return (...a)=>{
    const b=v.apply(t,a);
    return new Proxy(b,{get(bt,bp) {
      if(['upload','update','move','copy','remove','createSignedUploadUrl'].includes(bp)) return ()=>blocked();
      const bv=Reflect.get(bt,bp,bt);
      return typeof bv==='function'?(...ba)=>bv.apply(bt,ba):bv;
    }});
  };
  return typeof v==='function'?v.bind(t):v;
}});
export const clienteSupabase = new Proxy(original,{get(t,p) {
  if(p==='from') return (table)=>wrapQuery(t.from(table));
  if(p==='storage') return storage;
  if(p==='rpc') return ()=>blocked();
  if(p==='functions') return new Proxy(t.functions,{get(ft,fp) {
    if(fp==='invoke') return ()=>blocked();
    const fv=Reflect.get(ft,fp,ft);
    return typeof fv==='function'?fv.bind(ft):fv;
  }});
  const v=Reflect.get(t,p,t);
  return typeof v==='function'?v.bind(t):v;
}});
