// ==========================================
// MÓDULO: Cliente de Supabase
// ==========================================

const supabaseUrl = 'https://zgzhudcdxoentmfgdncf.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpnemh1ZGNkeG9lbnRtZmdkbmNmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ2OTU4MzgsImV4cCI6MjEwMDI3MTgzOH0.f1_BZa7BjMxRSc74WIK4A3NwjhBJM9sCjEGe_KpztLg';

// Inicializamos y exportamos el cliente global listo para ser importado
export const clienteSupabase = window.supabase.createClient(supabaseUrl, supabaseKey, { auth: { experimental: { passkey: true } } });