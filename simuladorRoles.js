// Simulador visual de roles: exclusivo del Superadministrador.
// No modifica la sesión, el rol de Supabase ni las políticas RLS.
import { ROLES, READ_ONLY_ROLES, permisoVisualParaRol } from './config/rolesConfig.js';

let rolReal = null;
let rolSimulado = null;

export function obtenerRolSimulado() { return rolSimulado; }
export function esSimulacionSoloLectura() { return Boolean(rolSimulado && READ_ONLY_ROLES.has(rolSimulado)); }
export function moduloPermitidoEnSimulacion(modulo) { return !rolSimulado || permisoVisualParaRol(rolSimulado, modulo); }
function permisoParaRol(rol, modulo) { return permisoVisualParaRol(rol, modulo); }
function etiquetaRol(rol) { return ROLES.find(({id}) => id === rol)?.label || rol; }

function renderDashboard(rol) {
  const main = document.getElementById('main-content');
  if (!main) return;
  const role = rolSimulado || rol || rolReal;
  const perfil = ROLES.find(item => item.id === role) || ROLES.find(item => item.id === 'bombero_inspector');
  main.innerHTML = '';
  perfil.cards.forEach(([id, emoji, label]) => {
    if (!permisoParaRol(role, id)) return;
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'card';
    card.setAttribute('aria-label', label);
    const icon = document.createElement('div');
    icon.className = 'card-img';
    icon.textContent = emoji;
    const title = document.createElement('div');
    title.className = 'card-title';
    title.textContent = label;
    card.append(icon, title);
    card.addEventListener('click', () => window.cargarModulo(id));
    main.appendChild(card);
  });
}

function asegurarPanel() {
  const navUsuarios = document.getElementById('nav-administracion-usuarios');
  if (!navUsuarios || document.getElementById('centinela-role-simulator')) return;
  const panel = document.createElement('details');
  panel.id = 'centinela-role-simulator';
  panel.className = 'role-simulator-inline';
  panel.innerHTML = '<summary>🧪 Simulador de roles</summary><div class="role-simulator-body"><label for="role-simulator-select">Ver Centinela como:</label><select id="role-simulator-select"><option value="">Superadministrador (real)</option></select><p id="role-simulator-status">Vista real de Superadministrador</p><button type="button" id="role-simulator-return">Volver a Superadministrador</button><small>Solo cambia la interfaz. La sesión y los permisos del servidor no cambian.</small></div>';
  navUsuarios.appendChild(panel);
  panel.addEventListener('click', event => event.stopPropagation());
  const select = panel.querySelector('#role-simulator-select');
  ROLES.filter(({id}) => id !== 'superadministrador').forEach(({id,label}) => {
    const option = document.createElement('option'); option.value = id; option.textContent = label; select.appendChild(option);
  });
  select.addEventListener('change', () => cambiarRol(select.value || null));
  panel.querySelector('#role-simulator-return').addEventListener('click', () => { select.value = ''; cambiarRol(null); });
}
function cambiarRol(rol) {
  rolSimulado = rol;
  const panel = document.getElementById('centinela-role-simulator');
  if (panel) {
    panel.classList.toggle('is-simulating', Boolean(rol));
    panel.querySelector('#role-simulator-status').textContent = rol ? 'Simulando: ' + etiquetaRol(rol) : 'Vista real de Superadministrador';
    panel.querySelector('#role-simulator-select').value = rol || '';
  }
  aplicarVista(rol || rolReal);
  renderDashboard(rol || rolReal);
  const vista = document.getElementById('vista-dinamica');
  if (vista && vista.style.display !== 'none') window.irInicio?.();
}
function aplicarVista(rol) {
  document.querySelectorAll('#side-menu .drawer-list li, #main-content .card').forEach(el => {
    const match = (el.getAttribute('onclick') || '').match(/cargarModulo\(['"]([^'"]+)['"]\)/);
    if (match) el.style.display = permisoParaRol(rol, match[1]) ? '' : 'none';
  });
  const esAdmin = rol === 'administrador' || rol === 'superadministrador';
  document.querySelectorAll('.menu-solo-admin').forEach(el => { el.style.display = esAdmin ? '' : 'none'; });
  for (const id of ['nav-gestor-tablas','nav-cmu','nav-administracion-usuarios']) {
    const el = document.getElementById(id);
    if (el) el.style.display = esAdmin ? '' : 'none';
  }
  const fotos = document.getElementById('nav-historial-fotos');
  if (fotos) fotos.style.display = (rol === 'bomberos' || rol === 'bombero_inspector') ? 'none' : (permisoParaRol(rol,'historialFotos') ? '' : 'none');
  const inicio = document.getElementById('main-content');
  if (inicio) inicio.dataset.vistaRol = rol || '';
  document.body.classList.toggle('role-view-simulated', Boolean(rolSimulado));
}
export function inicializarSimuladorRoles(rol) {
  rolReal = rol;
  const panel = document.getElementById('centinela-role-simulator');
  if (rol !== 'superadministrador') {
    if (panel) panel.remove();
    rolSimulado = null;
    return;
  }
  asegurarPanel();
  const p = document.getElementById('centinela-role-simulator');
  if (p) p.style.display = 'block';
  aplicarVista(rolSimulado || rolReal);
  renderDashboard(rolSimulado || rolReal);
}
window.centinelaSimuladorRoles = { obtenerRolSimulado, moduloPermitidoEnSimulacion, esSimulacionSoloLectura };
