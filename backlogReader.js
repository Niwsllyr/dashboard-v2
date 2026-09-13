// ============================================================
// backlogReader.js — leitura de arquivos de Backlog (.xlsx ou .csv)
// Traz envelhecimento (aging) e tentativas de entrega dos pacotes pendentes
// ============================================================

function processBacklogFile(file) {
  const name = (file.name || "").toLowerCase();

  if (name.endsWith(".csv")) {
    return new Promise((resolve, reject) => {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (h) => h.trim(),
        complete: (result) => resolve({ data: result.data, fields: result.meta.fields || [] }),
        error: (err) => reject(err),
      });
    });
  }

  // .xlsx / .xls
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const workbook = XLSX.read(e.target.result, { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json(sheet, { defval: "", raw: false });
        const fields = json.length ? Object.keys(json[0]) : [];
        resolve({ data: json, fields });
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error("Falha ao ler o arquivo de backlog"));
    reader.readAsArrayBuffer(file);
  });
}

export { processBacklogFile };