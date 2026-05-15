const { PDFDocument, rgb, degrees, StandardFonts } = PDFLib;
const ACTIVATION_KEY = "cnh_brasil_activated_v1";
const MASTER_PASSWORD = window.APP_CONFIG?.MASTER_PASSWORD || "";
const ACCESS_PASSWORD = window.APP_CONFIG?.ACCESS_PASSWORD || "";
const SIGNATURE_FONTS = window.APP_CONFIG?.SIGNATURE_FONTS || [];
let cachedSignatureFonts = null;

function extrair(texto, regex) {
  const m = texto.match(regex);
  return m && m[1] ? m[1].trim() : "";
}

function formatarData(data) {
  if (!data) return "";
  if (data.includes("-")) {
    const p = data.split("-");
    if (p[0].length === 4) return `${p[2]}/${p[1]}/${p[0]}`;
  }
  return data;
}

function organizarDadosVistoria(texto, ear) {
  const ufAtual = extrair(texto, /UF Habilita[cç][aã]o Atual:\s*([A-Z]{2})/i);
  const ufExp = extrair(texto, /UF EXPEDI[CÇ][AÃ]O:\s*([A-Z]{2})/i);
  const uf = (ufAtual || ufExp || extrair(texto, /\bUF:\s*([A-Z]{2})\b/i) || "RJ").toUpperCase();
  const cidade = (extrair(texto, /(?:Cidade|Munic[ií]pio|LOCAL):\s*([^/,\n\r0-9]+)/i) || "RIO DE JANEIRO").toUpperCase();
  const categoria = (extrair(texto, /(?:Categoria Atual|Categoria):\s*([A-Z]+)/i) || "B").toUpperCase();
  const validade = extrair(texto, /Validade:\s*([\d/]+)/i);
  let pai = extrair(texto, /(?:Nome do Pai|Pai):\s*(.*)/i);
  if (!pai || /^=+\s*DOCUMENTA[CÇ][AÃ]O E REGISTROS\s*=+$/i.test(pai.trim())) pai = "NAO DECLARADO";

  const dados = {
    nome: extrair(texto, /(?:Nome Completo|NOME):\s*(.*)/i),
    cpf: extrair(texto, /CPF:\s*([\d.-]+)/i),
    rg: `${extrair(texto, /(?:N[uú]mero do Documento|DOCUMENTO RG|RG):\s*([\w.-]+)/i)} DETRAN ${uf}`.replace(/\s+/g, " ").trim(),
    nascimento: `${formatarData(extrair(texto, /(?:Data de Nascimento|Nascimento|DATA NASCIMENTO):\s*([\d/-]+)/i))} ${cidade} ${uf}`.trim(),
    mae: extrair(texto, /(?:Nome da M[aã]e|M[aã]e):\s*(.*)/i),
    pai,
    emissao: extrair(texto, /(?:[UÚ]ltima Emiss[aã]o Hist[oó]rico|Emiss[aã]o):\s*([\d/]+)/i),
    primeira: extrair(texto, /(?:Primeira Habilita[cç][aã]o|Primeira):\s*([\d/]+)/i),
    registro: extrair(texto, /(?:N[uú]mero de Registro|Registro|NÚMERO CNH):\s*(\d+)/i),
    renach: extrair(texto, /RENACH:\s*(\w+)/i),
    numero: extrair(texto, /(?:Formul[aá]rio CNH|Formul[aá]rio):\s*(\d+)/i),
    categoria,
    validade,
    local: `${cidade} ${uf}`.replace(/\s+/g, " ").trim(),
    estado: "RIO DE JANEIRO",
    uf,
    ear: String(ear || "N").toUpperCase().startsWith("S") ? "S" : "N",
    aleatorio: Math.floor(Math.random() * 100000000000).toString().padStart(11, "0")
  };

  ["A", "B", "C", "D", "E"].forEach((v) => {
    dados[`validade${v}`] = categoria.includes(v) ? validade : "";
  });
  if (dados.validadeC || dados.validadeD || dados.validadeE || /(AC|AD|AE|C|D|E)/.test(categoria)) {
    dados.validadeB = validade || dados.validadeB;
  }
  return dados;
}

async function fileToBytes(file) {
  return new Uint8Array(await file.arrayBuffer());
}

function formatarAssinatura(texto) {
  if (!texto) return "";
  texto = texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z\s.]/g, "").trim();
  const cap = (p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase();
  const conectores = ["de", "da", "do", "dos", "das", "e"];
  const partesOriginais = texto.split(/\s+/).map(cap);
  const nomeCompleto = partesOriginais.join(" ");
  if (nomeCompleto.length <= 27) return nomeCompleto;
  const partes = texto.split(/\s+/).filter(p => !conectores.includes(p.toLowerCase())).map(cap);
  if (partes.length <= 2) return nomeCompleto.slice(0, 27);
  const primeiro = partes[0];
  const ultimo = partes[partes.length - 1];
  let meio = partes.slice(1, -1);
  const montar = (m) => [primeiro, ...m, ultimo].join(" ");
  if (montar(meio).length <= 27) return montar(meio);
  for (let i = meio.length - 1; i >= 0; i--) {
    meio[i] = meio[i].charAt(0).toUpperCase() + ".";
    if (montar(meio).length <= 27) return montar(meio);
  }
  return montar(meio).slice(0, 27);
}

async function carregarFontesAssinatura() {
  if (cachedSignatureFonts) return cachedSignatureFonts;
  const fontes = [];
  for (const nome of SIGNATURE_FONTS) {
    try {
      const res = await fetch(`./assinaturas/${encodeURIComponent(nome)}`);
      if (!res.ok) continue;
      const bytes = await res.arrayBuffer();
      fontes.push({ nome, bytes });
    } catch {}
  }
  cachedSignatureFonts = fontes;
  return fontes;
}

async function escolherFonteAssinatura(pdfDoc) {
  if (!window.fontkit) return await pdfDoc.embedFont(StandardFonts.TimesRomanItalic);
  try { pdfDoc.registerFontkit(window.fontkit); } catch {}
  const fontes = await carregarFontesAssinatura();
  if (!fontes.length) return await pdfDoc.embedFont(StandardFonts.TimesRomanItalic);

  const inicio = Math.floor(Math.random() * fontes.length);
  for (let i = 0; i < fontes.length; i++) {
    const idx = (inicio + i) % fontes.length;
    try {
      return await pdfDoc.embedFont(fontes[idx].bytes);
    } catch {}
  }
  return await pdfDoc.embedFont(StandardFonts.TimesRomanItalic);
}

async function processarDocumentoBrowser(fotoFile, dados) {
  const gabaritoBytes = await fetch("./gabarito.pdf").then((r) => r.arrayBuffer());
  const pdfDoc = await PDFDocument.load(gabaritoBytes);
  const form = pdfDoc.getForm();
  const campos = form.getFields();
  const nomesCampos = campos.map((f) => f.getName());
  const pagina = pdfDoc.getPages()[0];

  if (nomesCampos.includes("foto")) {
    const rect = form.getButton("foto").acroField.getWidgets()[0].getRectangle();
    const fotoBytes = await fileToBytes(fotoFile);
    let img;
    try { img = await pdfDoc.embedJpg(fotoBytes); } catch { img = await pdfDoc.embedPng(fotoBytes); }
    pagina.drawImage(img, { x: rect.x, y: rect.y, width: rect.width, height: rect.height });
  }

  if (nomesCampos.includes("diretor")) {
    try {
      const diretorBytes = await fetch(`./diretor/${(dados.uf || "RJ").toUpperCase()}.png`).then((r) => r.arrayBuffer());
      const rect = form.getButton("diretor").acroField.getWidgets()[0].getRectangle();
      const img = await pdfDoc.embedPng(diretorBytes);
      pagina.drawImage(img, { x: rect.x, y: rect.y, width: rect.width, height: rect.height });
    } catch {}
  }

  ["formulario", "formulario1", "formulario2"].forEach((campo) => {
    if (!nomesCampos.includes(campo) || !dados.numero) return;
    const rect = form.getButton(campo).acroField.getWidgets()[0].getRectangle();
    pagina.drawText(String(dados.numero), { x: rect.x + (rect.width / 2) + 4, y: rect.y + 10, size: 14, color: rgb(0.3, 0.3, 0.3), rotate: degrees(90) });
  });

  if (nomesCampos.includes("assinatura")) {
    const rect = form.getButton("assinatura").acroField.getWidgets()[0].getRectangle();
    const font = await escolherFonteAssinatura(pdfDoc);
    const texto = formatarAssinatura(dados.nome).toUpperCase();
    let size = 4.1;
    const max = rect.width - 12;
    while (size > 3.2 && font.widthOfTextAtSize(texto, size) > max) size -= 0.1;
    const w = font.widthOfTextAtSize(texto, size);
    const x = Math.max(rect.x + 6, rect.x + ((rect.width - w) / 2));
    pagina.drawText(texto, { x, y: rect.y + 1, size, font });
  }

  const mapa = {
    nome: dados.nome, cpf: dados.cpf, rg: dados.rg, nascimento: dados.nascimento, registro: dados.registro,
    categoria: dados.categoria, renach: dados.renach, mae: dados.mae, pai: dados.pai, local: dados.local,
    estado: dados.estado, emissao: dados.emissao, primeira: dados.primeira, validade: dados.validade,
    ear: dados.ear === "S" ? "EAR" : "", aleatorio: dados.aleatorio,
    validadeA: dados.validadeA, validadeB: dados.validadeB, validadeC: dados.validadeC, validadeD: dados.validadeD, validadeE: dados.validadeE
  };
  campos.forEach((campo) => {
    const nome = campo.getName();
    if (campo.constructor.name === "PDFTextField" && mapa[nome] !== undefined) {
      try { campo.setText(String(mapa[nome] || "").toUpperCase()); } catch {}
    }
  });

  form.flatten();
  return await pdfDoc.save();
}

function bytesToBase64(uint8) {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < uint8.length; i += chunk) binary += String.fromCharCode(...uint8.subarray(i, i + chunk));
  return btoa(binary);
}

async function exportarPdf(bytes, nome) {
  const pdfSaver = window.Capacitor?.Plugins?.PdfSaver;
  if (pdfSaver?.savePdf) {
    await pdfSaver.savePdf({ base64: bytesToBase64(bytes), fileName: nome });
    return;
  }
  const blob = new Blob([bytes], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nome;
  a.click();
  URL.revokeObjectURL(url);
}

function iniciarControleDeAcesso() {
  const lockScreen = document.getElementById("lockScreen");
  const appContent = document.getElementById("appContent");
  const lockTitle = document.getElementById("lockTitle");
  const lockDesc = document.getElementById("lockDesc");
  const lockInput = document.getElementById("lockInput");
  const lockBtn = document.getElementById("lockBtn");
  const lockMsg = document.getElementById("lockMsg");
  let etapa = localStorage.getItem(ACTIVATION_KEY) === "1" ? "acesso" : "ativacao";

  function render() {
    lockMsg.textContent = "";
    lockInput.value = "";
    if (etapa === "ativacao") {
      lockTitle.textContent = "Ativacao inicial";
      lockDesc.textContent = "Digite a senha master para ativar o aplicativo.";
    } else {
      lockTitle.textContent = "Acesso";
      lockDesc.textContent = "Digite a senha de acesso para abrir o aplicativo.";
    }
  }

  lockBtn.addEventListener("click", () => {
    if (!MASTER_PASSWORD || !ACCESS_PASSWORD) {
      lockMsg.textContent = "Configuracao de senha ausente.";
      return;
    }
    const s = lockInput.value.trim();
    if (etapa === "ativacao") {
      if (s !== MASTER_PASSWORD) return void (lockMsg.textContent = "Senha master invalida.");
      localStorage.setItem(ACTIVATION_KEY, "1");
      etapa = "acesso";
      render();
      return void (lockMsg.textContent = "Aplicativo ativado. Digite a senha de acesso.");
    }
    if (s !== ACCESS_PASSWORD) return void (lockMsg.textContent = "Senha de acesso invalida.");
    lockScreen.style.display = "none";
    appContent.style.display = "block";
  });
  render();
}

iniciarControleDeAcesso();

const form = document.getElementById("form");
const btn = document.getElementById("btn");
const btnVisualizar = document.getElementById("btnVisualizar");
const btnExportar = document.getElementById("btnExportar");
const btnAbrir = document.getElementById("btnAbrir");
const previewBox = document.getElementById("previewBox");
const previewPdf = document.getElementById("previewPdf");
const result = document.getElementById("result");
const error = document.getElementById("error");
let ultimoPdf = null;
let ultimoNome = "documento.pdf";
let ultimoUrl = "";

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  result.style.display = "none";
  error.style.display = "none";
  btn.disabled = true;
  btn.textContent = "Gerando...";
  try {
    const texto = document.getElementById("texto").value.trim();
    const ear = document.getElementById("ear").value;
    const foto = document.getElementById("foto").files[0];
    if (!texto.toUpperCase().includes("NOME COMPLETO:")) throw new Error('Texto invalido. Inclua "NOME COMPLETO:".');
    if (!foto) throw new Error("Foto obrigatoria.");
    const dados = organizarDadosVistoria(texto, ear);
    ultimoPdf = await processarDocumentoBrowser(foto, dados);
    ultimoNome = `${(dados.nome || "documento").replace(/[\\/:*?\"<>|]/g, "").toUpperCase()}.pdf`;
    if (ultimoUrl) URL.revokeObjectURL(ultimoUrl);
    ultimoUrl = URL.createObjectURL(new Blob([ultimoPdf], { type: "application/pdf" }));
    btnVisualizar.disabled = false;
    btnExportar.disabled = false;
    btnAbrir.disabled = false;
    result.textContent = "PDF gerado. Clique em Visualizar PDF ou Exportar PDF.";
    result.style.display = "block";
  } catch (err) {
    error.textContent = err.message;
    error.style.display = "block";
  } finally {
    btn.disabled = false;
    btn.textContent = "Gerar PDF";
  }
});

btnVisualizar.addEventListener("click", () => {
  if (!ultimoUrl) return;
  previewPdf.data = ultimoUrl;
  previewBox.style.display = "block";
});
btnAbrir.addEventListener("click", () => {
  if (!ultimoUrl) return;
  window.open(ultimoUrl, "_blank");
});
btnExportar.addEventListener("click", async () => {
  if (!ultimoPdf) return;
  await exportarPdf(ultimoPdf, ultimoNome);
});
