// Simulación demostrativa de actividad de Controlin. No escribe datos en Supabase.
const ESC = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt = d => d.toLocaleDateString('es-AR',{day:'2-digit',month:'2-digit'});
const fmtHora = d => d.toLocaleString('es-AR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false});
const z2 = n => String(n).padStart(2,'0');

function generarMes(anio, mes) {
  const diasMes = new Date(anio, mes, 0).getDate();
  const turnos = [], controles = [], anomalias = [], recorridos = [];
  // Ciclo fijo de 12 días: 4 turnos diurnos, 2 francos, 4 nocturnos, 2 francos.
  for (let dia=1; dia<=diasMes; dia++) {
    const ciclo = (dia-1)%12;
    const fecha = new Date(anio, mes-1, dia, 0, 0, 0);
    let tipo = 'Franco', inicio=null, fin=null;
    if (ciclo<4) { tipo='Día'; inicio=new Date(anio,mes-1,dia,7); fin=new Date(anio,mes-1,dia,19); }
    else if (ciclo>=6 && ciclo<10) { tipo='Noche'; inicio=new Date(anio,mes-1,dia,19); fin=new Date(anio,mes-1,dia+1,7); }
    turnos.push({fecha,tipo,inicio,fin});
    if (!inicio) continue;
    const nControles = 12 + ((dia*7)%9);
    for(let i=0;i<nControles;i++){
      const hora = new Date(inicio.getTime() + (i+1)*(11*60*60*1000)/(nControles+1));
      const activos = ['EXT-0421','EXT-0876','HID-0112','HID-0238','ECAS-003','VAL-014','VECAS-008','PECAS-002'];
      const activo = activos[(dia*3+i*5)%activos.length];
      controles.push({fecha:hora,activo,tipo:activo.startsWith('EXT')?'Inspección de extintor':activo.startsWith('HID')?'Control de hidrante':activo.startsWith('ECAS')?'Control ECAS':activo.startsWith('VAL')?'Control de válvula':activo.startsWith('VECAS')?'Control VECAS':'Control PECAS',resultado:((dia+i)%17===0)?'Observación':'Conforme'});
    }
    recorridos.push({fecha:inicio,tipo:tipo==='Día'?'Ronda diurna':'Ronda nocturna',duracion:tipo==='Día'?'11 h 42 min':'11 h 35 min',distancia:5.2+((dia*13)%47)/10,puntos:34+((dia*11)%46),zonas:3+((dia*7)%5)});
    if (dia%4===0 || dia%7===0) {
      const descripciones=['Gabinete de hidrante con cierre defectuoso','Extintor con señalización parcialmente obstruida','Pérdida leve observada en unión de red','Acceso a equipo contra incendios parcialmente bloqueado','Vencimiento próximo detectado durante inspección'];
      anomalias.push({fecha:new Date(inicio.getTime()+4*60*60*1000),activo:['HID-0112','EXT-0876','HID-0238','ECAS-003','EXT-0421'][anomalias.length%5],detalle:descripciones[anomalias.length%descripciones.length],estado:anomalias.length%3===0?'Resuelta':'Pendiente'});
    }
  }
  return {turnos,controles,anomalias,recorridos};
}
function card(label,value,sub,color='#60a5fa'){return '<article style="background:#1b2430;border:1px solid #334155;border-radius:12px;padding:15px"><div style="color:#9ca3af;font-size:12px">'+label+'</div><div style="font-size:27px;font-weight:700;color:'+color+';margin:5px 0">'+value+'</div><div style="color:#9ca3af;font-size:12px">'+sub+'</div></article>'}
export async function cargarModuloSimulacionControlin(contenedor) {
  const ahora = new Date();
  const anio = 2026, mes = 10;
  const d = generarMes(anio,mes);
  const diasTurno=d.turnos.filter(t=>t.inicio).length;
  const horas=diasTurno*12;
  contenedor.style.cssText+=';display:block;width:100%;max-width:1250px;padding:14px;margin:0 auto;box-sizing:border-box';
  contenedor.innerHTML = `
  <section style="color:#e5e7eb;font-family:Arial,sans-serif">
    <header style="display:flex;gap:12px;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;margin-bottom:16px">
      <div><div style="font-size:11px;letter-spacing:1.5px;color:#fbbf24;font-weight:bold">MODO DEMOSTRACIÓN · DATOS FICTICIOS</div><h2 style="margin:6px 0">Actividad mensual de Controlin</h2><p style="color:#9ca3af;margin:0">Octubre 2026 · ciclo de 4 días de día, 2 francos, 4 noches y 2 francos.</p></div>
      <button onclick="irInicio()" style="padding:9px 13px;border:1px solid #475569;background:#1f2937;color:white;border-radius:8px;cursor:pointer">← Volver</button>
    </header>
    <div style="background:#3b2f14;border:1px solid #8b6b22;color:#fde68a;padding:11px 13px;border-radius:9px;margin-bottom:14px;font-size:13px">Simulación visual únicamente. Los recorridos, controles y anomalías que ves abajo NO se guardaron en las tablas operativas ni deben interpretarse como hechos reales.</div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(155px,1fr));gap:10px;margin-bottom:18px">
      ${card('Jornadas trabajadas',diasTurno,'de 31 días','#86efac')}
      ${card('Horas simuladas',horas+' h','turnos de 12 horas','#93c5fd')}
      ${card('Controles realizados',d.controles.length,'activos de distintas instalaciones','#c4b5fd')}
      ${card('Recorridos GPS',d.recorridos.length,'uno por jornada trabajada','#67e8f9')}
      ${card('Anomalías detectadas',d.anomalias.length,d.anomalias.filter(a=>a.estado==='Pendiente').length+' pendientes','#fbbf24')}
    </div>
    <section style="background:#111827;border:1px solid #374151;border-radius:12px;padding:14px;margin-bottom:14px">
      <h3 style="margin:0 0 10px">Calendario de turnos</h3>
      <div style="display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:5px">
        ${d.turnos.map(t=>{const bg=t.tipo==='Día'?'#164e3b':t.tipo==='Noche'?'#1e3a8a':'#292929';const fg=t.tipo==='Día'?'#86efac':t.tipo==='Noche'?'#bfdbfe':'#9ca3af';return '<div title="'+ESC(t.tipo+(t.inicio?' · '+fmtHora(t.inicio)+' a '+fmtHora(t.fin):''))+'" style="background:'+bg+';color:'+fg+';padding:7px 3px;border-radius:6px;text-align:center;min-height:43px"><div style="font-size:12px;font-weight:bold">'+t.fecha.getDate()+'</div><div style="font-size:10px;margin-top:3px">'+(t.tipo==='Día'?'07–19':t.tipo==='Noche'?'19–07':'FRANCO')+'</div></div>'}).join('')}
      </div><div style="display:flex;gap:12px;flex-wrap:wrap;color:#9ca3af;font-size:11px;margin-top:10px"><span>🟩 Turno diurno 07:00–19:00</span><span>🟦 Turno nocturno 19:00–07:00 del día siguiente</span><span>⬛ Franco</span></div>
    </section>
    <section style="background:#111827;border:1px solid #374151;border-radius:12px;padding:14px;margin-bottom:14px">
      <h3 style="margin:0 0 10px">Recorridos simulados</h3>
      <div style="overflow:auto"><table style="border-collapse:collapse;width:100%;font-size:13px"><thead><tr>${['Fecha','Turno','Duración','Distancia estimada','Puntos GPS','Zonas visitadas'].map(x=>'<th style="text-align:left;padding:8px;border-bottom:1px solid #374151;color:#9ca3af">'+x+'</th>').join('')}</tr></thead><tbody>
      ${d.recorridos.map(r=>'<tr>'+['<td style="padding:8px;border-bottom:1px solid #273244">'+fmtHora(r.fecha)+'</td>','<td style="padding:8px;border-bottom:1px solid #273244">'+r.tipo+'</td>','<td style="padding:8px;border-bottom:1px solid #273244">'+r.duracion+'</td>','<td style="padding:8px;border-bottom:1px solid #273244">'+r.distancia.toFixed(1)+' km</td>','<td style="padding:8px;border-bottom:1px solid #273244">'+r.puntos+'</td>','<td style="padding:8px;border-bottom:1px solid #273244">'+r.zonas+'</td>'].join('')+'</tr>').join('')}
      </tbody></table></div>
    </section>
    <section style="background:#111827;border:1px solid #374151;border-radius:12px;padding:14px;margin-bottom:14px">
      <h3 style="margin:0 0 10px">Controles realizados (muestra)</h3>
      <div style="overflow:auto;max-height:360px"><table style="border-collapse:collapse;width:100%;font-size:13px"><thead><tr><th style="text-align:left;padding:8px;border-bottom:1px solid #374151">Fecha/hora</th><th style="text-align:left;padding:8px;border-bottom:1px solid #374151">Activo</th><th style="text-align:left;padding:8px;border-bottom:1px solid #374151">Tipo</th><th style="text-align:left;padding:8px;border-bottom:1px solid #374151">Resultado</th></tr></thead><tbody>
      ${d.controles.map(c=>'<tr><td style="padding:7px;border-bottom:1px solid #273244">'+fmtHora(c.fecha)+'</td><td style="padding:7px;border-bottom:1px solid #273244">'+c.activo+'</td><td style="padding:7px;border-bottom:1px solid #273244">'+c.tipo+'</td><td style="padding:7px;border-bottom:1px solid #273244;color:'+(c.resultado==='Conforme'?'#86efac':'#fbbf24')+'">'+c.resultado+'</td></tr>').join('')}
      </tbody></table></div>
    </section>
    <section style="background:#111827;border:1px solid #374151;border-radius:12px;padding:14px">
      <h3 style="margin:0 0 10px">Anomalías detectadas</h3>
      <div style="display:grid;gap:8px">${d.anomalias.map(a=>'<article style="background:#1f2937;border-left:3px solid '+(a.estado==='Pendiente'?'#f59e0b':'#22c55e')+';padding:10px;border-radius:7px"><div style="display:flex;gap:10px;justify-content:space-between;flex-wrap:wrap"><strong>'+ESC(a.activo)+' · '+ESC(a.detalle)+'</strong><span style="font-size:12px;color:'+(a.estado==='Pendiente'?'#fbbf24':'#86efac')+'">'+a.estado+'</span></div><div style="font-size:12px;color:#9ca3af;margin-top:5px">'+fmtHora(a.fecha)+' · Reportada por Controlin (dato simulado)</div></article>').join('')}</div>
    </section>
  </section>`;
}
