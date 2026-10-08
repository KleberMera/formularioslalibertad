#!/bin/bash

set -e

echo "======================================"
echo "🍔 Desplegando Frontend FORMULARIOS (Next.js)..."
echo "======================================"

echo ""
echo "📥 Actualizando repositorio..."
git fetch --all
git pull

echo ""
echo "📦 Instalando dependencias..."
npm install

echo ""
echo "🏗️ Compilando FORMULARIOS..."
npm run build

echo ""
echo "📂 Publicando archivos..."

# Si tu Next.js está configurado como export estático:
# npm run export
sudo rsync -av --delete out/ /var/www/dancing-jovenes/

# Si lo sirves como aplicación Node (SSR):
# sudo rsync -av --delete .next/ /var/www/FORMULARIOS/.next/
# sudo rsync -av --delete public/ /var/www/FORMULARIOS/public/
# sudo rsync -av --delete package.json /var/www/FORMULARIOS/
# sudo rsync -av --delete node_modules/ /var/www/FORMULARIOS/node_modules/

echo ""
echo "✅ FORMULARIOS desplegado correctamente."
echo "======================================"