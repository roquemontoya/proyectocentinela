import { clienteSupabase } from './supabaseClient.js';

export async function cargarModuloMiCuenta(contenedor) {
  contenedor.textContent = 'Cargando Mi cuenta…';
  const { data, error } = await clienteSupabase.auth.getUser();
  if (error || !data?.user) {
    contenedor.textContent = 'Iniciá sesión nuevamente para consultar tu cuenta.';
    return;
  }
  contenedor.textContent = 'Mi cuenta: ' + (data.user.email || 'usuario');
}
