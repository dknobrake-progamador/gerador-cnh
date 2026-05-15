const { PDFDocument, PDFTextField, PDFButton, StandardFonts, PDFName } = require('pdf-lib');

/**
 * Função Extensão: Preenche APENAS formulario1 e formulario2 com giro de 270°.
 * Usa apenas pdf-lib — sem sharp, sem canvas, sem SVG.
 *
 * @param {Buffer}        pdfBuffer  - Buffer do PDF gerado pelo processador.js
 * @param {string|number} numero     - O número a ser inserido
 * @returns {Promise<Buffer>}
 */
async function adicionarF1F2(pdfBuffer, numero) {
    try {
        const pdfDoc = await PDFDocument.load(pdfBuffer);
        const form   = pdfDoc.getForm();
        const font   = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
        const texto  = String(numero);

        const charWidthPerUnit  = font.widthOfTextAtSize(texto, 1);
        const charHeightPerUnit = font.heightAtSize(1);

        for (const field of form.getFields()) {
            const nome = field.getName().toLowerCase();

            if (!nome.startsWith('formulario1') && !nome.startsWith('formulario2')) continue;

            if (field instanceof PDFTextField) {
                field.setText(texto);

            } else if (field instanceof PDFButton) {

                for (const widget of field.acroField.getWidgets()) {
                    const { width: w, height: h } = widget.getRectangle();

                    const maxFsByWidth  = (w * 0.80) / charHeightPerUnit;
                    const maxFsByHeight = (h * 0.90) / charWidthPerUnit;
                    const fontSize      = Math.min(maxFsByWidth, maxFsByHeight, 72);

                    const textW = font.widthOfTextAtSize(texto, fontSize);
                    const textH = font.heightAtSize(fontSize);

                    const tx = (w - textH) / 2;
                    const ty = (h + textW) / 2;

                    const safeText = texto
                        .replace(/\\/g, '\\\\')
                        .replace(/\(/g,  '\\(')
                        .replace(/\)/g,  '\\)');

                    const streamContent = [
                        'q',
                        `0 1 -1 0 ${tx.toFixed(4)} ${ty.toFixed(4)} cm`,
                        'BT',
                        `/HelvBold ${fontSize.toFixed(4)} Tf`,
                        '0 0 0 rg',
                        '0 0 Td',
                        `(${safeText}) Tj`,
                        'ET',
                        'Q',
                    ].join('\n');

                    const xObjRef = pdfDoc.context.register(
                        pdfDoc.context.stream(streamContent, {
                            Type:      'XObject',
                            Subtype:   'Form',
                            BBox:      [0, 0, w, h],
                            Resources: pdfDoc.context.obj({
                                Font: { HelvBold: font.ref },
                            }),
                        })
                    );

                    widget.dict.set(PDFName.of('AP'), pdfDoc.context.obj({ N: xObjRef }));
                    widget.dict.delete(PDFName.of('AS'));
                }
            }
        }

        return await pdfDoc.save();

    } catch (err) {
        console.error(`Erro na extensão f1f2: ${err.message}`);
        return pdfBuffer;
    }
}

module.exports = { adicionarF1F2 };
