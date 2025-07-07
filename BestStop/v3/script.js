// Elementos do DOM
const elements = {
    // Dashboard
    occupied: document.getElementById('occupied'),
    available: document.getElementById('available'),
    totalSpots: document.getElementById('total-spots'),
    occupancyRate: document.getElementById('occupancy-rate'),
    lastUpdate: document.getElementById('last-update'),
    
    // Mapa
    map: document.getElementById('map')
};

// Estado do estacionamento
let parkingState = {
    totalSpots: 0,
    occupied: 0,
    available: 0,
    lastUpdate: null,
    spots: []
};

let map, heatLayer;

// Configuração inicial
// Atualize o initApp() para incluir:
async function initApp() {
    setupThemeSwitcher();
    setupMap();
    handleResponsiveLayout();
    
    window.addEventListener('resize', debounce(() => {
        handleResponsiveLayout();
        if (map) map.invalidateSize();
    }, 200));

    try {
        const parkingData = await loadParkingData();
        if (parkingData) {
            updateParkingState(parkingData);
            setupAutoRefresh();
        }
    } catch (error) {
        showErrorToUser("Erro ao carregar dados do estacionamento");
        console.error("Initialization error:", error);
    }
    
    // Mostrar notificação inicial
    showNotification('Sistema conectado com sucesso', 'success');
}


// Tratamento de erros melhorado
async function loadParkingData() {
    try {
        const response = await fetch('data.json');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        return processHeatmapData(data);
    } catch (error) {
        console.error('Erro ao carregar dados:', error);
        throw error;
    }
}

function showErrorToUser(message) {
    const errorEl = document.createElement('div');
    errorEl.className = 'error-message';
    errorEl.textContent = message;
    document.body.prepend(errorEl);
    setTimeout(() => errorEl.remove(), 5000);
}

// Auto-refresh com debounce
function setupAutoRefresh() {
    const refreshInterval = setInterval(async () => {
        try {
            const newData = await loadParkingData();
            if (newData) updateParkingState(newData);
        } catch (error) {
            console.error("Refresh error:", error);
            clearInterval(refreshInterval);
        }
    }, 5000);

    // Debounce para redimensionamento
    window.addEventListener('resize', debounce(() => {
        if (map) map.invalidateSize();
    }, 250));
}

function debounce(func, timeout = 300) {
    let timer;
    return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => { func.apply(this, args); }, timeout);
    };
}

// Função para redimensionamento responsivo
function handleResponsiveLayout() {
    const isMobile = window.innerWidth <= 480;
    const headerHeight = document.querySelector('.main-header').offsetHeight;
    const viewportHeight = window.innerHeight;
    const cardsHeight = document.querySelector('.info-cards').offsetHeight;
    
    // Ajuste automático do mapa
    const mapContainer = document.querySelector('.map-container');
    if (mapContainer) {
        if (isMobile) {
            mapContainer.style.height = `${viewportHeight * 0.6}px`;
        } else {
            mapContainer.style.height = `${viewportHeight - headerHeight - cardsHeight - 50}px`;
        }
    }
    
    // Redimensionar o mapa se necessário
    if (map) {
        setTimeout(() => {
            map.invalidateSize();
        }, 300);
    }
}

function setupMap() {
    const mapWidth = 800;
    const mapHeight = 600;

    map = L.map('map', {
        crs: L.CRS.Simple,
        minZoom: -2,
        maxZoom: 4,
        zoomSnap: 0.25,
        zoomDelta: 0.25,
        wheelPxPerZoomLevel: 120,
        zoomControl: true,
        preferCanvas: true
    });

    // Controle de zoom mais preciso
    map.scrollWheelZoom._delta = 0.2;
    map.touchZoom._delta = 0.1;

    // Suavização de zoom
    map.on('zoomanim', function(e) {
        map.setView(e.center, e.zoom, {
            animate: true,
            duration: 0.3
        });
    });

    // Desabilita zoom com double click padrão
    map.doubleClickZoom.disable();
    
    // Zoom personalizado com double click
    map.on('dblclick', function(e) {
        map.setView(e.latlng, map.getZoom() + 0.5, {
            animate: true,
            duration: 0.3
        });
    });

    const bounds = [[0, 0], [mapHeight, mapWidth]];
    L.imageOverlay('background.webp', bounds, {
        errorOverlayUrl: 'background.png',
        alt: 'Mapa do estacionamento'
    }).addTo(map);
    
    map.fitBounds(bounds);
    map.setZoom(0);
}

// Processar dados para o heatmap
function processHeatmapData(data) {
    const spots = data.map(item => ({
        x: item.x,
        y: item.y,
        intensity: item.intensity
    }));
    
    return {
        totalSpots: spots.length,
        occupied: spots.filter(s => s.intensity > 2).length,
        available: spots.filter(s => s.intensity <= 2).length,
        lastUpdate: new Date().toISOString(),
        spots: spots
    };
}

// Atualizar display do status
function updateStatusDisplay() {
    elements.occupied.textContent = parkingState.occupied;
    elements.available.textContent = parkingState.available;
    elements.totalSpots.textContent = parkingState.totalSpots;
    
    // Formatando a porcentagem de ocupação
    const occupancyRate = parkingState.totalSpots > 0 ? 
        Math.round((parkingState.occupied / parkingState.totalSpots) * 100) : 0;
    elements.occupancyRate.textContent = `${occupancyRate}%`;
    
    // Adicionando classe baseada no nível de ocupação
    elements.occupancyRate.className = 'card-value ';
    if (occupancyRate >= 75) {
        elements.occupancyRate.classList.add('high-occupancy');
    } else if (occupancyRate >= 50) {
        elements.occupancyRate.classList.add('medium-occupancy');
    } else {
        elements.occupancyRate.classList.add('low-occupancy');
    }
    
    // Formatando a data
    if (parkingState.lastUpdate) {
        const updateDate = new Date(parkingState.lastUpdate);
        const options = { 
            day: '2-digit', 
            month: '2-digit', 
            year: 'numeric', 
            hour: '2-digit', 
            minute: '2-digit' 
        };
        elements.lastUpdate.textContent = updateDate.toLocaleString('pt-BR', options);
    }
}

// Atualizar mapa de calor
function updateHeatmap() {
    if (heatLayer) {
        map.removeLayer(heatLayer);
    }
    
    const realPoints = parkingState.spots.map(p => ({ 
        x: p.x, 
        y: p.y, 
        intensity: Math.max(p.intensity, 0.01) 
    }));
    
    const heatDataMain = realPoints.map(p => [p.y, p.x, p.intensity]);
    
    // Gerar camada verde de fundo
    const greenPoints = generateGreenBackgroundPoints(800, 600, 15, realPoints, 12);
    
    // Adicionar camada de calor
    heatLayer = L.layerGroup([
        L.heatLayer(greenPoints, {
            radius: 30,
            blur: 20,
            maxZoom: 1,
            gradient: { 0.1: 'green', 1.0: 'green' }
        }),
        L.heatLayer(heatDataMain, {
            radius: 30,
            blur: 20,
            maxZoom: 1,
            gradient: { 
                0.2: 'yellow', 
                0.6: 'orange', 
                1.0: 'red' 
            }
        })
    ]).addTo(map);
}

// Função para gerar pontos de fundo verde
function generateGreenBackgroundPoints(width, height, spacing, realPoints, radius) {
    const bgPoints = [];
    for (let y = 0; y < height; y += spacing) {
        for (let x = 0; x < width; x += spacing) {
            const close = realPoints.some(p => {
                const dx = p.x - x;
                const dy = p.y - y;
                return Math.sqrt(dx * dx + dy * dy) < radius * 2;
            });
            if (!close) {
                bgPoints.push([y, x, 0.1]); // ponto verde com intensidade baixa
            }
        }
    }
    return bgPoints;
}

// Atualizar estado do estacionamento
function updateParkingState(data) {
    if (!data) return;
    
    parkingState = {
        totalSpots: data.totalSpots || data.spots.length,
        occupied: data.occupied || data.spots.filter(spot => spot.intensity > 2).length,
        available: data.available || (data.totalSpots || data.spots.length) - (data.occupied || data.spots.filter(spot => spot.intensity > 2).length),
        lastUpdate: data.lastUpdate || new Date().toISOString(),
        spots: data.spots
    };
    
    updateStatusDisplay();
    updateHeatmap();
}

// Tema switcher
const themeSwitcher = document.createElement('div');
themeSwitcher.className = 'theme-switcher';
themeSwitcher.innerHTML = `
  <button class="theme-btn light" data-theme="light"><i class="fas fa-sun"></i></button>
  <button class="theme-btn dark" data-theme="dark"><i class="fas fa-moon"></i></button>
  <button class="theme-btn modern" data-theme="modern"><i class="fas fa-paint-brush"></i></button>
`;
document.body.appendChild(themeSwitcher);

function setupThemeSwitcher() {
    const themeButtons = document.querySelectorAll('.theme-btn');
    
    themeButtons.forEach(button => {
        button.addEventListener('click', function() {
            const theme = this.getAttribute('data-theme');
            const loadingText = 'Aplicando tema...';
            
            // Mostra e esconde rápido sem animation
            const loading = document.createElement('div');
            loading.className = 'loading-notification';
            loading.textContent = loadingText;
            document.body.appendChild(loading);
            
            // Aplica o tema
            document.documentElement.setAttribute('data-theme', theme);
            localStorage.setItem('beststop-theme', theme);
            
            // Remove após 1 segundo
            setTimeout(() => {
                loading.remove();
            }, 1000);
        });
    });
    
    // Carrega tema salvo
    const savedTheme = localStorage.getItem('beststop-theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
}

// Funções para o efeito de loading
let loadingTimeout = null;

function showLoading(message = 'Carregando...') {
    // Cancela qualquer loading anterior que esteja pendente
    hideLoading();
    
    const loadingOverlay = document.createElement('div');
    loadingOverlay.className = 'loading-overlay active';
    loadingOverlay.innerHTML = `
        <div class="loader"></div>
        <div class="loading-text">${message}</div>
    `;
    document.body.appendChild(loadingOverlay);
    
    // Configura timeout de segurança para esconder automaticamente
    loadingTimeout = setTimeout(() => {
        hideLoading();
    }, 3000); // Fallback após 3 segundos
}

function hideLoading() {
    // Limpa o timeout se existir
    if (loadingTimeout) {
        clearTimeout(loadingTimeout);
        loadingTimeout = null;
    }
    
    const loadingOverlay = document.querySelector('.loading-overlay');
    if (loadingOverlay) {
        loadingOverlay.classList.remove('active');
        
        // Remove o elemento após a transição
        loadingOverlay.addEventListener('transitionend', () => {
            if (loadingOverlay.parentNode) {
                loadingOverlay.parentNode.removeChild(loadingOverlay);
            }
        }, { once: true });
    }
}
// ============ NOVAS FUNÇÕES PREMIUM ============

// Função para mostrar notificações
function showNotification(message, type = 'success') {
  const container = document.getElementById('notification-container');
  const notification = document.createElement('div');
  
  notification.className = `notification ${type} fade-in`;
  notification.textContent = message;
  
  container.appendChild(notification);
  
  // Mostra a notificação
  setTimeout(() => notification.classList.add('show'), 100);
  
  // Remove após 5 segundos
  setTimeout(() => {
    notification.classList.remove('show');
    setTimeout(() => notification.remove(), 500);
  }, 5000);
}

// Função para simular loading
function simulateLoading() {
  const cards = document.querySelectorAll('.info-card');
  cards.forEach(card => {
    const value = card.querySelector('.card-value');
    if (value) {
      value.classList.add('skeleton');
      value.textContent = '';
    }
  });
  
  setTimeout(() => {
    cards.forEach(card => {
      const value = card.querySelector('.card-value');
      if (value) value.classList.remove('skeleton');
    });
  }, 1500);
}

// ============ EXEMPLO DE USO ============
// Você pode chamar essas funções quando necessário, por exemplo:

// Mostrar notificação ao carregar
document.addEventListener('DOMContentLoaded', () => {
  // Exemplo: mostrar notificação
  showNotification('Sistema conectado com sucesso', 'success');
  
  // Exemplo: simular loading
  simulateLoading();
  
  // Seu código initApp() existente
  initApp();
});

// Iniciar a aplicação quando o DOM estiver carregado
document.addEventListener('DOMContentLoaded', initApp);
