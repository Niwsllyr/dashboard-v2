// ============================================================
// cepresolver.js — resolução automática de CEP -> Cidade/UF via ViaCEP
// Cache em memória + cache persistente (localStorage) entre sessões
// ============================================================

const memoryCache = new Map();
const STORAGE_KEY = "xpt_cep_cache_v1";

function loadPersistentCache() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    Object.entries(parsed).forEach(([cep, city]) => memoryCache.set(cep, city));
  } catch {
    // cache corrompido ou indisponível — segue sem ele
  }
}

function savePersistentCache() {
  try {
    const obj = Object.fromEntries(memoryCache);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
  } catch {
    // localStorage indisponível (modo privado, quota etc.) — ignora
  }
}

loadPersistentCache();

function cleanCep(value) {
  if (!value) return null;
  const digits = value.toString().replace(/\D/g, "");
  return digits.length === 8 ? digits : null;
}

async function resolveOne(rawCep) {
  const cep = cleanCep(rawCep);
  if (!cep) return null;
  if (memoryCache.has(cep)) return memoryCache.get(cep);

  try {
    const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
    const data = await response.json();
    if (data.erro) {
      memoryCache.set(cep, null);
      return null;
    }
    const city = data.localidade ? `${data.localidade} - ${data.uf}` : null;
    memoryCache.set(cep, city);
    return city;
  } catch (err) {
    console.warn("Falha ao consultar CEP", rawCep, err);
    memoryCache.set(cep, null);
    return null;
  }
}

/**
 * Resolve uma lista de CEPs para cidades, em lotes paralelos, reportando progresso.
 * @param {Array<string>} ceps
 * @param {(done:number, total:number)=>void} onProgress
 * @returns {Promise<Object>} mapa cep -> "Cidade - UF"
 */
async function resolveCepsToCities(ceps, onProgress) {
  const unique = [...new Set(ceps.filter(Boolean))];
  const result = {};
  const BATCH_SIZE = 8;
  let done = 0;

  for (let i = 0; i < unique.length; i += BATCH_SIZE) {
    const batch = unique.slice(i, i + BATCH_SIZE);
    await Promise.all(
      batch.map(async (cep) => {
        const city = await resolveOne(cep);
        result[cep] = city || "CEP não encontrado";
        done++;
        onProgress && onProgress(done, unique.length);
      })
    );
  }

  savePersistentCache();
  return result;
}

export { resolveCepsToCities };
