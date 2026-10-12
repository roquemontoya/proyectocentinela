// ==========================================
// MÓDULO BASE: Controles y Formularios Comunes
// ==========================================

import { clienteSupabase } from './supabaseClient.js';

function coordenadasActivoControl(activo) {
    const latRaw = activo?.latitud ?? activo?.lat;
    const lngRaw = activo?.longitud ?? activo?.lng ?? activo?.lon ?? activo?.long;
    if (latRaw !== null && latRaw !== undefined && lngRaw !== null && lngRaw !== undefined &&
        String(latRaw).trim() !== '' && String(lngRaw).trim() !== '') {
        const lat = Number(latRaw), lng = Number(lngRaw);
        if (Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) return [lat, lng];
    }
    const raw = activo?.ubicacion_wkt ?? activo?.ubicacion ?? activo?.['ubicación'] ??
        activo?.geom ?? activo?.coordenadas ?? activo?.coordenada ?? activo?.wkt;
    if (typeof raw !== 'string') return null;
    let match = raw.trim().match(/^POINT\s*(?:Z\s*)?\(\s*(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s*\)$/i);
    if (match) {
        const lng = Number(match[1]), lat = Number(match[2]);
        if (Math.abs(lat) <= 90 && Math.abs(lng) <= 180) return [lat, lng];
    }
    match = raw.trim().match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/);
    if (match) {
        const a = Number(match[1]), b = Number(match[2]);
        if (Math.abs(a) <= 90 && Math.abs(b) <= 180) return [a, b];
        if (Math.abs(b) <= 90 && Math.abs(a) <= 180) return [b, a];
    }
    return null;
}

function distanciaEntreCoordenadas(a, b) {
    const rad = n => n * Math.PI / 180;
    const dLat = rad(b[0] - a[0]), dLng = rad(b[1] - a[1]);
    const x = Math.sin(dLat / 2) ** 2 +
        Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(dLng / 2) ** 2;
    return 6371000 * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

function formatoDistanciaControl(metros) {
    return metros < 1000 ? Math.round(metros) + ' m' :
        (metros / 1000).toLocaleString('es-AR', { maximumFractionDigits: 2 }) + ' km';
}

// Muestra la distancia al activo en el modal común; la posición solo se procesa en el dispositivo.
export function actualizarDistanciaActivoControl(activo) {
    const panel = document.getElementById('distancia-activo-control');
    if (!panel) return;
    panel.style.display = 'block';
    panel.textContent = 'Calculando distancia desde tu ubicación…';
    const destino = coordenadasActivoControl(activo);
    if (!destino) {
        panel.textContent = 'Distancia no disponible: este activo no tiene coordenadas puntuales reconocibles.';
        return;
    }
    if (!navigator.geolocation) {
        panel.textContent = 'Este dispositivo o navegador no ofrece geolocalización.';
        return;
    }
    const solicitud = (panel.dataset.solicitud = String(Number(panel.dataset.solicitud || 0) + 1));
    navigator.geolocation.getCurrentPosition(pos => {
        if (!panel.isConnected || panel.dataset.solicitud !== solicitud) return;
        const origen = [pos.coords.latitude, pos.coords.longitude];
        const distancia = distanciaEntreCoordenadas(origen, destino);
        const precision = Math.round(Number(pos.coords.accuracy) || 0);
        panel.textContent = 'Distancia en línea recta: ' + formatoDistanciaControl(distancia) +
            (precision ? ' · precisión GPS aproximada ±' + precision + ' m' : '') +
            '. No representa distancia recorrida por caminos.';
    }, error => {
        if (!panel.isConnected || panel.dataset.solicitud !== solicitud) return;
        const motivo = error.code === 1 ? 'Permiso de ubicación denegado.' :
            error.code === 2 ? 'Ubicación no disponible.' : 'Se agotó el tiempo para obtener la ubicación.';
        panel.textContent = motivo + ' Activá el GPS y los permisos de ubicación para calcular la distancia.';
    }, { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 });
}


export function verificarEstadoControl() {
    const inputEstado = document.getElementById('input-estado');
    if (!inputEstado) return; // Los formularios, como Extintores, pueden no tener estado general compartido.
    const estado = inputEstado.value;
    const tipoControl = document.getElementById('input-tipocontrol')?.value;
    const pruebaAprobada = document.getElementById('input-pruebaaprobada')?.value;
    const pruebaFallida = (tipoControl === 'Anual' || tipoControl === 'A Solicitud') && pruebaAprobada === 'No';
    const requiereAnomalia = estado === 'Anomalo' || pruebaFallida;
    const bloqueAnomalia = document.getElementById('bloque-anomalia');
    const razonInput = document.getElementById('input-anomalia-razon');
    const inputReportadoPor = document.getElementById('input-reportado-por');

    if (bloqueAnomalia) {
        if (requiereAnomalia) {
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
    const contenedorBomberoPrueba = document.getElementById('grid-seleccion-bombero-prueba');
    const contenedorReportado = document.getElementById('grid-seleccion-reportado');
    const inputRealizo = document.getElementById('input-realizo');
    const inputRealizoPrueba = document.getElementById('input-realizo-prueba');
    const inputReportadoPor = document.getElementById('input-reportado-por');
    
    if (contenedorBomberos) contenedorBomberos.innerHTML = '<p style="color: #aaa; font-size: 13px;">Cargando personal...</p>';
    if (contenedorBomberoPrueba) contenedorBomberoPrueba.innerHTML = '<p style="color: #aaa; font-size: 13px;">Cargando personal...</p>';
    if (contenedorReportado) contenedorReportado.innerHTML = '<p style="color: #aaa; font-size: 13px;">Cargando personal...</p>';
    
    if (inputRealizo) inputRealizo.value = '';
    if (inputRealizoPrueba) inputRealizoPrueba.value = '';
    if (inputReportadoPor) inputReportadoPor.value = '';

    const fallbackAvatar = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='150' height='150'><rect width='100%' height='100%' fill='%23333'/><text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' fill='%23aaa' font-family='sans-serif' font-size='12'>Sin Foto</text></svg>";

    const { data, error } = await clienteSupabase
        .from('Bomberos')
        .select('*')
        .eq('Estado', 'Activo')
        .order('Bombero', { ascending: true });

    if (error || !data) {
        if (contenedorBomberos) contenedorBomberos.innerHTML = '<p style="color: #ef4444; font-size: 13px;">Error al cargar personal</p>';
        if (contenedorBomberoPrueba) contenedorBomberoPrueba.innerHTML = '<p style="color: #ef4444; font-size: 13px;">Error al cargar personal</p>';
        if (contenedorReportado) contenedorReportado.innerHTML = '<p style="color: #ef4444; font-size: 13px;">Error al cargar personal</p>';
        return;
    }

    if (contenedorBomberos) contenedorBomberos.innerHTML = '';
    if (contenedorBomberoPrueba) contenedorBomberoPrueba.innerHTML = '';
    if (contenedorReportado) contenedorReportado.innerHTML = '';

    const bomberosActivos = data.filter(b => (b.Estado || '').trim().toLowerCase() === 'activo');
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

        // Tarjeta Bombero que realiza la prueba funcional (selector independiente del inspector general).
        if (contenedorBomberoPrueba) {
            const tarjetaPrueba = document.createElement('div');
            tarjetaPrueba.className = 'tarjeta-bombero-prueba-select';
            tarjetaPrueba.style.cssText = 'min-width:80px;max-width:80px;background:#2a2a2a;border:2px solid #444;border-radius:8px;padding:8px 4px;text-align:center;cursor:pointer;flex-shrink:0;transition:all .2s ease;';
            tarjetaPrueba.innerHTML = `
                <img src="${fotoUrl}" alt="${b.Bombero}" style="width:45px;height:45px;border-radius:50%;object-fit:cover;margin-bottom:4px;border:1px solid #555;" onerror="this.src='${fallbackAvatar}'">
                <div style="font-size:11px;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="${b.Bombero}">${b.Bombero.split(' ')[0]}</div>
            `;
            tarjetaPrueba.onclick = function() {
                contenedorBomberoPrueba.querySelectorAll('.tarjeta-bombero-prueba-select').forEach(t => {
                    t.style.background = '#2a2a2a';
                    t.style.borderColor = '#444';
                });
                tarjetaPrueba.style.background = '#38bdf822';
                tarjetaPrueba.style.borderColor = '#38bdf8';
                if (inputRealizoPrueba) inputRealizoPrueba.value = b.Bombero;
            };
            contenedorBomberoPrueba.appendChild(tarjetaPrueba);
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
    const panelDistancia = document.getElementById('distancia-activo-control');
    if (panelDistancia) { panelDistancia.dataset.solicitud = String(Number(panelDistancia.dataset.solicitud || 0) + 1); panelDistancia.style.display = 'none'; panelDistancia.textContent = ''; }
    const modal = document.getElementById('modal-control');
    if (modal) modal.style.display = 'none';
    const form = document.getElementById('form-nuevo-control');
    if (form) form.reset();
    verificarEstadoControl();
}

export async function subirFotoStorage(fotoInput) {
    if (!fotoInput) return null;

    const tiposPermitidos = ['image/jpeg', 'image/png', 'image/webp'];
    if (!tiposPermitidos.includes(fotoInput.type)) {
        throw new Error('Formato de foto no permitido. Usa JPG, PNG o WebP.');
    }
    if (fotoInput.size > 10 * 1024 * 1024) {
        throw new Error('La foto supera el límite de 10 MB.');
    }

    const extension = (fotoInput.name.split('.').pop() || 'jpg')
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '');
    const nombreArchivo = `${Date.now()}_${Math.random().toString(36).slice(2, 10)}.${extension}`;

    const { error: uploadError } = await clienteSupabase.storage
        .from('fotos-controles')
        .upload(nombreArchivo, fotoInput, { upsert: false, contentType: fotoInput.type });

    if (uploadError) {
        throw new Error('Error al subir la foto: ' + uploadError.message);
    }

    // Guardar la ruta del objeto, nunca una URL pública del bucket privado.
    return nombreArchivo;
}

// Estilo transversal de títulos de controles según el estado del elemento.
export function aplicarTituloControl(titulo, modulo, etiqueta, estado) {
    if (!titulo) return;
    const nombreModulo = String(modulo || '').trim();
    let nombreEtiqueta = String(etiqueta || '').trim();
    // Algunas etiquetas LEU ya incluyen el tipo genérico ("Extintor ...").
    // Evitamos duplicarlo en el título.
    if (nombreModulo && nombreEtiqueta.toLowerCase().startsWith(nombreModulo.toLowerCase() + ' ')) {
        nombreEtiqueta = nombreEtiqueta.slice(nombreModulo.length).trim();
    }
    titulo.textContent = nombreEtiqueta ? `Control ${nombreModulo} ${nombreEtiqueta}` : `Control ${nombreModulo}`;
    const e = String(estado || '').toLowerCase();
    titulo.style.color = (e.includes('vencido') || e.includes('anómalo') || e.includes('anomalo') || e.includes('no operativo'))
        ? '#ef4444'
        : (e.includes('por vencer') || e.includes('observado')) ? '#eab308' : '#22c55e';
}
