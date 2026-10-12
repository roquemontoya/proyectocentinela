import { clienteSupabase } from './supabaseClient.js';

const FUENTES = {
  hidrantes: { label: 'Hidrantes', table: 'controles_h', order: 'creado_el' },
  extintores: { label: 'Extintores', table: 'controles_e', order: 'created_at' },
  ecas: { label: 'ECAS', table: 'controles_ecas', order: 'created_at' },
  pecas: { label: 'PECAS', table: 'controles_pecas', order: 'created_at' },
  vecas: { label: 'VECAS', table: 'controles_vecas', order: 'created_at' },
  valvulas: { label: 'Válvulas', table: 'controles_v', order: 'created_at' },
};

const TAMANO_PAGINA = 50;

function escapar(valor) {
  return String(valor ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

function extraerRutaFoto(valor) {
  const foto = String(valor ?? '').trim();
  if (!foto) return null;
  if (/^https?:\/\//i.test(foto)) {
    try {
      const url = new URL(foto);
      const marcador = '/storage/v1/object/public/fotos-controles/';
      const indice = url.pathname.indexOf(marcador);
      if (indice < 0) return null;
      return decodeURIComponent(url.pathname.slice(indice + marcador.length));
    } catch {
      return null;
    }
  }
  return foto.replace(/^\/+/, '').replace(/^fotos-controles\//i, '');
}

export async function cargarModuloHistorialFotos(contenedor) {
  const { data: usuario, error: errorUsuario } = await clienteSupabase.auth.getUser();
  if (errorUsuario || !usuario?.user) {
    contenedor.innerHTML = '<p style="padding:24px;color:#fca5a5">Debes iniciar sesión como administrador para consultar el historial.</p>';
    return;
  }

  const [{ data: admin }, { data: superadmin }] = await Promise.all([
    clienteSupabase.rpc('current_user_has_role', { p_role: 'administrador' }),
    clienteSupabase.rpc('current_user_has_role', { p_role: 'superadministrador' }),
  ]);
  if (!admin && !superadmin) {
    contenedor.innerHTML = '<p style="padding:24px;color:#fca5a5">No tienes permisos para consultar el historial de fotos.</p>';
    return;
  }

  contenedor.innerHTML = `
    <section style="padding:20px;color:#e5e7eb;font-family:Arial,sans-serif">
      <h2 style="margin-top:0">📷 Historial de fotos de controles</h2>
      <p style="color:#9ca3af">Consulta las fotos históricas de un módulo. Si conoces el ID del activo, úsalo para acotar la búsqueda. Las vistas previas usan enlaces temporales de 5 minutos.</p>
      <form id="historial-fotos-form" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;align-items:end;background:#1f2937;padding:16px;border-radius:10px">
        <label>Módulo
          <select id="historial-fotos-modulo" required style="display:block;width:100%;padding:10px;margin-top:6px;background:#111827;color:#fff;border:1px solid #4b5563;border-radius:6px">
            <option value="hidrantes">Hidrantes</option><option value="extintores">Extintores</option><option value="ecas">ECAS</option><option value="pecas">PECAS</option><option value="vecas">VECAS</option><option value="valvulas">Válvulas</option>
          </select>
        </label>
        <label>ID del activo (opcional)
          <input id="historial-fotos-activo" type="number" min="1" step="1" placeholder="Todos los activos" style="display:block;box-sizing:border-box;width:100%;padding:10px;margin-top:6px;background:#111827;color:#fff;border:1px solid #4b5563;border-radius:6px">
        </label>
        <button type="submit" style="padding:11px 16px;background:#0369a1;color:#fff;border:0;border-radius:6px;font-weight:bold;cursor:pointer">Buscar fotos</button>
      </form>
      <p id="historial-fotos-estado" role="status" style="color:#9ca3af;margin:14px 0"></p>
      <div id="historial-fotos-resultados" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:14px"></div>
      <button id="historial-fotos-mas" type="button" style="display:none;margin:18px auto;padding:10px 16px;background:#374151;color:#fff;border:1px solid #6b7280;border-radius:6px;cursor:pointer">Cargar más</button>
    </section>
  `;

  const form = contenedor.querySelector('#historial-fotos-form');
  const estado = contenedor.querySelector('#historial-fotos-estado');
  const resultados = contenedor.querySelector('#historial-fotos-resultados');
  const botonMas = contenedor.querySelector('#historial-fotos-mas');
  let offset = 0;
  let ultimaBusqueda = { modulo: 'hidrantes', activo: '' };
  let cargando = false;

  const cargarPagina = async (reiniciar = false) => {
    if (cargando) return;
    cargando = true;
    if (reiniciar) {
      offset = 0;
      resultados.innerHTML = '';
    }
    botonMas.disabled = true;
    estado.textContent = 'Buscando fotos…';

    try {
      const fuente = FUENTES[ultimaBusqueda.modulo];
      let consulta = clienteSupabase.from(fuente.table)
        .select(`id, id_activo, foto, ${fuente.order}`, { count: 'exact' })
        .not('foto', 'is', null)
        .order(fuente.order, { ascending: false })
        .range(offset, offset + TAMANO_PAGINA - 1);
      if (ultimaBusqueda.activo) consulta = consulta.eq('id_activo', Number(ultimaBusqueda.activo));

      const { data, error, count } = await consulta;
      if (error) throw error;

      const filas = data || [];
      const tarjetas = await Promise.all(filas.map(async fila => {
        const ruta = extraerRutaFoto(fila.foto);
        if (!ruta) return '';
        const { data: signed, error: signedError } = await clienteSupabase.storage
          .from('fotos-controles').createSignedUrl(ruta, 300);
        if (signedError || !signed?.signedUrl) return '';
        const fecha = fila[fuente.order] ? new Date(fila[fuente.order]).toLocaleString('es-AR') : 'Fecha no disponible';
        return `<article style="background:#1f2937;border:1px solid #374151;border-radius:10px;overflow:hidden">
          <a href="${escapar(signed.signedUrl)}" target="_blank" rel="noopener noreferrer" title="Abrir foto en tamaño completo">
            <img src="${escapar(signed.signedUrl)}" alt="Foto del control ${escapar(fila.id)}" loading="lazy" style="display:block;width:100%;height:190px;object-fit:contain;background:#111827">
          </a>
          <div style="padding:12px;font-size:13px;line-height:1.6">
            <strong>${escapar(fuente.label)}</strong><br>
            Activo: ${escapar(fila.id_activo)} · Control: ${escapar(fila.id)}<br>
            <span style="color:#9ca3af">${escapar(fecha)}</span>
          </div>
        </article>`;
      }));
      resultados.insertAdjacentHTML('beforeend', tarjetas.filter(Boolean).join(''));
      offset += filas.length;
      const total = count ?? offset;
      estado.textContent = filas.length
        ? `Mostrando ${Math.min(offset, total)} de ${total} registros con foto.`
        : (offset ? 'No hay más fotos para mostrar.' : 'No se encontraron fotos para esos filtros.');
      botonMas.style.display = filas.length === TAMANO_PAGINA && offset < total ? 'block' : 'none';
    } catch (error) {
      console.error('[Centinela] Error consultando historial de fotos:', error);
      estado.textContent = 'No se pudo cargar el historial. Verifica tu conexión y tus permisos.';
    } finally {
      cargando = false;
      botonMas.disabled = false;
    }
  };

  form.addEventListener('submit', event => {
    event.preventDefault();
    ultimaBusqueda = {
      modulo: contenedor.querySelector('#historial-fotos-modulo').value,
      activo: contenedor.querySelector('#historial-fotos-activo').value.trim(),
    };
    cargarPagina(true);
  });
  botonMas.addEventListener('click', () => cargarPagina(false));
}
