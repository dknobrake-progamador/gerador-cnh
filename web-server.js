const express = require('express');
const multer = require('multer');
const os = require('os');
const { organizarDadosVistoria } = require('./extrator');
const { processarDocumento } = require('./processador');

const upload = multer({ storage: multer.memoryStorage() });
function buildHtml() {
    return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>cnh brasil - Gerador CNH</title>
  <style>
    :root { --bg:#f4f7ff; --card:#ffffff; --ink:#111827; --muted:#4b5563; --ok:#047857; --line:#d1d5db; --brand:#0f766e; }
    * { box-sizing:border-box; font-family: "Segoe UI", Tahoma, sans-serif; }
    body { margin:0; background:linear-gradient(135deg,#eff6ff,#ecfeff); color:var(--ink); }
    .wrap { max-width:860px; margin:30px auto; padding:0 16px; }
    .card { background:var(--card); border:1px solid var(--line); border-radius:14px; padding:18px; box-shadow:0 10px 30px rgba(0,0,0,.06); }
    h1 { margin:0 0 8px; font-size:26px; }
    p { margin:0 0 16px; color:var(--muted); }
    label { font-weight:600; display:block; margin:12px 0 8px; }
    textarea,input,select,button { width:100%; border:1px solid var(--line); border-radius:10px; padding:11px; font-size:15px; }
    textarea { min-height:220px; resize:vertical; }
    button { background:var(--brand); color:#fff; border:none; font-weight:700; cursor:pointer; margin-top:14px; }
    button:disabled { opacity:.6; cursor:not-allowed; }
    .result { margin-top:14px; padding:12px; border-radius:10px; background:#ecfdf5; color:var(--ok); display:none; }
    .error { margin-top:14px; padding:12px; border-radius:10px; background:#fef2f2; color:#b91c1c; display:none; }
    #previewCanvas { width:100%; border:1px solid #d1d5db; border-radius:10px; background:#fff; }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="card">
      <h1>cnh brasil</h1>
      <p>Cole o texto da CNH, informe EAR e envie a foto para gerar o PDF.</p>
      <form id="form">
        <label for="ear">EAR</label>
        <select id="ear" name="ear" required>
          <option value="S">Sim</option>
          <option value="N">Nao</option>
        </select>
        <label for="texto">Texto da CNH</label>
        <textarea id="texto" name="texto" placeholder="NOME COMPLETO: ..." required></textarea>
        <label for="foto">Foto</label>
        <input id="foto" name="foto" type="file" accept="image/*" required />
        <button id="btn" type="submit">Gerar PDF</button>
      </form>
      <button id="btnVisualizar" disabled style="margin-top:10px;background:#0f766e;opacity:.6;cursor:not-allowed;">Visualizar PDF</button>
      <button id="btnExportar" disabled style="margin-top:10px;background:#1d4ed8;opacity:.6;cursor:not-allowed;">Exportar PDF</button>
      <button id="btnAbrir" disabled style="margin-top:10px;background:#0f766e;opacity:.6;cursor:not-allowed;">Abrir no navegador</button>
      <div id="previewBox" style="display:none;margin-top:12px;">
        <h3 style="margin:0 0 8px;">Visualizacao</h3>
        <canvas id="previewCanvas"></canvas>
      </div>
      <div class="result" id="result"></div>
      <div class="error" id="error"></div>
    </div>
  </div>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.min.js"></script>
  <script>
    if (window.pdfjsLib) {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';
    }

    const form = document.getElementById('form');
    const btn = document.getElementById('btn');
    const btnVisualizar = document.getElementById('btnVisualizar');
    const btnExportar = document.getElementById('btnExportar');
    const btnAbrir = document.getElementById('btnAbrir');
    const previewBox = document.getElementById('previewBox');
    const previewCanvas = document.getElementById('previewCanvas');
    const result = document.getElementById('result');
    const error = document.getElementById('error');
    let ultimoBlob = null;
    let ultimoNome = 'documento.pdf';
    let ultimoUrl = '';
    let ultimoPdfBytes = null;

    function isCapacitorApp() {
      return !!(window.Capacitor && window.Capacitor.Plugins);
    }

    async function exportarNoApp(bytes, fileName) {
      const saver = window.Capacitor?.Plugins?.PdfSaver;
      if (!saver?.savePdf) return false;
      let binary = '';
      const uint8 = new Uint8Array(bytes);
      const chunk = 0x8000;
      for (let i = 0; i < uint8.length; i += chunk) {
        binary += String.fromCharCode(...uint8.subarray(i, i + chunk));
      }
      const base64 = btoa(binary);
      await saver.savePdf({ base64, fileName });
      return true;
    }

    async function renderPreview(bytes) {
      if (!window.pdfjsLib) throw new Error('PDF.js indisponivel.');
      const loadingTask = window.pdfjsLib.getDocument({ data: bytes });
      const pdf = await loadingTask.promise;
      const page = await pdf.getPage(1);
      const viewport = page.getViewport({ scale: 1.3 });
      const ctx = previewCanvas.getContext('2d');
      previewCanvas.width = viewport.width;
      previewCanvas.height = viewport.height;
      await page.render({ canvasContext: ctx, viewport }).promise;
      previewBox.style.display = 'block';
    }

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      result.style.display = 'none';
      error.style.display = 'none';
      btn.disabled = true;
      btn.textContent = 'Gerando...';

      try {
        const data = new FormData(form);
        const res = await fetch('/api/gerar-pdf', { method: 'POST', body: data });
        if (!res.ok) {
          const msg = await res.text();
          throw new Error(msg || 'Erro ao gerar PDF');
        }
        ultimoBlob = await res.blob();
        ultimoPdfBytes = await ultimoBlob.arrayBuffer();
        ultimoNome = res.headers.get('x-file-name') || 'documento.pdf';
        if (ultimoUrl) URL.revokeObjectURL(ultimoUrl);
        ultimoUrl = URL.createObjectURL(ultimoBlob);
        previewBox.style.display = 'none';
        btnVisualizar.disabled = false;
        btnExportar.disabled = false;
        btnAbrir.disabled = false;
        btnVisualizar.style.opacity = '1';
        btnExportar.style.opacity = '1';
        btnAbrir.style.opacity = '1';
        btnVisualizar.style.cursor = 'pointer';
        btnExportar.style.cursor = 'pointer';
        btnAbrir.style.cursor = 'pointer';
        result.textContent = 'PDF gerado. Clique em Visualizar PDF ou Exportar PDF.';
        result.style.display = 'block';
      } catch (err) {
        error.textContent = err.message;
        error.style.display = 'block';
      } finally {
        btn.disabled = false;
        btn.textContent = 'Gerar PDF';
      }
    });

    btnExportar.addEventListener('click', () => {
      if (!ultimoBlob) return;
      (async () => {
        try {
          if (isCapacitorApp() && ultimoPdfBytes) {
            const ok = await exportarNoApp(ultimoPdfBytes, ultimoNome);
            if (ok) return;
          }
          const url = URL.createObjectURL(ultimoBlob);
          const a = document.createElement('a');
          a.href = url;
          a.download = ultimoNome;
          a.click();
          URL.revokeObjectURL(url);
        } catch (e) {
          error.textContent = e.message;
          error.style.display = 'block';
        }
      })();
    });

    btnAbrir.addEventListener('click', () => {
      if (!ultimoUrl) return;
      if (isCapacitorApp()) {
        result.textContent = 'No app, use "Exportar PDF".';
        result.style.display = 'block';
        return;
      }
      window.open(ultimoUrl, '_blank');
    });

    btnVisualizar.addEventListener('click', async () => {
      try {
        if (!ultimoPdfBytes) return;
        await renderPreview(ultimoPdfBytes);
      } catch (e) {
        error.textContent = 'Falha ao visualizar PDF: ' + e.message;
        error.style.display = 'block';
      }
    });
  </script>
</body>
</html>`;
}

async function iniciarServidorWeb() {
    const app = express();
    const port = Number(process.env.PORT || 3000);

    app.get('/', (_req, res) => {
        res.type('html').send(buildHtml());
    });

    app.get('/health', (_req, res) => {
        res.json({ ok: true });
    });

    app.post('/api/gerar-pdf', upload.single('foto'), async (req, res) => {
        try {
            const texto = (req.body?.texto || '').trim();
            const ear = (req.body?.ear || 'N').trim().toUpperCase();
            const fotoBuffer = req.file?.buffer;

            if (!texto || !texto.toUpperCase().includes('NOME COMPLETO:')) {
                return res.status(400).send('Texto invalido. O conteudo precisa incluir "NOME COMPLETO:".');
            }
            if (!fotoBuffer) {
                return res.status(400).send('Foto obrigatoria.');
            }

            const dados = organizarDadosVistoria(texto, ear);
            const pdfUint8Array = await processarDocumento(fotoBuffer, dados);
            const nomeFinal = (dados.nome || 'documento').replace(/[\\/:*?"<>|]/g, '').toUpperCase();
            const formato = String(req.query?.format || '').toLowerCase();

            if (formato === 'base64') {
                return res.json({
                    fileName: `${nomeFinal}.pdf`,
                    base64: Buffer.from(pdfUint8Array).toString('base64')
                });
            }

            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename="${nomeFinal}.pdf"`);
            res.setHeader('x-file-name', `${nomeFinal}.pdf`);
            res.send(Buffer.from(pdfUint8Array));
        } catch (err) {
            res.status(500).send(`Falha ao gerar PDF: ${err.message}`);
        }
    });

    const server = app.listen(port, '0.0.0.0', () => {
        const ips = Object.values(os.networkInterfaces())
            .flat()
            .filter((i) => i && i.family === 'IPv4' && !i.internal)
            .map((i) => i.address);
        console.log(`APP WEB ONLINE em http://localhost:${port}`);
        if (ips.length > 0) {
            console.log(`API na rede: http://${ips[0]}:${port}`);
        }
    });

    server.on('error', (err) => {
        console.error(`Erro no servidor web: ${err.message}`);
    });

    return server;
}

module.exports = { iniciarServidorWeb };

if (require.main === module) {
    iniciarServidorWeb().catch((err) => {
        console.error(`Falha ao iniciar web-server: ${err.message}`);
        process.exit(1);
    });
}
