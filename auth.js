// Autenticación y control de acceso de Centinela 2.0.
// Bomberos permanece sin login durante la fase de pruebas.
// Administrador y Superadministrador usan Supabase Auth + rol asignado en la base.

import { clienteSupabase } from './supabaseClient.js';
import { verificarSegundoFactor } from './seguridadCuenta.js';

let rolActual = null;

const MODULOS_BOMBEROS = new Set([
  'ecas', 'extintores', 'hidrantes', 'valvulas', 'vecas', 'pecas', 'ipp', 'pulmon'
]);

function mostrarError(mensaje) {
  const el = document.getElementById('auth-error');
  if (el) {
    el.textContent = mensaje;
    el.style.display = 'block';
  }
}

function limpiarError() {
  const el = document.getElementById('auth-error');
  if (el) {
    el.textContent = '';
    el.style.display = 'none';
  }
}

function mostrarPantallaAcceso() {
  rolActual = null;
  const acceso = document.getElementById('auth-screen');
  const header = document.querySelector('.app-header');
  const menu = document.getElementById('side-menu');
  const overlay = document.getElementById('drawer-overlay');
  const principal = document.getElementById('main-content');
  const vista = document.getElementById('vista-dinamica');
  const modal = document.getElementById('modal-control');
  if (acceso) acceso.style.display = 'flex';
  if (header) header.style.display = 'none';
  if (menu) menu.style.display = 'none';
  if (overlay) overlay.style.display = 'none';
  if (principal) principal.style.display = 'none';
  if (vista) { vista.style.display = 'none'; vista.innerHTML = ''; }
  if (modal) modal.style.display = 'none';
}

function mostrarAplicacion(rol) {
  rolActual = rol;
  const acceso = document.getElementById('auth-screen');
  const header = document.querySelector('.app-header');
  const menu = document.getElementById('side-menu');
  const overlay = document.getElementById('drawer-overlay');
  const principal = document.getElementById('main-content');
  if (acceso) acceso.style.display = 'none';
  if (header) header.style.display = 'flex';
  if (menu) menu.style.display = '';
  if (overlay) overlay.style.display = '';
  if (principal) principal.style.display = 'grid';
  aplicarPermisosInterfaz(rol);
}

async function resolverRolAutenticado() {
  const { data, error } = await clienteSupabase.rpc('current_user_role');
  const rolesAdmitidos = new Set(['administrador', 'superadministrador', 'supervisor', 'bombero_inspector', 'mantenimiento', 'bomberos', 'bombero_referente', 'jefe_seguridad_patrimonial', 'jefe_guardia_fisica', 'jefe_prevencion_incendios', 'jefe_rhp', 'gerencia']);
  if (!error && data === 'bomberos') return 'bombero_inspector';
  if (!error && typeof data === 'string' && rolesAdmitidos.has(data)) return data;

  // Compatibilidad temporal mientras la migración de roles se despliega en Supabase.
  const { data: esSuper, error: errorSuper } = await clienteSupabase.rpc('current_user_has_role', { p_role: 'superadministrador' });
  if (!errorSuper && esSuper === true) return 'superadministrador';
  const { data: esAdmin, error: errorAdmin } = await clienteSupabase.rpc('current_user_has_role', { p_role: 'administrador' });
  if (!errorAdmin && esAdmin === true) return 'administrador';
  return null;
}

export async function inicializarAutenticacion() {
  mostrarPantallaAcceso();
  limpiarError();
  rolActual = null;

  // Los enlaces de invitación/restablecimiento deben conservar la sesión temporal
  // creada por Supabase para permitir que la persona establezca su contraseña.
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const query = new URLSearchParams(window.location.search);
  const tipoEnlace = hash.get('type');
  const flujoCredencial = ['invite', 'recovery', 'signup', 'magiclink'].includes(tipoEnlace) || query.has('code');

  if (flujoCredencial) {
    if (query.has('code')) {
      const { error: exchangeError } = await clienteSupabase.auth.exchangeCodeForSession(query.get('code'));
      if (exchangeError) { mostrarError('El enlace de recuperación venció, ya fue utilizado o su destino no está autorizado. Solicitá un enlace nuevo.'); return; }
    } else if (hash.has('access_token') && hash.has('refresh_token')) {
      const { error: sessionError } = await clienteSupabase.auth.setSession({ access_token: hash.get('access_token'), refresh_token: hash.get('refresh_token') });
      if (sessionError) { mostrarError('El enlace de acceso venció o ya fue utilizado. Solicitá uno nuevo.'); return; }
    }
    const { data, error } = await clienteSupabase.auth.getSession();
    if (error || !data?.session) {
      mostrarError('El enlace de invitación o contraseña venció o ya fue utilizado. Solicitá un nuevo correo de acceso.');
      return;
    }
    const login = document.getElementById('form-login');
    const setup = document.getElementById('form-password-setup');
    if (login) login.style.display = 'none';
    const passkey = document.getElementById('btn-login-passkey');
    const reset = document.getElementById('btn-reset-password');
    if (passkey) passkey.style.display = 'none';
    if (reset) reset.style.display = 'none';
    if (setup) setup.style.display = 'block';
    const titulo = document.getElementById('password-setup-title');
    if (titulo) titulo.textContent = tipoEnlace === 'recovery' ? 'Establecer nueva contraseña' : 'Activar cuenta';
    return;
  }

  // Para uso normal en equipos compartidos, no restaurar una sesión anterior.
  const { error } = await clienteSupabase.auth.signOut();
  if (error) {
    mostrarError('No se pudo cerrar la sesión anterior. Cerrá esta pestaña y volvé a abrir Centinela.');
  }
}

export async function iniciarSesion(event) {
  if (event) event.preventDefault();
  limpiarError();

  const email = document.getElementById('login-email')?.value.trim() || '';
  const password = document.getElementById('login-password')?.value || '';
  if (!email || !password) {
    mostrarError('Ingresá el correo y la contraseña de tu cuenta de Centinela.');
    return;
  }

  const boton = document.getElementById('btn-login');
  if (boton) { boton.disabled = true; boton.textContent = 'Verificando…'; }

  try {
    const { data: loginData, error } = await clienteSupabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    if (loginData.user?.app_metadata?.must_change_password === true) {
      const login = document.getElementById('form-login');
      const passkey = document.getElementById('btn-login-passkey');
      const reset = document.getElementById('btn-reset-password');
      const setup = document.getElementById('form-password-setup');
      if (login) login.style.display = 'none';
      if (passkey) passkey.style.display = 'none';
      if (reset) reset.style.display = 'none';
      if (setup) setup.style.display = 'block';
      const title = document.getElementById('password-setup-title');
      if (title) title.textContent = 'Cambio obligatorio de contraseña';
      const currentLabel = document.getElementById('setup-current-label');
      const current = document.getElementById('setup-current-password');
      if (currentLabel) currentLabel.style.display = 'block';
      if (current) { current.style.display = 'block'; current.required = true; }
      const submit = document.getElementById('btn-set-password');
      if (submit) submit.textContent = 'Cambiar contraseña y continuar';
      return;
    }

    let segundoFactorCorrecto = false;
    try {
      segundoFactorCorrecto = await verificarSegundoFactor();
    } catch (mfaError) {
      await clienteSupabase.auth.signOut();
      throw new Error('No se pudo completar la verificación de seguridad. Revisá la configuración de 2FA e intentá nuevamente.');
    }
    if (!segundoFactorCorrecto) {
      await clienteSupabase.auth.signOut();
      throw new Error('No se completó el segundo factor. Ingresá nuevamente e intentá con un código vigente.');
    }

    const rol = await resolverRolAutenticado();
    if (!rol) {
      await clienteSupabase.auth.signOut();
      throw new Error('La cuenta autenticó correctamente, pero no tiene un perfil autorizado asignado. Un administrador debe asignarle el perfil correspondiente en Administración de usuarios.');
    }

    document.getElementById('login-password').value = '';
    mostrarAplicacion(rol);
  } catch (error) {
    mostrarError(error?.message || 'No se pudo iniciar sesión.');
  } finally {
    if (boton) { boton.disabled = false; boton.textContent = 'Ingresar'; }
  }
}

export async function iniciarSesionPasskey() {
  limpiarError();
  const boton = document.getElementById('btn-login-passkey');
  if (boton) { boton.disabled = true; boton.textContent = 'Esperando huella / PIN…'; }
  try {
    if (!clienteSupabase.auth.signInWithPasskey) {
      throw new Error('Esta versión de Supabase no admite llaves de acceso. Actualizá la aplicación.');
    }
    const { error } = await clienteSupabase.auth.signInWithPasskey();
    if (error) throw error;

    let segundoFactorCorrecto = false;
    try {
      segundoFactorCorrecto = await verificarSegundoFactor();
    } catch {
      await clienteSupabase.auth.signOut();
      throw new Error('No se pudo completar el segundo factor. Intentá nuevamente.');
    }
    if (!segundoFactorCorrecto) {
      await clienteSupabase.auth.signOut();
      throw new Error('No se completó la verificación adicional de la cuenta.');
    }

    const rol = await resolverRolAutenticado();
    if (!rol) {
      await clienteSupabase.auth.signOut();
      throw new Error('La cuenta autenticó, pero no tiene un perfil autorizado asignado.');
    }
    mostrarAplicacion(rol);
  } catch (error) {
    mostrarError(error?.message || 'No se pudo ingresar con la llave de acceso. Verificá que Passkeys esté habilitado en Supabase y que este dominio esté autorizado.');
  } finally {
    if (boton) { boton.disabled = false; boton.textContent = 'Ingresar con huella / llave de acceso'; }
  }
}

export async function solicitarAccesoInicial() {
  limpiarError();
  const email = document.getElementById('login-email')?.value.trim() || '';
  if (!email) {
    mostrarError('Ingresá primero el correo de la cuenta para enviarte el enlace de activación o recuperación.');
    return;
  }
  const boton = document.getElementById('btn-reset-password');
  if (boton) { boton.disabled = true; boton.textContent = 'Enviando…'; }
  try {
    const { error } = await clienteSupabase.auth.resetPasswordForEmail(email, {
      redirectTo: 'https://proyectocentinela.vercel.app/'
    });
    if (error) throw error;
    mostrarError('Si el correo corresponde a una cuenta registrada, Supabase enviará un enlace para establecer la contraseña. Revisá también Spam.');
    const el = document.getElementById('auth-error');
    if (el) { el.style.display = 'block'; el.style.background = '#12351f'; el.style.borderColor = '#166534'; el.style.color = '#bbf7d0'; }
  } catch (error) {
    mostrarError(error?.message || 'No se pudo solicitar el enlace. Intentá nuevamente.');
  } finally {
    if (boton) { boton.disabled = false; boton.textContent = 'Primer ingreso / olvidé mi contraseña'; }
  }
}

export async function establecerContrasena(event) {
  if (event) event.preventDefault();
  limpiarError();
  const password = document.getElementById('setup-password')?.value || '';
  const confirm = document.getElementById('setup-password-confirm')?.value || '';
  const currentPassword = document.getElementById('setup-current-password')?.value || '';
  const { data: sessionInfo } = await clienteSupabase.auth.getSession();
  const currentUser = sessionInfo?.session?.user;
  const forcedChange = currentUser?.app_metadata?.must_change_password === true;
  if (forcedChange && !currentPassword) { mostrarError('Ingresá la contraseña temporal actual.'); return; }
  if (password.length < 10) {
    mostrarError('La contraseña debe tener al menos 10 caracteres.');
    return;
  }
  if (password !== confirm) {
    mostrarError('Las contraseñas no coinciden.');
    return;
  }
  const boton = document.getElementById('btn-set-password');
  if (boton) { boton.disabled = true; boton.textContent = 'Guardando…'; }
  try {
    if (forcedChange) {
      const email = currentUser?.email || '';
      const { error: reauthError } = await clienteSupabase.auth.signInWithPassword({ email, password: currentPassword });
      if (reauthError) throw new Error('La contraseña temporal actual no es correcta.');
    }
    const { error } = await clienteSupabase.auth.updateUser({ password });
    if (error) throw error;
    if (forcedChange) {
      const { data: completion, error: completionError } = await clienteSupabase.functions.invoke('administrar-usuarios', {
        body: { action: 'complete_temporary_password', password }
      });
      if (completionError || completion?.error) throw new Error('La contraseña se actualizó, pero no se pudo confirmar el cambio obligatorio. Volvé a ingresar y contactá a Administración.');
    }
    const currentInput = document.getElementById('setup-current-password');
    if (currentInput) { currentInput.value = ''; currentInput.required = false; currentInput.style.display = 'none'; }
    const currentLabel = document.getElementById('setup-current-label');
    if (currentLabel) currentLabel.style.display = 'none';
    let segundoFactorCorrecto = false;
    try {
      segundoFactorCorrecto = await verificarSegundoFactor();
    } catch {
      await clienteSupabase.auth.signOut();
      throw new Error('La contraseña se actualizó, pero no se pudo completar la verificación de seguridad. Ingresá nuevamente y completá el segundo factor.');
    }
    if (!segundoFactorCorrecto) {
      await clienteSupabase.auth.signOut();
      throw new Error('La contraseña se actualizó, pero falta completar el segundo factor. Ingresá nuevamente.');
    }
    const rol = await resolverRolAutenticado();
    if (!rol) {
      await clienteSupabase.auth.signOut();
      throw new Error('La contraseña quedó establecida, pero la cuenta no tiene un perfil autorizado. Pedí al administrador que revise el perfil asignado.');
    }
    const form = document.getElementById('setup-password');
    if (form) form.value = '';
    const confirmInput = document.getElementById('setup-password-confirm');
    if (confirmInput) confirmInput.value = '';
    window.history.replaceState({}, document.title, window.location.pathname);
    mostrarAplicacion(rol);
  } catch (error) {
    mostrarError(error?.message || 'No se pudo establecer la contraseña. Solicitá un enlace nuevo si este venció.');
  } finally {
    if (boton) { boton.disabled = false; boton.textContent = 'Establecer contraseña'; }
  }
}

export async function cerrarSesion() {
  await clienteSupabase.auth.signOut();
  rolActual = null;
  mostrarPantallaAcceso();
  limpiarError();
  const email = document.getElementById('login-email');
  const password = document.getElementById('login-password');
  if (email) email.value = '';
  if (password) password.value = '';
}

export function obtenerRolActual() {
  return rolActual;
}

export function verificarPermisoModulo(modulo) {
  const nombre = String(modulo || '').toLowerCase();
  if (rolActual === 'administrador' || rolActual === 'superadministrador') return true;
  if (nombre === 'mayordomo001') return false;
  if (['administracionusuarios', 'admincsv', 'gestortablas'].includes(nombre)) return false;
  if (rolActual === 'bombero_referente' || esRolJefaturaSoloLectura(rolActual)) return new Set(['extintores','pulmon','bomberos','anomalias','historialfotos','hidrantes','ecas','valvulas','vecas','pecas','ipp','estadisticas','reportes','historialcontroles']).has(nombre);
  if (rolActual === 'bomberos' || rolActual === 'bombero_inspector') return MODULOS_BOMBEROS.has(nombre);
  return ['supervisor', 'mantenimiento'].includes(rolActual);
}

export function aplicarPermisosInterfaz(rol = rolActual) {
  const esAdmin = rol === 'administrador' || rol === 'superadministrador';
  const esBombero = rol === 'bomberos' || rol === 'bombero_inspector';
  const esReferente = rol === 'bombero_referente' || esRolJefaturaSoloLectura(rol);
  document.querySelectorAll('#side-menu .drawer-list li, #main-content .card').forEach(elemento => {
    const accion = elemento.getAttribute('onclick') || '';
    const coincidencia = accion.match(/cargarModulo\\(['"]([^'"]+)['"]\\)/);
    if (coincidencia) elemento.style.display = verificarPermisoModuloParaRol(rol, coincidencia[1]) ? '' : 'none';
  });
  document.querySelectorAll('.menu-solo-admin').forEach(el => { el.style.display = esAdmin ? '' : 'none'; });
  for (const id of ['nav-gestor-tablas', 'nav-cmu', 'nav-historial-fotos', 'nav-administracion-usuarios']) {
    const elemento = document.getElementById(id);
    if (elemento) elemento.style.display = id === 'nav-historial-fotos' ? (esBombero && !esReferente ? 'none' : '') : (esAdmin ? '' : 'none');
  }
  const botonSalir = document.getElementById('btn-logout');
  if (botonSalir) botonSalir.textContent = 'Cerrar sesión';
}

function esRolJefaturaSoloLectura(rol) { return new Set(['jefe_seguridad_patrimonial','jefe_guardia_fisica','jefe_prevencion_incendios','jefe_rhp','gerencia']).has(rol); }

function verificarPermisoModuloParaRol(rol, modulo) {
  const nombre = String(modulo || '').toLowerCase();
  if (rol === 'administrador' || rol === 'superadministrador') return true;
  if (nombre === 'mayordomo001') return false;
  if (['administracionusuarios', 'admincsv', 'gestortablas'].includes(nombre)) return false;
  if (rol === 'bombero_referente' || esRolJefaturaSoloLectura(rol)) return new Set(['extintores','pulmon','bomberos','anomalias','historialfotos','hidrantes','ecas','valvulas','vecas','pecas','ipp','estadisticas','reportes','historialcontroles']).has(nombre);
  if (rol === 'bomberos' || rol === 'bombero_inspector') return MODULOS_BOMBEROS.has(nombre);
  return ['supervisor', 'mantenimiento'].includes(rol);
}

window.iniciarSesion = iniciarSesion;
window.iniciarSesionPasskey = iniciarSesionPasskey;
window.solicitarAccesoInicial = solicitarAccesoInicial;
window.establecerContrasena = establecerContrasena;
window.cerrarSesion = cerrarSesion;
