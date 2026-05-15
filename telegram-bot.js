const TelegramBot = require('node-telegram-bot-api');
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

async function iniciarBotTelegram() {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) {
        throw new Error('Defina TELEGRAM_BOT_TOKEN no arquivo .env para iniciar o modo telegram.');
    }

    const bot = new TelegramBot(token, { polling: true });
    const sessoesAtivas = new Map();

    console.clear();
    console.log('--- SISTEMA CNH 3.0 (TELEGRAM) ---');
    console.log('BOT ONLINE | Pronto para processar');

    bot.on('message', async (msg) => {
        const chatID = msg.chat.id;
        const body = msg.text ? msg.text.trim() : '';

        if (body.toLowerCase() === '/start') {
            sessoesAtivas.set(chatID, { etapa: 'AGUARDANDO_EAR' });
            await bot.sendMessage(chatID, 'O documento possui EAR?\nResponda S para Sim ou N para Nao.');
            return;
        }

        const sessao = sessoesAtivas.get(chatID);
        if (!sessao) return;

        if (sessao.etapa === 'AGUARDANDO_EAR') {
            if (!respostaEarValida(body)) {
                await bot.sendMessage(chatID, 'Resposta invalida. Envie apenas S ou N.');
                return;
            }

            sessao.ear = normalizarEar(body);
            sessao.etapa = 'AGUARDANDO_TEXTO';
            await bot.sendMessage(chatID, `EAR definido: ${sessao.ear === 'S' ? 'SIM' : 'NAO'}.\nAgora envie o texto da CNH.`);
            return;
        }

        if (sessao.etapa === 'AGUARDANDO_TEXTO' && !msg.photo) {
            if (!body.toUpperCase().includes('NOME COMPLETO:')) return;

            try {
                const dadosExtraidos = organizarDadosVistoria(body, sessao.ear);
                sessoesAtivas.set(chatID, { ...sessao, ...dadosExtraidos, etapa: 'AGUARDANDO_FOTO' });
                await bot.sendMessage(chatID, `Conferencia:\nNome: ${dadosExtraidos.nome}\nEAR: ${sessao.ear}\nFormulario: ${dadosExtraidos.numero}\n\nEnvie a FOTO para gerar o PDF.`);
            } catch (err) {
                await bot.sendMessage(chatID, `Erro ao processar texto: ${err.message}`);
                sessoesAtivas.delete(chatID);
            }
            return;
        }

        if (sessao.etapa === 'AGUARDANDO_FOTO' && msg.photo) {
            try {
                await bot.sendMessage(chatID, 'Gerando PDF...');
                const photo = msg.photo[msg.photo.length - 1];
                const file = await bot.getFile(photo.file_id);
                const fileUrl = `https://api.telegram.org/file/bot${token}/${file.file_path}`;
                const response = await fetch(fileUrl);
                const bufferImagem = Buffer.from(await response.arrayBuffer());

                const pdfUint8Array = await processarDocumento(bufferImagem, sessao);
                const pdfBuffer = Buffer.from(pdfUint8Array);
                const nomeFinal = (sessao.nome || 'documento').replace(/[\\/:*?"<>|]/g, '').toUpperCase();

                await bot.sendDocument(chatID, pdfBuffer, {
                    caption: 'PDF gerado com sucesso.',
                    filename: `${nomeFinal}.pdf`
                });
                sessoesAtivas.delete(chatID);
            } catch (err) {
                await bot.sendMessage(chatID, `Erro: ${err.message}`);
                sessoesAtivas.delete(chatID);
            }
        }
    });
}

module.exports = { iniciarBotTelegram };
