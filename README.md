# ⏳ TimeHorizon

<div align="center">

**An interactive cosmic timeline explorer — from the Big Bang to the speculative future**

[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-6-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)

</div>

---

## ✨ Features

### 🌌 Infinite Timeline Navigation
- **Seamless zoom** from billions of years down to individual hours
- **Smooth panning** across the entire history of the universe
- **Hierarchical grid system** that adapts to your current scale

### 🎨 Visual Effects
- **Era-based gradients** — Background colors shift based on cosmic era (Big Bang, Galaxy Formation, Earth Formation, etc.)
- **Parallax star field** — Multi-layered star animation with depth and twinkle effects
- **Scale reference icons** — Visual indicators showing your current temporal scale (billions of years, millennia, days, hours)

### 🗺️ MiniMap Navigation
- Quick overview of the entire timeline
- Click to animate to any position
- Drag for instant, real-time navigation
- Visual highlight of your current viewport

### 📋 Event Management
- **Pre-loaded events** spanning cosmic, biological, and human history
- **Add custom events** with title, description, date range, category, and icon
- **Category filtering** to focus on specific event types
- **Search functionality** to quickly find events
- **Local storage persistence** — Your events and categories are saved automatically

### 🎛️ Intuitive Controls
- **Zoom controller** with drag-to-zoom and preset scale buttons
- **Mouse wheel zoom** anchored to cursor position
- **Touch support** for mobile devices
- **Quick navigation buttons** (Big Bang, Year 0)

---

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18 or higher recommended)
- [Bun](https://bun.sh/) (optional, but faster) or npm/yarn

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/HoangTran0410/time-horizon.git
   cd time-horizon
   ```

2. **Install dependencies**
   ```bash
   # Using Bun (recommended)
   bun install

   # Or using npm
   npm install
   ```

3. **Set up environment variables** (optional, for Gemini AI features)
   ```bash
   cp .env.local.example .env.local
   # Edit .env.local and add your GEMINI_API_KEY
   ```

4. **Start the development server**
   ```bash
   # Using Bun
   bun run dev

   # Or using npm
   npm run dev
   ```

5. **Open your browser** at [http://localhost:5173](http://localhost:5173)

---

## 🛠️ Tech Stack

| Technology | Purpose |
|------------|---------|
| **React 19** | UI framework with latest features |
| **TypeScript** | Type-safe development |
| **Vite 6** | Fast build tool and dev server |
| **Lucide React** | Beautiful icon library |
| **Canvas API** | High-performance timeline rendering |
| **@google/genai** | Optional Gemini AI integration |

---

## 📁 Project Structure

```
time-horizon/
├── src/
│   ├── components/
│   │   ├── EventDetails.tsx    # Event detail modal
│   │   ├── EventEditor.tsx     # Add/edit event form
│   │   ├── MiniMap.tsx         # Timeline overview navigation
│   │   ├── Sidebar.tsx         # Event list and category filters
│   │   ├── TimelineDisplay.tsx # Main canvas timeline renderer
│   │   └── ZoomController.tsx  # Zoom controls and scale presets
│   ├── App.tsx                 # Main application component
│   ├── constants.tsx           # Initial events and categories
│   ├── types.ts                # TypeScript type definitions
│   └── index.tsx               # Application entry point
├── public/                     # Static assets
├── index.html                  # HTML entry point
├── vite.config.ts              # Vite configuration
├── tsconfig.json               # TypeScript configuration
└── package.json                # Project dependencies
```

---

## 🎮 Usage Guide

### Navigation

| Action | Mouse | Touch |
|--------|-------|-------|
| **Pan** | Click + Drag | Touch + Drag |
| **Zoom** | Scroll wheel | Pinch (on supported devices) |
| **Select event** | Click on event marker | Tap on event marker |

### MiniMap

- **Click** anywhere on the minimap to smoothly animate to that position
- **Drag** on the minimap for instant, real-time navigation

### Keyboard Shortcuts

The application currently focuses on mouse/touch interaction. Future versions may include keyboard shortcuts.

---

## 📜 Timeline Scale Reference

| Scale | Visible Range |
|-------|---------------|
| 🌌 Cosmic | Billions of years |
| 🦖 Geological | Millions of years |
| 🏛️ Civilizations | Millennia |
| 📜 Historical | Centuries |
| 👴 Lifetimes | Decades |
| 📅 Annual | Years |
| 🗓️ Seasonal | Months |
| 📆 Daily | Days |
| 🕐 Momentary | Hours |

---

## 🔧 Scripts

| Script | Description |
|--------|-------------|
| `bun run dev` | Start development server |
| `bun run build` | Build for production |
| `bun run preview` | Preview production build |

---

## 🤝 Contributing

Contributions are welcome! Feel free to:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

This project is open source and available under the [MIT License](LICENSE).

---

## 🙏 Acknowledgments

- Timeline data inspired by cosmological and historical research
- Icons by [Lucide](https://lucide.dev/)
- Built with [Vite](https://vitejs.dev/) and [React](https://react.dev/)

---

<div align="center">

**Explore the entire history of the universe, one scroll at a time.**

Made with ❤️ by [Hoang Tran](https://github.com/HoangTran0410)

</div>
