# Yu-Gi-Oh! Random Deck Generator 🃏⚡

Un generador web interactivo de barajas aleatorias de Yu-Gi-Oh! diseñado en Node.js y Express. Selecciona y clasifica cartas del archivo de datos local (`cards.json`) para construir barajas listas para jugar y exportables en formato `.ydk` (compatible con simuladores como EDOPro, YGOPro, Duelingbook, etc.).

---

## 🌟 Características

- 🎲 **Generación de Barajas Equilibradas**:
  - **Main Deck (40 cartas)**:
    - 15 Monstruos de Efecto
    - 10 Monstruos Normales
    - 10 Mágicas Genéricas
    - 5 Trampas Genéricas
  - **Extra Deck (hasta 15 cartas)**: Monstruos de Fusión, Sincronía, Xyz, Enlace, etc.
- 🧠 **Clasificación Inteligente de Cartas**: Algoritmo de filtrado que separa cartas genéricas de cartas dependientes de arquetipos específicos para mejorar la jugabilidad.
- 🎴 **Interfaz Web Visual**: Muestra las cartas generadas con sus imágenes, nombres y tipos organizados por Main Deck y Extra Deck.
- 💾 **Exportación a `.ydk`**: Descarga directa de la baraja generada en formato estándar `.ydk` con un clic.
- ⚡ **Rápido y Ligero**: Construido con Express.js y Vanilla JavaScript/CSS sin sobrecarga de frameworks externos.

---

## 🛠️ Tecnologías Utilizadas

- **Backend**: Node.js (ES Modules), Express.js
- **Frontend**: HTML5, CSS3, JavaScript Vanilla
- **Formato de Barajas**: `.ydk` (Yu-Gi-Oh! Deck Format)

---

## 📁 Estructura del Proyecto

```text
cards-randomizer-simple/
├── data/
│   └── cards.json            # Base de datos local de cartas Yu-Gi-Oh!
├── public/
│   ├── index.html            # Interfaz de usuario principal
│   ├── styles.css            # Estilos y diseño visual
│   └── app.js                # Lógica del cliente y consumo de la API
├── src/
│   ├── config.js             # Configuración de proporciones y palabras clave de arquetipos
│   ├── classifier.js         # Clasificador y organizador de cartas por categoría
│   └── deckBuilder.js        # Algoritmo de selección aleatoria (Fisher-Yates) y creador de YDK
├── package.json              # Dependencias y scripts del proyecto
├── server.js                 # Servidor HTTP Express y endpoints API
└── README.md                 # Documentación del proyecto
```

---

## 🚀 Requisitos Previos

- **Node.js** (versión 16.x o superior recomendada)
- **npm** (incluido con Node.js)

---

## 📥 Instalación y Configuración

1. **Clonar o descargar el repositorio**:
   ```bash
   git clone https://github.com/tu-usuario/cards-randomizer-simple.git
   cd cards-randomizer-simple
   ```

2. **Instalar dependencias**:
   ```bash
   npm install
   ```

3. **Iniciar el servidor**:
   ```bash
   npm start
   ```

4. **Acceder a la aplicación**:
   Abre tu navegador e ingresa a [http://localhost:5000](http://localhost:5000).

---

## 📡 Endpoints de la API

| Método | Ruta | Descripción |
| --- | --- | --- |
| `GET` | `/api/deck` | Genera una nueva baraja aleatoria y devuelve los datos estructurados en formato JSON (incluyendo URLs de imágenes). |
| `GET` | `/api/deck/ydk` | Genera o descarga el archivo `.ydk` con la estructura de la última baraja generada. |
| `GET` | `/api/deck/download` | Redirige automáticamente a la descarga del archivo `.ydk`. |

---

## ⚙️ Configuración Personalizada

Puedes ajustar la cantidad de cartas y las reglas de generación en el archivo [`src/config.js`](file:///c:/Users/IVAN-PC/Desktop/cards-randomizer-simple/src/config.js):

- **Distribución del Main Deck**: Modifica las cantidades de monstruos de efecto, normales, mágicas y trampas.
- **Límite de copias**: Ajusta `maxCopiesPerCard` (por defecto `3`).
- **Filtro de Arquetipos**: Añade o modifica palabras clave en `ARCHETYPE_DEPENDENT_KEYWORDS` y `KNOWN_ARCHETYPE_MARKERS`.

---

## 📄 Licencia

Este proyecto está bajo la licencia [ISC](file:///c:/Users/IVAN-PC/Desktop/cards-randomizer-simple/package.json).
