const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args)); // Compatibilidad con Node.js

const API_URL = "https://openrouter.ai/api/v1/chat/completions";
const API_KEY = "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"; // Reemplaza con tu clave real

const client = new Client({
    puppeteer: {
        args: ["--no-sandbox", "--disable-setuid-sandbox"], // Solución para Puppeteer en Railway
    },
    authStrategy: new LocalAuth()
});

client.on('qr', async qr => {
    console.log("📱 Escanea este código QR para iniciar sesión:");
    
    try {
        console.log(await qrcode.toString(qr, { type: 'terminal' })); // Muestra el QR en la terminal
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
    try {
        const response = await fetch(API_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${API_KEY}`
            },
            body: JSON.stringify({
                model: "google/gemini-2.0-flash-lite-001",
                messages: [
                    { role: "system", content: "Eres un trabajador de SERVICIO TÉCNICO MASCHERANITO, un taller de reparación de celulares. Tu trabajo es atender a los clientes de manera amable y profesional. Si un cliente pregunta por su equipo en reparación, pídele el número de orden. Si alguien quiere reparar un celular, pregunta la marca, modelo y el problema que tiene. También puedes dar información sobre nuestros servicios y tiempos de entrega." },
                    { role: "user", content: mensaje }
                ]
            })            
        });

        const data = await response.json();
        console.log("🔍 Respuesta completa de la API:", JSON.stringify(data, null, 2));

        return data.choices?.[0]?.message?.content || "⚠️ No recibí respuesta.";
    } catch (error) {
        console.error("❌ Error con OpenRouter:", error);
        return "❌ Error al conectar con la IA.";
    }
}

client.initialize();
