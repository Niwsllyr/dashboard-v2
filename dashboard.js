import { processCSV } from "./csvReader.js?v=20260913a";
import { processBacklogFile } from "./backlogReader.js?v=20260912b";
import { renderCharts, renderBacklogCharts, renderPnrCharts } from "./charts.js?v=20260913c";
import { calculateMetrics, calculateOperationScore } from "./metrics.js?v=20260912b";
import { resolveCepsToCities } from "./cepresolver.js?v=20260912b";

// ------------------------------------------------------------
// Referências de DOM
// ------------------------------------------------------------
const csvInput = document.getElementById("csvInput");
const dsInput = document.getElementById("dsInput");
const backlogInput = document.getElementById("backlogInput");
const pnrInput = document.getElementById("pnrInput");
const manifestInput = document.getElementById("manifestInput");
const driverSelect = document.getElementById("driverSelect");
const citySelect = document.getElementById("citySelect");
const statusSelect = document.getElementById("statusSelect");
const driverSearch = document.getElementById("driverSearch");
const priorityFilter = document.getElementById("priorityFilter");
const cityTableBody = document.getElementById("cityTableBody");
const cepStatus = document.getElementById("cepStatus");
const btnGeneral = document.getElementById("btnGeneral");
const btnSLA = document.getElementById("btnSLA");
const btnDS = document.getElementById("btnDS");
const btnBacklog = document.getElementById("btnBacklog");
const btnPnr = document.getElementById("btnPnr");
const btnCity = document.getElementById("btnCity");
const btnManifest = document.getElementById("btnManifest");
const btnExportCsv = document.getElementById("btnExportCsv");
const btnClearRankingFilter = document.getElementById("btnClearRankingFilter");
const btnExportPdf = document.getElementById("btnExportPdf");
const btnExportTxt = document.getElementById("btnExportTxt");
const homePage = document.getElementById("homePage");
const cityPage = document.getElementById("cityPage");
const backlogPage = document.getElementById("backlogPage");
const backlogSearch = document.getElementById("backlogSearch");
const backlogStatusFilter = document.getElementById("backlogStatusFilter");
const backlogDriverFilter = document.getElementById("backlogDriverFilter");
const backlogCityFilter = document.getElementById("backlogCityFilter");
const btnBacklogDriverNotify = document.getElementById("btnBacklogDriverNotify");
const btnBacklogCityNotify = document.getElementById("btnBacklogCityNotify");
const backlogTableBody = document.getElementById("backlogTableBody");
const pnrPage = document.getElementById("pnrPage");
const pnrSearch = document.getElementById("pnrSearch");
const pnrScopeFilter = document.getElementById("pnrScopeFilter");
const pnrStatusFilter = document.getElementById("pnrStatusFilter");
const pnrDriverFilter = document.getElementById("pnrDriverFilter");
const pnrCityFilter = document.getElementById("pnrCityFilter");
const btnPnrCityNotify = document.getElementById("btnPnrCityNotify");
const pnrTableBody = document.getElementById("pnrTableBody");
const emptyState = document.getElementById("emptyState");
const stationSelect = document.getElementById("stationSelect");
const paletteSelect = document.getElementById("paletteSelect");
const themeToggle = document.getElementById("themeToggle");
const btnTvMode = document.getElementById("btnTvMode");
const goalInput = document.getElementById("goalInput");
const globalSearch = document.getElementById("globalSearch");
const globalSearchResults = document.getElementById("globalSearchResults");

// ------------------------------------------------------------
// Estado
// ------------------------------------------------------------
let slaRows = [];
let dsRows = [];
let backlogRows = [];
// Filtro de "dias parado" do Backlog — ativado clicando numa barra
// do gráfico de envelhecimento. null = sem filtro; 0-3 = o mesmo
// número usado por agingRank() (0=sem atraso, 1=1-3d, 2=3-6d, 3=+6d)
let backlogAgingFilter = null;
const BACKLOG_AGING_LABELS = ["Sem atraso", "1 a 3 dias", "3 a 6 dias", "Mais de 6 dias"];
// Mesma ideia pro PNR: filtro de urgência ativado clicando no
// gráfico de prazo (0=tranquilo, 1=atenção, 2=urgente, 3=vencido)
let pnrUrgencyFilter = null;
const PNR_URGENCY_LABELS = ["Tranquilo (+3 dias)", "Atenção (1 a 3 dias)", "Urgente (menos de 1 dia)", "Vencido"];
let pnrRows = [];
let manifestRows = [];
let cepToCity = {};
let driverContacts = {};
let stationSet = new Set();
let currentView = "GENERAL"; // GENERAL | SLA | DS | MANIFESTO
let activePage = "HOME"; // HOME | CITY | BACKLOG | PNR — qual página está visível agora (pro botão de Relatório saber o que exportar)
let sortState = { key: "pending", dir: "desc" };
const GOAL_STORAGE_KEY = "xpt_goal_v1";
let GOAL = 98;

// ------------------------------------------------------------
// Paleta de cores (troca visual completa do dashboard)
// ------------------------------------------------------------
const PALETTE_STORAGE_KEY = "xpt_palette_v1";
const THEME_STORAGE_KEY = "xpt_theme_v1";
let currentThemeMode = "dark";

const PALETTES = [
  { name: "🔴 Vermelho Operacional", h: 0,   s: 90, l: 45 },
  { name: "🔵 Azul Corporativo",     h: 212, s: 85, l: 48 },
  { name: "🟢 Verde Esmeralda",      h: 152, s: 65, l: 38 },
  { name: "🟣 Roxo Nightshade",      h: 268, s: 65, l: 48 },
  { name: "🟠 Laranja Vulcânico",    h: 22,  s: 90, l: 48 },
  { name: "🩵 Ciano Elétrico",        h: 190, s: 85, l: 45 },
  { name: "🩷 Rosa Choque",           h: 330, s: 85, l: 52 },
  { name: "🟡 Dourado Premium",      h: 45,  s: 80, l: 45 },
  { name: "⚪ Grafite Prata",        h: 210, s: 8,  l: 52 },
  { name: "🔷 Azul Marinho",         h: 222, s: 75, l: 32 },
  { name: "🟩 Verde Militar",        h: 95,  s: 35, l: 32 },
  { name: "🍒 Vermelho Cereja",      h: 350, s: 80, l: 42 },
  { name: "💠 Turquesa",             h: 175, s: 65, l: 40 },
  { name: "🟦 Índigo",               h: 245, s: 65, l: 48 },
  { name: "🌸 Coral",                h: 8,   s: 80, l: 55 },
  { name: "🔮 Ametista",             h: 280, s: 50, l: 48 },
  { name: "🌊 Petróleo",             h: 195, s: 55, l: 28 },
  { name: "🟫 Bronze",               h: 30,  s: 50, l: 38 },
  { name: "🌺 Magenta",              h: 310, s: 80, l: 48 },
  { name: "🌤️ Azul Céu",             h: 200, s: 85, l: 55 },
];

function hslToRgb(h, s, l) {
  s /= 100;
  l /= 100;
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)];
}

function rgbToHex(r, g, b) {
  return "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("");
}

function applyPalette(index) {
  const p = PALETTES[index] || PALETTES[0];
  const clamp = (v) => Math.max(0, Math.min(100, v));
  const shade = (h, s, l) => rgbToHex(...hslToRgb(h, s, l));

  const [r1, g1, b1] = hslToRgb(p.h, clamp(p.s + 10), clamp(p.l + 15));
  const [r2, g2, b2] = hslToRgb(p.h, p.s, p.l);
  const [r3, g3, b3] = hslToRgb(p.h, p.s, clamp(p.l - 12));
  const [r4, g4, b4] = hslToRgb(p.h, clamp(p.s - 5), clamp(p.l - 22));

  const bgSat = Math.min(p.s, 30);
  const root = document.documentElement.style;
  const isLight = currentThemeMode === "light";

  // Cor de destaque (accent) usada em botões, títulos, bordas e brilhos
  root.setProperty("--accent-1", rgbToHex(r1, g1, b1));
  root.setProperty("--accent-2", rgbToHex(r2, g2, b2));
  root.setProperty("--accent-3", rgbToHex(r3, g3, b3));
  root.setProperty("--accent-4", rgbToHex(r4, g4, b4));
  root.setProperty("--accent-rgb", `${r2},${g2},${b2}`);

  if (isLight) {
    // Tema claro: fundo branco com camada de cor bem mais forte, senão some sobre o branco
    root.setProperty("--bg", shade(p.h, Math.min(bgSat + 10, 40), 96));
    root.setProperty("--panel", shade(p.h, Math.min(bgSat + 8, 35), 99));
    root.setProperty("--panel-2", shade(p.h, Math.min(bgSat + 8, 35), 90));
    root.setProperty("--surface", shade(p.h, Math.min(bgSat + 8, 35), 96));
    root.setProperty("--surface-2", shade(p.h, Math.min(bgSat + 8, 35), 88));
    root.setProperty("--row-bg", shade(p.h, Math.min(bgSat + 5, 25), 98));
    root.setProperty("--row-alt", shade(p.h, Math.min(bgSat + 5, 25), 93));
    root.setProperty("--toast-bg", shade(p.h, Math.min(bgSat + 5, 25), 97));
    root.setProperty("--line", shade(p.h, Math.min(bgSat + 15, 45), 78));
    root.setProperty("--text", "#161616");
    root.setProperty("--text-dim", "#5c5c5c");
    root.setProperty("--glow-1", "0.28");
    root.setProperty("--glow-2", "0.20");
    root.setProperty("--hover-glow", "0.22");
    root.setProperty("--shadow-rgb", `${r4},${g4},${b4}`);
  } else {
    // Tema escuro: fundo preto com leve tonalidade da paleta escolhida
    root.setProperty("--bg", shade(p.h, bgSat, 3));
    root.setProperty("--panel", shade(p.h, bgSat, 9));
    root.setProperty("--panel-2", shade(p.h, bgSat, 5));
    root.setProperty("--surface", shade(p.h, bgSat, 7));
    root.setProperty("--surface-2", shade(p.h, bgSat, 11));
    root.setProperty("--row-bg", shade(p.h, bgSat, 6));
    root.setProperty("--row-alt", shade(p.h, bgSat, 5));
    root.setProperty("--toast-bg", shade(p.h, bgSat, 8));
    root.setProperty("--line", shade(p.h, Math.min(p.s, 40), 16));
    root.setProperty("--text", "#f5f5f5");
    root.setProperty("--text-dim", "#8f8f8f");
    root.setProperty("--glow-1", "0.10");
    root.setProperty("--glow-2", "0.08");
    root.setProperty("--hover-glow", "0.10");
    root.setProperty("--shadow-rgb", "0,0,0");
  }

  try {
    localStorage.setItem(PALETTE_STORAGE_KEY, String(index));
  } catch {
    // localStorage indisponível — segue sem salvar
  }
}

function applyTheme(mode) {
  currentThemeMode = mode === "light" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", currentThemeMode);
  if (themeToggle) {
    themeToggle.innerText = currentThemeMode === "light" ? "☀️ Claro" : "🌙 Escuro";
  }
  try {
    localStorage.setItem(THEME_STORAGE_KEY, currentThemeMode);
  } catch {
    // localStorage indisponível — segue sem salvar
  }
  applyPalette(Number(paletteSelect ? paletteSelect.value : 0) || 0);
  if (typeof refresh === "function") {
    try {
      refresh();
    } catch {
      // ainda sem dados carregados — nada a redesenhar
    }
  }
}

function initThemeToggle() {
  if (!themeToggle) return;
  let saved = "dark";
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === "light" || stored === "dark") saved = stored;
  } catch {
    // localStorage indisponível — usa o tema padrão
  }
  applyTheme(saved);
  themeToggle.addEventListener("click", () => {
    applyTheme(currentThemeMode === "dark" ? "light" : "dark");
  });
}

function initPaletteSelector() {
  if (!paletteSelect) return;
  paletteSelect.innerHTML = PALETTES.map((p, i) => `<option value="${i}">${p.name}</option>`).join("");

  let saved = 0;
  try {
    const stored = localStorage.getItem(PALETTE_STORAGE_KEY);
    if (stored !== null && PALETTES[Number(stored)]) saved = Number(stored);
  } catch {
    // localStorage indisponível — usa a paleta padrão
  }

  paletteSelect.value = String(saved);
  applyPalette(saved);

  paletteSelect.addEventListener("change", () => {
    applyPalette(Number(paletteSelect.value));
  });
}

initPaletteSelector();
initThemeToggle();

// ------------------------------------------------------------
// Meta de SLA configurável
// ------------------------------------------------------------
function initGoalInput() {
  if (!goalInput) return;
  try {
    const stored = localStorage.getItem(GOAL_STORAGE_KEY);
    if (stored !== null && !Number.isNaN(Number(stored))) GOAL = Number(stored);
  } catch {
    // localStorage indisponível — usa a meta padrão
  }
  goalInput.value = GOAL;
  goalInput.addEventListener("change", () => {
    const value = parseFloat(goalInput.value);
    if (Number.isNaN(value) || value <= 0 || value > 100) {
      goalInput.value = GOAL;
      return;
    }
    GOAL = value;
    try {
      localStorage.setItem(GOAL_STORAGE_KEY, String(GOAL));
    } catch {
      // localStorage indisponível — segue sem salvar
    }
    refresh();
  });
}
initGoalInput();

// ------------------------------------------------------------
// Histórico local (para comparação com período anterior)
// ------------------------------------------------------------
const HISTORY_STORAGE_KEY = "xpt_history_v1";
const HISTORY_MAX = 30;

function loadHistory() {
  try {
    const raw = localStorage.getItem(HISTORY_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveHistorySnapshot() {
  if (!hasAnyData()) return;
  const slaMetrics = calculateMetrics(slaRows, "SLA", cepToCity);
  const dsMetrics = calculateMetrics(dsRows, "DS", cepToCity);
  const opScore = calculateOperationScore(slaMetrics, dsMetrics);
  const today = new Date().toISOString().slice(0, 10);

  let history = loadHistory().filter((h) => h.date !== today);
  history.push({
    date: today,
    sla: parseFloat(slaMetrics.sla) || 0,
    ds: parseFloat(dsMetrics.sla) || 0,
    score: parseFloat(opScore.score) || 0,
    total: slaMetrics.total,
    onHold: slaMetrics.onHoldCount,
    driverSLA: slaMetrics.driverSLA.map((d) => ({ name: d.name, sla: parseFloat(d.sla) || 0, total: d.total })),
    citySLA: slaMetrics.citySLA.map((c) => ({ name: c.name, sla: parseFloat(c.sla) || 0, total: c.total })),
  });
  history.sort((a, b) => a.date.localeCompare(b.date));
  while (history.length > HISTORY_MAX) history.shift();

  try {
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(history));
  } catch {
    // armazenamento cheio ou indisponível — segue sem salvar histórico
  }
}

function getPreviousSnapshot() {
  const today = new Date().toISOString().slice(0, 10);
  const prevEntries = loadHistory().filter((h) => h.date < today);
  if (!prevEntries.length) return null;
  return prevEntries[prevEntries.length - 1];
}

function daysAgoLabel(dateStr) {
  const diff = Math.round((new Date() - new Date(dateStr + "T00:00:00")) / 86400000);
  if (diff <= 1) return "ontem";
  if (diff <= 7) return `${diff} dias atrás`;
  return `em ${dateStr}`;
}

// ------------------------------------------------------------
// Utilidades
// ------------------------------------------------------------
function slaClass(value) {
  const n = parseFloat(value);
  if (n >= 98) return "sla-green";
  if (n >= 97) return "sla-yellow";
  return "sla-red";
}

function extractDriverContacts(rows, fields) {
  if (!fields || !fields.length) return;
  const contactField =
    fields.find((f) => f.toString().trim().toLowerCase() === "driver phone") ||
    fields.find((f) => /driver.*phone/i.test(f.toString()));
  if (!contactField) return;
  rows.forEach((row) => {
    const driver = row["Driver Name"];
    const contact = row[contactField];
    if (driver && contact && !driverContacts[driver]) {
      driverContacts[driver] = contact;
    }
  });
}

function normalizePhone(value) {
  if (!value) return null;
  let digits = value.toString().replace(/\D/g, "");
  if (!digits) return null;
  digits = digits.replace(/^0+/, "");
  if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) return digits;
  if (digits.length === 10 || digits.length === 11) return "55" + digits;
  return null;
}

function firstName(value) {
  return value ? value.toString().trim().split(/\s+/)[0] : "";
}

function buildWhatsAppMessage(stat) {
  const slaFormatted = parseFloat(stat.sla).toFixed(1).replace(".", ",");
  return `*ATENÇÃO - ACOMPANHAMENTO DE DESEMPENHO*

${firstName(stat.name)},

Identificamos que foram atribuídos ${stat.total} pacotes a você.

Entregues: ${stat.delivered} pacotes
Pendentes: ${stat.pending} pacotes
SLA atual: ${slaFormatted}%

Precisamos da sua atenção para a realização das entregas e atualização dos pacotes pendentes.`;
}

function renderNotifyCell(stat) {
  const cell = document.createElement("td");
  const phone = normalizePhone(findDriverPhone(stat.name));

  if (!phone) {
    const message = buildWhatsAppMessage(stat);
    cell.appendChild(renderCopyReportButton(message, stat.name, "SLA/DS"));
    cell.appendChild(renderAddContactLink(stat.name, () => refresh()));
    return cell;
  }

  const button = document.createElement("button");
  button.className = "btn-notify";
  button.innerText = "📲 Notificar";
  button.onclick = () => {
    const message = buildWhatsAppMessage(stat);
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
    window.open(url, "_blank");
    toast(`Mensagem preparada para ${firstName(stat.name)}`, "good");
  };
  cell.appendChild(button);
  return cell;
}

const STATION_STORAGE_KEY = "xpt_station_v1";

// ------------------------------------------------------------
// Backlog (envelhecimento e tentativas dos pacotes pendentes)
// ------------------------------------------------------------
function extractHandlerName(raw) {
  return (raw || "").toString().replace(/^\[\d+\]\s*/, "").trim();
}

function agingRank(bucket) {
  const b = (bucket || "").toString();
  if (b.includes(">6")) return 3;
  if (b.includes("3 days, 6") || b.includes("3 dias, 6")) return 2;
  if (b.includes("1 day, 3") || b.includes("1 dia, 3")) return 1;
  return 0;
}

function agingLabel(rank) {
  return ["Sem atraso", "1 a 3 dias", "3 a 6 dias", "Mais de 6 dias"][rank] || "-";
}

function buildBacklogDriverMessage(driverName, rows) {
  const total = rows.length;
  const critical = rows.filter((r) => agingRank(r["LM Leg Aging"]) === 3).length;
  const noAttempt = rows.filter((r) => (parseFloat(r["No. Attempts"]) || 0) <= 0).length;
  return `*ATENÇÃO - PACOTES EM BACKLOG*

${firstName(driverName)},

Você tem ${total} pacote(s) parado(s) no backlog.

Mais de 6 dias parados: ${critical}
Sem nenhuma tentativa de entrega: ${noAttempt}

Precisamos da sua atenção para resolver esses pacotes o quanto antes.`;
}

function buildBacklogCitySummaryMessage(cityName, rows) {
  const total = rows.length;
  const critical = rows.filter((r) => agingRank(r["LM Leg Aging"]) === 3).length;
  const sorted = [...rows].sort((a, b) => (parseFloat(b["LM Leg Days"]) || 0) - (parseFloat(a["LM Leg Days"]) || 0));
  const lines = sorted.map(
    (r) => `- ${r["Shipment ID"] || "—"} | ${r.__driverName || "Sem responsável"} | ${r["LM Leg Days"] || "0"} dias`
  );

  return `Backlog em Aberto - ${cityName}

Total: ${total} pacote(s) parado(s), sendo ${critical} com mais de 6 dias

${lines.join("\n")}

Tratar o quanto antes para reduzir o backlog.`;
}

function computeBacklogSummary(rows) {
  let noAttempt = 0;
  let attempted = 0;
  let critical = 0;
  rows.forEach((r) => {
    const attempts = parseFloat(r["No. Attempts"]) || 0;
    if (attempts <= 0) noAttempt++;
    else attempted++;
    if (agingRank(r["LM Leg Aging"]) === 3) critical++;
  });
  return { total: rows.length, noAttempt, attempted, critical };
}

function populateSelectPreserve(selectEl, values, placeholderHtml) {
  if (!selectEl) return;
  const current = selectEl.value;
  selectEl.innerHTML = [placeholderHtml].concat(values.map((v) => `<option value="${v}">${v}</option>`)).join("");
  selectEl.value = values.includes(current) ? current : "";
}

function renderBacklogView() {
  const hasBacklog = backlogRows.length > 0;

  if (!hasBacklog) {
    document.getElementById("kpiBacklogTotal").innerText = "0";
    document.getElementById("kpiBacklogNoAttempt").innerText = "0";
    document.getElementById("kpiBacklogAttempted").innerText = "0";
    document.getElementById("kpiBacklogCritical").innerText = "0";
    backlogTableBody.innerHTML = `<tr><td colspan="7" class="table-empty">Nenhum arquivo de Backlog carregado ainda — envie o arquivo (.xlsx ou .csv) no topo da página.</td></tr>`;
    if (typeof renderBacklogCharts === "function") renderBacklogCharts([]);
    return;
  }

  const stationValue = stationSelect ? stationSelect.value : "";
  let rows = backlogRows;
  if (stationValue) {
    rows = rows.filter((r) => (r["Station Name"] || "").toString().trim() === stationValue);
  }

  // Cruza cada pacote com SLA/DS pra descobrir a cidade — primeiro
  // pelo próprio código BR, senão pela cidade mais comum do entregador
  const orderCityMap = buildOrderCityMap();
  const driverCityMap = buildDriverCityMap();
  rows = rows.map((r) => {
    const driverName = extractHandlerName(r["Latest User Name"]);
    const shipmentId = (r["Shipment ID"] || "").toString().trim();
    const city = findManualCity(driverName) || orderCityMap[shipmentId] || driverCityMap[driverName] || null;
    return { ...r, __driverName: driverName, __city: city };
  });

  const statuses = [...new Set(rows.map((r) => (r["Latest Status"] || "").toString().trim()).filter(Boolean))].sort();
  const drivers = [...new Set(rows.map((r) => r.__driverName).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, "pt-BR")
  );
  const cities = [...new Set(rows.map((r) => r.__city).filter(Boolean))].sort((a, b) => a.localeCompare(b, "pt-BR"));
  populateSelectPreserve(backlogStatusFilter, statuses, '<option value="">Todos Status</option>');
  populateSelectPreserve(backlogDriverFilter, drivers, '<option value="">Todos os Entregadores</option>');
  populateSelectPreserve(backlogCityFilter, cities, '<option value="">Todas as Cidades</option>');

  const statusValue = backlogStatusFilter ? backlogStatusFilter.value : "";
  const driverValue = backlogDriverFilter ? backlogDriverFilter.value : "";
  const cityValue = backlogCityFilter ? backlogCityFilter.value : "";
  if (statusValue) {
    rows = rows.filter((r) => (r["Latest Status"] || "").toString().trim() === statusValue);
  }
  if (driverValue) {
    rows = rows.filter((r) => r.__driverName === driverValue);
  }
  if (cityValue) {
    rows = rows.filter((r) => r.__city === cityValue);
  }
  if (backlogAgingFilter !== null) {
    rows = rows.filter((r) => agingRank(r["LM Leg Aging"]) === backlogAgingFilter);
  }

  // Aviso de que o filtro de dias está ativo, com botão pra limpar —
  // só aparece quando o filtro está ligado
  const agingFilterBadge = document.getElementById("backlogAgingFilterBadge");
  if (agingFilterBadge) {
    if (backlogAgingFilter !== null) {
      agingFilterBadge.style.display = "inline-flex";
      agingFilterBadge.querySelector(".backlog-aging-filter-text").textContent =
        `Filtrando: ${BACKLOG_AGING_LABELS[backlogAgingFilter]}`;
    } else {
      agingFilterBadge.style.display = "none";
    }
  }

  // Botão "Notificar Entregador" — só aparece com um entregador filtrado
  if (btnBacklogDriverNotify) {
    if (driverValue) {
      btnBacklogDriverNotify.style.display = "inline-flex";
      btnBacklogDriverNotify.onclick = async () => {
        const message = buildBacklogDriverMessage(driverValue, rows);
        const phone = normalizePhone(findDriverPhone(driverValue));
        if (!phone) {
          const ok = await copyTextToClipboard(message);
          if (ok) {
            toast(`${firstName(driverValue)} sem telefone — relatório de Backlog copiado, cole pra enviar manualmente`, "good");
          } else {
            toast("Não foi possível copiar automaticamente", "bad");
          }
          return;
        }
        const url = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
        window.open(url, "_blank");
        toast(`Mensagem de backlog preparada para ${firstName(driverValue)}`, "good");
      };
    } else {
      btnBacklogDriverNotify.style.display = "none";
    }
  }

  // Botão "Notificar Cidade" — só aparece com uma cidade filtrada
  if (btnBacklogCityNotify) {
    if (cityValue) {
      btnBacklogCityNotify.style.display = "inline-flex";
      btnBacklogCityNotify.onclick = async () => {
        const message = buildBacklogCitySummaryMessage(cityValue, rows);
        const ok = await copyTextToClipboard(message);
        if (ok) {
          toast(`Resumo de ${cityValue} copiado — já pode colar`, "good");
        } else {
          toast("Não foi possível copiar automaticamente", "bad");
        }
      };
    } else {
      btnBacklogCityNotify.style.display = "none";
    }
  }

  const summary = computeBacklogSummary(rows);
  animateNumber("kpiBacklogTotal", summary.total);
  animateNumber("kpiBacklogNoAttempt", summary.noAttempt);
  animateNumber("kpiBacklogAttempted", summary.attempted);
  animateNumber("kpiBacklogCritical", summary.critical);

  const criticalCard = document.getElementById("kpiBacklogCriticalCard");
  if (criticalCard) criticalCard.classList.toggle("kpi-flash", summary.critical > 0);

  renderBacklogCharts(rows);

  const term = (backlogSearch && backlogSearch.value ? backlogSearch.value : "").trim().toLowerCase();
  let filtered = rows;
  if (term) {
    filtered = filtered.filter((r) => {
      const shipment = (r["Shipment ID"] || "").toString().toLowerCase();
      const handler = r.__driverName.toLowerCase();
      return shipment.includes(term) || handler.includes(term);
    });
  }

  filtered = [...filtered].sort((a, b) => {
    const rankA = agingRank(a["LM Leg Aging"]);
    const rankB = agingRank(b["LM Leg Aging"]);
    if (rankA !== rankB) return rankB - rankA;
    return (parseFloat(b["LM Leg Days"]) || 0) - (parseFloat(a["LM Leg Days"]) || 0);
  });

  backlogTableBody.innerHTML = "";
  if (!filtered.length) {
    backlogTableBody.innerHTML = `<tr><td colspan="7" class="table-empty">Nenhum pacote encontrado</td></tr>`;
    return;
  }

  filtered.slice(0, 300).forEach((r) => {
    const rank = agingRank(r["LM Leg Aging"]);
    const rowClass = rank === 3 ? "sla-red" : rank === 2 ? "sla-yellow" : "sla-green";
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${r["Shipment ID"] || "—"}</td>
      <td>${r["Station Name"] || "—"}</td>
      <td>${r.__city || "—"}</td>
      <td>${r["Latest Status"] || "—"}</td>
      <td>${r.__driverName || "Sem responsável"}</td>
      <td class="${rowClass}">${r["LM Leg Days"] || "0"} (${agingLabel(rank)})</td>
      <td>${r["No. Attempts"] || "0"}</td>
    `;
    backlogTableBody.appendChild(tr);
  });
}

if (backlogSearch) {
  backlogSearch.addEventListener("input", renderBacklogView);
}
if (backlogStatusFilter) {
  backlogStatusFilter.addEventListener("change", renderBacklogView);
}
if (backlogDriverFilter) {
  backlogDriverFilter.addEventListener("change", renderBacklogView);
}
if (backlogCityFilter) {
  backlogCityFilter.addEventListener("change", renderBacklogView);
}
const btnLimparFiltroAging = document.getElementById("btnLimparFiltroAging");
if (btnLimparFiltroAging) {
  btnLimparFiltroAging.addEventListener("click", () => {
    backlogAgingFilter = null;
    renderBacklogView();
    toast("Filtro de dias removido", "info");
  });
}
const btnLimparFiltroPnrUrgencia = document.getElementById("btnLimparFiltroPnrUrgencia");
if (btnLimparFiltroPnrUrgencia) {
  btnLimparFiltroPnrUrgencia.addEventListener("click", () => {
    pnrUrgencyFilter = null;
    renderPnrView();
    toast("Filtro de urgência removido", "info");
  });
}

// ------------------------------------------------------------
// PNR (multas/penalidades) — prazo de SLA e valor em risco
// ------------------------------------------------------------
const OPEN_PNR_STATUSES = ["Created", "Assigned", "Pending Driver Reply", "Reviewing"];

function pnrUrgencyRank(diffDays) {
  if (diffDays === null || Number.isNaN(diffDays)) return 0;
  if (diffDays < 0) return 3;
  if (diffDays < 1) return 2;
  if (diffDays < 3) return 1;
  return 0;
}

function pnrDeadlineLabel(diffDays) {
  if (diffDays === null || Number.isNaN(diffDays)) return "Sem prazo";
  if (diffDays < 0) return `Vencido há ${Math.abs(diffDays).toFixed(1)}d`;
  return `${diffDays.toFixed(1)}d restantes`;
}

function normalizeNameForMatch(value) {
  return value
    .toString()
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove acentos
    .replace(/\s+/g, " "); // colapsa espaços duplicados
}

// ------------------------------------------------------------
// Caixinha própria de input (substitui window.prompt, que não
// funciona dentro do app — sempre retorna vazio no Electron)
// ------------------------------------------------------------
function askInputModal(title, placeholder) {
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.className = "xpt-modal-overlay";
    overlay.innerHTML = `
      <div class="xpt-modal">
        <div class="xpt-modal-title">${title}</div>
        <input type="text" class="xpt-modal-input" placeholder="${placeholder || ""}">
        <div class="xpt-modal-actions">
          <button type="button" class="xpt-modal-cancel">Cancelar</button>
          <button type="button" class="xpt-modal-ok">Salvar</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    const input = overlay.querySelector(".xpt-modal-input");
    input.focus();

    function fechar(valor) {
      document.body.removeChild(overlay);
      resolve(valor);
    }

    overlay.querySelector(".xpt-modal-cancel").onclick = () => fechar(null);
    overlay.querySelector(".xpt-modal-ok").onclick = () => fechar(input.value);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") fechar(input.value);
      if (e.key === "Escape") fechar(null);
    });
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) fechar(null);
    });
  });
}

// ------------------------------------------------------------
// Contatos cadastrados manualmente (quando o motorista não
// aparece em nenhum SLA/DS carregado) — persistem no navegador
// ------------------------------------------------------------
const MANUAL_CONTACTS_KEY = "xpt_manual_contacts_v1";
let manualContacts = {};
try {
  manualContacts = JSON.parse(localStorage.getItem(MANUAL_CONTACTS_KEY) || "{}");
} catch {
  manualContacts = {};
}

function saveManualContact(name, phone) {
  manualContacts[name] = phone;
  try {
    localStorage.setItem(MANUAL_CONTACTS_KEY, JSON.stringify(manualContacts));
  } catch {
    // localStorage indisponível — vale só para esta sessão
  }
  if (window.electronAPI && window.electronAPI.salvarContatoManual) {
    window.electronAPI.salvarContatoManual(name, phone);
  }
}

function findDriverPhone(name) {
  if (!name) return null;
  if (manualContacts[name]) return manualContacts[name];
  if (driverContacts[name]) return driverContacts[name];

  const target = normalizeNameForMatch(name);
  const foundManual = Object.keys(manualContacts).find((k) => normalizeNameForMatch(k) === target);
  if (foundManual) return manualContacts[foundManual];
  const found = Object.keys(driverContacts).find((k) => normalizeNameForMatch(k) === target);
  return found ? driverContacts[found] : null;
}

// Quando o entregador não tem telefone cadastrado, esse botão copia
// pra área de transferência um relatório em texto (BR, nome do
// entregador, e o resto das informações daquela análise) — pra
// poder colar e mandar manualmente por fora, já que não dá pra abrir
// o WhatsApp direto sem número.
function renderCopyReportButton(message, driverName, kind) {
  const button = document.createElement("button");
  button.className = "btn-notify btn-copy-report";
  button.type = "button";
  button.innerText = "📋 Copiar relatório";
  button.title = `${driverName} não tem telefone cadastrado — copia um relatório de ${kind} pra enviar manualmente`;
  button.onclick = async (event) => {
    event.stopPropagation();
    const ok = await copyTextToClipboard(message);
    if (ok) {
      toast(`Relatório de ${kind} copiado — cole pra enviar manualmente pra ${firstName(driverName)}`, "good");
    } else {
      toast("Não foi possível copiar automaticamente", "bad");
    }
  };
  return button;
}

function renderAddContactLink(driverName, onSaved) {
  const wrap = document.createElement("span");
  wrap.className = "no-contact add-contact-link";
  wrap.innerText = "+ Adicionar contato";
  wrap.title = "Cadastrar telefone manualmente para este entregador";
  wrap.onclick = async () => {
    const input = await askInputModal(`Telefone de ${driverName}`, "DDD + número, só dígitos");
    if (!input) return;
    const digits = input.toString().replace(/\D/g, "");
    if (digits.length < 10) {
      toast("Telefone inválido — inclua DDD, só números", "bad");
      return;
    }
    saveManualContact(driverName, digits);
    toast(`Contato de ${firstName(driverName)} salvo`, "good");
    if (typeof onSaved === "function") onSaved();
  };
  return wrap;
}

// ------------------------------------------------------------
// Cidade cadastrada manualmente (mesmo princípio dos contatos)
// ------------------------------------------------------------
const MANUAL_CITIES_KEY = "xpt_manual_cities_v1";
let manualCities = {};
try {
  manualCities = JSON.parse(localStorage.getItem(MANUAL_CITIES_KEY) || "{}");
} catch {
  manualCities = {};
}

function saveManualCity(name, city) {
  manualCities[name] = city;
  try {
    localStorage.setItem(MANUAL_CITIES_KEY, JSON.stringify(manualCities));
  } catch {
    // localStorage indisponível — vale só para esta sessão
  }
  if (window.electronAPI && window.electronAPI.salvarCidadeManual) {
    window.electronAPI.salvarCidadeManual(name, city);
  }
}

function findManualCity(name) {
  if (!name) return null;
  if (manualCities[name]) return manualCities[name];
  const target = normalizeNameForMatch(name);
  const found = Object.keys(manualCities).find((k) => normalizeNameForMatch(k) === target);
  return found ? manualCities[found] : null;
}

// Dentro do app, o arquivo salvo pelo Electron é quem manda —
// mescla por cima do que já tinha vindo do navegador
if (window.electronAPI && window.electronAPI.carregarDadosManuais) {
  window.electronAPI
    .carregarDadosManuais()
    .then((dados) => {
      if (dados && dados.contatos) {
        manualContacts = { ...manualContacts, ...dados.contatos };
      }
      if (dados && dados.cidades) {
        manualCities = { ...manualCities, ...dados.cidades };
      }
    })
    .catch(() => {
      // segue só com o que já tem do navegador
    });
}

function renderCityCell(driverName, city, onSaved) {
  if (city) {
    const span = document.createElement("span");
    span.innerText = city;
    return span;
  }
  const wrap = document.createElement("span");
  wrap.className = "no-contact add-contact-link";
  wrap.innerText = "+ Definir cidade";
  wrap.title = "Cadastrar a cidade manualmente para este entregador";
  wrap.onclick = async () => {
    const input = await askInputModal(`Cidade de ${driverName}`, "ex: Valença - RJ");
    if (!input || !input.trim()) return;
    saveManualCity(driverName, input.trim());
    toast(`Cidade de ${firstName(driverName)} salva`, "good");
    if (typeof onSaved === "function") onSaved();
  };
  return wrap;
}

function buildPnrMessage(pnr) {
  const value = parseFloat(pnr["PNR Order Value"]) || 0;
  const valueFormatted = value.toFixed(2).replace(".", ",");
  return `Atenção urgente: ${pnr.__driverName}

PNR: ${pnr["SPXTN"] || "—"}

Valor da PNR: R$ ${valueFormatted}

Tratar imediatamente para evitar desconto/perda.`;
}

function renderPnrNotifyCell(pnr) {
  const cell = document.createElement("td");
  const phone = normalizePhone(findDriverPhone(pnr.__driverName));
  if (!phone) {
    const message = buildPnrMessage(pnr);
    cell.appendChild(renderCopyReportButton(message, pnr.__driverName, "PNR"));
    cell.appendChild(renderAddContactLink(pnr.__driverName, () => renderPnrView()));
    return cell;
  }
  const button = document.createElement("button");
  button.className = "btn-notify";
  button.innerText = "📲 Notificar PNR";
  button.onclick = () => {
    const message = buildPnrMessage(pnr);
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
    window.open(url, "_blank");
    toast(`Mensagem de PNR preparada para ${firstName(pnr.__driverName)}`, "good");
  };
  cell.appendChild(button);
  return cell;
}

function buildOrderCityMap() {
  const map = {};
  [...slaRows, ...dsRows].forEach((r) => {
    const orderId = (r["Order ID"] || "").toString().trim();
    if (!orderId || map[orderId]) return;
    const city = cepToCity[r["Postal Code"]];
    if (city) map[orderId] = city;
  });
  return map;
}

function buildDriverCityMap() {
  const counts = {};
  [...slaRows, ...dsRows].forEach((r) => {
    const driver = (r["Driver Name"] || "").toString().trim();
    if (!driver) return;
    const city = cepToCity[r["Postal Code"]];
    if (!city) return;
    if (!counts[driver]) counts[driver] = {};
    counts[driver][city] = (counts[driver][city] || 0) + 1;
  });
  const map = {};
  Object.entries(counts).forEach(([driver, cityCounts]) => {
    let best = null;
    let bestCount = 0;
    Object.entries(cityCounts).forEach(([city, count]) => {
      if (count > bestCount) {
        best = city;
        bestCount = count;
      }
    });
    map[driver] = best;
  });
  return map;
}

let lastPnrCityRows = [];
let lastPnrCityName = "";

function renderPnrView() {
  const hasPnr = pnrRows.length > 0;

  if (!hasPnr) {
    document.getElementById("kpiPnrTotal").innerText = "0";
    document.getElementById("kpiPnrOpen").innerText = "0";
    document.getElementById("kpiPnrValue").innerText = "R$ 0";
    document.getElementById("kpiPnrUrgent").innerText = "0";
    pnrTableBody.innerHTML = `<tr><td colspan="7" class="table-empty">Nenhum arquivo de PNR carregado ainda — envie o arquivo (.csv) no topo da página.</td></tr>`;
    if (typeof renderPnrCharts === "function") renderPnrCharts([]);
    return;
  }

  const now = Date.now();
  const stationValue = stationSelect ? stationSelect.value : "";
  const orderCityMap = buildOrderCityMap();
  const driverCityMap = buildDriverCityMap();
  let rows = pnrRows
    .filter((r) => !stationValue || (r["Station"] || "").toString().trim() === stationValue)
    .map((r) => {
      const driverName = extractHandlerName(r["Driver"]);
      const deadline = r["SLA Deadline"] ? new Date(r["SLA Deadline"].toString().replace(" ", "T")) : null;
      const diffDays = deadline && !Number.isNaN(deadline.getTime()) ? (deadline.getTime() - now) / 86400000 : null;
      const orderCity = orderCityMap[(r["SPXTN"] || "").toString().trim()];
      const city = findManualCity(driverName) || orderCity || driverCityMap[driverName] || null;
      return {
        ...r,
        __driverName: driverName,
        __diffDays: diffDays,
        __status: (r["Status"] || "").toString().trim(),
        __city: city,
      };
    });

  const cities = [...new Set(rows.map((r) => r.__city).filter(Boolean))].sort((a, b) => a.localeCompare(b, "pt-BR"));
  populateSelectPreserve(pnrCityFilter, cities, '<option value="">Todas as Cidades</option>');
  const cityValue = pnrCityFilter ? pnrCityFilter.value : "";
  if (cityValue) rows = rows.filter((r) => r.__city === cityValue);

  const statuses = [...new Set(rows.map((r) => r.__status).filter(Boolean))].sort();
  const drivers = [...new Set(rows.map((r) => r.__driverName).filter(Boolean))].sort((a, b) => a.localeCompare(b, "pt-BR"));
  populateSelectPreserve(pnrStatusFilter, statuses, '<option value="">Todos Status</option>');
  populateSelectPreserve(pnrDriverFilter, drivers, '<option value="">Todos os Entregadores</option>');

  const openRows = rows.filter((r) => OPEN_PNR_STATUSES.includes(r.__status));
  const totalValueAtRisk = openRows.reduce((sum, r) => sum + (parseFloat(r["PNR Order Value"]) || 0), 0);
  const urgentCount = openRows.filter((r) => pnrUrgencyRank(r.__diffDays) >= 2).length;

  lastPnrCityRows = openRows;
  lastPnrCityName = cityValue;
  if (btnPnrCityNotify) btnPnrCityNotify.disabled = !cityValue || openRows.length === 0;

  animateNumber("kpiPnrTotal", rows.length);
  animateNumber("kpiPnrOpen", openRows.length);
  document.getElementById("kpiPnrValue").innerText = `R$ ${totalValueAtRisk.toFixed(2).replace(".", ",")}`;
  animateNumber("kpiPnrUrgent", urgentCount);

  const urgentCard = document.getElementById("kpiPnrUrgentCard");
  if (urgentCard) urgentCard.classList.toggle("kpi-flash", urgentCount > 0);

  renderPnrCharts(openRows);

  const scopeValue = pnrScopeFilter ? pnrScopeFilter.value : "open";
  let filtered = scopeValue === "all" ? rows : openRows;

  const statusValue = pnrStatusFilter ? pnrStatusFilter.value : "";
  const driverValue = pnrDriverFilter ? pnrDriverFilter.value : "";
  if (statusValue) filtered = filtered.filter((r) => r.__status === statusValue);
  if (driverValue) filtered = filtered.filter((r) => r.__driverName === driverValue);
  if (pnrUrgencyFilter !== null) {
    filtered = filtered.filter((r) => pnrUrgencyRank(r.__diffDays) === pnrUrgencyFilter);
  }

  const pnrUrgencyFilterBadge = document.getElementById("pnrUrgencyFilterBadge");
  if (pnrUrgencyFilterBadge) {
    if (pnrUrgencyFilter !== null) {
      pnrUrgencyFilterBadge.style.display = "inline-flex";
      pnrUrgencyFilterBadge.querySelector(".pnr-urgency-filter-text").textContent =
        `Filtrando: ${PNR_URGENCY_LABELS[pnrUrgencyFilter]}`;
    } else {
      pnrUrgencyFilterBadge.style.display = "none";
    }
  }

  const term = (pnrSearch && pnrSearch.value ? pnrSearch.value : "").trim().toLowerCase();
  if (term) {
    filtered = filtered.filter((r) => {
      const code = (r["SPXTN"] || "").toString().toLowerCase();
      return code.includes(term) || r.__driverName.toLowerCase().includes(term);
    });
  }

  filtered = [...filtered].sort((a, b) => {
    const rankA = pnrUrgencyRank(a.__diffDays);
    const rankB = pnrUrgencyRank(b.__diffDays);
    if (rankA !== rankB) return rankB - rankA;
    return (parseFloat(b["PNR Order Value"]) || 0) - (parseFloat(a["PNR Order Value"]) || 0);
  });

  pnrTableBody.innerHTML = "";
  if (!filtered.length) {
    pnrTableBody.innerHTML = `<tr><td colspan="7" class="table-empty">Nenhuma PNR encontrada</td></tr>`;
    return;
  }

  filtered.slice(0, 300).forEach((r) => {
    const rank = pnrUrgencyRank(r.__diffDays);
    const rowClass = rank === 3 ? "sla-red" : rank === 2 ? "sla-yellow" : rank === 1 ? "sla-yellow" : "sla-green";
    const value = parseFloat(r["PNR Order Value"]) || 0;
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${r["SPXTN"] || "—"}</td>
      <td>${r.__driverName || "Sem entregador"}</td>
      <td class="pnr-city-cell"></td>
      <td>R$ ${value.toFixed(2).replace(".", ",")}</td>
      <td class="${rowClass}">${pnrDeadlineLabel(r.__diffDays)}</td>
      <td>${r.__status || "—"}</td>
    `;
    tr.querySelector(".pnr-city-cell").appendChild(renderCityCell(r.__driverName, r.__city, () => renderPnrView()));
    tr.appendChild(renderPnrNotifyCell(r));
    pnrTableBody.appendChild(tr);
  });
}

function buildPnrCitySummaryMessage(cityName, rows) {
  const total = rows.length;
  const totalValue = rows.reduce((sum, r) => sum + (parseFloat(r["PNR Order Value"]) || 0), 0);
  const sorted = [...rows].sort((a, b) => (parseFloat(b["PNR Order Value"]) || 0) - (parseFloat(a["PNR Order Value"]) || 0));
  const lines = sorted.map((r) => {
    const value = (parseFloat(r["PNR Order Value"]) || 0).toFixed(2).replace(".", ",");
    return `- ${r["SPXTN"] || "—"} | ${r.__driverName || "Sem entregador"} | R$ ${value}`;
  });

  return `PNR em Aberto - ${cityName}

Total: ${total} PNR em aberto, somando R$ ${totalValue.toFixed(2).replace(".", ",")}

${lines.join("\n")}

Tratar imediatamente para evitar desconto/perda.`;
}

if (btnPnrCityNotify) {
  btnPnrCityNotify.addEventListener("click", async () => {
    if (!lastPnrCityName || !lastPnrCityRows.length) {
      toast("Selecione uma cidade com PNR em aberto primeiro", "warn");
      return;
    }
    const message = buildPnrCitySummaryMessage(lastPnrCityName, lastPnrCityRows);
    const ok = await copyTextToClipboard(message);
    if (ok) {
      toast(`Resumo de ${lastPnrCityName} copiado — já pode colar`, "good");
    } else {
      toast("Não foi possível copiar automaticamente", "bad");
    }
  });
}

if (pnrCityFilter) pnrCityFilter.addEventListener("change", renderPnrView);

if (pnrSearch) pnrSearch.addEventListener("input", renderPnrView);
if (pnrScopeFilter) pnrScopeFilter.addEventListener("change", renderPnrView);
if (pnrStatusFilter) pnrStatusFilter.addEventListener("change", renderPnrView);
if (pnrDriverFilter) pnrDriverFilter.addEventListener("change", renderPnrView);

function refreshStationSet() {
  stationSet = new Set();
  [...slaRows, ...dsRows, ...manifestRows].forEach((row) => {
    const value = row["Current Station"];
    if (value && value.toString().trim()) stationSet.add(value.toString().trim());
  });
}

function refreshStationSelect() {
  if (!stationSelect) return;
  const stations = [...stationSet].sort((a, b) => a.localeCompare(b, "pt-BR"));
  const current = stationSelect.value;

  if (!stations.length) {
    stationSelect.innerHTML = "";
    stationSelect.classList.remove("show");
    return;
  }

  const options = ['<option value="">🏢 Todos os XPT</option>'].concat(
    stations.map((s) => `<option value="${s}">🏢 ${s}</option>`)
  );
  stationSelect.innerHTML = options.join("");

  let preferred = current;
  if (!stations.includes(preferred)) {
    preferred = "";
    try {
      const stored = localStorage.getItem(STATION_STORAGE_KEY);
      if (stored && stations.includes(stored)) preferred = stored;
    } catch {
      // localStorage indisponível — usa "Todos os XPT"
    }
  }
  stationSelect.value = preferred;
  stationSelect.classList.add("show");
}

function detectDuplicates(rows) {
  const seen = new Set();
  let dupCount = 0;
  rows.forEach((r) => {
    const id = (r["Order ID"] || "").toString().trim();
    if (!id) return;
    if (seen.has(id)) dupCount++;
    else seen.add(id);
  });
  return dupCount;
}

// ------------------------------------------------------------
// Toast (feedback não intrusivo)
// ------------------------------------------------------------
let toastTimer = null;
function toast(message, tone = "info") {
  let el = document.getElementById("toast");
  if (!el) {
    el = document.createElement("div");
    el.id = "toast";
    document.body.appendChild(el);
  }
  el.className = `toast toast-${tone} show`;
  el.innerText = message;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 3200);
}

// Exposto no window pro app Electron poder chamar de fora do módulo
window.toast = toast;

// ------------------------------------------------------------
// Resolução de CEP -> Cidade
// ------------------------------------------------------------
async function resolveCeps() {
  const allCeps = [...slaRows.map((r) => r["Postal Code"]), ...dsRows.map((r) => r["Postal Code"]), ...manifestRows.map((r) => r["Postal Code"])].filter(Boolean);
  if (!allCeps.length) return;

  const total = new Set(allCeps).size;
  cepStatus.style.display = "inline-flex";
  cepStatus.innerText = `Resolvendo CEPs... 0/${total}`;

  const resolved = await resolveCepsToCities(allCeps, (done, count) => {
    cepStatus.innerText = `Resolvendo CEPs... ${done}/${count}`;
  });

  cepToCity = { ...cepToCity, ...resolved };
  cepStatus.innerText = `✓ ${Object.keys(cepToCity).length} CEPs resolvidos`;
  setTimeout(() => (cepStatus.style.display = "none"), 2200);
  refreshCitySelect();
}

function refreshCitySelect() {
  const cities = [...new Set(Object.values(cepToCity))]
    .filter((c) => c && c !== "CEP não encontrado")
    .sort();
  const current = citySelect.value;
  citySelect.innerHTML = '<option value="">Todas as Cidades</option>';
  cities.forEach((c) => (citySelect.innerHTML += `<option value="${c}">${c}</option>`));
  if (cities.includes(current)) citySelect.value = current;
}

// ------------------------------------------------------------
// Filtros
// ------------------------------------------------------------
function getFilteredRows() {
  let sla = [...slaRows];
  let ds = [...dsRows];
  let manifest = [...manifestRows];

  if (stationSelect && stationSelect.value) {
    sla = sla.filter((r) => (r["Current Station"] || "").toString().trim() === stationSelect.value);
    ds = ds.filter((r) => (r["Current Station"] || "").toString().trim() === stationSelect.value);
    manifest = manifest.filter((r) => (r["Current Station"] || "").toString().trim() === stationSelect.value);
  }
  if (driverSelect.value) {
    sla = sla.filter((r) => r["Driver Name"] === driverSelect.value);
    ds = ds.filter((r) => r["Driver Name"] === driverSelect.value);
    manifest = manifest.filter((r) => r["Driver Name"] === driverSelect.value);
  }
  if (citySelect.value) {
    sla = sla.filter((r) => cepToCity[r["Postal Code"]] === citySelect.value);
    ds = ds.filter((r) => cepToCity[r["Postal Code"]] === citySelect.value);
    manifest = manifest.filter((r) => cepToCity[r["Postal Code"]] === citySelect.value);
  }
  if (statusSelect.value) {
    sla = sla.filter((r) => r.Status === statusSelect.value);
    ds = ds.filter((r) => r.Status === statusSelect.value);
    manifest = manifest.filter((r) => r.Status === statusSelect.value);
  }
  return { sla, ds, manifest };
}

function refresh() {
  const { sla, ds, manifest } = getFilteredRows();
  renderView(sla, ds, manifest);
}

// ------------------------------------------------------------
// Renderização principal
// ------------------------------------------------------------
function hasAnyData() {
  return slaRows.length > 0 || dsRows.length > 0 || manifestRows.length > 0;
}

function syncEmptyState() {
  const hasData = hasAnyData();
  emptyState.style.display = hasData ? "none" : "flex";
  if (!hasData) {
    homePage.style.display = "none";
    cityPage.style.display = "none";
    hideStatusPage();
    stationSet = new Set();
    refreshStationSelect();
  } else if (homePage.style.display === "none" && cityPage.style.display === "none") {
    // primeira carga de dados: volta para a visão Geral
    homePage.style.display = "grid";
  }
  return hasData;
}

function renderView(slaFiltered, dsFiltered, manifestFiltered = []) {
  if (!syncEmptyState()) return;

  if (btnClearRankingFilter) {
    btnClearRankingFilter.style.display = citySelect.value || driverSelect.value ? "inline-block" : "none";
  }

  const slaMetrics = calculateMetrics(slaFiltered, "SLA", cepToCity);
  const dsMetrics = calculateMetrics(dsFiltered, "DS", cepToCity);
  const manifestMetrics = calculateMetrics(manifestFiltered, "DS", cepToCity);
  const prevSnapshot = getPreviousSnapshot();

  if (currentView === "GENERAL") {
    const sla = parseFloat(slaMetrics.sla) || 0;
    const ds = parseFloat(dsMetrics.sla) || 0;

    animateNumber("kpiTotal", slaMetrics.total);
    animateNumber("kpiDelivered", slaMetrics.delivered);
    animateNumber("kpiPending", slaMetrics.pending);
    animateNumber("kpiOnHold", slaMetrics.onHoldCount);
    animateNumber("kpiSla", sla, { suffix: "%", decimals: 2 });
    setClass("kpiSlaCard", "kpi " + slaClass(sla) + (sla < GOAL ? " kpi-flash" : ""));
    animateNumber("kpiDs", ds, { suffix: "%", decimals: 2 });
    setClass("kpiDsCard", "kpi " + slaClass(ds) + (ds < GOAL ? " kpi-flash" : ""));
    document.getElementById("kpiSlaCard").style.display = "flex";
    document.getElementById("kpiDsCard").style.display = "flex";
    document.getElementById("kpiManifestCard").style.display = "none";

    setTrend("kpiSlaTrend", prevSnapshot ? sla - prevSnapshot.sla : null, prevSnapshot?.date);
    setTrend("kpiDsTrend", prevSnapshot ? ds - prevSnapshot.ds : null, prevSnapshot?.date);

    setText("kpiAlert", buildAlertMessage(sla, ds));

    renderCharts(
      { ...slaMetrics, driverSLA: slaMetrics.driverSLA, citySLA: slaMetrics.citySLA },
      currentView,
      { status: statusSelect.value, rawData: slaFiltered, cepToCity, goal: GOAL }
    );
    renderDriverTable(slaMetrics.driverSLA, true);
  } else {
    const metrics =
      currentView === "SLA" ? slaMetrics : currentView === "MANIFESTO" ? manifestMetrics : dsMetrics;
    const rawData =
      currentView === "SLA" ? slaFiltered : currentView === "MANIFESTO" ? manifestFiltered : dsFiltered;
    const value = parseFloat(metrics.sla) || 0;
    animateNumber("kpiTotal", metrics.total);
    animateNumber("kpiDelivered", metrics.delivered);
    animateNumber("kpiPending", metrics.pending);
    animateNumber("kpiOnHold", metrics.onHoldCount);

    document.getElementById("kpiSlaCard").style.display = currentView === "SLA" ? "flex" : "none";
    document.getElementById("kpiDsCard").style.display = currentView === "DS" ? "flex" : "none";
    document.getElementById("kpiManifestCard").style.display = currentView === "MANIFESTO" ? "flex" : "none";

    if (currentView === "SLA") {
      animateNumber("kpiSla", value, { suffix: "%", decimals: 2 });
      setClass("kpiSlaCard", "kpi " + slaClass(value) + (value < GOAL ? " kpi-flash" : ""));
      setTrend("kpiSlaTrend", prevSnapshot ? value - prevSnapshot.sla : null, prevSnapshot?.date);
    } else if (currentView === "MANIFESTO") {
      animateNumber("kpiManifest", value, { suffix: "%", decimals: 2 });
      setClass("kpiManifestCard", "kpi " + slaClass(value) + (value < GOAL ? " kpi-flash" : ""));
      setTrend("kpiManifestTrend", null, null);
    } else {
      animateNumber("kpiDs", value, { suffix: "%", decimals: 2 });
      setClass("kpiDsCard", "kpi " + slaClass(value) + (value < GOAL ? " kpi-flash" : ""));
      setTrend("kpiDsTrend", prevSnapshot ? value - prevSnapshot.ds : null, prevSnapshot?.date);
    }

    setText("kpiAlert", value < GOAL ? `🚨 Abaixo da meta (${GOAL}%)` : "✅ Meta batida");

    renderCharts(
      { ...metrics, driverSLA: metrics.driverSLA, citySLA: metrics.citySLA },
      currentView,
      { status: statusSelect.value, rawData, cepToCity, goal: GOAL }
    );
    renderDriverTable(metrics.driverSLA, false);
  }
}

function buildAlertMessage(sla, ds) {
  if (sla >= GOAL && ds >= GOAL) return "✅ Meta batida (SLA e DS)";
  if (sla >= GOAL && ds < GOAL) return "⚠️ SLA OK, mas DS abaixo da meta";
  if (sla < GOAL && ds >= GOAL) return "⚠️ DS OK, mas SLA abaixo da meta";
  return "🚨 SLA e DS abaixo da meta";
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.innerText = value;
}
function setClass(id, className) {
  const el = document.getElementById(id);
  if (el) el.className = className;
}

function animateNumber(id, target, opts = {}) {
  const el = document.getElementById(id);
  if (!el) return;
  const { suffix = "", decimals = 0, duration = 600 } = opts;
  const startText = el.innerText.replace(suffix, "").replace(",", ".").trim();
  const start = parseFloat(startText) || 0;
  const end = parseFloat(target) || 0;
  if (start === end) {
    el.innerText = (decimals ? end.toFixed(decimals) : Math.round(end)) + suffix;
    return;
  }
  const startTime = performance.now();
  function step(now) {
    const progress = Math.min((now - startTime) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    const current = start + (end - start) * eased;
    el.innerText = (decimals ? current.toFixed(decimals) : Math.round(current)) + suffix;
    if (progress < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

function setTrend(id, diff, refDate) {
  const el = document.getElementById(id);
  if (!el) return;
  if (diff === null || diff === undefined || Number.isNaN(diff)) {
    el.innerText = "";
    el.className = "kpi-trend";
    return;
  }
  const rounded = Math.abs(diff).toFixed(1);
  const suffix = refDate ? ` vs ${daysAgoLabel(refDate)}` : "";
  if (Math.abs(diff) < 0.05) {
    el.innerText = `▬ estável${suffix}`;
    el.className = "kpi-trend trend-flat";
    return;
  }
  const arrow = diff > 0 ? "▲" : "▼";
  const cls = diff > 0 ? "trend-up" : "trend-down";
  el.innerText = `${arrow} ${diff > 0 ? "+" : "-"}${rounded}%${suffix}`;
  el.className = `kpi-trend ${cls}`;
}

// ------------------------------------------------------------
// Tabela de entregadores — busca + ordenação
// ------------------------------------------------------------
let lastDriverRows = [];
let lastIsGeneral = true;

function renderDriverTable(rows, isGeneral) {
  lastDriverRows = rows;
  lastIsGeneral = isGeneral;

  let filtered = rows;
  const term = (driverSearch.value || "").trim().toLowerCase();
  if (term) filtered = filtered.filter((r) => r.name.toLowerCase().includes(term));

  const priority = priorityFilter ? priorityFilter.value : "";
  if (priority) filtered = filtered.filter((r) => slaClass(r.sla) === priority);

  const { key, dir } = sortState;
  filtered = [...filtered].sort((a, b) => {
    const va = key === "name" ? a.name.toLowerCase() : parseFloat(a[key]);
    const vb = key === "name" ? b.name.toLowerCase() : parseFloat(b[key]);
    if (va < vb) return dir === "asc" ? -1 : 1;
    if (va > vb) return dir === "asc" ? 1 : -1;
    return 0;
  });

  cityTableBody.innerHTML = "";
  updateSortIndicators();

  if (!filtered.length) {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td colspan="6" class="table-empty">Nenhum entregador encontrado</td>`;
    cityTableBody.appendChild(tr);
    return;
  }

  filtered.forEach((stat, index) => {
    const tr = document.createElement("tr");
    let medal = "";
    if (isGeneral && sortState.key === "total" && sortState.dir === "desc") {
      if (index === 0) medal = "🥇 ";
      else if (index === 1) medal = "🥈 ";
      else if (index === 2) medal = "🥉 ";
    }
    const backlogCount = backlogRows.filter((r) => extractHandlerName(r["Latest User Name"]) === stat.name).length;
    const backlogBadge = backlogCount > 0 ? ` <span class="badge" title="Pacotes em backlog">⏰ ${backlogCount}</span>` : "";
    const pnrCount = pnrRows.filter(
      (r) => extractHandlerName(r["Driver"]) === stat.name && OPEN_PNR_STATUSES.includes((r["Status"] || "").toString().trim())
    ).length;
    const pnrBadge = pnrCount > 0 ? ` <span class="badge" title="PNR em aberto">🎫 ${pnrCount}</span>` : "";
    tr.innerHTML = `
      <td>${medal}${stat.name}${backlogBadge}${pnrBadge}</td>
      <td>${stat.total}</td>
      <td>${stat.delivered}</td>
      <td>${stat.pending}</td>
      <td class="${slaClass(stat.sla)}">${stat.sla}%</td>
    `;
    tr.appendChild(renderNotifyCell(stat));
    cityTableBody.appendChild(tr);
  });
}

function updateSortIndicators() {
  document.querySelectorAll("th[data-sort]").forEach((th) => {
    th.classList.remove("sort-asc", "sort-desc");
    if (th.dataset.sort === sortState.key) {
      th.classList.add(sortState.dir === "asc" ? "sort-asc" : "sort-desc");
    }
  });
}

document.querySelectorAll("th[data-sort]").forEach((th) => {
  th.addEventListener("click", () => {
    const key = th.dataset.sort;
    if (sortState.key === key) {
      sortState.dir = sortState.dir === "asc" ? "desc" : "asc";
    } else {
      sortState = { key, dir: key === "name" ? "asc" : "desc" };
    }
    renderDriverTable(lastDriverRows, lastIsGeneral);
  });
});

driverSearch.addEventListener("input", () => renderDriverTable(lastDriverRows, lastIsGeneral));
if (priorityFilter) {
  priorityFilter.addEventListener("change", () => renderDriverTable(lastDriverRows, lastIsGeneral));
}

// ------------------------------------------------------------
// Busca rápida global (pedido, entregador ou CEP)
// ------------------------------------------------------------
function performGlobalSearch(term) {
  if (!globalSearchResults) return;
  const t = term.trim().toLowerCase();
  if (!t) {
    globalSearchResults.innerHTML = "";
    globalSearchResults.classList.remove("show");
    return;
  }

  const all = [
    ...slaRows.map((r) => ({ ...r, __src: "SLA" })),
    ...dsRows.map((r) => ({ ...r, __src: "DS" })),
  ];
  const matches = all
    .filter((r) => {
      const orderId = (r["Order ID"] || "").toString().toLowerCase();
      const driver = (r["Driver Name"] || "").toString().toLowerCase();
      const cep = (r["Postal Code"] || "").toString().toLowerCase();
      return orderId.includes(t) || driver.includes(t) || cep.includes(t);
    })
    .slice(0, 8);

  if (!matches.length) {
    globalSearchResults.innerHTML = '<div class="search-empty">Nenhum resultado encontrado</div>';
  } else {
    globalSearchResults.innerHTML = matches
      .map((m) => {
        const driverName = (m["Driver Name"] || "").toString().replace(/"/g, "&quot;");
        return `
        <div class="search-result" data-driver="${driverName}">
          <strong>📦 ${m["Order ID"] || "Sem código"}</strong>
          <span>${m["Driver Name"] || "Sem entregador"} · CEP ${m["Postal Code"] || "—"} · ${m.Status || "—"} (${m.__src})</span>
        </div>`;
      })
      .join("");
  }
  globalSearchResults.classList.add("show");
}

if (globalSearch) {
  globalSearch.addEventListener("input", () => performGlobalSearch(globalSearch.value));
  globalSearchResults.addEventListener("click", (e) => {
    const item = e.target.closest(".search-result");
    if (!item) return;
    const driver = item.dataset.driver;
    globalSearchResults.classList.remove("show");
    globalSearch.value = "";
    if (driver) {
      btnCity.click();
      driverSearch.value = driver;
      renderDriverTable(lastDriverRows, lastIsGeneral);
    }
  });
  document.addEventListener("click", (e) => {
    if (!e.target.closest(".global-search-wrap")) {
      globalSearchResults.classList.remove("show");
    }
  });
}

// ------------------------------------------------------------
// Atalhos de teclado (1-4 trocam de aba)
// ------------------------------------------------------------
document.addEventListener("keydown", (e) => {
  const tag = (e.target.tagName || "").toLowerCase();
  if (tag === "input" || tag === "select" || tag === "textarea") return;
  if (e.key === "1") btnGeneral.click();
  else if (e.key === "2") btnSLA.click();
  else if (e.key === "3") btnDS.click();
  else if (e.key === "4") btnBacklog.click();
  else if (e.key === "5") btnPnr.click();
  else if (e.key === "6") btnCity.click();
  else if (e.key === "7") btnManifest.click();
});

// ------------------------------------------------------------
// Modo TV (tela cheia, girando as abas automaticamente)
// ------------------------------------------------------------
let tvInterval = null;

function enterTvMode() {
  document.body.classList.add("tv-mode");
  const el = document.getElementById("dashboard");
  if (el.requestFullscreen) el.requestFullscreen().catch(() => {});
  const views = ["GENERAL", "SLA", "DS", "BACKLOG", "PNR", "CITY"];
  let idx = 0;
  switchView(views[0]);
  tvInterval = setInterval(() => {
    idx = (idx + 1) % views.length;
    switchView(views[idx]);
  }, 10000);
  if (btnTvMode) btnTvMode.innerText = "✖️ Sair do Modo TV";
}

function exitTvMode() {
  document.body.classList.remove("tv-mode");
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  clearInterval(tvInterval);
  tvInterval = null;
  if (btnTvMode) btnTvMode.innerText = "📺 Modo TV";
}

if (btnTvMode) {
  btnTvMode.addEventListener("click", () => {
    if (document.body.classList.contains("tv-mode")) exitTvMode();
    else enterTvMode();
  });
}
document.addEventListener("fullscreenchange", () => {
  if (!document.fullscreenElement && document.body.classList.contains("tv-mode")) exitTvMode();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && document.body.classList.contains("tv-mode")) exitTvMode();
});

// ------------------------------------------------------------
// Exportações
// ------------------------------------------------------------
function exportDriverTableCsv() {
  if (!lastDriverRows.length) {
    toast("Nenhum dado para exportar ainda", "warn");
    return;
  }
  const header = ["Entregador", "Total", "Entregues", "Pendentes", "SLA (%)"];
  const lines = [header.join(";")];
  lastDriverRows.forEach((r) => lines.push([r.name, r.total, r.delivered, r.pending, r.sla].join(";")));
  const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `relatorio-entregadores-${currentView.toLowerCase()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  toast("CSV exportado com sucesso", "good");
}

// ============================================================
// RELATÓRIO PDF COMPLETO — funciona por aba (SLA / DS / Manifesto /
// Geral / Backlog / PNR / Entregadores), mostrando tudo que está na
// tela: totais, status, detalhamento por cidade e por entregador,
// com quem está performando pior destacado em vermelho.
// ============================================================

// Agrupa linhas em contagens por uma chave (cidade OU entregador),
// junto com quantos "critical"/"ruins" tem em cada grupo — reusado
// pelo Backlog e pelo PNR.
function groupCountsBy(rows, keyFn, isBadRowFn, extraFn) {
  const map = {};
  rows.forEach((r) => {
    const key = keyFn(r) || "Não identificado";
    if (!map[key]) map[key] = { total: 0, bad: 0, extra: 0 };
    map[key].total++;
    if (isBadRowFn && isBadRowFn(r)) map[key].bad++;
    if (extraFn) map[key].extra += extraFn(r) || 0;
  });
  return Object.entries(map).map(([name, s]) => ({ name, total: s.total, bad: s.bad, extra: s.extra }));
}

// ---- SLA / DS / Manifesto / Geral ----
function buildDeliveryFullReport(rows, reportLabel, mode) {
  const stationValue = stationSelect ? stationSelect.value : "";
  const filteredRows = stationValue
    ? rows.filter((r) => (r["Current Station"] || "").toString().trim() === stationValue)
    : rows;

  const metrics = calculateMetrics(filteredRows, mode, cepToCity);

  const statusBreakdown = Object.entries(metrics.statusMap)
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);

  const rateLabel = `${mode === "DS" ? "DS" : "SLA"}%`;

  const cityColumns = ["Cidade", "Total", "Entregues", "Pendentes", rateLabel];
  const cityWidths = [0.40, 0.15, 0.15, 0.15, 0.15];
  const cityRows = [...metrics.citySLA]
    .sort((a, b) => parseFloat(a.sla) - parseFloat(b.sla))
    .map((c) => ({
      cells: [c.name, String(c.total), String(c.delivered), String(c.pending), `${c.sla}%`],
      bad: parseFloat(c.sla) < GOAL,
    }));

  const driverColumns = ["Entregador", "Total", "Entregues", "Pendentes", rateLabel];
  const driverWidths = [0.40, 0.15, 0.15, 0.15, 0.15];
  const driverRows = [...metrics.driverSLA]
    .sort((a, b) => parseFloat(a.sla) - parseFloat(b.sla))
    .map((d) => ({
      cells: [d.name, String(d.total), String(d.delivered), String(d.pending), `${d.sla}%`],
      bad: parseFloat(d.sla) < GOAL,
    }));

  return {
    titleLine: `RELATÓRIO COMPLETO — ${reportLabel}`,
    emptyMessage: `Nenhum dado de ${reportLabel} carregado para gerar o relatório`,
    isEmpty: filteredRows.length === 0,
    summary: [
      { label: "Total de pedidos", value: String(metrics.total) },
      { label: "Entregues", value: String(metrics.delivered) },
      { label: "Pendentes", value: String(metrics.pending) },
      { label: "Ocorrências (OnHold)", value: String(metrics.onHoldCount) },
      { label: rateLabel, value: `${metrics.sla}%` },
    ],
    statusBreakdown,
    cityColumns, cityWidths, cityRows,
    driverColumns, driverWidths, driverRows,
    legendNote: `Linhas em vermelho: abaixo da meta de ${GOAL}%.`,
  };
}

// ---- Backlog ----
function buildBacklogFullReport() {
  const stationValue = stationSelect ? stationSelect.value : "";
  const orderCityMap = buildOrderCityMap();
  const driverCityMap = buildDriverCityMap();

  let rows = backlogRows.map((r) => {
    const driverName = extractHandlerName(r["Latest User Name"]);
    const shipmentId = (r["Shipment ID"] || "").toString().trim();
    const city = findManualCity(driverName) || orderCityMap[shipmentId] || driverCityMap[driverName] || null;
    return { ...r, __driverName: driverName, __city: city };
  });

  if (stationValue) rows = rows.filter((r) => (r["Station Name"] || "").toString().trim() === stationValue);
  if (backlogStatusFilter && backlogStatusFilter.value) {
    rows = rows.filter((r) => (r["Latest Status"] || "").toString().trim() === backlogStatusFilter.value);
  }
  if (backlogDriverFilter && backlogDriverFilter.value) rows = rows.filter((r) => r.__driverName === backlogDriverFilter.value);
  if (backlogCityFilter && backlogCityFilter.value) rows = rows.filter((r) => r.__city === backlogCityFilter.value);

  const summary = computeBacklogSummary(rows);
  const isCritical = (r) => agingRank(r["LM Leg Aging"]) === 3;

  const statusMap = {};
  rows.forEach((r) => {
    const s = (r["Latest Status"] || "Sem status").toString().trim() || "Sem status";
    statusMap[s] = (statusMap[s] || 0) + 1;
  });
  const statusBreakdown = Object.entries(statusMap).map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count);

  const columns = ["Nome", "Total parado", "Aging crítico", "Sem tentativa"];
  const widths = [0.4, 0.2, 0.2, 0.2];

  function toRows(keyFn) {
    return groupCountsBy(rows, keyFn, isCritical, (r) => ((parseFloat(r["No. Attempts"]) || 0) <= 0 ? 1 : 0))
      .sort((a, b) => b.bad - a.bad || b.total - a.total)
      .map((g) => ({
        cells: [g.name, String(g.total), String(g.bad), String(g.extra)],
        bad: g.bad > 0,
      }));
  }

  return {
    titleLine: "RELATÓRIO COMPLETO — BACKLOG",
    emptyMessage: "Nenhum pacote de Backlog encontrado para gerar o relatório",
    isEmpty: rows.length === 0,
    summary: [
      { label: "Total parado", value: String(summary.total) },
      { label: "Sem tentativa", value: String(summary.noAttempt) },
      { label: "Já tentados", value: String(summary.attempted) },
      { label: "Aging crítico", value: String(summary.critical) },
    ],
    statusBreakdown,
    cityColumns: ["Cidade", ...columns.slice(1)], cityWidths: widths, cityRows: toRows((r) => r.__city),
    driverColumns: columns, driverWidths: widths, driverRows: toRows((r) => r.__driverName),
    legendNote: "Linhas em vermelho: têm pacote(s) em aging crítico.",
  };
}

// ---- PNR ----
function buildPnrFullReport() {
  const now = Date.now();
  const stationValue = stationSelect ? stationSelect.value : "";
  const orderCityMap = buildOrderCityMap();
  const driverCityMap = buildDriverCityMap();

  let rows = pnrRows
    .filter((r) => !stationValue || (r["Station"] || "").toString().trim() === stationValue)
    .map((r) => {
      const driverName = extractHandlerName(r["Driver"]);
      const orderCity = orderCityMap[(r["SPXTN"] || "").toString().trim()];
      const city = findManualCity(driverName) || orderCity || driverCityMap[driverName] || null;
      const deadline = r["SLA Deadline"] ? new Date(r["SLA Deadline"].toString().replace(" ", "T")) : null;
      const diffDays = deadline && !Number.isNaN(deadline.getTime()) ? (deadline.getTime() - now) / 86400000 : null;
      return { ...r, __driverName: driverName, __city: city, __status: (r["Status"] || "").toString().trim(), __diffDays: diffDays };
    });

  if (pnrCityFilter && pnrCityFilter.value) rows = rows.filter((r) => r.__city === pnrCityFilter.value);

  const openRows = rows.filter((r) => OPEN_PNR_STATUSES.includes(r.__status));
  const scopeValue = pnrScopeFilter ? pnrScopeFilter.value : "open";
  let baseRows = scopeValue === "all" ? rows : openRows;
  if (pnrStatusFilter && pnrStatusFilter.value) baseRows = baseRows.filter((r) => r.__status === pnrStatusFilter.value);
  if (pnrDriverFilter && pnrDriverFilter.value) baseRows = baseRows.filter((r) => r.__driverName === pnrDriverFilter.value);

  const totalValueAtRisk = openRows.reduce((sum, r) => sum + (parseFloat(r["PNR Order Value"]) || 0), 0);
  const urgentCount = openRows.filter((r) => pnrUrgencyRank(r.__diffDays) >= 2).length;

  const statusMap = {};
  baseRows.forEach((r) => {
    const s = r.__status || "Sem status";
    statusMap[s] = (statusMap[s] || 0) + 1;
  });
  const statusBreakdown = Object.entries(statusMap).map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count);

  const isUrgent = (r) => pnrUrgencyRank(r.__diffDays) >= 2;
  const columns = ["Nome", "Total aberto", "Urgentes", "Valor em risco"];
  const widths = [0.36, 0.18, 0.18, 0.28];

  function toRows(keyFn) {
    return groupCountsBy(baseRows, keyFn, isUrgent, (r) => parseFloat(r["PNR Order Value"]) || 0)
      .sort((a, b) => b.bad - a.bad || b.total - a.total)
      .map((g) => ({
        cells: [g.name, String(g.total), String(g.bad), `R$ ${g.extra.toFixed(2).replace(".", ",")}`],
        bad: g.bad > 0,
      }));
  }

  return {
    titleLine: "RELATÓRIO COMPLETO — PNR",
    emptyMessage: "Nenhuma PNR encontrada para gerar o relatório",
    isEmpty: baseRows.length === 0,
    summary: [
      { label: "Total", value: String(rows.length) },
      { label: "Em aberto", value: String(openRows.length) },
      { label: "Valor em risco", value: `R$ ${totalValueAtRisk.toFixed(2).replace(".", ",")}` },
      { label: "Urgentes", value: String(urgentCount) },
    ],
    statusBreakdown,
    cityColumns: ["Cidade", ...columns.slice(1)], cityWidths: widths, cityRows: toRows((r) => r.__city),
    driverColumns: columns, driverWidths: widths, driverRows: toRows((r) => r.__driverName),
    legendNote: "Linhas em vermelho: têm PNR(s) urgente(s) (prazo vencendo ou vencido).",
  };
}

// Decide qual relatório montar de acordo com a página/aba ativa no
// momento do clique — nunca mistura tudo junto.
function buildReportForActiveView() {
  if (activePage === "BACKLOG") return buildBacklogFullReport();
  if (activePage === "PNR") return buildPnrFullReport();

  // HOME ou CITY (Entregadores) — usa o mesmo conjunto de dados da
  // aba SLA/DS/Manifesto que estava ativa (a tabela de Entregadores é
  // sempre um detalhamento dessa mesma aba).
  const { sla, ds, manifest } = getFilteredRows();
  if (currentView === "DS") return buildDeliveryFullReport(ds, "DS", "DS");
  if (currentView === "MANIFESTO") return buildDeliveryFullReport(manifest, "MANIFESTO", "DS");
  if (currentView === "SLA") return buildDeliveryFullReport(sla, "SLA", "SLA");
  // GERAL: combina SLA + DS num relatório só
  return buildDeliveryFullReport([...sla, ...ds], "GERAL (SLA & DS)", "SLA");
}

// ============================================================
// RELATÓRIO TXT — versão curta, sem nome de cidade/entregador, só
// quantidades. Pensado pra colar direto num grupo de WhatsApp.
// ============================================================

function pctBR(value) {
  return String(value).replace(".", ",");
}

// ---- SLA / DS / Manifesto: um único indicador de % ----
function buildDeliveryTxtSingle(rows, reportLabel, mode) {
  const stationValue = stationSelect ? stationSelect.value : "";
  const filteredRows = stationValue
    ? rows.filter((r) => (r["Current Station"] || "").toString().trim() === stationValue)
    : rows;
  if (!filteredRows.length) return null;

  const metrics = calculateMetrics(filteredRows, mode, cepToCity);
  const totalAll = filteredRows.length;
  const hubAssigned = metrics.statusMap["Hub Assigned"] || 0;
  const hubReceived = metrics.statusMap["Hub Received"] || 0;
  const emRota = Math.max(0, totalAll - metrics.delivered - metrics.onHoldCount - hubAssigned - hubReceived);
  const stationLabel = stationValue || "Todas as estações";
  const rateLabel = mode === "DS" ? "DS" : "SLA";

  const lines = [
    `🏛️ XPT: ${stationLabel}`,
    "",
    `📨 Total de Remessas (${reportLabel}): ${totalAll}`,
    `⏳ Em Rota: ${emRota}`,
    `🚚 Entregues: ${metrics.delivered}`,
  ];
  if (hubAssigned) lines.push(`📍 Hub Assigned: ${hubAssigned}`);
  if (hubReceived) lines.push(`📥 Hub Received: ${hubReceived}`);
  lines.push(
    `⚠️ Ocorrências: ${metrics.onHoldCount} (ausente, recusado ou local fechado. Motoristas cientes para tentar reversão no que for possível)`,
    "",
    `📊 ${rateLabel}: ${pctBR(metrics.sla)}%`
  );

  return { text: lines.join("\n"), slug: reportLabel.toLowerCase() };
}

// ---- Geral: mostra SLA% e DS% juntos, contagens baseadas no SLA ----
function buildDeliveryTxtGeral(slaRows, dsRows) {
  const stationValue = stationSelect ? stationSelect.value : "";
  const filteredSla = stationValue
    ? slaRows.filter((r) => (r["Current Station"] || "").toString().trim() === stationValue)
    : slaRows;
  const filteredDs = stationValue
    ? dsRows.filter((r) => (r["Current Station"] || "").toString().trim() === stationValue)
    : dsRows;
  if (!filteredSla.length && !filteredDs.length) return null;

  const slaMetrics = calculateMetrics(filteredSla, "SLA", cepToCity);
  const dsMetrics = calculateMetrics(filteredDs, "DS", cepToCity);
  const totalAll = filteredSla.length;
  const hubAssigned = slaMetrics.statusMap["Hub Assigned"] || 0;
  const hubReceived = slaMetrics.statusMap["Hub Received"] || 0;
  const emRota = Math.max(0, totalAll - slaMetrics.delivered - slaMetrics.onHoldCount - hubAssigned - hubReceived);
  const stationLabel = stationValue || "Todas as estações";

  const lines = [
    `🏛️ XPT: ${stationLabel}`,
    "",
    `📨 Total de Remessas: ${totalAll}`,
    `⏳ Em Rota: ${emRota}`,
    `🚚 Entregues: ${slaMetrics.delivered}`,
  ];
  if (hubAssigned) lines.push(`📍 Hub Assigned: ${hubAssigned}`);
  if (hubReceived) lines.push(`📥 Hub Received: ${hubReceived}`);
  lines.push(
    `⚠️ Ocorrências: ${slaMetrics.onHoldCount} (ausente, recusado ou local fechado. Motoristas cientes para tentar reversão no que for possível)`,
    "",
    `📊 SLA: ${pctBR(slaMetrics.sla)}%`,
    `📊 DS: ${pctBR(dsMetrics.sla)}%`
  );

  return { text: lines.join("\n"), slug: "geral" };
}

// ---- Backlog ----
function buildBacklogTxt() {
  const stationValue = stationSelect ? stationSelect.value : "";
  const orderCityMap = buildOrderCityMap();
  const driverCityMap = buildDriverCityMap();

  let rows = backlogRows.map((r) => {
    const driverName = extractHandlerName(r["Latest User Name"]);
    const shipmentId = (r["Shipment ID"] || "").toString().trim();
    const city = findManualCity(driverName) || orderCityMap[shipmentId] || driverCityMap[driverName] || null;
    return { ...r, __driverName: driverName, __city: city };
  });
  if (stationValue) rows = rows.filter((r) => (r["Station Name"] || "").toString().trim() === stationValue);
  if (backlogStatusFilter && backlogStatusFilter.value) rows = rows.filter((r) => (r["Latest Status"] || "").toString().trim() === backlogStatusFilter.value);
  if (backlogDriverFilter && backlogDriverFilter.value) rows = rows.filter((r) => r.__driverName === backlogDriverFilter.value);
  if (backlogCityFilter && backlogCityFilter.value) rows = rows.filter((r) => r.__city === backlogCityFilter.value);
  if (!rows.length) return null;

  const summary = computeBacklogSummary(rows);
  const stationLabel = stationValue || "Todas as estações";

  const lines = [
    `🏛️ XPT: ${stationLabel}`,
    "",
    `📦 Total Parado (Backlog): ${summary.total}`,
    `🕐 Sem Tentativa: ${summary.noAttempt}`,
    `✅ Já Tentados: ${summary.attempted}`,
    `🔴 Aging Crítico: ${summary.critical}`,
  ];

  return { text: lines.join("\n"), slug: "backlog" };
}

// ---- PNR ----
function buildPnrTxt() {
  const now = Date.now();
  const stationValue = stationSelect ? stationSelect.value : "";
  const orderCityMap = buildOrderCityMap();
  const driverCityMap = buildDriverCityMap();

  let rows = pnrRows
    .filter((r) => !stationValue || (r["Station"] || "").toString().trim() === stationValue)
    .map((r) => {
      const driverName = extractHandlerName(r["Driver"]);
      const orderCity = orderCityMap[(r["SPXTN"] || "").toString().trim()];
      const city = findManualCity(driverName) || orderCity || driverCityMap[driverName] || null;
      const deadline = r["SLA Deadline"] ? new Date(r["SLA Deadline"].toString().replace(" ", "T")) : null;
      const diffDays = deadline && !Number.isNaN(deadline.getTime()) ? (deadline.getTime() - now) / 86400000 : null;
      return { ...r, __driverName: driverName, __city: city, __status: (r["Status"] || "").toString().trim(), __diffDays: diffDays };
    });
  if (pnrCityFilter && pnrCityFilter.value) rows = rows.filter((r) => r.__city === pnrCityFilter.value);
  if (!rows.length) return null;

  const openRows = rows.filter((r) => OPEN_PNR_STATUSES.includes(r.__status));
  const valueAtRisk = openRows.reduce((sum, r) => sum + (parseFloat(r["PNR Order Value"]) || 0), 0);
  const urgentCount = openRows.filter((r) => pnrUrgencyRank(r.__diffDays) >= 2).length;
  const stationLabel = stationValue || "Todas as estações";

  const lines = [
    `🏛️ XPT: ${stationLabel}`,
    "",
    `🎫 Total de PNR: ${rows.length}`,
    `🟡 Em Aberto: ${openRows.length}`,
    `💰 Valor em Risco: R$ ${valueAtRisk.toFixed(2).replace(".", ",")}`,
    `⏰ Vencendo/Vencidas: ${urgentCount}`,
  ];

  return { text: lines.join("\n"), slug: "pnr" };
}

function buildTxtForActiveView() {
  if (activePage === "BACKLOG") return buildBacklogTxt();
  if (activePage === "PNR") return buildPnrTxt();

  const { sla, ds, manifest } = getFilteredRows();
  if (currentView === "DS") return buildDeliveryTxtSingle(ds, "DS", "DS");
  if (currentView === "MANIFESTO") return buildDeliveryTxtSingle(manifest, "Manifesto", "DS");
  if (currentView === "SLA") return buildDeliveryTxtSingle(sla, "SLA", "SLA");
  return buildDeliveryTxtGeral(sla, ds);
}

async function exportTxtReport() {
  const report = buildTxtForActiveView();

  if (!report) {
    toast("Nenhum dado carregado para gerar o relatório", "warn");
    return;
  }

  try {
    await navigator.clipboard.writeText(report.text);
    toast("Relatório copiado! Já pode colar no WhatsApp.", "good");
  } catch {
    toast("Não consegui copiar automaticamente — copie o texto manualmente.", "warn");
  }
}

btnExportTxt.addEventListener("click", exportTxtReport);

function exportPdfReport() {
  const report = buildReportForActiveView();

  if (report.isEmpty) {
    toast(report.emptyMessage, "warn");
    return;
  }

  const accent = getComputedStyle(document.documentElement).getPropertyValue("--accent-2").trim() || "#e00000";
  const accentRgb = (accent.match(/[\da-f]{2}/gi) || ["e0", "00", "00"]).map((h) => parseInt(h, 16));
  const badRgb = [176, 22, 22];
  const darkRgb = [20, 20, 20];

  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const marginX = 48;
  const marginBottom = 50;
  const usableWidth = pageWidth - marginX * 2;
  let y = 0;

  const today = new Date();
  const dateLabel = `${String(today.getDate()).padStart(2, "0")}/${String(today.getMonth() + 1).padStart(2, "0")}`;

  function ensureSpace(need) {
    if (y + need > pageHeight - marginBottom) {
      pdf.addPage();
      drawHeaderBar();
    }
  }

  function drawHeaderBar() {
    pdf.setFillColor(accentRgb[0], accentRgb[1], accentRgb[2]);
    pdf.rect(0, 0, pageWidth, 54, "F");
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(14);
    pdf.setTextColor(255, 255, 255);
    pdf.text(report.titleLine, marginX, 33);
    pdf.setFontSize(11);
    pdf.text(`– ${dateLabel}`, pageWidth - marginX, 33, { align: "right" });
    y = 80;
  }

  function drawSectionTitle(text) {
    ensureSpace(30);
    pdf.setFillColor(accentRgb[0], accentRgb[1], accentRgb[2]);
    pdf.rect(marginX, y, 4, 16, "F");
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(12.5);
    pdf.setTextColor(darkRgb[0], darkRgb[1], darkRgb[2]);
    pdf.text(text, marginX + 12, y + 12);
    y += 28;
  }

  // Encolhe o texto (com "…" no final) até caber na largura da
  // coluna, em vez de deixar o jsPDF quebrar linha — quebra de linha
  // bagunçava a tabela, pois a altura da linha era fixa.
  function fitText(text, maxWidth) {
    if (pdf.getTextWidth(text) <= maxWidth) return text;
    let truncated = text;
    while (truncated.length > 1 && pdf.getTextWidth(truncated + "…") > maxWidth) {
      truncated = truncated.slice(0, -1);
    }
    return truncated + "…";
  }

  function drawTable(columns, widthsFractions, rows) {
    if (!rows.length) return;
    const colWidths = widthsFractions.map((f) => f * usableWidth);
    const rowH = 16;

    function drawHeaderRow() {
      ensureSpace(rowH + 4);
      pdf.setFillColor(accentRgb[0], accentRgb[1], accentRgb[2]);
      pdf.rect(marginX, y - 12, usableWidth, rowH + 2, "F");
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(9.5);
      pdf.setTextColor(255, 255, 255);
      let x = marginX;
      columns.forEach((label, i) => {
        pdf.text(fitText(label, colWidths[i] - 8), x + 5, y - 1);
        x += colWidths[i];
      });
      y += rowH;
    }

    drawHeaderRow();

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9.5);
    rows.forEach((row, idx) => {
      if (y + rowH > pageHeight - marginBottom) {
        pdf.addPage();
        drawHeaderBar();
        drawHeaderRow();
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(9.5);
      }
      if (idx % 2 === 1) {
        pdf.setFillColor(245, 245, 245);
        pdf.rect(marginX, y - 12, usableWidth, rowH, "F");
      }
      if (row.bad) {
        pdf.setTextColor(badRgb[0], badRgb[1], badRgb[2]);
        pdf.setFont("helvetica", "bold");
      } else {
        pdf.setTextColor(darkRgb[0], darkRgb[1], darkRgb[2]);
        pdf.setFont("helvetica", "normal");
      }
      let x = marginX;
      row.cells.forEach((cell, i) => {
        // Corta o texto com "…" em vez de quebrar linha — quebrar
        // linha bagunçava a tabela (o texto da linha de baixo ficava
        // embolado em cima da linha seguinte)
        pdf.text(fitText(String(cell), colWidths[i] - 8), x + 5, y - 1);
        x += colWidths[i];
      });
      y += rowH;
    });
    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(darkRgb[0], darkRgb[1], darkRgb[2]);
    y += 18;
  }

  drawHeaderBar();

  // ---- Resumo (KPIs) ----
  drawSectionTitle("Resumo geral");
  const cardW = usableWidth / report.summary.length;
  ensureSpace(50);
  const cardY = y;
  report.summary.forEach((card, i) => {
    const x = marginX + i * cardW;
    pdf.setFillColor(248, 248, 248);
    pdf.rect(x, cardY, cardW - 6, 44, "F");
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(14);
    pdf.setTextColor(darkRgb[0], darkRgb[1], darkRgb[2]);
    pdf.text(String(card.value), x + 8, cardY + 22);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8);
    pdf.setTextColor(90, 90, 90);
    const wrapped = pdf.splitTextToSize(card.label, cardW - 16);
    pdf.text(wrapped, x + 8, cardY + 35);
  });
  y = cardY + 60;

  // ---- Distribuição por status ----
  if (report.statusBreakdown && report.statusBreakdown.length) {
    drawSectionTitle("Distribuição por status");
    drawTable(
      ["Status", "Quantidade"],
      [0.7, 0.3],
      report.statusBreakdown.map((s) => ({ cells: [s.label, String(s.count)], bad: false }))
    );
  }

  // ---- Detalhamento por cidade ----
  drawSectionTitle("Detalhamento por cidade");
  if (report.cityRows.length) {
    drawTable(report.cityColumns, report.cityWidths, report.cityRows);
  } else {
    ensureSpace(16);
    pdf.setFont("helvetica", "italic");
    pdf.setFontSize(10);
    pdf.text("Nenhuma cidade identificada nos dados carregados.", marginX, y);
    y += 24;
  }

  // ---- Detalhamento por entregador ----
  drawSectionTitle("Detalhamento por entregador");
  drawTable(report.driverColumns, report.driverWidths, report.driverRows);

  // ---- Legenda ----
  if (report.legendNote) {
    ensureSpace(20);
    pdf.setFont("helvetica", "italic");
    pdf.setFontSize(9);
    pdf.setTextColor(120, 120, 120);
    pdf.text(report.legendNote, marginX, y);
  }

  const stationLabel = stationSelect && stationSelect.value ? stationSelect.value.replace(/[^a-zA-Z0-9]+/g, "-") : "todos";
  const reportSlug = report.titleLine.split("—")[1]?.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-") || "geral";
  pdf.save(`relatorio-${reportSlug}-${stationLabel}-${new Date().toISOString().slice(0, 10)}.pdf`);
  toast("Relatório gerado com sucesso", "good");
}


function exportImage() {
  document.body.classList.add("export-mode");
  const currentBg = getComputedStyle(document.documentElement).getPropertyValue("--bg").trim() || "#080808";
  html2canvas(document.getElementById("dashboard"), { scale: 2, useCORS: true, backgroundColor: currentBg }).then(
    (canvas) => {
      document.body.classList.remove("export-mode");

      canvas.toBlob(async (blob) => {
        if (!blob) {
          toast("Não foi possível gerar a imagem", "bad");
          return;
        }

        if (navigator.clipboard && window.ClipboardItem) {
          try {
            await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
            toast("Print copiado — já pode colar (Ctrl+V)", "good");
            return;
          } catch (err) {
            console.error(err);
          }
        }

        // Fallback: navegador sem suporte a copiar imagem — baixa o arquivo
        const link = document.createElement("a");
        link.download = "dashboard-xpt.png";
        link.href = URL.createObjectURL(blob);
        link.click();
        URL.revokeObjectURL(link.href);
        toast("Seu navegador não copia imagens — arquivo baixado em vez disso", "warn");
      }, "image/png");
    }
  );
}
window.exportImage = exportImage;

if (btnExportCsv) btnExportCsv.addEventListener("click", exportDriverTableCsv);
btnExportPdf.addEventListener("click", exportPdfReport);

// ------------------------------------------------------------
// Upload de arquivos
// ------------------------------------------------------------
csvInput.addEventListener("change", async (e) => {
  const files = Array.from(e.target.files || []);
  if (!files.length) return;

  let combinedData = [];
  const combinedFields = new Set();
  for (const file of files) {
    const { data, fields } = await processCSV(file);
    combinedData = combinedData.concat(data);
    fields.forEach((f) => combinedFields.add(f));
  }

  slaRows = combinedData;
  extractDriverContacts(slaRows, [...combinedFields]);
  refreshStationSet();
  refreshStationSelect();

  const drivers = [...new Set(slaRows.map((r) => r["Driver Name"]).filter(Boolean))];
  driverSelect.innerHTML = '<option value="">Todos os Entregadores</option>';
  drivers.forEach((d) => (driverSelect.innerHTML += `<option value="${d}">${d}</option>`));

  const statuses = [...new Set(slaRows.map((r) => r.Status).filter(Boolean))];
  statusSelect.innerHTML = '<option value="">Todos Status</option>';
  statuses.forEach((s) => (statusSelect.innerHTML += `<option value="${s}">${s}</option>`));

  const filesLabel = files.length > 1 ? `${files.length} arquivos` : "1 arquivo";
  const dupCount = detectDuplicates(combinedData);
  const dupWarning = dupCount > 0 ? ` — ⚠️ ${dupCount} pedido(s) duplicado(s) (mesmo Order ID)` : "";
  toast(`SLA carregado (${filesLabel}): ${slaRows.length} pedidos${dupWarning}`, dupCount > 0 ? "warn" : "good");
  await resolveCeps();
  refresh();
  saveHistorySnapshot();
});

dsInput.addEventListener("change", async (e) => {
  const files = Array.from(e.target.files || []);
  if (!files.length) return;

  let combinedData = [];
  const combinedFields = new Set();
  for (const file of files) {
    const { data, fields } = await processCSV(file);
    combinedData = combinedData.concat(data);
    fields.forEach((f) => combinedFields.add(f));
  }

  dsRows = combinedData;
  extractDriverContacts(dsRows, [...combinedFields]);
  refreshStationSet();
  refreshStationSelect();

  const filesLabel = files.length > 1 ? `${files.length} arquivos` : "1 arquivo";
  const dupCount = detectDuplicates(combinedData);
  const dupWarning = dupCount > 0 ? ` — ⚠️ ${dupCount} pedido(s) duplicado(s) (mesmo Order ID)` : "";
  toast(`DS carregado (${filesLabel}): ${dsRows.length} pedidos${dupWarning}`, dupCount > 0 ? "warn" : "good");
  await resolveCeps();
  refresh();
  saveHistorySnapshot();
});

if (backlogInput) {
  backlogInput.addEventListener("change", async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    let combinedData = [];
    for (const file of files) {
      try {
        const { data } = await processBacklogFile(file);
        combinedData = combinedData.concat(data);
      } catch (err) {
        console.error(err);
        toast(`Não foi possível ler o arquivo "${file.name}"`, "bad");
      }
    }

    backlogRows = combinedData;
    const filesLabel = files.length > 1 ? `${files.length} arquivos` : "1 arquivo";
    toast(`Backlog carregado (${filesLabel}): ${backlogRows.length} pacotes`, "good");
    if (backlogPage && backlogPage.style.display !== "none") renderBacklogView();
  });
}

if (pnrInput) {
  pnrInput.addEventListener("change", async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    let combinedData = [];
    for (const file of files) {
      try {
        const { data } = await processCSV(file);
        combinedData = combinedData.concat(data);
      } catch (err) {
        console.error(err);
        toast(`Não foi possível ler o arquivo "${file.name}"`, "bad");
      }
    }

    pnrRows = combinedData;
    const filesLabel = files.length > 1 ? `${files.length} arquivos` : "1 arquivo";
    toast(`PNR carregada (${filesLabel}): ${pnrRows.length} tickets`, "good");
    if (pnrPage && pnrPage.style.display !== "none") renderPnrView();
  });
}

if (manifestInput) {
  manifestInput.addEventListener("change", async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    let combinedData = [];
    const combinedFields = new Set();
    for (const file of files) {
      try {
        const { data, fields } = await processCSV(file);
        combinedData = combinedData.concat(data);
        fields.forEach((f) => combinedFields.add(f));
      } catch (err) {
        console.error(err);
        toast(`Não foi possível ler o arquivo "${file.name}"`, "bad");
      }
    }

    manifestRows = combinedData;
    extractDriverContacts(manifestRows, [...combinedFields]);
    refreshStationSet();
    refreshStationSelect();

    const filesLabel = files.length > 1 ? `${files.length} arquivos` : "1 arquivo";
    const dupCount = detectDuplicates(combinedData);
    const dupWarning = dupCount > 0 ? ` — ⚠️ ${dupCount} pedido(s) duplicado(s) (mesmo Order ID)` : "";
    toast(`Manifesto carregado (${filesLabel}): ${manifestRows.length} pedidos${dupWarning}`, dupCount > 0 ? "warn" : "good");
    await resolveCeps();
    refresh();
  });
}

stationSelect.addEventListener("change", () => {
  try {
    localStorage.setItem(STATION_STORAGE_KEY, stationSelect.value);
  } catch {
    // localStorage indisponível — segue sem salvar
  }
  refresh();
});
driverSelect.addEventListener("change", refresh);
citySelect.addEventListener("change", refresh);
if (btnClearRankingFilter) {
  btnClearRankingFilter.addEventListener("click", () => {
    citySelect.value = "";
    driverSelect.value = "";
    toast("Filtro removido", "good");
    refresh();
  });
}
statusSelect.addEventListener("change", refresh);

// ------------------------------------------------------------
// Navegação entre abas
// ------------------------------------------------------------
function setActiveNav(button) {
  [btnGeneral, btnSLA, btnDS, btnBacklog, btnPnr, btnCity, btnManifest].forEach((b) => b.classList.remove("active"));
  button.classList.add("active");
}

function switchView(view) {
  hideStatusPage();
  if (view === "CITY") {
    activePage = "CITY";
    homePage.style.display = "none";
    backlogPage.style.display = "none";
    pnrPage.style.display = "none";
    cityPage.style.display = "block";
    setActiveNav(btnCity);
    syncEmptyState();
    return;
  }
  if (view === "BACKLOG") {
    activePage = "BACKLOG";
    homePage.style.display = "none";
    cityPage.style.display = "none";
    pnrPage.style.display = "none";
    backlogPage.style.display = "block";
    emptyState.style.display = "none";
    setActiveNav(btnBacklog);
    renderBacklogView();
    return;
  }
  if (view === "PNR") {
    activePage = "PNR";
    homePage.style.display = "none";
    cityPage.style.display = "none";
    backlogPage.style.display = "none";
    pnrPage.style.display = "block";
    emptyState.style.display = "none";
    setActiveNav(btnPnr);
    renderPnrView();
    return;
  }

  activePage = "HOME";
  currentView = view;
  homePage.style.display = "grid";
  cityPage.style.display = "none";
  backlogPage.style.display = "none";
  pnrPage.style.display = "none";

  if (view === "GENERAL") {
    document.getElementById("kpiSlaCard").style.display = "flex";
    document.getElementById("kpiDsCard").style.display = "flex";
    document.getElementById("kpiManifestCard").style.display = "none";
    setActiveNav(btnGeneral);
  } else if (view === "SLA") {
    document.getElementById("kpiSlaCard").style.display = "flex";
    document.getElementById("kpiDsCard").style.display = "none";
    document.getElementById("kpiManifestCard").style.display = "none";
    setActiveNav(btnSLA);
  } else if (view === "DS") {
    document.getElementById("kpiDsCard").style.display = "flex";
    document.getElementById("kpiSlaCard").style.display = "none";
    document.getElementById("kpiManifestCard").style.display = "none";
    setActiveNav(btnDS);
  } else if (view === "MANIFESTO") {
    document.getElementById("kpiManifestCard").style.display = "flex";
    document.getElementById("kpiSlaCard").style.display = "none";
    document.getElementById("kpiDsCard").style.display = "none";
    setActiveNav(btnManifest);
  }
  refresh();
}

btnGeneral.onclick = () => switchView("GENERAL");
btnSLA.onclick = () => switchView("SLA");
btnDS.onclick = () => switchView("DS");
btnBacklog.onclick = () => switchView("BACKLOG");
btnPnr.onclick = () => switchView("PNR");
btnCity.onclick = () => switchView("CITY");
btnManifest.onclick = () => switchView("MANIFESTO");

function hideStatusPage() {
  const el = document.getElementById("statusPage");
  if (el) el.style.display = "none";
}

// ------------------------------------------------------------
// Página de detalhe por status (clique no gráfico de barras)
// ------------------------------------------------------------
window.handleRankingClick = function (label, mode, statusFilter) {
  if (!label || label === "Sem dados") return;

  if (statusFilter === "OnHold") {
    // Ranking por entregador (Ocorrências por Entregador)
    if ([...driverSelect.options].some((o) => o.value === label)) {
      driverSelect.value = label;
      toast(`Filtrando por ${label}`, "good");
      refresh();
    }
    return;
  }

  // Ranking por cidade (SLA por Cidade / Performance por Cidade)
  if ([...citySelect.options].some((o) => o.value === label)) {
    citySelect.value = label;
    toast(`Filtrando por ${label}`, "good");
    refresh();
  }
};

// Clique numa barra do gráfico "dias parado" do Backlog — filtra a
// tabela pra só esse intervalo. Clicar de novo na mesma barra tira
// o filtro (alterna liga/desliga).
window.handleBacklogAgingClick = function (rank) {
  backlogAgingFilter = backlogAgingFilter === rank ? null : rank;
  renderBacklogView();
  if (backlogAgingFilter !== null) {
    toast(`Filtrando Backlog: ${BACKLOG_AGING_LABELS[rank]}`, "good");
  } else {
    toast("Filtro de dias removido", "info");
  }
};

// Clique numa barra do gráfico "Backlog por Entregador Atual" —
// filtra a tabela pra só esse entregador (usa o mesmo dropdown de
// sempre). Clicar de novo no mesmo nome tira o filtro.
window.handleBacklogHandlerClick = function (driverName) {
  if (!backlogDriverFilter) return;
  const jaEstavaFiltrado = backlogDriverFilter.value === driverName;
  backlogDriverFilter.value = jaEstavaFiltrado ? "" : driverName;
  renderBacklogView();
  toast(jaEstavaFiltrado ? "Filtro de entregador removido" : `Filtrando Backlog: ${driverName}`, jaEstavaFiltrado ? "info" : "good");
};

// Clique numa barra do gráfico de prazo do PNR — filtra a tabela pra
// só essa faixa de urgência.
window.handlePnrDeadlineClick = function (rank) {
  pnrUrgencyFilter = pnrUrgencyFilter === rank ? null : rank;
  renderPnrView();
  if (pnrUrgencyFilter !== null) {
    toast(`Filtrando PNR: ${PNR_URGENCY_LABELS[rank]}`, "good");
  } else {
    toast("Filtro de urgência removido", "info");
  }
};

// Clique numa barra do gráfico "Valor em Risco por Entregador" do
// PNR — filtra a tabela pra só esse entregador.
window.handlePnrDriverClick = function (driverName) {
  if (!pnrDriverFilter) return;
  const jaEstavaFiltrado = pnrDriverFilter.value === driverName;
  pnrDriverFilter.value = jaEstavaFiltrado ? "" : driverName;
  renderPnrView();
  toast(jaEstavaFiltrado ? "Filtro de entregador removido" : `Filtrando PNR: ${driverName}`, jaEstavaFiltrado ? "info" : "good");
};

window.handleStatusClick = function (status) {
  const { sla, ds, manifest } = getFilteredRows();
  const dataset = currentView === "DS" ? ds : currentView === "MANIFESTO" ? manifest : sla;
  const rows = dataset.filter((r) => r.Status === status);
  const grouped = {};
  rows.forEach((r) => {
    const driver = (r["Driver Name"] || "").toString().trim();
    const groupKey = driver || cepToCity[r["Postal Code"]] || "Sem cidade identificada";
    const orderId = r["Order ID"] || "Sem código";
    if (!grouped[groupKey]) grouped[groupKey] = [];
    grouped[groupKey].push(orderId);
  });
  showStatusPage(status, grouped);
};

function showStatusPage(status, grouped) {
  homePage.style.display = "none";
  cityPage.style.display = "none";

  let page = document.getElementById("statusPage");
  if (!page) {
    page = document.createElement("section");
    page.id = "statusPage";
    page.className = "table-page";
    page.innerHTML = `
      <div class="card table-card">
        <div class="table-card-header">
          <h2 id="statusTitle"></h2>
          <div class="table-card-tools">
            <button class="btn-export" id="btnCopyAllStatus" type="button">📋 Copiar todas</button>
            <button class="btn-back" onclick="voltarDashboard()">⬅ Voltar</button>
          </div>
        </div>
        <div id="statusContent"></div>
      </div>
    `;
    document.querySelector(".dashboard").appendChild(page);
  }
  page.style.display = "block";
  document.getElementById("statusTitle").innerText = `Status: ${status}`;

  const allOrders = Object.values(grouped).flat();
  const btnCopyAllStatus = document.getElementById("btnCopyAllStatus");
  if (btnCopyAllStatus) {
    btnCopyAllStatus.onclick = () => copyOrderList("todos", allOrders);
  }

  const content = document.getElementById("statusContent");
  content.innerHTML = "";
  Object.entries(grouped).forEach(([driver, orders]) => {
    const block = document.createElement("div");
    block.className = "driver-block";
    block.innerHTML = `<h3>${driver} <span class="badge">${orders.length}</span></h3>`;

    const copyBtn = document.createElement("button");
    copyBtn.className = "btn-export";
    copyBtn.type = "button";
    copyBtn.style.marginBottom = "8px";
    copyBtn.innerText = "📋 Copiar BRs";
    copyBtn.onclick = () => copyOrderList(driver, orders);
    block.appendChild(copyBtn);

    const list = document.createElement("p");
    list.innerHTML = orders.join("<br>");
    block.appendChild(list);

    content.appendChild(block);
  });
}

async function copyTextToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (err) {
    try {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      return true;
    } catch (err2) {
      console.error(err2);
      return false;
    }
  }
}

async function copyOrderList(label, orders) {
  const ok = await copyTextToClipboard(orders.join("\n"));
  if (ok) {
    toast(`${orders.length} código(s) de ${label} copiado(s) — já pode colar`, "good");
  } else {
    toast("Não foi possível copiar automaticamente — selecione manualmente", "bad");
  }
}

window.voltarDashboard = function () {
  hideStatusPage();
  homePage.style.display = "grid";
};

// ------------------------------------------------------------
// Estado inicial
// ------------------------------------------------------------
syncEmptyState();
