const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const mysql = require('mysql2/promise');
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args)); // Importación dinámica

// Variables de entorno
const API_URL = process.env.API_URL;
const API_KEY = process.env.API_KEY;

// Configuración de conexión a MySQL (Railway)
const dbConfig = {
    host: process.env.MYSQLHOST, 
    user: process.env.MYSQLUSER,
    password: process.env.MYSQLPASSWORD,
    database: process.env.MYSQLDATABASE,
    port: process.env.MYSQLPORT
};


// Verificar API
if (!API_KEY || !API_URL) {
    console.error("❌ ERROR: API_KEY o API_URL no están configuradas en las variables de entorno.");
    process.exit(1);
}

console.log("🔑 API_KEY cargada:", API_KEY ? "Sí" : "No");
console.log("🌍 API_URL cargada:", API_URL ? "Sí" : "No");  

// Inicializar cliente de WhatsApp
const client = new Client({
    puppeteer: {
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
    },
    authStrategy: new LocalAuth()
});

// Obtener datos de la empresa desde MySQL
async function obtenerDatosEmpresa() {
    try {
        const connection = await mysql.createConnection(dbConfig);
        const [rows] = await connection.execute("SELECT * FROM datos_empresa LIMIT 1");
        await connection.end();

        return rows.length ? rows[0] : null;
    } catch (error) {
        console.error("❌ Error al obtener datos de la empresa:", error);
        return null;
    }
}

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

    let respuestaIA = await obtenerRespuestaIA(message.body, message.from); 
    
    console.log(`🤖 Respuesta de IA: ${respuestaIA}`);
    
    message.reply(respuestaIA || "⚠️ No entendí tu mensaje, intenta de nuevo.");
});

const conversaciones = {}; // Historial de usuarios
const MAX_HISTORIAL = 10; // Últimos 10 mensajes

async function obtenerRespuestaIA(mensaje, usuarioID) {
    if (!API_KEY) {
        console.error("❌ Error: API_KEY no configurada.");
        return "⚠️ No tengo acceso a la IA en este momento.";
    }

    // Obtener información de la empresa
    const datosEmpresa = await obtenerDatosEmpresa();
    if (!datosEmpresa) {
        return "⚠️ No se pudo recuperar la información de la empresa.";
    }

    const { nombre, horario_atencion, soporte_tecnico, whatsapp, billeteras_pago, cuenta_bancaria } = datosEmpresa;

    if (!conversaciones[usuarioID]) {
        conversaciones[usuarioID] = [];
    }

    conversaciones[usuarioID].push({ role: "user", parts: [{ text: mensaje }] });

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
                        role: "system",
                        parts: [{ 
                            text: `Eres un asistente de atención al cliente de la empresa *${nombre}*. 
                            - Horario de atención: ${horario_atencion}
                            - Soporte técnico: ${soporte_tecnico}
                            - WhatsApp: ${whatsapp}
                            - Métodos de pago: ${billeteras_pago}
                            - Cuenta bancaria: ${cuenta_bancaria}
                            
                            Atiende solo a este usuario con ID: ${usuarioID}.`
                        }]
                    },
                    ...conversaciones[usuarioID]
                ]                                  
            })
        });

        const data = await response.json();
        console.log(`🔍 Respuesta para usuario ${usuarioID}:`, JSON.stringify(data, null, 2));

        let respuestaIA = data.candidates?.[0]?.content?.parts?.[0]?.text || "⚠️ No recibí respuesta.";

        conversaciones[usuarioID].push({ role: "assistant", parts: [{ text: respuestaIA }] });

        return respuestaIA; 

    } catch (error) {
        console.error(`❌ Error con Google Gemini para usuario ${usuarioID}:`, error);
        return "❌ Error al conectar con la IA.";
    }
}

client.initialize();
