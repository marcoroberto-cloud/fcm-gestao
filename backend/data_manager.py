import os
import glob
import json
import re
import shutil
import tempfile
from datetime import datetime, timezone, timedelta
import pandas as pd
import numpy as np

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
STORAGE_DIR = os.path.join(BASE_DIR, "dados_compartilhados")
BACKUPS_DIR = os.path.join(STORAGE_DIR, "historico_backups")
META_FILE = os.path.join(STORAGE_DIR, "metadata.json")

os.makedirs(STORAGE_DIR, exist_ok=True)
os.makedirs(BACKUPS_DIR, exist_ok=True)

FUSO_BRASILIA = timezone(timedelta(hours=-3))
USER_PROFILE = os.environ.get("USERPROFILE", "")

ONEDRIVE_BASE = os.path.join(USER_PROFILE, "OneDrive - FLASH ENGENHARIA INDUSTRIA E COMERCIO LTDA", "FCM COMPRAS EXTERNAS FOLLOW")
if not os.path.exists(ONEDRIVE_BASE):
    pastas_onedrive = glob.glob(os.path.join(USER_PROFILE, "*OneDrive*", "*FCM COMPRAS EXTERNAS*"))
    if pastas_onedrive:
        ONEDRIVE_BASE = pastas_onedrive[0]

CAMINHO_PCP = os.path.join(ONEDRIVE_BASE, "Alinhamento PCP.xlsx")
CAMINHO_MACRO_OP = os.path.join(ONEDRIVE_BASE, "MACRO PRODUCAO COM QTD.xlsm")

CAMINHO_ROMANEIO_DIR = r"G:\Drives compartilhados\FCM\CONTROLE FCM - JEAN\CONTROLE FCM - RETORNOS\FCM - CONTROLE\FCM - CONTROLE RETORNOS\CONTROLE FIXO ROMANEIO - COM RETORNOS"
CAMINHO_ROMANEIO = os.path.join(CAMINHO_ROMANEIO_DIR, "PLANILHA DE CONTROLE ROMANEIO TOTVS - 2026.xlsx")


def carregar_meta():
    if os.path.exists(META_FILE):
        try:
            with open(META_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return {}
    return {}


def salvar_meta(meta):
    with open(META_FILE, "w", encoding="utf-8") as f:
        json.dump(meta, f, ensure_ascii=False, indent=2)


def normalizar_texto(t):
    if pd.isna(t) or t is None:
        return ""
    s = str(t)
    s = re.sub(r"(?i)_x[0-9a-f]{4}_", " ", s)
    s = s.replace("\xa0", " ").replace("\u00a0", " ").replace("\r", " ").replace("\n", " ")
    s = re.sub(r"[\x00-\x1f\x7f-\x9f\ufeff]", "", s)
    return re.sub(r"\s+", " ", s).strip().upper()


def ler_excel_seguro(fonte, sheet_name=0, header=0):
    try:
        return pd.read_excel(fonte, sheet_name=sheet_name, header=header, engine="calamine")
    except Exception:
        try:
            return pd.read_excel(fonte, sheet_name=sheet_name, header=header, engine="openpyxl")
        except Exception:
            return pd.read_excel(fonte, sheet_name=sheet_name, header=header)


def abrir_excel_seguro_copia(caminho_arquivo):
    with tempfile.NamedTemporaryFile(delete=False, suffix=os.path.splitext(caminho_arquivo)[1]) as tmp:
        tmp_path = tmp.name
    try:
        copiado = False
        try:
            import ctypes
            res = ctypes.windll.kernel32.CopyFileW(str(caminho_arquivo), str(tmp_path), False)
            if res:
                copiado = True
        except Exception:
            pass
        if not copiado:
            shutil.copyfile(caminho_arquivo, tmp_path)
        xl = pd.ExcelFile(tmp_path)
        return xl, tmp_path
    except Exception as e:
        if os.path.exists(tmp_path):
            try:
                os.remove(tmp_path)
            except Exception:
                pass
        raise e


def sincronizar_pastas_locais(forcar=False):
    houve_atualizacao = False
    erros = []
    meta = carregar_meta()
    caminho_op_pqt = os.path.join(STORAGE_DIR, "base_op.parquet")
    caminho_rom_pqt = os.path.join(STORAGE_DIR, "base_romaneio.parquet")
    caminho_comp_pqt = os.path.join(STORAGE_DIR, "base_compras.parquet")
    caminho_sc_pqt = os.path.join(STORAGE_DIR, "base_sc.parquet")

    # 1. Alinhamento PCP.xlsx
    if os.path.exists(CAMINHO_PCP):
        try:
            mtime_pcp = os.path.getmtime(CAMINHO_PCP)
            if forcar or meta.get("mtime_pcp") != mtime_pcp or not os.path.exists(caminho_comp_pqt):
                xl_pcp, tmp_pcp = abrir_excel_seguro_copia(CAMINHO_PCP)
                try:
                    for s in xl_pcp.sheet_names:
                        s_norm = normalizar_texto(s)
                        if "ENTREGAS-ATUALIZADO" in s_norm:
                            df_c = ler_excel_seguro(tmp_pcp, sheet_name=s).astype(str)
                            df_c.to_parquet(caminho_comp_pqt, index=False)
                            houve_atualizacao = True
                        elif "SOLICITA" in s_norm:
                            df_s = ler_excel_seguro(tmp_pcp, sheet_name=s).astype(str)
                            df_s.to_parquet(caminho_sc_pqt, index=False)
                            houve_atualizacao = True
                finally:
                    xl_pcp.close()
                    if os.path.exists(tmp_pcp):
                        try:
                            os.remove(tmp_pcp)
                        except Exception:
                            pass
                meta["mtime_pcp"] = mtime_pcp
        except Exception as e:
            erros.append(f"Alinhamento PCP: {e}")

    # 2. MACRO PRODUCAO COM QTD.xlsm (Aba Extração, Header linha 9)
    if os.path.exists(CAMINHO_MACRO_OP):
        try:
            mtime_op = os.path.getmtime(CAMINHO_MACRO_OP)
            if forcar or meta.get("mtime_op") != mtime_op or not os.path.exists(caminho_op_pqt):
                xl_op, tmp_op = abrir_excel_seguro_copia(CAMINHO_MACRO_OP)
                try:
                    abas_extracao = [s for s in xl_op.sheet_names if normalizar_texto(s).startswith("EXTRA") or "MARCO" in normalizar_texto(s)]
                    if abas_extracao:
                        aba_sel = abas_extracao[-1]  # Última extração (mais recente)
                        df_o = ler_excel_seguro(tmp_op, sheet_name=aba_sel, header=9).astype(str)
                        df_o = df_o.loc[:, ~df_o.columns.str.contains(r"^Unnamed", na=False)]
                        df_o.to_parquet(caminho_op_pqt, index=False)
                        houve_atualizacao = True
                finally:
                    xl_op.close()
                    if os.path.exists(tmp_op):
                        try:
                            os.remove(tmp_op)
                        except Exception:
                            pass
                meta["mtime_op"] = mtime_op
        except Exception as e:
            erros.append(f"Macro Produção: {e}")

    # 3. Romaneio TOTVS
    if os.path.exists(CAMINHO_ROMANEIO):
        try:
            mtime_rom = os.path.getmtime(CAMINHO_ROMANEIO)
            if forcar or meta.get("mtime_rom") != mtime_rom or not os.path.exists(caminho_rom_pqt):
                xl_rom, tmp_rom = abrir_excel_seguro_copia(CAMINHO_ROMANEIO)
                try:
                    aba_sel = xl_rom.sheet_names[0]
                    for s in xl_rom.sheet_names:
                        if "ROMANEIO" in normalizar_texto(s):
                            aba_sel = s
                            break
                    df_r = ler_excel_seguro(tmp_rom, sheet_name=aba_sel).astype(str)
                    df_r.to_parquet(caminho_rom_pqt, index=False)
                    houve_atualizacao = True
                finally:
                    xl_rom.close()
                    if os.path.exists(tmp_rom):
                        try:
                            os.remove(tmp_rom)
                        except Exception:
                            pass
                meta["mtime_rom"] = mtime_rom
        except Exception as e:
            erros.append(f"Romaneio Drive G: {e}")

    agora_str = datetime.now(FUSO_BRASILIA).strftime("%d/%m/%Y às %H:%M")
    if houve_atualizacao or forcar:
        meta["ultima_atualizacao"] = agora_str
        salvar_meta(meta)
        data_engine.load_processed_data(force_reload=True)

    return {
        "atualizado": houve_atualizacao or forcar,
        "ultima_atualizacao": meta.get("ultima_atualizacao", agora_str),
        "erros": erros
    }


def limpar_cod(c):
    if pd.isna(c) or c is None:
        return ""
    s = str(c).replace("\xa0", " ").replace("\u00a0", " ")
    s = re.sub(r"[\x00-\x1f\x7f-\x9f\ufeff]", "", s)
    return s.strip().upper()


def converter_num(v):
    if pd.isna(v) or v is None:
        return 0.0
    try:
        s = str(v).replace("\xa0", "").replace(" ", "").replace(",", ".")
        return float(s)
    except Exception:
        return 0.0


def formatar_data_br(val):
    if pd.isna(val) or val is None or str(val).strip() in ["-", "", "nan", "NaT", "None"]:
        return "-"
    s = str(val).strip()
    m = re.match(r"^(\d{4})-(\d{2})-(\d{2})", s)
    if m:
        return f"{m.group(3)}/{m.group(2)}/{m.group(1)}"
    m_br = re.match(r"^(\d{2})/(\d{2})/(\d{4})", s)
    if m_br:
        return s[:10]
    return s


def padronizar_fornecedor_romaneio(val):
    if pd.isna(val) or not str(val).strip() or str(val).strip() == "-":
        return "-"
    t = normalizar_texto(val)
    if re.match(r"^\d{2}\.[A-Z0-9]+\.", t):
        return "-"
    if "0002805" in t or "MEGACOLORS PRIME" in t or "PRIME" in t:
        return "MEGACOLORS PRIME"
    elif "0002695" in t or "MEGACOLORS" in t or "MEGA COLORS" in t:
        return "MEGACOLORS"
    elif "000092" in t or "REVRI" in t:
        return "REVRI"
    elif "000022" in t or "ECE" in t:
        return "ECE"
    elif "0002739" in t or "FORT COLOR" in t or "FORTCOLOR" in t:
        return "FORT COLOR"
    elif "000408" in t or "ZINCOBRIL" in t or "ZINCO BRIL" in t:
        return "ZINCOBRIL"
    m = re.search(r"-\s*F\s*-\s*(.+)", t)
    if m:
        return m.group(1).strip()
    return t


def buscar_col_flex(df, lista_padroes, excluir_padroes=None):
    if df.empty or len(df.columns) == 0:
        return None
    excluir = [normalizar_texto(e) for e in (excluir_padroes or [])]
    for c in df.columns:
        c_clean = normalizar_texto(c)
        if any(e in c_clean for e in excluir):
            continue
        for p in lista_padroes:
            if normalizar_texto(p) == c_clean:
                return c
    for c in df.columns:
        c_clean = normalizar_texto(c)
        if any(e in c_clean for e in excluir):
            continue
        for p in lista_padroes:
            if normalizar_texto(p) in c_clean:
                return c
    return None


class DataEngine:
    def __init__(self):
        self.cached_mtimes = None
        self.cached_data = None

    def get_file_mtimes(self):
        return (
            os.path.getmtime(os.path.join(STORAGE_DIR, "base_op.parquet")) if os.path.exists(os.path.join(STORAGE_DIR, "base_op.parquet")) else 0,
            os.path.getmtime(os.path.join(STORAGE_DIR, "base_romaneio.parquet")) if os.path.exists(os.path.join(STORAGE_DIR, "base_romaneio.parquet")) else 0,
            os.path.getmtime(os.path.join(STORAGE_DIR, "base_compras.parquet")) if os.path.exists(os.path.join(STORAGE_DIR, "base_compras.parquet")) else 0,
            os.path.getmtime(os.path.join(STORAGE_DIR, "base_sc.parquet")) if os.path.exists(os.path.join(STORAGE_DIR, "base_sc.parquet")) else 0,
        )

    def load_processed_data(self, force_reload=False):
        current_mtimes = self.get_file_mtimes()
        if not force_reload and self.cached_data is not None and self.cached_mtimes == current_mtimes:
            return self.cached_data

        # Auto-sincronização apenas quando forçado ou na primeira carga se cache não existe
        if force_reload or self.cached_data is None:
            try:
                meta = carregar_meta()
                m_pcp = os.path.getmtime(CAMINHO_PCP) if os.path.exists(CAMINHO_PCP) else None
                m_op = os.path.getmtime(CAMINHO_MACRO_OP) if os.path.exists(CAMINHO_MACRO_OP) else None
                m_rom = os.path.getmtime(CAMINHO_ROMANEIO) if os.path.exists(CAMINHO_ROMANEIO) else None

                if (m_pcp and m_pcp != meta.get("mtime_pcp")) or \
                   (m_op and m_op != meta.get("mtime_op")) or \
                   (m_rom and m_rom != meta.get("mtime_rom")):
                    sincronizar_pastas_locais()
                    current_mtimes = self.get_file_mtimes()
            except Exception:
                pass

        p_op = os.path.join(STORAGE_DIR, "base_op.parquet")
        p_rom = os.path.join(STORAGE_DIR, "base_romaneio.parquet")
        p_comp = os.path.join(STORAGE_DIR, "base_compras.parquet")
        p_sc = os.path.join(STORAGE_DIR, "base_sc.parquet")
        p_cruz = os.path.join(STORAGE_DIR, "base_cruz.parquet")
        p_unif = os.path.join(STORAGE_DIR, "base_unificado.parquet")
        p_comp_proc = os.path.join(STORAGE_DIR, "base_comp_proc.parquet")
        p_sc_proc = os.path.join(STORAGE_DIR, "base_sc_proc.parquet")

        # Cache pré-calculado: se já existe e está atualizado, carrega em 0.02s sem reprocessar tudo
        if not force_reload and os.path.exists(p_unif) and os.path.exists(p_cruz):
            m_unif = os.path.getmtime(p_unif)
            m_op = os.path.getmtime(p_op) if os.path.exists(p_op) else 0
            m_rom = os.path.getmtime(p_rom) if os.path.exists(p_rom) else 0
            m_comp = os.path.getmtime(p_comp) if os.path.exists(p_comp) else 0
            m_sc = os.path.getmtime(p_sc) if os.path.exists(p_sc) else 0
            if m_unif >= max(m_op, m_rom, m_comp, m_sc):
                df_cruz = pd.read_parquet(p_cruz)
                df_unificado = pd.read_parquet(p_unif)
                df_comp = pd.read_parquet(p_comp_proc) if os.path.exists(p_comp_proc) else (pd.read_parquet(p_comp) if os.path.exists(p_comp) else pd.DataFrame())
                df_sc = pd.read_parquet(p_sc_proc) if os.path.exists(p_sc_proc) else (pd.read_parquet(p_sc) if os.path.exists(p_sc) else pd.DataFrame())
                df_op = pd.read_parquet(p_op) if os.path.exists(p_op) else pd.DataFrame()
                df_rom = pd.read_parquet(p_rom) if os.path.exists(p_rom) else pd.DataFrame()
                self.cached_mtimes = current_mtimes
                self.cached_data = {
                    "df_cruz": df_cruz,
                    "df_comp": df_comp,
                    "df_sc": df_sc,
                    "df_unificado": df_unificado,
                    "df_op": df_op,
                    "df_rom": df_rom,
                }
                return self.cached_data

        df_op_raw = pd.read_parquet(p_op) if os.path.exists(p_op) else pd.DataFrame()
        df_rom_raw = pd.read_parquet(p_rom) if os.path.exists(p_rom) else pd.DataFrame()
        df_comp_raw = pd.read_parquet(p_comp) if os.path.exists(p_comp) else pd.DataFrame()
        df_sc_raw = pd.read_parquet(p_sc) if os.path.exists(p_sc) else pd.DataFrame()

        catalogo_descricoes = {}

        # 1. Processar OP (Macro de Produção - Aba Extração)
        df_op = pd.DataFrame()
        if not df_op_raw.empty:
            # Coluna B (index 1) da aba extração conforme informado pelo usuário
            col_obs_op = None
            if len(df_op_raw.columns) >= 2 and ("OBSERV" in normalizar_texto(df_op_raw.columns[1]) or normalizar_texto(df_op_raw.columns[1]) != ""):
                col_obs_op = df_op_raw.columns[1]
            if not col_obs_op:
                col_obs_op = buscar_col_flex(df_op_raw, ["OBSERVAÇÃO", "OBSERVAÇÕES", "OBSERVACAO", "OBSERVACOES", "OBS", "PROJETO", "LOTE"])

            col_prod_op = buscar_col_flex(df_op_raw, ["PRODUTO", "COD PROD", "CODIGO"])
            col_desc_op = buscar_col_flex(df_op_raw, ["DESC. PROD", "DESCRICAO", "DESCRIÇÃO", "DESC PROD"])
            col_qtd_op = buscar_col_flex(df_op_raw, ["QUANTIDADE", "QUANTI", "QTD PLAN"])
            col_prodz_op = buscar_col_flex(df_op_raw, ["QTD.PRODUZID", "PRODUZIDO", "QTD PRODUZIDA", "QTD.PRODUZ"])
            col_mes_op = buscar_col_flex(df_op_raw, ["MÊS-ANO", "MES-ANO", "MÊS", "MES"])
            col_dt_fim = buscar_col_flex(df_op_raw, ["DT REAL FIM", "REAL FIM", "DATA FIM", "DATA"])

            df_op = df_op_raw.copy()
            df_op["OBS_NORM"] = df_op[col_obs_op].apply(normalizar_texto) if col_obs_op else ""
            df_op["COD_PECA"] = df_op[col_prod_op].apply(limpar_cod) if col_prod_op else ""
            df_op["DESC_PECA"] = df_op[col_desc_op].fillna("-").astype(str) if col_desc_op else "-"
            df_op["QTD_PLAN"] = df_op[col_qtd_op].apply(converter_num) if col_qtd_op else 0.0
            df_op["QTD_PROD"] = df_op[col_prodz_op].apply(converter_num) if col_prodz_op else 0.0
            df_op["MES_ANO"] = df_op[col_mes_op].astype(str).str.strip() if col_mes_op else "Geral"
            df_op["DT_FABR"] = df_op[col_dt_fim].apply(formatar_data_br) if col_dt_fim else "-"

            for _, r in df_op[["COD_PECA", "DESC_PECA"]].dropna().iterrows():
                c, d = str(r["COD_PECA"]).strip(), str(r["DESC_PECA"]).strip()
                if c and d and d not in ["-", "NAN", "NONE", ""]:
                    catalogo_descricoes[c] = d

        # 2. Processar Romaneio (Retornos de Tratamento)
        df_rom = pd.DataFrame()
        if not df_rom_raw.empty:
            # Coluna P (index 15) do Romaneio conforme informado pelo usuário
            col_obs_rom = None
            if len(df_rom_raw.columns) >= 16 and "OBSERV" in normalizar_texto(df_rom_raw.columns[15]):
                col_obs_rom = df_rom_raw.columns[15]
            elif len(df_rom_raw.columns) >= 16:
                col_obs_rom = df_rom_raw.columns[15]
            if not col_obs_rom:
                col_obs_rom = buscar_col_flex(df_rom_raw, ["OBSERVAÇÕES", "OBSERVACOES", "OBSERVAÇÃO", "OBSERVACAO", "OBS", "PROJETO", "LOTE"])

            col_prod_rom = buscar_col_flex(df_rom_raw, ["PRODUTO", "COD. PRODUTO", "COD PROD"], excluir_padroes=["PINTURA", "DESC", "TRATAMENTO"])
            col_desc_rom = buscar_col_flex(df_rom_raw, ["DESCRIÇÃO", "DESCRICAO", "DESC. PROD", "DESC"])
            col_qtd_rom = buscar_col_flex(df_rom_raw, ["QTD", "QTDE", "QUANTIDADE"], excluir_padroes=["RET", "SALDO"])
            col_ret_rom = buscar_col_flex(df_rom_raw, ["QT RET", "QT_RET", "RETORNADO", "QTD RET", "QT"])

            if col_ret_rom == col_qtd_rom:
                cols_disp = [c for c in df_rom_raw.columns if "QT" in normalizar_texto(c) or "RET" in normalizar_texto(c)]
                if len(cols_disp) >= 2:
                    col_qtd_rom, col_ret_rom = cols_disp[0], cols_disp[1]

            col_saldo_rom = buscar_col_flex(df_rom_raw, ["SALDO", "SALD", "SALDO "])
            col_forn_rom = buscar_col_flex(df_rom_raw, ["CLIENTE/FORN", "CLIENTE/FC", "CLIENTE / FORN", "CLIENTE", "FORNECEDOR"], excluir_padroes=["PROD", "COD", "COR", "PECA", "PEÇA", "DESC", "PINTURA"])
            col_doc_rom = buscar_col_flex(df_rom_raw, ["DOC.ORIGINAL", "DOC.ORIGIR", "DOC.ORIGEM", "DOC ORIGEM", "ROMANEIO", "Nº ROMANEIO", "DOC"])
            col_dt_envio_rom = buscar_col_flex(df_rom_raw, ["DT EMISSÃO", "DT EMISSÃ", "DT EMISSAO", "DT. EMISSAO", "DATA EMISSAO", "DATA ENVIO", "DT ENVIO"])
            col_nf_ret_rom = buscar_col_flex(df_rom_raw, ["NF RET", "NF_RET", "NOTA RET", "NF RETORNO"])
            col_dt_ret_rom = buscar_col_flex(df_rom_raw, ["DT RET", "DT_RET", "DATA RET", "DATA RETORNO"])

            df_rom = df_rom_raw.copy()
            df_rom["OBS_NORM"] = df_rom[col_obs_rom].apply(normalizar_texto) if col_obs_rom else ""
            df_rom["COD_PECA"] = df_rom[col_prod_rom].apply(limpar_cod) if col_prod_rom else ""
            df_rom["DESC_PECA"] = df_rom[col_desc_rom].fillna("-").astype(str) if col_desc_rom else "-"
            df_rom["QTD_ENV"] = df_rom[col_qtd_rom].apply(converter_num) if col_qtd_rom else 0.0
            df_rom["QTD_RET"] = df_rom[col_ret_rom].apply(converter_num) if col_ret_rom else 0.0
            df_rom["SALDO_RUA"] = df_rom[col_saldo_rom].apply(converter_num) if col_saldo_rom else 0.0
            df_rom["DOC_ROMANEIO"] = df_rom[col_doc_rom].fillna("-").astype(str) if col_doc_rom else "-"
            df_rom["DATA_ENVIO"] = df_rom[col_dt_envio_rom].apply(formatar_data_br) if col_dt_envio_rom else "-"
            df_rom["NF_RETORNO"] = df_rom[col_nf_ret_rom].fillna("-").astype(str) if col_nf_ret_rom else "-"
            df_rom["DATA_RETORNO"] = df_rom[col_dt_ret_rom].apply(formatar_data_br) if col_dt_ret_rom else "-"
            df_rom["FORNECEDOR_TRAT"] = df_rom[col_forn_rom].apply(padronizar_fornecedor_romaneio) if col_forn_rom else "-"

            if col_desc_rom:
                for _, r in df_rom[["COD_PECA", "DESC_PECA"]].dropna().iterrows():
                    c, d = str(r["COD_PECA"]).strip(), str(r["DESC_PECA"]).strip()
                    if c and d and d not in ["-", "NAN", "NONE", ""] and c not in catalogo_descricoes:
                        catalogo_descricoes[c] = d

        # 3. Processar Compras (Alinhamento PCP - ENTREGAS-ATUALIZADO)
        df_comp = pd.DataFrame()
        if not df_comp_raw.empty:
            # Coluna L (index 11) conforme informado pelo usuário
            col_obs_comp = None
            if len(df_comp_raw.columns) >= 12 and "OBSERV" in normalizar_texto(df_comp_raw.columns[11]):
                col_obs_comp = df_comp_raw.columns[11]
            elif len(df_comp_raw.columns) >= 12:
                col_obs_comp = df_comp_raw.columns[11]
            if not col_obs_comp:
                col_obs_comp = buscar_col_flex(df_comp_raw, ["OBSERVAÇÃO", "OBSERVAÇÕES", "OBSERVACAO", "OBSERVACOES", "OBS", "PROJETO", "LOTE"], excluir_padroes=["SUS", "DESTINO"])

            col_prod_comp = buscar_col_flex(df_comp_raw, ["PRODUTO", "COD PROD", "CODIGO"])
            col_desc_comp = buscar_col_flex(df_comp_raw, ["DESCRIÇÃO", "DESCRICAO", "DESC. PROD"])
            col_forn_comp = buscar_col_flex(df_comp_raw, ["FORNECEDOR"])
            col_qt_comp = buscar_col_flex(df_comp_raw, ["QT", "QUANTIDADE", "QTD"])
            col_ent_comp = buscar_col_flex(df_comp_raw, ["QTD ENTREGUE", "QTD.ENTREGUE", "ENTREGUE"])
            col_dt_comp = buscar_col_flex(df_comp_raw, ["DT ENT.", "DT ENT", "DATA ENTREGA"])
            col_nf_comp = buscar_col_flex(df_comp_raw, ["NF ENT.", "NF ENT", "NOTA FISCAL", "NF"])
            col_dt_forn = buscar_col_flex(df_comp_raw, ["DATA FORNECEDOR", "DT FORNECEDOR", "DATA DE ENTREGA"])

            df_comp = df_comp_raw.copy()
            # Se a coluna L tiver valor, usa ela; se vazia e a coluna K (TAT) tiver algo, usa K
            col_k_tat = df_comp_raw.columns[10] if len(df_comp_raw.columns) >= 11 and "TAT" in normalizar_texto(df_comp_raw.columns[10]) else None
            serie_obs = df_comp[col_obs_comp].astype(str) if col_obs_comp else pd.Series([""] * len(df_comp))
            if col_k_tat:
                serie_tat = df_comp[col_k_tat].astype(str)
                serie_obs = serie_obs.where(~serie_obs.isin(["", "nan", "None", "NAT", "-"]), serie_tat)
            df_comp["OBS_NORM"] = serie_obs.apply(normalizar_texto)

            df_comp["COD_PECA"] = df_comp[col_prod_comp].apply(limpar_cod) if col_prod_comp else ""
            df_comp["Descricao"] = df_comp[col_desc_comp].fillna("-").astype(str) if col_desc_comp else "-"
            df_comp["Fornecedor"] = df_comp[col_forn_comp].fillna("-").astype(str) if col_forn_comp else "-"
            df_comp["Qtd_Comprada"] = df_comp[col_qt_comp].apply(converter_num) if col_qt_comp else 0.0
            df_comp["Qtd_Entregue"] = df_comp[col_ent_comp].apply(converter_num) if col_ent_comp else 0.0
            df_comp["Saldo_Falta_Entregar"] = (df_comp["Qtd_Comprada"] - df_comp["Qtd_Entregue"]).clip(lower=0.0)
            df_comp["Data_Entrega"] = df_comp[col_dt_comp].apply(formatar_data_br) if col_dt_comp else "-"
            df_comp["NF_Entrega"] = df_comp[col_nf_comp].fillna("-").astype(str) if col_nf_comp else "-"
            df_comp["Data_Fornecedor"] = df_comp[col_dt_forn].apply(formatar_data_br) if col_dt_forn else "-"

            def calc_status_compra(r):
                if r["Qtd_Entregue"] >= r["Qtd_Comprada"] and r["Qtd_Comprada"] > 0:
                    return "100% Entregue"
                elif r["Qtd_Entregue"] > 0:
                    return "Entregue Parcial"
                else:
                    return "Aguardando Fornecedor"

            df_comp["Status_Compra"] = df_comp.apply(calc_status_compra, axis=1)

            for _, r in df_comp[["COD_PECA", "Descricao"]].dropna().iterrows():
                c, d = str(r["COD_PECA"]).strip(), str(r["Descricao"]).strip()
                if c and d and d not in ["-", "NAN", "NONE", ""] and c not in catalogo_descricoes:
                    catalogo_descricoes[c] = d

        # 4. Processar SC (Alinhamento PCP - SOLICITAÇÃO DE COMPRA EM ABERTO)
        df_sc = pd.DataFrame()
        if not df_sc_raw.empty:
            # Coluna I (index 8) conforme informado pelo usuário
            col_obs_sc = None
            if len(df_sc_raw.columns) >= 9 and "OBSERV" in normalizar_texto(df_sc_raw.columns[8]):
                col_obs_sc = df_sc_raw.columns[8]
            elif len(df_sc_raw.columns) >= 9:
                col_obs_sc = df_sc_raw.columns[8]
            if not col_obs_sc:
                col_obs_sc = buscar_col_flex(df_sc_raw, ["OBSERVAÇÃO", "OBSERVAÇÕES", "OBSERVACAO", "OBSERVACOES", "OBS", "PROJETO", "LOTE"])
            col_filial_sc = buscar_col_flex(df_sc_raw, ["FILIAL"])
            col_num_sc = buscar_col_flex(df_sc_raw, ["Nº SOLICITAÇÃO", "NUM SOLICITACAO", "SOLICITACAO", "SC", "Nº SC"])
            col_item_sc = buscar_col_flex(df_sc_raw, ["ITEM"])
            col_prod_sc = buscar_col_flex(df_sc_raw, ["PRODUTO", "COD PROD", "CODIGO"])
            col_um_sc = buscar_col_flex(df_sc_raw, ["UM", "UN"])
            col_desc_sc = buscar_col_flex(df_sc_raw, ["DESCRIÇÃO", "DESCRICAO"])
            col_qtd_sc = buscar_col_flex(df_sc_raw, ["QTDE DA SC", "QTD SC", "QUANTIDADE", "QTD"])
            col_nec_sc = buscar_col_flex(df_sc_raw, ["NECESSIDADE", "DT NECESSIDADE", "DATA NECESSIDADE"])
            col_obs_sc = buscar_col_flex(df_sc_raw, ["OBSERVAÇÃO", "OBSERVAÇÕES", "OBSERVACAO", "OBSERVACOES", "OBS", "PROJETO", "LOTE"])
            col_emis_sc = buscar_col_flex(df_sc_raw, ["EMISSÃO", "EMISSAO", "DT EMISSAO"])
            col_solic_sc = buscar_col_flex(df_sc_raw, ["SOLICITANTE", "NOME SOLICITANTE"])
            col_classe_sc = buscar_col_flex(df_sc_raw, ["CLASSE VALOR", "CLASSE"])
            col_ped_sc = buscar_col_flex(df_sc_raw, ["PEDIDO", "NUM PEDIDO"])

            df_sc = df_sc_raw.copy()
            df_sc["OBS_NORM"] = df_sc[col_obs_sc].apply(normalizar_texto) if col_obs_sc else ""
            df_sc["COD_PECA"] = df_sc[col_prod_sc].apply(limpar_cod) if col_prod_sc else ""
            df_sc["Filial"] = df_sc[col_filial_sc].fillna("-").astype(str) if col_filial_sc else "-"
            df_sc["Num_SC"] = df_sc[col_num_sc].fillna("-").astype(str) if col_num_sc else "-"
            df_sc["Item"] = df_sc[col_item_sc].fillna("-").astype(str) if col_item_sc else "-"
            df_sc["UM"] = df_sc[col_um_sc].fillna("PC").astype(str) if col_um_sc else "PC"
            df_sc["Descricao"] = df_sc[col_desc_sc].fillna("-").astype(str) if col_desc_sc else "-"
            df_sc["Qtd_SC"] = df_sc[col_qtd_sc].apply(converter_num) if col_qtd_sc else 0.0
            df_sc["Necessidade"] = df_sc[col_nec_sc].apply(formatar_data_br) if col_nec_sc else "-"
            df_sc["Emissao"] = df_sc[col_emis_sc].apply(formatar_data_br) if col_emis_sc else "-"
            df_sc["Solicitante"] = df_sc[col_solic_sc].fillna("-").astype(str) if col_solic_sc else "-"
            df_sc["Classe_Valor"] = df_sc[col_classe_sc].fillna("-").astype(str) if col_classe_sc else "-"
            df_sc["Pedido"] = df_sc[col_ped_sc].fillna("-").astype(str) if col_ped_sc else "-"

            for _, r in df_sc[["COD_PECA", "Descricao"]].dropna().iterrows():
                c, d = str(r["COD_PECA"]).strip(), str(r["Descricao"]).strip()
                if c and d and d not in ["-", "NAN", "NONE", ""] and c not in catalogo_descricoes:
                    catalogo_descricoes[c] = d

        # 5. Cruzamento OP x Romaneio
        def format_unique_join(x):
            vals = [str(v) for v in x if str(v) not in ["-", "", "nan", "None"]]
            return ", ".join(sorted(set(vals))) or "-"

        op_obs = (
            df_op.groupby(["OBS_NORM", "COD_PECA"], as_index=False).agg(
                Descricao=("DESC_PECA", "first"),
                Qtd_OP=("QTD_PLAN", "sum"),
                Qtd_Fabr=("QTD_PROD", "sum"),
                Data_Fabricacao=("DT_FABR", format_unique_join),
                Mes_Ano=("MES_ANO", format_unique_join),
            )
            if not df_op.empty
            else pd.DataFrame(columns=["OBS_NORM", "COD_PECA", "Descricao", "Qtd_OP", "Qtd_Fabr", "Data_Fabricacao", "Mes_Ano"])
        )

        rom_obs = (
            df_rom.groupby(["OBS_NORM", "COD_PECA"], as_index=False).agg(
                Descricao_Rom=("DESC_PECA", "first"),
                Env_Pintura=("QTD_ENV", "sum"),
                Ret_Pintura=("QTD_RET", "sum"),
                Saldo_Rua=("SALDO_RUA", "sum"),
                Doc_Romaneio=("DOC_ROMANEIO", format_unique_join),
                Data_Envio=("DATA_ENVIO", format_unique_join),
                NF_Retorno=("NF_RETORNO", format_unique_join),
                Data_Retorno=("DATA_RETORNO", format_unique_join),
                Fornecedor_Tratamento=("FORNECEDOR_TRAT", format_unique_join),
            )
            if not df_rom.empty
            else pd.DataFrame(columns=[
                "OBS_NORM", "COD_PECA", "Descricao_Rom", "Env_Pintura", "Ret_Pintura",
                "Saldo_Rua", "Doc_Romaneio", "Data_Envio", "NF_Retorno", "Data_Retorno", "Fornecedor_Tratamento"
            ])
        )

        df_cruz = pd.merge(op_obs, rom_obs, on=["OBS_NORM", "COD_PECA"], how="outer")

        if not df_cruz.empty:
            if "Descricao" not in df_cruz.columns:
                df_cruz["Descricao"] = "-"
            if "Descricao_Rom" in df_cruz.columns:
                cond_desc_vazia = df_cruz["Descricao"].isna() | df_cruz["Descricao"].isin(["-", "", "None", "nan"])
                df_cruz["Descricao"] = df_cruz["Descricao"].where(~cond_desc_vazia, df_cruz["Descricao_Rom"])
                df_cruz.drop(columns=["Descricao_Rom"], inplace=True)

            def resolver_desc(r):
                d = str(r["Descricao"]).strip()
                if d and d not in ["-", "NAN", "NONE", ""]:
                    return d
                return catalogo_descricoes.get(str(r["COD_PECA"]).strip(), "-")

            df_cruz["Descricao"] = df_cruz.apply(resolver_desc, axis=1)

            for col_num in ["Qtd_OP", "Qtd_Fabr", "Env_Pintura", "Ret_Pintura", "Saldo_Rua"]:
                if col_num not in df_cruz.columns:
                    df_cruz[col_num] = 0.0
                df_cruz[col_num] = df_cruz[col_num].fillna(0.0).astype(float)

            for col_str in ["Data_Fabricacao", "Mes_Ano", "Doc_Romaneio", "Data_Envio", "NF_Retorno", "Data_Retorno", "Fornecedor_Tratamento"]:
                if col_str not in df_cruz.columns:
                    df_cruz[col_str] = "-"
                df_cruz[col_str] = df_cruz[col_str].fillna("-").astype(str)

            df_cruz.loc[df_cruz["Env_Pintura"] == 0, "Fornecedor_Tratamento"] = "-"
            df_cruz["Saldo_Pendente_Pintura"] = (df_cruz["Env_Pintura"] - df_cruz["Ret_Pintura"]).clip(lower=0.0)
            df_cruz["Aguardando_Envio"] = (df_cruz["Qtd_Fabr"] - df_cruz["Env_Pintura"]).clip(lower=0.0)
            df_cruz["Falta_Fabricar"] = (df_cruz["Qtd_OP"] - df_cruz["Qtd_Fabr"]).clip(lower=0.0)

            pecas_com_tratamento = set(df_rom["COD_PECA"].dropna().unique()) if not df_rom.empty else set()

            cods = df_cruz["COD_PECA"].values
            dt_fabs = df_cruz["Data_Fabricacao"].values
            mes_anos = df_cruz["Mes_Ano"].values
            envs = df_cruz["Env_Pintura"].values
            rets = df_cruz["Ret_Pintura"].values
            forns = df_cruz["Fornecedor_Tratamento"].values
            q_ops = df_cruz["Qtd_OP"].values
            q_fabs = df_cruz["Qtd_Fabr"].values
            saldos = df_cruz["Saldo_Pendente_Pintura"].values
            faltas = df_cruz["Falta_Fabricar"].values
            ag_envs = df_cruz["Aguardando_Envio"].values

            status_list = []
            obs_list = []
            for cod, dt_fab, mes_ano, env, ret, forn, q_op, q_fab, saldo, falta, ag_env in zip(
                cods, dt_fabs, mes_anos, envs, rets, forns, q_ops, q_fabs, saldos, faltas, ag_envs
            ):
                s_cod = str(cod).strip()
                s_dt = str(dt_fab)
                s_ma = str(mes_ano)
                is_2025 = ("2025" in s_dt) or ("2025" in s_ma)

                # Observação
                if is_2025:
                    obs_list.append("Ano 2025 (Com Romaneio)" if ret > 0 else "Ano 2025 (Sem controle de romaneio)")
                else:
                    obs_list.append("-")

                # Status
                tem_trat_lote = (env > 0) or (ret > 0) or (str(forn).strip() not in ["-", ""])
                tem_trat = tem_trat_lote or (s_cod in pecas_com_tratamento)

                if is_2025 and ret == 0:
                    if q_fab >= q_op and q_op > 0:
                        status_list.append("Fabricado em 2025 (Sem Romaneio)")
                    elif q_fab > 0:
                        status_list.append("Fabricação Parcial (2025)")
                    else:
                        status_list.append("Aguardando Produção (2025)")
                elif tem_trat:
                    if ret >= q_op and q_op > 0 and saldo == 0 and falta == 0:
                        status_list.append("100% Entregue")
                    elif falta > 0:
                        status_list.append("Falta Fabricar Internamente")
                    elif saldo > 0:
                        status_list.append("Em Tratamento Externo")
                    elif ag_env > 0:
                        status_list.append("Fabricado (Aguardando Envio)")
                    elif ret > 0:
                        status_list.append("Entregue Parcial")
                    else:
                        status_list.append("Aguardando Produção")
                else:
                    if q_fab >= q_op and q_op > 0:
                        status_list.append("100% Entregue")
                    elif falta > 0 and q_fab > 0:
                        status_list.append("Fabricação Parcial")
                    elif falta > 0:
                        status_list.append("Falta Fabricar Internamente")
                    else:
                        status_list.append("Aguardando Produção")

            df_cruz["Status"] = status_list
            df_cruz["Observacao"] = obs_list

        # 6. Base Unificada
        lista_unif = []
        if not df_cruz.empty:
            df_f = df_cruz.copy()
            df_f["Origem_Tipo"] = "🏭 Fabricação Interna"
            df_f["Qtd_Total_Demanda"] = df_f["Qtd_OP"]

            # Identifica se a peça tem tratamento externo (pintura/zincagem)
            cond_tem_trat = (
                (df_f["Env_Pintura"] > 0) |
                (df_f["Ret_Pintura"] > 0) |
                ((df_f["Fornecedor_Tratamento"] != "-") & (df_f["Fornecedor_Tratamento"].astype(str).str.strip() != "")) |
                (df_f["COD_PECA"].isin(pecas_com_tratamento))
            )
            # Se for 2025 sem retorno comprovado ou tiver tratamento, o que está entregue pronto é Ret_Pintura
            is_2025_sem_ret = (
                (df_f["Observacao"].astype(str).str.contains("2025")) &
                (df_f["Ret_Pintura"] == 0)
            )
            df_f["Qtd_Entregue_Pronta"] = np.where(
                cond_tem_trat | is_2025_sem_ret,
                df_f["Ret_Pintura"],
                df_f["Qtd_Fabr"]
            )
            # Em Tratamento: saldo pendente no tratamento externo
            df_f["Qtd_Em_Tratamento"] = df_f["Saldo_Pendente_Pintura"]
            # Falta Fabricar / Entregar: o que falta produzir na fábrica
            df_f["Falta_Fabricar_Entregar"] = df_f["Falta_Fabricar"]

            # Compatibilidade retroativa
            df_f["Saldo_Pendente_Entrega"] = df_f["Saldo_Pendente_Pintura"]
            df_f["Falta_Produzir_Interno"] = df_f["Falta_Fabricar"]

            df_f["Fornecedor_Responsavel"] = df_f["Fornecedor_Tratamento"]
            df_f["Doc_Origem_Envio"] = df_f["Doc_Romaneio"]
            df_f["NF_Retorno_Entrega"] = df_f["NF_Retorno"]
            df_f["Data_Movimento"] = df_f["Data_Retorno"].where(
                df_f["Data_Retorno"] != "-",
                df_f["Data_Envio"].where(df_f["Data_Envio"] != "-", df_f["Data_Fabricacao"])
            )
            df_f["Status_Unificado"] = df_f["Status"]
            df_f["Observacao"] = df_cruz["Observacao"]
            lista_unif.append(df_f)

        if not df_comp.empty:
            df_c = df_comp.copy()
            df_c["Origem_Tipo"] = "📦 Compra / Externado"
            df_c["Qtd_Total_Demanda"] = df_c["Qtd_Comprada"]
            df_c["Qtd_Entregue_Pronta"] = df_c["Qtd_Entregue"]
            df_c["Qtd_Em_Tratamento"] = 0.0
            df_c["Falta_Fabricar_Entregar"] = df_c["Saldo_Falta_Entregar"]

            # Compatibilidade retroativa
            df_c["Saldo_Pendente_Entrega"] = df_c["Saldo_Falta_Entregar"]
            df_c["Falta_Produzir_Interno"] = 0.0

            df_c["Fornecedor_Responsavel"] = df_c["Fornecedor"]
            df_c["Doc_Origem_Envio"] = "-"
            df_c["NF_Retorno_Entrega"] = df_c["NF_Entrega"]
            df_c["Data_Movimento"] = df_c["Data_Entrega"].where(df_c["Data_Entrega"] != "-", df_c["Data_Fornecedor"])
            df_c["Status_Unificado"] = df_c["Status_Compra"]
            df_c["Observacao"] = "-"
            lista_unif.append(df_c)

        if not df_sc.empty:
            df_s = df_sc.copy()
            df_s["Origem_Tipo"] = "📋 SC (Pendente de Pedido)"
            df_s["Qtd_Total_Demanda"] = df_s["Qtd_SC"]
            df_s["Qtd_Entregue_Pronta"] = 0.0
            df_s["Qtd_Em_Tratamento"] = 0.0
            df_s["Falta_Fabricar_Entregar"] = df_s["Qtd_SC"]

            # Compatibilidade retroativa
            df_s["Saldo_Pendente_Entrega"] = df_s["Qtd_SC"]
            df_s["Falta_Produzir_Interno"] = 0.0

            df_s["Fornecedor_Responsavel"] = df_s["Solicitante"]
            df_s["Doc_Origem_Envio"] = df_s["Num_SC"]
            df_s["NF_Retorno_Entrega"] = "-"
            df_s["Data_Movimento"] = df_s["Necessidade"]
            df_s["Status_Unificado"] = "SC em Aberto"
            df_s["Observacao"] = "-"
            lista_unif.append(df_s)

        df_unificado = pd.concat(lista_unif, ignore_index=True) if lista_unif else pd.DataFrame()

        if not df_cruz.empty:
            try:
                df_cruz.to_parquet(p_cruz, index=False)
            except Exception:
                pass
        if not df_unificado.empty:
            try:
                df_unificado.to_parquet(p_unif, index=False)
            except Exception:
                pass
        if not df_comp.empty:
            try:
                df_comp.to_parquet(p_comp_proc, index=False)
            except Exception:
                pass
        if not df_sc.empty:
            try:
                df_sc.to_parquet(p_sc_proc, index=False)
            except Exception:
                pass

        self.cached_mtimes = current_mtimes
        self.cached_data = {
            "df_cruz": df_cruz,
            "df_comp": df_comp,
            "df_sc": df_sc,
            "df_unificado": df_unificado,
            "df_op": df_op,
            "df_rom": df_rom,
        }
        return self.cached_data

    def extrair_lista_projetos(self, projeto):
        if not projeto or projeto == "TODOS":
            return None
        if isinstance(projeto, list):
            res = [p.strip() for p in projeto if p and p != "TODOS"]
            return res if res else None
        if isinstance(projeto, str):
            if "," in projeto:
                res = [p.strip() for p in projeto.split(",") if p.strip() and p.strip() != "TODOS"]
                return res if res else None
            return [projeto.strip()]
        return None

    def extrair_lista_buscas(self, busca):
        if not busca:
            return None
        if isinstance(busca, list):
            res = [normalizar_texto(b) for b in busca if b and normalizar_texto(b)]
            return res if res else None
        if isinstance(busca, str):
            if "," in busca:
                res = [normalizar_texto(b) for b in busca.split(",") if b.strip() and normalizar_texto(b)]
                return res if res else None
            q = normalizar_texto(busca)
            return [q] if q else None
        return None

    def get_summary(self, projeto=None, busca=None):
        data = self.load_processed_data()
        df_cruz = data["df_cruz"].copy() if not data["df_cruz"].empty else pd.DataFrame()
        df_comp = data["df_comp"].copy() if not data["df_comp"].empty else pd.DataFrame()
        df_sc = data["df_sc"].copy() if not data["df_sc"].empty else pd.DataFrame()

        lista_proj = self.extrair_lista_projetos(projeto)
        if lista_proj:
            if not df_cruz.empty and "OBS_NORM" in df_cruz.columns:
                df_cruz = df_cruz[df_cruz["OBS_NORM"].isin(lista_proj)]
            if not df_comp.empty and "OBS_NORM" in df_comp.columns:
                df_comp = df_comp[df_comp["OBS_NORM"].isin(lista_proj)]
            if not df_sc.empty and "OBS_NORM" in df_sc.columns:
                df_sc = df_sc[df_sc["OBS_NORM"].isin(lista_proj)]

        lista_busca = self.extrair_lista_buscas(busca)
        if lista_busca:
            if not df_cruz.empty:
                cond_cruz = False
                for q in lista_busca:
                    cond_cruz = cond_cruz | (df_cruz["COD_PECA"].astype(str).str.upper().str.contains(q, na=False, regex=False) | df_cruz["Descricao"].astype(str).str.upper().str.contains(q, na=False, regex=False))
                df_cruz = df_cruz[cond_cruz]
            if not df_comp.empty:
                cond_comp = False
                for q in lista_busca:
                    cond_comp = cond_comp | (df_comp["COD_PECA"].astype(str).str.upper().str.contains(q, na=False, regex=False) | df_comp["Descricao"].astype(str).str.upper().str.contains(q, na=False, regex=False))
                df_comp = df_comp[cond_comp]
            if not df_sc.empty:
                cond_sc = False
                for q in lista_busca:
                    cond_sc = cond_sc | (df_sc["COD_PECA"].astype(str).str.upper().str.contains(q, na=False, regex=False) | df_sc["Descricao"].astype(str).str.upper().str.contains(q, na=False, regex=False))
                df_sc = df_sc[cond_sc]

        tot_op = int(df_cruz["Qtd_OP"].sum()) if not df_cruz.empty else 0
        tot_fab = int(df_cruz["Qtd_Fabr"].sum()) if not df_cruz.empty else 0
        tot_env = int(df_cruz["Env_Pintura"].sum()) if not df_cruz.empty else 0
        tot_ret = int(df_cruz["Ret_Pintura"].sum()) if not df_cruz.empty else 0
        falta_fab = int(df_cruz["Falta_Fabricar"].sum()) if not df_cruz.empty else 0
        falta_env = int(df_cruz["Aguardando_Envio"].sum()) if not df_cruz.empty else 0
        saldo_rua = int(df_cruz["Saldo_Pendente_Pintura"].sum()) if not df_cruz.empty else 0

        tot_comprado = int(df_comp["Qtd_Comprada"].sum()) if not df_comp.empty else 0
        tot_entregue = int(df_comp["Qtd_Entregue"].sum()) if not df_comp.empty else 0
        saldo_compra = int(df_comp["Saldo_Falta_Entregar"].sum()) if not df_comp.empty else 0

        tot_sc = int(df_sc["Qtd_SC"].sum()) if not df_sc.empty else 0
        qtd_itens_sc = len(df_sc) if not df_sc.empty else 0

        pct_fab = round((tot_fab / tot_op * 100), 1) if tot_op > 0 else 0.0
        pct_ret = round((tot_ret / tot_op * 100), 1) if tot_op > 0 else 0.0
        pct_comp = round((tot_entregue / tot_comprado * 100), 1) if tot_comprado > 0 else 0.0

        nome_projeto_exibir = ", ".join(lista_proj[:2]) + ("..." if len(lista_proj) > 2 else "") if lista_proj else "TODOS"

        return {
            "projeto": nome_projeto_exibir,
            "tot_op": tot_op,
            "tot_fab": tot_fab,
            "tot_env": tot_env,
            "tot_ret": tot_ret,
            "falta_fab": falta_fab,
            "falta_env": falta_env,
            "saldo_rua": saldo_rua,
            "tot_comprado": tot_comprado,
            "tot_entregue": tot_entregue,
            "saldo_compra": saldo_compra,
            "tot_sc": tot_sc,
            "qtd_itens_sc": qtd_itens_sc,
            "pct_fab": pct_fab,
            "pct_ret": pct_ret,
            "pct_comp": pct_comp,
            "itens_totais": (len(df_cruz) if not df_cruz.empty else 0) + (len(df_comp) if not df_comp.empty else 0) + qtd_itens_sc,
        }

    def get_projetos(self):
        data = self.load_processed_data()
        df = data["df_unificado"]
        if df.empty or "OBS_NORM" not in df.columns:
            return []
        s = df["OBS_NORM"].replace("", pd.NA).dropna().value_counts()
        return [{"nome": str(k), "qtd_itens": int(v)} for k, v in s.items()]

    def get_fornecedores(self, projeto=None, busca=None):
        data = self.load_processed_data()
        df_cruz = data["df_cruz"].copy() if not data["df_cruz"].empty else pd.DataFrame()
        if df_cruz.empty:
            return []

        lista_proj = self.extrair_lista_projetos(projeto)
        if lista_proj:
            df_cruz = df_cruz[df_cruz["OBS_NORM"].isin(lista_proj)]

        lista_busca = self.extrair_lista_buscas(busca)
        if lista_busca:
            cond_cruz = False
            for q in lista_busca:
                cond_cruz = cond_cruz | (df_cruz["COD_PECA"].astype(str).str.upper().str.contains(q, na=False, regex=False) | df_cruz["Descricao"].astype(str).str.upper().str.contains(q, na=False, regex=False))
            df_cruz = df_cruz[cond_cruz]

        df_forn = df_cruz[df_cruz["Env_Pintura"] > 0]
        if df_forn.empty:
            return []

        res = []
        for forn, grp in df_forn.groupby("Fornecedor_Tratamento"):
            forn_nome = str(forn).strip() or "NÃO DEFINIDO"
            res.append({
                "fornecedor": forn_nome,
                "enviado": int(grp["Env_Pintura"].sum()),
                "retornado": int(grp["Ret_Pintura"].sum()),
                "saldo_rua": int(grp["Saldo_Pendente_Pintura"].sum()),
                "itens": int(len(grp)),
            })
        return sorted(res, key=lambda x: x["saldo_rua"], reverse=True)

    def get_items(self, tab="unificado", projeto=None, busca=None, limit=200, offset=0):
        data = self.load_processed_data()
        
        if tab == "fabricadas" or tab == "fabricacao":
            df = data["df_cruz"].copy() if not data["df_cruz"].empty else pd.DataFrame()
            if not df.empty and tab == "fabricadas":
                df = df[df["Qtd_Fabr"] > 0]
        elif tab == "falta_fab":
            df = data["df_cruz"].copy() if not data["df_cruz"].empty else pd.DataFrame()
            if not df.empty:
                df = df[df["Falta_Fabricar"] > 0]
        elif tab == "falta_retorno":
            df = data["df_cruz"].copy() if not data["df_cruz"].empty else pd.DataFrame()
            if not df.empty:
                df = df[df["Saldo_Pendente_Pintura"] > 0]
        elif tab == "aguardando_envio":
            df = data["df_cruz"].copy() if not data["df_cruz"].empty else pd.DataFrame()
            if not df.empty:
                df = df[df["Aguardando_Envio"] > 0]
        elif tab == "retornadas":
            df = data["df_cruz"].copy() if not data["df_cruz"].empty else pd.DataFrame()
            if not df.empty:
                df = df[df["Ret_Pintura"] > 0]
        elif tab == "compras":
            df = data["df_comp"].copy() if not data["df_comp"].empty else pd.DataFrame()
        elif tab == "sc":
            df = data["df_sc"].copy() if not data["df_sc"].empty else pd.DataFrame()
        elif tab == "falta_geral":
            df = data["df_unificado"].copy() if not data["df_unificado"].empty else pd.DataFrame()
            if not df.empty:
                df = df[df["Status_Unificado"] != "100% Entregue"]
        else: # unificado
            df = data["df_unificado"].copy() if not data["df_unificado"].empty else pd.DataFrame()

        if df.empty:
            return {"total": 0, "items": []}

        lista_proj = self.extrair_lista_projetos(projeto)
        if lista_proj:
            df = df[df["OBS_NORM"].isin(lista_proj)]

        lista_busca = self.extrair_lista_buscas(busca)
        if lista_busca:
            col_cod = "COD_PECA" if "COD_PECA" in df.columns else ""
            col_desc = "Descricao" if "Descricao" in df.columns else ("DESC_PECA" if "DESC_PECA" in df.columns else "")
            cond = False
            for q in lista_busca:
                sub_cond = False
                if col_cod and col_cod in df.columns:
                    sub_cond = sub_cond | df[col_cod].astype(str).str.upper().str.contains(q, na=False, regex=False)
                if col_desc and col_desc in df.columns:
                    sub_cond = sub_cond | df[col_desc].astype(str).str.upper().str.contains(q, na=False, regex=False)
                cond = cond | sub_cond
            df = df[cond]

        total_count = len(df)
        df_sliced = df.iloc[offset : offset + limit] if limit > 0 else df
        
        # Converte NaN para None ou string limpa para JSON
        df_records = df_sliced.replace({np.nan: None}).to_dict(orient="records")
        return {"total": total_count, "items": df_records}

    def get_diagnostico_detalhado(self, projeto=None, busca=None):
        data = self.load_processed_data()
        df_cruz = data["df_cruz"].copy() if not data["df_cruz"].empty else pd.DataFrame()
        df_comp = data["df_comp"].copy() if not data["df_comp"].empty else pd.DataFrame()
        df_sc = data["df_sc"].copy() if not data["df_sc"].empty else pd.DataFrame()

        lista_proj = self.extrair_lista_projetos(projeto)
        if lista_proj:
            if not df_cruz.empty and "OBS_NORM" in df_cruz.columns:
                df_cruz = df_cruz[df_cruz["OBS_NORM"].isin(lista_proj)]
            if not df_comp.empty and "OBS_NORM" in df_comp.columns:
                df_comp = df_comp[df_comp["OBS_NORM"].isin(lista_proj)]
            if not df_sc.empty and "OBS_NORM" in df_sc.columns:
                df_sc = df_sc[df_sc["OBS_NORM"].isin(lista_proj)]

        lista_busca = self.extrair_lista_buscas(busca)
        if lista_busca:
            if not df_cruz.empty:
                cond_cruz = False
                for q in lista_busca:
                    cond_cruz = cond_cruz | (df_cruz["COD_PECA"].astype(str).str.upper().str.contains(q, na=False, regex=False) | df_cruz["Descricao"].astype(str).str.upper().str.contains(q, na=False, regex=False))
                df_cruz = df_cruz[cond_cruz]
            if not df_comp.empty:
                cond_comp = False
                for q in lista_busca:
                    cond_comp = cond_comp | (df_comp["COD_PECA"].astype(str).str.upper().str.contains(q, na=False, regex=False) | df_comp["Descricao"].astype(str).str.upper().str.contains(q, na=False, regex=False))
                df_comp = df_comp[cond_comp]
            if not df_sc.empty:
                cond_sc = False
                for q in lista_busca:
                    cond_sc = cond_sc | (df_sc["COD_PECA"].astype(str).str.upper().str.contains(q, na=False, regex=False) | df_sc["Descricao"].astype(str).str.upper().str.contains(q, na=False, regex=False))
                df_sc = df_sc[cond_sc]

        na_rua_grupos = []
        if not df_cruz.empty and "Saldo_Pendente_Pintura" in df_cruz.columns:
            df_na_rua = df_cruz[df_cruz["Saldo_Pendente_Pintura"] > 0]
            if not df_na_rua.empty:
                for forn, grp in df_na_rua.groupby("Fornecedor_Tratamento"):
                    saldo_forn = int(grp["Saldo_Pendente_Pintura"].sum())
                    itens = []
                    for _, r in grp.iterrows():
                        itens.append({
                            "COD_PECA": str(r.get("COD_PECA", "-")),
                            "Descricao": str(r.get("Descricao", "-")),
                            "Saldo_Pendente_Pintura": int(r.get("Saldo_Pendente_Pintura", 0)),
                            "Doc_Romaneio": str(r.get("Doc_Romaneio", "-")),
                            "Data_Envio": str(r.get("Data_Envio", "-"))
                        })
                    na_rua_grupos.append({
                        "fornecedor": str(forn),
                        "saldo_total": saldo_forn,
                        "qtd_itens": len(grp),
                        "itens": itens
                    })

        compras_pend = []
        if not df_comp.empty and "Saldo_Falta_Entregar" in df_comp.columns:
            df_cp = df_comp[df_comp["Saldo_Falta_Entregar"] > 0]
            for _, rc in df_cp.iterrows():
                compras_pend.append({
                    "COD_PECA": str(rc.get("COD_PECA", "-")),
                    "Descricao": str(rc.get("Descricao", "-")),
                    "Saldo_Falta_Entregar": int(rc.get("Saldo_Falta_Entregar", 0)),
                    "Fornecedor": str(rc.get("Fornecedor", "-")),
                    "Data_Fornecedor": str(rc.get("Data_Fornecedor", "-"))
                })

        sc_pend = []
        if not df_sc.empty:
            for _, rsc in df_sc.iterrows():
                sc_pend.append({
                    "COD_PECA": str(rsc.get("COD_PECA", "-")),
                    "Descricao": str(rsc.get("Descricao", "-")),
                    "Qtd_SC": int(rsc.get("Qtd_SC", 0)),
                    "Num_SC": str(rsc.get("Num_SC", "-")),
                    "Solicitante": str(rsc.get("Solicitante", "-")),
                    "Necessidade": str(rsc.get("Necessidade", "-"))
                })

        return {
            "na_rua": na_rua_grupos,
            "compras_pendentes": compras_pend,
            "sc_pendentes": sc_pend
        }

    def get_pecas_sugestoes(self, q=None, projeto=None, limit=50):
        data = self.load_processed_data()
        df = data["df_unificado"]
        if df.empty:
            return []

        lista_proj = self.extrair_lista_projetos(projeto)
        if lista_proj:
            df = df[df["OBS_NORM"].isin(lista_proj)]

        if q and len(str(q).strip()) >= 1:
            q_norm = normalizar_texto(q)
            cond = df["COD_PECA"].astype(str).str.contains(q_norm, na=False) | df["Descricao"].astype(str).str.upper().str.contains(q_norm, na=False)
            df = df[cond]
        elif not lista_proj:
            return []

        df = df[df["COD_PECA"].astype(str).str.strip() != ""]
        sub = df[["COD_PECA", "Descricao"]].drop_duplicates(subset=["COD_PECA"]).head(limit)
        return sub.to_dict(orient="records")


data_engine = DataEngine()
