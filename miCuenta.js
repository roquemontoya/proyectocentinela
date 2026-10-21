import { clienteSupabase } from './supabaseClient.js';

export async function cargarModuloMiCuenta(root) {
  root.innerHTML = '<section style="max-width:720px;margin:24px auto;padding:24px;background:#1e1e1e;border:1px solid #383838;border-radius:14px;color:#e5e7eb;font-family:Arial,sans-serif"><h2>👤 Mi cuenta</h2><p style="color:#9ca3af">Personalizá tus datos de contacto. Tu rol y permisos solo los administra personal autorizado.</p><p id="cuenta-msg" role="status"></p><form id="cuenta-form"><label>Correo de acceso</label><input id="cuenta-email" readonly style="width:100%;padding:10px;margin:6px 0 14px;box-sizing:border-box"><label>Nombre completo</label><input id="cuenta-nombre" required minlength="2" maxlength="120" style="width:100%;padding:10px;margin:6px 0 14px;box-sizing:border-box"><label>Legajo (solo lectura)</label><input id="cuenta-legajo" readonly style="width:100%;padding:10px;margin:6px 0 14px;box-sizing:border-box"><label>Teléfono de contacto</label><input id="cuenta-telefono" maxlength="40" style="width:100%;padding:10px;margin:6px 0 14px;box-sizing:border-box"><button id="cuenta-guardar" type="submit" style="padding:11px 16px;background:#0c4a6e;color:white;border:1px solid #38bdf8;border-radius:8px">Guardar cambios</button></form></section>';
  const msg = root.querySelector('#cuenta-msg');
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
      finally { btn.disabled = false; btn.textContent = 'Guardar cambios'; }
    });
  } catch (err) { msg.textContent = err.message || 'No se pudo cargar el perfil.'; msg.style.color = '#fca5a5'; }
}
