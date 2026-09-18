/**
 * Serviço de API unificado:
 * - Em desenvolvimento local (porta 8000), consulta o servidor Python local.
 * - Na Vercel ou produção web, consulta diretamente o Supabase (PostgREST) com cache em memória e ultra performance.
 */

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://oczagzgosnsprogxymtb.supabase.co";
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "sb_publishable_Bih4uz9Nlb_mpaAbY3OqCQ_sIMQ8B4l";

const isCloud = typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';

const LOCAL_API = typeof window !== 'undefined' && window.location.origin.includes(':5173')
  ? 'http://localhost:8000/api'
  : '/api';

const HEADERS_SUPABASE = {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
};

let metadataCache = null;
let lastMetadataFetch = 0;

async function getMetadata(force = false) {
  const now = Date.now();
  if (metadataCache && !force && (now - lastMetadataFetch < 180000)) {
    return metadataCache;
  }
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/fcm_metadata?select=*&id=eq.1`, {
      headers: HEADERS_SUPABASE
    });
    if (res.ok) {
      const data = await res.json();
      metadataCache = data[0] || {};
      lastMetadataFetch = now;
    }
  } catch (err) {
    console.error("Erro ao carregar metadados da nuvem:", err);
  }
  return metadataCache || {};
}

function normalizeRow(r) {
  if (!r) return r;
  return {
    ...r,
    COD_PECA: r.cod_peca ?? r.COD_PECA,
    OBS_NORM: r.obs_norm ?? r.OBS_NORM,
    Descricao: r.descricao ?? r.Descricao,
    Observacao: r.observacao ?? r.Observacao,
    Status_Unificado: r.status_unificado ?? r.Status_Unificado,
    Status: r.status ?? r.Status,
    Status_Compra: r.status_compra ?? r.Status_Compra,
    Origem_Tipo: r.origem_tipo ?? r.Origem_Tipo,
    Fornecedor_Responsavel: r.fornecedor_responsavel ?? r.Fornecedor_Responsavel,
    Fornecedor_Tratamento: r.fornecedor_tratamento ?? r.Fornecedor_Tratamento,
    Fornecedor: r.fornecedor ?? r.Fornecedor,
    Qtd_Total_Demanda: Number(r.qtd_total_demanda ?? r.Qtd_Total_Demanda ?? 0),
    Qtd_Entregue_Pronta: Number(r.qtd_entregue_pronta ?? r.Qtd_Entregue_Pronta ?? 0),
    Qtd_Em_Tratamento: Number(r.qtd_em_tratamento ?? r.Qtd_Em_Tratamento ?? 0),
    Falta_Fabricar_Entregar: Number(r.falta_fabricar_entregar ?? r.Falta_Fabricar_Entregar ?? 0),
    Saldo_Pendente_Entrega: Number(r.saldo_pendente_entrega ?? r.Saldo_Pendente_Entrega ?? 0),
    Falta_Produzir_Interno: Number(r.falta_produzir_interno ?? r.Falta_Produzir_Interno ?? 0),
    Doc_Origem_Envio: r.doc_origem_envio ?? r.Doc_Origem_Envio,
    NF_Retorno_Entrega: r.nf_retorno_entrega ?? r.NF_Retorno_Entrega,
    Data_Movimento: r.data_movimento ?? r.Data_Movimento,
    Data_Fabricacao: r.data_fabricacao ?? r.Data_Fabricacao,
    Data_Envio: r.data_envio ?? r.Data_Envio,
    Data_Retorno: r.data_retorno ?? r.Data_Retorno,
    Qtd_OP: Number(r.qtd_op ?? r.Qtd_OP ?? 0),
    Qtd_Fabr: Number(r.qtd_fabr ?? r.Qtd_Fabr ?? 0),
    Env_Pintura: Number(r.env_pintura ?? r.Env_Pintura ?? 0),
    Ret_Pintura: Number(r.ret_pintura ?? r.Ret_Pintura ?? 0),
    Saldo_Rua: Number(r.saldo_rua ?? r.Saldo_Rua ?? 0),
    Doc_Romaneio: r.doc_romaneio ?? r.Doc_Romaneio,
    NF_Retorno: r.nf_retorno ?? r.NF_Retorno,
    Saldo_Pendente_Pintura: Number(r.saldo_pendente_pintura ?? r.Saldo_Pendente_Pintura ?? 0),
    Aguardando_Envio: Number(r.aguardando_envio ?? r.Aguardando_Envio ?? 0),
    Falta_Fabricar: Number(r.falta_fabricar ?? r.Falta_Fabricar ?? 0),
    Qtd_Comprada: Number(r.qtd_comprada ?? r.Qtd_Comprada ?? 0),
    Qtd_Entregue: Number(r.qtd_entregue ?? r.Qtd_Entregue ?? 0),
    Saldo_Falta_Entregar: Number(r.saldo_falta_entregar ?? r.Saldo_Falta_Entregar ?? 0),
    Data_Entrega: r.data_entrega ?? r.Data_Entrega,
    NF_Entrega: r.nf_entrega ?? r.NF_Entrega,
    Data_Fornecedor: r.data_fornecedor ?? r.Data_Fornecedor,
    Num_SC: r.num_sc ?? r.Num_SC,
    Item: r.item ?? r.Item,
    UM: r.um ?? r.UM,
    Qtd_SC: Number(r.qtd_sc ?? r.Qtd_SC ?? 0),
    Necessidade: r.necessidade ?? r.Necessidade,
    Emissao: r.emissao ?? r.Emissao,
    Solicitante: r.solicitante ?? r.Solicitante,
    Classe_Valor: r.classe_valor ?? r.Classe_Valor,
    Pedido: r.pedido ?? r.Pedido
  };
}

export const apiService = {
  async getStatus() {
    if (!isCloud) {
      try {
        const res = await fetch(`${LOCAL_API}/status`);
        if (res.ok) return await res.json();
      } catch {}
    }
    const meta = await getMetadata();
    return {
      status: "online (Nuvem Supabase)",
      ultima_atualizacao: meta.ultima_atualizacao || "Online",
      total_pecas: meta.total_pecas || 0
    };
  },

  async getProjetos() {
    if (!isCloud) {
      try {
        const res = await fetch(`${LOCAL_API}/projetos`);
        if (res.ok) return await res.json();
      } catch {}
    }
    const meta = await getMetadata();
    return meta.projetos_list || [];
  },

  async getSummary(projetos = [], busca = '') {
    if (!isCloud && (projetos.length > 0 || busca)) {
      try {
        const p = new URLSearchParams();
        if (projetos.length > 0) p.append('projeto', projetos.join(','));
        if (busca) p.append('busca', busca);
        const res = await fetch(`${LOCAL_API}/summary?${p}`);
        if (res.ok) return await res.json();
      } catch {}
    }

    const meta = await getMetadata();
    if (projetos.length === 0 && !busca) {
      return meta.summary_geral || {};
    }

    // Calcula KPIs dinâmicos para o projeto filtrado na nuvem
    try {
      let query = `${SUPABASE_URL}/rest/v1/fcm_unificado?select=origem_tipo,qtd_op,qtd_fabr,env_pintura,ret_pintura,saldo_rua,falta_fabricar,qtd_comprada,qtd_entregue,saldo_falta_entregar,qtd_sc`;
      
      if (projetos.length === 1) {
        query += `&obs_norm=eq.${encodeURIComponent(projetos[0])}`;
      } else if (projetos.length > 1) {
        const formatted = encodeURIComponent(`("${projetos.map(p => p.replace(/"/g, '""')).join('","')}")`);
        query += `&obs_norm=in.${formatted}`;
      }

      if (busca) {
        const b = encodeURIComponent(`*${busca.toUpperCase()}*`);
        query += `&or=(cod_peca.ilike.${b},descricao.ilike.${b})`;
      }

      const res = await fetch(query, { headers: HEADERS_SUPABASE });
      if (res.ok) {
        const items = await res.json();
        const pcp = items.filter(x => (x.origem_tipo || '').includes('Fabrica') || (x.origem_tipo || '').includes('PCP'));
        const cmp = items.filter(x => (x.origem_tipo || '').includes('Compra'));
        const sc  = items.filter(x => (x.origem_tipo || '').includes('SC'));

        const tot_op = pcp.reduce((s, x) => s + (Number(x.qtd_op) || 0), 0);
        const tot_fab = pcp.reduce((s, x) => s + (Number(x.qtd_fabr) || 0), 0);
        const tot_env = pcp.reduce((s, x) => s + (Number(x.env_pintura) || 0), 0);
        const tot_ret = pcp.reduce((s, x) => s + (Number(x.ret_pintura) || 0), 0);
        const saldo_rua = pcp.reduce((s, x) => s + (Number(x.saldo_rua) || 0), 0);
        const falta_fab = pcp.reduce((s, x) => s + (Number(x.falta_fabricar) || 0), 0);
        const falta_env = Math.max(0, tot_fab - tot_env);

        const qtd_comprada = cmp.reduce((s, x) => s + (Number(x.qtd_comprada) || 0), 0);
        const qtd_entregue = cmp.reduce((s, x) => s + (Number(x.qtd_entregue) || 0), 0);
        const saldo_compra = cmp.reduce((s, x) => s + (Number(x.saldo_falta_entregar) || 0), 0);

        const tot_sc = sc.reduce((s, x) => s + (Number(x.qtd_sc) || 0), 0);

        return {
          projeto: projetos.join(', ') || 'Filtro Aplicado',
          tot_op,
          tot_fab,
          tot_env,
          tot_ret,
          saldo_rua,
          falta_fab,
          falta_env,
          qtd_comprada,
          qtd_entregue,
          saldo_compra,
          tot_sc,
          qtd_itens_sc: sc.length,
          pct_fab: tot_op > 0 ? Math.round((tot_fab / tot_op) * 100) : 0,
          pct_ret: tot_op > 0 ? Math.round((tot_ret / tot_op) * 100) : 0
        };
      }
    } catch (e) {
      console.error("Erro ao calcular resumo dos projetos:", e);
    }

    return meta.summary_geral || {};
  },

  async getFornecedores(projetos = [], busca = '') {
    if (!isCloud && (projetos.length > 0 || busca)) {
      try {
        const p = new URLSearchParams();
        if (projetos.length > 0) p.append('projeto', projetos.join(','));
        if (busca) p.append('busca', busca);
        const res = await fetch(`${LOCAL_API}/fornecedores?${p}`);
        if (res.ok) return await res.json();
      } catch {}
    }
    const meta = await getMetadata();
    return meta.fornecedores_list || [];
  },

  async getDiagnosticoDetalhado(projetos = [], busca = '') {
    if (!isCloud && (projetos.length > 0 || busca)) {
      try {
        const p = new URLSearchParams();
        if (projetos.length > 0) p.append('projeto', projetos.join(','));
        if (busca) p.append('busca', busca);
        const res = await fetch(`${LOCAL_API}/diagnostico-detalhado?${p}`);
        if (res.ok) return await res.json();
      } catch {}
    }
    const meta = await getMetadata();
    return meta.diagnostico_detalhado || { na_rua: [], compras_pendentes: [], sc_pendentes: [] };
  },

  async getItems({ tab = 'unificado', projetos = [], busca = '', limit = 100, offset = 0 }) {
    if (!isCloud) {
      try {
        const p = new URLSearchParams();
        p.append('tab', tab);
        if (projetos.length > 0) p.append('projeto', projetos.join(','));
        if (busca) p.append('busca', busca);
        p.append('limit', limit);
        p.append('offset', offset);
        const res = await fetch(`${LOCAL_API}/items?${p}`);
        if (res.ok) return await res.json();
      } catch {}
    }

    let query = `${SUPABASE_URL}/rest/v1/fcm_unificado?select=*`;

    if (projetos.length === 1) {
      query += `&obs_norm=eq.${encodeURIComponent(projetos[0])}`;
    } else if (projetos.length > 1) {
      const formatted = encodeURIComponent(`("${projetos.map(p => p.replace(/"/g, '""')).join('","')}")`);
      query += `&obs_norm=in.${formatted}`;
    }

    if (busca) {
      const b = encodeURIComponent(`*${busca.toUpperCase()}*`);
      query += `&or=(cod_peca.ilike.${b},descricao.ilike.${b})`;
    }

    switch (tab) {
      case 'falta_geral':
        query += '&falta_fabricar_entregar=gt.0';
        break;
      case 'fabricadas':
        query += '&origem_tipo=ilike.*Fabrica*';
        break;
      case 'retornadas':
        query += '&ret_pintura=gt.0';
        break;
      case 'falta_retorno':
        query += '&saldo_rua=gt.0';
        break;
      case 'aguardando_envio':
        query += '&aguardando_envio=gt.0';
        break;
      case 'falta_fab':
        query += '&falta_fabricar=gt.0';
        break;
      case 'compras':
        query += '&origem_tipo=ilike.*Compra*';
        break;
      case 'sc':
        query += '&origem_tipo=ilike.*SC*';
        break;
      default:
        break;
    }

    query += `&order=id.asc`;

    if (limit > 0) {
      query += `&limit=${limit}&offset=${offset}`;
    }

    const headers = {
      ...HEADERS_SUPABASE,
      Prefer: 'count=exact'
    };

    const res = await fetch(query, { headers });
    const countHeader = res.headers.get('content-range');
    let total = 0;
    if (countHeader) {
      const parts = countHeader.split('/');
      if (parts[1]) total = parseInt(parts[1], 10);
    }

    const rows = await res.json();
    return {
      total: isNaN(total) ? (Array.isArray(rows) ? rows.length : 0) : total,
      items: Array.isArray(rows) ? rows.map(normalizeRow) : []
    };
  }
};
