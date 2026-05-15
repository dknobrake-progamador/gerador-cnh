require('dotenv').config();

const { iniciarServidorWeb } = require('./web-server');
const { iniciarBotTelegram } = require('./telegram-bot');
const { iniciarBotWhatsApp } = require('./whatsapp-bot');
const { iniciarModoOffline } = require('./offline-cli');

const modo = (process.argv[2] || process.env.APP_MODE || 'web').toLowerCase();

async function bootstrap() {
    if (modo === 'web') {
        await iniciarServidorWeb();
        return;
    }

    if (modo === 'telegram') {
        await iniciarBotTelegram();
        return;
    }

    if (modo === 'whatsapp') {
        await iniciarBotWhatsApp();
        return;
    }

    if (modo === 'offline') {
        await iniciarModoOffline();
        return;
    }

    console.error(`Modo invalido: ${modo}`);
    console.error('Use: web | telegram | whatsapp | offline');
    process.exit(1);
}

bootstrap().catch((err) => {
    console.error('Falha ao iniciar aplicacao:', err.message);
    process.exit(1);
});
