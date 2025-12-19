import React, { useRef, useEffect, useState } from "react";
import { ViewportState, TimelineEvent } from "../types";
import { UNIVERSE_AGE_YEARS, YEAR_ZERO_FROM_BANG } from "../constants";

export type VisualEffect = "none" | "gradient" | "stars" | "icons";

interface Props {
  viewport: ViewportState;
  setViewport: (v: ViewportState) => void;
  events: TimelineEvent[];
  onSelectEvent: (id: string) => void;
  selectedEventId: string | null;
  visualEffect?: VisualEffect;
}

const MIN_STEP_ALLOWED = 1e-7;

const TimelineDisplay: React.FC<Props> = ({
  viewport,
  setViewport,
  events,
  onSelectEvent,
  selectedEventId,
  visualEffect = "none",
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const isDragging = useRef(false);
  const hasMovedSignificant = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const handleResize = () => {
      if (canvasRef.current) {
        const { width, height } =
          canvasRef.current.parentElement!.getBoundingClientRect();
        setDimensions({ width, height });
        canvasRef.current.width = width * window.devicePixelRatio;
        canvasRef.current.height = height * window.devicePixelRatio;
      }
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const formatYearLabel = (year: number, visibleRange: number) => {
    const abs = Math.abs(year);
    if (visibleRange < 200) return Math.floor(abs).toLocaleString();
    if (abs >= 1_000_000_000) return `${(year / 1_000_000_000).toFixed(1)}B`;
    if (abs >= 1_000_000) return `${(year / 1_000_000).toFixed(1)}M`;
    if (abs >= 1_000) return `${(year / 1_000).toFixed(1)}k`;
    return Math.floor(year).toString();
  };

  const formatGranularTimeLines = (
    totalYears: number,
    zoom: number
  ): string[] => {
    const visibleRange = dimensions.width / zoom;
    const jesusYear = totalYears - YEAR_ZERO_FROM_BANG;
    const lines: string[] = [];

    if (totalYears < YEAR_ZERO_FROM_BANG * 0.9999) {
      if (totalYears === 0) return ["Big Bang"];
      lines.push(`${formatYearLabel(totalYears, visibleRange)} PB`);
      return lines;
    }

    const absYear = Math.abs(jesusYear);
    const suffix = jesusYear < 0 ? " BC" : jesusYear === 0 ? "" : " AD";
    const displayYear =
      jesusYear === 0
        ? "Year 0"
        : `${formatYearLabel(absYear, visibleRange)}${suffix}`;
    lines.push(displayYear);

    if (visibleRange < 5) {
      const months = [
        "January",
        "February",
        "March",
        "April",
        "May",
        "June",
        "July",
        "August",
        "September",
        "October",
        "November",
        "December",
      ];
      lines.push(months[Math.floor((absYear * 12) % 12)]);
    }
    if (visibleRange < 0.2)
      lines.push(`Day ${Math.floor((absYear * 365.25) % 30.44) + 1}`);
    if (visibleRange < 0.005) {
      const hours = absYear * 365.25 * 24;
      lines.push(
        `${Math.floor(hours % 24)
          .toString()
          .padStart(2, "0")}:${Math.floor((hours % 1) * 60)
          .toString()
          .padStart(2, "0")}`
      );
    }

    return lines;
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || dimensions.width === 0) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const { startYear, zoom } = viewport;
    const centerY = dimensions.height / 2;
    const zoomLog = Math.log10(zoom);

    const yearToX = (year: number) => (year - startYear) * zoom;

    // Base dark background
    ctx.fillStyle = "#020617";
    ctx.fillRect(0, 0, dimensions.width, dimensions.height);

    // === OPTION 1: Era-Based Gradient Background ===
    const drawEraGradient = () => {
      const centerViewYear = startYear + dimensions.width / 2 / zoom;

      // Define era colors
      const getEraColor = (
        year: number
      ): { r: number; g: number; b: number } => {
        if (year < 1e8) return { r: 180, g: 40, b: 20 }; // Big Bang - Deep Red
        if (year < 1e9) return { r: 120, g: 30, b: 80 }; // Early Universe - Purple
        if (year < 5e9) return { r: 60, g: 20, b: 100 }; // Galaxy Formation - Deep Purple
        if (year < 10e9) return { r: 20, g: 80, b: 80 }; // Earth Forms - Teal
        if (year < YEAR_ZERO_FROM_BANG - 10000) return { r: 40, g: 60, b: 40 }; // Prehistoric - Green
        if (year < YEAR_ZERO_FROM_BANG + 1800) return { r: 80, g: 60, b: 40 }; // Ancient History - Sepia
        return { r: 20, g: 40, b: 80 }; // Modern Era - Blue
      };

      const era = getEraColor(centerViewYear);
      const gradient = ctx.createRadialGradient(
        dimensions.width / 2,
        dimensions.height / 2,
        0,
        dimensions.width / 2,
        dimensions.height / 2,
        dimensions.width * 0.7
      );
      gradient.addColorStop(0, `rgba(${era.r}, ${era.g}, ${era.b}, 0.3)`);
      gradient.addColorStop(1, "rgba(2, 6, 23, 0)");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, dimensions.width, dimensions.height);
    };

    // === OPTION 2: Parallax Star Field ===
    const drawStarField = () => {
      // Each layer has different parallax speeds - further stars move slower
      const layers = [
        {
          count: 120,
          sizeBase: 0.3,
          panParallax: 0.02,
          zoomParallax: 0.3,
          opacity: 0.25,
        }, // Very far - nebula dust
        {
          count: 80,
          sizeBase: 0.6,
          panParallax: 0.05,
          zoomParallax: 0.5,
          opacity: 0.4,
        }, // Far stars
        {
          count: 50,
          sizeBase: 1.0,
          panParallax: 0.12,
          zoomParallax: 0.7,
          opacity: 0.6,
        }, // Mid stars
        {
          count: 25,
          sizeBase: 1.8,
          panParallax: 0.25,
          zoomParallax: 1.0,
          opacity: 0.8,
        }, // Near stars
      ];

      // Zoom factor affects star size - closer layers scale more with zoom
      const baseZoomLog = Math.log10(Math.max(1e-12, zoom));

      layers.forEach((layer, layerIndex) => {
        // Seeded random for consistent star positions
        const seed = (i: number, offset: number = 0) => {
          const x =
            Math.sin((i + offset) * 12.9898 + layerIndex * 7.233) * 43758.5453;
          return x - Math.floor(x);
        };

        // Zoom parallax - each layer scales differently with zoom
        const zoomScale = 1 + (baseZoomLog + 10) * 0.08 * layer.zoomParallax;
        const finalSize =
          layer.sizeBase * Math.max(0.2, Math.min(4, zoomScale));

        for (let i = 0; i < layer.count; i++) {
          // Base positions spread across a larger area for seamless wrapping
          const baseX = seed(i) * dimensions.width * 4;
          const baseY = seed(i, 500) * dimensions.height;

          // Pan parallax - each layer moves at different speed
          const panOffset = startYear * layer.panParallax * 0.0001;

          // Zoom parallax center offset - stars spread out/converge when zooming
          const centerX = dimensions.width / 2;
          const centerY = dimensions.height / 2;
          const distFromCenterX = (baseX % dimensions.width) - centerX;
          const distFromCenterY = baseY - centerY;
          const zoomSpread = (baseZoomLog + 10) * 0.02 * layer.zoomParallax;

          // Calculate final position with both parallax effects
          let x =
            (baseX - panOffset + distFromCenterX * zoomSpread) %
            dimensions.width;
          let y = baseY + distFromCenterY * zoomSpread * 0.3;

          // Wrap around
          if (x < 0) x += dimensions.width;
          if (x > dimensions.width) x -= dimensions.width;

          // Skip if outside vertical bounds
          if (y < -20 || y > dimensions.height + 20) continue;

          // Twinkle effect - varies by star
          const twinkle =
            0.6 +
            0.4 * Math.sin(Date.now() * 0.002 * (0.5 + seed(i, 200) * 0.5) + i);

          // Draw star
          ctx.beginPath();
          ctx.arc(x, y, finalSize, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255, 255, 255, ${layer.opacity * twinkle})`;
          ctx.fill();

          // Add glow for larger/closer stars
          if (finalSize > 1.2) {
            const glowSize = finalSize * 3;
            const glow = ctx.createRadialGradient(x, y, 0, x, y, glowSize);
            const glowOpacity = layer.opacity * twinkle * 0.25;
            glow.addColorStop(0, `rgba(180, 200, 255, ${glowOpacity})`);
            glow.addColorStop(0.5, `rgba(150, 180, 255, ${glowOpacity * 0.3})`);
            glow.addColorStop(1, "rgba(150, 180, 255, 0)");
            ctx.fillStyle = glow;
            ctx.beginPath();
            ctx.arc(x, y, glowSize, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      });
    };

    // === OPTION 3: Scale Reference Icons ===
    const drawScaleIcons = () => {
      const visibleRange = dimensions.width / zoom;

      let scaleInfo: { icon: string; label: string; subLabel: string };

      if (visibleRange > 1e9) {
        scaleInfo = {
          icon: "🌌",
          label: "Billions of Years",
          subLabel: "Cosmic Scale",
        };
      } else if (visibleRange > 1e6) {
        scaleInfo = {
          icon: "🦖",
          label: "Millions of Years",
          subLabel: "Geological Scale",
        };
      } else if (visibleRange > 1e3) {
        scaleInfo = {
          icon: "🏛️",
          label: "Millennia",
          subLabel: "Civilizations",
        };
      } else if (visibleRange > 100) {
        scaleInfo = { icon: "📜", label: "Centuries", subLabel: "Historical" };
      } else if (visibleRange > 10) {
        scaleInfo = { icon: "👴", label: "Decades", subLabel: "Lifetimes" };
      } else if (visibleRange > 1) {
        scaleInfo = { icon: "📅", label: "Years", subLabel: "Annual" };
      } else if (visibleRange > 1 / 12) {
        scaleInfo = { icon: "🗓️", label: "Months", subLabel: "Seasonal" };
      } else if (visibleRange > 1 / 365) {
        scaleInfo = { icon: "📆", label: "Days", subLabel: "Daily" };
      } else {
        scaleInfo = { icon: "🕐", label: "Hours", subLabel: "Momentary" };
      }

      // Draw scale indicator in top-left
      const padding = 16;
      const boxWidth = 140;
      const boxHeight = 60;

      // Background box
      ctx.fillStyle = "rgba(15, 23, 42, 0.8)";
      ctx.beginPath();
      ctx.roundRect(padding, padding, boxWidth, boxHeight, 8);
      ctx.fill();
      ctx.strokeStyle = "rgba(99, 102, 241, 0.3)";
      ctx.lineWidth = 1;
      ctx.stroke();

      // Icon
      ctx.font = "24px Inter";
      ctx.textAlign = "left";
      ctx.fillStyle = "#fff";
      ctx.fillText(scaleInfo.icon, padding + 12, padding + 35);

      // Labels
      ctx.font = "bold 12px Inter";
      ctx.fillStyle = "#fff";
      ctx.fillText(scaleInfo.label, padding + 48, padding + 28);

      ctx.font = "10px Inter";
      ctx.fillStyle = "rgba(148, 163, 184, 0.8)";
      ctx.fillText(scaleInfo.subLabel, padding + 48, padding + 44);
    };

    // Apply visual effect based on prop
    if (visualEffect === "gradient") {
      drawEraGradient();
    } else if (visualEffect === "stars") {
      drawStarField();
    } else if (visualEffect === "icons") {
      drawScaleIcons();
    }

    const drawHierarchicalGrid = () => {
      const powers = [12, 9, 6, 3, 0, -2];
      powers.forEach((p) => {
        const step = Math.pow(10, p);
        if (step < MIN_STEP_ALLOWED) return;
        const xStep = step * zoom;
        if (xStep < 10 || xStep > 5000) return;
        const opacity = Math.min(0.06, xStep / 1500);
        ctx.strokeStyle = `rgba(99, 102, 241, ${opacity})`;
        ctx.lineWidth = 1;
        const first = Math.floor(startYear / step) * step;
        const last =
          Math.ceil((startYear + dimensions.width / zoom) / step) * step;
        for (let y = first; y <= last; y += step) {
          const x = yearToX(y);
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, dimensions.height);
          ctx.stroke();
        }
      });
    };

    drawHierarchicalGrid();

    const eras = [
      { year: 0, label: "BIG BANG" },
      { year: 1e9, label: "FIRST GALAXIES" },
      { year: 9.3e9, label: "EARTH FORMS" },
      { year: YEAR_ZERO_FROM_BANG, label: "MODERN ERA" },
      { year: UNIVERSE_AGE_YEARS, label: "TODAY" },
    ];
    eras.forEach((era) => {
      const x = yearToX(era.year);
      if (x < -1000 || x > dimensions.width + 1000) return;
      ctx.save();
      ctx.translate(x, centerY);
      ctx.rotate(-Math.PI / 2);
      ctx.fillStyle = "rgba(255, 255, 255, 0.025)";
      ctx.font = "900 120px Inter";
      ctx.textAlign = "center";
      ctx.fillText(era.label, 0, 0);
      ctx.restore();
    });

    const drawRuler = () => {
      const getBaseSteps = () => {
        if (zoom < 1e-12) return 1_000_000_000;
        if (zoom < 1e-9) return 100_000_000;
        if (zoom < 1e-6) return 1_000_000;
        if (zoom < 0.1) return 1000;
        if (zoom < 1) return 100;
        if (zoom < 10) return 10;
        if (zoom < 100) return 1;
        if (zoom < 1000) return 1 / 12;
        if (zoom < 100000) return 1 / 365;
        return 1 / (365 * 24);
      };

      let step = getBaseSteps();
      while (step * zoom < 80) {
        if (step < 1 / 12) step *= 2;
        else if (step === 1 / 12) step = 1;
        else if (step === 1) step = 5;
        else if (step === 5) step = 10;
        else step *= 10;
      }
      while (step * zoom > 200) {
        if (step > 1) step /= 2;
        else if (step === 1) step = 1 / 12;
        else step /= 10;
        if (step < MIN_STEP_ALLOWED) break;
      }

      const firstYear = Math.floor(startYear / step) * step;
      const lastYear =
        Math.ceil((startYear + dimensions.width / zoom) / step) * step;

      for (let y = firstYear; y <= lastYear; y += step) {
        const x = yearToX(y);
        const jesusYear = Math.round(y - YEAR_ZERO_FROM_BANG);
        const isMajor =
          step >= 1
            ? jesusYear % (step * 5) === 0
            : Math.abs(y % (step * 4)) < step * 0.1;
        const tickHeight = isMajor ? 18 : 8;

        ctx.strokeStyle = isMajor
          ? "rgba(255, 255, 255, 0.5)"
          : "rgba(255, 255, 255, 0.15)";
        ctx.beginPath();
        ctx.moveTo(x, centerY - tickHeight);
        ctx.lineTo(x, centerY + tickHeight);
        ctx.stroke();

        if (x >= -200 && x <= dimensions.width + 200) {
          const lines = formatGranularTimeLines(y, zoom);
          lines.forEach((line, i) => {
            ctx.fillStyle = isMajor ? "#ffffff" : "rgba(255, 255, 255, 0.35)";
            ctx.font = isMajor ? "700 13px Inter" : "500 10px Inter";
            ctx.textAlign = "center";
            ctx.fillText(line, x, centerY + 34 + i * 16);
          });
        }
      }
      ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
      ctx.beginPath();
      ctx.moveTo(0, centerY);
      ctx.lineTo(dimensions.width, centerY);
      ctx.stroke();
    };

    const drawEvents = () => {
      const baseImportanceThreshold = Math.max(1, 9 - (zoomLog + 8) * 1.5);
      const sortedEvents = [...events].sort((a, b) =>
        a.id === selectedEventId
          ? 1
          : b.id === selectedEventId
          ? -1
          : a.importance - b.importance
      );
      const drawnXPoints: number[] = [];

      sortedEvents.forEach((event) => {
        const startX = yearToX(event.yearsFromStart);
        const endX = event.endYearsFromStart
          ? yearToX(event.endYearsFromStart)
          : startX;
        if (endX < -500 || startX > dimensions.width + 500) return;

        const isSelected = event.id === selectedEventId;
        if (!isSelected) {
          if (event.importance < baseImportanceThreshold) return;
          if (drawnXPoints.some((px) => Math.abs(px - startX) < 100)) return;
        }
        drawnXPoints.push(startX);
        const color = event.color || "#6366f1";

        if (
          event.endYearsFromStart &&
          event.endYearsFromStart !== event.yearsFromStart
        ) {
          ctx.fillStyle = color + "08";
          ctx.fillRect(startX, centerY - 12, endX - startX, 24);
          ctx.strokeStyle = color + "20";
          ctx.strokeRect(startX, centerY - 12, endX - startX, 24);
        }

        ctx.strokeStyle = color;
        ctx.lineWidth = isSelected ? 4 : 2;
        ctx.beginPath();
        ctx.moveTo(startX, centerY);
        ctx.lineTo(startX, centerY - (isSelected ? 120 : 60));
        ctx.stroke();

        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(startX, centerY, isSelected ? 8 : 5, 0, Math.PI * 2);
        ctx.fill();

        if (event.icon) {
          ctx.font = isSelected ? "32px Inter" : "20px Inter";
          ctx.textAlign = "center";
          ctx.fillText(event.icon, startX, centerY - (isSelected ? 150 : 90));
        }

        ctx.fillStyle = isSelected ? "#fff" : "rgba(255, 255, 255, 0.9)";
        ctx.font = isSelected ? "700 14px Inter" : "500 12px Inter";
        ctx.textAlign = "center";
        ctx.fillText(event.title, startX, centerY - (isSelected ? 125 : 68));
      });
    };

    drawRuler();
    drawEvents();
  }, [dimensions, viewport, events, selectedEventId, visualEffect]);

  const handleStart = (x: number, y: number) => {
    isDragging.current = true;
    hasMovedSignificant.current = false;
    lastPos.current = { x, y };
  };

  const handleMove = (x: number, y: number) => {
    if (!isDragging.current) return;
    const dx = x - lastPos.current.x;
    if (Math.abs(dx) > 1) hasMovedSignificant.current = true;
    setViewport({
      ...viewport,
      startYear: viewport.startYear - dx / viewport.zoom,
    });
    lastPos.current = { x, y };
  };

  const handleEnd = (x: number) => {
    if (isDragging.current && !hasMovedSignificant.current) {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (rect) {
        const mouseX = x - rect.left;
        const clickYear = mouseX / viewport.zoom + viewport.startYear;
        let closest = null;
        let minDistance = 60 / viewport.zoom;
        events.forEach((event) => {
          const dist = Math.abs(event.yearsFromStart - clickYear);
          if (dist < minDistance) {
            minDistance = dist;
            closest = event;
          }
        });
        if (closest) onSelectEvent((closest as any).id);
      }
    }
    isDragging.current = false;
  };

  return (
    <canvas
      ref={canvasRef}
      onMouseDown={(e) => handleStart(e.clientX, e.clientY)}
      onMouseMove={(e) => handleMove(e.clientX, e.clientY)}
      onMouseUp={(e) => handleEnd(e.clientX)}
      onTouchStart={(e) =>
        handleStart(e.touches[0].clientX, e.touches[0].clientY)
      }
      onTouchMove={(e) =>
        handleMove(e.touches[0].clientX, e.touches[0].clientY)
      }
      onTouchEnd={(e) => handleEnd(e.changedTouches[0].clientX)}
      onWheel={(e) => {
        e.preventDefault();
        const rect = canvasRef.current?.getBoundingClientRect();
        if (!rect) return;
        const mouseX = e.clientX - rect.left;

        // Instant zoom step based on wheel delta
        const zoomFactor = 1 - e.deltaY * 0.001;
        const newZoom = viewport.zoom * zoomFactor;
        const anchorYear = mouseX / viewport.zoom + viewport.startYear;

        setViewport({
          startYear: anchorYear - mouseX / newZoom,
          zoom: newZoom,
        });
      }}
      className="w-full h-full block"
    />
  );
};

export default TimelineDisplay;
