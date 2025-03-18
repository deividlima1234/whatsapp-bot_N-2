document.addEventListener('DOMContentLoaded', async () => {
    const qrImage = document.getElementById('qr-code');
    const statusText = document.getElementById('status');

    // Ruta del QR generado
    const qrImagePath = '/imagenesQR/qr_code.png';

    // Verificar si la imagen existe
    try {
        const response = await fetch(qrImagePath);
        
        if (response.ok) {
            qrImage.src = qrImagePath;
            statusText.textContent = "✅ Código QR listo para escanear.";
        } else {
            statusText.textContent = "❌ No se encontró el código QR. Espere un momento...";
        }
    } catch (error) {
        statusText.textContent = "❌ Error al cargar el código QR.";
        console.error("Error al cargar el QR:", error);
    }
});
