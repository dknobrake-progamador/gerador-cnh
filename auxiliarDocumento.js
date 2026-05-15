const { degrees, rgb } = require('pdf-lib');
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

/**
 * SOLUÇÃO SEM CANVAS: Usa apenas pdf-lib e sharp.
 */
async function aplicarElementosGraficos(pdfDoc, pagina, dados, config) {
    const campoOk = (n) => config.documento && config.documento[n] && config.documento[n].w !== undefined;

    // 1. CARIMBO DO DIRETOR (Usando Sharp para redimensionar o PNG)
    const siglaUF = (dados.uf || "RJ").toUpperCase();
    const pathSelo = path.join(process.cwd(), 'diretor', `${siglaUF}.png`);
    
    if (fs.existsSync(pathSelo) && campoOk('diretor')) {
        const c = config.documento.diretor;
        const seloBuffer = await sharp(fs.readFileSync(pathSelo))
            .resize(Math.round(c.w * 2))
            .toBuffer();
        const seloImg = await pdfDoc.embedPng(seloBuffer);
        
        pagina.drawImage(seloImg, { 
            x: c.x, y: c.y, width: c.w, height: c.h 
        });
    }

    // 2. NÚMERO DO FORMULÁRIO (Usando apenas drawText da pdf-lib - SEM CANVAS)
    if (dados.numero && campoOk('formulario')) {
        const c = config.documento.formulario;
        // Desenha o texto rotacionado diretamente na página
        pagina.drawText(String(dados.numero), {
            x: c.x + 12, // Ajuste para centralizar no espaço lateral
            y: c.y,
            size: 10,
            rotate: degrees(90),
            color: rgb(0, 0, 0)
        });
    }
}

module.exports = { aplicarElementosGraficos };