import os
from typing import Optional
from fastapi import FastAPI, Query, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from backend.data_manager import data_engine, carregar_meta, sincronizar_pastas_locais

app = FastAPI(title="FCM Gestao Integrada API", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FRONTEND_DIST = os.path.join(BASE_DIR, "frontend", "dist")


@app.on_event("startup")
def startup_event():
    import threading
    threading.Thread(target=data_engine.load_processed_data, daemon=True).start()


@app.get("/api/status")
def get_status():
    meta = carregar_meta()
    return {
        "status": "online",
        "ultima_atualizacao": meta.get("ultima_atualizacao", "Não sincronizado"),
        "mtime_op": meta.get("mtime_op"),
        "mtime_rom": meta.get("mtime_rom"),
        "mtime_pcp": meta.get("mtime_pcp"),
    }


@app.get("/api/summary")
def get_summary(
    projeto: Optional[str] = Query(None),
    busca: Optional[str] = Query(None)
):
    return data_engine.get_summary(projeto=projeto, busca=busca)


@app.get("/api/projetos")
def get_projetos():
    return data_engine.get_projetos()


@app.get("/api/fornecedores")
def get_fornecedores(
    projeto: Optional[str] = Query(None),
    busca: Optional[str] = Query(None)
):
    return data_engine.get_fornecedores(projeto=projeto, busca=busca)


@app.get("/api/diagnostico-detalhado")
def get_diagnostico_detalhado(
    projeto: Optional[str] = Query(None),
    busca: Optional[str] = Query(None)
):
    return data_engine.get_diagnostico_detalhado(projeto=projeto, busca=busca)


@app.get("/api/items")
def get_items(
    tab: str = Query("unificado"),
    projeto: Optional[str] = Query(None),
    busca: Optional[str] = Query(None),
    limit: int = Query(100),
    offset: int = Query(0)
):
    return data_engine.get_items(
        tab=tab,
        projeto=projeto,
        busca=busca,
        limit=limit,
        offset=offset
    )


@app.get("/api/pecas-sugestoes")
def get_pecas_sugestoes(
    q: Optional[str] = Query(None),
    projeto: Optional[str] = Query(None),
    limit: int = Query(20)
):
    return data_engine.get_pecas_sugestoes(q=q, projeto=projeto, limit=limit)


@app.post("/api/sync")
def trigger_sync():
    res = sincronizar_pastas_locais(forcar=True)
    return res


# Servir Frontend Estático (quando compilado para produção)
if os.path.exists(FRONTEND_DIST):
    app.mount("/assets", StaticFiles(directory=os.path.join(FRONTEND_DIST, "assets")), name="assets")

    @app.get("/{full_path:path}")
    def serve_spa(full_path: str):
        file_path = os.path.join(FRONTEND_DIST, full_path)
        if os.path.exists(file_path) and os.path.isfile(file_path):
            return FileResponse(file_path)
        return FileResponse(os.path.join(FRONTEND_DIST, "index.html"))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.server:app", host="0.0.0.0", port=8000, reload=True)
