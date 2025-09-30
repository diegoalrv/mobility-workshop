// Configuración global del mapa
let map;
let poisLayer = null;
let areaLayer = null;
let poisVisible = true;
let areaVisible = true;
const github_raw_base = 'https://raw.githubusercontent.com/diegoalrv/mobility-workshop/refs/heads/pois-manager/urban_explore/pois_manager';

// Estilos para diferentes categorías de POIs
const poiStyles = {
    'restaurant': { color: '#ff6b6b', icon: '🍽️' },
    'cafe': { color: '#4ecdc4', icon: '☕' },
    'school': { color: '#45b7d1', icon: '🏫' },
    'university': { color: '#96ceb4', icon: '🎓' },
    'hospital': { color: '#ff9ff3', icon: '🏥' },
    'park': { color: '#54a0ff', icon: '🌳' },
    'gym': { color: '#5f27cd', icon: '💪' },
    'shop': { color: '#00d2d3', icon: '🏪' },
    'office': { color: '#ff9500', icon: '🏢' },
    'tourist_places': { color: '#e17055', icon: '📷' },
    'residential': { color: '#6c5ce7', icon: '🏠' },
    'pub': { color: '#fd79a8', icon: '🍺' },
    'default': { color: '#74b9ff', icon: '📍' }
};

// Inicializar el mapa cuando se carga la página
document.addEventListener('DOMContentLoaded', function() {
    initializeMap();
    setupEventListeners();
});

function initializeMap() {
    // Verificar que tenemos la API key
    if (!window.mapConfig.apiKey) {
        showError('Error: API key de Mapbox no configurada');
        return;
    }

    // Configurar token de Mapbox
    mapboxgl.accessToken = window.mapConfig.apiKey;

    try {
        // Crear el mapa
        map = new mapboxgl.Map({
            container: 'map',
            style: 'mapbox://styles/mapbox/light-v11',
            center: window.mapConfig.center,
            zoom: window.mapConfig.zoom,
            attributionControl: false
        });

        // Añadir controles
        map.addControl(new mapboxgl.NavigationControl(), 'top-right');
        map.addControl(new mapboxgl.FullscreenControl(), 'top-right');
        
        // Añadir atribución personalizada
        map.addControl(new mapboxgl.AttributionControl({
            customAttribution: '© OpenStreetMap contributors'
        }), 'bottom-right');

        // Eventos del mapa
        map.on('load', function() {
            loadMapData();
        });

        map.on('error', function(e) {
            console.error('Error del mapa:', e);
            showError('Error al cargar el mapa');
        });

    } catch (error) {
        console.error('Error al inicializar Mapbox:', error);
        showError('Error al inicializar el mapa. Verifica la API key.');
    }
}

function setupEventListeners() {

    // Botón para alternar área
    const toggleAreaBtn = document.getElementById('toggleArea');
    if (toggleAreaBtn) {
        toggleAreaBtn.addEventListener('click', function() {
            toggleArea();
            this.textContent = areaVisible ? 'Ocultar Área' : 'Mostrar Área';
            this.classList.toggle('active', !areaVisible);
        });
    }
}

async function loadMapData() {
    showLoading();
    
    try {
        // Cargar POIs principales
        await loadPois();
        
        // Cargar área (opcional)
        await loadArea();
        
        hideLoading();
    } catch (error) {
        console.error('Error al cargar datos:', error);
        showError('Error al cargar los datos del mapa');
        hideLoading();
    }
}

async function loadPois() {
    try {
        var dataUrl = `${github_raw_base}/${window.mapConfig.relPath}`
        const response = await fetch(dataUrl);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
    
        
        const data = await response.json();
        
        if (!data.features || data.features.length === 0) {
            console.warn('No se encontraron POIs en el archivo');
            return;
        }

        // Añadir source para los POIs (sin clustering)
        map.addSource('pois', {
            type: 'geojson',
            data: data
        });

        // Capa para los POIs individuales (pines)
        map.addLayer({
            id: 'pois-pins',
            type: 'circle',
            source: 'pois',
            paint: {
            'circle-color': [
                'match',
                ['get', 'category'],
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
            'circle-stroke-color': '#ffffff'
            }
        });

        // Evento para mostrar popup al hacer click en un pin
        map.on('click', 'pois-pins', function(e) {
            const coordinates = e.features[0].geometry.coordinates.slice();
            const properties = e.features[0].properties;
            // Filtrar solo para crear popup con nombre y categoría
            const filteredProperties = {
                name: properties.name || properties.Name || 'Sin nombre',
                category: properties.category || 'default'
            };

            let popupContent = createPopupContent(filteredProperties, coordinates);

            while (Math.abs(e.lngLat.lng - coordinates[0]) > 180) {
                coordinates[0] += e.lngLat.lng > coordinates[0] ? 360 : -360;
            }

            new mapboxgl.Popup()
                .setLngLat(coordinates)
                .setHTML(popupContent)
                .addTo(map);
        });

        // Cambiar cursor en hover
        map.on('mouseenter', 'pois-pins', function() {
            map.getCanvas().style.cursor = 'pointer';
        });
        map.on('mouseleave', 'pois-pins', function() {
            map.getCanvas().style.cursor = '';
        });

        // Ajustar vista a los POIs
        if (data.features.length > 0) {
            const bbox = turf.bbox(data);
            map.fitBounds(bbox, { padding: 50 });
        }

        poisLayer = 'pois';
        console.log(`✅ Cargados ${data.features.length} POIs`);

    } catch (error) {
        console.error('Error al cargar POIs:', error);
        throw error;
    }
}

async function loadArea() {
    try {
        const areaUrl = `${github_raw_base}/static/geometries/area_mobility_workshop.geojson`;
        // Cargar el área directamente desde GitHub usando areaUrl
        const response = await fetch(areaUrl);
        if (!response.ok) {
            console.warn('No se pudo cargar el área de interés');
            return;
        }
        
        const areaData = await response.json();
        
        // Añadir source para el área
        map.addSource('area', {
            type: 'geojson',
            data: areaData
        });

        // Añadir capa de relleno para el área
        map.addLayer({
            id: 'area-fill',
            type: 'fill',
            source: 'area',
            paint: {
            'fill-color': '#ff6600',
            'fill-opacity': 0.1
            }
        });

        // Añadir capa de borde para el área
        map.addLayer({
            id: 'area-line',
            type: 'line',
            source: 'area',
            paint: {
            'line-color': '#ff6600',
            'line-width': 3,
            'line-opacity': 0.8
            }
        });

        // Centrar la vista en el área
        if (areaData.features.length > 0) {
            const bbox = turf.bbox(areaData);
            map.fitBounds(bbox, { padding: 50 });
        }

        areaLayer = 'area';
        console.log('✅ Área de interés cargada desde GitHub');

    } catch (error) {
        console.warn('No se pudo cargar el área de interés:', error);
    }
}

function createPopupContent(properties, coordinates) {
    const category = properties.category || 'default';
    const style = poiStyles[category] || poiStyles.default;
    const name = properties.name || properties.Name || 'Sin nombre';
    const [lng, lat] = coordinates;

    let content = `
        <div>
            <h3 style="color: ${style.color};">
                ${style.icon} ${name}
            </h3>
    `;

    // Propiedades clave
    const importantKeys = ['category', 'amenity', 'shop', 'tourism', 'leisure'];
    const otherKeys = [];

    for (let key in properties) {
        if (key !== 'name' && key !== 'Name' && !importantKeys.includes(key)) {
            otherKeys.push(key);
        }
    }

    importantKeys.forEach(key => {
        if (properties[key]) {
            content += `
                <div class="property">
                    <span class="property-key">${key}:</span>
                    <span class="property-value">${properties[key]}</span>
                </div>
            `;
        }
    });

    otherKeys.slice(0, 5).forEach(key => {
        if (properties[key]) {
            content += `
                <div class="property">
                    <span class="property-key">${key}:</span>
                    <span class="property-value">${properties[key]}</span>
                </div>
            `;
        }
    });

    // 🔗 Enlace a Google Maps con estilo mejorado
    content += `
        <div style="margin-top: 12px; padding-top: 10px; border-top: 1px solid #e0e0e0;">
            <a href="https://www.google.com/maps/search/?api=1&query=${lat},${lng}" 
               target="_blank" 
               class="google-maps-btn"
               style="
                   display: inline-flex;
                   align-items: center;
                   gap: 8px;
                   background: #4285f4;
                   color: white;
                   text-decoration: none;
                   padding: 8px 12px;
                   border-radius: 4px;
                   font-size: 14px;
                   font-weight: 500;
                   font-family: 'Product Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
                   transition: all 0.2s ease;
                   box-shadow: 0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.24);
               "
               onmouseover="this.style.background='#3367d6'; this.style.boxShadow='0 2px 6px rgba(0,0,0,0.16), 0 2px 4px rgba(0,0,0,0.32)'; this.style.transform='translateY(-1px)';"
               onmouseout="this.style.background='#4285f4'; this.style.boxShadow='0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.24)'; this.style.transform='translateY(0)';">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
                </svg>
                Ver en Google Maps
            </a>
        </div>
    `;

    content += '</div>';
    return content;
}

function togglePois() {
    if (!map || !poisLayer) return;
    
    poisVisible = !poisVisible;
    const visibility = poisVisible ? 'visible' : 'none';
    
    // Corregir para usar la capa correcta
    map.setLayoutProperty('pois-pins', 'visibility', visibility);
}

function toggleArea() {
    if (!map || !areaLayer) return;
    
    areaVisible = !areaVisible;
    const visibility = areaVisible ? 'visible' : 'none';
    
    try {
        map.setLayoutProperty('area-fill', 'visibility', visibility);
        map.setLayoutProperty('area-line', 'visibility', visibility);
    } catch (error) {
        console.warn('No se pudo alternar el área:', error);
    }
}

function showLoading() {
    const mapContainer = document.getElementById('map');
    const spinner = document.createElement('div');
    spinner.className = 'loading-spinner';
    spinner.id = 'loading-spinner';
    mapContainer.appendChild(spinner);
}

function hideLoading() {
    const spinner = document.getElementById('loading-spinner');
    if (spinner) {
        spinner.remove();
    }
}

function showError(message) {
    const mapContainer = document.getElementById('map');
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.textContent = message;
    errorDiv.id = 'error-message';
    mapContainer.appendChild(errorDiv);
    
    // Remover después de 5 segundos
    setTimeout(() => {
        const error = document.getElementById('error-message');
        if (error) error.remove();
    }, 5000);
}

// Utilidad para cargar Turf.js si es necesario
function loadTurf() {
    if (typeof turf === 'undefined') {
        const script = document.createElement('script');
        script.src = 'https://unpkg.com/@turf/turf@6/turf.min.js';
        document.head.appendChild(script);
    }
}

// Cargar Turf.js para cálculos geográficos
loadTurf();

// Inicializar Survey123
function initializeSurvey() {
    try {
        const surveyContainer = document.getElementById('survey123');
        
        survey = new Survey123WebForm({
            container: "survey123",
            itemId: SURVEY_ITEM_ID,
            // Configuración adicional para mejor integración
            width: "100%",
            height: "100%"
        });

        survey.on("ready", () => {
            console.log("✅ Encuesta lista");
            surveyInitialized = true;
            // Marcar como cargado para ocultar el loading
            surveyContainer.classList.add('loaded');
        });

        survey.on("submit", (response) => {
            console.log("📨 Respuesta enviada:", response);
            
            // Mostrar mensaje de éxito
            const successMsg = document.createElement('div');
            successMsg.className = 'success-message';
            successMsg.innerHTML = `
                <div class="success-content">
                    <h3>¡Gracias! 🎉</h3>
                    <p>Tu respuesta se ha enviado correctamente</p>
                </div>
            `;
            document.body.appendChild(successMsg);

            // Cerrar modal después de 2 segundos
            setTimeout(() => {
                closeSurveyModal();
                successMsg.remove();
                // Reset loading state para próxima vez
                surveyContainer.classList.remove('loaded');
            }, 2000);
        });

        survey.on("survey123-error", (err) => {
            console.error("⚠️ Error Survey123:", err);
            alert("Hubo un problema cargando la encuesta. Por favor, intenta nuevamente.");
        });

    } catch (error) {
        console.error("❌ Error inicializando Survey123:", error);
        alert("No se pudo cargar la encuesta. Verifica la conexión a internet.");
    }
}