const { PDFDocument, rgb, StandardFonts, degrees } = require('pdf-lib');
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');
const os = require('os');
const fontkit = require('@pdf-lib/fontkit');

// Função para remover acentos, cedilha e símbolos (impede o "crachá" da fonte)
const limparParaAssinatura = (texto) => {
    if (!texto) return "";
    return texto.normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "") // Remove acentos (~, ^, ´, `)
        .replace(/ç/g, "c")
        .replace(/Ç/g, "C")
        .replace(/[^a-zA-Z\s.]/g, ""); // Remove hífen e qualquer símbolo que não seja letra ou ponto
};

function formatarAssinaturaRegra21(nomeCompleto) {
    if (!nomeCompleto) return "";

    // APLICA A LIMPEZA ANTES DE QUALQUER LÓGICA
    nomeCompleto = limparParaAssinatura(nomeCompleto);

    const cap = (p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase();
    const conectores = ['de', 'da', 'do', 'dos', 'das', 'e'];

    // 1. Tenta o nome COMPLETO primeiro (com conectores e espaços)
    let partesOriginais = nomeCompleto.split(/\s+/).map(cap);
    let nomeFormatado = partesOriginais.join(' ');

    if (nomeFormatado.length <= 27) { // LIMITE DE 27 LACUNAS
        return nomeFormatado;
    }

    // 2. Se passou de 27, remove conectores para tentar caber
    let partes = nomeCompleto.split(/\s+/).filter(p => !conectores.includes(p.toLowerCase())).map(cap);
    
    const primeiro = partes[0];
    const ultimo = partes[partes.length - 1];
    let nomesMeio = partes.slice(1, -1);

    const montar = (meio) => [primeiro, ...meio, ultimo].join(' ');

    if (montar(nomesMeio).length <= 27) return montar(nomesMeio);

    // 3. Se ainda não couber, abrevia os nomes do meio
    for (let i = nomesMeio.length - 1; i >= 0; i--) {
        nomesMeio[i] = nomesMeio[i].charAt(0).toUpperCase() + ".";
        if (montar(nomesMeio).length <= 27) return montar(nomesMeio);
    }

    // 4. Corte final de segurança em 27
    let resultadoFinal = montar(nomesMeio);
    return resultadoFinal.length > 27 ? resultadoFinal.substring(0, 27) : resultadoFinal;
}

function gerarNumeroAleatorio() {
    return Math.floor(Math.random() * 100000000000).toString().padStart(11, '0');
}

function listarFontesAssinatura() {
    const dirsCandidatos = [
        process.env.SIGNATURES_DIR,
        path.join(__dirname, 'assinaturas'),
        path.join(os.homedir(), 'Downloads', 'assinaturas')
    ].filter(Boolean);

    for (const dir of dirsCandidatos) {
        try {
            if (!fs.existsSync(dir)) continue;
            const fontes = fs.readdirSync(dir)
                .filter((nome) => /\.(ttf|otf)$/i.test(nome))
                .map((nome) => path.join(dir, nome));
            if (fontes.length > 0) return fontes;
        } catch (e) {}
    }
    return [];
}

function escolherFonteAssinaturaAleatoria() {
    const fontes = listarFontesAssinatura();
    if (fontes.length === 0) return null;
    return fontes[Math.floor(Math.random() * fontes.length)];
}

function aplicarAcentoNoEstado(estado) {
    if (!estado) return '';
    const chave = estado.toString().trim().toUpperCase();
    const mapa = {
        'PARA': 'PARÁ',
        'PARAIBA': 'PARAÍBA',
        'PIAUI': 'PIAUÍ',
        'CEARA': 'CEARÁ',
        'AMAPA': 'AMAPÁ',
        'MARANHAO': 'MARANHÃO',
        'GOIAS': 'GOIÁS',
        'ESPIRITO SANTO': 'ESPÍRITO SANTO',
        'SAO PAULO': 'SÃO PAULO'
    };
    return mapa[chave] || chave;
}

async function processarDocumento(imagemBuffer, dados) {
    try {
        const pdfBytes = fs.readFileSync('./gabarito.pdf');
        const pdfDoc = await PDFDocument.load(pdfBytes);
        pdfDoc.registerFontkit(fontkit);

        const form = pdfDoc.getForm();
        const campos = form.getFields();
        const nomesCampos = campos.map(f => f.getName());
        const pagina = pdfDoc.getPages()[0];

        // 1. INJEÇÃO DE IMAGENS (FOTO E DIRETOR)
        const injetarNoBotao = async (nomeCampo, bufferImg, isPng = false) => {
            if (nomesCampos.includes(nomeCampo)) {
                try {
                    const botao = form.getButton(nomeCampo);
                    const widgets = botao.acroField.getWidgets();
                    if (widgets.length > 0) {
                        const rect = widgets[0].getRectangle();
                        let processadorImg = sharp(bufferImg);
                        
                        let imgFinal;
                        if (nomeCampo === 'foto') {
                            imgFinal = await processadorImg
                                .resize({ width: 600, height: 800, fit: 'cover' })
                                .png()
                                .toBuffer();
                        } else {
                            imgFinal = isPng ? await processadorImg.png().toBuffer() : await processadorImg.resize(Math.round(rect.width * 4)).jpeg().toBuffer();
                        }

                        const imgEmbed = (isPng || nomeCampo === 'foto') ? await pdfDoc.embedPng(imgFinal) : await pdfDoc.embedJpg(imgFinal);
                        
                        pagina.drawImage(imgEmbed, { 
                            x: rect.x, 
                            y: rect.y, 
                            width: rect.width, 
                            height: rect.height 
                        });
                    }
                } catch (e) {
                    console.error(`Erro ao injetar ${nomeCampo}:`, e.message);
                }
            }
        };

        // Processa Foto e Diretor
        await injetarNoBotao('foto', imagemBuffer);
        const pathSelo = path.join(__dirname, 'diretor', `${(dados.uf || "RJ")}.png`);
        if (fs.existsSync(pathSelo)) {
            await injetarNoBotao('diretor', fs.readFileSync(pathSelo), true);
        }

        // 2. FORMULÁRIOS (TEXTO VERTICAL)
        const desenharTextoVerticalNoBotao = (nomeCampo, textoParaDesenhar, deslocamentoPercentual = 0) => {
            if (nomesCampos.includes(nomeCampo) && textoParaDesenhar) {
                const botao = form.getButton(nomeCampo);
                const rect = botao.acroField.getWidgets()[0].getRectangle();
                
                // No PDF: + sobe, - desce.
                const ajusteY = rect.height * deslocamentoPercentual;

                pagina.drawText(textoParaDesenhar.toString(), {
                    x: rect.x + (rect.width / 2) + 4, 
                    y: rect.y + 10 + ajusteY,
                    size: 14,
                    color: rgb(0.3, 0.3, 0.3), 
                    rotate: degrees(90)
                });
            }
        };

        desenharTextoVerticalNoBotao('formulario', dados.numero, 0);
        desenharTextoVerticalNoBotao('formulario1', dados.numero, -0.10); // DESCER 1% conforme solicitado
        desenharTextoVerticalNoBotao('formulario2', dados.numero, 0);

        // 3. ASSINATURA (AJUSTE x+5, y+1)
        if (nomesCampos.includes('assinatura')) {
            const rect = form.getButton('assinatura').acroField.getWidgets()[0].getRectangle();
            const fonteEscolhida = escolherFonteAssinaturaAleatoria();
            const fallbackLocal = path.join(__dirname, 'assinatura1.ttf');
            const fontPath = fonteEscolhida && fs.existsSync(fonteEscolhida)
                ? fonteEscolhida
                : (fs.existsSync(fallbackLocal) ? fallbackLocal : null);
            const fonteAss = fontPath
                ? await pdfDoc.embedFont(fs.readFileSync(fontPath))
                : await pdfDoc.embedFont(StandardFonts.TimesRomanItalic);
            const textoAssinatura = formatarAssinaturaRegra21(dados.nome);
            let size = 4.1;
            const minSize = 3.2;
            const paddingX = 6;
            const larguraMax = Math.max(10, rect.width - (paddingX * 2));

            while (size > minSize && fonteAss.widthOfTextAtSize(textoAssinatura, size) > larguraMax) {
                size -= 0.1;
            }

            const larguraTexto = fonteAss.widthOfTextAtSize(textoAssinatura, size);
            const x = Math.max(rect.x + paddingX, rect.x + ((rect.width - larguraTexto) / 2));
            const y = rect.y + 1;

            pagina.drawText(textoAssinatura, { x, y, size, font: fonteAss });
        }

        // 4. MAPEAMENTO DE TEXTO (INCLUI PRIMEIRA E ALEATÓRIO)
        const categoriaUpper = (dados.categoria || '').toString().toUpperCase();
        const categoriaCompostaCDE = /(^|[^A-Z])(AC|AD|AE|C|D|E)([^A-Z]|$)/.test(categoriaUpper);
        const validadeBFinal = (dados.validadeC || dados.validadeD || dados.validadeE || categoriaCompostaCDE)
            ? (dados.validadeB || dados.validadeC || dados.validadeD || dados.validadeE || dados.validade || '')
            : (dados.validadeB || '');

        const mapaTexto = {
            'nome': dados.nome, 'cpf': dados.cpf, 'rg': dados.rg, 'nascimento': dados.nascimento,
            'registro': dados.registro, 'categoria': dados.categoria, 'renach': dados.renach,
            'mae': dados.mae, 'pai': dados.pai, 'local': dados.local,
            'emissao': dados.emissao, 
            'primeira': dados.primeira, 
            'validade': dados.validade, 
            'ear': dados.ear === 'S' ? 'EAR' : '',
            'aleatorio': gerarNumeroAleatorio(), 
            'validadeA': dados.validadeA, 'validadeB': validadeBFinal, 'validadeC': dados.validadeC,
            'validadeD': dados.validadeD, 'validadeE': dados.validadeE
        };

        campos.forEach(campo => {
            const nome = campo.getName();
            if (campo.constructor.name === 'PDFTextField' && mapaTexto[nome] !== undefined) {
                try { campo.setText(mapaTexto[nome].toString().toUpperCase()); } catch (e) {}
            }
        });

        // Ajuste automatico do nome do estado para caber na faixa verde.
        if (nomesCampos.includes('estado') && dados.estado) {
            try {
                const campoEstado = form.getTextField('estado');
                campoEstado.setText('');
                const rect = campoEstado.acroField.getWidgets()[0].getRectangle();
                const fonteEstado = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
                const estadoTexto = aplicarAcentoNoEstado(dados.estado);

                let tamanho = 8.5;
                const tamanhoMin = 5;
                const larguraMax = rect.width - 4;

                while (tamanho > tamanhoMin && fonteEstado.widthOfTextAtSize(estadoTexto, tamanho) > larguraMax) {
                    tamanho -= 0.2;
                }

                const larguraTexto = fonteEstado.widthOfTextAtSize(estadoTexto, tamanho);
                const x = rect.x + Math.max(2, (rect.width - larguraTexto) / 2);
                const y = rect.y + (rect.height - tamanho) / 2 + 1;

                pagina.drawText(estadoTexto, {
                    x,
                    y,
                    size: tamanho,
                    font: fonteEstado,
                    color: rgb(0, 107 / 255, 63 / 255)
                });
            } catch (e) {}
        }

        form.flatten();
        return await pdfDoc.save();
    } catch (err) {
        throw new Error(err.message);
    }
}

module.exports = { processarDocumento };
