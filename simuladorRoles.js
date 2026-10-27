// Simulador visual de roles: exclusivo del Superadministrador.
// No modifica la sesión, el rol de Supabase ni las políticas RLS.
const ROLES = [
  ['administrador', 'Administrador'], ['supervisor', 'Supervisor'],
  ['bombero_inspector', 'Bombero / Inspector'], ['bomberos', 'Bombero'],
  ['bombero_referente', 'Bombero Referente'], ['mantenimiento', 'Mantenimiento'],
  ['jefe_seguridad_patrimonial', 'Jefe Seguridad Patrimonial'], ['jefe_guardia_fisica', 'Jefe Guardia Física'],
  ['jefe_prevencion_incendios', 'Jefe Prevención de Incendios'], ['jefe_rhp', 'Jefe RHP'], ['gerencia', 'Gerencia']
];
const MODULOS_BOMBEROS = new Set(['ecas','extintores','hidrantes','valvulas','vecas','pecas','ipp','pulmon']);
const SOLO_LECTURA = new Set(['bombero_referente','jefe_seguridad_patrimonial','jefe_guardia_fisica','jefe_prevencion_incendios','jefe_rhp','gerencia']);
const MODULOS_LECTURA = new Set(['extintores','pulmon','bomberos','anomalias','historialfotos','hidrantes','ecas','valvulas','vecas','pecas','ipp','estadisticas','reportes','historialcontroles']);
let rolReal = null;
let rolSimulado = null;
let panelMinimizado = false;

export function obtenerRolSimulado() { return rolSimulado; }
export function esSimulacionSoloLectura() { return Boolean(rolSimulado && SOLO_LECTURA.has(rolSimulado)); }
export function moduloPermitidoEnSimulacion(modulo) { return !rolSimulado || permisoParaRol(rolSimulado, modulo); }
function permisoParaRol(rol, modulo) {
  const nombre = String(modulo || '').toLowerCase();
  if (rol === 'administrador' || rol === 'superadministrador') return true;
  if (nombre === 'mayordomo001' || ['administracionusuarios','admincsv','gestortablas'].includes(nombre)) return false;
  if (SOLO_LECTURA.has(rol)) return MODULOS_LECTURA.has(nombre);
  if (rol === 'bomberos' || rol === 'bombero_inspector') return MODULOS_BOMBEROS.has(nombre);
  return ['supervisor','mantenimiento'].includes(rol);
}
function etiquetaRol(rol) { return ROLES.find(([id]) => id === rol)?.[1] || rol; }
const DASHBOARD = {
 superadministrador:[['panelGeografico','🌐','Mapa de supervisión'],['anomalias','⚠️','Seguimiento de anomalías'],['extintores','🧯','Extintores en planta'],['pulmon','📦','Pulmón / reserva'],['hidrantes','🚰','Hidrantes'],['recorridosGps','🧭','Recorridos y caminos internos'],['bomberos','👨‍🚒','Personal / Bomberos'],['mayordomo001','🛡️','Auditoría del sistema']],
 administrador:[['anomalias','⚠️','Seguimiento de anomalías'],['pulmon','📦','Pulmón / reserva'],['extintores','🧯','Extintores en planta'],['hidrantes','🚰','Hidrantes'],['bomberos','👨‍🚒','Personal / Bomberos'],['panelGeografico','🌐','Mapa de supervisión']],
 supervisor:[['panelGeografico','🌐','Mapa de supervisión'],['anomalias','⚠️','Seguimiento de anomalías'],['recorridosGps','🧭','Recorridos y caminos internos'],['extintores','🧯','Extintores en planta'],['hidrantes','🚰','Hidrantes'],['pulmon','📦','Pulmón / reserva']],
 bombero_inspector:[['extintores','🧯','Extintores en planta'],['hidrantes','🚰','Hidrantes'],['pulmon','📦','Pulmón / reserva'],['ecas','📋','ECAS'],['valvulas','⚙️','Válvulas'],['vecas','⚙️','VECAS'],['pecas','🔧','PECAS'],['ipp','👷','IPP'],['recorridosGps','🧭','Recorridos GPS']],
 bomberos:[['extintores','🧯','Extintores en planta'],['hidrantes','🚰','Hidrantes'],['pulmon','📦','Pulmón / reserva'],['ecas','📋','ECAS'],['valvulas','⚙️','Válvulas'],['vecas','⚙️','VECAS'],['pecas','🔧','PECAS'],['ipp','👷','IPP'],['recorridosGps','🧭','Recorridos GPS']],
 bombero_referente:[['extintores','🧯','Estado de extintores'],['pulmon','📦','Pulmón / reserva'],['hidrantes','🚰','Hidrantes'],['anomalias','⚠️','Seguimiento de anomalías'],['historialFotos','📷','Historial de controles']],
 mantenimiento:[['extintores','🧯','Extintores en planta'],['pulmon','📦','Pulmón / reserva'],['hidrantes','🚰','Hidrantes'],['ecas','📋','ECAS'],['valvulas','⚙️','Válvulas']],
 jefe_seguridad_patrimonial:[['panelGeografico','🌐','Mapa de supervisión'],['anomalias','⚠️','Seguimiento de anomalías'],['extintores','🧯','Estado de extintores'],['hidrantes','🚰','Hidrantes']],
 jefe_guardia_fisica:[['panelGeografico','🌐','Mapa de supervisión'],['recorridosGps','🧭','Recorridos GPS'],['gps','🛰️','Ubicación GPS'],['anomalias','⚠️','Seguimiento de anomalías']],
 jefe_prevencion_incendios:[['panelGeografico','🌐','Mapa de supervisión'],['anomalias','⚠️','Seguimiento de anomalías'],['extintores','🧯','Estado de extintores'],['pulmon','📦','Pulmón / reserva']],
 jefe_rhp:[['anomalias','⚠️','Seguimiento de anomalías'],['extintores','🧯','Estado de extintores'],['pulmon','📦','Pulmón / reserva']],
 gerencia:[['panelGeografico','🌐','Mapa de supervisión'],['anomalias','⚠️','Seguimiento de anomalías'],['extintores','🧯','Estado de extintores'],['pulmon','📦','Pulmón / reserva']]
};
function renderDashboard(rol){
 const main=document.getElementById('main-content'); if(!main)return;
 const role=rolSimulado||rol||rolReal; const items=DASHBOARD[role]||DASHBOARD.bombero_inspector; main.innerHTML='';
 items.forEach(item=>{const id=item[0];if(!permisoParaRol(role,id))return;const card=document.createElement('button');card.type='button';card.className='card';card.setAttribute('aria-label',item[2]);const icon=document.createElement('div');icon.className='card-img';icon.textContent=item[1];const title=document.createElement('div');title.className='card-title';title.textContent=item[2];card.append(icon,title);card.addEventListener('click',()=>window.cargarModulo(id));main.appendChild(card);});
}

function asegurarPanel() {
  const navUsuarios = document.getElementById('nav-administracion-usuarios');
  if (!navUsuarios) return;
  if (document.getElementById('centinela-role-simulator')) return;
  const panel = document.createElement('details');
  panel.id = 'centinela-role-simulator';
  panel.className = 'role-simulator-inline';
  panel.innerHTML = '<summary>🧪 Simulador de roles</summary><div class="role-simulator-body"><label for="role-simulator-select">Ver Centinela como:</label><select id="role-simulator-select"><option value="">Superadministrador (real)</option></select><p id="role-simulator-status">Vista real de Superadministrador</p><button type="button" id="role-simulator-return">Volver a Superadministrador</button><small>Solo cambia la interfaz. La sesión y los permisos del servidor no cambian.</small></div>';
  navUsuarios.appendChild(panel);
  panel.addEventListener('click', event => event.stopPropagation());
  const select = panel.querySelector('#role-simulator-select');
  ROLES.forEach(([id, label]) => { const option = document.createElement('option'); option.value = id; option.textContent = label; select.appendChild(option); });
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
