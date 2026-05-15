const fs = require('fs');
const path = require('path');

function organizarDadosVistoria(texto, respostaEARUsuario = null) {
    const estadosECapitais = {
        'AC': { estado: 'ACRE', capital: 'RIO BRANCO' }, 'AL': { estado: 'ALAGOAS', capital: 'MACEIO' },
        'AP': { estado: 'AMAPA', capital: 'MACAPA' }, 'AM': { estado: 'AMAZONAS', capital: 'MANAUS' },
        'BA': { estado: 'BAHIA', capital: 'SALVADOR' }, 'CE': { estado: 'CEARA', capital: 'FORTALEZA' },
        'DF': { estado: 'DISTRITO FEDERAL', capital: 'BRASILIA' }, 'ES': { estado: 'ESPIRITO SANTO', capital: 'VITORIA' },
        'GO': { estado: 'GOIAS', capital: 'GOIANIA' }, 'MA': { estado: 'MARANHAO', capital: 'SAO LUIS' },
        'MT': { estado: 'MATO GROSSO', capital: 'CUIABA' }, 'MS': { estado: 'MATO GROSSO DO SUL', capital: 'CAMPO GRANDE' },
        'MG': { estado: 'MINAS GERAIS', capital: 'BELO HORIZONTE' }, 'PA': { estado: 'PARA', capital: 'BELEM' },
        'PB': { estado: 'PARAIBA', capital: 'JOAO PESSOA' }, 'PR': { estado: 'PARANA', capital: 'CURITIBA' },
        'PE': { estado: 'PERNAMBUCO', capital: 'RECIFE' }, 'PI': { estado: 'PIAUI', capital: 'TERESINA' },
        'RJ': { estado: 'RIO DE JANEIRO', capital: 'RIO DE JANEIRO' }, 'RN': { estado: 'RIO GRANDE DO NORTE', capital: 'NATAL' },
        'RS': { estado: 'RIO GRANDE DO SUL', capital: 'PORTO ALEGRE' }, 'RO': { estado: 'RONDONIA', capital: 'PORTO VELHO' },
        'RR': { estado: 'RORAIMA', capital: 'BOA VISTA' }, 'SC': { estado: 'SANTA CATARINA', capital: 'FLORIANOPOLIS' },
        'SP': { estado: 'SAO PAULO', capital: 'SAO PAULO' }, 'SE': { estado: 'SERGIPE', capital: 'ARACAJU' },
        'TO': { estado: 'TOCANTINS', capital: 'PALMAS' }
    };

    // Carrega o arquivo cidades_unicas.txt da raiz
    let mapaCidades = {};
    try {
        const caminhoTxt = path.join(__dirname, 'cidades_unicas.txt');
        const conteudoTxt = fs.readFileSync(caminhoTxt, 'utf8');
        conteudoTxt.split('\n').forEach(linha => {
            if (linha.includes(' - ')) {
                const [cidade, uf] = linha.split(' - ');
                if (cidade && uf) {
                    mapaCidades[cidade.trim().toUpperCase()] = uf.trim().toUpperCase();
                }
            }
        });
    } catch (e) {
        console.error("Erro ao ler cidades_unicas.txt, usando lógica de fallback.");
    }

    const limparSimbologia = (valor) => {
        if (!valor) return "";
        return valor.replace(/^[*➛\-•.\s]+/, '').trim();
    };

    const extrair = (regex) => {
        try {
            const match = texto.match(regex);
            if (match && match[1]) {
                const valor = match[1].trim();
                const vB = valor.toLowerCase();
                if (vB.includes("não informado") || vB.includes("sem informação")) return "";
                return valor;
            }
            return "";
        } catch (e) { return ""; }
    };

    const formatarData = (dataStr) => {
        if (!dataStr || dataStr.toLowerCase().includes("informado")) return "";
        if (dataStr.includes('-')) {
            const partes = dataStr.split('-');
            if (partes[0].length === 4) return `${partes[2]}/${partes[1]}/${partes[0]}`;
            return `${partes[0]}/${partes[1]}/${partes[2]}`;
        }
        return dataStr;
    };

    // 1. UF de Habilitacao (ancora principal com prioridade correta)
    // Prioridade:
    // 1) UF Habilitacao Atual
    // 2) UF EXPEDICAO
    // 3) UF generica (fallback)
    const ufHabilitacaoAtual = extrair(/UF Habilita[cç][aã]o Atual:\s*([A-Z]{2})/i);
    const ufExpedicao = extrair(/UF EXPEDI[CÇ][AÃ]O:\s*([A-Z]{2})/i);
    const ufGenerica = extrair(/\bUF:\s*([A-Z]{2})\b/i);
    const ufHabilitacao = (ufHabilitacaoAtual || ufExpedicao || ufGenerica || "RJ").toUpperCase();

    // 2. LOCAL (Vistoria)
    let cidadeLocal = extrair(/(?:Cidade|Munic[ií]pio|LOCAL):\s*([^/,\n\r0-9]+)/i);
    if (!cidadeLocal || cidadeLocal.toLowerCase().includes("informado")) {
        const matches = [...texto.matchAll(/(?:Cidade|Munic[ií]pio|LOCAL):\s*([^/,\n\r0-9]+)/gi)];
        for (const m of matches) {
            let temp = limparSimbologia(m[1]);
            if (temp && !temp.toLowerCase().includes("informado")) {
                cidadeLocal = temp;
                break;
            }
        }
    }
    cidadeLocal = limparSimbologia(cidadeLocal).toUpperCase();
    if (!cidadeLocal || cidadeLocal.length < 3) {
        cidadeLocal = estadosECapitais[ufHabilitacao]?.capital || "RIO DE JANEIRO";
    }
    const localFinal = `${cidadeLocal} ${ufHabilitacao}`.replace(/\s+/g, ' ').trim();

    // 3. NASCIMENTO (Com busca no TXT da raiz)
    const dataNascRaw = extrair(/(?:Data de Nascimento|Data Nascimento|Nascimento|DATA NASCIMENTO):\s*([\d/-]+)/i);
    let naturalidadeRaw = extrair(/(?:Local de Nascimento|Naturalidade|CIDADE NASCIMENTO):\s*([^,\n\r]+)/i);
    naturalidadeRaw = limparSimbologia(naturalidadeRaw).toUpperCase();
    
    let localNascParte = "";
    if (naturalidadeRaw && naturalidadeRaw.length > 2) {
        const temUF = /[ \-][A-Z]{2}$/.test(naturalidadeRaw);
        if (temUF) {
            localNascParte = naturalidadeRaw;
        } else {
            // Consulta o mapa carregado do TXT
            const ufDoTxt = mapaCidades[naturalidadeRaw];
            if (ufDoTxt) {
                localNascParte = `${naturalidadeRaw} ${ufDoTxt}`;
            } else {
                localNascParte = `${naturalidadeRaw} ${ufHabilitacao}`;
            }
        }
    } else {
        localNascParte = localFinal;
    }
    const nascimentoFormatado = `${formatarData(dataNascRaw)} ${localNascParte}`.replace(/\s+/g, ' ').trim();

    // 4. RG (Motor Intacto)
    const numDoc = extrair(/(?:N[uú]mero do Documento|DOCUMENTO RG|RG):\s*([\w.-]+)/i);
    let orgaoExp = extrair(/(?:[OÓ]rg[aã]o Expedidor|Expedidor):\s*([^-\n\r]+)/i) || "DETRAN";
    let ufExp = extrair(/(?:UF Expedidor|UF Doc):\s*([A-Z]{2})/i) || ufHabilitacao;
    if (orgaoExp.includes('-')) {
        const partesOrgao = orgaoExp.split('-');
        orgaoExp = partesOrgao[0].trim();
        ufExp = partesOrgao[1].trim();
    }
    const rgFormatado = `${numDoc} ${orgaoExp} ${ufExp}`.replace(/\s+/g, ' ').trim();

    const categoria = extrair(/(?:Categoria Atual|Categoria):\s*([A-Z]+)/i).toUpperCase() || "B";
    const validadeGeral = extrair(/Validade:\s*([\d/]+)/i);

    let nomePai = extrair(/(?:Nome do Pai|Pai):\s*(.*)/i);
    if (!nomePai || /^=+\s*DOCUMENTA[CÇ][AÃ]O E REGISTROS\s*=+$/i.test(nomePai.trim())) {
        nomePai = "NAO DECLARADO";
    }

    const dados = {
        nome: extrair(/(?:Nome Completo|NOME):\s*(.*)/i),
        cpf: extrair(/CPF:\s*([\d.-]+)/i),
        rg: rgFormatado,
        nascimento: nascimentoFormatado,
        mae: extrair(/(?:Nome da M[aã]e|M[aã]e):\s*(.*)/i),
        pai: nomePai,
        emissao: extrair(/(?:[UÚ]ltima Emiss[aã]o Hist[oó]rico|Emiss[aã]o):\s*([\d/]+)/i),
        primeira: extrair(/(?:Primeira Habilita[cç][aã]o|Primeira):\s*([\d/]+)/i),
        registro: extrair(/(?:N[uú]mero de Registro|Registro|NÚMERO CNH):\s*(\d+)/i),
        renach: extrair(/RENACH:\s*(\w+)/i),
        numero: extrair(/(?:Formul[aá]rio CNH|Formul[aá]rio):\s*(\d+)/i),
        categoria: categoria,
        validade: validadeGeral,
        local: localFinal,
        estado: estadosECapitais[ufHabilitacao]?.estado || "RIO DE JANEIRO",
        uf: ufHabilitacao,
        aleatorio: Math.floor(Math.random() * 100000000000).toString().padStart(11, '0'),
        ear: (respostaEARUsuario && respostaEARUsuario.toUpperCase().startsWith('S')) ? 'S' : 'N'
    };

    ['A', 'B', 'C', 'D', 'E'].forEach(v => {
        dados[`validade${v}`] = categoria.includes(v) ? validadeGeral : "";
    });

    // Regra de negocio: se C, D ou E estiver preenchida (incluindo categorias AC, AD, AE),
    // B tambem deve ficar preenchida.
    const categoriaCompostaCDE = /(^|[^A-Z])(AC|AD|AE|C|D|E)([^A-Z]|$)/.test(categoria);
    if (dados.validadeC || dados.validadeD || dados.validadeE || categoriaCompostaCDE) {
        dados.validadeB = validadeGeral || dados.validadeB;
    }

    return dados;
}

module.exports = { organizarDadosVistoria };
