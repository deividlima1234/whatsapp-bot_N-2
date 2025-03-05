const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

const API_URL = process.env.API_URL; 
const API_KEY = process.env.API_KEY; 

console.log("🔑 API_KEY cargada:", API_KEY ? "Sí" : "No");
console.log("🌍 API_URL cargada:", API_URL ? "Sí" : "No");  

const client = new Client({
    puppeteer: {
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
    },
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
    console.log(`📩 Mensaje recibido: ${message.body}`);
    
    let respuestaIA = await obtenerRespuestaIA(message.body);
    
    console.log(`🤖 Respuesta de IA: ${respuestaIA}`);
    
    message.reply(respuestaIA || "⚠️ No entendí tu mensaje, intenta de nuevo.");
});

const conversaciones = {}; // Objeto para manejar sesiones de cada usuario
const MAX_HISTORIAL = 10; // Limita a los últimos 10 mensajes

async function obtenerRespuestaIA(mensaje, usuarioID) {
    if (!API_KEY) {
        console.error("❌ Error: API_KEY no configurada.");
        return "⚠️ No tengo acceso a la IA en este momento.";
    }

    // Si el usuario no tiene historial, inicializarlo
    if (!conversaciones[usuarioID]) {
        conversaciones[usuarioID] = [];
    }

    // Guardamos el mensaje del usuario en su historial
    conversaciones[usuarioID].push({ role: "user", parts: [{ text: mensaje }] });

    // Limitar la cantidad de mensajes almacenados
    if (conversaciones[usuarioID].length > MAX_HISTORIAL) {
        conversaciones[usuarioID] = conversaciones[usuarioID].slice(-MAX_HISTORIAL);
    }

    try {
        const response = await fetch(`${API_URL}?key=${API_KEY}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                contents: [
                    { 
                        parts: [{ 
                            text: `Eres un asistente de SERVICIO TÉCNICO MASCHERANITO. Atiende solo a este usuario con ID: ${usuarioID}. No mezcles información de otras conversaciones.` 
                        }]
                    },
                    ...conversaciones[usuarioID]
                ]
                
            })
        });

        const data = await response.json();
        console.log(`🔍 Respuesta para usuario ${usuarioID}:`, JSON.stringify(data, null, 2));

        let respuestaIA = data.candidates?.[0]?.content?.parts?.[0]?.text || "⚠️ No recibí respuesta.";

        // Guardamos la respuesta de la IA en el historial del usuario
        conversaciones[usuarioID].push({ role: "assistant", parts: [{ text: respuestaIA }] });

        return respuestaIA; 

    } catch (error) {
        console.error(`❌ Error con Google Gemini para usuario ${usuarioID}:`, error);
        return "❌ Error al conectar con la IA.";
    }
}




client.initialize();
