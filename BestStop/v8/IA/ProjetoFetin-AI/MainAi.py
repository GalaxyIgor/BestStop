import cv2
from ultralytics import YOLO
from pathlib import Path

# 1. Carrega o modelo treinado
model = YOLO(
    'C:/Users/Meu-PC/OneDrive/Documentos/Projects/ProjetoFetin-AI/runs/detect/treinamento_vagas/weights/best.pt')

# Faz a detecção em uma imagem
results = model.predict('C:/Users/Meu-PC/OneDrive/Documentos/Projects/ProjetoFetin-AI/Foto4.jpg',
                        # conf = limite de confiança (0-3)
                        save=True, conf=0.1)

# 4. Processa os resultados
for result in results:
    # Conta as detecções por classe
    vagas_livres = sum(result.boxes.cls == 1)
    vagas_ocupadas = sum(result.boxes.cls == 0)
    total_vagas = vagas_livres + vagas_ocupadas

    # Calcula porcentagens
    if total_vagas > 0:
        perc_livres = (vagas_livres / total_vagas) * 100
        perc_ocupadas = (vagas_ocupadas / total_vagas) * 100
    else:
        perc_livres = perc_ocupadas = 0.0

    print(f"\nResultado da análise:")
    print(f"Total de vagas detectadas: {total_vagas}")
    print(f"Vagas livres: {vagas_livres} ({perc_livres:.1f}%)")
    # vagas-de-estacionamento-na-tranversal.jpg
    print(f"Vagas ocupadas: {vagas_ocupadas} ({perc_ocupadas:.1f}%)")
