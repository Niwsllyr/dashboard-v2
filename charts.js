// ============================================================
// charts.js — gráficos de status (barra) e ranking (barra horizontal)
// ============================================================

let statusChart, rankingChart;

const STATUS_LABELS = {
  Delivered: "Entregue",
  Delivering: "Em Rota",
  Hub_Assigned: "Hub Atribuído",
  Hub_Received: "Recebido no Hub",
  LM_Hub_InTransit: "Em Transferência",
  OnHold: "Ocorrência",
};

const STATUS_COLORS = {
  Delivered: "#22c55e",
  Delivering: "#facc15",
};

function statusColor(status) {
  return STATUS_COLORS[status] || "#ef4444";
}

function renderCharts(metrics, mode = "default", ctx = {}) {
  if (statusChart) statusChart.destroy();
  if (rankingChart) rankingChart.destroy();

  const isLight = document.documentElement.getAttribute("data-theme") === "light";
  const gridColor = isLight ? "rgba(0,0,0,0.10)" : "rgba(255,255,255,0.06)";
  const tickColor = isLight ? "#333333" : "#cccccc";

  const statusFilter = ctx.status || "";
  const cepToCity = ctx.cepToCity || {};

  // ---------- Gráfico de status (barras verticais) ----------
  const statusEntries = Object.entries(metrics.statusMap || {}).filter(
    ([key]) => key && key !== "undefined"
  );
  const statusLabels = statusEntries.map(([key]) => STATUS_LABELS[key] || key);
  const statusValues = statusEntries.map(([, value]) => Number(value) || 0);
  const statusBarColors = statusEntries.map(([key]) => statusColor(key));

  statusChart = new Chart(document.getElementById("barChart"), {
    type: "bar",
    data: {
      labels: statusLabels,
      datasets: [
        {
          label: "Quantidade",
          data: statusValues,
          backgroundColor: statusBarColors,
          borderRadius: 8,
          maxBarThickness: 56,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 500, easing: "easeOutQuart" },
      onClick: (evt, elements) => {
        if (elements.length > 0) {
          const idx = elements[0].index;
          const statusKey = statusEntries[idx][0];
          window.handleStatusClick && window.handleStatusClick(statusKey);
        }
      },
      interaction: { mode: "index", intersect: false },
      hover: { mode: "index", intersect: false },
      scales: {
        y: { beginAtZero: true, grid: { color: gridColor }, ticks: { color: tickColor } },
        x: { grid: { display: false }, ticks: { color: tickColor } },
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          enabled: true,
          backgroundColor: "#1a0000",
          titleColor: "#fff",
          bodyColor: "#fff",
          borderColor: "#b30000",
          borderWidth: 1,
          padding: 10,
          displayColors: false,
          callbacks: {
            label: (item) => `📦 ${item.raw} pedidos`,
          },
        },
      },
    },
  });

  // ---------- Gráfico de ranking (barras horizontais) ----------
  let rankLabels = [];
  let rankValues = [];
  let rankSubLabels = [];
  let rankTitle = "";
  let rankColors = [];

  if (mode === "DS" || mode === "MANIFESTO") {
    rankTitle = "Performance por Cidade (%)";
    const cityStats = {};
    (ctx.rawData || []).forEach((row) => {
      const cep = row["Postal Code"];
      const city = cepToCity[cep] || cep;
      if (!city) return;
      if (!cityStats[city]) cityStats[city] = { total: 0, delivered: 0 };
      cityStats[city].total++;
      if (row.Status === "Delivered") cityStats[city].delivered++;
    });
    const ranked = Object.entries(cityStats)
      .map(([name, s]) => ({
        name,
        percent: s.total ? (s.delivered / s.total) * 100 : 0,
        total: s.total,
        delivered: s.delivered,
      }))
      .sort((a, b) => b.percent - a.percent);
    rankLabels = ranked.map((r) => r.name);
    rankValues = ranked.map((r) => r.percent);
    rankSubLabels = ranked.map((r) => `${r.delivered}/${r.total}`);
    rankColors = ranked.map((r) => gradeColor(r.percent, ctx.goal));
  } else if (statusFilter === "OnHold") {
    rankTitle = "Ocorrências por Entregador (%)";
    const counts = {};
    (ctx.rawData || []).forEach((row) => {
      const driver = row["Driver Name"];
      if (row.Status === "OnHold" && driver) counts[driver] = (counts[driver] || 0) + 1;
    });
    const totalOccurrences = Object.values(counts).reduce((a, b) => a + b, 0);
    const ranked = Object.entries(counts)
      .map(([name, total]) => ({
        name,
        total,
        percent: totalOccurrences ? (total / totalOccurrences) * 100 : 0,
      }))
      .sort((a, b) => b.percent - a.percent);
    rankLabels = ranked.map((r) => r.name);
    rankSubLabels = ranked.map((r) => r.total);
    rankValues = ranked.map((r) => r.percent);
    rankColors = ranked.map(() => "#ef4444");
  } else {
    rankTitle = "SLA por Cidade (%)";
    const ranked = (metrics.citySLA || [])
      .filter((c) => c.name)
      .map((c) => ({ name: c.name, percent: Number(c.sla) || 0, total: c.total || 0 }))
      .sort((a, b) => b.percent - a.percent);
    rankLabels = ranked.map((r) => r.name);
    rankSubLabels = ranked.map((r) => `${r.total}`);
    rankValues = ranked.map((r) => r.percent);
    rankColors = ranked.map((r) => gradeColor(r.percent, ctx.goal));
  }

  if (!rankLabels.length) {
    rankLabels = ["Sem dados"];
    rankValues = [0];
    rankSubLabels = ["0/0"];
    rankColors = ["#3a3a3a"];
  }

  rankingChart = new Chart(document.getElementById("pieChart"), {
    type: "bar",
    data: {
      labels: rankLabels,
      datasets: [
        {
          label: rankTitle,
          data: rankValues,
          backgroundColor: rankColors,
          borderRadius: 6,
          barThickness: 16,
        },
      ],
    },
    options: {
      indexAxis: "y",
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 500, easing: "easeOutQuart" },
      onClick: (evt, elements) => {
        if (elements.length > 0) {
          const idx = elements[0].index;
          const label = rankLabels[idx];
          window.handleRankingClick && window.handleRankingClick(label, mode, statusFilter);
        }
      },
      onHover: (evt, elements) => {
        evt.native.target.style.cursor = elements.length ? "pointer" : "default";
      },
      scales: {
        x: {
          beginAtZero: true,
          max: mode === "OnHold_PERCENT" ? undefined : 100,
          ticks: { callback: (v) => v + "%", color: tickColor },
          grid: { color: gridColor },
        },
        y: { grid: { display: false }, ticks: { color: tickColor } },
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (item) => `${rankValues[item.dataIndex].toFixed(2)}% (${rankSubLabels[item.dataIndex]})`,
          },
        },
      },
    },
  });
}

function gradeColor(percent) {
  if (percent >= 98) return "#22c55e";
  if (percent >= 97) return "#facc15";
  return "#ef4444";
}

// ------------------------------------------------------------
// Gráficos da aba Backlog (envelhecimento e tentativas)
// ------------------------------------------------------------
let backlogAgingChart, backlogHandlerChart;

function agingRankOf(bucket) {
  const b = (bucket || "").toString();
  if (b.includes(">6")) return 3;
  if (b.includes("3 days, 6") || b.includes("3 dias, 6")) return 2;
  if (b.includes("1 day, 3") || b.includes("1 dia, 3")) return 1;
  return 0;
}

function extractHandlerNameLocal(raw) {
  return (raw || "").toString().replace(/^\[\d+\]\s*/, "").trim();
}

function renderBacklogCharts(rows) {
  if (backlogAgingChart) backlogAgingChart.destroy();
  if (backlogHandlerChart) backlogHandlerChart.destroy();

  const isLight = document.documentElement.getAttribute("data-theme") === "light";
  const gridColor = isLight ? "rgba(0,0,0,0.10)" : "rgba(255,255,255,0.06)";
  const tickColor = isLight ? "#333333" : "#cccccc";

  const agingCounts = [0, 0, 0, 0];
  const handlerCounts = {};
  rows.forEach((r) => {
    agingCounts[agingRankOf(r["LM Leg Aging"])]++;
    const handler = extractHandlerNameLocal(r["Latest User Name"]) || "Sem responsável";
    handlerCounts[handler] = (handlerCounts[handler] || 0) + 1;
  });

  const agingCanvas = document.getElementById("backlogAgingChart");
  if (agingCanvas) {
    backlogAgingChart = new Chart(agingCanvas, {
      type: "bar",
      data: {
        labels: ["Sem atraso", "1 a 3 dias", "3 a 6 dias", "Mais de 6 dias"],
        datasets: [
          {
            label: "Pacotes",
            data: agingCounts,
            backgroundColor: ["#22c55e", "#facc15", "#fb923c", "#ef4444"],
            borderRadius: 8,
            maxBarThickness: 56,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 500, easing: "easeOutQuart" },
        onClick: (evt, elements) => {
          if (elements.length > 0) {
            const idx = elements[0].index;
            window.handleBacklogAgingClick && window.handleBacklogAgingClick(idx);
          }
        },
        onHover: (evt, elements) => {
          evt.native.target.style.cursor = elements.length ? "pointer" : "default";
        },
        scales: {
          y: { beginAtZero: true, grid: { color: gridColor }, ticks: { color: tickColor } },
          x: { grid: { display: false }, ticks: { color: tickColor } },
        },
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: (item) => `${item.raw} pacotes — clique pra filtrar` } },
        },
      },
    });
  }

  const ranked = Object.entries(handlerCounts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  const handlerCanvas = document.getElementById("backlogHandlerChart");
  if (handlerCanvas) {
    const labels = ranked.length ? ranked.map((r) => r.name) : ["Sem dados"];
    const values = ranked.length ? ranked.map((r) => r.count) : [0];
    backlogHandlerChart = new Chart(handlerCanvas, {
      type: "bar",
      data: {
        labels,
        datasets: [
          {
            label: "Backlog por Entregador Atual",
            data: values,
            backgroundColor: "#ef4444",
            borderRadius: 6,
            barThickness: 16,
          },
        ],
      },
      options: {
        indexAxis: "y",
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 500, easing: "easeOutQuart" },
        onClick: (evt, elements) => {
          if (elements.length > 0 && labels[elements[0].index] !== "Sem dados") {
            window.handleBacklogHandlerClick && window.handleBacklogHandlerClick(labels[elements[0].index]);
          }
        },
        onHover: (evt, elements) => {
          evt.native.target.style.cursor = elements.length ? "pointer" : "default";
        },
        scales: {
          x: { beginAtZero: true, grid: { color: gridColor }, ticks: { color: tickColor } },
          y: { grid: { display: false }, ticks: { color: tickColor } },
        },
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: (item) => `${item.raw} pacote(s) parado(s) — clique pra filtrar` } },
        },
      },
    });
  }
}

export { renderCharts, renderBacklogCharts, renderPnrCharts };

// ------------------------------------------------------------
// Gráficos da aba PNR (prazo de SLA e valor em risco)
// ------------------------------------------------------------
let pnrDeadlineChart, pnrDriverChart;

function pnrUrgencyRank(diffDays) {
  if (diffDays < 0) return 3;
  if (diffDays < 1) return 2;
  if (diffDays < 3) return 1;
  return 0;
}

function renderPnrCharts(rows) {
  if (pnrDeadlineChart) pnrDeadlineChart.destroy();
  if (pnrDriverChart) pnrDriverChart.destroy();

  const isLight = document.documentElement.getAttribute("data-theme") === "light";
  const gridColor = isLight ? "rgba(0,0,0,0.10)" : "rgba(255,255,255,0.06)";
  const tickColor = isLight ? "#333333" : "#cccccc";

  const urgencyCounts = [0, 0, 0, 0];
  const driverValue = {};
  rows.forEach((r) => {
    urgencyCounts[pnrUrgencyRank(r.__diffDays)]++;
    const name = r.__driverName || "Sem entregador";
    driverValue[name] = (driverValue[name] || 0) + (parseFloat(r["PNR Order Value"]) || 0);
  });

  const deadlineCanvas = document.getElementById("pnrDeadlineChart");
  if (deadlineCanvas) {
    pnrDeadlineChart = new Chart(deadlineCanvas, {
      type: "bar",
      data: {
        labels: ["Tranquilo (+3 dias)", "Atenção (1 a 3 dias)", "Urgente (menos de 1 dia)", "Vencido"],
        datasets: [
          {
            label: "PNR",
            data: urgencyCounts,
            backgroundColor: ["#22c55e", "#facc15", "#fb923c", "#ef4444"],
            borderRadius: 8,
            maxBarThickness: 56,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 500, easing: "easeOutQuart" },
        onClick: (evt, elements) => {
          if (elements.length > 0) {
            window.handlePnrDeadlineClick && window.handlePnrDeadlineClick(elements[0].index);
          }
        },
        onHover: (evt, elements) => {
          evt.native.target.style.cursor = elements.length ? "pointer" : "default";
        },
        scales: {
          y: { beginAtZero: true, grid: { color: gridColor }, ticks: { color: tickColor } },
          x: { grid: { display: false }, ticks: { color: tickColor } },
        },
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: (item) => `${item.raw} PNR — clique pra filtrar` } },
        },
      },
    });
  }

  const ranked = Object.entries(driverValue)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 10);

  const driverCanvas = document.getElementById("pnrDriverChart");
  if (driverCanvas) {
    const labels = ranked.length ? ranked.map((r) => r.name) : ["Sem dados"];
    const values = ranked.length ? ranked.map((r) => Number(r.value.toFixed(2))) : [0];
    pnrDriverChart = new Chart(driverCanvas, {
      type: "bar",
      data: {
        labels,
        datasets: [
          {
            label: "Valor em Risco por Entregador",
            data: values,
            backgroundColor: "#ef4444",
            borderRadius: 6,
            barThickness: 16,
          },
        ],
      },
      options: {
        indexAxis: "y",
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 500, easing: "easeOutQuart" },
        onClick: (evt, elements) => {
          if (elements.length > 0 && labels[elements[0].index] !== "Sem dados") {
            window.handlePnrDriverClick && window.handlePnrDriverClick(labels[elements[0].index]);
          }
        },
        onHover: (evt, elements) => {
          evt.native.target.style.cursor = elements.length ? "pointer" : "default";
        },
        scales: {
          x: { beginAtZero: true, grid: { color: gridColor }, ticks: { color: tickColor } },
          y: { grid: { display: false }, ticks: { color: tickColor } },
        },
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: (item) => `R$ ${item.raw.toFixed(2).replace(".", ",")} — clique pra filtrar` } },
        },
      },
    });
  }
}

// ------------------------------------------------------------
// Curva de entregas por horário (6h às 22h, de hora em hora):
// quantos pacotes viraram "Delivered" em cada hora, e quantos
// saíram pra rota (Pick Up Time) em cada hora. O campo
// "Delivering Time" do SPX nunca vem preenchido de verdade, então
// "Pick Up Time" (quando o motorista pegou o pacote no hub) é quem
// representa "começou a estar em rota".
// ------------------------------------------------------------
let hourlyDeliveryChart;

const HOURLY_START = 6;
const HOURLY_END = 22;

function parseSpxDateTime(value) {
  if (!value) return null;
  const str = value.toString().trim();
  // formato do SPX: "DD-MM-YYYY HH:MM"
  const m = str.match(/^(\d{2})-(\d{2})-(\d{4})\s+(\d{2}):(\d{2})/);
  if (!m) return null;
  const [, dd, mm, yyyy, hh, min] = m;
  return new Date(Number(yyyy), Number(mm) - 1, Number(dd), Number(hh), Number(min));
}

function renderHourlyDeliveryChart(rows) {
  if (hourlyDeliveryChart) hourlyDeliveryChart.destroy();

  const canvas = document.getElementById("hourlyDeliveryChart");
  if (!canvas) return;

  const isLight = document.documentElement.getAttribute("data-theme") === "light";
  const gridColor = isLight ? "rgba(0,0,0,0.10)" : "rgba(255,255,255,0.06)";
  const tickColor = isLight ? "#333333" : "#cccccc";

  const hours = [];
  for (let h = HOURLY_START; h <= HOURLY_END; h++) hours.push(h);

  const deliveredCounts = hours.map(() => 0);
  const pickupCounts = hours.map(() => 0);

  (rows || []).forEach((row) => {
    const delivered = parseSpxDateTime(row["Delivered Time"]);
    if (delivered) {
      const h = delivered.getHours();
      if (h >= HOURLY_START && h <= HOURLY_END) deliveredCounts[h - HOURLY_START]++;
    }
    const pickup = parseSpxDateTime(row["Pick Up Time"]);
    if (pickup) {
      const h = pickup.getHours();
      if (h >= HOURLY_START && h <= HOURLY_END) pickupCounts[h - HOURLY_START]++;
    }
  });

  const labels = hours.map((h) => `${h.toString().padStart(2, "0")}h`);

  hourlyDeliveryChart = new Chart(canvas, {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "Entregues (Delivered)",
          data: deliveredCounts,
          borderColor: "#22c55e",
          backgroundColor: "rgba(34,197,94,0.15)",
          tension: 0.3,
          fill: true,
          pointRadius: 3,
        },
        {
          label: "Saíram pra rota (Pick Up)",
          data: pickupCounts,
          borderColor: "#facc15",
          backgroundColor: "rgba(250,204,21,0.15)",
          tension: 0.3,
          fill: true,
          pointRadius: 3,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 500, easing: "easeOutQuart" },
      interaction: { mode: "index", intersect: false },
      scales: {
        y: { beginAtZero: true, grid: { color: gridColor }, ticks: { color: tickColor } },
        x: { grid: { display: false }, ticks: { color: tickColor } },
      },
      plugins: {
        legend: { display: true, labels: { color: tickColor } },
        tooltip: {
          callbacks: {
            label: (item) => `${item.dataset.label}: ${item.raw} pacote(s)`,
          },
        },
      },
    },
  });
}

export { renderHourlyDeliveryChart };

// Força todos os gráficos que já existem a medir o tamanho da caixa
// de novo. Necessário porque o Chart.js usa ResizeObserver (não
// escuta o evento de resize da janela) — então trocar de layout via
// CSS (como o Modo TV faz) não é percebido sozinho.
function resizeAllCharts() {
  [
    statusChart,
    rankingChart,
    backlogAgingChart,
    backlogHandlerChart,
    pnrDeadlineChart,
    pnrDriverChart,
    hourlyDeliveryChart,
  ].forEach((chart) => {
    if (chart && typeof chart.resize === "function") {
      try {
        chart.resize();
      } catch {}
    }
  });
}

export { resizeAllCharts };

// ------------------------------------------------------------
// Gráficos da aba "Análise de OP" — evolução de SLA%, DS% e PNR
// (quantidade + valor em risco) dia a dia, num intervalo escolhido
// ------------------------------------------------------------
let opSlaChart, opDsChart, opPnrChart;

function renderOpTimelineCharts(pontos) {
  if (opSlaChart) opSlaChart.destroy();
  if (opDsChart) opDsChart.destroy();
  if (opPnrChart) opPnrChart.destroy();

  const isLight = document.documentElement.getAttribute("data-theme") === "light";
  const gridColor = isLight ? "rgba(0,0,0,0.10)" : "rgba(255,255,255,0.06)";
  const tickColor = isLight ? "#333333" : "#cccccc";

  const labels = (pontos || []).map((p) => {
    const [, mes, dia] = p.data.split("-");
    return `${dia}/${mes}`;
  });

  const slaCanvas = document.getElementById("opSlaChart");
  if (slaCanvas) {
    opSlaChart = new Chart(slaCanvas, {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            label: "SLA %",
            data: (pontos || []).map((p) => p.slaPercent),
            borderColor: "#22c55e",
            backgroundColor: "rgba(34,197,94,0.15)",
            tension: 0.3,
            fill: true,
            pointRadius: 3,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 500, easing: "easeOutQuart" },
        scales: {
          y: { beginAtZero: false, grid: { color: gridColor }, ticks: { color: tickColor, callback: (v) => v + "%" } },
          x: { grid: { display: false }, ticks: { color: tickColor } },
        },
        plugins: {
          legend: { display: true, labels: { color: tickColor } },
          tooltip: { callbacks: { label: (item) => `SLA: ${item.raw.toFixed(2)}%` } },
        },
      },
    });
  }

  const dsCanvas = document.getElementById("opDsChart");
  if (dsCanvas) {
    opDsChart = new Chart(dsCanvas, {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            label: "DS %",
            data: (pontos || []).map((p) => p.dsPercent),
            borderColor: "#facc15",
            backgroundColor: "rgba(250,204,21,0.15)",
            tension: 0.3,
            fill: true,
            pointRadius: 3,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 500, easing: "easeOutQuart" },
        scales: {
          y: { beginAtZero: false, grid: { color: gridColor }, ticks: { color: tickColor, callback: (v) => v + "%" } },
          x: { grid: { display: false }, ticks: { color: tickColor } },
        },
        plugins: {
          legend: { display: true, labels: { color: tickColor } },
          tooltip: { callbacks: { label: (item) => `DS: ${item.raw.toFixed(2)}%` } },
        },
      },
    });
  }

  const pnrCanvas = document.getElementById("opPnrChart");
  if (pnrCanvas) {
    opPnrChart = new Chart(pnrCanvas, {
      data: {
        labels,
        datasets: [
          {
            type: "bar",
            label: "PNR em aberto (qtd)",
            data: (pontos || []).map((p) => p.pnrCount),
            backgroundColor: "#ef4444",
            borderRadius: 6,
            yAxisID: "yQtd",
          },
          {
            type: "line",
            label: "Valor em risco (R$)",
            data: (pontos || []).map((p) => p.pnrValue),
            borderColor: "#38bdf8",
            backgroundColor: "rgba(56,189,248,0.15)",
            tension: 0.3,
            pointRadius: 3,
            yAxisID: "yValor",
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 500, easing: "easeOutQuart" },
        scales: {
          yQtd: {
            type: "linear",
            position: "left",
            beginAtZero: true,
            grid: { color: gridColor },
            ticks: { color: tickColor },
            title: { display: true, text: "PNR (qtd)", color: tickColor },
          },
          yValor: {
            type: "linear",
            position: "right",
            beginAtZero: true,
            grid: { display: false },
            ticks: { color: tickColor, callback: (v) => "R$ " + v },
            title: { display: true, text: "Valor em risco (R$)", color: tickColor },
          },
          x: { grid: { display: false }, ticks: { color: tickColor } },
        },
        plugins: {
          legend: { display: true, labels: { color: tickColor } },
          tooltip: {
            callbacks: {
              label: (item) => {
                if (item.dataset.yAxisID === "yValor") {
                  return `Valor em risco: R$ ${item.raw.toFixed(2).replace(".", ",")}`;
                }
                return `PNR em aberto: ${item.raw}`;
              },
            },
          },
        },
      },
    });
  }
}

export { renderOpTimelineCharts };
