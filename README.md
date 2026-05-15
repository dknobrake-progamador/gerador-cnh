# Fabrica 3.0 - Aplicativo Unificado

Projeto convertido para aplicativo com 3 modos:

- Web (interface para gerar PDF)
- Telegram bot
- WhatsApp bot
- Offline local por linha de comando (sem internet)

Todos os modos usam o mesmo motor:

- Extracao de dados: `extrator.js`
- Montagem de PDF: `processador.js`

## 1) Instalar dependencias

```bash
npm install
```

## 2) Configuracao

Copie `.env.example` para `.env` e ajuste:

- `APP_MODE=web` (ou `telegram`, `whatsapp`)
- `PORT=3000` para o modo web
- `TELEGRAM_BOT_TOKEN` para modo telegram

## 3) Executar

```bash
npm run start:web
```

Acesse: `http://localhost:3000`

Outros modos:

```bash
npm run start:telegram
npm run start:whatsapp
npm run start:offline -- --texto "cnh.txt" --foto "foto.jpg" --ear S --saida "saida"
```

## Funciona Offline?

Sim, no modo `web` local e no modo `offline`.

- `web`: roda no seu computador em `localhost`, sem depender de API externa para gerar PDF.
- `offline`: gera PDF direto por arquivo local, sem internet.
- `telegram` e `whatsapp`: exigem internet por causa das plataformas.

## Android (APK)

O projeto agora inclui base Android com Capacitor e roda offline no aparelho.

### Preparar assets mobile

```bash
npm run mobile:build-assets
```

### Criar projeto Android (primeira vez)

```bash
npm run mobile:add-android
```

### Sincronizar app Android com os arquivos web offline

```bash
npm run mobile:sync
```

### Abrir no Android Studio

```bash
npm run mobile:open
```

No Android Studio:

1. Aguarde o Gradle sincronizar.
2. Build > Build Bundle(s) / APK(s) > Build APK(s).
3. Instale o APK no aparelho.

## Expo Go (teste rapido)

Para editar e testar rapidamente no celular com Expo Go:

1. Inicie a API local (geracao PDF):
```bash
npm run start:web
```
2. Descubra seu IP local (exemplo `192.168.0.10`).
3. Abra a pasta [expo-go-app](C:\Users\menino lindo\Documents\fabrica_3.0 telegram\fabrica_3.0 telegram\expo-go-app) e rode:
```bash
npm install
npx expo start
```
4. No celular, abra o Expo Go e escaneie o QR Code.
5. No app, troque `URL da API` para `http://SEU_IP:3000`.

Observacao:
- Celular e computador devem estar na mesma rede Wi-Fi.
- Expo Go e ideal para edicao/teste rapido; APK final continua via Gradle/Android Studio.

## 4) Verificacao rapida

```bash
npm run check
```
