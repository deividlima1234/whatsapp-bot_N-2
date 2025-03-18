const socket = io();

socket.on('qr', (qr) => {
    const qrImage = document.getElementById('qr-code');
    qrImage.src = `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(qr)}`;
    document.getElementById('status').innerText = '📱 Escanea el QR para iniciar sesión.';
});

socket.on('status', (status) => {
    document.getElementById('status').innerText = status;
});
