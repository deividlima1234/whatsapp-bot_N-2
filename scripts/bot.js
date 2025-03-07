const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args)); // Importación dinámica

const API_URL = process.env.API_URL;
const API_KEY = process.env.API_KEY;

if (!API_KEY || !API_URL) {
    console.error("❌ ERROR: API_KEY o API_URL no están configuradas en las variables de entorno.");
    process.exit(1);
}

console.log("🔑 API_KEY cargada:", API_KEY ? "Sí" : "No");
console.log("🌍 API_URL cargada:", API_URL ? "Sí" : "No");

// Historial de mensajes por chat
const historialChats = {};

const client = new Client({
    puppeteer: { args: ["--no-sandbox", "--disable-setuid-sandbox"] },
    authStrategy: new LocalAuth()
});

client.on('qr', async qr => {
    console.log("📱 Escanea este código QR para iniciar sesión:");
    try {
        console.log(await qrcode.toString(qr, { type: 'terminal', small: true }));
    } catch (error) {
        console.error("❌ Error al generar el QR en la terminal:", error);
    }
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

    // Verificar si el usuario pregunta por información de la empresa
    let respuesta = obtenerInformacionEmpresa(message.body.toLowerCase());

    if (!respuesta) {
        respuesta = await obtenerRespuestaIA(message.from, nombreContacto);
    }

    console.log(`🤖 Respuesta de Eddam: ${respuesta}`);
    message.reply(respuesta || "⚠️ No entendí, dime de otra forma.");
});

function obtenerInformacionEmpresa(mensaje) {
    if (mensaje.includes("horario") || mensaje.includes("atención")) {
        return `📅 Nuestro horario de atención es:\nLunes a Viernes: 08:30 - 18:00\nSábados y Domingos: 09:30 - 13:00`;
    }

    if (mensaje.includes("soporte") || mensaje.includes("técnico")) {
        return `🛠️ *Soporte Técnico Premium por WhatsApp:*\nLunes a Sábado: 08:00 - 20:00\n📲 WhatsApp: +51941180300`;
    }

    if (mensaje.includes("pago") || mensaje.includes("billetera") || mensaje.includes("yape") || mensaje.includes("plin") || mensaje.includes("bbva")) {
        return `💰 *Métodos de pago disponibles:*\n📲 *YAPE - PLIN* : +51941180300 / +51985300000\n🏦 *BBVA Cuenta Corriente Soles:* 011764 000100011187 80\nA nombre de: *Tecno Digital Peru EIRL*`;
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

        let saludo = nombreContacto ? `Saluda a la persona usando su nombre (${nombreContacto}) si es posible. ` : "";
        const prompt = `${saludo}Responde como un hombre llamado Eddam. Habla de manera natural y breve, sin sonar robótico. Usa expresiones humanas y relajadas. No menciones que eres una IA.`;

        const mensajesIA = [{ role: "user", parts: [{ text: prompt }] }]
            .concat(historial.map(msg => ({ role: "user", parts: [{ text: msg }] })));

        const response = await fetch(`${API_URL}?key=${API_KEY}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ contents: mensajesIA })
        });

        const data = await response.json();
        console.log("🔍 Respuesta completa de Gemini:", JSON.stringify(data, null, 2));

        let respuesta = data?.candidates?.[0]?.content?.parts?.[0]?.text || "⚠️ No recibí respuesta.";
        return respuesta.length > 200 ? respuesta.slice(0, 200) + "..." : respuesta;
    } catch (error) {
        console.error("❌ Error con Google Gemini:", error);
        return "❌ Error al conectar con la IA.";
    }
}

client.initialize();
