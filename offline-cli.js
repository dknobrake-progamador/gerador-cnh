const fs = require('fs');
const path = require('path');
const { organizarDadosVistoria } = require('./extrator');
const { processarDocumento } = require('./processador');

function parseArgs(argv) {
    const args = {};
    for (let i = 0; i < argv.length; i += 1) {
        const token = argv[i];
        if (token.startsWith('--')) {
            const key = token.slice(2);
            args[key] = argv[i + 1];
            i += 1;
        }
    }
    return args;
}

async function iniciarModoOffline() {
    const args = parseArgs(process.argv.slice(3));
    const textoPath = args.texto;
    const fotoPath = args.foto;
    const ear = (args.ear || 'N').toUpperCase();
    const saida = args.saida || '.';

    if (!textoPath || !fotoPath) {
        console.log('Uso offline:');
        console.log('node index.js offline --texto "arquivo.txt" --foto "foto.jpg" --ear S --saida "pasta_saida"');
        process.exit(1);
    }

    const textoAbs = path.resolve(textoPath);
    const fotoAbs = path.resolve(fotoPath);
    const saidaAbs = path.resolve(saida);

    if (!fs.existsSync(textoAbs)) throw new Error(`Arquivo de texto nao encontrado: ${textoAbs}`);
    if (!fs.existsSync(fotoAbs)) throw new Error(`Arquivo de foto nao encontrado: ${fotoAbs}`);
    if (!fs.existsSync(saidaAbs)) fs.mkdirSync(saidaAbs, { recursive: true });

    const texto = fs.readFileSync(textoAbs, 'utf8');
    if (!texto.toUpperCase().includes('NOME COMPLETO:')) {
        throw new Error('Texto invalido. O conteudo precisa incluir "NOME COMPLETO:".');
    }

    const fotoBuffer = fs.readFileSync(fotoAbs);
    const dados = organizarDadosVistoria(texto, ear);
    const pdfBytes = await processarDocumento(fotoBuffer, dados);

    const nomeFinal = (dados.nome || 'documento').replace(/[\\/:*?"<>|]/g, '').toUpperCase();
    const arquivoFinal = path.join(saidaAbs, `${nomeFinal}.pdf`);
    fs.writeFileSync(arquivoFinal, Buffer.from(pdfBytes));

    console.log(`PDF gerado offline com sucesso: ${arquivoFinal}`);
}

module.exports = { iniciarModoOffline };
