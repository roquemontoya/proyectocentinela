import { clienteSupabase } from './supabaseClient.js';

const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

export async function renderizarAlveolosPulmon(contenedor) {
    const { data: alveolos, error } = await clienteSupabase
        .from('pulmon_alveolos')
        .select('id,codigo,estado,activo_extintor_id')
        .order('id');
    if (error) {
        contenedor.insertAdjacentHTML('beforeend', `<section style="max-width:1100px;margin:24px auto;color:#fecaca">No se pudieron cargar los alvéolos: ${esc(error.message)}</section>`);
        return;
    }
    const ids = (alveolos || []).map(a => a.activo_extintor_id).filter(Boolean);
    let equipos = [];
    if (ids.length) {
        const { data } = await clienteSupabase.from('Extintores')
            .select('id,ETIQUETA,TIPO,PRP,Referencia,Novedades,alveolo_id')
            .in('id', ids);
        equipos = data || [];
    }
    const porId = new Map(equipos.map(e => [Number(e.id), e]));
    const { data: disponibles } = await clienteSupabase.from('Extintores')
        .select('id,ETIQUETA,TIPO,PRP,Referencia,Novedades,alveolo_id')
        .in('PRP', ['En Pulmon','En Pulmón'])
        .order('id');
    const stock = (disponibles || []).filter(e => e.alveolo_id != null && !/TEST CENTINELA|SUEÑOS Y ESPERANZAS/i.test(`${e.Referencia || ''} ${e.Novedades || ''}`));
    const ocupados = (alveolos || []).filter(a => a.estado === 'Ocupado').length;
    const section = document.createElement('section');
    section.id = 'tablero-alveolos-pulmon';
    section.style.cssText = 'max-width:1100px;margin:28px auto;color:#fff;font-family:Arial,sans-serif';
    section.innerHTML = `
      <h2 style="color:#38bdf8;margin-bottom:6px">🫁 Alvéolos del Pulmón</h2>
      <p style="color:#bbb;margin-top:0">La ubicación se reutiliza; la identidad y el historial pertenecen al extintor. Los reemplazos deben registrarse desde el flujo transaccional del Pulmón.</p>
      <div style="display:flex;gap:10px;flex-wrap:wrap;margin:12px 0">
        <span style="background:#166534;padding:7px 10px;border-radius:5px">Ocupados: ${ocupados}</span>
        <span style="background:#334155;padding:7px 10px;border-radius:5px">Libres: ${(alveolos||[]).length-ocupados}</span>
        <span style="background:#854d0e;padding:7px 10px;border-radius:5px">Disponibles para reemplazo: ${stock.length}</span>
      </div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;margin:12px 0">
        <input id="filtro-alveolo" placeholder="Filtrar por número, etiqueta o tipo..." style="flex:1;min-width:220px;padding:10px;background:#222;color:#fff;border:1px solid #555;border-radius:5px">
        <select id="filtro-tipo-alveolo" style="padding:10px;background:#222;color:#fff;border:1px solid #555;border-radius:5px">
          <option value="">Todos los tipos</option><option>PQS</option><option>HALON</option><option>CO2</option><option>K</option>
        </select>
        <select id="filtro-estado-alveolo" style="padding:10px;background:#222;color:#fff;border:1px solid #555;border-radius:5px">
          <option value="">Todos los estados</option><option value="Ocupado">Ocupados</option><option value="Libre">Libres</option>
        </select>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(165px,1fr));gap:8px" id="grid-alveolos">
        ${(alveolos||[]).map(a => {
            const e = porId.get(Number(a.activo_extintor_id));
            const tipo = e?.TIPO || '—';
            const etiqueta = e?.ETIQUETA || (e ? 'Equipo sin etiqueta' : '');
            const ficticio = e && /TEST CENTINELA|SUEÑOS Y ESPERANZAS/i.test(`${e.Referencia||''} ${e.Novedades||''}`);
            const estado = a.estado || 'Libre';
            const buscar = `${a.codigo} ${etiqueta} ${tipo} ${estado}`.toLowerCase();
            return `<article data-search="${esc(buscar)}" data-type="${esc(tipo.toUpperCase())}" data-state="${esc(estado)}" style="background:${estado==='Ocupado'?'#172a22':'#20252d'};border:1px solid ${estado==='Ocupado'?'#22c55e':'#475569'};border-radius:8px;padding:10px;min-width:0">
              <strong style="color:#7dd3fc">${esc(a.codigo)}</strong>
              <div style="font-size:12px;margin:7px 0;color:${estado==='Ocupado'?'#86efac':'#94a3b8'}">${estado==='Ocupado'?'● OCUPADO':'○ LIBRE'}</div>
              <div style="font-size:12px;min-height:32px;overflow-wrap:anywhere">${esc(etiqueta || 'Sin equipo asignado')}</div>
              ${e ? `<div style="font-size:12px;color:#7dd3fc;margin-top:4px">${esc(tipo)} · ID ${e.id}</div>${ficticio?'<small style="display:block;color:#fbbf24;margin-top:5px">🧪 FICTICIO</small>':''}<small style="display:block;color:#94a3b8;margin-top:8px">Para retirar este equipo, registrá un movimiento desde Reemplazos temporales.</small>` : `<small style="display:block;color:#94a3b8;margin-top:8px">Alvéolo libre. Las asignaciones deben registrarse desde un movimiento transaccional autorizado.</small>`}
            </article>`;
        }).join('')}
      </div>`;
    contenedor.appendChild(section);

    const aplicarFiltros = () => {
        const q = section.querySelector('#filtro-alveolo').value.toLowerCase();
        const tipo = section.querySelector('#filtro-tipo-alveolo').value.toUpperCase();
        const estado = section.querySelector('#filtro-estado-alveolo').value;
        section.querySelectorAll('[data-search]').forEach(card => {
            card.style.display = card.dataset.search.includes(q) && (!tipo || card.dataset.type === tipo) && (!estado || card.dataset.state === estado) ? '' : 'none';
        });
    };
    section.querySelector('#filtro-alveolo').addEventListener('input', aplicarFiltros);
    section.querySelector('#filtro-tipo-alveolo').addEventListener('change', aplicarFiltros);
    section.querySelector('#filtro-estado-alveolo').addEventListener('change', aplicarFiltros);


}
