require('dotenv').config();
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

const API_URL = process.env.API_URL;
const API_KEY = process.env.API_KEY;

if (!API_KEY || !API_URL) {
    console.error("❌ ERROR: API_KEY o API_URL no están configuradas en el archivo .env.");
    process.exit(1);
}

// Constantes para configuración
const MAX_TOKENS = 500;
const MAX_HISTORIAL = 5;

const historialChats = {};
const enProceso = {};

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

    const nombreUsuario = message._data.notifyName || "Usuario";

    if (!historialChats[message.from]) {
        historialChats[message.from] = [];
    }
    historialChats[message.from].push({ role: "user", text: message.body });

    if (historialChats[message.from].length > MAX_HISTORIAL) {
        historialChats[message.from].shift();
    }

    let respuesta = obtenerInformacionEmpresa(message.body.toLowerCase()) || await obtenerRespuestaIA(message.from, nombreUsuario);

    // Add signature to the response
    respuesta = `${respuesta}\n\nDesarrollado por:\nEddam H.l`;

    console.log(`🤖 Respuesta de Eddam: ${respuesta}`);
    message.reply(respuesta || "⚠️ No entendí, ¿puedes explicarlo de otra forma?");
});

const respuestas = {
    "1": "📋 *Información de WaCRM*\n💬 Gestiona clientes de forma eficiente.\n✅ *Filtros de Chat*: Encuentra conversaciones específicas fácilmente.\n✅ *Transmisión*: Envía mensajes masivos sin complicaciones.\n✅ *Bot con Respuesta Automática*: Responde rápido y sin esfuerzo.\n✅ *Guardia de Grupo*: Controla quién ingresa y qué mensajes se envían.\n\n🤔 ¿Te gustaría implementar WaCRM en tu negocio? ¿O prefieres conocer más sobre nuestros otros servicios?\n\n*Responde con:*\n- 'Quiero implementar WaCRM'\n- 'Más información de otros servicios'",
    
    "2": "📩 *Información de WaSender*\n📨 La solución perfecta para marketing masivo:\n✅ Envíos personalizados con fotos, videos y documentos\n✅ Sistema anti-bloqueo integrado\n✅ Gestión de múltiples cuentas de WhatsApp\n✅ Filtros inteligentes de contactos\n✅ Mensajes personalizados por cliente\n\n💡 ¿Te gustaría ver una demostración de WaSender en acción? ¿O tienes dudas sobre alguna función específica?\n\n*Responde con:*\n- 'Quiero una demo de WaSender'\n- 'Tengo dudas sobre WaSender'",
    
    "3": "🤖 *ZapTech (SuperWasap)*\n🚀 La herramienta más completa para WhatsApp:\n✅ ChatBot con IA para atención 24/7\n✅ Sistema de envíos masivos avanzado\n✅ Gestión multi-cuenta profesional\n✅ Automatización completa de respuestas\n\n💼 ¿Te gustaría ver cómo ZapTech puede transformar tu negocio? ¡Agendemos una demostración personalizada!\n\n*Responde con:*\n- 'Agendar demo de ZapTech'\n- 'Más información de ZapTech'",
    
    "hola": "👋 ¡Hola! Soy *Eddam*, tu asistente virtual en *Tecno Digital Perú EIRL*. 😊\n\n¿Quieres optimizar tus ventas o automatizar tus mensajes? Estoy aquí para ayudarte. 🚀\n\n🔹 *1. Información sobre WaCRM* (Gestión de clientes)\n🔹 *2. Información sobre WaSender* (Envíos masivos)\n🔹 *3. Información sobre ZapTech* (ChatBot avanzado)\n\nEscribe el *número* o una *palabra clave* para saber más. 📲"
};

function obtenerInformacionEmpresa(mensaje) {
    const correcciones = { 
        "wacmr": "1", 
        "wasenr": "2", 
        "zaptch": "3",
        "wasender": "2",
        "wacrm": "1",
        "zaptech": "3"
    };
    
    mensaje = mensaje.toLowerCase();
    
    // Verificar palabras clave específicas
    if (mensaje.includes("demo") || mensaje.includes("implementar")) {
        return "🎯 ¡Excelente elección! Para coordinar una demostración personalizada, por favor proporciona:\n\n1️⃣ Nombre de tu empresa\n2️⃣ Rubro del negocio\n3️⃣ Horario preferido para la demo\n\nUn asesor se pondrá en contacto contigo pronto. 🤝";
    }

    // Procesamiento normal de respuestas
    mensaje = mensaje.replace(/wacmr|wasenr|zaptch|wasender|wacrm|zaptech/gi, match => correcciones[match.toLowerCase()] || match);

    for (const [clave, respuesta] of Object.entries(respuestas)) {
        if (mensaje.includes(clave)) {
            return respuesta;
        }
    }
    return null;
}

async function obtenerRespuestaIA(chatId, nombreUsuario) {
    if (enProceso[chatId]) return "⏳ Procesando tu solicitud, por favor espera...";

    enProceso[chatId] = true;

    try {
        const historial = historialChats[chatId] || [];
        const prompt = `
            Eres Eddam, el asistente virtual de Tecno Digital Perú EIRL. Responde de forma clara, directa y amigable. 
            Siempre saluda por el nombre del usuario si es posible. 

            Los servicios disponibles son:
            1. WaCRM: Gestión eficiente de clientes.
            2. WaSender: Envíos masivos automatizados.
            3. ZapTech: ChatBot avanzado.

            Si el usuario pregunta "¿qué me recomiendas?", consulta primero sus necesidades y luego sugiere la mejor opción.
        `;

        const mensajesIA = [
            { role: "user", parts: [{ text: prompt }] },
            ...historial.map(msg => ({
                role: msg.role,
                parts: [{ text: msg.text }]
            }))
        ];

        if (mensajesIA.length > 6) {
            mensajesIA.splice(1, mensajesIA.length - 6);
        }

        const response = await fetch(`${API_URL}?key=${API_KEY}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                contents: mensajesIA,
                generationConfig: { maxOutputTokens: MAX_TOKENS }
            })
        });

        if (!response.ok) {
            if (response.status === 400) {
                return "⚠️ Parece que hubo un problema con la conexión. Puede ser un problema temporal. Por favor, intenta nuevamente o contacta a soporte si el problema persiste.";
            }
            throw new Error(`Error de API: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        let respuesta = data?.candidates?.[0]?.content?.parts?.[0]?.text || "⚠️ No recibí respuesta.";

        return respuesta.length > MAX_TOKENS ? respuesta.substring(0, MAX_TOKENS) + "..." : respuesta;
    } catch (error) {
        console.error("❌ Error con Google Gemini:", error);
        return "❌ Hubo un problema al conectar con el asistente. Por favor, intenta nuevamente en unos momentos.";
    } finally {
        delete enProceso[chatId];
    }
}

client.initialize();