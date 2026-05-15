const { PDFDocument, rgb } = require('pdf-lib');
const sharp = require('sharp');
const fs = require('fs');

async function criarDocumento(caminhoFoto) {
    // 1. Carregar o PDF Gabarito
    const pdfBytes = fs.readFileSync('./gabarito.pdf');
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const form = pdfDoc.getForm();
    const pagina = pdfDoc.getPages()[0];

    // 2. Coordenadas que você extraiu do campo "foto"
    const campoFoto = { x: 216.76, y: 450.45, w: 60.44, h: 74.34 };

    // 3. Processar a imagem com SHARP
    // O Sharp vai redimensionar exatamente para o tamanho do campo (60x74)
    const fotoBuffer = await sharp(caminhoFoto)
        .resize(Math.round(campoFoto.w), Math.round(campoFoto.h), {
            fit: 'cover',
            position: 'center'
        })
        .jpeg({ quality: 90 })
        .toBuffer();

    // 4. Inserir a imagem no PDF
    const imagemEmbed = await pdfDoc.embedJpg(fotoBuffer);
    
    // Desenha a imagem na posição exata
    pagina.drawImage(imagemEmbed, {
        x: campoFoto.x,
        y: campoFoto.y,
        width: campoFoto.w,
        height: campoFoto.h,
    });

    // 5. Exemplo de preencher um campo de TEXTO (usando o campo "nome" que você extraiu)
    const campoNome = form.getTextField('nome');
    campoNome.setText('JOÃO DA SILVA');

    // 6. Finalização
    // Isso remove os campos de formulário e "achata" o PDF (opcional)
    // form.flatten(); 

    const pdfFinal = await pdfDoc.save();
    fs.writeFileSync('./resultado_final.pdf', pdfFinal);
    console.log("PDF Gerado com sucesso: resultado_final.pdf");
}

// Para testar, coloque uma foto de teste na pasta e chame a função:
// criarDocumento('./minha_foto_teste.jpg');