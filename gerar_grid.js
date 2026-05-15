const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const fs = require('fs');

async function criarGradeDeReferencia() {
    try {
        // 1. Carrega o seu gabarito
        const pdfBytes = fs.readFileSync('./gabarito.pdf');
        const pdfDoc = await PDFDocument.load(pdfBytes);
        const paginas = pdfDoc.getPages();
        const pagina = paginas[0];
        const { width, height } = pagina.getSize();
        const fonte = await pdfDoc.embedFont(StandardFonts.Helvetica);

        console.log(`Criando régua para PDF de tamanho: ${width}x${height}`);

        // 2. Desenhar linhas verticais (Eixo X) - Vermelho
        for (let x = 0; x <= width; x += 50) {
            pagina.drawLine({
                start: { x, y: 0 },
                end: { x, y: height },
                color: rgb(0.8, 0, 0),
                strokeWidth: 0.5,
                opacity: 0.5,
            });
            // Números no rodapé
            pagina.drawText(`${x}`, { x: x + 2, y: 5, size: 8, font: fonte, color: rgb(0.8, 0, 0) });
        }

        // 3. Desenhar linhas horizontais (Eixo Y) - Azul
        for (let y = 0; y <= height; y += 50) {
            pagina.drawLine({
                start: { x: 0, y },
                end: { x: width, y },
                color: rgb(0, 0, 0.8),
                strokeWidth: 0.5,
                opacity: 0.5,
            });
            // Números na lateral
            pagina.drawText(`${y}`, { x: 5, y: y + 2, size: 8, font: fonte, color: rgb(0, 0, 0.8) });
        }

        // 4. Desenhar uma marca d'água de "CUIDADO" para não usar esse PDF em produção
        pagina.drawText('MODO DESIGNER - COORDENADAS ATIVAS', {
            x: width / 4,
            y: height / 2,
            size: 20,
            opacity: 0.2,
            color: rgb(0, 0, 0)
        });

        const pdfFinal = await pdfDoc.save();
        fs.writeFileSync('./gabarito_com_grid.pdf', pdfFinal);
        
        console.log("---");
        console.log("Sucesso! Abra o arquivo 'gabarito_com_grid.pdf'.");
        console.log("As linhas vermelhas são o X (horizontal).");
        console.log("As linhas azuis são o Y (vertical).");
        console.log("---");

    } catch (err) {
        console.error("Erro ao gerar grid:", err.message);
    }
}

criarGradeDeReferencia();