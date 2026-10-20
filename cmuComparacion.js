import { clienteSupabase } from './supabaseClient.js';

const norm = v => {
  if (v === null || v === undefined) return '';
  if (typeof v === 'object') return JSON.stringify(v, Object.keys(v).sort());
  return String(v).trim().replace(/\s+/g,' ').toLocaleLowerCase('es-AR');
};
const esc = v => String(v ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');

export async function compararCsvCompleto({registros,categoria,contenedor,estado,contador}) {
  contenedor.innerHTML = '<p style="color:#bae6fd;padding:12px">Consultando LEU en modo de solo lectura…</p>';
  try {
    const all=[]; const size=1000;
    for(let from=0;;from+=size) {
      const {data,error}=await clienteSupabase.from('leu').select('*').order('id',{ascending:true}).range(from,from+size-1);
      if(error) throw new Error(error.message);
      all.push(...(data||[]));
      if(!data || data.length<size) break;
    }
    const cat=String(categoria||'').trim().toLocaleLowerCase('es-AR');
    const existing=all.filter(x=>String(x.categoria||'').trim().toLocaleLowerCase('es-AR')===cat);
    const key=x=>norm(x.etiqueta);
    const byKey=new Map();
    existing.forEach(x=>{const k=key(x);if(!byKey.has(k))byKey.set(k,[]);byKey.get(k).push(x);});
    const seen=new Set(), used=new Set(), rows=[];
    let exact=0,diffCount=0,newCount=0,dupes=0,fieldDiffs=0;
    registros.forEach((csv,i)=>{
      const k=key(csv), candidates=byKey.get(k)||[];
      const db=candidates.find(x=>!used.has(String(x.id)))||null;
      const duplicate=seen.has(k); if(duplicate)dupes++; seen.add(k);
      if(!db){newCount++;rows.push({n:i+1,status:duplicate?'DUPLICADO EN CSV':'NUEVO / NO EXISTE EN LEU',csv,db:null});return;}
      used.add(String(db.id));
      const attrsCsv=csv.atributos_tecnicos||{};
      const attrsDb=db.atributos_tecnicos?.atributos_originales ?? db.atributos_tecnicos ?? {};
      const pairs=[['etiqueta',csv.etiqueta,db.etiqueta],['categoria',csv.categoria,db.categoria],['sector',csv.sector,db.sector],['ronda',csv.ronda,db.ronda],['ubicacion_wkt',csv.ubicacion_wkt,db.ubicacion_wkt]];
      [...new Set([...Object.keys(attrsCsv),...(attrsDb&&typeof attrsDb==='object'?Object.keys(attrsDb):[])])].sort().forEach(k=>pairs.push(['atributos_tecnicos.'+k,attrsCsv[k],attrsDb?.[k]]));
      const differences=pairs.filter(p=>norm(p[1])!==norm(p[2]));
      if(differences.length){diffCount++;fieldDiffs+=differences.length;}else exact++;
      rows.push({n:i+1,status:differences.length?'DIFERENCIAS':'COINCIDE',csv,db,pairs});
    });
    existing.forEach(db=>{if(!used.has(String(db.id))&&!registros.some(csv=>key(csv)===key(db)))rows.push({n:'—',status:'AUSENTE EN CSV',csv:null,db});});
    const missing=rows.filter(x=>x.status==='AUSENTE EN CSV').length;
    let html='<div style="padding:12px;background:#0f172a;border:1px solid #475569;border-radius:8px;margin-bottom:12px;color:#e2e8f0"><h3>Comparación completa · solo lectura</h3>'+
      '<p>Categoría: <b>'+esc(categoria)+'</b> · CSV: <b>'+registros.length+'</b> · LEU: <b>'+existing.length+'</b></p>'+
      '<p style="color:#86efac">Coincidencias exactas: '+exact+'</p><p style="color:#fca5a5">Registros con diferencias: '+diffCount+' · Diferencias de campos: '+fieldDiffs+'</p>'+
      '<p style="color:#fcd34d">Nuevos/no existentes: '+newCount+' · Ausentes en CSV: '+missing+' · Duplicados CSV: '+dupes+'</p>'+
      '<p>Se muestran todas las filas y todos los campos. Rojo = diferencia o ausencia; verde = coincidencia.</p></div>'+
      '<div style="overflow:auto;max-height:65vh"><table style="border-collapse:collapse;width:100%;font-size:12px;color:#e5e7eb"><thead><tr>'+
      '<th># CSV</th><th>Estado</th><th>ID LEU</th><th>Campo</th><th>Valor CSV</th><th>Valor Supabase</th></tr></thead><tbody>';
    rows.forEach(r=>{
      const statusColor=r.status==='COINCIDE'?'#86efac':r.status==='DIFERENCIAS'?'#fca5a5':'#fcd34d';
      let pairs=[];
      if(r.csv) {
        const ac=r.csv.atributos_tecnicos||{}, ad=r.db?(r.db.atributos_tecnicos?.atributos_originales??r.db.atributos_tecnicos??{}):{};
        pairs=[['etiqueta',r.csv.etiqueta,r.db?.etiqueta],['categoria',r.csv.categoria,r.db?.categoria],['sector',r.csv.sector,r.db?.sector],['ronda',r.csv.ronda,r.db?.ronda],['ubicacion_wkt',r.csv.ubicacion_wkt,r.db?.ubicacion_wkt]];
        [...new Set([...Object.keys(ac),...(ad&&typeof ad==='object'?Object.keys(ad):[])])].sort().forEach(k=>pairs.push(['atributos_tecnicos.'+k,ac[k],ad?.[k]]));
      } else pairs=[['id',null,r.db.id],['etiqueta',null,r.db.etiqueta],['categoria',null,r.db.categoria],['sector',null,r.db.sector],['ronda',null,r.db.ronda],['ubicacion_wkt',null,r.db.ubicacion_wkt],['atributos_tecnicos',null,r.db.atributos_tecnicos]];
      pairs.forEach((p,j)=>{
        const different=norm(p[1])!==norm(p[2]), bg=different?'#451a1a':'#10291b', border=different?'#ef4444':'#22c55e';
        const cell=v=>'<div style="white-space:pre-wrap;overflow-wrap:anywhere;min-width:150px;background:'+bg+';border-left:3px solid '+border+';padding:6px">'+(v===null||v===undefined||v===''?'<span style="color:#94a3b8">(vacío)</span>':esc(typeof v==='object'?JSON.stringify(v,null,2):v))+'</div>';
        html+='<tr style="border:1px solid #475569"><td>'+esc(r.n)+'</td>'+ (j===0?'<td rowspan="'+pairs.length+'" style="color:'+statusColor+';font-weight:bold">'+esc(r.status)+'</td><td rowspan="'+pairs.length+'">'+esc(r.db?.id??'—')+'</td>':'')+
          '<td style="border:1px solid #475569;padding:6px">'+esc(p[0])+'</td><td style="border:1px solid #475569;padding:6px">'+cell(p[1])+'</td><td style="border:1px solid #475569;padding:6px">'+cell(p[2])+'</td></tr>';
      });
    });
    html+='</tbody></table></div>';
    contenedor.innerHTML=html;
    estado.textContent='Comparación completa finalizada · solo lectura'; estado.style.color='#86efac';
    contador.textContent=rows.length+' filas · '+fieldDiffs+' diferencias de campos';
  } catch(e) {
    contenedor.textContent='No se pudo completar la comparación: '+e.message;
    estado.textContent='Error al comparar'; estado.style.color='#fca5a5';
  }
}
