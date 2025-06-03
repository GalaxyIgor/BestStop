// Elementos do DOM
const elements = {
    // Dashboard
    occupied: document.getElementById('occupied'),
    available: document.getElementById('available'),
    totalSpots: document.getElementById('total-spots'),
    occupancyRate: document.getElementById('occupancy-rate'),
    lastUpdate: document.getElementById('last-update'),
    
    // Mapa
    map: document.getElementById('map'),
    
    // Configuração
    configMap: document.getElementById('config-map'),
    spotsPreview: document.getElementById('spots-preview'),
    spotsList: document.getElementById('spots-list'),
    spotColumn: document.getElementById('spot-column'),
    spotRow: document.getElementById('spot-row'),
    spotStatus: document.getElementById('spot-status'),
    saveButton: document.getElementById('save-config'),
    clearButton: document.getElementById('clear-config'),
    
    // Abas
    tabLinks: document.querySelectorAll('.nav-link'),
    tabContents: document.querySelectorAll('.tab-content')
};

// Estado do estacionamento
let parkingState = {
    totalSpots: 0,
    occupied: 0,
    available: 0,
    lastUpdate: null,
    spots: [],
    layout: {
        columns: 4,
        rows: 10,
        leftMargin: 50,
        topMargin: 30,
        colSpacing: 150,
        rowSpacing: 40
    }
};

// Variáveis para configuração
let configMode = false;
let currentSpotId = 0;
let spotsBeingConfigured = [];
let map, configMap, heatLayer;

// Inicialização da aplicação
async function initApp() {
    setupTabs();
    setupMap();
    setupConfigMap();
    
    const parkingData = await loadParkingData();
    if (parkingData) {
        updateParkingState(parkingData);
        setupConfigMode();
        
        // Simular atualização periódica apenas na aba de visualização
        setInterval(async () => {
            if (!configMode) {
                const newData = await loadParkingData();
                if (newData) updateParkingState(newData);
            }
        }, 5000);
    }
}

// Configurar o mapa principal
function setupMap() {
    const mapWidth = 800;
    const mapHeight = 600;

    map = L.map('map', {
        crs: L.CRS.Simple,
        minZoom: -1,
        maxZoom: 2,
        zoomControl: true
    });

    const bounds = [[0, 0], [mapHeight, mapWidth]];
    L.imageOverlay('background.png', bounds).addTo(map);
    map.fitBounds(bounds);
}

// Configurar o mapa de configuração
function setupConfigMap() {
    const mapWidth = 800;
    const mapHeight = 600;

    configMap = L.map('config-map', {
        crs: L.CRS.Simple,
        minZoom: -1,
        maxZoom: 2,
        zoomControl: false,
        dragging: false,
        doubleClickZoom: false,
        boxZoom: false,
        scrollWheelZoom: false
    });

    const bounds = [[0, 0], [mapHeight, mapWidth]];
    L.imageOverlay('background.png', bounds).addTo(configMap);
    configMap.fitBounds(bounds);
}

// Carregar dados do JSON
async function loadParkingData() {
    try {
        const response = await fetch('data.json');
        if (!response.ok) {
            throw new Error('Falha ao carregar dados');
        }
        const data = await response.json();
        return processHeatmapData(data);
    } catch (error) {
        console.error('Erro ao carregar dados:', error);
        return null;
    }
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
        spots: data.spots,
        layout: data.layout || parkingState.layout
    };
    
    updateStatusDisplay();
    updateHeatmap();
}

// Configurar o sistema de abas
function setupTabs() {
    elements.tabLinks.forEach(button => {
        button.addEventListener('click', (e) => {
            e.preventDefault();
            
            // Remove active class from all buttons and contents
            elements.tabLinks.forEach(btn => btn.classList.remove('active'));
            elements.tabContents.forEach(content => content.classList.remove('active'));
            
            // Add active class to clicked button and corresponding content
            button.classList.add('active');
            const tabId = button.getAttribute('data-tab');
            document.getElementById(tabId).classList.add('active');
            
            // Atualiza o modo
            configMode = tabId === 'config';
            
            // Redimensiona o mapa quando a aba é alterada
            setTimeout(() => {
                if (map) map.invalidateSize();
                if (configMap) configMap.invalidateSize();
            }, 100);
        });
    });
}

// Configurar o modo de configuração
function setupConfigMode() {
    // Carrega as vagas existentes
    loadExistingSpots();

    // Adiciona nova vaga ao clicar na imagem
    elements.configMap._container.addEventListener('click', (e) => {
        if (!configMode) return;

        const rect = elements.configMap._container.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        // Converte coordenadas da tela para coordenadas do mapa
        const point = configMap.containerPointToLatLng([x, y]);
        const mapX = point.y;
        const mapY = point.x;

        const column = elements.spotColumn.value;
        const row = elements.spotRow.value;
        const occupied = elements.spotStatus.value === 'true';

        const newSpot = {
            id: ++currentSpotId,
            x: mapX,
            y: mapY,
            column: parseInt(column),
            row: parseInt(row),
            occupied: occupied,
            intensity: occupied ? 4 : 0.5
        };

        spotsBeingConfigured.push(newSpot);
        renderConfiguredSpots();
    });

    // Salvar configuração
    elements.saveButton.addEventListener('click', async () => {
        if (spotsBeingConfigured.length === 0) {
            alert('Adicione pelo menos uma vaga antes de salvar');
            return;
        }

        const newData = {
            totalSpots: spotsBeingConfigured.length,
            occupied: spotsBeingConfigured.filter(s => s.occupied).length,
            available: spotsBeingConfigured.filter(s => !s.occupied).length,
            lastUpdate: new Date().toISOString(),
            spots: spotsBeingConfigured
        };

        // Salvando os dados
        const saved = await saveParkingData(newData);
        if (saved) {
            alert('Configuração salva com sucesso! Atualizando visualização...');
            // Atualiza a visualização
            updateParkingState(newData);
        } else {
            alert('Erro ao salvar configuração');
        }
    });

    // Limpar configuração
    elements.clearButton.addEventListener('click', () => {
        if (confirm('Tem certeza que deseja limpar todas as vagas configuradas?')) {
            spotsBeingConfigured = [];
            currentSpotId = 0;
            renderConfiguredSpots();
        }
    });
}

// Salvar dados no JSON
async function saveParkingData(data) {
    try {
        // Criar um blob com os dados
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        
        // Criar link para download
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'data.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        
        console.log('Dados prontos para serem salvos em data.json');
        return true;
    } catch (error) {
        console.error('Erro ao salvar dados:', error);
        return false;
    }
}

// Carregar vagas existentes
function loadExistingSpots() {
    spotsBeingConfigured = [...parkingState.spots.map(spot => ({
        ...spot,
        occupied: spot.intensity > 2
    }))];
    
    currentSpotId = spotsBeingConfigured.length > 0 ? 
        Math.max(...spotsBeingConfigured.map(s => s.id)) : 0;
    renderConfiguredSpots();
}

// Renderizar vagas configuradas
function renderConfiguredSpots() {
    // Limpa a visualização
    elements.spotsPreview.innerHTML = '';
    elements.spotsList.innerHTML = '';

    // Adiciona marcadores na imagem
    spotsBeingConfigured.forEach(spot => {
        const marker = document.createElement('div');
        marker.className = `spot-marker ${spot.occupied ? 'occupied' : ''}`;
        
        // Converte coordenadas do mapa para coordenadas da tela
        const point = configMap.latLngToContainerPoint([spot.y, spot.x]);
        marker.style.left = `${point.x}px`;
        marker.style.top = `${point.y}px`;
        
        marker.title = `Vaga ${spot.id} (Col ${spot.column}, Fila ${spot.row}) - ${spot.occupied ? 'Ocupada' : 'Livre'}`;
        marker.addEventListener('click', (e) => {
            e.stopPropagation();
            removeSpot(spot.id);
        });
        elements.spotsPreview.appendChild(marker);
    });

    // Adiciona itens na lista
    spotsBeingConfigured.forEach(spot => {
        const spotItem = document.createElement('div');
        spotItem.className = `spot-item ${spot.occupied ? 'occupied' : ''}`;
        spotItem.innerHTML = `
            <div class="spot-info">
                <strong>Vaga ${spot.id}</strong> - Col ${spot.column}, Fila ${spot.row}
                <br>Status: ${spot.occupied ? 'Ocupada' : 'Livre'}
                <br>Posição: (${Math.round(spot.x)}, ${Math.round(spot.y)})
            </div>
            <div class="spot-actions">
                <button class="btn toggle-status" data-id="${spot.id}">
                    <i class="fas fa-sync-alt"></i> Alternar
                </button>
                <button class="btn btn-danger remove-spot" data-id="${spot.id}">
                    <i class="fas fa-trash"></i> Remover
                </button>
            </div>
        `;
        elements.spotsList.appendChild(spotItem);
    });

    // Adiciona eventos
    document.querySelectorAll('.remove-spot').forEach(button => {
        button.addEventListener('click', (e) => {
            const id = parseInt(e.target.getAttribute('data-id'));
            removeSpot(id);
        });
    });

    document.querySelectorAll('.toggle-status').forEach(button => {
        button.addEventListener('click', (e) => {
            const id = parseInt(e.target.getAttribute('data-id'));
            toggleSpotStatus(id);
        });
    });
}

// Remover vaga
function removeSpot(id) {
    spotsBeingConfigured = spotsBeingConfigured.filter(spot => spot.id !== id);
    renderConfiguredSpots();
}

// Alternar status da vaga
function toggleSpotStatus(id) {
    const spotIndex = spotsBeingConfigured.findIndex(spot => spot.id === id);
    if (spotIndex !== -1) {
        spotsBeingConfigured[spotIndex].occupied = !spotsBeingConfigured[spotIndex].occupied;
        spotsBeingConfigured[spotIndex].intensity = spotsBeingConfigured[spotIndex].occupied ? 4 : 0.5;
        renderConfiguredSpots();
    }
}

// Adicione no início do arquivo, após a definição dos elementos
const themeSwitcher = document.createElement('div');
themeSwitcher.className = 'theme-switcher';
themeSwitcher.innerHTML = `
  <button class="theme-btn light" data-theme="light"><i class="fas fa-sun"></i></button>
  <button class="theme-btn dark" data-theme="dark"><i class="fas fa-moon"></i></button>
  <button class="theme-btn modern" data-theme="modern"><i class="fas fa-paint-brush"></i></button>
`;
document.body.appendChild(themeSwitcher);

// Adicione esta função após a função setupTabs()
function setupThemeSwitcher() {
    const themeButtons = document.querySelectorAll('.theme-btn');
    
    themeButtons.forEach(button => {
        button.addEventListener('click', () => {
            const theme = button.getAttribute('data-theme');
            document.documentElement.setAttribute('data-theme', theme);
            localStorage.setItem('beststop-theme', theme);
            
            // Adiciona efeito de loading ao trocar tema
            showLoading('Aplicando tema...');
            setTimeout(hideLoading, 800);
        });
    });
    
    // Carrega tema salvo
    const savedTheme = localStorage.getItem('beststop-theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
}

// Adicione estas funções para o efeito de loading
function showLoading(message = 'Carregando...') {
    const loadingOverlay = document.createElement('div');
    loadingOverlay.className = 'loading-overlay active';
    loadingOverlay.innerHTML = `
        <div class="loader"></div>
        <div class="loading-text">${message}</div>
    `;
    document.body.appendChild(loadingOverlay);
}

function hideLoading() {
    const loadingOverlay = document.querySelector('.loading-overlay');
    if (loadingOverlay) {
        loadingOverlay.classList.remove('active');
        setTimeout(() => {
            loadingOverlay.remove();
        }, 300);
    }
}


// Iniciar a aplicação quando o DOM estiver carregado
document.addEventListener('DOMContentLoaded', initApp);