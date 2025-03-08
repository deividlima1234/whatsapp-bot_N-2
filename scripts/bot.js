require('dotenv').config();
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

// Configuración de API de Gemini
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

// 📲 Generar el código QR
client.on('qr', async qr => {
    console.log("📱 Escanea este código QR para iniciar sesión:");
    console.log(await qrcode.toString(qr, { type: 'terminal', small: true }));
});

// ✅ Cliente listo
client.on('ready', () => console.log('✅ Bot de WhatsApp está listo!'));

// 📩 Gestión de mensajes
client.on('message', async message => {
    console.log(`📩 Mensaje recibido de ${message.from}: ${message.body}`);

    const contact = await message.getContact();
    const nombreContacto = contact.pushname || contact.name || message._data.notifyName || null;

    // Guardar el historial del chat
    if (!historialChats[message.from]) {
        historialChats[message.from] = [];
    }
    historialChats[message.from].push(message.body);
    if (historialChats[message.from].length > 10) {
        historialChats[message.from].shift();
    }

    // Responder el mensaje
    let respuesta = obtenerInformacionEmpresa(message.body.toLowerCase()) || await obtenerRespuestaIA(message.from, nombreContacto);

    console.log(`🤖 Respuesta de Eddam: ${respuesta}`);
    message.reply(respuesta || "⚠️ No entendí, dime de otra forma.");
});

// 🧠 Base de respuestas predefinidas
const respuestas = {
    "quién eres": "👋 Hola, soy *Eddam*, el asistente virtual de *Tecno Digital Perú EIRL*. Estoy aquí para ayudarte con cualquier consulta sobre nuestros servicios.",
    "waCRM": "📋 *WaCRM* incluye:\n✅ Filtros de chat\n✅ Transmisión masiva\n✅ Bot con respuesta automática\n✅ Guardia de grupo\n✅ Horario programado\n✅ Recordatorio de actividades\n✅ Respuestas rápidas\n✅ Extractor de datos\n✅ Utilidades de grupo\n✅ Herramientas para desenfocar, generar enlaces y enviar mensajes directos.",
    "waSender": "📩 *WaSender* incluye:\n✅ Auto - Respuestas Ilimitadas\n✅ Envíos con fotos, videos y documentos\n✅ Calentador de cuentas\n✅ Múltiples cuentas de WhatsApp\n✅ Filtro de Números y Anti-Bloqueos\n✅ Publicación en grupos masivos\n✅ Capturador de contactos de Google Maps.",
    "zaptech": "🤖 *ZapTech (SuperWasap)* es la combinación de WaCRM y WaSender, ideal para empresas grandes, ofreciendo:\n✅ ChatBot con IA\n✅ Envíos masivos avanzados\n✅ Multicuenta/multiagente\n✅ Calentador comunitario.",
    "superwasap + crm": "🚀 *SuperWasap + CRM* es el mejor automatizador de envíos masivos por WhatsApp con funciones únicas:\n✅ Texto, imágenes, videos y más\n✅ Función Anti-Ban\n✅ Miles de clientes internacionales\n✅ Licencia anual por *$100* incluyendo IGV.",
    "horario": "📅 Nuestro horario de atención es:\nLunes a Viernes: 08:30 - 18:00\nSábados y Domingos: 09:30 - 13:00",
    "soporte": "🛠️ *Soporte Técnico Premium por WhatsApp:*\nLunes a Sábado: 08:00 - 20:00\n📲 WhatsApp: +51941180300",
    "pago": "💰 *Métodos de pago disponibles:*\n📲 *YAPE - PLIN* : +51941180300 / +51985300000\n🏦 *BBVA Cuenta Corriente Soles:* 011764 000100011187 80\nA nombre de: *Tecno Digital Peru EIRL*"
};

// 🔍 Obtener información de la empresa
function obtenerInformacionEmpresa(mensaje) {
    for (const [clave, respuesta] of Object.entries(respuestas)) {
        if (mensaje.includes(clave)) {
            return respuesta;
        }
    }
    return null;
}

// 🤖 Obtener respuesta mediante IA
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
