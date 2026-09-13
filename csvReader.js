// ============================================================
// csvReader.js — leitura de arquivos CSV exportados do SPX
// ============================================================

function processCSV(file) {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim(),
      complete: (result) => {
        resolve({ data: result.data, fields: result.meta.fields || [] });
      },
      error: (err) => reject(err),
    });
  });
}

export { processCSV };
