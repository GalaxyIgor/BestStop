from ultralytics import YOLO # Biblioteca para a IA
import cv2 # biblioteca para video

# Carrega o modelo treinado
modelo = YOLO(f"C:/Users/murad/Downloads/ProjetoFetin-AI/ProjetoFetin-AI/runs/detect/treinamento_vagas/weights/best.pt")# caminho para a IA
video_path = f"C:/Users/murad/Downloads/video.mp4" # caminho para o video testado

cap = cv2.VideoCapture(video_path) # classe para abrir o video
fps = cap.get(cv2.CAP_PROP_FPS)

frame_whidth = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
frame_heigth = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))

fourcc = cv2.VideoWriter_fourcc(*"mp4v")

out = cv2.VideoWriter("IA_video.mp4", fourcc, fps, (frame_whidth, frame_heigth))

while cap.isOpened():
    ret, frame = cap.read()
    if not ret:
        break

    # Faz as predicoes para a analise do video
    results = modelo.predict(
        source=frame, # faz a analise a pra cada frame
        imgsz=640,    # tamanho utilizado no datasheet
        conf=0.3,     # sensibilidade
        verbose=False
    )

    for r in results:
        for box in r.boxes:
            cls_id = int(box.cls[0])
            cls_nome = modelo.names[cls_id]
            confianca = float(box.conf[0])

            # Pega coordenadas
            x1, y1, x2, y2 = box.xyxy[0]
            x1, y1, x2, y2 = int(x1), int(y1), int(x2), int(y2)

            # Define cor pelo status
            cor = (0,0,0)
            if cls_nome.lower() == "vazio":
                cor = (0, 255, 0)  # verde
            elif cls_nome.lower() == "ocupado":
                cor = (0, 0, 255)  # vermelho
            

            # Css do retangulo que aparece na detecção do codigo
            cv2.rectangle(frame, (x1, y1), (x2, y2), cor, 1)
            cv2.putText(frame, f"{cls_nome} {confianca:.2f}",
                        (x1, y1 - 10),
                        cv2.FONT_HERSHEY_SIMPLEX,
                        0.6, cor, 2)


    out.write(frame)  

    # funcao para mostrar o video e a letra q para parar de rodar
    cv2.imshow("IA Video", frame)
    if cv2.waitKey(1) & 0xFF == ord('q'):
        break



cap.release() 
out.release()
cv2.destroyAllWindows() # quando termina o video libera espaço no pc
