const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const { organizarDadosVistoria } = require('./extrator');
const { processarDocumento } = require('./processador');

function respostaEarValida(resp) {
    const r = (resp || '').toUpperCase();
    return ['S', 'N', 'SIM', 'NAO', 'NÃO'].includes(r);
}

function normalizarEar(resp) {
    const r = (resp || '').toUpperCase();
    return r === 'S' || r === 'SIM' ? 'S' : 'N';
}

async function iniciarBotWhatsApp() {
    const client = new Client({
        authStrategy: new LocalAuth(),
        puppeteer: { args: ['--no-sandbox', '--disable-setuid-sandbox'], headless: true }
    });

    const sessoesAtivas = new Map();

    client.on('qr', (qr) => {
        console.clear();
        console.log('--- SISTEMA CNH 3.0 (WHATSAPP) ---');
        qrcode.generate(qr, { small: true });
    });

    client.on('ready', () => {
        console.clear();
        console.log('BOT ONLINE | Pronto para processar');
    });

    client.on('message', async (msg) => {
        const chatID = msg.from;
        const body = msg.body ? msg.body.trim() : '';

        if (body.toLowerCase() === '/start') {
            sessoesAtivas.set(chatID, { etapa: 'AGUARDANDO_EAR' });
            await client.sendMessage(chatID, 'O documento possui EAR?\nResponda S para Sim ou N para Nao.');
            return;
        }

        const sessao = sessoesAtivas.get(chatID);
        if (!sessao) return;

        if (sessao.etapa === 'AGUARDANDO_EAR') {
            if (!respostaEarValida(body)) {
                await client.sendMessage(chatID, 'Resposta invalida. Envie apenas S ou N.');
                return;
            }

            sessao.ear = normalizarEar(body);
            sessao.etapa = 'AGUARDANDO_TEXTO';
            await client.sendMessage(chatID, `EAR definido: ${sessao.ear === 'S' ? 'SIM' : 'NAO'}.\nAgora envie o texto da CNH.`);
            return;
        }

        if (sessao.etapa === 'AGUARDANDO_TEXTO' && !msg.hasMedia) {
            if (!body.toUpperCase().includes('NOME COMPLETO:')) return;

            try {
                const dadosExtraidos = organizarDadosVistoria(body, sessao.ear);
                sessoesAtivas.set(chatID, { ...sessao, ...dadosExtraidos, etapa: 'AGUARDANDO_FOTO' });
                await client.sendMessage(chatID, `Conferencia:\nNome: ${dadosExtraidos.nome}\nEAR: ${sessao.ear}\nFormulario: ${dadosExtraidos.numero}\n\nEnvie a FOTO para gerar o PDF.`);
            } catch (err) {
                await client.sendMessage(chatID, `Erro ao processar texto: ${err.message}`);
                sessoesAtivas.delete(chatID);
            }
            return;
        }

        if (sessao.etapa === 'AGUARDANDO_FOTO' && msg.hasMedia) {
            try {
                await client.sendMessage(chatID, 'Gerando PDF...');
                const media = await msg.downloadMedia();
                const bufferImagem = Buffer.from(media.data, 'base64');
                const pdfUint8Array = await processarDocumento(bufferImagem, sessao);
                const pdfBase64 = Buffer.from(pdfUint8Array).toString('base64');
                const nomeFinal = (sessao.nome || 'documento').replace(/[\\/:*?"<>|]/g, '').toUpperCase();

                const pdfMedia = new MessageMedia('application/pdf', pdfBase64, `${nomeFinal}.pdf`);
                await client.sendMessage(chatID, pdfMedia, { caption: 'PDF gerado com sucesso.' });
                sessoesAtivas.delete(chatID);
            } catch (err) {
                await client.sendMessage(chatID, `Erro: ${err.message}`);
                sessoesAtivas.delete(chatID);
            }
        }
    });

    client.initialize();
}

module.exports = { iniciarBotWhatsApp };
