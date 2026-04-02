# Time Horizon 🌌

### Explore 13.8 billion years of history — from the Big Bang to your own lifetime. 🚀

Time Horizon is an interactive, zoomable timeline visualization that lets you navigate the full sweep of cosmic and human history on a single, fluid canvas. Zoom from galactic timescales to a single afternoon. Layer timelines of empires, scientists, religions, and inventions side by side. Share any view with a single URL. ✨

---

## Who is it for? 🎯

- **Curious learners** 📚 who want to feel the scale of history — from cosmic origins to modern day
- **Educators and presenters** 🧑‍🏫 who need a visual, shareable timeline for teaching
- **Writers, researchers, and thinkers** 🧠 building mental models of cause and effect across time
- **Anyone** 🌐 who has ever wondered where a specific event fits in the grand scheme of things

---

## Features ⚡

| Feature | Description |
|---|---|
| 🔭 **Infinite Zoom** | Pan and zoom across **13.8 billion years** with smooth inertia. A scroll of the mouse wheel takes you from the Big Bang to the Information Age in seconds. |
| 📂 **Multi-Layer Timeline** | Load multiple collections onto the same canvas. See the Bronze Age, the Buddha, and the Industrial Revolution all at once — or one at a time. |
| 🎯 **Focus Mode** | When you zoom in on a specific year, nearby events stay dimly visible so you never lose context. |
| 🔍 **Search & Filter** | Full-text search across all loaded events. Filter by collection or year range. |
| 🔗 **Shareable URLs** | Every view — your current year, zoom level, visible collections — is encoded in the URL. Paste it to a friend and they land on the exact same moment. |
| ✏️ **Event Detail & Custom Events** | Click any event to see its full description, link, image, and video. Add and edit your own custom events. |
| 🗂️ **Custom Events & Collections** | Create your own events and collections from scratch. Import from JSON, build your own timelines — it's all yours. |
| 🌙 **Dark & Light Themes** | Toggle between a deep-space dark theme and a clean light theme. Persisted across sessions. |
| 📱💻 **Responsive** | Works on both desktop and mobile with dedicated layouts for each. |

---

## Tech Stack 🛠️

| Layer | Technology |
|---|---|
| Framework | React 19 + TypeScript |
| Bundler | Vite 6 |
| Styling | Tailwind CSS v4 |
| Animation | Framer Motion 12 |
| State | Zustand 5 (localStorage persistence) |
| Icons | Lucide React |
| Code Editor (event JSON) | Monaco Editor |
| Emoji Picker | emoji-picker-react |

---

## Getting Started 🚀

```bash
npm install
npm run dev      # Start dev server on port 3000
npm run build    # Production build
npm run preview  # Preview production build
npm run lint     # Type-check only
```

---

## Project Structure 📁

```
src/
├── components/     # 25+ React components (Timeline, EventEditor, Search, etc.)
├── hooks/          # useTimelineViewport (pan/zoom engine), useTimelineShareUrl
├── stores/         # Single Zustand store for all app state
└── index.html      # Dev entry point

data/
├── collections/           # Built-in JSON collections
└── collections-metadata.json  # Collection catalog index
```

---

## License 📄

MIT
