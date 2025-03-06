# Usar la imagen base de Node.js
FROM node:18

# Crear la carpeta de la app
WORKDIR /app

# Copiar los archivos de tu proyecto
COPY . .

# Instalar las dependencias
RUN npm install

# Comando para iniciar la app
CMD ["node", "scripts/bot.js"]
