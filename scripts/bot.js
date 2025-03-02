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

async function obtenerRespuestaIA(mensaje) {
    if (!API_KEY) {
        console.error("❌ Error: API_KEY no configurada.");
        return "⚠️ No tengo acceso a la IA en este momento.";
    }

    try {
        const response = await fetch(`${API_URL}?key=${API_KEY}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                contents: [
                    { 
                        role: "system", 
                        parts: [{ 
                            text: "Eres un trabajador de SERVICIO TÉCNICO MASCHERANITO, un taller de reparación de celulares. Tu trabajo es atender a los clientes de manera amable y profesional. Si un cliente pregunta por su equipo en reparación, pídele el número de orden. Si alguien quiere reparar un celular, pregunta la marca, modelo y el problema que tiene. También puedes dar información sobre nuestros servicios y tiempos de entrega." 
                        }]
                    },
                    { 
                        role: "user", 
                        parts: [{ text: mensaje }] 
                    }
                ]
            })
        });

        const data = await response.json();
        console.log("🔍 Respuesta completa de Gemini:", JSON.stringify(data, null, 2));

        return data.candidates?.[0]?.content?.parts?.[0]?.text || "⚠️ No recibí respuesta.";
    } catch (error) {
        console.error("❌ Error con Google Gemini:", error);
        return "❌ Error al conectar con la IA.";
    }
}

client.initialize();
