// ============================================
// CONFIGURACIÓN GLOBAL
// ============================================
let map;
let poisLayer = null;
let areaLayer = null;
let poisVisible = true;
let areaVisible = true;

const github_raw_base = 'https://raw.githubusercontent.com/diegoalrv/mobility-workshop/refs/heads/pois-manager/urban_explore/pois_manager';
const SURVEY_ITEM_ID = "50c150f7931e43c389b5bb2ceac75cbc";

let survey = null;
let surveyInitialized = false;

// Estilos de POI
const poiStyles = {
    restaurant: { color: '#ff6b6b', icon: '🍽️' },
    cafe: { color: '#4ecdc4', icon: '☕' },
    school: { color: '#45b7d1', icon: '🏫' },
    university: { color: '#96ceb4', icon: '🎓' },
    hospital: { color: '#ff9ff3', icon: '🏥' },
    park: { color: '#54a0ff', icon: '🌳' },
    gym: { color: '#5f27cd', icon: '💪' },
    shop: { color: '#00d2d3', icon: '🏪' },
    office: { color: '#ff9500', icon: '🏢' },
    tourist_places: { color: '#e17055', icon: '📷' },
    residential: { color: '#6c5ce7', icon: '🏠' },
    pub: { color: '#fd79a8', icon: '🍺' },
    default: { color: '#74b9ff', icon: '📍' }
};

// ============================================
// INICIALIZACIÓN
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Iniciando aplicación...');
    initializeMap();
    setupEventListeners();
});

// ============================================
// MAPBOX
// ============================================
function initializeMap() {
    if (!window.mapConfig?.apiKey) {
        showError('Error: API key de Mapbox no configurada');
        return;
    }

    mapboxgl.accessToken = window.mapConfig.apiKey;

    try {
        map = new mapboxgl.Map({
            container: 'map',
            style: 'mapbox://styles/mapbox/light-v11',
            center: window.mapConfig.center,
            zoom: window.mapConfig.zoom,
            attributionControl: false
        });

        map.addControl(new mapboxgl.NavigationControl(), 'top-right');
        map.addControl(new mapboxgl.FullscreenControl(), 'top-right');
        map.addControl(new mapboxgl.AttributionControl({ customAttribution: '© OpenStreetMap contributors' }), 'bottom-right');

        map.on('load', loadMapData);
        map.on('error', e => {
            console.error('Error del mapa:', e);
            showError('Error al cargar el mapa');
        });

        console.log('✅ Mapa inicializado correctamente');
    } catch (err) {
        console.error('❌ Error al inicializar Mapbox:', err);
        showError('Error al inicializar el mapa. Verifica la API key.');
    }
}

async function loadMapData() {
    showLoading();
    try {
        await loadPois();
        await loadArea();
        console.log('✅ Datos del mapa cargados');
    } catch (err) {
        console.error('❌ Error al cargar datos:', err);
        showError('Error al cargar los datos del mapa');
    } finally {
        hideLoading();
    }
}

async function loadPois() {
    try {
        const url = `${github_raw_base}/${window.mapConfig.relPath}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        const data = await res.json();

        if (!data.features?.length) {
            console.warn('⚠️ No se encontraron POIs');
            return;
        }

        map.addSource('pois', { type: 'geojson', data });
        map.addLayer({
            id: 'pois-pins',
            type: 'circle',
            source: 'pois',
            paint: {
                'circle-color': [
                    'match', ['get', 'category'],
                    'restaurant', '#ff6b6b',
                    'cafe', '#4ecdc4',
                    'school', '#45b7d1',
                    'university', '#96ceb4',
                    'hospital', '#ff9ff3',
                    'park', '#54a0ff',
                    'gym', '#5f27cd',
                    'shop', '#00d2d3',
                    'office', '#ff9500',
                    'tourist_places', '#e17055',
                    'residential', '#6c5ce7',
                    'pub', '#fd79a8',
                    '#74b9ff'
                ],
                'circle-radius': 12,
                'circle-stroke-width': 2,
                'circle-stroke-color': '#fff'
            }
        });

        map.on('click', 'pois-pins', handlePoiClick);
        map.on('mouseenter', 'pois-pins', () => map.getCanvas().style.cursor = 'pointer');
        map.on('mouseleave', 'pois-pins', () => map.getCanvas().style.cursor = '');

        const bbox = turf.bbox(data);
        map.fitBounds(bbox, { padding: 50 });

        poisLayer = 'pois';
        console.log(`✅ Cargados ${data.features.length} POIs`);
    } catch (err) {
        console.error('❌ Error al cargar POIs:', err);
        throw err;
    }
}

async function loadArea() {
    try {
        const url = `${github_raw_base}/static/geometries/area_mobility_workshop.geojson`;
        const res = await fetch(url);
        if (!res.ok) return console.warn('⚠️ No se pudo cargar el área');
        const data = await res.json();

        map.addSource('area', { type: 'geojson', data });
        map.addLayer({ id: 'area-fill', type: 'fill', source: 'area', paint: { 'fill-color': '#ff6600', 'fill-opacity': 0.1 } });
        map.addLayer({ id: 'area-line', type: 'line', source: 'area', paint: { 'line-color': '#ff6600', 'line-width': 3, 'line-opacity': 0.8 } });

        areaLayer = 'area';
        console.log('✅ Área de interés cargada');
    } catch (err) {
        console.warn('⚠️ No se pudo cargar el área:', err);
    }
}

function handlePoiClick(e) {
    const coords = e.features[0].geometry.coordinates.slice();
    const props = e.features[0].properties;
    const filtered = { name: props.name || props.Name || 'Sin nombre', category: props.category || 'default' };

    while (Math.abs(e.lngLat.lng - coords[0]) > 180) {
        coords[0] += e.lngLat.lng > coords[0] ? 360 : -360;
    }

    new mapboxgl.Popup().setLngLat(coords).setHTML(createPopupContent(filtered, coords)).addTo(map);
}

function createPopupContent({ name, category }, [lng, lat]) {
    const style = poiStyles[category] || poiStyles.default;
    return `
      <div>
        <h3 style="color:${style.color};">${style.icon} ${name}</h3>
        <div><strong>Categoría:</strong> ${category}</div>
        <div style="margin-top:12px;border-top:1px solid #e0e0e0;padding-top:10px;">
          <a href="https://www.google.com/maps/search/?api=1&query=${lat},${lng}" target="_blank"
             style="display:inline-flex;align-items:center;gap:8px;background:#4285f4;color:white;
                    padding:8px 12px;border-radius:4px;font-size:14px;font-weight:500;text-decoration:none;">
            Ver en Google Maps
          </a>
        </div>
      </div>`;
}

// ============================================
// EVENTOS PRINCIPALES
// ============================================
function setupEventListeners() {
    const toggleAreaBtn = document.getElementById('toggleArea');
    if (toggleAreaBtn) {
        toggleAreaBtn.addEventListener('click', function () {
            toggleArea();
            this.textContent = areaVisible ? 'Ocultar Área' : 'Mostrar Área';
            this.classList.toggle('active', !areaVisible);
        });
    }
    setupSurveyListeners();
}

function toggleArea() {
    if (!map || !areaLayer) return;
    areaVisible = !areaVisible;
    const v = areaVisible ? 'visible' : 'none';
    map.setLayoutProperty('area-fill', 'visibility', v);
    map.setLayoutProperty('area-line', 'visibility', v);
}

// ============================================
// SURVEY123
// ============================================
function setupSurveyListeners() {
    const fab = document.getElementById('survey-fab');
    const modal = document.getElementById('survey-modal');
    const overlay = document.getElementById('survey-overlay');
    const closeBtn = document.getElementById('close-survey');

    if (!fab || !modal || !overlay || !closeBtn) return console.warn('⚠️ Elementos del survey no encontrados');

    fab.addEventListener('click', openSurveyModal);
    closeBtn.addEventListener('click', closeSurveyModal);
    overlay.addEventListener('click', closeSurveyModal);
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && modal.classList.contains('active')) closeSurveyModal(); });

    console.log('✅ Survey listeners configurados');
}

function openSurveyModal() {
    const modal = document.getElementById('survey-modal');
    const overlay = document.getElementById('survey-overlay');
    if (!modal || !overlay) return;

    modal.classList.add('active');
    overlay.classList.add('active');
    document.body.style.overflow = 'hidden';

    if (!surveyInitialized || !checkSurveyStatus()) {
        surveyInitialized = false;
        initializeSurvey();
    }
}

function closeSurveyModal() {
    document.getElementById('survey-modal')?.classList.remove('active');
    document.getElementById('survey-overlay')?.classList.remove('active');
    document.body.style.overflow = 'auto';
    console.log('📱 Survey modal cerrado');
}

function initializeSurvey() {
    const container = document.getElementById('survey123');
    if (!container || typeof Survey123WebForm === 'undefined') {
        showSurveyMessage('error', 'Error', 'No se pudo cargar la encuesta');
        return;
    }

    container.innerHTML = `
      <div class="survey-loading">
        <div class="loading-spinner-modal"></div>
        <div class="loading-text">Inicializando encuesta...</div>
        <div class="loading-subtitle">Por favor espera un momento</div>
      </div>`;

    survey = new Survey123WebForm({
        container: 'survey123',
        itemId: SURVEY_ITEM_ID,
        portalUrl: 'https://www.arcgis.com',
        width: '100%25',
        height: '100%25',
        hideElements: [],
        autoRefresh: false
    });

    let readyFired = false;
    let submitFired = false;

    survey.on?.('ready', () => {
        readyFired = true;
        surveyInitialized = true;
        container.classList.add('loaded');
    });

    survey.on?.('formSubmitted', () => { // algunos builds siguen disparando esto
        submitFired = true;
        closeAfterSubmit();
    });

    // Fallback manual si el evento nativo no dispara
    window.addEventListener('message', function listener(e) {
        if (e.origin === 'https://survey123.arcgis.com' && typeof e.data === 'string') {
            try {
                const msg = JSON.parse(e.data);
                if (
                    msg.event === 'survey123:webform:formSubmitted' ||
                    msg.event === 'survey123:webform:submit'
                ) {
                    if (!submitFired) {
                        submitFired = true;
                        closeAfterSubmit();
                    }
                }
            } catch { /* ignorar mensajes no JSON */ }
        }
    }, { once: true });

    console.log('✅ Survey123 configurado');
}

function closeAfterSubmit() {
    // showSurveyMessage('success', '¡Gracias!', 'Respuesta enviada exitosamente', 2500);
    setTimeout(() => {
        closeSurveyModal();
        setTimeout(resetSurvey, 500);
    }, 1000);
}

function checkSurveyStatus() {
    const iframe = document.querySelector('#survey123 iframe');
    return iframe && iframe.src?.includes('survey123.arcgis.com');
}

function resetSurvey() {
    document.getElementById('survey123')?.classList.remove('loaded');
    if (survey?.destroy) { try { survey.destroy(); } catch {} }
    survey = null;
    surveyInitialized = false;
    console.log('✅ Survey reseteado');
}

// ============================================
// UI HELPERS
// ============================================
function showSurveyMessage(type, title, msg, duration = 3000) {
    const div = document.createElement('div');
    const colors = {
        success: { bg: 'linear-gradient(135deg,#28a745,#20c997)', icon: '🎉' },
        error: { bg: 'linear-gradient(135deg,#dc3545,#e74c3c)', icon: '❌' },
        warning: { bg: 'linear-gradient(135deg,#ffc107,#fd7e14)', icon: '⚠️' }
    };
    const c = colors[type] || colors.success;
    div.className = `survey-message survey-message-${type}`;
    div.style.cssText = `
      position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);
      background:${c.bg};color:#fff;padding:30px 40px;border-radius:16px;
      box-shadow:0 15px 50px rgba(0,0,0,.4);z-index:3000;text-align:center;
      animation:messageSlideIn .4s cubic-bezier(.4,0,.2,1);
    `;
    div.innerHTML = `<div><h3>${c.icon} ${title}</h3><p>${msg}</p></div>`;
    addMessageStyles();
    document.body.appendChild(div);
    setTimeout(() => { div.style.animation = 'messageSlideIn .3s reverse'; setTimeout(() => div.remove(), 300); }, duration);
}

function addMessageStyles() {
    if (document.querySelector('style[data-survey-messages]')) return;
    const s = document.createElement('style');
    s.dataset.surveyMessages = 'true';
    s.textContent = `
      @keyframes messageSlideIn {
        0% {opacity:0;transform:translate(-50%,-50%) scale(.8) translateY(20px);}
        100% {opacity:1;transform:translate(-50%,-50%) scale(1) translateY(0);}
      }
    `;
    document.head.appendChild(s);
}

function showLoading() {
    const mapDiv = document.getElementById('map');
    if (mapDiv && !document.getElementById('loading-spinner')) {
        const sp = document.createElement('div');
        sp.id = 'loading-spinner'; sp.className = 'loading-spinner';
        mapDiv.appendChild(sp);
    }
}
function hideLoading() { document.getElementById('loading-spinner')?.remove(); }
function showError(msg) {
    const mapDiv = document.getElementById('map');
    if (!mapDiv) return;
    const err = document.createElement('div');
    err.className = 'error-message'; err.id = 'error-message'; err.textContent = msg;
    mapDiv.appendChild(err);
    setTimeout(() => err.remove(), 5000);
}

console.log('📜 Script cargado correctamente');
