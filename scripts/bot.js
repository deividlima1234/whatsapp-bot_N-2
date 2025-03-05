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

async function obtenerRespuestaIA(mensaje, usuarioID) {
    if (!API_KEY) {
        console.error("❌ Error: API_KEY no configurada.");
        return "⚠️ No tengo acceso a la IA en este momento.";
    }

    // Inicializamos el historial del usuario si no existe
    if (!conversaciones[usuarioID]) {
        conversaciones[usuarioID] = [];
    }

    // Agregamos el nuevo mensaje del usuario al historial
    conversaciones[usuarioID].push({ role: "user", parts: [{ text: mensaje }] });

    try {
        const response = await fetch(`${API_URL}?key=${API_KEY}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                contents: [
                    { 
                        role: "user", 
                        parts: [{ 
                            text: "Eres un asistente de SERVICIO TÉCNICO MASCHERANITO. Atiende a los clientes de manera amable y profesional. Identifica si la consulta es una pregunta frecuente, si necesita más información o si debe ser atendida por un humano."
                        }]
                    },
                    ...conversaciones[usuarioID].slice(-10) // Últimos 10 mensajes del usuario
                ]
            })
        });

        const data = await response.json();
        console.log("🔍 Respuesta completa de Gemini:", JSON.stringify(data, null, 2));

        let respuestaIA = data.candidates?.[0]?.content?.parts?.[0]?.text || "⚠️ No recibí respuesta.";

        // Agregamos la respuesta de la IA al historial del usuario
        conversaciones[usuarioID].push({ role: "assistant", parts: [{ text: respuestaIA }] });

        // 🔹 Lógica basada en el diagrama de flujo
        if (respuestaIA.includes("pregunta frecuente")) {
            return respuestaIA; // Respuesta automática
        } else if (respuestaIA.includes("más información")) {
            return "🔍 Para poder ayudarte mejor, ¿puedes darme más detalles?"; 
        } else if (respuestaIA.includes("agente humano")) {
            return "📞 Parece que necesitas ayuda especializada. Te conectaré con un asesor.";
        }

        return respuestaIA; // Respuesta normal

    } catch (error) {
        console.error("❌ Error con Google Gemini:", error);
        return "❌ Error al conectar con la IA.";
    }
}



client.initialize();
