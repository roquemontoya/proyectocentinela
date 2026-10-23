import { clienteSupabase } from './supabaseClient.js';

const DEFAULTS = {
  appearance: 'dark',
  accent: '#38bdf8',
  font: 'Arial',
  fontSize: 'normal',
  density: 'comfortable',
  contrast: 'normal'
};

const STORAGE_PREFIX = 'centinela-preferencias-visuales';

function normalizar(p = {}) {
  const valid = {
    appearance: ['dark', 'light', 'system'],
    accent: ['#38bdf8', '#22c55e', '#a78bfa', '#f97316', '#f43f5e', '#eab308', '#06b6d4', '#f8fafc'],
    font: ['Arial', 'system', 'Verdana', 'Tahoma', 'Georgia', 'monospace'],
    fontSize: ['small', 'normal', 'large'],
    density: ['compact', 'comfortable'],
    contrast: ['normal', 'high']
  };
  const out = { ...DEFAULTS };
  for (const key of Object.keys(valid)) {
    if (valid[key].includes(p[key])) out[key] = p[key];
  }
  return out;
}

function clave(userId) {
  return `${STORAGE_PREFIX}:${userId || 'local'}`;
}

export async function obtenerPreferenciasVisuales(userId) {
  try {
    const { data: { user } = {} } = await clienteSupabase.auth.getUser();
    const uid = userId || user?.id || 'local';
    const remote = user?.user_metadata?.centinela_preferences;
    const local = JSON.parse(localStorage.getItem(clave(uid)) || '{}');
    return normalizar({ ...local, ...(remote || {}) });
  } catch {
    return normalizar();
  }
}

export function aplicarPreferenciasVisuales(preferencias) {
  const p = normalizar(preferencias);
  const root = document.documentElement;
  root.dataset.centinelaTheme = p.appearance;
  root.dataset.centinelaDensity = p.density;
  root.dataset.centinelaContrast = p.contrast;
  root.style.setProperty('--centinela-accent', p.accent);
  root.style.setProperty('--centinela-accent-rgb', hexRgb(p.accent));
  root.style.setProperty('--centinela-font', fontStack(p.font));
  root.style.setProperty('--centinela-font-size', p.fontSize === 'small' ? '14px' : p.fontSize === 'large' ? '18px' : '16px');
  try {
    const media = window.matchMedia('(prefers-color-scheme: light)');
    root.dataset.centinelaResolvedTheme = p.appearance === 'system' ? (media.matches ? 'light' : 'dark') : p.appearance;
  } catch {
    root.dataset.centinelaResolvedTheme = p.appearance === 'system' ? 'dark' : p.appearance;
  }
}

function hexRgb(hex) {
  const raw = hex.replace('#', '');
  const full = raw.length === 3 ? raw.split('').map(c => c + c).join('') : raw;
  const n = Number.parseInt(full, 16);
  return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`;
}

function fontStack(font) {
  return ({
    Arial: 'Arial, Helvetica, sans-serif',
    system: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    Verdana: 'Verdana, Geneva, sans-serif',
    Tahoma: 'Tahoma, Geneva, sans-serif',
    Georgia: 'Georgia, serif',
    monospace: '"Courier New", monospace'
  })[font] || DEFAULTS.font;
}

export async function guardarPreferenciasVisuales(preferencias) {
  const p = normalizar(preferencias);
  const { data: { user } = {}, error: userError } = await clienteSupabase.auth.getUser();
  if (userError) throw userError;
  if (!user) throw new Error('Iniciá sesión para guardar tus preferencias.');
  // La metadata solo almacena preferencias visuales; nunca se usa para permisos ni autorización.
  const metadata = { ...(user.user_metadata || {}), centinela_preferences: p };
  const { error } = await clienteSupabase.auth.updateUser({ data: metadata });
  if (error) throw error;
  try { localStorage.setItem(clave(user.id), JSON.stringify(p)); } catch { /* almacenamiento local opcional */ }
  aplicarPreferenciasVisuales(p);
  return p;
}

export function restaurarPreferenciasVisuales() {
  return guardarPreferenciasVisuales(DEFAULTS);
}

export async function inicializarPreferenciasVisuales() {
  const { data: { user } = {} } = await clienteSupabase.auth.getUser().catch(() => ({ data: {} }));
  const p = await obtenerPreferenciasVisuales(user?.id);
  aplicarPreferenciasVisuales(p);
  if (p.appearance === 'system') {
    try {
      window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => aplicarPreferenciasVisuales(p));
    } catch { /* navegador sin soporte */ }
  }
  return p;
}
