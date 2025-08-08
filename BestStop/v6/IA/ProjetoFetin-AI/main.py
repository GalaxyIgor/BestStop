from flask import Flask, jsonify
from ultralytics import YOLO
import cv2
from pathlib import Path

app = Flask(__name__)

# ==========================
# CONFIGURAÇÃO DO MODELO
# ==========================
MODEL_PATH = Path("C:/Users/Meu-PC/OneDrive/Documentos/Projects/ProjetoFetin-AI/runs/detect/treinamento_vagas/weights/best.pt")
VIDEO_PATH = Path("C:/Users/Meu-PC/OneDrive/Documentos/Projects/ProjetoFetin-AI/Foto2.jpg")

model = YOLO(MODEL_PATH)

# ==========================
# FUNÇÃO DE ANÁLISE DA IA
# ==========================
def analisar_vagas():
    total_vagas = 0
    vagas_ocupadas = 0
    vagas_livres = 0

    cap = cv2.VideoCapture(str(VIDEO_PATH))
    ret, frame = cap.read()
    cap.release()

    if not ret:
        print("⚠ Erro ao carregar vídeo/imagem.")
        return {
            "perc_livres": 0.0,
            "perc_ocupadas": 0.0,
            "total_vagas": 0,
            "vagas_livres": 0,
            "vagas_ocupadas": 0
        }

    # Faz a predição e NÃO filtra manualmente as classes, para garantir contagem igual à do YOLO
    results = model(frame, conf=0.1)  # conf=0.1 para contar todas as caixas que o YOLO mostrar

    for result in results:
        for box in result.boxes:
            cls_id = int(box.cls.item())  # classe detectada
            total_vagas += 1
            if cls_id == 0:  # 0 = ocupada
                vagas_ocupadas += 1
            elif cls_id == 1:  # 1 = livre
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
        "vagas_ocupadas": vagas_ocupadas
    }

# ==========================
# ROTA DA API
# ==========================
@app.route("/dados", methods=["GET"])
def dados():
    resultado = analisar_vagas()
    return jsonify(resultado)

# ==========================
# MAIN
# ==========================
if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)
