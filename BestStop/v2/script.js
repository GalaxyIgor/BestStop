// Elementos do DOM
const elements = {
    occupied: document.getElementById('occupied'),
    available: document.getElementById('available'),
    totalSpots: document.getElementById('total-spots'),
    occupancyRate: document.getElementById('occupancy-rate'),
    lastUpdate: document.getElementById('last-update'),
    heatmapOverlay: document.getElementById('heatmap-overlay'),
    spotsList: document.getElementById('spots-list'),
    spotsPreview: document.getElementById('spots-preview'),
    configMap: document.getElementById('config-map'),
    spotColumn: document.getElementById('spot-column'),
    spotRow: document.getElementById('spot-row'),
    spotStatus: document.getElementById('spot-status'),
    saveButton: document.getElementById('save-config'),
    clearButton: document.getElementById('clear-config')
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

// Inicialização da aplicação
async function initApp() {
    const parkingData = await loadParkingData();
    if (parkingData) {
        updateParkingState(parkingData);
        setupTabs();
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

// Carregar dados do JSON
async function loadParkingData() {
    try {
        const response = await fetch('data.json');
        if (!response.ok) {
            throw new Error('Falha ao carregar dados');
        }
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Erro ao carregar dados:', error);
        return null;
    }
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

// Atualizar display do status
function updateStatusDisplay() {
    elements.occupied.textContent = parkingState.occupied;
    elements.available.textContent = parkingState.available;
    elements.totalSpots.textContent = parkingState.totalSpots;
    elements.occupancyRate.textContent = parkingState.totalSpots > 0 ? 
        `${Math.round((parkingState.occupied / parkingState.totalSpots) * 100)}%` : 
        '0%';
    
    if (parkingState.lastUpdate) {
        const updateDate = new Date(parkingState.lastUpdate);
        elements.lastUpdate.textContent = updateDate.toLocaleString();
    }
}

// Criar mapa de calor
function createHeatmap() {
    elements.heatmapOverlay.innerHTML = '';
    
    parkingState.spots.forEach(spot => {
        const heatSpot = document.createElement('div');
        heatSpot.className = `heat-spot ${spot.occupied ? 'occupied' : 'available'}`;
        heatSpot.style.left = `${spot.x}px`;
        heatSpot.style.top = `${spot.y}px`;
        heatSpot.style.width = `${spot.width || 20}px`;
        heatSpot.style.height = `${spot.height || 20}px`;
        
        // Intensidade baseada na confiança
        const intensity = Math.floor((spot.confidence || 0.9) * 100);
        heatSpot.style.opacity = 0.5 + (intensity / 200);
        
        // Tooltip informativo
        heatSpot.title = `Vaga ${spot.id}\nStatus: ${spot.occupied ? 'Ocupada' : 'Livre'}\nColuna: ${spot.column}\nFila: ${spot.row}\nConfiança: ${intensity}%`;
        
        elements.heatmapOverlay.appendChild(heatSpot);
    });
}

// Atualizar estado do estacionamento
function updateParkingState(data) {
    if (!data) return;
    
    const occupied = data.spots.filter(spot => spot.occupied).length;
    
    parkingState = {
        totalSpots: data.totalSpots || data.spots.length,
        occupied: occupied,
        available: (data.totalSpots || data.spots.length) - occupied,
        lastUpdate: data.lastUpdate || new Date().toISOString(),
        spots: data.spots,
        layout: data.layout || parkingState.layout
    };
    
    updateStatusDisplay();
    createHeatmap();
}

// Configurar o sistema de abas
function setupTabs() {
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');

    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            // Remove active class from all buttons and contents
            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabContents.forEach(content => content.classList.remove('active'));
            
            // Add active class to clicked button and corresponding content
            button.classList.add('active');
            const tabId = button.getAttribute('data-tab');
            document.getElementById(tabId).classList.add('active');
            
            // Atualiza o modo
            configMode = tabId === 'config';
        });
    });
}

// Configurar o modo de configuração
function setupConfigMode() {
    // Carrega as vagas existentes
    loadExistingSpots();

    // Adiciona nova vaga ao clicar na imagem
    elements.configMap.addEventListener('click', (e) => {
        if (!configMode) return;

        const rect = elements.configMap.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const column = elements.spotColumn.value;
        const row = elements.spotRow.value;
        const occupied = elements.spotStatus.value === 'true';

        const newSpot = {
            id: ++currentSpotId,
            x: x,
            y: y,
            column: parseInt(column),
            row: parseInt(row),
            occupied: occupied,
            confidence: 0.9,
            width: 20,
            height: 20
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
            lastUpdate: new Date().toISOString(),
            layout: parkingState.layout,
            spots: spotsBeingConfigured
        };

        // Salvando os dados
        const saved = await saveParkingData(newData);
        if (saved) {
            alert('Configuração salva com sucesso! Faça o download do data.json');
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

// Carregar vagas existentes
function loadExistingSpots() {
    spotsBeingConfigured = [...parkingState.spots];
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
        marker.className = 'spot-marker';
        marker.style.left = `${spot.x}px`;
        marker.style.top = `${spot.y}px`;
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
        spotItem.className = 'spot-item';
        spotItem.innerHTML = `
            <div class="spot-info">
                <strong>Vaga ${spot.id}</strong> - Col ${spot.column}, Fila ${spot.row}
                <br>Status: ${spot.occupied ? 'Ocupada' : 'Livre'}
                <br>Posição: (${Math.round(spot.x)}, ${Math.round(spot.y)})
            </div>
            <div class="spot-actions">
                <button class="toggle-status" data-id="${spot.id}">Alternar Status</button>
                <button class="remove-spot" data-id="${spot.id}">Remover</button>
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
        renderConfiguredSpots();
    }
}

// Iniciar a aplicação quando o DOM estiver carregado
document.addEventListener('DOMContentLoaded', initApp);