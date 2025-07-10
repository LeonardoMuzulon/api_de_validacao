const express = require('express');
const axios = require('axios');

const app = express();
const port = 3000;

app.use(express.json());

// Funções auxiliares

function formatarData(data) {
  if (!data) return null;
  const limpa = data.replace(/\D/g, '');
  if (limpa.length === 8) {
    const dia = limpa.slice(0, 2);
    const mes = limpa.slice(2, 4);
    const ano = limpa.slice(4);
    // Validação simples de data plausível (ano > 1900 e < atual, mes entre 1 e 12, dia entre 1 e 31)
    const anoNum = parseInt(ano, 10);
    const mesNum = parseInt(mes, 10);
    const diaNum = parseInt(dia, 10);
    const anoAtual = new Date().getFullYear();
    if (
      anoNum >= 1900 && anoNum <= anoAtual &&
      mesNum >= 1 && mesNum <= 12 &&
      diaNum >= 1 && diaNum <= 31
    ) {
      return `${ano}-${mes}-${dia}`;
    }
  }
  return null;
}

function validarCPF(cpf) {
  return /^\d{11}$/.test(cpf);
}

function validarEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function limparTexto(texto) {
  return texto.replace(/[^a-zA-ZÀ-ÿ\s]/g, '').trim();
}

// Mapeamento nacionalidade texto -> código
function mapNacionalidadeParaCodigo(nacionalidadeTexto) {
  if (!nacionalidadeTexto) return '';
  const map = {
    'brasileiro': '1',
    'estrangeiro': '2',
    'argentino': '3',
    // adicione outras nacionalidades conforme necessário
  };
  return map[nacionalidadeTexto.toLowerCase()] || '';
}

async function buscarEndereco(cep) {
  try {
    const response = await axios.get(`https://viacep.com.br/ws/${cep}/json/`);
    if (response.data.erro) return null;
    return {
      logradouro: response.data.logradouro,
      bairro: response.data.bairro,
      cidade: response.data.localidade,
      uf: response.data.uf
    };
  } catch {
    return null;
  }
}

// Endpoint principal

app.post('/validar-dados', async (req, res) => {
  const entrada = req.body.texto || '';
  const partes = entrada.split(/\s+/);

  let cpf = null, email = null, genero = null, data_nascimento = null;
  let ano_conclusao_em = null, nacionalidade = null, forma_ingresso = null;
  let cep = null, numero_residencia = null;

  const usados = new Set();

  function marcarUsado(i) { usados.add(i); }

  const formasPossiveis = ['vestibular', 'enem', 'encceja', 'transferência', 'transferencia', '2°', '2grau', '2graduação', '2graduacao'];

  // Nacionalidades comuns para capturar texto
  const nacionalidadesPossiveis = ['brasileiro', 'estrangeiro', 'argentino', 'chileno', 'paraguaio'];

  for (let i = 0; i < partes.length; i++) {
    const p = partes[i].toLowerCase();

    if (!cpf && validarCPF(p)) {
      cpf = partes[i];
      marcarUsado(i);
      continue;
    }

    if (!email && validarEmail(p)) {
      email = partes[i];
      marcarUsado(i);
      continue;
    }

    if (!genero && ['m', 'f', 'masculino', 'feminino'].includes(p)) {
      genero = p[0].toUpperCase();
      marcarUsado(i);
      continue;
    }

    if (!data_nascimento) {
      // Tentar capturar datas com 8 dígitos no formato ddmmyyyy
      if (/^\d{8}$/.test(p)) {
        const dataFormatada = formatarData(p);
        if (dataFormatada) {
          data_nascimento = dataFormatada;
          marcarUsado(i);
          continue;
        }
      }
    }

    if (!ano_conclusao_em && /^\d{4}$/.test(p)) {
      // Ano plausível para conclusão
      const anoNum = parseInt(p, 10);
      if (anoNum >= 1900 && anoNum <= new Date().getFullYear()) {
        ano_conclusao_em = p;
        marcarUsado(i);
        continue;
      }
    }

    if (!nacionalidade && nacionalidadesPossiveis.includes(p)) {
      nacionalidade = partes[i]; // pega original para manter maiúsculas/minúsculas
      marcarUsado(i);
      continue;
    }

    if (!forma_ingresso) {
      const match = formasPossiveis.find(f => p.includes(f));
      if (match) {
        forma_ingresso = match;
        marcarUsado(i);
        continue;
      }
    }

    if (!cep && /^\d{8}$/.test(p)) {
      cep = p;
      marcarUsado(i);
      continue;
    }

    if (!numero_residencia && /^\d{1,5}$/.test(p)) {
      numero_residencia = p;
      marcarUsado(i);
      continue;
    }
  }

  // Montar nome juntando as palavras não usadas, sem filtro vago
  const nomeArray = [];
  for (let i = 0; i < partes.length; i++) {
    if (!usados.has(i)) {
      nomeArray.push(partes[i]);
    }
  }
  const nome = nomeArray.length > 0 ? limparTexto(nomeArray.join(' ')) : '';

  // Buscar endereço pelo CEP
  let endereco = null;
  if (cep) {
    endereco = await buscarEndereco(cep);
  }

  const faltando = [];
  if (!nome) faltando.push('nome');
  if (!cpf) faltando.push('cpf');
  if (!email) faltando.push('email');
  if (!genero) faltando.push('gênero');
  if (!data_nascimento) faltando.push('data de nascimento');
  if (!ano_conclusao_em) faltando.push('ano de conclusão do ensino médio');
  if (!nacionalidade) faltando.push('nacionalidade');
  if (!forma_ingresso) faltando.push('forma de ingresso');
  if (!cep) faltando.push('cep');
  if (!numero_residencia) faltando.push('número da residência');

  const resultado = {
    nome,
    cpf: cpf || '',
    email: email || '',
    genero: genero || '',
    data_nascimento: data_nascimento || '',
    ano_conclusao_em: ano_conclusao_em || '',
    nacionalidade: mapNacionalidadeParaCodigo(nacionalidade),
    forma_ingresso: forma_ingresso || '',
    cep: cep || '',
    numero_residencia: numero_residencia || '',
    endereco: endereco || {},
    status: faltando.length > 0 ? 'incomplete' : 'complete',
    message: faltando.length > 0
      ? `⚠️ Faltam as seguintes informações: ${faltando.join(', ')}.`
      : '✅ Todos os dados foram identificados com sucesso.'
  };

  return res.json(resultado);
});

app.listen(port, () => {
  console.log(`API rodando em http://localhost:${port}`);
});
