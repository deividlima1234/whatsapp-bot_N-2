require('dotenv').config();
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

const API_URL = process.env.API_URL;
const API_KEY = process.env.API_KEY;

if (!API_KEY || !API_URL) {
    console.error("❌ ERROR: API_KEY o API_URL no están configuradas.");
    process.exit(1);
}

const historialChats = {};

const client = new Client({
    puppeteer: { args: ["--no-sandbox", "--disable-setuid-sandbox"] },
    authStrategy: new LocalAuth()
});

client.on('qr', async qr => {
    console.log("📱 Escanea este código QR para iniciar sesión:");
    console.log(await qrcode.toString(qr, { type: 'terminal', small: true }));
});

client.on('ready', () => console.log('✅ Bot de WhatsApp está listo!'));

client.on('message', async message => {
    console.log(`📩 Mensaje recibido de ${message.from}: ${message.body}`);

    if (!historialChats[message.from]) {
        historialChats[message.from] = [];
    }
    historialChats[message.from].push(message.body);
    if (historialChats[message.from].length > 10) {
        historialChats[message.from].shift();
    }

    let respuesta = obtenerInformacionEmpresa(message.body.toLowerCase()) || await obtenerRespuestaIA(message.from);

    console.log(`🤖 Respuesta de Eddam: ${respuesta}`);
    message.reply(respuesta || "⚠️ No entendí, dime de otra forma.");
});

const respuestas = {
    "1": "📋 *Información de WaCRM*\n🔗 [Ver más detalles](https://codecanyon.net/item/wasender-bulk-whatsapp-sender-group-sender-wahtsapp-bot/35762285)\n\n✅ *Filtros de Chat*\n✅ *Transmisión*\n✅ *Bot con Respuesta Automática*\n✅ *Guardia de Grupo*\n✅ *Horario*\n✅ *Recordatorio*\n✅ *Extractor de datos*\n✅ *Utilidades del grupo*\n✅ *Herramientas*",
    "2": "📩 *Información de WaSender*\n✅ Envíos con fotos, videos y documentos\n✅ Calentador de cuentas\n✅ Múltiples cuentas de WhatsApp\n✅ Filtro de Números y Anti-Bloqueos\n✅ Publicación en grupos masivos\n✅ Capturador de contactos de Google Maps",
    "3": "🤖 *ZapTech (SuperWasap)*\n✅ ChatBot con IA\n✅ Envíos masivos avanzados\n✅ Multicuenta/multiagente\n✅ Calentador comunitario",
    "hola": "👋 ¡Hola! Bienvenido a *Tecno Digital Perú EIRL*.\nSoy Eddam, tu asistente virtual. 😊\n\nOfrecemos soluciones tecnológicas para empresas y particulares. ¿En qué puedo ayudarte hoy?\n\n🔹 *1. Información sobre WaCRM*\n🔹 *2. Información sobre WaSender*\n🔹 *3. Información sobre ZapTech (SuperWasap)*\n\nPor favor, responde con el *número* o escribe una *palabra clave* para obtener información detallada.\nEstoy aquí para ayudarte. 🚀"
};

function obtenerInformacionEmpresa(mensaje) {
    for (const [clave, respuesta] of Object.entries(respuestas)) {
        if (mensaje.includes(clave)) {
            return respuesta;
        }
    }
    return null;
}

async function obtenerRespuestaIA(chatId) {
    try {
        const historial = historialChats[chatId] || [];
        const prompt = `Eres Eddam, el asistente virtual de Tecno Digital Perú EIRL. Responde de manera profesional y amigable.`;

        const mensajesIA = [{ role: "user", parts: [{ text: prompt }] }]
            .concat(historial.map(msg => ({ role: "user", parts: [{ text: msg }] })));

        const response = await fetch(`${API_URL}?key=${API_KEY}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ contents: mensajesIA })
        });

        if (!response.ok) {
            throw new Error(`Error de API: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        let respuesta = data?.candidates?.[0]?.content?.parts?.[0]?.text || "⚠️ No recibí respuesta.";
        return respuesta.length > 200 ? respuesta.slice(0, 200) + "..." : respuesta;
    } catch (error) {
        console.error("❌ Error con Google Gemini:", error);
        return "❌ Error al conectar con la IA.";
    }
}

client.initialize();
