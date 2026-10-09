// ==========================================
// MÓDULO: Controles de ECAS, PECAS, VECAS y Válvulas
// Mantiene el modal común y la relación LEU -> tabla de controles -> anomalías.
// ==========================================
import { clienteSupabase } from './supabaseClient.js';
import { aplicarTituloControl, cargarBomberosEnModal, cerrarFormularioControl, subirFotoStorage } from './controlesBase.js';

const CONFIG = {
  ecas: {
    categoria: 'ECAS', titulo: 'ECA', tabla: 'controles_ecas', origen: 'ECAS',
    campos: [
      {id:'estado', label:'Estado general', type:'select', options:['Conforme','Observado','No operativo'], column:'estado', source:['Estado','STATUS']},
      {id:'central_que_reporta', label:'Central que reporta', column:'central_que_reporta', source:['Central que reporta']},
      {id:'p_entrada', label:'Presión de entrada', column:'p_entrada', source:['P/ENTRADA']},
      {id:'p_salida', label:'Presión de salida', column:'p_salida', source:['P/SALIDA']},
      {id:'t_gong', label:'Tiempo de gong', column:'t_gong', source:['T/GONG']},
      {id:'t_central', label:'Tiempo de central', column:'t_central', source:['T central']},
      {id:'t_monitoreo', label:'Tiempo de monitoreo', column:'t_monitoreo', source:['T.monitoreo','T monitoreo']},
      {id:'rotulo_central', label:'Rótulo central', column:'rotulo_central', source:['ROTULO CENTRAL']},
      {id:'rotulo_base', label:'Rótulo base', column:'rotulo_base', source:['ROTULO BASE']},
      {id:'control_semana_n', label:'Semana de control', column:'control_semana_n', source:['CONTROL SEMANA N°','CONTROL SEMANA N']},
      {id:'p_entrada_semanal', label:'Presión entrada semanal', column:'p_entrada_semanal', source:['P/ Entrada Semanal']},
      {id:'p_salida_semanal', label:'Presión salida semanal', column:'p_salida_semanal', source:['P/ Salida Semanal']},
      {id:'parametros_reporte', label:'Parámetros / reporte', column:'parametros_reporte', source:['Parametros / Reporte 2025']},
      {id:'observaciones', label:'Observaciones del control', column:'observaciones', source:['Observacion','Observaciones']}
    ]
  },
  pecas: {
    categoria: 'Purgas ECAS (PECAS)', titulo: 'PECA / Purga', tabla: 'controles_pecas', origen: 'PECAS',
    campos: [
      {id:'estado', label:'Estado de la purga', type:'select', options:['Conforme','Observado','No operativo'], column:'estado'},
      {id:'habilitada', label:'¿Está habilitada?', type:'select', options:['Sí','No','No verificado'], column:'habilitada'},
      {id:'tiempo', label:'Tiempo de operación (segundos)', type:'number', column:'tiempo'},
      {id:'rotulo', label:'Rótulo / identificación', column:'rotulo'},
      {id:'cadena_candado', label:'Cadena y candado', type:'select', options:['Conforme','No conforme','No aplica'], column:'cadena_candado'},
      {id:'control_mensual', label:'Tipo de control', type:'select', options:['Mensual','Semanal','A solicitud'], column:'control_mensual'},
      {id:'observacion', label:'Observaciones específicas', type:'textarea', column:'observacion', source:['descripción','descripcion']}
    ]
  },
  vecas: {
    categoria: 'VECAS', titulo: 'VECAS', tabla: 'controles_vecas', origen: 'VECAS',
    campos: [
      {id:'estado', label:'Estado general', type:'select', options:['Conforme','Observado','No operativo'], column:'estado'},
      {id:'valvula_eca', label:'Válvula / ECA asociada', column:'valvula_eca', source:['Válvula ECA','Valvula ECA']},
      {id:'central_que_reporta', label:'Central que reporta', column:'central_que_reporta', source:['Central que reporta']},
      {id:'reporta', label:'Reporte recibido', type:'select', options:['Sí','No','No aplica'], column:'reporta'},
      {id:'tiempo', label:'Tiempo de operación (segundos)', type:'number', column:'tiempo'},
      {id:'rotulo', label:'Rótulo / identificación', column:'rotulo'},
      {id:'cadena_candado', label:'Cadena y candado', type:'select', options:['Conforme','No conforme','No aplica'], column:'cadena_candado'},
      {id:'comentario', label:'Observaciones específicas', type:'textarea', column:'comentario'}
    ]
  },
  valvulas: {
    categoria: 'Valvulas', titulo: 'Válvula', tabla: 'controles_v', origen: 'Válvulas',
    campos: [
      {id:'estado', label:'Estado general', type:'select', options:['Operativo','Observado','No operativo'], column:'estado'},
      {id:'tipo', label:'Tipo de válvula', column:'tipo', source:['Tipo']},
      {id:'nivel', label:'Nivel / posición', column:'nivel', source:['Nivel']},
      {id:'vueltas', label:'Vueltas de apertura', type:'number', column:'vueltas'},
      {id:'prueba_con', label:'Prueba realizada con', column:'prueba_con'},
      {id:'cadena_candado', label:'Cadena y candado', type:'select', options:['Conforme','No conforme','No aplica'], column:'cadena_candado'},
      {id:'chapa', label:'Chapa / identificación', type:'select', options:['Conforme','No conforme','No aplica'], column:'chapa'},
      {id:'programado', label:'Prueba programada', type:'select', options:['Sí','No'], column:'programado'},
      {id:'motivo', label:'Motivo / intervención', type:'textarea', column:'motivo'},
      {id:'informe', label:'Informe del control', type:'textarea', column:'informe'},
      {id:'observacion', label:'Observaciones', type:'textarea', column:'observacion'}
    ]
  }
};

let activoActual = null;
let moduloActual = null;

function normalizar(valor) {
  return String(valor ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}
function escapar(valor) {
  return String(valor ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function atributos(activo) {
  const a = activo?.atributos_tecnicos;
  return a?.atributos_originales || a?.originales || a || {};
}
function valorAtributo(attrs, keys = []) {
  for (const buscado of keys) {
    const key = Object.keys(attrs || {}).find(k => normalizar(k) === normalizar(buscado));
    if (key && attrs[key] !== null && attrs[key] !== undefined && String(attrs[key]).trim() !== '') return attrs[key];
  }
  return '';
}
function mesActual() {
  return ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'][new Date().getMonth()];
}
function fechaHoy() { return new Date().toISOString().slice(0,10); }

async function cargarActivo(config, dbId, etiqueta) {
  let query = clienteSupabase.from('leu').select('*').eq('categoria', config.categoria);
  // El mapa llama con el id de LEU. Se prioriza ese id para evitar etiquetas repetidas.
  if (dbId !== undefined && dbId !== null && String(dbId).trim() !== '' && Number.isFinite(Number(dbId))) {
    query = query.eq('id', Number(dbId));
  } else {
    query = query.eq('etiqueta', etiqueta);
  }
  const {data,error} = await query.maybeSingle();
  if (error) throw new Error('Error consultando LEU: ' + error.message);
  if (!data) throw new Error('No se encontró el activo en LEU (' + config.categoria + ').');
  return data;
}

function inputHtml(campo, valor) {
  const id = 'otro-' + campo.id;
  const v = escapar(valor);
  const estilo = 'width:100%;box-sizing:border-box;padding:8px;margin-bottom:10px;background:#2a2a2a;border:1px solid #444;color:#fff;border-radius:5px;';
  if (campo.type === 'select') {
    const opts = (campo.options || []).map(op => '<option value="' + escapar(op) + '" ' + (String(valor) === op ? 'selected' : '') + '>' + escapar(op) + '</option>').join('');
    return '<select id="' + id + '" style="' + estilo + '">' + opts + '</select>';
  }
  if (campo.type === 'textarea') return '<textarea id="' + id + '" rows="2" style="' + estilo + '">' + v + '</textarea>';
  const type = campo.type === 'number' ? 'number' : 'text';
  const step = campo.type === 'number' ? ' step="any"' : '';
  return '<input id="' + id + '" type="' + type + '" value="' + v + '"' + step + ' style="' + estilo + '">';
}

function parsearCoordenada(raw) {
  const s = String(raw || '').trim();
  let m = s.match(/^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/);
  if (m) {
    const a = Number(m[1]), b = Number(m[2]);
    if (Math.abs(a) <= 90 && Math.abs(b) <= 180) return [a,b];
    if (Math.abs(b) <= 90 && Math.abs(a) <= 180) return [b,a];
  }
  m = s.match(/^\s*POINT\s*\(\s*(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s*\)\s*$/i);
  if (m) return [Number(m[2]),Number(m[1])];
  return null;
}

function renderizar(config, activo) {
  const cont = document.getElementById('contenedor-componentes-dinamicos');
  if (!cont) return;
  const attrs = atributos(activo);
  const fields = config.campos.map(campo => {
    let valor = valorAtributo(attrs, campo.source || []);
    if (!valor && campo.id === 'estado') valor = campo.options?.[0] || '';
    if (!valor && campo.id === 'control_mensual') valor = 'Mensual';
    const opciones = campo.type === 'select' ? campo.options : [];
    if (campo.type === 'select' && !opciones.includes(String(valor))) valor = opciones[0] || '';
    return '<label for="otro-' + campo.id + '" style="display:block;font-size:13px;margin-bottom:5px;">' + escapar(campo.label) + '</label>' + inputHtml(campo, valor);
  }).join('');

  cont.innerHTML =
    '<div style="display:grid;grid-template-columns:minmax(0,1.25fr) minmax(150px,0.75fr);gap:12px;align-items:stretch;margin-bottom:12px;">' +
      '<fieldset style="min-width:0;border:1px solid #38bdf8;border-radius:5px;padding:10px;background:#182830;margin:0;">' +
        '<legend style="font-size:13px;color:#38bdf8;padding:0 5px;font-weight:bold;">📌 Datos del elemento — LEU</legend>' +
        '<div style="font-size:12px;color:#ddd;line-height:1.7;overflow-wrap:anywhere;">' +
          '<div><strong>Etiqueta:</strong> ' + escapar(activo.etiqueta || 'N/D') + '</div>' +
          '<div><strong>Sector:</strong> ' + escapar(activo.sector || 'N/D') + '</div>' +
          '<div><strong>Ronda:</strong> ' + escapar(activo.ronda || 'N/D') + '</div>' +
          '<div><strong>Ubicación:</strong> ' + escapar(activo.ubicacion_wkt || 'N/D') + '</div>' +
        '</div></fieldset>' +
      '<div style="min-width:0;"><div style="font-size:12px;color:#ddd;margin-bottom:5px;font-weight:bold;">📍 Ubicación del elemento</div>' +
        '<div id="mini-mapa-otro" role="img" aria-label="Mapa centrado en el activo" style="width:100%;height:132px;border:1px solid #38bdf8;border-radius:5px;overflow:hidden;background:#111;"></div></div></div>' +
      '<fieldset style="border:1px solid #444;border-radius:5px;padding:10px;margin-bottom:12px;"><legend style="font-size:13px;color:#aaa;padding:0 5px;">Control de ' + escapar(config.titulo) + ' — ' + escapar(mesActual()) + '</legend>' +
        '<div style="display:grid;grid-template-columns:minmax(0,1fr);gap:0;">' + fields + '</div>' +
        '<label for="otro-fecha-control" style="display:block;font-size:13px;margin-bottom:5px;">Fecha del control:</label>' +
        '<input id="otro-fecha-control" type="date" value="' + fechaHoy() + '" style="width:100%;box-sizing:border-box;padding:8px;margin-bottom:10px;background:#2a2a2a;border:1px solid #444;color:#fff;border-radius:5px;">' +
        '<label for="otro-mes-control" style="display:block;font-size:13px;margin-bottom:5px;">Mes del control:</label>' +
        '<input id="otro-mes-control" type="text" value="' + escapar(mesActual()) + '" readonly style="width:100%;box-sizing:border-box;padding:8px;margin-bottom:10px;background:#222;border:1px solid #444;color:#aaa;border-radius:5px;">' +
      '</fieldset>';

  const estado = config.campos.find(c => c.id === 'estado');
  const actualizarTitulo = () => {
    const el = document.getElementById('modal-titulo-elemento');
    aplicarTituloControl(el, config.titulo, activo.etiqueta, document.getElementById('otro-estado')?.value || '');
  };
  if (estado && estado.type === 'select') document.getElementById('otro-estado')?.addEventListener('change', actualizarTitulo);
  actualizarTitulo();

  const mapaEl = document.getElementById('mini-mapa-otro');
  const coords = parsearCoordenada(activo.ubicacion_wkt);
  if (mapaEl && coords && window.L) {
    const mini = L.map(mapaEl, {zoomControl:false,attributionControl:false,dragging:false,scrollWheelZoom:false,doubleClickZoom:false,boxZoom:false,keyboard:false});
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {maxZoom:22}).addTo(mini);
    L.circleMarker(coords,{radius:7,color:'#fff',weight:2,fillColor:'#ef4444',fillOpacity:1}).addTo(mini);
    mini.setView(coords,18);
    setTimeout(()=>mini.invalidateSize(),100);
  } else if (mapaEl) {
    mapaEl.innerHTML = '<div style="padding:12px;color:#aaa;font-size:11px;text-align:center;">Ubicación no disponible</div>';
  }
}

export async function abrirControlOtro(modulo, dbId, etiqueta) {
  const config = CONFIG[modulo];
  if (!config) { alert('Formulario no configurado: ' + modulo); return; }
  try {
    activoActual = await cargarActivo(config, dbId, etiqueta);
    moduloActual = modulo;
    document.getElementById('input-id-db').value = activoActual.id;
    document.getElementById('input-idch').value = activoActual.id;
    document.getElementById('input-tabla').value = modulo;
    aplicarTituloControl(document.getElementById('modal-titulo-elemento'), config.titulo, activoActual.etiqueta, 'Conforme');
    renderizar(config, activoActual);
    await cargarBomberosEnModal();
    const modal = document.getElementById('modal-control');
    if (modal) modal.style.display = 'flex';
  } catch (error) {
    alert(error.message || String(error));
    console.error('[Centinela controles]', error);
  }
}

export async function guardarControlOtro(event) {
  event.preventDefault();
  const config = CONFIG[moduloActual || document.getElementById('input-tabla')?.value];
  const idActivo = Number(document.getElementById('input-id-db')?.value);
  const realizo = document.getElementById('input-realizo')?.value || '';
  const fotoInput = document.getElementById('input-foto')?.files?.[0];
  if (!config || !activoActual || Number(activoActual.id) !== idActivo) {
    alert('No se pudo verificar el activo de LEU. Cerrá el formulario y volvé a abrirlo desde el mapa.');
    return;
  }
  if (!realizo) { alert('Seleccioná el inspector haciendo clic en su foto.'); return; }
  if (!fotoInput) { alert('La foto de auditoría es obligatoria.'); return; }

  const btn = document.querySelector('#form-nuevo-control button[type="submit"]');
  const original = btn?.innerText || 'Guardar Control';
  if (btn) { btn.disabled = true; btn.innerText = 'Guardando...'; }
  try {
    const hoy = fechaHoy();
    const foto = await subirFotoStorage(fotoInput);
    const attrs = atributos(activoActual);
    const registro = { id_activo:idActivo, nombreetiqueta:activoActual.etiqueta || null, sector:activoActual.sector || null };
    const tabla = config.tabla;
    const camposRegistro = new Set(Object.keys(registro));
    for (const campo of config.campos) {
      const input = document.getElementById('otro-' + campo.id);
      let valor = input ? input.value.trim() : '';
      if (valor === '') valor = null;
      if (valor !== null && campo.type === 'number') valor = Number(valor);
      registro[campo.column] = valor;
      camposRegistro.add(campo.column);
    }

    if (tabla === 'controles_ecas') {
      registro.ubicacion = valorAtributo(attrs,['Ubicación','Ubicacion']) || activoActual.ubicacion_wkt || null;
      registro.fecha_inspeccion_2025 = document.getElementById('otro-fecha-control')?.value || hoy;
      registro.mes = document.getElementById('otro-mes-control')?.value || mesActual();
      registro.control_s_realizado_por = realizo;
      registro.status = registro.estado;
      registro.reportado_fecha = hoy;
      registro.reportado_mes = mesActual();
      registro.reportado_por = realizo;
    } else if (tabla === 'controles_vecas') {
      registro.idvecas_original = valorAtributo(attrs,['ID VECAS','idvecas']) || null;
      registro.ubicacion = activoActual.ubicacion_wkt || null;
      registro.fecha = document.getElementById('otro-fecha-control')?.value || hoy;
      registro.mes = document.getElementById('otro-mes-control')?.value || mesActual();
      registro.realizo_la_prueba = realizo;
    } else if (tabla === 'controles_v') {
      registro.idv_original = valorAtributo(attrs,['ID Válvula','ID Valvula','idv']) || null;
      registro.ubicacion = activoActual.ubicacion_wkt || null;
      registro.prueba_fecha = document.getElementById('otro-fecha-control')?.value || hoy;
      registro.prueba_mes = document.getElementById('otro-mes-control')?.value || mesActual();
      registro.control_mensual = document.getElementById('otro-mes-control')?.value || mesActual();
      registro.control_realizado_por = realizo;
      registro.fecha = document.getElementById('otro-fecha-control')?.value || hoy;
      registro.mes = document.getElementById('otro-mes-control')?.value || mesActual();
    } else if (tabla === 'controles_pecas') {
      registro.idpecas_original = valorAtributo(attrs,['ID PECAS','idpecas']) || null;
      registro.ubicacion = activoActual.ubicacion_wkt || null;
      registro.fecha_control = document.getElementById('otro-fecha-control')?.value || hoy;
      registro.mes = document.getElementById('otro-mes-control')?.value || mesActual();
      registro.control_realizado_por = realizo;
    }
    registro.foto = foto;
    registro.fechafoto = hoy;

    const {error} = await clienteSupabase.from(tabla).insert([registro]);
    if (error) throw new Error(error.message);

    const estado = String(registro.estado || '').toLowerCase();
    if (estado.includes('observado') || estado.includes('no operativo')) {
      const {error:errAnomalia} = await clienteSupabase.from('anomalias').insert([{
        id_activo:idActivo,
        modulo_origen:config.origen,
        anomalia_detectada:config.titulo + ' ' + (registro.estado || 'Observado'),
        detalle_informe:registro.observacion || registro.observaciones || registro.comentario || registro.informe || 'Detectado durante control.',
        observacion:registro.observacion || registro.observaciones || registro.comentario || null,
        reportado_fecha:hoy,
        reportado_por:realizo,
        estado_resolucion:'Abierta'
      }]);
      if (errAnomalia) throw new Error('El control se guardó, pero no se pudo registrar la anomalía: ' + errAnomalia.message);
    }

    localStorage.setItem('centinela_inspector',realizo);
    cerrarFormularioControl();
    window.cargarModulo(moduloActual);
  } catch (error) {
    alert('Error al guardar el control: ' + (error.message || error));
  } finally {
    if (btn) { btn.disabled = false; btn.innerText = original; }
  }
}
