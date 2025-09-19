from flask import Flask, jsonify
from ultralytics import YOLO
import cv2
from pathlib import Path
import threading
import time
from flask_cors import CORS  # o cors possibilita que outras portas peguem info da api

# ==========================
# CONFIGURAÇÃO DO FLASK
# ==========================
app = Flask(__name__)
# Configuração explícita do CORS para desenvolvimento
CORS(app, resources={
    r"/dados": {
        "origins": ["http://localhost:63342", "http://127.0.0.1:63342"],
        "methods": ["GET"],
        "allow_headers": ["Content-Type"]
    }
})

# ==========================
# CONFIGURAÇÃO DO MODELO
# ==========================
MODEL_PATH = Path("C:/Users/igorn/OneDrive/Galaxy Codes Git Hub/BestStop/BestStop/BestStop/v7/IA/ProjetoFetin-AI/runs/detect/treinamento_vagas/weights/best.pt")
IMAGENS = [
    Path("C:/Users/igorn/OneDrive/Galaxy Codes Git Hub/BestStop/BestStop/BestStop/v7/IA/ProjetoFetin-AI/Foto6.jpg"),
    Path("C:/Users/igorn/OneDrive/Galaxy Codes Git Hub/BestStop/BestStop/BestStop/v7/IA/ProjetoFetin-AI/Foto5.jpg"),
    Path("C:/Users/igorn/OneDrive/Galaxy Codes Git Hub/BestStop/BestStop/BestStop/v7/IA/ProjetoFetin-AI/Foto4.jpg"),
    Path("C:/Users/igorn/OneDrive/Galaxy Codes Git Hub/BestStop/BestStop/BestStop/v7/IA/ProjetoFetin-AI/Foto1.jpg")
]

model = YOLO(MODEL_PATH)

# Variáveis globais
indice_atual = 0
dados_atual = {}

# ==========================
# FUNÇÃO DE ANÁLISE
# ==========================
def analisar_vagas(caminho_img):
    total_vagas = 0
    vagas_ocupadas = 0
    vagas_livres = 0

    cap = cv2.VideoCapture(str(caminho_img))
    ret, frame = cap.read()
    cap.release()

    if not ret:
        print(f"⚠ Erro ao carregar imagem {caminho_img}")
        return {
            "perc_livres": 0.0,
            "perc_ocupadas": 0.0,
            "total_vagas": 0,
            "vagas_livres": 0,
            "vagas_ocupadas": 0
        }

    results = model(frame, conf=0.1)

    for result in results:
        for box in result.boxes:
            cls_id = int(box.cls.item())
            total_vagas += 1
            if cls_id == 0:
                vagas_ocupadas += 1
            elif cls_id == 1:
                vagas_livres += 1

    if total_vagas > 0:
        perc_livres = (vagas_livres / total_vagas) * 100
        perc_ocupadas = (vagas_ocupadas / total_vagas) * 100
    else:
        perc_livres = perc_ocupadas = 0.0

    return {
        "perc_livres": round(perc_livres, 2),
        "perc_ocupadas": round(perc_ocupadas, 2),
        "total_vagas": total_vagas,
        "vagas_livres": vagas_livres,
        "vagas_ocupadas": vagas_ocupadas,
        "imagem": str(caminho_img.name)
    }

# ==========================
# THREAD PARA TROCAR DADOS
# ==========================
def ciclo_atualizacao():
    global indice_atual, dados_atual
    while True:
        dados_atual = analisar_vagas(IMAGENS[indice_atual])
        indice_atual = (indice_atual + 1) % len(IMAGENS)
        time.sleep(60)  # espera 1 minuto

# ==========================
# ROTA DA API
# ==========================
@app.route("/dados", methods=["GET"])
def dados():
    return jsonify(dados_atual)

# ==========================
# MAIN
# ==========================
if __name__ == "__main__":
    # Inicia thread em paralelo para trocar os dados
    t = threading.Thread(target=ciclo_atualizacao, daemon=True)
    t.start()
    app.run(host="0.0.0.0", port=5000)
