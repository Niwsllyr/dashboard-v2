// ============================================================
// csvReader.js — leitura de arquivos CSV exportados do SPX
//
// Usa "worker: true" do PapaParse: a leitura pesada roda em
// segundo plano (outra thread do navegador), então a tela não
// trava mais quando o arquivo tem muitas linhas (10 mil+).
//
// Detalhe técnico: com worker:true não dá pra usar a função
// "transformHeader" (funções não podem ser mandadas pra dentro
// do worker) — por isso o "aparar espaços do cabeçalho" agora é
// feito DEPOIS que o arquivo já terminou de ser lido, é uma
// operação rápida que não trava nada.
// ============================================================

function processCSV(file) {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      worker: true,
      complete: (result) => {
        const camposOriginais = result.meta.fields || [];
        const camposLimpos = camposOriginais.map((h) => (h || "").trim());

        const precisaCorrigir = camposOriginais.some((h, i) => h !== camposLimpos[i]);

        let dados = result.data;

        if (precisaCorrigir) {
          dados = result.data.map((linha) => {
            const nova = {};
            camposOriginais.forEach((h, i) => {
              nova[camposLimpos[i]] = linha[h];
            });
            return nova;
          });
        }

        resolve({ data: dados, fields: camposLimpos });
      },
      error: (err) => reject(err),
    });
  });
}

export { processCSV };
