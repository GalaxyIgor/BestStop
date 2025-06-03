// Elementos do DOM
const elements = {
    occupied: document.getElementById('occupied'),
    available: document.getElementById('available'),
    totalSpots: document.getElementById('total-spots'),
    occupancyRate: document.getElementById('occupancy-rate'),
    lastUpdate: document.getElementById('last-update'),
    heatmapOverlay: document.getElementById('heatmap-overlay')
};

// Estado do estacionamento
let parkingState = {
    totalSpots: 0,
    occupied: 0,
    available: 0,
    lastUpdate: null,
    spots: []
};

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

// Criar mapa de calor sobre a imagem
function createHeatmap() {
    elements.heatmapOverlay.innerHTML = '';
    
    parkingState.spots.forEach(spot => {
        const heatSpot = document.createElement('div');
        heatSpot.className = `heat-spot ${spot.occupied ? 'occupied' : 'available'}`;
        heatSpot.style.left = `${spot.x}px`;
        heatSpot.style.top = `${spot.y}px`;
        
        // Tooltip com informações
        heatSpot.title = `Vaga ${spot.id} - ${spot.occupied ? 'Ocupada' : 'Livre'}\nConfiança: ${Math.round(spot.confidence * 100)}%`;
        
        // Tamanho baseado na confiança
        const size = 20 + (spot.confidence * 20);
        heatSpot.style.width = `${size}px`;
        heatSpot.style.height = `${size}px`;
        
        elements.heatmapOverlay.appendChild(heatSpot);
    });
}

// Atualizar estado do estacionamento
function updateParkingState(data) {
    if (!data) return;
    
    // Calcular vagas ocupadas e livres
    const occupied = data.spots.filter(spot => spot.occupied).length;
    
    parkingState = {
        totalSpots: data.totalSpots,
        occupied: occupied,
        available: data.totalSpots - occupied,
        lastUpdate: data.lastUpdate,
        spots: data.spots
    };
    
    updateStatusDisplay();
    createHeatmap();
}

// Iniciar a aplicação
async function initApp() {
    const parkingData = await loadParkingData();
    if (parkingData) {
        updateParkingState(parkingData);
        
        // Simular atualização periódica (opcional)
        setInterval(async () => {
            const newData = await loadParkingData();
            if (newData) {
                updateParkingState(newData);
            }
        }, 5000); // Atualizar a cada 5 segundos
    } else {
        console.error('Não foi possível carregar os dados iniciais');
    }
}

// Iniciar quando o DOM estiver carregado
document.addEventListener('DOMContentLoaded', initApp);