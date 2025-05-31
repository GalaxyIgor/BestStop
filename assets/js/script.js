/**
 * SISTEMA DE DENSIDADE DE PESSOAS
 * - Cada área tem um peso entre 0 (vazio) e 1 (lotado)
 * - Dados persistidos no localStorage
 */

// Modelo de áreas com coordenadas retangulares
let areas = JSON.parse(localStorage.getItem('areas')) || [
  { 
    id: "ENTRADA", 
    name: "Entrada Principal",
    coords: [[80, -90], [60, 90]],  // [y1,x1, y2,x2]
    weight: 0.3,
    baseWeight: 0.2,
    maxWeight: 1.0
  },
  { 
    id: "CORREDOR", 
    name: "Corredor Central",
    coords: [[40, -90], [10, 90]],
    weight: 0.4,
    baseWeight: 0.3,
    maxWeight: 1.2
  },
  { 
    id: "VAGAS_A", 
    name: "Área de Vagas A",
    coords: [[78, 80], [78, -86]],
    weight: 0.6,
    baseWeight: 0.1,
    maxWeight: 1.0
  }
];

// Inicializa o mapa
const map = L.map('map', {
  crs: L.CRS.Simple,
  minZoom: -1,
  maxBounds: [[-100, -100], [100, 100]],
  attributionControl: false
});

L.imageOverlay('assets/images/mapa_estacionamento.png', [[-100, -100], [100, 100]]).addTo(map);
map.fitBounds([[-100, -100], [100, 100]]);

// Cria heatmap
const heatmap = L.heatLayer([], {
  radius: 25,
  gradient: { 0.0: '#00FF00', 0.5: '#FFFF00', 1.0: '#FF0000' },
  minOpacity: 0.8,
  blur: 15
}).addTo(map);

// Atualiza visualização
function updateHeatmap() {
  const heatData = areas.flatMap(area => {
    const [[y1, x1], [y2, x2]] = area.coords;
    const points = [];
    // Cria pontos proporcionais ao peso
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

// Painel de controle
const areaList = document.getElementById('area-list');
function updateControls() {
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

// Ajusta área
window.adjustArea = function(id, value) {
  const area = areas.find(a => a.id === id);
  if (area) {
    area.weight = Math.min(area.maxWeight, Math.max(0, value));
    saveAreas();
    updateHeatmap();
    updateControls();
  }
};

// Info da área
window.showAreaInfo = function(id) {
  const area = areas.find(a => a.id === id);
  if (area) {
    alert(`${area.name}\nStatus: ${(area.weight * 100).toFixed(0)}%\n` +
          `Mínimo: ${(area.baseWeight * 100).toFixed(0)}%\n` +
          `Máximo: ${(area.maxWeight * 100).toFixed(0)}%`);
  }
};

// Salva no localStorage
function saveAreas() {
  localStorage.setItem('areas', JSON.stringify(areas));
}

// Simulação de fluxo (opcional)
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
updateHeatmap();
updateControls();

// Atualização periódica (opcional)
setInterval(simulateFlow, 5000);