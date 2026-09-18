import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Factory, Search, RefreshCw, Layers, CheckCircle2, AlertTriangle,
  Truck, ShoppingCart, FileText, Download, ChevronLeft, ChevronRight,
  ChevronDown, TrendingUp, Package, ShieldCheck, Building2, X, Check,
  ChevronsUpDown, ArrowUp, ArrowDown, ArrowUpDown, Copy, Printer, Zap, Filter
} from 'lucide-react';
import { apiService } from './services/apiService';

const API_BASE = window.location.origin.includes(':5173')
  ? 'http://localhost:8000/api'
  : '/api';

const TABS = [
  { id: 'unificado',     label: '📊 Metálicos Total',        icon: Layers },
  { id: 'falta_geral',   label: '🚨 Metálicos Total Falta',  icon: AlertTriangle, color: '#f87171' },
  { id: 'fabricadas',    label: '🏭 Peças Fabricadas',        icon: Factory },
  { id: 'retornadas',    label: '✅ Peças Retornadas',        icon: CheckCircle2 },
  { id: 'falta_retorno', label: '🚨 Falta Retorno',           icon: AlertTriangle, color: '#f87171' },
  { id: 'aguardando_envio', label: '🚚 AguardandEnvio',     icon: Truck },
  { id: 'falta_fab',     label: '⚙️ Falta Fabricar',          icon: TrendingUp },
  { id: 'diagnostico',    label: '📱 ResumExecutivo',       icon: ShieldCheck },
  { id: 'compras',       label: '📦 Compras Externas',        icon: ShoppingCart },
  { id: 'sc',            label: '📋 SC em Aberto',            icon: FileText },
  { id: 'pintura',       label: '🎨 Fornecedores & Pintura',  icon: Building2 },
];

// ── Column definitions per tab (used for sort headers + copy text)
const UNIFIED_COLS = [
  { label: 'Status',                    field: 'Status_Unificado' },
  { label: 'Data / Previsão',           field: 'Data_Movimento' },
  { label: 'Origem',                    field: 'Origem_Tipo' },
  { label: 'Lote / Projeto',            field: 'OBS_NORM' },
  { label: 'Código Peça',               field: 'COD_PECA' },
  { label: 'Descrição Completa',        field: 'Descricao', wide: true },
  { label: 'Observação',                field: 'Observacao' },
  { label: 'Fornecedor / Resp.',        field: 'Fornecedor_Responsavel' },
  { label: 'Demanda',                   field: 'Qtd_Total_Demanda',        numeric: true },
  { label: 'Fabricado / Entregue',      field: 'Qtd_Entregue_Pronta',      numeric: true },
  { label: 'Em Tratamento',             field: 'Qtd_Em_Tratamento',        numeric: true },
  { label: 'Falta Fabricar / Entregar', field: 'Falta_Fabricar_Entregar',  numeric: true },
  { label: 'Romaneio Envio',            field: 'Doc_Origem_Envio' },
  { label: 'NF Retorno',                field: 'NF_Retorno_Entrega' },
];

const TAB_COLUMNS = {
  compras: [
    { label: 'Status',               field: 'Status_Compra' },
    { label: 'Fornecedor',           field: 'Fornecedor' },
    { label: 'Lote / Projeto',       field: 'OBS_NORM' },
    { label: 'Código Peça',          field: 'COD_PECA' },
    { label: 'Descrição Completa',   field: 'Descricao', wide: true },
    { label: 'Qtd Comprada',         field: 'Qtd_Comprada',          numeric: true },
    { label: 'Qtd Entregue',         field: 'Qtd_Entregue',          numeric: true },
    { label: 'Saldo Falta',          field: 'Saldo_Falta_Entregar',  numeric: true },
    { label: 'Data Entrega',         field: 'Data_Entrega' },
    { label: 'NF Entrega',           field: 'NF_Entrega' },
    { label: 'Previsão Fornecedor',  field: 'Data_Fornecedor' },
  ],
  sc: [
    { label: 'N SC',                field: 'Num_SC' },
    { label: 'Item',                 field: 'Item' },
    { label: 'UM',                   field: 'UM' },
    { label: 'Lote / Projeto',       field: 'OBS_NORM' },
    { label: 'Código Peça',          field: 'COD_PECA' },
    { label: 'Descrição Completa',   field: 'Descricao', wide: true },
    { label: 'Qtd SC',               field: 'Qtd_SC',    numeric: true },
    { label: 'Necessidade',          field: 'Necessidade' },
    { label: 'Emissão',              field: 'Emissao' },
    { label: 'Solicitante',          field: 'Solicitante' },
    { label: 'Classe Valor',         field: 'Classe_Valor' },
    { label: 'Pedido',               field: 'Pedido' },
  ],
  fabricadas: [
    { label: 'Status',               field: 'Status' },
    { label: 'Data Fabricação',      field: 'Data_Fabricacao' },
    { label: 'Lote / Projeto',       field: 'OBS_NORM' },
    { label: 'Código Peça',          field: 'COD_PECA' },
    { label: 'Descrição Completa',   field: 'Descricao', wide: true },
    { label: 'Observação',           field: 'Observacao' },
    { label: 'Programado OP',        field: 'Qtd_OP',            numeric: true },
    { label: 'Já Fabricado',         field: 'Qtd_Fabr',          numeric: true },
    { label: 'Saiu p/ Pintura',      field: 'Env_Pintura',       numeric: true },
    { label: 'Aguardando Envio',     field: 'Aguardando_Envio',  numeric: true },
  ],
  retornadas: [
    { label: 'Status',               field: 'Status' },
    { label: 'Data Retorno',         field: 'Data_Retorno' },
    { label: 'Lote / Projeto',       field: 'OBS_NORM' },
    { label: 'Código Peça',          field: 'COD_PECA' },
    { label: 'Descrição Completa',   field: 'Descricao', wide: true },
    { label: 'Fornecedor (Entregou)',field: 'Fornecedor_Tratamento' },
    { label: 'Fabricado',            field: 'Qtd_Fabr',    numeric: true },
    { label: 'Enviado',              field: 'Env_Pintura', numeric: true },
    { label: 'Retornado Pronto',     field: 'Ret_Pintura', numeric: true },
    { label: 'NF Retorno',           field: 'NF_Retorno' },
    { label: 'Romaneio Envio',       field: 'Doc_Romaneio' },
    { label: 'Data Envio',           field: 'Data_Envio' },
  ],
  falta_retorno: [
    { label: 'Data Envio',           field: 'Data_Envio' },
    { label: 'Lote / Projeto',       field: 'OBS_NORM' },
    { label: 'Código Peça',          field: 'COD_PECA' },
    { label: 'Descrição Completa',   field: 'Descricao', wide: true },
    { label: 'Fornecedor (Onde está)',field: 'Fornecedor_Tratamento' },
    { label: 'Programado',           field: 'Qtd_OP',                   numeric: true },
    { label: 'Fabricado',            field: 'Qtd_Fabr',                  numeric: true },
    { label: 'Enviado',              field: 'Env_Pintura',               numeric: true },
    { label: 'Retornado',            field: 'Ret_Pintura',               numeric: true },
    { label: 'Falta Retorno (Saldo na Rua)', field: 'Saldo_Pendente_Pintura', numeric: true },
    { label: 'Romaneio',             field: 'Doc_Romaneio' },
  ],
  aguardando_envio: [
    { label: 'Data Fabricação',      field: 'Data_Fabricacao' },
    { label: 'Lote / Projeto',       field: 'OBS_NORM' },
    { label: 'Código Peça',          field: 'COD_PECA' },
    { label: 'Descrição Completa',   field: 'Descricao', wide: true },
    { label: 'Programado OP',        field: 'Qtd_OP',           numeric: true },
    { label: 'Fabricado',            field: 'Qtd_Fabr',         numeric: true },
    { label: 'Já Enviado',           field: 'Env_Pintura',      numeric: true },
    { label: 'Aguardando Despacho',  field: 'Aguardando_Envio', numeric: true },
  ],
  falta_fab: [
    { label: 'Lote / Projeto',       field: 'OBS_NORM' },
    { label: 'Código Peça',          field: 'COD_PECA' },
    { label: 'Descrição Completa',   field: 'Descricao', wide: true },
    { label: 'Programado OP',        field: 'Qtd_OP',           numeric: true },
    { label: 'Já Fabricado',         field: 'Qtd_Fabr',         numeric: true },
    { label: 'Saldo a Produzir (Falta Fabricar)', field: 'Falta_Fabricar', numeric: true },
  ],
  unificado:   UNIFIED_COLS,
  falta_geral: UNIFIED_COLS,
};

// ── Row highlight logic
function getRowHighlight(row, tab) {
  if (String(row.Status || row.Status_Unificado || '').includes('2025')) return '';
  if (tab === 'falta_geral' || tab === 'falta_fab' || tab === 'falta_retorno') return 'row-critical';
  if (tab === 'aguardando_envio' || tab === 'sc') return 'row-warning';
  if (tab === 'retornadas') return 'row-ok';
  if (tab === 'compras') return Number(row.Saldo_Falta_Entregar || 0) > 0 ? 'row-critical' : 'row-ok';
  if (tab === 'fabricadas') return Number(row.Aguardando_Envio || 0) > 0 ? 'row-warning' : 'row-ok';
  if (tab === 'unificado') {
    const falta = Number(row.Falta_Fabricar_Entregar ?? (Number(row.Falta_Produzir_Interno || 0) + Number(row.Saldo_Pendente_Entrega || 0)));
    const emTrat = Number(row.Qtd_Em_Tratamento ?? row.Saldo_Pendente_Pintura ?? 0);
    if (falta > 0) return 'row-critical';
    if (emTrat > 0) return 'row-warning';
    return 'row-ok';
  }
  return '';
}

// ── Sort icon component
function SortIcon({ field, sortColumn, sortDir }) {
  if (sortColumn !== field) return <ArrowUpDown size={11} style={{ opacity: 0.3, marginLeft: 4, flexShrink: 0 }} />;
  return sortDir === 'asc'
    ? <ArrowUp   size={11} style={{ color: '#38bdf8', marginLeft: 4, flexShrink: 0 }} />
    : <ArrowDown size={11} style={{ color: '#38bdf8', marginLeft: 4, flexShrink: 0 }} />;
}

// ── Per-tab cell renderer (preserves all original color/format logic)
function RowCells({ row, tab, getStatusBadge, fmtNum }) {
  const desc = { minWidth: '240px', maxWidth: '500px', whiteSpace: 'normal', wordBreak: 'break-word', lineHeight: '1.45', color: '#e2e8f0' };
  const cod  = { fontFamily: 'JetBrains Mono,monospace', fontWeight: 700, color: '#f1f5f9' };
  const mono = { fontFamily: 'JetBrains Mono,monospace' };

  if (tab === 'compras') return <>
    <td>{getStatusBadge(row.Status_Compra || row.Status)}</td>
    <td><b>{row.Fornecedor || '-'}</b></td>
    <td style={mono}>{row.OBS_NORM || '-'}</td>
    <td style={cod}>{row.COD_PECA || '-'}</td>
    <td style={desc}>{row.Descricao || row['Desc. Prod.'] || row['DESCRIÇÃO'] || row['DESCRIÇÃO DO PRODUTO'] || row.DESC_PECA || '-'}</td>
    <td>{fmtNum(row.Qtd_Comprada)}</td>
    <td style={{ color: '#34d399', fontWeight: 600 }}>{fmtNum(row.Qtd_Entregue)}</td>
    <td style={{ color: Number(row.Saldo_Falta_Entregar) > 0 ? '#f87171' : '#94a3b8', fontWeight: 700 }}>{fmtNum(row.Saldo_Falta_Entregar)}</td>
    <td>{row.Data_Entrega || '-'}</td>
    <td style={mono}>{row.NF_Entrega || '-'}</td>
    <td>{row.Data_Fornecedor || '-'}</td>
  </>;

  if (tab === 'sc') return <>
    <td style={{ ...mono, fontWeight: 700, color: '#38bdf8' }}>{row.Num_SC || '-'}</td>
    <td>{row.Item || '-'}</td>
    <td>{row.UM || 'PC'}</td>
    <td style={mono}>{row.OBS_NORM || '-'}</td>
    <td style={cod}>{row.COD_PECA || '-'}</td>
    <td style={desc}>{row.Descricao || row['Desc. Prod.'] || row['DESCRIÇÃO'] || row['DESCRIÇÃO DO PRODUTO'] || row.DESC_PECA || '-'}</td>
    <td style={{ fontWeight: 700 }}>{fmtNum(row.Qtd_SC)}</td>
    <td>{row.Necessidade || '-'}</td>
    <td>{row.Emissao || '-'}</td>
    <td>{row.Solicitante || '-'}</td>
    <td>{row.Classe_Valor || '-'}</td>
    <td style={mono}>{row.Pedido || '-'}</td>
  </>;

  if (tab === 'fabricadas') return <>
    <td>{getStatusBadge(row.Status)}</td>
    <td>{row.Data_Fabricacao || '-'}</td>
    <td style={mono}>{row.OBS_NORM || '-'}</td>
    <td style={cod}>{row.COD_PECA || '-'}</td>
    <td style={desc}>{row.Descricao || row['Desc. Prod.'] || row['DESCRIÇÃO'] || row['DESCRIÇÃO DO PRODUTO'] || row.DESC_PECA || '-'}</td>
    <td>{row.Observacao && row.Observacao !== '-' ? <span className="badge" style={{ background: 'rgba(99, 102, 241, 0.15)', color: '#a5b4fc', borderColor: 'rgba(99, 102, 241, 0.3)', whiteSpace: 'nowrap' }}>{row.Observacao}</span> : '-'}</td>
    <td>{fmtNum(row.Qtd_OP)}</td>
    <td style={{ color: '#34d399', fontWeight: 700 }}>{fmtNum(row.Qtd_Fabr)}</td>
    <td>{fmtNum(row.Env_Pintura)}</td>
    <td style={{ color: Number(row.Aguardando_Envio) > 0 ? '#fbbf24' : '#94a3b8', fontWeight: 600 }}>{fmtNum(row.Aguardando_Envio)}</td>
  </>;

  if (tab === 'retornadas') return <>
    <td>{getStatusBadge(row.Status)}</td>
    <td>{row.Data_Retorno || '-'}</td>
    <td style={mono}>{row.OBS_NORM || '-'}</td>
    <td style={cod}>{row.COD_PECA || '-'}</td>
    <td style={desc}>{row.Descricao || row['Desc. Prod.'] || row['DESCRIÇÃO'] || row['DESCRIÇÃO DO PRODUTO'] || row.DESC_PECA || '-'}</td>
    <td><b>{row.Fornecedor_Tratamento || '-'}</b></td>
    <td>{fmtNum(row.Qtd_Fabr)}</td>
    <td>{fmtNum(row.Env_Pintura)}</td>
    <td style={{ color: '#34d399', fontWeight: 700 }}>{fmtNum(row.Ret_Pintura)}</td>
    <td style={mono}>{row.NF_Retorno || '-'}</td>
    <td style={mono}>{row.Doc_Romaneio || '-'}</td>
    <td>{row.Data_Envio || '-'}</td>
  </>;

  if (tab === 'falta_retorno') return <>
    <td>{row.Data_Envio || '-'}</td>
    <td style={mono}>{row.OBS_NORM || '-'}</td>
    <td style={cod}>{row.COD_PECA || '-'}</td>
    <td style={desc}>{row.Descricao || row['Desc. Prod.'] || row['DESCRIÇÃO'] || row['DESCRIÇÃO DO PRODUTO'] || row.DESC_PECA || '-'}</td>
    <td><b style={{ color: '#f87171' }}>{row.Fornecedor_Tratamento || '-'}</b></td>
    <td>{fmtNum(row.Qtd_OP)}</td>
    <td>{fmtNum(row.Qtd_Fabr)}</td>
    <td>{fmtNum(row.Env_Pintura)}</td>
    <td>{fmtNum(row.Ret_Pintura)}</td>
    <td style={{ color: '#f87171', fontWeight: 800, fontSize: '0.92rem' }}>{fmtNum(row.Saldo_Pendente_Pintura)}</td>
    <td style={mono}>{row.Doc_Romaneio || '-'}</td>
  </>;

  if (tab === 'aguardando_envio') return <>
    <td>{row.Data_Fabricacao || '-'}</td>
    <td style={mono}>{row.OBS_NORM || '-'}</td>
    <td style={cod}>{row.COD_PECA || '-'}</td>
    <td style={desc}>{row.Descricao || row['Desc. Prod.'] || row['DESCRIÇÃO'] || row['DESCRIÇÃO DO PRODUTO'] || row.DESC_PECA || '-'}</td>
    <td>{fmtNum(row.Qtd_OP)}</td>
    <td>{fmtNum(row.Qtd_Fabr)}</td>
    <td>{fmtNum(row.Env_Pintura)}</td>
    <td style={{ color: '#fbbf24', fontWeight: 700 }}>{fmtNum(row.Aguardando_Envio)}</td>
  </>;

  if (tab === 'falta_fab') return <>
    <td style={mono}>{row.OBS_NORM || '-'}</td>
    <td style={cod}>{row.COD_PECA || '-'}</td>
    <td style={desc}>{row.Descricao || row['Desc. Prod.'] || row['DESCRIÇÃO'] || row['DESCRIÇÃO DO PRODUTO'] || row.DESC_PECA || '-'}</td>
    <td>{fmtNum(row.Qtd_OP)}</td>
    <td>{fmtNum(row.Qtd_Fabr)}</td>
    <td style={{ color: '#f87171', fontWeight: 800 }}>{fmtNum(row.Falta_Fabricar)}</td>
  </>;

  // unificado + falta_geral
  const demanda = Number(row.Qtd_Total_Demanda ?? row.Qtd_OP ?? 0);
  const pronto = Number(row.Qtd_Entregue_Pronta ?? row.Ret_Pintura ?? 0);
  const emTrat = Number(row.Qtd_Em_Tratamento ?? row.Saldo_Pendente_Pintura ?? 0);
  const falta = Number(row.Falta_Fabricar_Entregar ?? (Number(row.Falta_Produzir_Interno || 0) + Number(row.Saldo_Pendente_Entrega || 0)));

  return <>
    <td>{getStatusBadge(row.Status_Unificado || row.Status)}</td>
    <td>{row.Data_Movimento || '-'}</td>
    <td><span className="badge badge-info">{row.Origem_Tipo || '🏭 Fabricação Interna'}</span></td>
    <td style={mono}>{row.OBS_NORM || '-'}</td>
    <td style={cod}>{row.COD_PECA || '-'}</td>
    <td style={desc}>{row.Descricao || row['Desc. Prod.'] || row['DESCRIÇÃO'] || row['DESCRIÇÃO DO PRODUTO'] || row.DESC_PECA || '-'}</td>
    <td>{row.Observacao && row.Observacao !== '-' ? <span className="badge" style={{ background: 'rgba(99, 102, 241, 0.15)', color: '#a5b4fc', borderColor: 'rgba(99, 102, 241, 0.3)', whiteSpace: 'nowrap' }}>{row.Observacao}</span> : '-'}</td>
    <td>{row.Fornecedor_Responsavel || '-'}</td>
    <td style={{ fontWeight: 700, color: '#f8fafc', fontSize: '0.92rem' }}>{fmtNum(demanda)}</td>
    <td style={{ color: pronto > 0 ? '#10b981' : '#64748b', fontWeight: pronto > 0 ? 700 : 500, fontSize: '0.92rem' }}>
      {fmtNum(pronto)}
    </td>
    <td style={{ color: emTrat > 0 ? '#38bdf8' : '#64748b', fontWeight: emTrat > 0 ? 700 : 500, fontSize: '0.92rem' }}>
      {fmtNum(emTrat)}
    </td>
    <td style={{ color: falta > 0 ? '#f87171' : '#64748b', fontWeight: falta > 0 ? 800 : 500, fontSize: '0.92rem' }}>
      {fmtNum(falta)}
    </td>
    <td style={mono}>{row.Doc_Origem_Envio || row.Doc_Romaneio || '-'}</td>
    <td style={mono}>{row.NF_Retorno_Entrega || row.NF_Retorno || '-'}</td>
  </>;
}

// ═══════════════════════════════════════════════════════════════
export default function App() {
  // ─── Status / Data
  const [status, setStatus]   = useState({ ultima_atualizacao: 'Carregando...' });
  const [summary, setSummary] = useState(null);
  const [projetos, setProjetos] = useState([]);

  // ─── Multi-select Projetos
  const [selectedProjetos, setSelectedProjetos] = useState([]);
  const [projetoSearch, setProjetoSearch] = useState('');
  const [isProjOpen, setIsProjOpen] = useState(false);
  const [showAllChipçs, setShowAllChips] = useState(false);
  const projRef = useRef(null);

  // ─── Busca de Peça / Código / Descrição (Acionada apenas por OK ou Enter)
  const [pecaInput, setPecaInput] = useState('');
  const [appliedBusca, setAppliedBusca] = useState('');

  const handleApplyBusca = () => {
    setAppliedBusca(pecaInput.trim());
    setPage(1);
  };

  const handleClearBusca = () => {
    setPecaInput('');
    setAppliedBusca('');
    setPage(1);
  };

  // ─── Navigation
  const [activeTab, setActiveTab] = useState('unificado');
  const [fornecedores, setFornecedores] = useState([]);

  // ─── DiagnósticExecutivo
  const [diagData, setDiagData] = useState({ na_rua: [], compras_pendentes: [], sc_pendentes: [] });
  const [openExpanders, setOpenExpanders] = useState({});

  // ─── Table
  const [itemsData, setItemsData] = useState({ total: 0, items: [] });
  const [loadingItems, setLoadingItems] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(100);

  // ─── Sort
  const [sortColumn, setSortColumn] = useState('');
  const [sortDir, setSortDir] = useState('asc');

  // ─── Local filter (client-side, nserver request)
  const [localFilter, setLocalFilter] = useState('');

  // ─── Copy row feedback
  const [copiedRowIdx, setCopiedRowIdx] = useState(null);

  // ─── Sync
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState(null);

  // ─── Auto-refresh (every 5 minutes, silent)
  const [autoRefresh, setAutoRefresh] = useState(false);

  // ─── Fetch functions
  const fetchStatus = async () => {
    try { const r = await apiService.getStatus(); setStatus(r); } catch {}
  };
  const fetchProjetos = async () => {
    try { const r = await apiService.getProjetos(); setProjetos(r); } catch {}
  };
  const fetchSummary = async () => {
    try {
      const r = await apiService.getSummary(selectedProjetos, appliedBusca);
      setSummary(r);
    } catch {}
  };
  const fetchFornecedores = async () => {
    try {
      const r = await apiService.getFornecedores(selectedProjetos, appliedBusca);
      setFornecedores(r);
    } catch {}
  };
  const fetchDiagnosticoDetalhado = async () => {
    try {
      const r = await apiService.getDiagnosticoDetalhado(selectedProjetos, appliedBusca);
      setDiagData(r);
    } catch {}
  };
  const fetchItems = async () => {
    setLoadingItems(true);
    try {
      const r = await apiService.getItems({
        tab: activeTab,
        projetos: selectedProjetos,
        busca: appliedBusca,
        limit: pageSize === 0 ? 0 : pageSize,
        offset: pageSize === 0 ? 0 : (page - 1) * pageSize
      });
      setItemsData(r);
    } catch {} finally { setLoadingItems(false); }
  };



  // ────────────────────────────────────────────────────────────────

  // Close dropdowns on outside click
  useEffect(() => {
    function handler(e) {
      if (projRef.current && !projRef.current.contains(e.target)) setIsProjOpen(false);
      
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Reset sort + local filter when switching tabs
  useEffect(() => {
    setSortColumn('');
    setSortDir('asc');
    setLocalFilter('');
  }, [activeTab]);

  // Initial load
  useEffect(() => { fetchStatus(); fetchProjetos(); }, []);



  // Refetch on filter change
  useEffect(() => {
    fetchSummary();
    fetchFornecedores();
    fetchDiagnosticoDetalhado();
    setPage(1);
  }, [selectedProjetos, appliedBusca]);

  // Refetch items on tab / page / size change
  useEffect(() => {
    if (activeTab !== 'diagnostico' && activeTab !== 'pintura') fetchItems();
  }, [activeTab, selectedProjetos, appliedBusca, page, pageSize]);

  // Auto-refresh every 5 min (silent)
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(async () => {
      try {
        await fetch(`${API_BASE}/sync`, { method: 'POST' });
        fetchStatus();
        fetchSummary();
        fetchFornecedores();
        fetchDiagnosticoDetalhado();
        if (activeTab !== 'diagnostico' && activeTab !== 'pintura') fetchItems();
      } catch {}
    }, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [autoRefresh, activeTab, selectedProjetos, appliedBusca]);

  const handleSync = async () => {
    setIsSyncing(true);
    setSyncFeedback(null);
    try {
      const r    = await fetch(`${API_BASE}/sync`, { method: 'POST' });
      const data = await r.json();
      setSyncFeedback({
        type: data.atualizad? 'success' : 'info',
        msg:  data.atualizado
          ? `✅ Sincronizadààs ${data.ultima_atualizacao}`
          : `ℹ️ Dados já estãatualizados.`
      });
      fetchStatus(); fetchSummary(); fetchProjetos(); fetchFornecedores(); fetchDiagnosticoDetalhado();
      if (activeTab !== 'diagnostico' && activeTab !== 'pintura') fetchItems();
    } catch (err) {
      setSyncFeedback({ type: 'danger', msg: `Erro: ${err.message}` });
    } finally {
      setIsSyncing(false);
      setTimeout(() => setSyncFeedback(null), 5000);
    }
  };

  // ─── Sort logic
  const handleSort = (field) => {
    if (sortColumn === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortColumn(field); setSortDir('asc'); }
  };

  const sortedItems = useMemo(() => {
    if (!sortColumn) return itemsData.items;
    return [...itemsData.items].sort((a, b) => {
      const av = a[sortColumn], bv = b[sortColumn];
      const an = parseFloat(String(av || '').replace(/\./g, '').replace(',', '.'));
      const bn = parseFloat(String(bv || '').replace(/\./g, '').replace(',', '.'));
      const cmp = (!isNaN(an) && !isNaN(bn))
        ? an - bn
        : String(av || '').localeCompare(String(bv || ''), 'pt-BR', { sensitivity: 'base' });
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [itemsData.items, sortColumn, sortDir]);

  // ─── Local filter (client-side — nserver request)
  const displayItems = useMemo(() => {
    if (!localFilter.trim()) return sortedItems;
    const q = localFilter.trim().toUpperCase();
    return sortedItems.filter(row =>
      Object.values(row).some(v => String(v || '').toUpperCase().includes(q))
    );
  }, [sortedItems, localFilter]);

  // ─── Copy row tclipboard
  const copyRow = (row, idx) => {
    const cols = TAB_COLUMNS[activeTab] || UNIFIED_COLS;
    const text = cols.map(c => `${c.label}: ${row[c.field] || '-'}`).join(' | ');
    navigator.clipboard.writeText(text).catch(() => {});
    setCopiedRowIdx(idx);
    setTimeout(() => setCopiedRowIdx(null), 2000);
  };

  // ─── Project filter helpers
  const filteredProjetos = useMemo(() => {
    if (!projetoSearch.trim()) return projetos.slice(0, 100);
    const q = projetoSearch.trim().toUpperCase();
    return projetos.filter(p => p.nome.toUpperCase().includes(q)).slice(0, 150);
  }, [projetos, projetoSearch]);

  const toggleProjeto = (nome) =>
    setSelectedProjetos(prev => prev.includes(nome) ? prev.filter(p => p !== nome) : [...prev, nome]);

  const selectAllFiltered = () =>
    setSelectedProjetos(prev => Array.from(new Set([...prev, ...filteredProjetos.map(p => p.nome)])));

  const clearProjetos = () => { setSelectedProjetos([]); setProjetoSearch(''); setShowAllChips(false); };

  const toggleExpander = (id) =>
    setOpenExpanders(prev => ({ ...prev, [id]: !prev[id] }));

  const exportTableCSV = () => {
    if (!displayItems.length) return;
    const cols = TAB_COLUMNS[activeTab] || UNIFIED_COLS;
    const headers = cols.map(c => c.label);
    const rows = displayItems.map(row => {
      return cols.map(c => {
        const val = String(row[c.field] ?? '').replace(/"/g, '""');
        return '"' + val + '"';
      }).join(';');
    });
    const csv = '\uFEFF' + [headers.join(';'), ...rows].join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement('a'), { href: url });

    const sanitizeFilename = (str) => {
      return String(str || '')
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[/\\?%*:|"<>]/g, '_')
        .replace(/\s+/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '')
        .trim();
    };

    let obsNome = '';
    if (selectedProjetos.length === 1) {
      obsNome = sanitizeFilename(selectedProjetos[0]);
    } else if (selectedProjetos.length > 1) {
      obsNome = sanitizeFilename(selectedProjetos[0]) + `_e_mais_${selectedProjetos.length - 1}_projetos`;
    } else {
      const uniqueObs = [...new Set(displayItems.map(r => r.OBS_NORM).filter(Boolean))];
      if (uniqueObs.length === 1) {
        obsNome = sanitizeFilename(uniqueObs[0]);
      }
    }

    const tabItem = TABS.find(t => t.id === activeTab);
    const tabNameClean = sanitizeFilename(tabItem ? tabItem.label.replace(/^[^\w\s]+/, '').trim() : activeTab);
    const dataHoje = new Date().toISOString().slice(0, 10);
    const fileName = obsNome
      ? `${obsNome}_${tabNameClean}_${dataHoje}.csv`
      : `FCM_${tabNameClean}_${dataHoje}.csv`;

    a.setAttribute('download', fileName);
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  };

  const fmtNum = (v) => Number(v || 0).toLocaleString('pt-BR');

  const getStatusBadge = (s) => {
    const str = String(s || '');
    if (str.includes('2025'))
      return <span className="badge badge-info" style={{ background: 'rgba(99, 102, 241, 0.15)', color: '#a5b4fc', borderColor: 'rgba(99, 102, 241, 0.3)' }}>📅 {str}</span>;
    if (str.includes('100%') || (str.includes('Entregue') && !str.includes('Parcial') && !str.includes('Falta')))
      return <span className="badge badge-success">🟢 {str}</span>;
    if (str.includes('Tratamento'))
      return <span className="badge badge-info" style={{ background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', borderColor: 'rgba(56, 189, 248, 0.3)' }}>🔄 {str}</span>;
    if (str.includes('Falta') || str.includes('Gargalo') || str.includes('Produção') || str.includes('Producao'))
      return <span className="badge badge-danger">🔴 {str}</span>;
    if (str.includes('Não Enviado') || str.includes('Nao Enviado') || str.includes('Parcial') || str.includes('Aguardando'))
      return <span className="badge badge-warning">🟡 {str}</span>;
    return <span className="badge badge-info">🔵 {str}</span>;
  };

  const MAX_CHIPS    = 3;
  const visibleChipçs = showAllChipçs ? selectedProjetos : selectedProjetos.slice(0, MAX_CHIPS);
  const hiddenCount  = selectedProjetos.length - MAX_CHIPS;
  
  const currentCols  = TAB_COLUMNS[activeTab] || UNIFIED_COLS;

  const pctEnv       = summary && summary.tot_fab  > 0 ? Math.round((summary.tot_env / summary.tot_fab)  * 100) : 0;
  const pctRetEnv    = summary && summary.tot_env  > 0 ? Math.round((summary.tot_ret / summary.tot_env)  * 100) : 0;
  const totalPages   = pageSize === 0 ? 1 : Math.max(1, Math.ceil((itemsData?.total || 0) / (pageSize || 100)));

  // ════════════════════════════════════════════════════════════════
  return (
    <div className="app-container">

      {/* ── TOP NAVBAR ── */}
      <header className="top-nav">
        <div className="brand-section">
          <div className="brand-logo">🏭</div>
          <div className="brand-info">
            <h1>FCM Metálicos | Gestão Integrada</h1>
            <p>Controle Executivde Romaneio, PCP, Compras e TratamentExterno</p>
          </div>
        </div>

        <div className="header-actions">
          {syncFeedback && (
            <div className={`badge badge-${syncFeedback.type}`}>{syncFeedback.msg}</div>
          )}

          {/* Auto-refresh toggle */}
          <label className="auto-refresh-toggle" title="Sincronizar automaticamente a cada 5 minutos">
            <input type="checkbox" checked={autoRefresh} onChange={e => setAutoRefresh(e.target.checked)} />
            <span className="toggle-track"><span className="toggle-thumb" /></span>
            <Zap size={13} style={{ color: autoRefresh ? '#fbbf24' : '#64748b' }} />
            <span style={{ fontSize: '0.75rem', color: autoRefresh ? '#fbbf24' : '#64748b', fontWeight: 600, whiteSpace: 'nowrap' }}>
              Auto-sync
            </span>
          </label>

          <div className="status-indicator">
            <span className="status-dot" />
            <span>{status.ultima_atualizacao}</span>
          </div>

          <button className="btn btn-secondary btn-icon" onClick={() => window.print()} title="Imprimir / Salvar comPDF">
            <Printer size={15} />
          </button>

          <button className="btn btn-primary" onClick={handleSync} disabled={isSyncing} title="Lê as planilhas dOneDrive e Drive G: agora">
            <RefreshCw size={16} className={isSyncing ? 'animate-spin' : ''} />
            <span>{isSyncing ? 'Sincronizando...' : 'Sincronizar'}</span>
          </button>
        </div>
      </header>

      {/* ── FILTER BAR ── */}
      <section className="filter-bar">

        {/* MULTI-SELECT PROJETOS */}
        <div className="multiselect-wrapper" ref={projRef}>
          <div className="multiselect-box" onClick={() => setIsProjOpen(true)}>
            <Layers size={17} color="#94a3b8" style={{ marginRight: '4px', flexShrink: 0 }} />

            {visibleChipçs.map(proj => (
              <div key={proj} className="multiselect-chip">
                <span>{proj}</span>
                <button className="chip-remove-btn" onClick={e => { e.stopPropagation(); toggleProjeto(proj); }} title="Remover">
                  <X size={13} />
                </button>
              </div>
            ))}

            {!showAllChipçs && hiddenCount > 0 && (
              <button className="chipçs-more-btn" onClick={e => { e.stopPropagation(); setShowAllChips(true); }}>
                +{hiddenCount} mais
              </button>
            )}
            {showAllChipçs && selectedProjetos.length > MAX_CHIPS && (
              <button className="chipçs-more-btn" onClick={e => { e.stopPropagation(); setShowAllChips(false); }}>
                ↑ Recolher
              </button>
            )}

            <input
              type="text"
              className="multiselect-input"
              placeholder={selectedProjetos.length === 0
                ? 'Digite para pesquisar lotes/projetos (Ex: TAT, HILUX, 11/61)...'
                : 'Adicionar mais lotes...'}
              value={projetoSearch}
              onChange={e => { setProjetoSearch(e.target.value); setIsProjOpen(true); }}
              onFocus={() => setIsProjOpen(true)}
            />

            {selectedProjetos.length > 0 && (
              <>
                <span className="chipçs-count-badge">{selectedProjetos.length}</span>
                <button className="chip-remove-btn" onClick={e => { e.stopPropagation(); clearProjetos(); }} title="Limpar todos" style={{ marginLeft: 'auto' }}>
                  <X size={15} />
                </button>
              </>
            )}
            <ChevronsUpDown size={15} color="#64748b" style={{ marginLeft: '4px' }} />
          </div>

          {isProjOpen && (
            <div className="multiselect-dropdown">
              <div className="dropdown-toolbar">
                <span>{filteredProjetos.length} opções {projetoSearch ? `para "${projetoSearch}"` : 'disponíveis'}</span>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  {filteredProjetos.length > 0 && (
                    <button className="dropdown-toolbar-btn" onClick={selectAllFiltered}>✓ Marcar visíveis</button>
                  )}
                  {selectedProjetos.length > 0 && (
                    <button className="dropdown-toolbar-btn" onClick={clearProjetos} style={{ color: '#f87171' }}> Limpar todos</button>
                  )}
                  <button
                    className="dropdown-ok-btn"
                    onClick={() => { setIsProjOpen(false); setProjetoSearch(''); }}
                    title="Confirmar seleçãe fechar"
                  >
                    ✓ OK
                  </button>
                </div>
              </div>
              <div className="dropdown-list">
                {filteredProjetos.length === 0 ? (
                  <div style={{ padding: '16px', textAlign: 'center', color: '#64748b', fontSize: '0.82rem' }}>
                    Nenhum projetencontradpara "{projetoSearch}".
                  </div>
                ) : filteredProjetos.map(p => {
                  const isSel = selectedProjetos.includes(p.nome);
                  return (
                    <div key={p.nome} className={`dropdown-item ${isSel ? 'selected' : ''}`} onClick={() => toggleProjeto(p.nome)}>
                      <input type="checkbox" checked={isSel} onChange={() => {}} />
                      <span className="dropdown-item-title">{p.nome}</span>
                      <span className="dropdown-item-badge">{p.qtd_itens} itens</span>
                    </div>
                  );
                })}
              </div>
              <div className="dropdown-footer">
                <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                  <b>{selectedProjetos.length}</b> {selectedProjetos.length === 1 ? 'lote selecionado' : 'lotes selecionados'}
                </span>
                <button
                  className="dropdown-ok-btn"
                  onClick={() => { setIsProjOpen(false); setProjetoSearch(''); }}
                  title="Confirmar seleçãe fechar"
                >
                  ✓ OK
                </button>
              </div>
            </div>
          )}
        </div>

        {/* BUSCA DE PEÇA / CÓDIGO (DISPARADA POR OK OU ENTER) */}
        <div className="piece-search-wrapper" style={{ flex: 1.6, minWidth: '320px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            background: 'var(--bg-card, #131b2e)',
            border: '1px solid var(--border-color, #1e293b)',
            borderRadius: '10px',
            padding: '4px 14px',
            gap: '8px',
            height: '42px',
            boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.2)'
          }}>
            <Search size={16} color="#94a3b8" style={{ flexShrink: 0 }} />
            <input
              type="text"
              style={{
                background: 'transparent',
                border: 'none',
                outline: 'none',
                color: '#f8fafc',
                fontSize: '0.88rem',
                width: '100%',
                fontFamily: 'inherit'
              }}
              placeholder="Digite código, parte do meio ou descrição (Ex: DIVE.003, 46.PTA, TRAILBLAZER)..."
              value={pecaInput}
              onChange={e => setPecaInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleApplyBusca();
                }
              }}
            />
            {pecaInput && (
              <button
                type="button"
                onClick={handleClearBusca}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#94a3b8',
                  cursor: 'pointer',
                  padding: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  borderRadius: '4px'
                }}
                title="Limpar busca"
              >
                <X size={15} />
              </button>
            )}
          </div>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleApplyBusca}
            style={{
              padding: '0 22px',
              fontSize: '0.88rem',
              fontWeight: 700,
              height: '42px',
              borderRadius: '10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              whiteSpace: 'nowrap'
            }}
            title="Pesquisar este código ou texto"
          >
            OK
          </button>
        </div>

        {appliedBusca && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '0.8rem',
            color: '#38bdf8',
            background: 'rgba(56,189,248,0.12)',
            padding: '6px 12px',
            borderRadius: '8px',
            border: '1px solid rgba(56,189,248,0.25)',
            whiteSpace: 'nowrap'
          }}>
            <span>Filtro ativo: <b>"{appliedBusca}"</b></span>
            <button
              onClick={handleClearBusca}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#38bdf8',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                padding: '0 2px'
              }}
              title="Remover filtro"
            >
              <X size={14} />
            </button>
          </div>
        )}
      </section>

      {/* ── MAIN DASHBOARD ── */}
      <main className="main-content">

        {/* KPI CARDS */}
        {summary && (
          <div className="kpi-grid">
            <div className="kpi-card">
              <div className="kpi-header">
                <span className="kpi-title">1. Programad(OP)</span>
                <div className="kpi-icon-wrap" style={{ background: 'rgba(59,130,246,0.15)', color: '#60a5fa' }}><Factory size={18} /></div>
              </div>
              <div className="kpi-value">{fmtNum(summary.tot_op)}</div>
              <div className="kpi-subtext">
                {summary.falta_fab > 0
                  ? <span style={{ color: '#f87171' }}>Falta Fabr: {fmtNum(summary.falta_fab)} pçs</span>
                  : <span style={{ color: '#34d399' }}>100% Produzido</span>}
              </div>
              <div className="kpi-progress-bar"><div className="kpi-progress-fill" style={{ width: `${summary.pct_fab}%`, background: '#3b82f6' }} /></div>
            </div>

            <div className="kpi-card">
              <div className="kpi-header">
                <span className="kpi-title">2. FabricadInterno</span>
                <div className="kpi-icon-wrap" style={{ background: 'rgba(16,185,129,0.15)', color: '#34d399' }}><TrendingUp size={18} /></div>
              </div>
              <div className="kpi-value">{fmtNum(summary.tot_fab)}</div>
              <div className="kpi-subtext"><span style={{ color: '#34d399' }}>{summary.pct_fab}% Produzido</span></div>
              <div className="kpi-progress-bar"><div className="kpi-progress-fill" style={{ width: `${summary.pct_fab}%`, background: '#10b981' }} /></div>
            </div>

            <div className="kpi-card">
              <div className="kpi-header">
                <span className="kpi-title">3. EnviadPintura</span>
                <div className="kpi-icon-wrap" style={{ background: 'rgba(245,158,11,0.15)', color: '#fbbf24' }}><Truck size={18} /></div>
              </div>
              <div className="kpi-value">{fmtNum(summary.tot_env)}</div>
              <div className="kpi-subtext">
                {summary.falta_env > 0
                  ? <span style={{ color: '#fbbf24' }}>AguardandDespacho: {fmtNum(summary.falta_env)}</span>
                  : <span style={{ color: '#94a3b8' }}>Nenhum despachpendente</span>}
              </div>
              <div className="kpi-progress-bar">
                <div className="kpi-progress-fill" style={{ width: `${summary.tot_fab > 0 ? Math.min(100,(summary.tot_env/summary.tot_fab)*100) : 0}%`, background: '#f59e0b' }} />
              </div>
            </div>

            <div className="kpi-card">
              <div className="kpi-header">
                <span className="kpi-title">4. Retornad(Pronto)</span>
                <div className="kpi-icon-wrap" style={{ background: 'rgba(6,182,212,0.15)', color: '#38bdf8' }}><CheckCircle2 size={18} /></div>
              </div>
              <div className="kpi-value">{fmtNum(summary.tot_ret)}</div>
              <div className="kpi-subtext"><span style={{ color: '#38bdf8' }}>{summary.pct_ret}% da OP Pronto</span></div>
              <div className="kpi-progress-bar"><div className="kpi-progress-fill" style={{ width: `${summary.pct_ret}%`, background: '#06b6d4' }} /></div>
            </div>

            <div className="kpi-card" style={{ borderColor: summary.saldo_rua > 0 ? 'rgba(239,68,68,0.4)' : undefined, background: summary.saldo_rua > 0 ? 'rgba(239,68,68,0.05)' : undefined }}>
              <div className="kpi-header">
                <span className="kpi-title" style={{ color: summary.saldo_rua > 0 ? '#f87171' : undefined }}>5. Saldna Rua (Pintura)</span>
                <div className="kpi-icon-wrap" style={{ background: 'rgba(239,68,68,0.15)', color: '#f87171' }}><AlertTriangle size={18} /></div>
              </div>
              <div className="kpi-value" style={{ color: summary.saldo_rua > 0 ? '#f87171' : undefined }}>{fmtNum(summary.saldo_rua)}</div>
              <div className="kpi-subtext">
                {summary.saldo_rua > 0
                  ? <span style={{ color: '#f87171', fontWeight: 700 }}>🚨 Retidem Fornecedores</span>
                  : <span style={{ color: '#34d399' }}>Zerpendências externas</span>}
              </div>
            </div>

            <div className="kpi-card">
              <div className="kpi-header">
                <span className="kpi-title">6. Compras Externas</span>
                <div className="kpi-icon-wrap" style={{ background: 'rgba(139,92,246,0.15)', color: '#a78bfa' }}><ShoppingCart size={18} /></div>
              </div>
              <div className="kpi-value">{fmtNum(summary.tot_entregue)}</div>
              <div className="kpi-subtext"><span>Comprado: {fmtNum(summary.tot_comprado)} | Falta: {fmtNum(summary.saldo_compra)}</span></div>
              <div className="kpi-progress-bar"><div className="kpi-progress-fill" style={{ width: `${summary.pct_comp}%`, background: '#8b5cf6' }} /></div>
            </div>

            <div className="kpi-card">
              <div className="kpi-header">
                <span className="kpi-title">7. SC em Aberto</span>
                <div className="kpi-icon-wrap" style={{ background: 'rgba(236,72,153,0.15)', color: '#f472b6' }}><FileText size={18} /></div>
              </div>
              <div className="kpi-value">{fmtNum(summary.tot_sc)}</div>
              <div className="kpi-subtext"><span>{summary.qtd_itens_sc} solicitações sem pedido</span></div>
            </div>
          </div>
        )}

        {/* NAVIGATION TABS */}
        <nav className="tabs-navigation">
          {TABS.map(tab => {
            const Icon = tab.icon;
            return (
              <button key={tab.id} className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`} onClick={() => setActiveTab(tab.id)}>
                <Icon size={16} color={tab.color || undefined} />
                <span>{tab.label}</span>
                {tab.id === 'pintura' && <span className="tab-badge">{fornecedores.length}</span>}
              </button>
            );
          })}
        </nav>

        {/* ── ABA: RESUMO EXECUTIVO ── */}
        {activeTab === 'diagnostico' && summary && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

            {/* Status principal + barra de prontidã*/}
            <div style={{
              background: summary.saldo_rua === 0 && summary.falta_fab === 0 && summary.saldo_compra === 0
                ? 'linear-gradient(135deg,rgba(16,185,129,0.15),rgba(6,78,59,0.2))'
                : 'linear-gradient(135deg,rgba(239,68,68,0.15),rgba(127,29,29,0.2))',
              border: `1px solid ${summary.saldo_rua === 0 && summary.falta_fab === 0 && summary.saldo_compra === 0 ? 'rgba(16,185,129,0.4)' : 'rgba(239,68,68,0.4)'}`,
              borderRadius: '14px', padding: '24px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', flexWrap: 'wrap', gap: '10px' }}>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#f8fafc' }}>
                  📱 DiagnósticRápido: <span style={{ color: '#38bdf8' }}>{summary.projeto}</span>
                </h2>
                {summary.saldo_rua === 0 && summary.falta_fab === 0 && summary.falta_env === 0 && summary.saldo_compra === 0 && summary.tot_sc === 0
                  ? <span className="badge badge-success" style={{ fontSize: '0.85rem', padding: '6px 12px' }}>✅ PROJETO 100% PRONTO &amp; LIBERADO PARA MONTAGEM</span>
                  : summary.saldo_rua > 0
                    ? <span className="badge badge-warning" style={{ fontSize: '0.85rem', padding: '6px 12px' }}>⏳ AGUARDANDO RETORNO DE PINTURA ({fmtNum(summary.saldo_rua)} pçs na rua)</span>
                    : summary.falta_fab > 0
                      ? <span className="badge badge-danger"  style={{ fontSize: '0.85rem', padding: '6px 12px' }}>⚙️ GARGALO NA FÁBRICA ({fmtNum(summary.falta_fab)} pçs a produzir)</span>
                      : <span className="badge badge-success" style={{ fontSize: '0.85rem', padding: '6px 12px' }}>🚀 FLUXO NORMAL EM ANDAMENTO</span>
                }
              </div>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', color: '#cbd5e1', marginBottom: '6px', fontWeight: 600 }}>
                  <span>ProntidãMetálica Total:</span>
                  <span style={{ color: '#38bdf8' }}>{summary.pct_ret}% ({fmtNum(summary.tot_ret)} de {fmtNum(summary.tot_op)} peças prontas)</span>
                </div>
                <div style={{ width: '100%', height: '10px', background: '#0b1220', borderRadius: '999px', overflow: 'hidden' }}>
                  <div style={{ width: `${summary.pct_ret}%`, height: '100%', background: 'linear-gradient(90deg,#3b82f6,#10b981)', borderRadius: '999px', transition: 'width 0.6s' }} />
                </div>
              </div>
            </div>

            {/* ── FLUXOGRAMA DA JORNADA DAS PEÇAS ── */}
            <div className="table-card" style={{ padding: '20px' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#f8fafc', marginBottom: '18px' }}>
                🔄 Fluxde Produçã— Jornada das Peças
              </h3>
              <div className="flow-diagram">
                <div className="flow-step">
                  <div className="flow-step-icon" style={{ background: 'rgba(59,130,246,0.2)', border: '2px solid rgba(59,130,246,0.5)' }}>🏭</div>
                  <div className="flow-step-label">Fábrica</div>
                  <div className="flow-step-fraction">{fmtNum(summary.tot_fab)}<span>/{fmtNum(summary.tot_op)}</span></div>
                  <div className="flow-step-pct" style={{ color: summary.pct_fab >= 100 ? '#34d399' : '#60a5fa' }}>{summary.pct_fab}%</div>
                  <div className="flow-step-bar"><div className="flow-step-fill" style={{ width: `${summary.pct_fab}%`, background: '#3b82f6' }} /></div>
                </div>

                <div className="flow-connector" style={{ color: pctEnv >= 100 ? '#10b981' : '#f59e0b' }}>▶</div>

                <div className="flow-step">
                  <div className="flow-step-icon" style={{ background: 'rgba(245,158,11,0.2)', border: '2px solid rgba(245,158,11,0.5)' }}>🚚</div>
                  <div className="flow-step-label">Expedição</div>
                  <div className="flow-step-fraction">{fmtNum(summary.tot_env)}<span>/{fmtNum(summary.tot_fab)}</span></div>
                  <div className="flow-step-pct" style={{ color: summary.falta_env > 0 ? '#fbbf24' : '#34d399' }}>{pctEnv}%</div>
                  <div className="flow-step-bar"><div className="flow-step-fill" style={{ width: `${pctEnv}%`, background: '#f59e0b' }} /></div>
                </div>

                <div className="flow-connector" style={{ color: pctRetEnv >= 100 ? '#10b981' : '#ef4444' }}>▶</div>

                <div className="flow-step">
                  <div className="flow-step-icon" style={{ background: 'rgba(6,182,212,0.2)', border: '2px solid rgba(6,182,212,0.5)' }}>🎨</div>
                  <div className="flow-step-label">Pintura</div>
                  <div className="flow-step-fraction">{fmtNum(summary.tot_ret)}<span>/{fmtNum(summary.tot_env)}</span></div>
                  <div className="flow-step-pct" style={{ color: summary.saldo_rua > 0 ? '#f87171' : '#34d399' }}>{pctRetEnv}%</div>
                  <div className="flow-step-bar"><div className="flow-step-fill" style={{ width: `${pctRetEnv}%`, background: summary.saldo_rua > 0 ? '#ef4444' : '#06b6d4' }} /></div>
                </div>

                <div className="flow-connector" style={{ color: summary.pct_ret >= 100 ? '#10b981' : '#8b5cf6' }}>▶</div>

                <div className="flow-step">
                  <div className="flow-step-icon" style={{ background: 'rgba(16,185,129,0.2)', border: `2px solid ${summary.pct_ret >= 100 ? 'rgba(16,185,129,0.7)' : 'rgba(16,185,129,0.3)'}` }}>✅</div>
                  <div className="flow-step-label">Pronto</div>
                  <div className="flow-step-fraction">{fmtNum(summary.tot_ret)}<span>/{fmtNum(summary.tot_op)}</span></div>
                  <div className="flow-step-pct" style={{ color: summary.pct_ret >= 100 ? '#34d399' : '#38bdf8' }}>{summary.pct_ret}%</div>
                  <div className="flow-step-bar"><div className="flow-step-fill" style={{ width: `${summary.pct_ret}%`, background: '#10b981' }} /></div>
                </div>
              </div>
            </div>

            {/* OS 4 CARDS EXECUTIVOS */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeçat(auto-fit,minmax(240px,1fr))', gap: '16px' }}>
              <div className="kpi-card" style={{ background: '#131b2e', borderLeft: '4px solid #3b82f6' }}>
                <span style={{ fontSize: '0.75rem', color: '#8b949e', fontWeight: 700 }}>🏗️ ESTRUTURA METÁLICA (FÁBRICA)</span>
                <b style={{ fontSize: '1.25rem', color: '#58a6ff', margin: '6px 0', fontFamily: 'JetBrains Mono' }}>{fmtNum(summary.tot_fab)} / {fmtNum(summary.tot_op)} pçs</b>
                <span style={{ fontSize: '0.78rem', color: summary.falta_fab > 0 ? '#ff7b72' : '#3fb950', fontWeight: 600 }}>
                  {summary.falta_fab > 0 ? `⚠️ Falta fabricar: ${fmtNum(summary.falta_fab)} pçs` : '✅ 100% Produzidna fábrica'}
                </span>
              </div>
              <div className="kpi-card" style={{ background: '#131b2e', borderLeft: '4px solid #f59e0b' }}>
                <span style={{ fontSize: '0.75rem', color: '#8b949e', fontWeight: 700 }}>🚚 EXPEDIÇÃO / DESPACHO</span>
                <b style={{ fontSize: '1.25rem', color: '#d29922', margin: '6px 0', fontFamily: 'JetBrains Mono' }}>{fmtNum(summary.falta_env)} pçs</b>
                <span style={{ fontSize: '0.78rem', color: summary.falta_env > 0 ? '#d29922' : '#3fb950', fontWeight: 600 }}>
                  {summary.falta_env > 0 ? '⏳ Fabricadaguardandenvio' : '✅ Todas as peças fabricadas foram enviadas'}
                </span>
              </div>
              <div className="kpi-card" style={{ background: '#131b2e', borderLeft: '4px solid #06b6d4' }}>
                <span style={{ fontSize: '0.75rem', color: '#8b949e', fontWeight: 700 }}>🎨 TRATAMENTO / PINTURA</span>
                <b style={{ fontSize: '1.25rem', color: '#58a6ff', margin: '6px 0', fontFamily: 'JetBrains Mono' }}>{fmtNum(summary.tot_ret)} / {fmtNum(summary.tot_env)} pçs</b>
                <span style={{ fontSize: '0.78rem', color: summary.saldo_rua > 0 ? '#ff7b72' : '#3fb950', fontWeight: 600 }}>
                  {summary.saldo_rua > 0 ? `🚨 Na rua (pendente): ${fmtNum(summary.saldo_rua)} pçs` : '✅ 100% Retornadda pintura'}
                </span>
              </div>
              <div className="kpi-card" style={{ background: '#131b2e', borderLeft: '4px solid #8b5cf6' }}>
                <span style={{ fontSize: '0.75rem', color: '#8b949e', fontWeight: 700 }}>📦 COMPRAS &amp; SC EXTERNAS</span>
                <b style={{ fontSize: '1.25rem', color: '#58a6ff', margin: '6px 0', fontFamily: 'JetBrains Mono' }}>{fmtNum(summary.tot_entregue)} / {fmtNum(summary.tot_comprado)} pçs</b>
                <span style={{ fontSize: '0.78rem', color: (summary.saldo_compra > 0 || summary.tot_sc > 0) ? '#ff7b72' : '#3fb950', fontWeight: 600 }}>
                  {(summary.saldo_compra > 0 || summary.tot_sc > 0) ? `🚨 Falta entregar: ${fmtNum(summary.saldo_compra)} pçs (${summary.qtd_itens_sc} SCs)` : '✅ Compras 100% entregues'}
                </span>
              </div>
            </div>

            {/* PEÇAS NA RUA */}
            <div className="table-card" style={{ padding: '20px' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#f8fafc', marginBottom: '14px' }}>📍 Onde estãas peças na rua agora?</h3>
              {diagData.na_rua.length === 0 ? (
                <div className="badge badge-success" style={{ padding: '10px 16px', fontSize: '0.85rem' }}>🎉 Nenhuma peça na rua! 100% das peças enviadas para tratamentjá retornaram.</div>
              ) : diagData.na_rua.map((grupo, idx) => (
                <div key={idx} className="accordion-box">
                  <div className="accordion-header" onClick={() => toggleExpander(`rua_${idx}`)}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ color: '#f87171' }}>🔴</span>
                      <span><b>{grupo.fornecedor}</b>: {fmtNum(grupo.saldo_total)} peças pendentes ({grupo.qtd_itens} itens)</span>
                    </div>
                    <ChevronDown size={18} style={{ transform: openExpanders[`rua_${idx}`] ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }} />
                  </div>
                  {openExpanders[`rua_${idx}`] && (
                    <div className="accordion-content">
                      {grupo.itens.map((it, itIdx) => (
                        <div key={itIdx} className="accordion-item-row">
                          <div><b className="font-mono" style={{ color: '#f1f5f9', marginRight: '8px' }}>{it.COD_PECA}</b><span style={{ color: '#94a3b8' }}>({it.Descricao})</span></div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <span style={{ color: '#f87171', fontWeight: 700 }}>{fmtNum(it.Saldo_Pendente_Pintura)} pçs</span>
                            <span style={{ color: '#64748b' }}>| Romaneio: <code className="font-mono" style={{ color: '#cbd5e1' }}>{it.Doc_Romaneio}</code></span>
                            <span style={{ color: '#64748b' }}>(Envio: {it.Data_Envio})</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* COMPRAS E ORDENS PENDENTES */}
            <div className="table-card" style={{ padding: '20px' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#f8fafc', marginBottom: '14px' }}>📦 Compras e Ordens Pendentes</h3>
              {diagData.compras_pendentes.length === 0 && diagData.sc_pendentes.length === 0 ? (
                <div className="badge badge-success" style={{ padding: '10px 16px', fontSize: '0.85rem' }}>🎉 Compras e SC 100% em dia para este filtro!</div>
              ) : <>
                {diagData.compras_pendentes.length > 0 && (
                  <div className="accordion-box">
                    <div className="accordion-header" onClick={() => toggleExpander('compras_pend')}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span>🚚</span>
                        <span><b>Ordens de Compra Pendentes de Entrega</b> ({diagData.compras_pendentes.length} itens | {fmtNum(summary.saldo_compra)} pçs)</span>
                      </div>
                      <ChevronDown size={18} style={{ transform: openExpanders['compras_pend'] !== false ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }} />
                    </div>
                    {openExpanders['compras_pend'] !== false && (
                      <div className="accordion-content">
                        {diagData.compras_pendentes.map((cp, cpIdx) => (
                          <div key={cpIdx} className="accordion-item-row">
                            <div><b className="font-mono" style={{ color: '#f1f5f9', marginRight: '8px' }}>{cp.COD_PECA}</b><span style={{ color: '#94a3b8' }}>({cp.Descricao})</span></div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                              <span style={{ color: '#f87171', fontWeight: 700 }}>Falta {fmtNum(cp.Saldo_Falta_Entregar)} pçs</span>
                              <span style={{ color: '#64748b' }}>| Fornecedor: <b>{cp.Fornecedor}</b></span>
                              <span style={{ color: '#64748b' }}>| Previsão: {cp.Data_Fornecedor}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                {diagData.sc_pendentes.length > 0 && (
                  <div className="accordion-box">
                    <div className="accordion-header" onClick={() => toggleExpander('sc_pend')}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span>📋</span>
                        <span><b>Solicitações de Compra em Aberto</b> ({diagData.sc_pendentes.length} itens | {fmtNum(summary.tot_sc)} pçs)</span>
                      </div>
                      <ChevronDown size={18} style={{ transform: openExpanders['sc_pend'] !== false ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }} />
                    </div>
                    {openExpanders['sc_pend'] !== false && (
                      <div className="accordion-content">
                        {diagData.sc_pendentes.map((scItem, scIdx) => (
                          <div key={scIdx} className="accordion-item-row">
                            <div><b className="font-mono" style={{ color: '#f1f5f9', marginRight: '8px' }}>{scItem.COD_PECA}</b><span style={{ color: '#94a3b8' }}>({scItem.Descricao})</span></div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                              <span style={{ color: '#a78bfa', fontWeight: 700 }}>{fmtNum(scItem.Qtd_SC)} pçs</span>
                              <span style={{ color: '#64748b' }}>| SC N: <code className="font-mono" style={{ color: '#cbd5e1' }}>{scItem.Num_SC}</code></span>
                              <span style={{ color: '#64748b' }}>| Solicitante: {scItem.Solicitante}</span>
                              <span style={{ color: '#64748b' }}>| Nec: {scItem.Necessidade}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </>}
            </div>
          </div>
        )}

        {/* ── ABA: FORNECEDORES & PINTURA ── */}
        {activeTab === 'pintura' && (
          <div className="supplier-grid">
            {fornecedores.map(f => (
              <div key={f.fornecedor} className="supplier-card">
                <div className="supplier-card-header">
                  <span className="supplier-card-title">{f.fornecedor}</span>
                  {f.saldo_rua > 0
                    ? <span className="badge badge-danger">🚨 {fmtNum(f.saldo_rua)} na rua</span>
                    : <span className="badge badge-success">✅ Concluído</span>}
                </div>
                <div className="supplier-stats">
                  <div>
                    <div className="supplier-stat-val" style={{ color: '#94a3b8' }}>{fmtNum(f.enviado)}</div>
                    <div className="supplier-stat-lbl">Enviado</div>
                  </div>
                  <div>
                    <div className="supplier-stat-val" style={{ color: '#34d399' }}>{fmtNum(f.retornado)}</div>
                    <div className="supplier-stat-lbl">Retornado</div>
                  </div>
                  <div>
                    <div className="supplier-stat-val" style={{ color: f.saldo_rua > 0 ? '#f87171' : '#34d399' }}>{fmtNum(f.saldo_rua)}</div>
                    <div className="supplier-stat-lbl">SaldRua</div>
                  </div>
                </div>
                <div style={{ fontSize: '0.78rem', color: '#94a3b8', textAlign: 'right' }}>{f.itens} itens vinculados</div>
              </div>
            ))}
          </div>
        )}

        {/* ── TABELAS DINÂMICAS ── */}
        {activeTab !== 'diagnostico' && activeTab !== 'pintura' && (
          <div className="table-card">
            <div className="table-toolbar">
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
                <div className="table-title">
                  <Package size={18} color="#38bdf8" />
                  <span>Itens Encontrados: <b>{fmtNum(itemsData.total)}</b></span>
                  {localFilter && (
                    <span style={{ color: '#fbbf24', fontSize: '0.8rem', fontWeight: 600 }}>
                      — {displayItems.length} visíveis
                    </span>
                  )}
                </div>

                {/* Lines per page */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', color: '#94a3b8' }}>
                  <span>Linhas:</span>
                  <select
                    className="custom-select"
                    style={{ padding: '4px 10px', fontSize: '0.8rem', width: 'auto', minWidth: '110px', height: '34px' }}
                    value={pageSize}
                    onChange={e => { setPageSize(Number(e.target.value)); setPage(1); }}
                  >
                    <option value={50}>50 linhas</option>
                    <option value={100}>100 linhas</option>
                    <option value={200}>200 linhas</option>
                    <option value={500}>500 linhas</option>
                    <option value={0}>Todas ({fmtNum(itemsData.total)})</option>
                  </select>
                </div>

                {/* Local quick filter */}
                <div className="local-filter-wrap">
                  <Filter size={13} className="local-filter-icon" />
                  <input
                    type="text"
                    className="local-filter-input"
                    placeholder="Filtrar linhas visíveis..."
                    value={localFilter}
                    onChange={e => setLocalFilter(e.target.value)}
                  />
                  {localFilter && (
                    <button onClick={() => setLocalFilter('')} className="local-filter-clear">
                      <X size={12} />
                    </button>
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button className="btn btn-secondary" onClick={exportTableCSV} disabled={displayItems.length === 0} title="Exportar dados visíveis para planilha CSV/Excel">
                  <Download size={15} /><span>Exportar CSV</span>
                </button>
                <button className="btn btn-secondary" onClick={() => window.print()} title="Imprimir Relatório Formatado">
                  <Printer size={15} /><span>Imprimir Relatório</span>
                </button>
              </div>
            </div>

            {/* Cabeçalho exclusivo para Impressão */}
            <div className="print-report-header">
              <div className="print-header-top">
                <div>
                  <h2 className="print-report-title">FCM METÁLICOS - RELATÓRIO DE GESTÃO INTEGRADA</h2>
                  <div className="print-report-subtitle">
                    Visualização: <strong>{TABS.find(t => t.id === activeTab)?.label.replace(/^[^\w\s]+/, '').trim() || activeTab}</strong>
                    {selectedProjetos.length > 0 && (
                      <span> | Projeto: <strong>{selectedProjetos.join(', ')}</strong></span>
                    )}
                    {appliedBusca && (
                      <span> | Busca: <strong>"{appliedBusca}"</strong></span>
                    )}
                  </div>
                </div>
                <div className="print-report-meta">
                  <div>Emissão: <strong>{new Date().toLocaleDateString('pt-BR')} {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</strong></div>
                  <div>Itens Listados: <strong>{displayItems.length}</strong></div>
                </div>
              </div>
            </div>

            <div className="table-wrapper">
              {loadingItems ? (
                /* SKELETON LOADING */
                <div className="skeleton-table">
                  {Array.from({ length: 9 }).map((_, i) => (
                    <div key={i} className="skeleton-row" style={{ animationDelay: `${i * 0.06}s` }}>
                      <div className="skeleton-cell" style={{ width: '36px', flexShrink: 0 }} />
                      {[1, 1, 1.2, 2.5, 1, 1, 1].map((flex, j) => (
                        <div key={j} className="skeleton-cell" style={{ flex, animationDelay: `${(i * 7 + j) * 0.025}s` }} />
                      ))}
                      <div className="skeleton-cell" style={{ width: '36px', flexShrink: 0 }} />
                    </div>
                  ))}
                </div>
              ) : displayItems.length === 0 ? (
                <div style={{ padding: '50px', textAlign: 'center', color: '#64748b' }}>
                  <Package size={36} style={{ margin: '0 aut12px auto', opacity: 0.4 }} />
                  <p>{localFilter ? `Nenhum resultadpara "${localFilter}" nas linhas carregadas.` : 'Nenhum item encontradpara os filtros selecionados.'}</p>
                </div>
              ) : (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th style={{ width: '38px', textAlign: 'center', userSelect: 'none' }}>#</th>
                      {currentCols.map(col => (
                        <th
                          key={col.field}
                          className="sortable-th"
                          onClick={() => handleSort(col.field)}
                          style={{ minWidth: col.wide ? '220px' : undefined }}
                        >
                          <span style={{ display: 'inline-flex', alignItems: 'center' }}>
                            {col.label}
                            <SortIcon field={col.field} sortColumn={sortColumn} sortDir={sortDir} />
                          </span>
                        </th>
                      ))}
                      <th style={{ width: '38px' }} />
                    </tr>
                  </thead>
                  <tbody>
                    {displayItems.map((row, idx) => {
                      const highlight = getRowHighlight(row, activeTab);
                      const rowNum    = localFilter || pageSize === 0 ? idx + 1 : (page - 1) * pageSize + idx + 1;
                      const isCopied  = copiedRowIdx === idx;
                      return (
                        <tr key={idx} className={`data-row ${highlight}`}>
                          <td style={{ textAlign: 'center', color: '#475569', fontSize: '0.73rem', fontFamily: 'JetBrains Mono,monospace', userSelect: 'none' }}>
                            {rowNum}
                          </td>
                          <RowCells row={row} tab={activeTab} getStatusBadge={getStatusBadge} fmtNum={fmtNum} />
                          <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                            <button
                              className={`copy-row-btn${isCopied ? ' copied' : ''}`}
                              onClick={() => copyRow(row, idx)}
                              title="Copiar linha"
                            >
                              {isCopied ? <Check size={12} /> : <Copy size={12} />}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {/* PAGINATION */}
            <div className="pagination-bar">
              <div>
                {localFilter ? (
                  <span>Mostrand<b>{displayItems.length}</b> de {fmtNum(itemsData.total)} itens (filtrlocal ativo)</span>
                ) : pageSize === 0 ? (
                  <span>Mostrand<b>todas as {fmtNum(itemsData.total)}</b> linhas</span>
                ) : (
                  <span>Mostrand{(page - 1) * pageSize + 1}–{Math.min(page * pageSize, itemsData.total)} de {fmtNum(itemsData.total)} itens</span>
                )}
              </div>
              {pageSize > 0 && totalPages > 1 && !localFilter && (
                <div className="pagination-controls">
                  <button className="btn btn-secondary btn-icon" disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))} title="Página anterior">
                    <ChevronLeft size={16} />
                  </button>
                  <span style={{ fontWeight: 600, color: '#f8fafc', padding: '0 8px' }}>
                    Página {page} de {totalPages}
                  </span>
                  <button className="btn btn-secondary btn-icon" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} title="Próxima página">
                    <ChevronRight size={16} />
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
