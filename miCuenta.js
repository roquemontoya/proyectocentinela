import { clienteSupabase } from './supabaseClient.js';
import { abrirSeguridadCuenta } from './seguridadCuenta.js';
import {
  obtenerPreferenciasVisuales,
  aplicarPreferenciasVisuales,
  guardarPreferenciasVisuales,
  restaurarPreferenciasVisuales
} from './preferenciasVisuales.js';

const OPCIONES_ACENTO = [
  ['#38bdf8', 'Celeste'], ['#22c55e', 'Verde'], ['#a78bfa', 'Violeta'],
  ['#f97316', 'Naranja'], ['#f43f5e', 'Rosa'], ['#eab308', 'Amarillo'],
  ['#06b6d4', 'Turquesa'], ['#f8fafc', 'Blanco']
];

export async function cargarModuloMiCuenta(root) {
  root.innerHTML = `
    <section class="centinela-mi-cuenta" style="max-width:820px;margin:24px auto;padding:clamp(16px,3vw,26px);background:#1e1e1e;border:1px solid #383838;border-radius:14px;color:#e5e7eb;font-family:inherit;box-sizing:border-box">
      <h2 style="margin-top:0">👤 Mi cuenta</h2>
      <p style="color:#9ca3af">Personalizá tu experiencia. Tu rol y permisos solo los administra personal autorizado.</p>
      <p id="cuenta-msg" role="status" aria-live="polite"></p>
      <section style="margin:18px 0;padding:16px;background:#111827;border:1px solid #374151;border-radius:10px">
        <h3 style="margin:0 0 8px">🎨 Apariencia y accesibilidad</h3>
        <p style="font-size:13px;color:#9ca3af;margin-top:0">Los cambios se aplican a toda la aplicación y se guardan en tu cuenta para mantenerlos al iniciar sesión en otro dispositivo.</p>
        <form id="cuenta-preferencias">
          <div class="cuenta-preferencias-grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:14px">
            <label for="pref-tema">Modo de pantalla
              <select id="pref-tema" style="display:block;width:100%;padding:10px;margin-top:6px;border-radius:7px">
                <option value="dark">Noche / oscuro</option><option value="light">Día / claro</option><option value="system">Automático según el dispositivo</option>
              </select>
            </label>
            <label for="pref-fuente">Tipografía
              <select id="pref-fuente" style="display:block;width:100%;padding:10px;margin-top:6px;border-radius:7px">
                <option value="system">Sistema (recomendada)</option><option value="Arial">Arial</option><option value="Verdana">Verdana</option><option value="Tahoma">Tahoma</option><option value="Georgia">Georgia</option><option value="monospace">Monoespaciada</option>
              </select>
            </label>
            <label for="pref-tamano">Tamaño del texto
              <select id="pref-tamano" style="display:block;width:100%;padding:10px;margin-top:6px;border-radius:7px">
                <option value="small">Pequeño</option><option value="normal">Normal</option><option value="large">Grande</option>
              </select>
            </label>
            <label for="pref-densidad">Espaciado de menús
              <select id="pref-densidad" style="display:block;width:100%;padding:10px;margin-top:6px;border-radius:7px">
                <option value="comfortable">Cómodo</option><option value="compact">Compacto</option>
              </select>
            </label>
            <label for="pref-contraste">Contraste
              <select id="pref-contraste" style="display:block;width:100%;padding:10px;margin-top:6px;border-radius:7px">
                <option value="normal">Normal</option><option value="high">Alto contraste</option>
              </select>
            </label>
          </div>
          <fieldset style="margin:16px 0 10px;padding:12px;border:1px solid #4b5563;border-radius:8px">
            <legend>Color de acento</legend>
            <div id="pref-colores" style="display:flex;flex-wrap:wrap;gap:10px"></div>
            <p id="pref-color-nombre" style="font-size:12px;color:#9ca3af;margin-bottom:0"></p>
          </fieldset>
          <div style="display:flex;flex-wrap:wrap;gap:10px;margin-top:14px">
            <button id="pref-guardar" type="submit" style="padding:10px 14px;background:var(--centinela-accent,#0c4a6e);color:#07111c;border:1px solid var(--centinela-accent,#38bdf8);border-radius:8px;font-weight:600">Guardar preferencias</button>
            <button id="pref-restaurar" type="button" style="padding:10px 14px;background:transparent;color:inherit;border:1px solid #64748b;border-radius:8px">Restablecer valores</button>
          </div>
          <p id="pref-msg" role="status" aria-live="polite" style="font-size:13px;margin-bottom:0"></p>
        </form>
      </section>
      <section style="margin:18px 0;padding:16px;background:#111827;border:1px solid #374151;border-radius:10px">
        <h3 style="margin:0 0 8px">🔐 Seguridad de acceso</h3>
        <p style="font-size:13px;color:#9ca3af">Configurá la verificación en dos pasos de tu cuenta.</p>
        <button id="cuenta-seguridad" type="button" style="padding:10px 14px;background:#0c4a6e;color:white;border:1px solid #38bdf8;border-radius:8px">Configurar seguridad</button>
      </section>
      <form id="cuenta-form">
        <h3>Datos personales</h3>
        <label for="cuenta-email">Correo de acceso</label><input id="cuenta-email" readonly style="width:100%;padding:10px;margin:6px 0 14px;box-sizing:border-box">
        <label for="cuenta-nombre">Nombre completo</label><input id="cuenta-nombre" required minlength="2" maxlength="120" style="width:100%;padding:10px;margin:6px 0 14px;box-sizing:border-box">
        <label for="cuenta-legajo">Legajo (solo lectura)</label><input id="cuenta-legajo" readonly style="width:100%;padding:10px;margin:6px 0 14px;box-sizing:border-box">
        <label for="cuenta-telefono">Teléfono de contacto</label><input id="cuenta-telefono" maxlength="40" style="width:100%;padding:10px;margin:6px 0 14px;box-sizing:border-box">
        <button id="cuenta-guardar" type="submit" style="padding:11px 16px;background:var(--centinela-accent,#0c4a6e);color:#07111c;border:1px solid var(--centinela-accent,#38bdf8);border-radius:8px">Guardar datos</button>
      </form>
    </section>`;

  const msg = root.querySelector('#cuenta-msg');
  const prefMsg = root.querySelector('#pref-msg');
  root.querySelector('#cuenta-seguridad')?.addEventListener('click', abrirSeguridadCuenta);

  let prefs = await obtenerPreferenciasVisuales();
  const controls = {
    appearance: root.querySelector('#pref-tema'),
    font: root.querySelector('#pref-fuente'),
    fontSize: root.querySelector('#pref-tamano'),
    density: root.querySelector('#pref-densidad'),
    contrast: root.querySelector('#pref-contraste')
  };
  const colors = root.querySelector('#pref-colores');

  function pintarColores() {
    colors.innerHTML = '';
    for (const [hex, name] of OPCIONES_ACENTO) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.title = name;
      btn.setAttribute('aria-label', 'Color de acento ' + name);
      btn.setAttribute('aria-pressed', String(prefs.accent === hex));
      btn.style.cssText = `width:32px;height:32px;border-radius:50%;border:3px solid ${prefs.accent === hex ? 'var(--centinela-accent)' : 'rgba(148,163,184,.55)'};background:${hex};cursor:pointer;outline:${prefs.accent === hex ? '2px solid currentColor' : 'none'};outline-offset:2px`;
      btn.addEventListener('click', () => {
        prefs = { ...prefs, accent: hex };
        aplicarPreferenciasVisuales(prefs);
        pintarColores();
        root.querySelector('#pref-color-nombre').textContent = 'Seleccionado: ' + name;
      });
      colors.appendChild(btn);
    }
    const selected = OPCIONES_ACENTO.find(([hex]) => hex === prefs.accent);
    root.querySelector('#pref-color-nombre').textContent = selected ? 'Seleccionado: ' + selected[1] : '';
  }

  function syncControls() {
    for (const [key, control] of Object.entries(controls)) control.value = prefs[key];
    pintarColores();
    aplicarPreferenciasVisuales(prefs);
  }
  syncControls();
  for (const [key, control] of Object.entries(controls)) {
    control.addEventListener('change', () => {
      prefs = { ...prefs, [key]: control.value };
      aplicarPreferenciasVisuales(prefs);
    });
  }

  root.querySelector('#cuenta-preferencias').addEventListener('submit', async e => {
    e.preventDefault();
    const btn = root.querySelector('#pref-guardar');
    btn.disabled = true; btn.textContent = 'Guardando…'; prefMsg.textContent = '';
    try {
      prefs = { ...prefs, ...Object.fromEntries(Object.entries(controls).map(([key, control]) => [key, control.value])) };
      await guardarPreferenciasVisuales(prefs);
      prefMsg.textContent = 'Preferencias guardadas en tu cuenta.';
      prefMsg.style.color = '#86efac';
    } catch (err) {
      prefMsg.textContent = err.message || 'No se pudieron guardar las preferencias.';
      prefMsg.style.color = '#fca5a5';
    } finally { btn.disabled = false; btn.textContent = 'Guardar preferencias'; }
  });

  root.querySelector('#pref-restaurar').addEventListener('click', async () => {
    try {
      prefs = await restaurarPreferenciasVisuales();
      syncControls();
      prefMsg.textContent = 'Se restauraron las preferencias predeterminadas.';
      prefMsg.style.color = '#86efac';
    } catch (err) {
      prefMsg.textContent = err.message || 'No se pudieron restaurar las preferencias.';
      prefMsg.style.color = '#fca5a5';
    }
  });

  try {
    const { data: auth, error: authError } = await clienteSupabase.auth.getUser();
    if (authError) throw authError;
    const user = auth?.user;
    if (!user) throw new Error('La sesión no está activa. Ingresá nuevamente.');
    const { data: perfilData, error } = await clienteSupabase.rpc('obtener_mi_perfil_personal');
    const p = Array.isArray(perfilData) ? perfilData[0] : perfilData;
    if (error) throw error;
    if (!p) throw new Error('No se encontró el perfil o la política de acceso impide consultarlo. Contactá al administrador.');
    root.querySelector('#cuenta-email').value = user.email || '';
    root.querySelector('#cuenta-nombre').value = p.nombre_completo || '';
    root.querySelector('#cuenta-legajo').value = p.legajo || 'No informado';
    root.querySelector('#cuenta-telefono').value = p.telefono || '';
    root.querySelector('#cuenta-form').addEventListener('submit', async e => {
      e.preventDefault();
      const btn = root.querySelector('#cuenta-guardar');
      btn.disabled = true; btn.textContent = 'Guardando…'; msg.textContent = '';
      try {
        const nombre = root.querySelector('#cuenta-nombre').value.trim();
        const telefono = root.querySelector('#cuenta-telefono').value.trim();
        if (nombre.length < 2) throw new Error('El nombre debe tener al menos 2 caracteres.');
        const { data: savedData, error: saveError } = await clienteSupabase.rpc('actualizar_mi_perfil_personal', { p_nombre: nombre, p_telefono: telefono || null });
        const data = Array.isArray(savedData) ? savedData[0] : savedData;
        if (saveError) throw saveError;
        if (!data) throw new Error('No se guardaron cambios. Revisar la política de acceso de app_user_profiles.');
        msg.textContent = 'Datos personales guardados correctamente.';
        msg.style.color = '#86efac';
      } catch (err) { msg.textContent = err.message || 'No se pudieron guardar los cambios.'; msg.style.color = '#fca5a5'; }
      finally { btn.disabled = false; btn.textContent = 'Guardar datos'; }
    });
  } catch (err) { msg.textContent = err.message || 'No se pudo cargar el perfil.'; msg.style.color = '#fca5a5'; }
}
