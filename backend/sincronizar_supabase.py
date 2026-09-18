import os
import sys
import json
import time
import requests
import pandas as pd

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from backend.data_manager import data_engine, carregar_meta

SUPABASE_URL = "https://oczagzgosnsprogxymtb.supabase.co"
SUPABASE_KEY = "sb_secret_u0l3y_IgQBlVVMkDiYt8aQ_gPVo4HF0"

HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "resolution=merge-duplicates"
}

def clean_val(v):
    if pd.isna(v) or v is None:
        return None
    if isinstance(v, (int, float)):
        return float(v) if not pd.isna(v) else 0.0
    s = str(v).strip()
    return None if s in ["", "nan", "None", "NAT", "-"] else s

def sincronizar():
    print("=" * 65)
    print("  SINCRONIZAÇÃO NUVEM SUPABASE - FCM GESTÃO INTEGRADA")
    print("=" * 65)
    t0 = time.time()
    
    print("\n1. Carregando e processando dados locais...")
    data = data_engine.load_processed_data()
    df = data.get("df_unificado", pd.DataFrame())
    
    if df.empty:
        print("[!] Erro: Base unificada vazia!")
        return
        
    print(f"[+] Base local pronta: {len(df):,} peças processadas.")

    print("\n2. Preparando resumos executivos e metadados...")
    summary = data_engine.get_summary()
    projetos = data_engine.get_projetos()
    fornecedores = data_engine.get_fornecedores()
    diagnostico = data_engine.get_diagnostico_detalhado()
    meta_local = carregar_meta()

    metadata_payload = {
        "id": 1,
        "ultima_atualizacao": meta_local.get("ultima_atualizacao", "Sincronizado agora"),
        "total_pecas": len(df),
        "summary_geral": summary,
        "projetos_list": projetos,
        "fornecedores_list": fornecedores,
        "diagnostico_detalhado": diagnostico
    }

    # Atualiza fcm_metadata (Upsert ID=1)
    print("3. Enviando metadados e KPIs para o Supabase...")
    meta_url = f"{SUPABASE_URL}/rest/v1/fcm_metadata"
    r_meta = requests.post(
        meta_url, 
        headers={**HEADERS, "Prefer": "resolution=merge-duplicates"},
        data=json.dumps(metadata_payload)
    )
    if r_meta.status_code in [200, 201, 204]:
        print("[+] Metadados e KPIs enviados com sucesso!")
    else:
        print(f"[!] Erro ao enviar metadados: {r_meta.status_code} - {r_meta.text}")
        return

    # Limpar tabela anterior para carga limpa
    print("\n4. Atualizando tabela de pecas (fcm_unificado)...")
    del_url = f"{SUPABASE_URL}/rest/v1/fcm_unificado?id=gt.0"
    r_del = requests.delete(del_url, headers=HEADERS)
    print(f"[+] Tabela limpa para sincronização (Status: {r_del.status_code}).")

    # Mapeamento e preparo dos dados em lote
    print("5. Formatando registros para envio...")
    colunas_banco = [
        "origem_tipo", "obs_norm", "cod_peca", "descricao", "observacao",
        "status_unificado", "status", "status_compra", "fornecedor_responsavel",
        "fornecedor_tratamento", "fornecedor", "qtd_total_demanda", "qtd_entregue_pronta",
        "qtd_em_tratamento", "falta_fabricar_entregar", "saldo_pendente_entrega",
        "falta_produzir_interno", "doc_origem_envio", "nf_retorno_entrega",
        "data_movimento", "data_fabricacao", "data_envio", "data_retorno",
        "qtd_op", "qtd_fabr", "env_pintura", "ret_pintura", "saldo_rua",
        "doc_romaneio", "nf_retorno", "saldo_pendente_pintura", "aguardando_envio",
        "falta_fabricar", "qtd_comprada", "qtd_entregue", "saldo_falta_entregar",
        "data_entrega", "nf_entrega", "data_fornecedor", "num_sc", "item", "um",
        "qtd_sc", "necessidade", "emissao", "solicitante", "classe_valor", "pedido"
    ]

    # Renomeia colunas para minúsculas correspondentes ao Postgres
    col_map = {c.lower(): c for c in df.columns}
    
    registros = []
    for _, row in df.iterrows():
        reg = {}
        for col_db in colunas_banco:
            orig_col = None
            # Tenta encontrar a coluna original equivalente
            for oc in df.columns:
                if oc.lower() == col_db:
                    orig_col = oc
                    break
            val = row[orig_col] if orig_col else None
            reg[col_db] = clean_val(val)
        registros.append(reg)

    total_reg = len(registros)
    batch_size = 500
    print(f"6. Enviando {total_reg:,} peças em lotes de {batch_size}...")

    insert_url = f"{SUPABASE_URL}/rest/v1/fcm_unificado"
    enviados = 0
    
    for i in range(0, total_reg, batch_size):
        lote = registros[i:i + batch_size]
        res = requests.post(insert_url, headers=HEADERS, data=json.dumps(lote))
        if res.status_code in [200, 201, 204]:
            enviados += len(lote)
            pct = (enviados / total_reg) * 100
            print(f"   -> Progresso: {enviados:,}/{total_reg:,} ({pct:.1f}%)")
        else:
            print(f"[!] Falha no lote {i}: {res.status_code} - {res.text[:200]}")
            break

    elapsed = round(time.time() - t0, 2)
    print("\n" + "=" * 65)
    print(f"  SINCRONIZACAO CONCLUIDA EM {elapsed}s!")
    print(f"  Total de pecas online no Supabase: {enviados:,}")
    print("=" * 65)

if __name__ == "__main__":
    sincronizar()
