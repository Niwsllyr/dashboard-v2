export function calculateMetrics(data, mode = 'SLA', cepToCity = {}) {

  let total = 0;
  let delivered = 0;
  let onHold = 0;

  const statusMap = {};
  const driverMap = {};
  const cityMapInternal = {};

  data.forEach(row => {

    const status = row['Status'];
    const driver = row['Driver Name'];
    const city = cepToCity[row['Postal Code']];

    if (!status) return;

    const cleanStatus = status.toString().trim();
    const statusLower = cleanStatus.toLowerCase();

    total++;

    statusMap[cleanStatus] =
      (statusMap[cleanStatus] || 0) + 1;

    if (statusLower === 'onhold') {
      onHold++;
    }

    const isDelivered =
      statusLower === 'delivered' ||
      statusLower.endsWith('_delivered');

    if (isDelivered) {
      delivered++;
    }

    /* =========================
       DRIVER
    ========================= */
    if (driver) {
      if (!driverMap[driver]) {
        driverMap[driver] = { total: 0, delivered: 0 };
      }

      // 🔥 SLA ignora OnHold | DS considera tudo
      if (mode === 'SLA') {
        if (statusLower !== 'onhold') {
          driverMap[driver].total++;
        }
      } else {
        driverMap[driver].total++;
      }

      if (isDelivered) {
        driverMap[driver].delivered++;
      }
    }

    /* =========================
       CITY
    ========================= */
    if (city) {
      if (!cityMapInternal[city]) {
        cityMapInternal[city] = { total: 0, delivered: 0 };
      }

      if (mode === 'SLA') {
        if (statusLower !== 'onhold') {
          cityMapInternal[city].total++;
        }
      } else {
        cityMapInternal[city].total++;
      }

      if (isDelivered) {
        cityMapInternal[city].delivered++;
      }
    }

  });

  /* =========================
     🔥 DIFERENÇA PRINCIPAL
  ========================= */

  let validBase;

  if (mode === 'SLA') {
    validBase = total - onHold; // ignora OnHold
  } else {
    validBase = total; // DS considera tudo
  }

  const pending = validBase - delivered;

  const sla = validBase > 0
    ? ((delivered / validBase) * 100).toFixed(2)
    : 0;

  const driverSLA = Object.entries(driverMap).map(([name, info]) => ({
    name,
    total: info.total,
    delivered: info.delivered,
    pending: info.total - info.delivered,
    sla: info.total > 0
      ? ((info.delivered / info.total) * 100).toFixed(1)
      : 0
  }));

  const citySLA = Object.entries(cityMapInternal).map(([name, info]) => ({
    name,
    total: info.total,
    delivered: info.delivered,
    pending: info.total - info.delivered,
    sla: info.total > 0
      ? ((info.delivered / info.total) * 100).toFixed(1)
      : 0
  }));

  return {
    total: validBase,
    delivered,
    pending,
    sla,
    statusMap,
    driverSLA,
    citySLA
  };
}