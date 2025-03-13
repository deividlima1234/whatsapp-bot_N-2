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
const nombresUsuarios = {}; // Nuevo objeto para almacenar nombres

// Función para detectar nombre en el mensaje
function detectarNombre(mensaje) {
    const patrones = [
        /me llamo\s+([A-Za-zÁáÉéÍíÓóÚúÑñ]+)/i,
        /mi nombre es\s+([A-Za-zÁáÉéÍíÓóÚúÑñ]+)/i,
        /soy\s+([A-Za-zÁáÉéÍíÓóÚúÑñ]+)/i
    ];

    for (const patron of patrones) {
        const coincidencia = mensaje.match(patron);
        if (coincidencia) return coincidencia[1];
    }
    return null;
}

client.on('message', async message => {
    console.log(`📩 Mensaje recibido de ${message.from}: ${message.body}`);

    const chatId = message.from;
    let nombreDetectado = detectarNombre(message.body);
    
    // Si detectamos un nombre en el mensaje, lo guardamos
    if (nombreDetectado) {
        nombresUsuarios[chatId] = nombreDetectado;
    }

    if (!historialChats[chatId]) {
        historialChats[chatId] = [];
        // Si es el primer mensaje y no tiene nombre
        if (!nombreDetectado && !nombresUsuarios[chatId]) {
            const respuesta = "👋 Hola, buenas noches. Para poder iniciar la conversación, me gustaría que me brindes tu nombre o el de tu empresa. 😊";
            message.reply(respuesta + "\n\nDesarrollado por:\nEddam H.l");
            return;
        }
    }

    historialChats[chatId].push({ role: "user", text: message.body });

    if (historialChats[chatId].length > MAX_HISTORIAL) {
        historialChats[chatId].shift();
    }

    // Si ya tenemos el nombre y es el segundo mensaje
    if (nombresUsuarios[chatId] && historialChats[chatId].length === 2) {
        let respuesta = `👋 ¡Hola ${nombresUsuarios[chatId]}! Soy *Eddam*, tu asistente virtual en *Tecno Digital Perú EIRL*. 😊\n\n¿Quieres optimizar tus ventas o automatizar tus mensajes? Estoy aquí para ayudarte. 🚀\n\n🔹 *1. Información sobre WaCRM* (Gestión de clientes)\n🔹 *2. Información sobre WaSender* (Envíos masivos)\n🔹 *3. Información sobre ZapTech* (ChatBot avanzado)\n\nEscribe el *número* o una *palabra clave* para saber más. 📲`;
        message.reply(respuesta + "\n\nDesarrollado por:\nEddam H.l");
        return;
    }

    let respuesta = obtenerInformacionEmpresa(message.body.toLowerCase()) || 
                    await obtenerRespuestaIA(chatId, nombresUsuarios[chatId] || "Usuario");

    respuesta = `${respuesta}\n\nDesarrollado por:\nEddam H.l`;
    console.log(`🤖 Respuesta de Eddam: ${respuesta}`);
    message.reply(respuesta);
});

async function obtenerRespuestaIA(chatId, nombreUsuario) {
    if (enProceso[chatId]) return "⏳ Procesando tu solicitud, por favor espera...";

    enProceso[chatId] = true;

    try {
        const historial = historialChats[chatId] || [];
        const prompt = `
            Eres Eddam, el asistente virtual de Tecno Digital Perú EIRL. Responde de forma clara, directa y amigable. 
            El nombre del usuario es: ${nombreUsuario}
            Siempre saluda usando su nombre si está disponible.

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