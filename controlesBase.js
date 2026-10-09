// ==========================================
// MÓDULO BASE: Controles y Formularios Comunes
// ==========================================

import { clienteSupabase } from './supabaseClient.js';

export function verificarEstadoControl() {
    const inputEstado = document.getElementById('input-estado');
    if (!inputEstado) return; // Los formularios, como Extintores, pueden no tener estado general compartido.
    const estado = inputEstado.value;
    const bloqueAnomalia = document.getElementById('bloque-anomalia');
    const razonInput = document.getElementById('input-anomalia-razon');
    const inputReportadoPor = document.getElementById('input-reportado-por');

    if (bloqueAnomalia) {
        if (estado === 'Anomalo') {
            bloqueAnomalia.style.display = 'block';
            if (razonInput) razonInput.setAttribute('required', 'true');
            if (inputReportadoPor) inputReportadoPor.setAttribute('required', 'true');
            
            const inputFecha = document.getElementById('input-reportado-fecha');
            if (inputFecha && !inputFecha.value) {
                inputFecha.value = new Date().toISOString().split('T')[0];
            }
        } else {
            bloqueAnomalia.style.display = 'none';
            if (razonInput) {
                razonInput.removeAttribute('required');
                razonInput.value = '';
            }
            if (inputReportadoPor) {
                inputReportadoPor.removeAttribute('required');
                inputReportadoPor.value = '';
            }
            const eventoNum = document.getElementById('input-evento-numero');
            if (eventoNum) eventoNum.value = '';
            const repFecha = document.getElementById('input-reportado-fecha');
            if (repFecha) repFecha.value = '';
            
            document.querySelectorAll('.tarjeta-reportado-select').forEach(t => {
                t.style.background = '#2a2a2a';
                t.style.borderColor = '#444';
            });
        }
    }
}

export async function cargarBomberosEnModal() {
    const contenedorBomberos = document.getElementById('grid-seleccion-bombero');
    const contenedorReportado = document.getElementById('grid-seleccion-reportado');
    const inputRealizo = document.getElementById('input-realizo');
    const inputReportadoPor = document.getElementById('input-reportado-por');
    
    if (contenedorBomberos) contenedorBomberos.innerHTML = '<p style="color: #aaa; font-size: 13px;">Cargando personal...</p>';
    if (contenedorReportado) contenedorReportado.innerHTML = '<p style="color: #aaa; font-size: 13px;">Cargando personal...</p>';
    
    if (inputRealizo) inputRealizo.value = '';
    if (inputReportadoPor) inputReportadoPor.value = '';

    const fallbackAvatar = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='150' height='150'><rect width='100%' height='100%' fill='%23333'/><text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' fill='%23aaa' font-family='sans-serif' font-size='12'>Sin Foto</text></svg>";

    const { data, error } = await clienteSupabase
        .from('Bomberos')
        .select('*')
        .order('Bombero', { ascending: true });

    if (error || !data) {
        if (contenedorBomberos) contenedorBomberos.innerHTML = '<p style="color: #ef4444; font-size: 13px;">Error al cargar personal</p>';
        if (contenedorReportado) contenedorReportado.innerHTML = '<p style="color: #ef4444; font-size: 13px;">Error al cargar personal</p>';
        return;
    }

    if (contenedorBomberos) contenedorBomberos.innerHTML = '';
    if (contenedorReportado) contenedorReportado.innerHTML = '';

    const bomberosActivos = data.filter(b => (b.Estado || '').toLowerCase() === 'activo');
    let inspectorPreseleccionado = localStorage.getItem('centinela_inspector') || '';

    bomberosActivos.forEach(b => {
        let fotoUrl = b.Foto;
        if (fotoUrl && !fotoUrl.startsWith('http')) {
            fotoUrl = `https://zgzhudcdxoentmfgdncf.supabase.co/storage/v1/object/public/FotosBomberos/${fotoUrl}`;
        }
        if (!fotoUrl) fotoUrl = fallbackAvatar;

        // Tarjeta Inspector (Realizado por)
        if (contenedorBomberos) {
            const tarjeta = document.createElement('div');
            tarjeta.className = 'tarjeta-bombero-select';
            tarjeta.style.cssText = 'min-width: 80px; max-width: 80px; background: #2a2a2a; border: 2px solid #444; border-radius: 8px; padding: 8px 4px; text-align: center; cursor: pointer; flex-shrink: 0; transition: all 0.2s ease;';
            tarjeta.innerHTML = `
                <img src="${fotoUrl}" alt="${b.Bombero}" style="width: 45px; height: 45px; border-radius: 50%; object-fit: cover; margin-bottom: 4px; border: 1px solid #555;" onerror="this.src='${fallbackAvatar}'">
                <div style="font-size: 11px; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${b.Bombero}">${b.Bombero.split(' ')[0]}</div>
            `;
            tarjeta.onclick = function() {
                document.querySelectorAll('.tarjeta-bombero-select').forEach(t => {
                    t.style.background = '#2a2a2a';
                    t.style.borderColor = '#444';
                });
                tarjeta.style.background = '#22c55e22';
                tarjeta.style.borderColor = '#22c55e';
                if (inputRealizo) inputRealizo.value = b.Bombero;
            };
            contenedorBomberos.appendChild(tarjeta);

            if (b.Bombero.toLowerCase() === inspectorPreseleccionado.toLowerCase()) {
                tarjeta.click();
            }
        }

        // Tarjeta Reportado Por (Anomalías)
        if (contenedorReportado) {
            const tarjetaRep = document.createElement('div');
            tarjetaRep.className = 'tarjeta-reportado-select';
            tarjetaRep.style.cssText = 'min-width: 80px; max-width: 80px; background: #2a2a2a; border: 2px solid #444; border-radius: 8px; padding: 8px 4px; text-align: center; cursor: pointer; flex-shrink: 0; transition: all 0.2s ease;';
            tarjetaRep.innerHTML = `
                <img src="${fotoUrl}" alt="${b.Bombero}" style="width: 45px; height: 45px; border-radius: 50%; object-fit: cover; margin-bottom: 4px; border: 1px solid #555;" onerror="this.src='${fallbackAvatar}'">
                <div style="font-size: 11px; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${b.Bombero}">${b.Bombero.split(' ')[0]}</div>
            `;
            tarjetaRep.onclick = function() {
                document.querySelectorAll('.tarjeta-reportado-select').forEach(t => {
                    t.style.background = '#2a2a2a';
                    t.style.borderColor = '#444';
                });
                tarjetaRep.style.background = '#ef444422';
                tarjetaRep.style.borderColor = '#ef4444';
                if (inputReportadoPor) inputReportadoPor.value = b.Bombero;
            };
            contenedorReportado.appendChild(tarjetaRep);
        }
    });

    if (inputRealizo && !inputRealizo.value && contenedorBomberos && contenedorBomberos.firstChild) {
        contenedorBomberos.firstChild.click();
    }
}

export function cerrarFormularioControl() {
    const modal = document.getElementById('modal-control');
    if (modal) modal.style.display = 'none';
    const form = document.getElementById('form-nuevo-control');
    if (form) form.reset();
    verificarEstadoControl();
}

export async function subirFotoStorage(fotoInput) {
    if (!fotoInput) return null;
    const nombreArchivo = `${Date.now()}_${fotoInput.name.replace(/\s+/g, '_')}`;
    const { error: uploadError } = await clienteSupabase.storage
        .from('fotos-controles')
        .upload(nombreArchivo, fotoInput);

    if (uploadError) {
        throw new Error('Error al subir la foto: ' + uploadError.message);
    }

    const { data: urlData } = clienteSupabase.storage
        .from('fotos-controles')
        .getPublicUrl(nombreArchivo);

    return urlData.publicUrl;
}

// Estilo transversal de títulos de controles según el estado del elemento.
export function aplicarTituloControl(titulo, modulo, etiqueta, estado) {
    if (!titulo) return;
    const nombreModulo = String(modulo || '').trim();
    const nombreEtiqueta = String(etiqueta || '').trim();
    titulo.textContent = nombreEtiqueta ? `Control ${nombreModulo} ${nombreEtiqueta}` : `Control ${nombreModulo}`;
    const e = String(estado || '').toLowerCase();
    titulo.style.color = (e.includes('vencido') || e.includes('anómalo') || e.includes('anomalo') || e.includes('no operativo'))
        ? '#ef4444'
        : (e.includes('por vencer') || e.includes('observado')) ? '#eab308' : '#22c55e';
}
