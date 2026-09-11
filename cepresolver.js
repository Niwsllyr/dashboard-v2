// =====================================================
// cepResolver.js
// Resolve CEPs (Código de Endereçamento Postal) para o
// nome da cidade usando a API pública e gratuita ViaCEP.
// Não precisa de chave/token. Documentação: https://viacep.com.br
// =====================================================

// Cache em memória: evita consultar o mesmo CEP mais de uma vez
const cepCache = new Map();

/**
 * Limpa o CEP, deixando só os 8 dígitos que a API exige.
 * Retorna null se não for um CEP válido (8 dígitos).
 */
function normalizeCep(cep) {
  if (!cep) return null;
  const digits = cep.toString().replace(/\D/g, '');
  if (digits.length !== 8) return null;
  return digits;
}

/**
 * Consulta um único CEP na API ViaCEP.
 * Retorna algo como "Bacabal - MA" ou null se não encontrado.
 */
async function fetchCepCity(cep) {
  const digits = normalizeCep(cep);
  if (!digits) return null;

  if (cepCache.has(digits)) {
    return cepCache.get(digits);
  }

  try {
    const response = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
    const data = await response.json();

    // A API retorna { erro: true } quando o CEP não existe
    if (data.erro) {
      cepCache.set(digits, null);
      return null;
    }

    const city = data.localidade
      ? `${data.localidade} - ${data.uf}`
      : null;

    cepCache.set(digits, city);
    return city;

  } catch (err) {
    console.warn('Falha ao consultar CEP', cep, err);
    cepCache.set(digits, null);
    return null;
  }
}

/**
 * Recebe uma lista de CEPs (como aparecem na planilha, pode ter
 * repetidos) e devolve um objeto { cepOriginal: "Cidade - UF" }.
 *
 * - Consultas em lotes pequenos (para não sobrecarregar a API)
 * - CEP repetido só é consultado uma vez (cache)
 * - onProgress(feitos, total) é chamado a cada lote, opcional,
 *   útil para mostrar "Resolvendo CEPs... 40/120" na tela.
 */
export async function resolveCepsToCities(cepList, onProgress) {
  const uniqueCeps = [...new Set(cepList.filter(Boolean))];
  const result = {};

  const BATCH_SIZE = 8;
  let done = 0;

  for (let i = 0; i < uniqueCeps.length; i += BATCH_SIZE) {
    const batch = uniqueCeps.slice(i, i + BATCH_SIZE);

    await Promise.all(batch.map(async (cepOriginal) => {
      const city = await fetchCepCity(cepOriginal);
      result[cepOriginal] = city || 'CEP não encontrado';
      done++;
      if (onProgress) onProgress(done, uniqueCeps.length);
    }));
  }

  return result;
}