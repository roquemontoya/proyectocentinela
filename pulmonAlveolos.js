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
    const stock = (disponibles || []).filter(e => /TEST CENTINELA|SUEÑOS Y ESPERANZAS/i.test(`${e.Referencia || ''} ${e.Novedades || ''}`));
    const ocupados = (alveolos || []).filter(a => a.estado === 'Ocupado').length;
    const section = document.createElement('section');
    section.id = 'tablero-alveolos-pulmon';
    section.style.cssText = 'max-width:1100px;margin:28px auto;color:#fff;font-family:Arial,sans-serif';
    section.innerHTML = `
      <h2 style="color:#38bdf8;margin-bottom:6px">🫁 Alvéolos del Pulmón</h2>
      <p style="color:#bbb;margin-top:0">La ubicación se reutiliza; la identidad y el historial pertenecen al extintor. Los equipos de prueba están marcados y no se migran a LEU.</p>
      <div style="display:flex;gap:10px;flex-wrap:wrap;margin:12px 0">
        <span style="background:#166534;padding:7px 10px;border-radius:5px">Ocupados: ${ocupados}</span>
        <span style="background:#334155;padding:7px 10px;border-radius:5px">Libres: ${(alveolos||[]).length-ocupados}</span>
        <span style="background:#854d0e;padding:7px 10px;border-radius:5px">Stock ficticio disponible: ${stock.length}</span>
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
              ${e ? `<div style="font-size:12px;color:#7dd3fc;margin-top:4px">${esc(tipo)} · ID ${e.id}</div>${ficticio?'<small style="display:block;color:#fbbf24;margin-top:5px">🧪 FICTICIO</small>':''}<button data-clear="${a.id}" style="margin-top:8px;width:100%;padding:7px;border:0;border-radius:4px;background:#7f1d1d;color:#fff;cursor:pointer">Liberar ubicación</button>` : `<select data-assign="${a.id}" style="width:100%;margin-top:8px;padding:7px;background:#111;color:#fff;border:1px solid #555;border-radius:4px"><option value="">Asignar equipo de prueba…</option>${stock.map(s=>`<option value="${s.id}">${esc(s.ETIQUETA||('ID '+s.id))} — ${esc(s.TIPO||'N/D')}</option>`).join('')}</select>`}
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

    section.querySelectorAll('[data-assign]').forEach(select => select.addEventListener('change', async () => {
        const assetId = Number(select.value), alveoloId = Number(select.dataset.assign);
        if (!assetId) return;
        const equipo = stock.find(e => Number(e.id) === assetId);
        if (!equipo) return alert('El equipo ya no está disponible. Actualizá el módulo.');
        if (!confirm(`¿Asignar ${equipo.ETIQUETA || 'ID '+assetId} a este alvéolo?`)) { select.value=''; return; }
        const { data: actual, error: errActual } = await clienteSupabase.from('pulmon_alveolos').select('estado,activo_extintor_id').eq('id',alveoloId).single();
        if (errActual || actual.estado !== 'Libre' || actual.activo_extintor_id) return alert('El alvéolo ya no está libre. Actualizá la vista.');
        const { error: errEquipo } = await clienteSupabase.from('Extintores').update({alveolo_id:alveoloId, UBICACION:'PULMÓN '+String(alveoloId).padStart(3,'0'), PRP:'En Pulmon'}).eq('id',assetId).eq('PRP','En Pulmon');
        if (errEquipo) return alert('No se pudo asignar el extintor. Revisá permisos RLS: '+errEquipo.message);
        const { error: errSlot } = await clienteSupabase.from('pulmon_alveolos').update({estado:'Ocupado',activo_extintor_id:assetId,actualizado_en:new Date().toISOString()}).eq('id',alveoloId).eq('estado','Libre');
        if (errSlot) return alert('El equipo se actualizó pero el alvéolo no; hay que reconciliar el registro: '+errSlot.message);
        alert('Equipo asignado al alvéolo.');
        window.cargarModulo('pulmon');
    }));

    section.querySelectorAll('[data-clear]').forEach(btn => btn.addEventListener('click', async () => {
        const alveoloId = Number(btn.dataset.clear);
        const alveolo = (alveolos||[]).find(a=>Number(a.id)===alveoloId);
        const equipo = porId.get(Number(alveolo?.activo_extintor_id));
        if (!equipo) return alert('No se encontró el equipo asociado a esta ubicación.');
        if (!confirm(`¿Liberar ${alveolo.codigo}? El equipo quedará sin alvéolo asignado; esto no registra por sí solo un recambio.`)) return;
        const { error: e1 } = await clienteSupabase.from('pulmon_alveolos').update({estado:'Libre',activo_extintor_id:null,actualizado_en:new Date().toISOString()}).eq('id',alveoloId);
        if (e1) return alert('No se pudo liberar el alvéolo: '+e1.message);
        const { error: e2 } = await clienteSupabase.from('Extintores').update({alveolo_id:null,UBICACION:'FUERA DEL PULMÓN'}).eq('id',equipo.id);
        if (e2) return alert('Alvéolo liberado pero no se pudo actualizar la ubicación del equipo: '+e2.message);
        alert('Ubicación liberada. Para registrar un recambio formal, usá el flujo de reemplazo temporal.');
        window.cargarModulo('pulmon');
    }));
}
