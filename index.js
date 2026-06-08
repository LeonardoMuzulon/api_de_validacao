function normalizeText(value = '') {
  return String(value)
    .replace(/^\d+_/, '')
    .replace(/_/g, ' ')
    .trim();
}

const MACRO_MAP = {
  Financeiro: 'Financeiro',
  Pedaggico: 'Pedagógico',
  Pedagogico: 'Pedagógico',
  Atendimento: 'Atendimento',
  Pessoal: 'Pessoal',
  Problemas_Tcnicos: 'Problemas técnicos',
  Problemas_Tecnicos: 'Problemas técnicos',
  Concorrncia: 'Concorrência',
  Concorrencia: 'Concorrência'
};

function extractMacroFromKey(key) {
  const match = String(key).match(/^screen_\d+_(.+)_\d+$/);

  if (!match) return '';

  const macroKey = match[1];

  return MACRO_MAP[macroKey] || normalizeText(macroKey);
}

function extractMotives(flowAnswers) {
  const result = {};
  const motives = [];
  let observacoes = '';

  for (const [key, value] of Object.entries(flowAnswers || {})) {
    if (key === 'flow_token') continue;

    if (key === 'screen_1_Observaes_0') {
      observacoes = String(value || '');
      continue;
    }

    if (value === null || value === undefined || value === '') continue;

    const macro = extractMacroFromKey(key);
    const micro = normalizeText(value);

    if (!macro || !micro) continue;

    motives.push({
      macro,
      micro
    });
  }

  motives.forEach((item, index) => {
    const position = index + 1;
    result[`MotivoMacro${position}`] = item.macro;
    result[`MotivoMicro${position}`] = item.micro;
  });

  result.quantidadeMotivos = String(motives.length);
  result.observacoes = observacoes;

  return result;
}
