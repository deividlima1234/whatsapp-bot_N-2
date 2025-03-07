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

console.log("🔑 API_KEY cargada:", API_KEY ? "Sí" : "No");
console.log("🌍 API_URL cargada:", API_URL ? "Sí" : "No");

const historialChats = {};

const client = new Client({
    puppeteer: { args: ["--no-sandbox", "--disable-setuid-sandbox"] },
    authStrategy: new LocalAuth()
});

client.on('qr', async qr => {
    console.log("📱 Escanea este código QR para iniciar sesión:");
    console.log(await qrcode.toString(qr, { type: 'terminal', small: true }));
});

client.on('ready', () => {
    console.log('✅ Bot de WhatsApp está listo!');
});

client.on('message', async message => {
    console.log(`📩 Mensaje recibido de ${message.from}: ${message.body}`);

    const contact = await message.getContact();
    const nombreContacto = contact.pushname || contact.name || message._data.notifyName || null;

    if (!historialChats[message.from]) {
        historialChats[message.from] = [];
    }
    historialChats[message.from].push(message.body);
    if (historialChats[message.from].length > 10) {
        historialChats[message.from].shift();
    }

    let respuesta = obtenerInformacionEmpresa(message.body.toLowerCase());

    if (!respuesta) {
        respuesta = await obtenerRespuestaIA(message.from, nombreContacto);
    }

    console.log(`🤖 Respuesta de Eddam: ${respuesta}`);
    message.reply(respuesta || "⚠️ No entendí, dime de otra forma.");
});

function obtenerInformacionEmpresa(mensaje) {
    if (mensaje.includes("quién eres") || mensaje.includes("quién es eddam")) {
        return "👋 Hola, soy *Eddam*, el asistente virtual de *Tecno Digital Perú EIRL*. Estoy aquí para ayudarte con cualquier consulta sobre nuestros servicios.";
    }
    if (mensaje.includes("qué ofreces") || mensaje.includes("servicios")) {
        return "📌 *Nuestros servicios incluyen:*\n✅ Venta de hardware y software\n✅ Soporte técnico especializado\n✅ Seguridad informática y networking\n✅ Desarrollo de sistemas personalizados";
    }
    if (mensaje.includes("horario") || mensaje.includes("atención")) {
        return "📅 Nuestro horario de atención es:\nLunes a Viernes: 08:30 - 18:00\nSábados y Domingos: 09:30 - 13:00";
    }
    if (mensaje.includes("soporte") || mensaje.includes("técnico")) {
        return "🛠️ *Soporte Técnico Premium por WhatsApp:*\nLunes a Sábado: 08:00 - 20:00\n📲 WhatsApp: +51941180300";
    }
    if (mensaje.includes("pago") || mensaje.includes("yape") || mensaje.includes("plin") || mensaje.includes("bbva")) {
        return "💰 *Métodos de pago disponibles:*\n📲 *YAPE - PLIN* : +51941180300 / +51985300000\n🏦 *BBVA Cuenta Corriente Soles:* 011764 000100011187 80\nA nombre de: *Tecno Digital Peru EIRL*";
    }
    return null;
}

async function obtenerRespuestaIA(chatId, nombreContacto) {
    if (!API_KEY) {
        console.error("❌ Error: API_KEY no configurada.");
        return "⚠️ No tengo acceso a la IA en este momento.";
    }
    try {
        const historial = historialChats[chatId] || [];
        const prompt = `Eres Eddam, el asistente virtual de Tecno Digital Perú EIRL. Responde de manera profesional y amigable, brindando información sobre los servicios de la empresa.`;

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
