// Elementos do DOM
const elements = {
    occupied: document.getElementById('occupied'),
    available: document.getElementById('available'),
    totalSpots: document.getElementById('total-spots'),
    occupancyRate: document.getElementById('occupancy-rate'),
    lastUpdate: document.getElementById('last-update'),
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
let lastDataHash = '';
let loadingTimeout = null;

// Função debounce
function debounce(func, timeout = 300) {
    let timer;
    return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => { func.apply(this, args); }, timeout);
    };
}

// Inicialização principal
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
    
    showNotification('Sistema conectado com sucesso', 'success');
}

// Carregar dados do estacionamento
async function loadParkingData() {
    try {
        const response = await fetch('data.json');
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
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

// Atualização automática
function setupAutoRefresh() {
    setInterval(async () => {
        try {
            const newData = await loadParkingData();
            if (newData) updateParkingState(newData);
        } catch (error) {
            console.error("Refresh error:", error);
        }
    }, 5000);
}

// Layout responsivo
function handleResponsiveLayout() {
    const isMobile = window.innerWidth <= 480;
    const headerHeight = document.querySelector('.main-header').offsetHeight;
    const viewportHeight = window.innerHeight;
    const cardsHeight = document.querySelector('.info-cards').offsetHeight;
    const mapContainer = document.querySelector('.map-container');

    if (mapContainer) {
        if (isMobile) {
            mapContainer.style.height = `${viewportHeight * 0.6}px`;
        } else {
            mapContainer.style.height = `${viewportHeight - headerHeight - cardsHeight - 50}px`;
        }
    }

    if (map) {
        setTimeout(() => map.invalidateSize(), 300);
    }
}

// Configuração do mapa
function setupMap() {
    const mapWidth = 800, mapHeight = 600;

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

    map.scrollWheelZoom._delta = 0.2;
    map.touchZoom._delta = 0.1;

    map.on('zoomanim', e => {
        map.setView(e.center, e.zoom, { animate: true, duration: 0.3 });
    });

    map.doubleClickZoom.disable();
    map.on('dblclick', e => {
        map.setView(e.latlng, map.getZoom() + 0.5, { animate: true, duration: 0.3 });
    });

    const bounds = [[0, 0], [mapHeight, mapWidth]];
    L.imageOverlay('background.webp', bounds, {
        errorOverlayUrl: 'background.png',
        alt: 'Mapa do estacionamento'
    }).addTo(map);
    
    map.fitBounds(bounds);
    map.setZoom(0);
}

// Processar dados para heatmap
function processHeatmapData(data) {
    let totalOccupied = 0, totalAvailable = 0, totalSpots = 0;
    const allSpots = [];
  
    data.forEach(sector => {
        const sectorSpots = sector.coordinates.map(spot => ({
            ...spot,
            sector: sector.sector,
            status: sector.status
        }));
        
        allSpots.push(...sectorSpots);
        const occupied = sectorSpots.filter(s => s.intensity > 2).length;
        const available = sectorSpots.length - occupied;
        
        totalOccupied += occupied;
        totalAvailable += available;
        totalSpots += sectorSpots.length;
    });
  
    return {
        totalSpots,
        occupied: totalOccupied,
        available: totalAvailable,
        lastUpdate: new Date().toISOString(),
        spots: allSpots,
        sectors: data
    };
}

// Carregar heatmap manualmente
async function carregarHeatmap() {
    try {
        const response = await fetch(`data.json?t=${Date.now()}`);
        const data = await response.json();
        const currentHash = JSON.stringify(data);

        if (currentHash !== lastDataHash) {
            lastDataHash = currentHash;
            const processedData = processHeatmapData(data);
            updateParkingState(processedData);

            if (window.heatLayer) map.removeLayer(window.heatLayer);
            const heatPoints = data.map(ponto => [ponto.y, ponto.x, ponto.intensity]);

            window.heatLayer = L.heatLayer(heatPoints, {
                radius: 25,
                blur: 15,
                maxZoom: 17,
            }).addTo(map);
            
            atualizarHorario();
            showNotification('Dados atualizados com sucesso', 'success');
        }
    } catch (err) {
        console.error("Erro ao carregar heatmap:", err);
        showNotification('Erro ao atualizar dados', 'error');
    }
}

// WebSocket
function setupWebSocket() {
    const socket = new WebSocket('ws://localhost:8080');
  
    socket.onmessage = event => {
        const data = JSON.parse(event.data);
        const processedData = processHeatmapData(data);
        updateParkingState(processedData);
        showNotification('Dados atualizados em tempo real', 'success');
    };
  
    socket.onerror = error => {
        console.error('WebSocket error:', error);
        setInterval(carregarHeatmap, 1000); // fallback
    };
}

function atualizarHorario() {
    const agora = new Date();
    document.getElementById("last-update").innerText = agora.toLocaleString('pt-BR');
}

// Atualização de status
function updateStatusDisplay() {
    elements.occupied.textContent = parkingState.occupied;
    elements.available.textContent = parkingState.available;
    elements.totalSpots.textContent = parkingState.totalSpots;

    const occupancyRate = parkingState.totalSpots > 0 ? 
        Math.round((parkingState.occupied / parkingState.totalSpots) * 100) : 0;
    elements.occupancyRate.textContent = `${occupancyRate}%`;

    elements.occupancyRate.className = 'card-value ';
    if (occupancyRate >= 75) elements.occupancyRate.classList.add('high-occupancy');
    else if (occupancyRate >= 50) elements.occupancyRate.classList.add('medium-occupancy');
    else elements.occupancyRate.classList.add('low-occupancy');

    if (parkingState.lastUpdate) {
        const updateDate = new Date(parkingState.lastUpdate);
        elements.lastUpdate.textContent = updateDate.toLocaleString('pt-BR', {
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });
    }
}

// Atualização do mapa de calor
function updateHeatmap() {
    if (heatLayer) map.removeLayer(heatLayer);

    const sectorLayers = parkingState.sectors.map(sector => {
        const color = getSectorColor(sector.status);
        const bounds = calculateSectorBounds(sector.coordinates);
        return L.rectangle(bounds, {
            color, fillColor: color, fillOpacity: 0.3, weight: 2
        }).bindPopup(`Setor ${sector.sector}<br>Status: ${getStatusText(sector.status)}`);
    });

    const heatDataMain = parkingState.spots.map(p => [p.y, p.x, p.intensity]);
  
    heatLayer = L.layerGroup([
        ...sectorLayers,
        L.heatLayer(heatDataMain, {
            radius: 25, blur: 15, maxZoom: 1,
            gradient: { 0.2: 'yellow', 0.6: 'orange', 1.0: 'red' }
        })
    ]).addTo(map);
}

function getSectorColor(status) {
    switch(status) {
        case 'high': return '#e74c3c';
        case 'medium': return '#f39c12';
        case 'low': return '#2ecc71';
        default: return '#3498db';
    }
}

function getStatusText(status) {
    switch(status) {
        case 'high': return 'Alta Ocupação';
        case 'medium': return 'Média Ocupação';
        case 'low': return 'Baixa Ocupação';
        default: return 'Desconhecido';
    }
}

function calculateSectorBounds(coordinates) {
    const xs = coordinates.map(c => c.x);
    const ys = coordinates.map(c => c.y);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    const margin = 20;
    return [[minY - margin, minX - margin], [maxY + margin, maxX + margin]];
}

function updateParkingState(data) {
    if (!data) return;
    parkingState = { ...data, sectors: data.sectors || [] };
    updateStatusDisplay();
    updateHeatmap();
    updateSectorInfo();
}

function updateSectorInfo() {
    const sectorsContainer = document.getElementById('sectors-info') || createSectorsContainer();
    sectorsContainer.innerHTML = '';
  
    parkingState.sectors.forEach(sector => {
        const occupied = sector.coordinates.filter(s => s.intensity > 2).length;
        const available = sector.coordinates.length - occupied;
        const occupancyRate = Math.round((occupied / sector.coordinates.length) * 100);
        
        const sectorEl = document.createElement('div');
        sectorEl.className = `sector-card ${sector.status}`;
        sectorEl.innerHTML = `
            <h3>Setor ${sector.sector}</h3>
            <div class="sector-stats">
                <span>Ocupadas: ${occupied}</span>
                <span>Livres: ${available}</span>
                <span>Ocupação: ${occupancyRate}%</span>
            </div>
            <div class="sector-status">Status: ${getStatusText(sector.status)}</div>
        `;
        sectorsContainer.appendChild(sectorEl);
    });
}

function createSectorsContainer() {
    const container = document.createElement('div');
    container.id = 'sectors-info';
    container.className = 'sectors-container';
    document.querySelector('.dashboard-container')
        .insertBefore(container, document.querySelector('.map-container'));
    return container;
}

// Tema
function setupThemeSwitcher() {
    const themeButtons = document.querySelectorAll('.theme-btn');
    themeButtons.forEach(button => {
        button.addEventListener('click', function() {
            const theme = this.getAttribute('data-theme');
            const loading = document.createElement('div');
            loading.className = 'loading-notification';
            loading.textContent = 'Aplicando tema...';
            document.body.appendChild(loading);
            
            document.documentElement.setAttribute('data-theme', theme);
            localStorage.setItem('beststop-theme', theme);
            
            setTimeout(() => loading.remove(), 1000);
        });
    });
    const savedTheme = localStorage.getItem('beststop-theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
}

// Loading
function showLoading(message = 'Carregando...') {
    hideLoading();
    const loadingOverlay = document.createElement('div');
    loadingOverlay.className = 'loading-overlay active';
    loadingOverlay.innerHTML = `
        <div class="loader"></div>
        <div class="loading-text">${message}</div>
    `;
    document.body.appendChild(loadingOverlay);
    loadingTimeout = setTimeout(hideLoading, 3000);
}

function hideLoading() {
    if (loadingTimeout) clearTimeout(loadingTimeout);
    loadingTimeout = null;
    const loadingOverlay = document.querySelector('.loading-overlay');
    if (loadingOverlay) {
        loadingOverlay.classList.remove('active');
        loadingOverlay.addEventListener('transitionend', () => {
            loadingOverlay.remove();
        }, { once: true });
    }
}

// Notificações
function showNotification(message, type = 'success') {
    const container = document.getElementById('notification-container');
    const notification = document.createElement('div');
    notification.className = `notification ${type} fade-in`;
    notification.textContent = message;
    container.appendChild(notification);
    setTimeout(() => notification.classList.add('show'), 100);
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 500);
    }, 5000);
}

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

// Iniciar aplicação
document.addEventListener('DOMContentLoaded', () => {
    simulateLoading();
    initApp();
});
