// Configuración compartida de presentación por rol para Centinela.
// Fuente declarativa para el dashboard, el simulador visual y Oculus.
// IMPORTANTE: esta configuración NO es una barrera de seguridad. auth.js y las políticas RLS
// de Supabase siguen siendo la autoridad para autorización real.
export const ROLES = [
  { id:'superadministrador', label:'Superadministrador', readOnly:false, cards:[['panelGeografico','🌐','Mapa de supervisión'],['anomalias','⚠️','Seguimiento de anomalías'],['extintores','🧯','Extintores en planta'],['pulmon','📦','Pulmón / reserva'],['hidrantes','🚰','Hidrantes'],['recorridosGps','🧭','Recorridos y caminos internos'],['bomberos','👨‍🚒','Personal / Bomberos'],['mayordomo001','🛡️','Auditoría del sistema']] },
  { id:'administrador', label:'Administrador', readOnly:false, cards:[['anomalias','⚠️','Seguimiento de anomalías'],['pulmon','📦','Pulmón / reserva'],['extintores','🧯','Extintores en planta'],['hidrantes','🚰','Hidrantes'],['bomberos','👨‍🚒','Personal / Bomberos'],['panelGeografico','🌐','Mapa de supervisión']] },
  { id:'supervisor', label:'Supervisor', readOnly:false, cards:[['panelGeografico','🌐','Mapa de supervisión'],['anomalias','⚠️','Seguimiento de anomalías'],['recorridosGps','🧭','Recorridos y caminos internos'],['extintores','🧯','Extintores en planta'],['hidrantes','🚰','Hidrantes'],['pulmon','📦','Pulmón / reserva']] },
  { id:'bombero_inspector', label:'Bombero / Inspector', readOnly:false, cards:[['extintores','🧯','Extintores en planta'],['hidrantes','🚰','Hidrantes'],['pulmon','📦','Pulmón / reserva'],['ecas','📋','ECAS'],['valvulas','⚙️','Válvulas'],['vecas','⚙️','VECAS'],['pecas','🔧','PECAS'],['ipp','👷','IPP'],['recorridosGps','🧭','Recorridos GPS']] },
  { id:'bomberos', label:'Bombero', readOnly:false, cards:[['extintores','🧯','Extintores en planta'],['hidrantes','🚰','Hidrantes'],['pulmon','📦','Pulmón / reserva'],['ecas','📋','ECAS'],['valvulas','⚙️','Válvulas'],['vecas','⚙️','VECAS'],['pecas','🔧','PECAS'],['ipp','👷','IPP'],['recorridosGps','🧭','Recorridos GPS']] },
  { id:'bombero_referente', label:'Bombero Referente', readOnly:true, cards:[['extintores','🧯','Estado de extintores'],['pulmon','📦','Pulmón / reserva'],['hidrantes','🚰','Hidrantes'],['anomalias','⚠️','Seguimiento de anomalías'],['historialFotos','📷','Historial de controles']] },
  { id:'mantenimiento', label:'Mantenimiento', readOnly:false, cards:[['extintores','🧯','Extintores en planta'],['pulmon','📦','Pulmón / reserva'],['hidrantes','🚰','Hidrantes'],['ecas','📋','ECAS'],['valvulas','⚙️','Válvulas']] },
  { id:'jefe_seguridad_patrimonial', label:'Jefe Seguridad Patrimonial', readOnly:true, cards:[['panelGeografico','🌐','Mapa de supervisión'],['anomalias','⚠️','Seguimiento de anomalías'],['extintores','🧯','Estado de extintores'],['hidrantes','🚰','Hidrantes']] },
  { id:'jefe_guardia_fisica', label:'Jefe Guardia Física', readOnly:true, cards:[['panelGeografico','🌐','Mapa de supervisión'],['recorridosGps','🧭','Recorridos GPS'],['gps','🛰️','Ubicación GPS'],['anomalias','⚠️','Seguimiento de anomalías']] },
  { id:'jefe_prevencion_incendios', label:'Jefe Prevención de Incendios', readOnly:true, cards:[['panelGeografico','🌐','Mapa de supervisión'],['anomalias','⚠️','Seguimiento de anomalías'],['extintores','🧯','Estado de extintores'],['pulmon','📦','Pulmón / reserva']] },
  { id:'jefe_rhp', label:'Jefe RHP', readOnly:true, cards:[['anomalias','⚠️','Seguimiento de anomalías'],['extintores','🧯','Estado de extintores'],['pulmon','📦','Pulmón / reserva']] },
  { id:'gerencia', label:'Gerencia', readOnly:true, cards:[['panelGeografico','🌐','Mapa de supervisión'],['anomalias','⚠️','Seguimiento de anomalías'],['extintores','🧯','Estado de extintores'],['pulmon','📦','Pulmón / reserva']] }
];

export const ROLE_IDS = Object.freeze(ROLES.map(({id}) => id));
export const READ_ONLY_ROLES = new Set(ROLES.filter(role => role.readOnly).map(({id}) => id));
export const MODULES_BOMBEROS = new Set(['ecas','extintores','hidrantes','valvulas','vecas','pecas','ipp','pulmon']);
export const READ_ONLY_MODULES = new Set(['extintores','pulmon','bomberos','anomalias','historialfotos','historialFotos','hidrantes','ecas','valvulas','vecas','pecas','ipp','estadisticas','reportes','historialcontroles']);
export const ADMIN_ONLY_MODULES = new Set(['administracionusuarios','administracionUsuarios','admincsv','adminCsv','gestortablas','gestorTablas','mayordomo001']);

export function permisoVisualParaRol(rol, modulo) {
  const nombre = String(modulo || '').toLowerCase();
  if (rol === 'administrador' || rol === 'superadministrador') return true;
  if (ADMIN_ONLY_MODULES.has(nombre)) return false;
  if (READ_ONLY_ROLES.has(rol)) return READ_ONLY_MODULES.has(nombre);
  if (rol === 'bomberos' || rol === 'bombero_inspector') return MODULES_BOMBEROS.has(nombre);
  return ['supervisor','mantenimiento'].includes(rol);
}

export function obtenerPerfilVisual(rol) {
  return ROLES.find(perfil => perfil.id === rol) || ROLES.find(perfil => perfil.id === 'bombero_inspector');
}
