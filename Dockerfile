# Usar la imagen base de Node.js
FROM node:18

# Instalar las dependencias necesarias para Puppeteer
RUN apt-get update && apt-get install -y \
  libnss3 \
  libatk1.0-0 \
  libx11-xcb1 \
  libxcomposite1 \
  libxcursor1 \
  libxdamage1 \
  libxfixes3 \
  libxi6 \
  libxrandr2 \
  libgbm1 \
  libpango-1.0-0 \
  libpangocairo-1.0-0 \
  libcairo2 \
  libasound2 \
  libcurl4 \
  && rm -rf /var/lib/apt/lists/*

# Crear la carpeta de la app
WORKDIR /app

# Copiar los archivos de tu proyecto
COPY . .

# Instalar las dependencias del proyecto
RUN npm install

# Evitar la descarga automática de Chromium en Puppeteer
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true 

# Comando para iniciar la app
CMD ["node", "scripts/bot.js"]
