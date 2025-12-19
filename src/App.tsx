import React, {
  useState,
  useCallback,
  useMemo,
  useEffect,
  useRef,
} from "react";
import { TimelineEvent, ViewportState, Category } from "./types";
import {
  INITIAL_EVENTS,
  INITIAL_CATEGORIES,
  YEAR_ZERO_FROM_BANG,
  MAX_ZOOM,
  MIN_ZOOM,
} from "./constants";
import TimelineDisplay from "./components/TimelineDisplay";
import EventDetails from "./components/EventDetails";
import EventEditor from "./components/EventEditor";
import Sidebar from "./components/Sidebar";
import ZoomController from "./components/ZoomController";
import MiniMap from "./components/MiniMap";
import {
  Plus,
  Compass,
  X,
  PanelLeft,
  PanelLeftClose,
  Calendar,
  CalendarRange,
} from "lucide-react";
import { dateToYearsFromBang } from "./utils/format";

const App: React.FC = () => {
  const [events, setEvents] = useState<TimelineEvent[]>(() => {
    const saved = localStorage.getItem("timehorizon_events");
    return saved ? JSON.parse(saved) : INITIAL_EVENTS;
  });

  const [categories, setCategories] = useState<Category[]>(() => {
    const saved = localStorage.getItem("timehorizon_categories");
    return saved ? JSON.parse(saved) : INITIAL_CATEGORIES;
  });

  const [viewport, setViewport] = useState<ViewportState>({
    startYear: YEAR_ZERO_FROM_BANG - 2000,
    zoom: 0.05,
  });

  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<TimelineEvent | undefined>();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategoryName, setActiveCategoryName] = useState<string>("All");
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // Date navigation state
  const [isRangeMode, setIsRangeMode] = useState(false);
  const [isDateFollowing, setIsDateFollowing] = useState(false);

  const animationRef = useRef<number | null>(null);

  useEffect(() => {
    localStorage.setItem("timehorizon_events", JSON.stringify(events));
  }, [events]);

  useEffect(() => {
    localStorage.setItem("timehorizon_categories", JSON.stringify(categories));
  }, [categories]);

  const getViewportWidth = useCallback(() => {
    const canvas = document.querySelector("canvas");
    if (canvas) return canvas.clientWidth;
    return window.innerWidth - (window.innerWidth > 768 ? 320 : 0);
  }, []);

  const cancelAnimation = useCallback(() => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
  }, []);

  // Programmatic smoothing function
  const animateTo = useCallback(
    (targetStartYear: number, targetZoom: number) => {
      cancelAnimation();

      const duration = 800; // ms
      const startTime = performance.now();
      const startState = { ...viewport };

      const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

      const step = (now: number) => {
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const ease = easeOutCubic(progress);

        setViewport((prev) => {
          // Logarithmic zoom interpolation for smoother feel
          const currentZoom = Math.exp(
            Math.log(startState.zoom) +
              (Math.log(targetZoom) - Math.log(startState.zoom)) * ease
          );

          // Center-based position interpolation
          const width = getViewportWidth();
          const startCenter =
            startState.startYear + width / 2 / startState.zoom;
          const targetCenter = targetStartYear + width / 2 / targetZoom;
          const currentCenter =
            startCenter + (targetCenter - startCenter) * ease;

          return {
            startYear: currentCenter - width / 2 / currentZoom,
            zoom: currentZoom,
          };
        });

        if (progress < 1) {
          animationRef.current = requestAnimationFrame(step);
        } else {
          animationRef.current = null;
        }
      };

      animationRef.current = requestAnimationFrame(step);
    },
    [viewport, getViewportWidth, cancelAnimation]
  );

  const filteredEvents = useMemo(() => {
    return events.filter((e) => {
      const matchesSearch =
        e.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        e.description.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory =
        activeCategoryName === "All" || e.category === activeCategoryName;
      return matchesSearch && matchesCategory;
    });
  }, [events, searchQuery, activeCategoryName]);

  const selectedEvent = useMemo(
    () => events.find((e) => e.id === selectedEventId),
    [events, selectedEventId]
  );

  const focusOnPosition = useCallback(
    (year: number, requestedZoom: number, immediate = false) => {
      const targetZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, requestedZoom));
      const width = getViewportWidth();
      const targetStartYear = year - width / 2 / targetZoom;

      if (immediate) {
        cancelAnimation();
        setViewport((pre) => ({
          startYear: targetStartYear,
          zoom: pre.zoom,
        }));
      } else {
        animateTo(targetStartYear, targetZoom);
      }
    },
    [getViewportWidth, animateTo, cancelAnimation]
  );

  const focusOnEvent = useCallback(
    (event: TimelineEvent) => {
      const width = getViewportWidth();
      let targetZoom = viewport.zoom;
      if (viewport.zoom < 0.1) targetZoom = 0.5;

      const targetStartYear = event.yearsFromStart - width / 2 / targetZoom;
      animateTo(targetStartYear, targetZoom);
    },
    [viewport.zoom, getViewportWidth, animateTo]
  );

  const handleSelectEvent = useCallback(
    (id: string) => {
      setSelectedEventId(id);
      const event = events.find((e) => e.id === id);
      if (event) focusOnEvent(event);
    },
    [events, focusOnEvent]
  );

  // Handle manual changes from TimelineDisplay (drag/wheel)
  const handleUserViewportChange = useCallback(
    (newViewport: ViewportState) => {
      cancelAnimation(); // Instant interrupt if user starts dragging/wheeling
      setIsDateFollowing(false); // Stop following date range on user interaction
      setViewport(newViewport);
    },
    [cancelAnimation]
  );

  const handleRateZoom = useCallback(
    (delta: number) => {
      cancelAnimation();
      setIsDateFollowing(false); // Stop following date range on user zoom
      const width = getViewportWidth();
      const centerX = width / 2;
      const anchorYear = centerX / viewport.zoom + viewport.startYear;
      const zoomFactor = 1 + delta;
      const newZoom = Math.min(
        MAX_ZOOM,
        Math.max(MIN_ZOOM, viewport.zoom * zoomFactor)
      );
      setViewport({
        startYear: anchorYear - centerX / newZoom,
        zoom: newZoom,
      });
    },
    [viewport, getViewportWidth, cancelAnimation]
  );

  const handleFastZoom = useCallback(
    (targetSpanYears: number) => {
      const width = getViewportWidth();
      const centerX = width / 2;
      const currentCenterYear = centerX / viewport.zoom + viewport.startYear;
      const targetZoom = width / targetSpanYears;
      focusOnPosition(currentCenterYear, targetZoom);
    },
    [viewport, focusOnPosition, getViewportWidth]
  );

  // Helper: Convert a date string to years from Big Bang
  // State for date range inputs
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // Navigate to show the date range
  const goToDateRange = useCallback(() => {
    const fromYears = dateFrom ? dateToYearsFromBang(dateFrom) : null;
    const toYears = dateTo ? dateToYearsFromBang(dateTo) : null;

    if (fromYears === null && toYears === null) return;

    const width = getViewportWidth();

    if (fromYears !== null && toYears !== null) {
      // Both dates provided - calculate zoom to fit range
      const rangeYears = Math.abs(toYears - fromYears);
      const centerYear = (fromYears + toYears) / 2;
      // Add 10% padding on each side
      const targetZoom = width / (rangeYears * 1.2);
      focusOnPosition(centerYear, targetZoom);
    } else {
      // Only one date - go to that date with 1 year view
      const targetYear = fromYears ?? toYears;
      if (targetYear !== null) {
        focusOnPosition(targetYear, width / 1);
      }
    }
  }, [dateFrom, dateTo, focusOnPosition, getViewportWidth]);

  // Handler for when date input loses focus
  const handleDateBlur = useCallback(() => {
    if (dateFrom || dateTo) {
      setIsDateFollowing(true);
      goToDateRange();
    }
  }, [dateFrom, dateTo, goToDateRange]);

  return (
    <div className="flex h-screen w-full bg-slate-950 text-white overflow-hidden relative">
      {/* Sidebar - overlay on mobile, inline on desktop */}
      {!isSidebarCollapsed && (
        <>
          {/* Backdrop for mobile */}
          <div
            className="md:hidden fixed inset-0 bg-black/50 z-30"
            onClick={() => setIsSidebarCollapsed(true)}
          />
          <div className="fixed md:relative h-full shrink-0 z-40">
            <Sidebar
              events={events}
              categories={categories}
              onSelectEvent={(id) => {
                handleSelectEvent(id);
                // Auto-close on mobile after selection
                if (window.innerWidth < 768) setIsSidebarCollapsed(true);
              }}
              activeCategoryName={activeCategoryName}
              setActiveCategoryName={setActiveCategoryName}
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              onAddCategory={(cat) => setCategories((prev) => [...prev, cat])}
              isCollapsed={isSidebarCollapsed}
              onToggleCollapse={() =>
                setIsSidebarCollapsed(!isSidebarCollapsed)
              }
            />
          </div>
        </>
      )}

      <div className="flex-1 flex flex-col relative h-full min-w-0">
        <header className="p-2 md:p-4 bg-slate-900/50 backdrop-blur-md border-b border-white/10 flex items-center justify-between z-10 shrink-0 gap-2">
          {/* Left side - Logo and sidebar toggle */}
          <div className="flex items-center gap-1.5 md:gap-3 shrink-0">
            <button
              onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
              className="p-1.5 md:p-2 hover:bg-slate-800 rounded-lg transition-colors text-slate-400 hover:text-white"
              title={isSidebarCollapsed ? "Show sidebar" : "Hide sidebar"}
            >
              {isSidebarCollapsed ? (
                <PanelLeft className="w-4 h-4 md:w-5 md:h-5" />
              ) : (
                <PanelLeftClose className="w-4 h-4 md:w-5 md:h-5" />
              )}
            </button>
            <div className="w-7 h-7 md:w-10 md:h-10 bg-indigo-600 rounded-lg md:rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Compass className="w-4 h-4 md:w-6 md:h-6 text-white" />
            </div>
            <h1 className="hidden md:block text-lg md:text-xl font-bold tracking-tight">
              TimeHorizon
            </h1>
          </div>

          {/* Center - Navigation and Date selector */}
          <div className="flex items-center gap-1 md:gap-2 flex-1 justify-center min-w-0">
            {/* Quick nav buttons - hidden on very small screens */}
            <div className="hidden xs:flex items-center gap-1">
              <button
                onClick={() => focusOnPosition(0, 1e-11)}
                className="px-1.5 py-1 md:px-3 md:py-1.5 bg-slate-800 hover:bg-slate-700 rounded-md text-[9px] md:text-xs font-semibold transition-colors"
              >
                Bang
              </button>
              <button
                onClick={() => focusOnPosition(YEAR_ZERO_FROM_BANG, 0.5)}
                className="px-1.5 py-1 md:px-3 md:py-1.5 bg-slate-800 hover:bg-slate-700 rounded-md text-[9px] md:text-xs font-semibold transition-colors"
              >
                Year 0
              </button>
            </div>

            {/* Date Selector */}
            <div className="flex items-center gap-1 bg-slate-800/50 rounded-lg px-1.5 py-0.5 md:px-2">
              {/* Mode Toggle */}
              <button
                onClick={() => setIsRangeMode(!isRangeMode)}
                className={`p-1 rounded transition-colors ${
                  isRangeMode ? "text-indigo-400" : "text-slate-400"
                } hover:text-white`}
                title={
                  isRangeMode ? "Switch to single date" : "Switch to date range"
                }
              >
                {isRangeMode ? (
                  <CalendarRange className="w-3.5 h-3.5" />
                ) : (
                  <Calendar className="w-3.5 h-3.5" />
                )}
              </button>

              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                onBlur={handleDateBlur}
                className="w-20 md:w-24 px-1 py-0.5 bg-transparent text-[9px] md:text-xs font-medium text-white border-none focus:outline-none cursor-pointer [color-scheme:dark]"
                title={isRangeMode ? "From date" : "Go to date"}
              />

              {isRangeMode && (
                <>
                  <span className="text-slate-500 text-[9px]">→</span>
                  <input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    onBlur={handleDateBlur}
                    className="w-20 md:w-24 px-1 py-0.5 bg-transparent text-[9px] md:text-xs font-medium text-white border-none focus:outline-none cursor-pointer [color-scheme:dark]"
                    title="To date"
                  />
                </>
              )}

              {(dateFrom || dateTo) && (
                <button
                  onClick={() => {
                    setDateFrom("");
                    setDateTo("");
                    setIsDateFollowing(false);
                  }}
                  className="p-0.5 hover:bg-slate-700 rounded text-slate-400 hover:text-white"
                  title="Clear dates"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>

          {/* Right side - Add button */}
          <button
            onClick={() => {
              setEditingEvent(undefined);
              setIsEditorOpen(true);
            }}
            className="px-2 py-1.5 md:px-4 md:py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-[9px] md:text-sm font-bold flex items-center gap-1 md:gap-1.5 shadow-lg shadow-indigo-600/30 transition-all hover:scale-105 shrink-0"
          >
            <Plus className="w-3.5 h-3.5 md:w-4 md:h-4" />
            <span className="hidden sm:inline">Add</span>
          </button>
        </header>

        <div className="flex-1 relative overflow-hidden cursor-crosshair min-h-0">
          <TimelineDisplay
            viewport={viewport}
            setViewport={handleUserViewportChange}
            events={filteredEvents}
            onSelectEvent={handleSelectEvent}
            selectedEventId={selectedEventId}
          />
          <ZoomController
            onZoom={handleRateZoom}
            onFastScale={handleFastZoom}
            viewport={viewport}
          />
        </div>

        <MiniMap
          viewport={viewport}
          events={events}
          onNavigate={(year, animated) =>
            focusOnPosition(year, viewport.zoom, !animated)
          }
          containerWidth={getViewportWidth()}
        />

        {selectedEvent && (
          <EventDetails
            event={selectedEvent}
            onClose={() => setSelectedEventId(null)}
            onEdit={() => {
              setEditingEvent(selectedEvent);
              setIsEditorOpen(true);
            }}
            onDelete={() => {
              setEvents((prev) =>
                prev.filter((e) => e.id !== selectedEvent.id)
              );
              setSelectedEventId(null);
            }}
          />
        )}
      </div>

      {isEditorOpen && (
        <EventEditor
          event={editingEvent}
          categories={categories}
          onSave={(event) => {
            setEvents((prev) => {
              const exists = prev.find((e) => e.id === event.id);
              if (exists)
                return prev.map((e) => (e.id === event.id ? event : e));
              return [...prev, event];
            });
            setIsEditorOpen(false);
          }}
          onClose={() => setIsEditorOpen(false)}
        />
      )}
    </div>
  );
};

export default App;
