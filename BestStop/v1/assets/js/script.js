// Variável global para armazenar áreas
let areas = [];
let map, heatmap;

// Carrega áreas do JSON com fallback
async function loadAreas() {
  try {
    const response = await fetch('./assets/data/areas.json');
    const jsonData = await response.json();
    
    // Verifica se há dados salvos no localStorage
    const savedAreas = JSON.parse(localStorage.getItem('areas'));
    
    // Se existirem dados salvos, mescla com os do JSON
    areas = savedAreas 
      ? jsonData.map(jsonArea => {
          const savedArea = savedAreas.find(a => a.id === jsonArea.id);
          return savedArea ? { ...jsonArea, weight: savedArea.weight } : jsonArea;
        })
      : jsonData;

    if (!savedAreas) saveAreas();
    
  } catch (error) {
    console.error('Erro ao carregar áreas:', error);
    // Fallback para dados padrão
    areas = [
      {
        id: "ENTRADA",
        name: "Entrada Principal",
        coords: [[80, -90], [60, 90]],
        weight: 0.3,
        baseWeight: 0.2,
        maxWeight: 1.0
      }
    ];
  }
  
  updateHeatmap();
  updateControls();
}

// Configuração do mapa e heatmap
function initMap() {
  map = L.map('map', {
    crs: L.CRS.Simple,
    minZoom: -1,
    maxBounds: [[-100, -100], [100, 100]],
    attributionControl: false
  });

  L.imageOverlay('assets/images/mapa_estacionamento.png', [[-100, -100], [100, 100]]).addTo(map);
  map.fitBounds([[-100, -100], [100, 100]]);

  heatmap = L.heatLayer([], {
    radius: 25,
    gradient: { 0.0: '#00FF00', 0.5: '#FFFF00', 1.0: '#FF0000' },
    minOpacity: 0.8,
    blur: 15
  }).addTo(map);
}

// Atualiza visualização do heatmap
function updateHeatmap() {
  const heatData = areas.flatMap(area => {
    const [[y1, x1], [y2, x2]] = area.coords;
    const points = [];
    const pointCount = Math.ceil(area.weight * 10);
    
    for (let i = 0; i < pointCount; i++) {
      points.push([
        y1 + Math.random() * (y2 - y1),
        x1 + Math.random() * (x2 - x1),
        area.weight
      ]);
    }
    return points;
  });

  heatmap.setLatLngs(heatData);
}

// Atualiza controles da interface
function updateControls() {
  const areaList = document.getElementById('area-list');
  areaList.innerHTML = '';
  
  areas.forEach(area => {
    const controlDiv = document.createElement('div');
    controlDiv.className = 'area-control';
    controlDiv.innerHTML = `
      <h4>${area.name}</h4>
      <div class="slider-container">
        <input type="range" min="0" max="100" 
               value="${(area.weight * 100).toFixed(0)}" 
               oninput="adjustArea('${area.id}', this.value/100)"
               class="density-slider">
        <span>${(area.weight * 100).toFixed(0)}%</span>
      </div>
      <button onclick="showAreaInfo('${area.id}')">
        <i class="fas fa-info-circle"></i> Info
      </button>
    `;
    areaList.appendChild(controlDiv);
  });
}

// Ajusta peso da área
window.adjustArea = function(id, value) {
  const area = areas.find(a => a.id === id);
  if (area) {
    area.weight = Math.min(area.maxWeight, Math.max(0, value));
    saveAreas();
    updateHeatmap();
    updateControls();
  }
};

// Mostra informações da área
window.showAreaInfo = function(id) {
  const area = areas.find(a => a.id === id);
  if (area) {
    alert(`${area.name}\nStatus: ${(area.weight * 100).toFixed(0)}%\n` +
          `Mínimo: ${(area.baseWeight * 100).toFixed(0)}%\n` +
          `Máximo: ${(area.maxWeight * 100).toFixed(0)}%`);
  }
};

// Salva áreas no localStorage
function saveAreas() {
  localStorage.setItem('areas', JSON.stringify(areas));
}

// Simulação de fluxo automático
function simulateFlow() {
  const now = new Date();
  const hour = now.getHours();
  const isPeakTime = (hour >= 7 && hour <= 9) || (hour >= 17 && hour <= 19);
  
  areas.forEach(area => {
    const variation = (Math.random() * 0.1) - 0.05;
    const timeEffect = isPeakTime ? 0.15 : -0.1;
    
    area.weight = Math.max(area.baseWeight,
      Math.min(area.maxWeight, 
        area.weight + variation + timeEffect
      )
    );
  });
  
  saveAreas();
  updateHeatmap();
  updateControls();
}

// Inicialização
(async function init() {
  initMap();
  await loadAreas();
  setInterval(simulateFlow, 5000);
})();