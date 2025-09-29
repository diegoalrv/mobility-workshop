// Configuración global del mapa
let map;
let poisLayer = null;
let areaLayer = null;
let poisVisible = true;
let areaVisible = true;

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
    // Botón para alternar POIs
    const togglePoisBtn = document.getElementById('togglePois');
    if (togglePoisBtn) {
        togglePoisBtn.addEventListener('click', function() {
            togglePois();
            this.textContent = poisVisible ? 'Ocultar POIs' : 'Mostrar POIs';
            this.classList.toggle('active', !poisVisible);
        });
    }

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
        const response = await fetch(`/static/${window.mapConfig.relPath}`);
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

            let popupContent = createPopupContent(properties, coordinates);

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
        const response = await fetch('/static/geometries/area_mobility_workshop.geojson');
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
        console.log('✅ Área de interés cargada');

    } catch (error) {
        console.warn('No se pudo cargar el área de interés:', error);
    }
}

function createPopupContent(properties, coordinates) {
    const category = properties.category || 'default';
    const style = poiStyles[category] || poiStyles.default;
    const name = properties.name || properties.Name || 'Sin nombre';
    const [lng, lat] = coordinates; // ← añadimos coordenadas

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

    // 🔗 Enlace a Google Maps con coordenadas
    content += `
        <div style="margin-top:8px;">
            <a href="https://www.google.com/maps/search/?api=1&query=${lat},${lng}" 
               target="_blank" style="color:#0078ff;text-decoration:underline;">
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
    
    map.setLayoutProperty('clusters', 'visibility', visibility);
    map.setLayoutProperty('cluster-count', 'visibility', visibility);
    map.setLayoutProperty('unclustered-point', 'visibility', visibility);
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