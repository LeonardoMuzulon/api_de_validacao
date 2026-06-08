const express = require('express');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

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

    if (
      key.includes('Observaes') ||
      key.includes('Observacoes') ||
      key.includes('Observação') ||
      key.includes('Observacao')
    ) {
      observacoes = String(value || '').trim();
      continue;
    }

    if (value === null || value === undefined || value === '') continue;

    const macro = extractMacroFromKey(key);
    const micro = normalizeText(value);

    if (!macro || !micro) continue;

    motives.push({ macro, micro });
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

app.get('/', (req, res) => {
  return res.status(200).json({
    ok: true,
    message: 'API online'
  });
});

app.get('/health', (req, res) => {
  return res.status(200).json({
    ok: true,
    service: 'api-flow-parser',
    timestamp: new Date().toISOString()
  });
});

app.post('/extrair-respostas', (req, res) => {
  try {
    const { respostas } = req.body || {};

    if (!respostas) {
      return res.status(400).json({
        ok: false,
        error: "O campo 'respostas' é obrigatório."
      });
    }

    let parsedAnswers;

    if (typeof respostas === 'string') {
      parsedAnswers = JSON.parse(respostas);
    } else if (typeof respostas === 'object' && respostas !== null) {
      parsedAnswers = respostas;
    } else {
      return res.status(400).json({
        ok: false,
        error: "O campo 'respostas' deve ser um objeto JSON ou uma string JSON válida."
      });
    }

    const formattedAnswers = extractMotives(parsedAnswers);

    return res.status(200).json({
      ok: true,
      respostas: formattedAnswers
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: 'Erro ao processar as respostas.',
      details: error.message
    });
  }
});

app.use((req, res) => {
  return res.status(404).json({
    ok: false,
    error: 'Rota não encontrada.'
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`API rodando na porta ${PORT}`);
});
