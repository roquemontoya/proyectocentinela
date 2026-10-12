import { clienteSupabase } from './supabaseClient.js';

function escapar(valor) {
  return String(valor ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

export async function cargarModuloAnomalias(contenedor) {
  contenedor.innerHTML = `
    <section style="padding:18px;color:#e5e7eb;max-width:1100px;margin:auto;">
      <h2 style="margin:0 0 6px;">Seguimiento de anomalías</h2>
      <p style="color:#9ca3af;margin:0 0 18px;">Cada incidencia puede seguirse desde el control que la detectó hasta su resolución.</p>
      <div id="anomalias-lista">Cargando anomalías…</div>
    </section>`;

  const lista = contenedor.querySelector('#anomalias-lista');
  const { data, error } = await clienteSupabase
    .from('anomalias')
    .select('id,id_activo,modulo_origen,tabla_control,id_control,evento_numero,anomalia_detectada,detalle_informe,observacion,reportado_fecha,reportado_por,estado_resolucion,fecha_resolucion,detalle_resolucion,resuelto_por,created_at')
    .order('created_at', { ascending: false })
    .limit(250);

  if (error) {
    lista.innerHTML = `<p style="color:#fca5a5;">No se pudieron cargar las anomalías: ${escapar(error.message)}</p>`;
    return;
  }
  if (!data?.length) {
    lista.innerHTML = '<p>No hay anomalías registradas.</p>';
    return;
  }

  lista.innerHTML = data.map(a => `
    <article style="background:#1f2937;border:1px solid #374151;border-radius:10px;padding:14px;margin:12px 0;">
      <div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;">
        <strong>#${a.id} · ${escapar(a.modulo_origen || 'Sin módulo')} — ${escapar(a.anomalia_detectada || 'Anomalía')}</strong>
        <span style="color:${a.estado_resolucion === 'Resuelta' ? '#86efac' : '#fcd34d'};">${escapar(a.estado_resolucion || 'Abierta')}</span>
      </div>
      <p style="margin:8px 0;color:#d1d5db;">${escapar(a.detalle_informe || a.observacion || 'Sin detalle adicional')}</p>
      <small style="color:#9ca3af;">Activo: ${escapar(a.id_activo ?? '—')} · Detectada: ${escapar(a.reportado_fecha || 'Sin fecha')} · Reportó: ${escapar(a.reportado_por || 'Sin informar')}</small>
      <p style="margin:6px 0;color:#9ca3af;">Origen: ${escapar(a.tabla_control ? a.tabla_control + ' #' + a.id_control : 'Registro histórico sin vínculo automático')}</p>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:8px;margin-top:12px;">
        <select data-field="estado_resolucion" aria-label="Estado de resolución" style="padding:9px;border-radius:6px;background:#111827;color:#fff;border:1px solid #4b5563;">
          ${['Abierta','En curso','Resuelta'].map(s => `<option ${(a.estado_resolucion || 'Abierta') === s ? 'selected' : ''}>${s}</option>`).join('')}
        </select>
        <input data-field="resuelto_por" placeholder="Responsable de resolución" value="${escapar(a.resuelto_por || '')}" style="padding:9px;border-radius:6px;background:#111827;color:#fff;border:1px solid #4b5563;">
        <input data-field="fecha_resolucion" type="date" aria-label="Fecha de resolución" value="${escapar(a.fecha_resolucion || '')}" style="padding:9px;border-radius:6px;background:#111827;color:#fff;border:1px solid #4b5563;">
      </div>
      <textarea data-field="detalle_resolucion" rows="2" placeholder="Acción correctiva / detalle de resolución" style="box-sizing:border-box;width:100%;margin-top:8px;padding:9px;border-radius:6px;background:#111827;color:#fff;border:1px solid #4b5563;">${escapar(a.detalle_resolucion || '')}</textarea>
      <button data-save="${a.id}" style="margin-top:8px;padding:9px 14px;border:0;border-radius:6px;background:#2563eb;color:#fff;cursor:pointer;">Guardar seguimiento</button>
      <span data-msg="${a.id}" style="margin-left:8px;font-size:12px;"></span>
    </article>`).join('');

  lista.querySelectorAll('button[data-save]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = Number(btn.dataset.save);
      const card = btn.closest('article');
      const get = name => card.querySelector(`[data-field="${name}"]`).value.trim();
      const estado = get('estado_resolucion');
      const detalle = get('detalle_resolucion');
      const responsable = get('resuelto_por');
      const fecha = get('fecha_resolucion');
      if (estado === 'Resuelta' && (!detalle || !responsable || !fecha)) {
        card.querySelector(`[data-msg="${id}"]`).textContent = 'Para cerrar: indique acción, responsable y fecha.';
        return;
      }
      const payload = {
        estado_resolucion: estado,
        detalle_resolucion: detalle || null,
        resuelto_por: responsable || null,
        fecha_resolucion: estado === 'Resuelta' ? fecha : null
      };
      btn.disabled = true;
      const msg = card.querySelector(`[data-msg="${id}"]`);
      const { error: saveError } = await clienteSupabase.from('anomalias').update(payload).eq('id', id);
      btn.disabled = false;
      if (saveError) {
        msg.textContent = 'Error: ' + saveError.message;
        return;
      }
      msg.textContent = 'Seguimiento guardado.';
      const status = card.querySelector('[data-field="estado_resolucion"]');
      card.querySelector('div > span').textContent = estado;
      card.querySelector('div > span').style.color = estado === 'Resuelta' ? '#86efac' : '#fcd34d';
    });
  });
}
