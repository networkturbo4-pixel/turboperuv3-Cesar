#!/bin/bash
set -e

echo "=========================================="
echo "⚡ TurboNetwork SaaS - Actualización VPS ⚡"
echo "=========================================="

echo "📥 1. Descargando cambios desde GitHub..."
git pull origin main

echo "📦 2. Instalando dependencias..."
npm install --omit=dev=false

echo "🔨 3. Compilando aplicación..."
npm run build

echo "🗄️ 4. Sincronizando base de datos PostgreSQL..."
npm run db:push || true

echo "🔄 5. Recargando servicio PM2..."
pm2 reload turbonetwork || pm2 start ecosystem.config.js
pm2 save

echo "=========================================="
echo "✅ Despliegue completado con éxito! 🚀"
echo "=========================================="
