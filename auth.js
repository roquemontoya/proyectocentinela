// Autenticación y control de acceso de Centinela 2.0.
// Bomberos permanece sin login durante la fase de pruebas.
// Administrador y Superadministrador usan Supabase Auth + rol asignado en la base.

import { clienteSupabase } from './supabaseClient.js';

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
  const { data: esSuper, error: errorSuper } = await clienteSupabase
    .rpc('current_user_has_role', { p_role: 'superadministrador' });
  if (!errorSuper && esSuper === true) return 'superadministrador';

  const { data: esAdmin, error: errorAdmin } = await clienteSupabase
    .rpc('current_user_has_role', { p_role: 'administrador' });
  if (!errorAdmin && esAdmin === true) return 'administrador';
  return null;
}

export async function inicializarAutenticacion() {
  mostrarPantallaAcceso();
  limpiarError();

  const { data, error } = await clienteSupabase.auth.getSession();
  if (error) {
    mostrarError('No se pudo verificar la sesión. Puedes continuar como Bomberos o volver a intentar.');
    return;
  }
  if (!data?.session) return;

  const rol = await resolverRolAutenticado();
  if (rol) {
    mostrarAplicacion(rol);
  } else {
    await clienteSupabase.auth.signOut();
    mostrarError('La cuenta no tiene un rol administrativo asignado. Solicita al Superadministrador que habilite tu acceso.');
  }
}

export function continuarComoBombero() {
  limpiarError();
  mostrarAplicacion('bomberos');
}

export async function iniciarSesion(event) {
  if (event) event.preventDefault();
  limpiarError();

  const email = document.getElementById('login-email')?.value.trim() || '';
  const password = document.getElementById('login-password')?.value || '';
  if (!email || !password) {
    mostrarError('Ingresa el correo y la contraseña de tu cuenta administrativa.');
    return;
  }

  const boton = document.getElementById('btn-login');
  if (boton) { boton.disabled = true; boton.textContent = 'Verificando…'; }

  try {
    const { error } = await clienteSupabase.auth.signInWithPassword({ email, password });
    if (error) throw error;

    const rol = await resolverRolAutenticado();
    if (!rol) {
      await clienteSupabase.auth.signOut();
      throw new Error('La cuenta autenticó correctamente, pero no tiene el rol Administrador o Superadministrador asignado.');
    }

    document.getElementById('login-password').value = '';
    mostrarAplicacion(rol);
  } catch (error) {
    mostrarError(error?.message || 'No se pudo iniciar sesión.');
  } finally {
    if (boton) { boton.disabled = false; boton.textContent = 'Ingresar'; }
  }
}

export async function cerrarSesion() {
  if (rolActual !== 'bomberos') {
    await clienteSupabase.auth.signOut();
  }
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
  if (rolActual === 'administrador' || rolActual === 'superadministrador') return true;
  return rolActual === 'bomberos' && MODULOS_BOMBEROS.has(String(modulo || '').toLowerCase());
}

export function aplicarPermisosInterfaz(rol = rolActual) {
  const esBombero = rol === 'bomberos';
  document.querySelectorAll('#side-menu .drawer-list li, #main-content .card').forEach(elemento => {
    const accion = elemento.getAttribute('onclick') || '';
    const coincidencia = accion.match(/cargarModulo\(['"]([^'"]+)['"]\)/);
    if (coincidencia) elemento.style.display = (!esBombero || MODULOS_BOMBEROS.has(coincidencia[1])) ? '' : 'none';
  });

  // Estos módulos se agregan dinámicamente al menú principal.
  for (const id of ['nav-gestor-tablas', 'nav-cmu', 'nav-historial-fotos']) {
    const elemento = document.getElementById(id);
    if (elemento) elemento.style.display = esBombero ? 'none' : '';
  }

  const botonSalir = document.getElementById('btn-logout');
  if (botonSalir) botonSalir.textContent = esBombero ? 'Salir' : 'Cerrar sesión';
}

window.continuarComoBombero = continuarComoBombero;
window.iniciarSesion = iniciarSesion;
window.cerrarSesion = cerrarSesion;
