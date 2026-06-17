# DOLAR-FLOW

DOLAR-FLOW es una plataforma web minimalista e interactiva diseñada para la consulta, simulación y monitoreo en tiempo real de tipos de cambio en Venezuela. La aplicación permite contrastar de manera simultánea devaluaciones e intercambios monetarios entre el Bolívar (VES), la tasa oficial del Banco Central de Venezuela (BCV) y la cotización implícita del mercado a través de Binance P2P (USDT).

---

## 🚀 Características Principales

- **Calculadora Simultánea Bidireccional:** Convierte instantáneamente montos en Divisas (USD) o Bolívares (VES) sincronizadamente con ambas tasas de referencia (BCV y USDT), permitiendo comparar de forma inmediata la diferencia de poder adquisitivo entre ambos mercados.
- **Visualización Analítica de Brecha Cambiaria:** Calcula y muestra en tiempo real la brecha cambiara analítica (diferencia porcentual entre la tasa oficial y la de mercado paralelo), un indicador macroeconómico clave para comercios y finanzas personales.
- **Historial Diario de Tasas:** Proporciona un registro cronológico para auditar las fluctuaciones históricas recientes y visualizar tendencias cambiarias de manera directa.
- **Copiado al Portapapeles con un Clic:** Integración nativa de APIs del portapapeles para extraer resultados precisos sin necesidad de transcripción manual.
- **Diseño Responsive de Alta Densidad:** Diseñado bajo métricas "Mobile First" estrictas y sin requerir scroll vertical. Aprovecha los espacios laterales en pantallas de escritorio, y recoloca los indicadores clave dinámicamente en el encabezado rígido en resoluciones móviles.

---

## 🛠️ Tecnologías y Arquitectura

Este desarrollo se ha completado bajo estrictas directrices de modularidad, rendimiento y diseño fluido:

- **Frontend:** React 18+ estructurado en TypeScript, acoplado a un motor de bundler de alto rendimiento sobre Vite.
- **Estilos:** Tailwind CSS con variables de diseño personalizadas de alta fidelidad, aplicando desenfoques de fondo (Glassmorphism), sombras fluidas y optimización de contrastes para entornos oscuros (Dark Mode nativo).
- **Iconografía:** Acceso directo a interfaces vectoriales a través del paquete de diseño de código abierto `lucide-react`.
- **Backend / Microservicio de Proxy:** Servidor ligero en Node.js configurado con Express. Actúa como proxy API seguro y transparente para evadir limitaciones de CORS al consultar la red descentralizada de Binance P2P, garantizando alta disponibilidad sin latencias en el cliente.
- **Fuentes de Datos (Fetch Nativo):** Integración paralela tolerante a fallas contra APIs de cotización nacional y servicios de remesas integrados directamente.

---

## 📦 Estructura del Proyecto

```text
├── src/
│   ├── App.tsx          # Componente principal y lógica reactiva de conversión
│   ├── main.tsx         # Punto de entrada de la aplicación React
│   ├── index.css        # Estilos globales y personalización de Tailwind CSS
│   └── types.ts         # Contratos de tipos de datos estáticos
├── server.ts            # Servidor backend de Express (API proxy y servidor estático)
├── package.json         # Dependencias y scripts de construcción
└── tsconfig.json        # Configuración del compilador de TypeScript
```

---

## ⚙️ Instalación y Configuración Local

Sigue estos sencillos pasos para levantar el entorno de producción de forma local:

### Requisitos Previos

Asegúrate de contar con **Node.js** (versión 18 o superior) y **npm** instalados.

### 1. Clonar el repositorio e instalar dependencias

```bash
# Servir e instalar los modulos del package.json
npm install
```

### 2. Ejecutar en modo desarrollo

Levanta el servidor unificado (Express + Vite Proxy) en tu entorno local:

```bash
npm run dev
```

La consola indicará la dirección IP local (típicamente `http://localhost:3000`) para visualizar la herramienta interactiva en tiempo real.

### 3. Compilación para Producción

Para generar el empaquetado optimizado y compilar el backend unificado para despliegues en servidores dedicados:

```bash
npm run build
# El comando compilará el frontend estático y generará el backend optimizado en dist/server.cjs
```

Para arrancar el aplicativo ya compilado de manera aislada:

```bash
npm start
```

---

*Desarrollado de manera independiente y optimizado para una alta tasa de refresco visual, ofreciendo una experiencia limpia, veloz y enfocada para la toma de decisiones económicas en Venezuela.*
