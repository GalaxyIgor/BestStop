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
    sectors: []
};

let map, heatLayer;
let lastDataHash = '';
let loadingTimeout = null;

// URL da API (substitua pela sua URL real)
const API_URL = 'http://localhost:5000/dados';

fetch("http://localhost:5000/dados")
  .then(response => response.json())
  .then(data => console.log("Dados da API:", data))
  .catch(error => console.error("Erro:", error));

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


// Carregar dados da API
// Função principal para carregar dados
async function loadParkingData() {
    try {
        const response = await fetch(API_URL);
        if (!response.ok) {
            throw new Error(`Erro HTTP! status: ${response.status}`);
        }
        const apiData = await response.json();
        return processApiData(apiData);
    } catch (error) {
        console.error('Erro ao carregar dados:', error);
        showNotification('Falha ao conectar com a API', 'error');
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

// Processar dados da API para o formato do sistema
function processApiData(apiData) {
    // Criar dados fictícios de setores (ajuste conforme sua necessidade real)
    const sectors = [
        {
            sector: "A",
            position: { x1: 30, y1: 570, x2: 170, y2: 20},
            total_spots: apiData.total_vagas,
            occupied: apiData.vagas_ocupadas,
            available: apiData.vagas_livres, // Adicionando vagas disponíveis
            occupancyRate: Math.round((apiData.vagas_ocupadas / apiData.total_vagas) * 100), // Calculando taxa de ocupação
            status: apiData.perc_ocupadas > 70 ? 'high' :
                   apiData.perc_ocupadas > 40 ? 'medium' : 'low'
        },
        {
            sector: "B",
            position: { x1: 170, y1: 570, x2: 310, y2: 20},
            total_spots: 10,
            occupied: 9,
            available: 1, // Adicionando vagas disponíveis
            occupancyRate: Math.round((9 / 10) * 100), // Calculando taxa de ocupação
            status: 'high'
        },
        {
            sector: "C",
            position: { x1: 490, y1: 570, x2: 630, y2: 20},
            total_spots: 10,
            occupied: 5,
            available: 5, // Adicionando vagas disponíveis
            occupancyRate: Math.round((5 / 10) * 100), // Calculando taxa de ocupação
            status: "medium"
        },
        {
            sector: "D",
            position: { x1: 630, y1: 570, x2: 770, y2: 20},
            total_spots: 10,
            occupied: 2,
            available: 8, // Adicionando vagas disponíveis
            occupancyRate: Math.round((2 / 10) * 100), // Calculando taxa de ocupação
            status: "low"
        }
        ];
    // Calcular totais gerais somando todos os setores
    const totalSpots = sectors.reduce((sum, sector) => sum + sector.total_spots, 0);
    const totalOccupied = sectors.reduce((sum, sector) => sum + sector.occupied, 0);
    const totalAvailable = sectors.reduce((sum, sector) => sum + sector.available, 0);

    return {
        totalSpots: totalSpots,
        occupied: totalOccupied,
        available: totalAvailable,
        lastUpdate: new Date().toISOString(),
        sectors: sectors
    };
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

// Configuração do mapa (mantido igual)
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

// Carregar dados manualmente
async function carregarDados() {
    try {
        const response = await fetch(`${API_URL}?t=${Date.now()}`);
        const apiData = await response.json();
        const currentHash = JSON.stringify(apiData);

        if (currentHash !== lastDataHash) {
            lastDataHash = currentHash;
            const processedData = processApiData(apiData);
            updateParkingState(processedData);

            atualizarHorario();
            showNotification('Dados atualizados com sucesso', 'success');
        }
    } catch (err) {
        console.error("Erro ao carregar dados:", err);
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

// Função auxiliar para calcular o centro do retângulo
function getCenter(bounds) {
    return [
        (bounds[0][0] + bounds[1][0]) / 2,
        (bounds[0][1] + bounds[1][1]) / 2
    ];
}

function getSectorColor(status) {
    switch(status) {
        case 'high': return '#ff0000';
        case 'medium': return '#ffc600';
        case 'low': return '#11ff00';
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
    updateSectors();
    updateSectorInfo();
}

function updateSectorInfo() {
    const sectorsContainer = document.getElementById('sectors-info');
    if (!sectorsContainer) return;

    sectorsContainer.innerHTML = '';

    parkingState.sectors.forEach(sector => {
        const available = sector.available || (sector.total_spots - sector.occupied);
        const occupancyRate = sector.occupancyRate ||
            (sector.total_spots > 0 ? Math.round((sector.occupied / sector.total_spots) * 100) : 0);

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
                <span><i class="fas fa-parking"></i> ${available}</span>
                <span><i class="fas fa-percentage"></i> ${occupancyRate}%</span>
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
    setupThemeSwitcher();
    initApp();
});
