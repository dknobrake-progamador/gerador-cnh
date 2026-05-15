const { PDFDocument } = require('pdf-lib');
const fs = require('fs');

async function lerGabarito() {
    try {
        // Carrega o seu arquivo gabarito
        const pdfBytes = fs.readFileSync('./gabarito.pdf');
        const pdfDoc = await PDFDocument.load(pdfBytes);
        const form = pdfDoc.getForm();
        const campos = form.getFields();

        console.log(`\n=== ANALISANDO: GABARITO.PDF ===`);
        console.log(`Encontrados ${campos.length} campos de formulário.\n`);

        campos.forEach(campo => {
            const nome = campo.getName();
            const tipo = campo.constructor.name;
            
            // Pega os widgets (a parte visual do campo no PDF)
            const widgets = campo.acroField.getWidgets();
            
            widgets.forEach((widget, index) => {
                const rect = widget.getRectangle();
                
                // Gerando o JSON pronto para você copiar
                const configJson = {
                    x: parseFloat(rect.x.toFixed(2)),
                    y: parseFloat(rect.y.toFixed(2)),
                    w: parseFloat(rect.width.toFixed(2)),
                    h: parseFloat(rect.height.toFixed(2))
                };

                console.log(`Campo: "${nome}" (Tipo: ${tipo})`);
                console.log(`Config: ${JSON.stringify(configJson, null, 2)}`);
                console.log('---');
            });
        });

        if (campos.length === 0) {
            console.log("AVISO: Nenhum campo de formulário (botão/texto) foi encontrado.");
            console.log("Se o seu PDF for apenas uma imagem estática, precisaremos medir manualmente.");
        }

    } catch (err) {
        console.error("Erro ao ler o arquivo:", err.message);
    }
}

lerGabarito();