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
        if (!response.ok) {
            // Retorna dados padrão se o arquivo não for encontrado
            if (response.status === 404) {
                console.warn("Arquivo data.json não encontrado, usando dados padrão");
                return processHeatmapData([{
                    sector: "DEFAULT",
                    coordinates: [{x: 100, y: 100, intensity: 0}],
                    totalSpots: 1,
                    status: "low"
                }]);
            }
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
        minZoom: -1,
        maxZoom: 2,
        zoomSnap: 0.5,
        zoomDelta: 0.5,
        wheelPxPerZoomLevel: 120,
        zoomControl: true,
        preferCanvas: true
    });

    const bounds = [[0, 0], [mapHeight, mapWidth]];
    
    // 1. Camada base: Imagem de fundo
    L.imageOverlay('background.webp', bounds, {
        errorOverlayUrl: 'background.png',
        alt: 'Mapa do estacionamento',
        opacity: 1.0
    }).addTo(map);

    // 2. Camada azul semi-transparente
    L.rectangle(bounds, {
        color: 'transparent',
        fillColor: '#1a73e8',
        fillOpacity: 0.3,
        weight: 0
    }).addTo(map);

    // 3. Camada única para os setores
    window.sectorLayer = L.layerGroup().addTo(map);

    map.fitBounds(bounds);
    map.setZoom(0);
}
// Processar dados para heatmap
function processHeatmapData(data) {
    let totalOccupied = 0, totalAvailable = 0, totalSpots = 0;
    
    const processedSectors = data.map(sector => {
        totalOccupied += sector.occupied;
        totalAvailable += (sector.total_spots - sector.occupied);
        totalSpots += sector.total_spots;

        // Calcula pontos para o heatmap baseado na ocupação
        const heatPoints = [];
        const width = Math.abs(sector.position.x2 - sector.position.x1);
        const height = Math.abs(sector.position.y2 - sector.position.y1);
        const spotsPerRow = 5; // Ajuste conforme necessário
        
        // Cria pontos fictícios para o heatmap
        for (let i = 0; i < sector.total_spots; i++) {
            const row = Math.floor(i / spotsPerRow);
            const col = i % spotsPerRow;
            const x = sector.position.x1 + (width * (col / spotsPerRow));
            const y = sector.position.y1 + (height * (row / Math.ceil(sector.total_spots / spotsPerRow)));
            
            // Intensidade baseada na ocupação do setor
            const intensity = i < sector.occupied ? 1.5 : 0.3;
            heatPoints.push({ x, y, intensity });
        }

        return {
            ...sector,
            coordinates: heatPoints,
            available: sector.total_spots - sector.occupied,
            occupancyRate: Math.round((sector.occupied / sector.total_spots) * 100)
        };
    });

    return {
        totalSpots,
        occupied: totalOccupied,
        available: totalAvailable,
        lastUpdate: new Date().toISOString(),
        sectors: processedSectors
    };
}
function atualizarHorario() {
    const agora = new Date();
    elements.lastUpdate.textContent = agora.toLocaleString('pt-BR', {
        day: '2-digit', 
        month: '2-digit', 
        year: 'numeric',
        hour: '2-digit', 
        minute: '2-digit'
    });
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
            
            atualizarHorario();
            showNotification('Dados atualizados com sucesso', 'success');
        }
    } catch (err) {
        console.error("Erro ao carregar heatmap:", err);
        showNotification('Erro ao atualizar dados', 'error');
    }
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

function updateSectors() {
    if (!window.sectorLayer) {
        window.sectorLayer = L.layerGroup().addTo(map);
    } else {
        window.sectorLayer.clearLayers();
    }

    parkingState.sectors.forEach(sector => {
        const bounds = [
            [sector.position.y1, sector.position.x1],
            [sector.position.y2, sector.position.x2]
        ];
        
        const color = getSectorColor(sector.status);
        const opacity = sector.status === 'high' ? 0.6 : 0.4;

        // Cria retângulo do setor
        L.rectangle(bounds, {
            color: color,
            fillColor: color,
            fillOpacity: opacity,
            weight: 2
        }).bindTooltip(`
            <strong>Setor ${sector.sector}</strong><br>
            Vagas: ${sector.occupied}/${sector.total_spots}<br>
            ${Math.round((sector.occupied/sector.total_spots)*100)}% ocupado
        `, {direction: 'top'}).addTo(window.sectorLayer);

        // Adiciona label do setor
        const center = [
            (sector.position.y1 + sector.position.y2) / 2,
            (sector.position.x1 + sector.position.x2) / 2
        ];
        
        L.marker(center, {
            icon: L.divIcon({
                html: `<div class="sector-label">${sector.sector}</div>`,
                className: 'sector-label-container',
                iconSize: [40, 40]
            }),
            interactive: false
        }).addTo(window.sectorLayer);
    });
}

// Função auxiliar para calcular o centro
function getCenter(bounds) {
    return [
        (bounds[0][0] + bounds[1][0]) / 2,
        (bounds[0][1] + bounds[1][1]) / 2
    ];
}

// Função auxiliar para calcular o centro do retângulo
function getCenter(bounds) {
    return [
        (bounds[0][0] + bounds[1][0]) / 2,
        (bounds[0][1] + bounds[1][1]) / 2
    ];
}

function getSectorColor(status) {
    switch(status) {
        case 'high': return '#e74c3c';
        case 'medium': return '#f3c212ff';
        case 'low': return '#0062ffff';
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
    updateSectors();  // Alterado de updateHeatmap() para updateSectors()
    updateSectorInfo();
}

function updateSectorInfo() {
    const sectorsContainer = document.getElementById('sectors-info');
    if (!sectorsContainer) return;

    sectorsContainer.innerHTML = '';

    parkingState.sectors.forEach(sector => {
        const sectorEl = document.createElement('div');
        sectorEl.className = `sector-card ${sector.status}`;
        sectorEl.innerHTML = `
            <h3>Setor ${sector.sector}</h3>
            <div class="sector-meta">
                <span class="sector-dimensions">
                    ${Math.abs(sector.position.x2 - sector.position.x1)}x${Math.abs(sector.position.y2 - sector.position.y1)}m
                </span>
                <span class="sector-spots">${sector.total_spots} vagas</span>
            </div>
            <div class="sector-stats">
                <span><i class="fas fa-car"></i> ${sector.occupied}</span>
                <span><i class="fas fa-parking"></i> ${sector.available}</span>
                <span><i class="fas fa-percentage"></i> ${sector.occupancyRate}%</span>
            </div>
            <div class="sector-status">${getStatusText(sector.status)}</div>
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
            applyTheme(theme);
        });
    });
    
    // Verifica se há um tema salvo no localStorage ou usa o preferido do sistema
    const savedTheme = localStorage.getItem('beststop-theme');
    const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    const initialTheme = savedTheme || (systemPrefersDark ? 'dark' : 'light');
    applyTheme(initialTheme);
}

function applyTheme(theme) {
    // Mostra feedback visual durante a troca
    const loading = document.createElement('div');
    loading.className = 'loading-notification';
    loading.textContent = 'Mudando tema...';
    document.body.appendChild(loading);
    
    // Aplica o tema
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('beststop-theme', theme);
    
    // Atualiza o estado ativo dos botões
    document.querySelectorAll('.theme-btn').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-theme') === theme);
    });
    
    // Remove o feedback após 1 segundo
    setTimeout(() => {
        loading.remove();
        showNotification(`Tema ${theme === 'dark' ? 'escuro' : 'claro'} aplicado`, 'success');
    }, 800);
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
    setupThemeSwitcher(); // Adicione esta linha
    initApp();
});
