from fastapi import FastAPI
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

app = FastAPI()

# Permitir acesso de outras máquinas
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # ou especifique o IP da IA
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

vaga_status = {"livres": 0, "ocupadas": 0, "porcentagem_livres": 0.0}

class VagaData(BaseModel):
    livres: int
    ocupadas: int

@app.post("/atualizar_vagas")
def atualizar_vagas(data: VagaData):
    total = data.livres + data.ocupadas
    vaga_status["livres"] = data.livres
    vaga_status["ocupadas"] = data.ocupadas
    vaga_status["porcentagem_livres"] = round((data.livres / total) * 100, 2) if total > 0 else 0.0
    return {"status": "ok"}

@app.get("/vagas")
def get_vagas():
    return vaga_status

# Para rodar com uvicorn diretamente
if __name__ == "__main__":
    uvicorn.run("api:app", host="0.0.0.0", port=8000, reload=True)
