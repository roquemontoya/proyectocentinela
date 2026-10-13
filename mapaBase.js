// Capas base compartidas por los mapas de Centinela.
// La imagen satelital sigue siendo la capa predeterminada. maxNativeZoom evita
// pedir niveles que no están publicados por el proveedor y amplía el último nivel disponible.
export function agregarCapasBase(mapa, { selector = true } = {}) {
  const satelital = window.L.tileLayer(
    'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    {
      attribution: 'Imágenes © Esri',
      maxZoom: 22,
      maxNativeZoom: 19,
      keepBuffer: 3
    }
  );

  const argenmapHibrido = window.L.tileLayer(
    'https://wms.ign.gob.ar/geoserver/gwc/service/tms/1.0.0/mapabase_hibrido@EPSG%3A3857@png/{z}/{x}/{-y}.png',
    {
      attribution: 'Mapa base © Instituto Geográfico Nacional (IGN)',
      tms: false,
      maxZoom: 22,
      maxNativeZoom: 18,
      keepBuffer: 3
    }
  );

  const argenmap = window.L.tileLayer(
    'https://wms.ign.gob.ar/geoserver/gwc/service/tms/1.0.0/capabaseargenmap@EPSG%3A3857@png/{z}/{x}/{-y}.png',
    {
      attribution: 'Mapa base © Instituto Geográfico Nacional (IGN)',
      tms: false,
      maxZoom: 20,
      keepBuffer: 3
    }
  );

  satelital.addTo(mapa);
  if (selector) {
    window.L.control.layers(
      {
        'Imagen satelital (Esri)': satelital,
        'Argenmap híbrido (IGN)': argenmapHibrido,
        'Argenmap (IGN)': argenmap
      },
      null,
      { collapsed: true, position: 'topright' }
    ).addTo(mapa);
  }
  return { satelital, argenmapHibrido, argenmap };
}
