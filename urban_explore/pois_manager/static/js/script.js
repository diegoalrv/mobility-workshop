// CONFIGURACIÓN GLOBAL
let map, poisLayer=null, areaLayer=null;
let poisVisible=true, areaVisible=true;

const github_raw_base = 'https://raw.githubusercontent.com/diegoalrv/mobility-workshop/refs/heads/pois-manager/urban_explore/pois_manager';
const SURVEY_ITEM_ID = "50c150f7931e43c389b5bb2ceac75cbc";

let survey = null;
let surveyInitialized = false;

document.addEventListener('DOMContentLoaded', () => {
  console.log('🚀 Iniciando aplicación...');
  if(document.body.classList.contains('viewer-page')){
    initializeMap();
    setupEventListeners();
  }
});

function initializeMap() {
  mapboxgl.accessToken = window.mapConfig.apiKey;
  map = new mapboxgl.Map({
    container:'map',
    style:'mapbox://styles/mapbox/light-v11',
    center:window.mapConfig.center,
    zoom:window.mapConfig.zoom,
    attributionControl:false
  });
  map.addControl(new mapboxgl.NavigationControl(),'top-right');
  map.on('load', async ()=>{ await loadPois(); await loadArea(); });
}

async function loadPois(){
  try{
    const res = await fetch(`${github_raw_base}/${window.mapConfig.relPath}`);
    if(!res.ok) return;
    const data = await res.json();

    if (!data.features?.length) {
      console.warn('⚠️ No se encontraron POIs');
      return;
    }

    // Fuente y capa
    if (map.getSource('pois')) map.removeSource('pois');
    map.addSource('pois',{type:'geojson',data});
    if (map.getLayer('pois-pins')) map.removeLayer('pois-pins');
    map.addLayer({
      id:'pois-pins',
      type:'circle',
      source:'pois',
      paint:{
        'circle-color':'#FEC31F',
        'circle-radius':8,
        'circle-stroke-width':2,
        'circle-stroke-color':'#000'
      }
    });

    // Popup al hacer click
    map.on('click','pois-pins',e=>{
      const f = e.features[0];
      const coords = f.geometry.coordinates.slice();
      const props = f.properties || {};
      const name = props.name || props.Name || 'Sin nombre';

      // Ajuste por antimeridiano
      while (Math.abs(e.lngLat.lng - coords[0]) > 180) {
        coords[0] += e.lngLat.lng > coords[0] ? 360 : -360;
      }

      const popupHTML = `
        <div style="font-family:Inter,sans-serif;max-width:250px">
          <h3 style="color:#000000;margin:0 0 5px 0;">📍 ${name}</h3>
          <div style="font-size:0.9rem;margin-top:8px;">
            <a href="https://www.google.com/maps/search/?api=1&query=${coords[1]},${coords[0]}" target="_blank"
               style="display:inline-block;padding:6px 10px;background:#000;color:#FEC31F;text-decoration:none;border-radius:4px;font-weight:600;">
              Ver en Google Maps
            </a>
          </div>
        </div>
      `;
      new mapboxgl.Popup()
        .setLngLat(coords)
        .setHTML(popupHTML)
        .addTo(map);
    });

    // Cursor interactivo
    map.on('mouseenter','pois-pins',()=> map.getCanvas().style.cursor='pointer');
    map.on('mouseleave','pois-pins',()=> map.getCanvas().style.cursor='');

    // Ajustar vista al bounding box de los POIs
    const bbox = turf.bbox(data);
    if (bbox && bbox.length === 4) {
      map.fitBounds(bbox, { padding: 50, maxZoom: 16 });
    }

    poisLayer='pois';
    console.log(`✅ Cargados ${data.features.length} POIs`);
  }catch(e){
    console.error('❌ Error al cargar POIs:', e);
  }
}

async function loadArea(){
  try{
    const res=await fetch(`${github_raw_base}/static/geometries/area_mobility_workshop.geojson`);
    if(!res.ok)return;
    const data=await res.json();
    map.addSource('area',{type:'geojson',data});
    map.addLayer({id:'area-fill',type:'fill',source:'area',paint:{'fill-color':'#FEC31F','fill-opacity':0.1}});
    map.addLayer({id:'area-line',type:'line',source:'area',paint:{'line-color':'#FEC31F','line-width':2}});
    areaLayer='area';
  }catch(e){console.error(e);}
}

function setupEventListeners(){
  const toggleArea=document.getElementById('toggleArea');
  if(toggleArea){
    toggleArea.addEventListener('change',()=>{
      areaVisible=toggleArea.checked;
      const v=areaVisible?'visible':'none';
      map.setLayoutProperty('area-fill','visibility',v);
      map.setLayoutProperty('area-line','visibility',v);
    });
  }
  setupSurveyListeners();
}

function setupSurveyListeners(){
  const fab=document.getElementById('survey-fab');
  const modal=document.getElementById('survey-modal');
  const overlay=document.getElementById('survey-overlay');
  const closeBtn=document.getElementById('close-survey');
  if(!fab||!modal||!overlay||!closeBtn)return;
  fab.addEventListener('click',openSurveyModal);
  closeBtn.addEventListener('click',closeSurveyModal);
  overlay.addEventListener('click',closeSurveyModal);
}

function openSurveyModal(){
  document.getElementById('survey-modal').classList.add('active');
  document.getElementById('survey-overlay').classList.add('active');
  document.body.style.overflow='hidden';
  if(!surveyInitialized) initializeSurvey();
}

function closeSurveyModal(){
  document.getElementById('survey-modal').classList.remove('active');
  document.getElementById('survey-overlay').classList.remove('active');
  document.body.style.overflow='auto';
}

function initializeSurvey() {
  const container = document.getElementById('survey123');
  if (!container || typeof Survey123WebForm === 'undefined') {
    showSurveyMessage('error', 'Error', 'No se pudo cargar la encuesta');
    return;
  }

  // HTML de carga
  container.innerHTML = `
    <div class="survey-loading">
      <div class="loading-spinner-modal"></div>
      <div class="loading-text">Inicializando encuesta...</div>
      <div class="loading-subtitle">Por favor espera un momento</div>
    </div>`;

  // Instancia del WebForm
  survey = new Survey123WebForm({
    container: 'survey123',
    itemId: SURVEY_ITEM_ID,
    portalUrl: 'https://www.arcgis.com',
    width: '100%25',
    height: '100%25',
    hideElements: [],
    autoRefresh: false
  });

  let submitFired = false;

  // Cuando está listo
  survey.on?.('ready', () => {
    surveyInitialized = true;
    container.classList.add('loaded');
    console.log('✅ Survey listo');
  });

  // Cuando se envía
  survey.on?.('formSubmitted', () => {
    if (!submitFired) {
      submitFired = true;
      closeAfterSubmit();
    }
  });

  // Fallback: escuchar mensajes de la ventana
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
  setTimeout(() => {
    closeSurveyModal();
    setTimeout(resetSurvey, 500);
  }, 800);
}

function resetSurvey() {
  document.getElementById('survey123')?.classList.remove('loaded');
  if (survey?.destroy) { try { survey.destroy(); } catch {} }
  survey = null;
  surveyInitialized = false;
  console.log('✅ Survey reseteado');
}

function showSurveyMessage(type, title, msg, duration = 3000) {
  const div = document.createElement('div');
  const colors = {
    success: { bg: 'linear-gradient(135deg,#FEC31F,#000)', icon: '✅' },
    error: { bg: 'linear-gradient(135deg,#dc3545,#e74c3c)', icon: '❌' },
    warning: { bg: 'linear-gradient(135deg,#ffc107,#fd7e14)', icon: '⚠️' }
  };
  const c = colors[type] || colors.success;
  div.className = `survey-message survey-message-${type}`;
  div.style.cssText = `
    position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);
    background:${c.bg};color:#fff;padding:25px 35px;border-radius:16px;
    box-shadow:0 15px 50px rgba(0,0,0,.4);z-index:3000;text-align:center;
    font-family:Inter,sans-serif;font-size:1rem;
    animation:messageSlideIn .4s cubic-bezier(.4,0,.2,1);
  `;
  div.innerHTML = `<div><h3>${c.icon} ${title}</h3><p>${msg}</p></div>`;
  document.body.appendChild(div);
  setTimeout(() => { div.style.animation = 'messageSlideIn .3s reverse'; setTimeout(() => div.remove(), 300); }, duration);
}

