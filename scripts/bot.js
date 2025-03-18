require('dotenv').config();
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

const API_URL = process.env.API_URL;
const API_KEY = process.env.API_KEY;

if (!API_KEY || !API_URL) {
    console.error("❌ ERROR: API_KEY o API_URL no están configuradas en el archivo .env.");
    process.exit(1);
}

// Configuración del servidor Express
const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(__dirname + '/../'));  // Sirve todos los archivos desde la raíz del proyecto

// Constantes para configuración
const MAX_TOKENS = 1000;
const MAX_HISTORIAL = 5;

const historialChats = {};
const enProceso = {};

// Nuevo objeto para guardar el nombre y estado del usuario
const datosUsuario = {};

const client = new Client({
    puppeteer: { args: ["--no-sandbox", "--disable-setuid-sandbox"] },
    authStrategy: new LocalAuth()
});

// Evento para enviar el QR al cliente web
client.on('qr', async qr => {
    console.log("📱 Escanea este código QR para iniciar sesión:");
    console.log(await qrcode.toString(qr, { type: 'terminal', small: true }));

    // Emitir el QR mediante Socket.IO
    io.emit('qr', qr);
});

client.on('ready', () => {
    console.log('✅ Bot de WhatsApp está listo!');
    io.emit('status', '✅ Bot de WhatsApp está listo!');
});

// Conexión del cliente de Socket.IO
io.on('connection', (socket) => {
    console.log('🔌 Cliente web conectado al socket');
});

// Iniciar el cliente de WhatsApp
client.initialize();

// Escuchar el puerto en Railway
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🚀 Servidor en ejecución en el puerto ${PORT}`);
});


client.on('message', async message => {
    console.log(`📩 Mensaje recibido de ${message.from}: ${message.body}`);

    // Inicializa datos de usuario si no existen
    if (!datosUsuario[message.from]) {
        datosUsuario[message.from] = { name: null, askedForName: false, greeted: false };
    }

    // Inicializa historial de chat si no existe
    if (!historialChats[message.from]) {
        historialChats[message.from] = [];
    }
    historialChats[message.from].push({ role: "user", text: message.body });
    if (historialChats[message.from].length > MAX_HISTORIAL) {
        historialChats[message.from].shift();
    }

    // Expresión regular para detectar el nombre
    const regexNombre = /(?:me llamo|mi nombre es|soy)\s+(\w+)/i;
    const matchNombre = message.body.match(regexNombre);

    // Función auxiliar para detectar el saludo (buenos días/noches)
    const obtenerSaludo = (texto) => {
        if (/buenas noches/i.test(texto)) return "buenas noches";
        if (/buenos días/i.test(texto)) return "buenos días";
        return "hola";
    };

    // Lógica para el primer mensaje y la solicitud del nombre
    if (!datosUsuario[message.from].name) {
        // Si se detecta el nombre en el mensaje, se guarda y se envía la bienvenida completa.
        if (matchNombre) {
            const nombreExtraido = matchNombre[1];
            datosUsuario[message.from].name = nombreExtraido;
            const saludo = obtenerSaludo(message.body);
            const respuestaBienvenida = 
`👋 ¡Hola! ${nombreExtraido} ${saludo}, me llamo Eddam, tu asistente virtual en Tecno Digital Perú EIRL. 😊

¿Quieres optimizar tus ventas o automatizar tus mensajes? Estoy aquí para ayudarte. 🚀

🔹 1. Información sobre WaCRM (Gestión de clientes)
🔹 2. Información sobre WaSender (Envíos masivos)
🔹 3. Información sobre ZapTech (ChatBot avanzado)

Escribe el número o una palabra clave para saber más. 📲`;
            datosUsuario[message.from].greeted = true;
            message.reply(respuestaBienvenida);
            return;
        } else {
            // Si es el primer mensaje y no se detecta nombre, se solicita.
            if (!datosUsuario[message.from].askedForName) {
                const saludo = obtenerSaludo(message.body);
                message.reply(`${saludo}, para poder iniciar la conversación me gustaría que me brindes tu nombre o el nombre de tu empresa.`);
                datosUsuario[message.from].askedForName = true;
                return;
            }
            // Si ya se preguntó pero aún no se recibe nombre, se puede optar por procesar el mensaje o seguir insistiendo.
            // En este ejemplo, esperamos el mensaje con el nombre.
        }
    } else if (!datosUsuario[message.from].greeted) {
        // Si ya se preguntó y ahora el usuario responde con su nombre
        if (matchNombre) {
            const nombreExtraido = matchNombre[1];
            datosUsuario[message.from].name = nombreExtraido;
        }
        const saludo = obtenerSaludo(message.body);
        const respuestaBienvenida = 
`👋 ¡Hola! ${datosUsuario[message.from].name} ${saludo}, soy Eddam, tu asistente virtual en Tecno Digital Perú EIRL. 😊

¿Quieres optimizar tus ventas o automatizar tus mensajes? Estoy aquí para ayudarte. 🚀

🔹 1. Información sobre WaCRM (Gestión de clientes)
🔹 2. Información sobre WaSender (Envíos masivos)
🔹 3. Información sobre ZapTech (ChatBot avanzado)

Escribe el número o una palabra clave para saber más. 📲`;
        datosUsuario[message.from].greeted = true;
        message.reply(respuestaBienvenida);
        return;
    }

    // Actualiza el nombre de usuario a usar (priorizando el nombre capturado)
    const nombreUsuario = datosUsuario[message.from].name || message._data.notifyName || "Usuario";

    // Si no se cumple ninguna de las condiciones anteriores, se continúa con el flujo normal
    let respuesta = obtenerInformacionEmpresa(message.body.toLowerCase()) || await obtenerRespuestaIA(message.from, nombreUsuario);

    // Agrega firma a la respuesta
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

        return respuesta;
    } catch (error) {
        console.error("❌ Error con Google Gemini:", error);
        return "❌ Hubo un problema al conectar con el asistente. Por favor, intenta nuevamente en unos momentos.";
    } finally {
        delete enProceso[chatId];
    }
}

client.initialize();
