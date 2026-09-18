-- ==============================================================================
-- SCHEMA SUPABASE: FCM GESTÃO INTEGRADA
-- Execute este script no SQL Editor do seu painel Supabase
-- ==============================================================================

-- 1. TABELA DE METADADOS E RESUMOS EXECUTIVOS (KPIs, DROPDOWNS E CARDS)
DROP TABLE IF EXISTS fcm_metadata CASCADE;
CREATE TABLE fcm_metadata (
    id INT PRIMARY KEY DEFAULT 1,
    ultima_atualizacao TEXT,
    total_pecas INT,
    summary_geral JSONB,
    projetos_list JSONB,
    fornecedores_list JSONB,
    diagnostico_detalhado JSONB,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Habilita leitura pública (para o painel web consultar sem login)
ALTER TABLE fcm_metadata ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Leitura publica metadata" ON fcm_metadata FOR SELECT USING (true);

-- 2. TABELA PRINCIPAL DE PEÇAS E CONTROLE INTEGRADO
DROP TABLE IF EXISTS fcm_unificado CASCADE;
CREATE TABLE fcm_unificado (
    id BIGSERIAL PRIMARY KEY,
    origem_tipo TEXT,
    obs_norm TEXT,
    cod_peca TEXT,
    descricao TEXT,
    observacao TEXT,
    status_unificado TEXT,
    status TEXT,
    status_compra TEXT,
    fornecedor_responsavel TEXT,
    fornecedor_tratamento TEXT,
    fornecedor TEXT,
    qtd_total_demanda NUMERIC DEFAULT 0,
    qtd_entregue_pronta NUMERIC DEFAULT 0,
    qtd_em_tratamento NUMERIC DEFAULT 0,
    falta_fabricar_entregar NUMERIC DEFAULT 0,
    saldo_pendente_entrega NUMERIC DEFAULT 0,
    falta_produzir_interno NUMERIC DEFAULT 0,
    doc_origem_envio TEXT,
    nf_retorno_entrega TEXT,
    data_movimento TEXT,
    data_fabricacao TEXT,
    data_envio TEXT,
    data_retorno TEXT,
    qtd_op NUMERIC DEFAULT 0,
    qtd_fabr NUMERIC DEFAULT 0,
    env_pintura NUMERIC DEFAULT 0,
    ret_pintura NUMERIC DEFAULT 0,
    saldo_rua NUMERIC DEFAULT 0,
    doc_romaneio TEXT,
    nf_retorno TEXT,
    saldo_pendente_pintura NUMERIC DEFAULT 0,
    aguardando_envio NUMERIC DEFAULT 0,
    falta_fabricar NUMERIC DEFAULT 0,
    qtd_comprada NUMERIC DEFAULT 0,
    qtd_entregue NUMERIC DEFAULT 0,
    saldo_falta_entregar NUMERIC DEFAULT 0,
    data_entrega TEXT,
    nf_entrega TEXT,
    data_fornecedor TEXT,
    num_sc TEXT,
    item TEXT,
    um TEXT,
    qtd_sc NUMERIC DEFAULT 0,
    necessidade TEXT,
    emissao TEXT,
    solicitante TEXT,
    classe_valor TEXT,
    pedido TEXT
);

-- 3. ÍNDICES DE ALTA VELOCIDADE PARA BUSCA E FILTROS
CREATE INDEX idx_fcm_obs_norm ON fcm_unificado (obs_norm);
CREATE INDEX idx_fcm_cod_peca ON fcm_unificado (cod_peca);
CREATE INDEX idx_fcm_status_unificado ON fcm_unificado (status_unificado);
CREATE INDEX idx_fcm_origem_tipo ON fcm_unificado (origem_tipo);

-- Habilita leitura pública
ALTER TABLE fcm_unificado ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Leitura publica unificado" ON fcm_unificado FOR SELECT USING (true);

-- 4. CONCESSÃO DE PERMISSÕES PARA AS CHAVES DO SUPABASE
GRANT ALL ON TABLE fcm_metadata TO anon, authenticated, service_role;
GRANT ALL ON TABLE fcm_unificado TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
