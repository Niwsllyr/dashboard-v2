// ============================================================
// metrics.js — motor de cálculo de SLA / DS / Score / Insights
// ============================================================

/**
 * Calcula os números centrais (total, entregues, pendentes, SLA%)
 * a partir de uma lista de pedidos, agrupando por entregador e por cidade.
 *
 * @param {Array<Object>} rows      linhas do CSV (SLA ou DS)
 * @param {"SLA"|"DS"}    mode      SLA desconta ocorrências (OnHold) do total; DS não
 * @param {Object}        cepToCity mapa CEP -> cidade já resolvido
 */
function calculateMetrics(rows, mode = "SLA", cepToCity = {}) {
  let total = 0;
  let delivered = 0;
  let onHoldCount = 0;

  const statusMap = {};
  const byDriver = {};
  const byCity = {};

  rows.forEach((row) => {
    const rawStatus = row.Status;
    if (!rawStatus) return;

    const driver = row["Driver Name"];
    const city = cepToCity[row["Postal Code"]];
    const status = rawStatus.toString().trim();
    const statusKey = status.toLowerCase();

    total++;
    statusMap[status] = (statusMap[status] || 0) + 1;
    if (statusKey === "onhold") onHoldCount++;

    const isDelivered = statusKey === "delivered" || statusKey.endsWith("_delivered");
    if (isDelivered) delivered++;

    if (driver) {
      if (!byDriver[driver]) byDriver[driver] = { total: 0, delivered: 0 };
      const countsForDenominator = mode === "SLA" ? statusKey !== "onhold" : true;
      if (countsForDenominator) byDriver[driver].total++;
      if (isDelivered) byDriver[driver].delivered++;
    }

    if (city) {
      if (!byCity[city]) byCity[city] = { total: 0, delivered: 0 };
      const countsForDenominator = mode === "SLA" ? statusKey !== "onhold" : true;
      if (countsForDenominator) byCity[city].total++;
      if (isDelivered) byCity[city].delivered++;
    }
  });

  const denominator = mode === "SLA" ? total - onHoldCount : total;
  const pending = denominator - delivered;
  const sla = denominator > 0 ? (delivered / denominator * 100).toFixed(2) : "0.00";

  const toRankedArray = (map) =>
    Object.entries(map).map(([name, stats]) => ({
      name,
      total: stats.total,
      delivered: stats.delivered,
      pending: stats.total - stats.delivered,
      sla: stats.total > 0 ? (stats.delivered / stats.total * 100).toFixed(1) : "0.0",
    }));

  return {
    total: denominator,
    delivered,
    pending,
    sla,
    onHoldCount,
    statusMap,
    driverSLA: toRankedArray(byDriver),
    citySLA: toRankedArray(byCity),
  };
}

/**
 * Índice composto de saúde da operação (0–100), combinando SLA e DS
 * com uma penalidade por volume de ocorrências (OnHold).
 * Pensado para dar, num único número, a resposta a "como estamos indo hoje?".
 */
function calculateOperationScore(slaMetrics, dsMetrics) {
  const sla = parseFloat(slaMetrics?.sla) || 0;
  const ds = parseFloat(dsMetrics?.sla) || 0;
  const totalBase = (slaMetrics?.total || 0) + (slaMetrics?.onHoldCount || 0);
  const onHoldRate = totalBase > 0 ? (slaMetrics.onHoldCount / totalBase) * 100 : 0;

  const raw = sla * 0.5 + ds * 0.4 - onHoldRate * 0.6;
  const score = Math.max(0, Math.min(100, raw));

  let grade = "D";
  if (score >= 97) grade = "A+";
  else if (score >= 93) grade = "A";
  else if (score >= 87) grade = "B";
  else if (score >= 78) grade = "C";

  return { score: score.toFixed(1), grade, onHoldRate: onHoldRate.toFixed(1) };
}

/**
 * Gera uma lista de insights curtos e legíveis a partir das métricas já calculadas.
 * Cada insight tem um tom (good | warn | bad | info) usado para colorir o feed.
 */
function calculateInsights(slaMetrics, dsMetrics, opScore) {
  const insights = [];

  const rankedCities = [...(slaMetrics.citySLA || [])]
    .filter((c) => c.total >= 3)
    .sort((a, b) => b.sla - a.sla);

  if (rankedCities.length) {
    const best = rankedCities[0];
    insights.push({
      tone: "good",
      text: `${best.name} lidera o SLA com ${best.sla}% (${best.delivered}/${best.total})`,
    });
    const worst = rankedCities[rankedCities.length - 1];
    if (worst && worst.name !== best.name && parseFloat(worst.sla) < 95) {
      insights.push({
        tone: "bad",
        text: `${worst.name} precisa de atenção: SLA em ${worst.sla}% (${worst.delivered}/${worst.total})`,
      });
    }
  }

  const rankedDrivers = [...(slaMetrics.driverSLA || [])]
    .filter((d) => d.total >= 3)
    .sort((a, b) => b.sla - a.sla);

  if (rankedDrivers.length) {
    const top = rankedDrivers[0];
    insights.push({
      tone: "good",
      text: `${top.name} é o destaque da rota com ${top.sla}% de entregas no prazo`,
    });
  }

  if (slaMetrics.onHoldCount > 0) {
    const rate = slaMetrics.total > 0
      ? (slaMetrics.onHoldCount / (slaMetrics.total + slaMetrics.onHoldCount) * 100).toFixed(1)
      : "0.0";
    insights.push({
      tone: slaMetrics.onHoldCount > 5 ? "bad" : "warn",
      text: `${slaMetrics.onHoldCount} ocorrência(s) em aberto (${rate}% da base)`,
    });
  }

  if (dsMetrics && dsMetrics.total > 0) {
    const diff = (parseFloat(dsMetrics.sla) - parseFloat(slaMetrics.sla)).toFixed(1);
    if (Math.abs(diff) >= 1) {
      insights.push({
        tone: diff > 0 ? "good" : "warn",
        text: `DS está ${diff > 0 ? diff + " pts acima" : Math.abs(diff) + " pts abaixo"} do SLA`,
      });
    }
  }

  insights.push({
    tone: opScore.score >= 93 ? "good" : opScore.score >= 78 ? "warn" : "bad",
    text: `Score de operação: ${opScore.score} (${opScore.grade})`,
  });

  return insights;
}

export { calculateMetrics, calculateOperationScore, calculateInsights };
