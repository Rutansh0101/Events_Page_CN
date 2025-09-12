"use client";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

// Mock data for the timeline
const timelineData = {
  timelineEvents: [
    { id: 1, year: 2020, month: "Mar", title: "Project Genesis", description: "The beginning of an ambitious journey that would reshape our understanding of modern technology and innovation.", imageId: 100 },
    { id: 2, year: 2020, month: "Jun", title: "First Milestone", description: "Achieved our first major breakthrough in the development process.", imageId: 101 },
    { id: 3, year: 2021, month: "Jan", title: "Expansion Phase", description: "Expanded operations to three new markets with unprecedented success.", imageId: 102 },
    { id: 4, year: 2021, month: "Aug", title: "Innovation Award", description: "Received recognition for groundbreaking contributions to the industry.", imageId: 103 },
    { id: 5, year: 2022, month: "Feb", title: "Global Launch", description: "Successfully launched our platform to a worldwide audience.", imageId: 104 },
    { id: 6, year: 2022, month: "Sep", title: "Partnership Deal", description: "Formed strategic partnerships with leading industry players.", imageId: 105 },
    { id: 7, year: 2023, month: "May", title: "Next Generation", description: "Unveiled the next generation of our core technology platform.", imageId: 106 },
    { id: 8, year: 2024, month: "Jan", title: "Market Leader", description: "Achieved market leadership position in our primary sector.", imageId: 107 },
    { id: 9, year: 2024, month: "Jul", title: "Future Vision", description: "Announced our vision for the next decade of innovation and growth.", imageId: 108 },
  ]
};

const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

interface TimelineEvent {
  id: number;
  year: number;
  month: string;
  title: string;
  description: string;
  imageId: number;
}

// Custom hook to detect mobile
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  return isMobile;
}

// Small helper (keeps deterministic pseudo-random positions if you re-enable)
function seededRandom(seed: number) {
  return function (i: number) {
    const x = Math.sin(seed * 99991 + i * 15731) * 10000;
    return x - Math.floor(x);
  };
}

function getRandomIds(baseId: number, count: number) {
  const ids = new Set<number>();
  while (ids.size < count) {
    const rand = baseId + Math.floor(Math.random() * 20) + 1;
    ids.add(rand);
  }
  return Array.from(ids);
}

export default function ResponsiveTimeline(): JSX.Element {
  const isMobile = useIsMobile();

  // --- memoize sorted events so the identity doesn't change every render ---
  const sortedEvents = useMemo(() => {
    return [...timelineData.timelineEvents].sort((a: TimelineEvent, b: TimelineEvent) => {
      if (a.year !== b.year) return a.year - b.year;
      return months.indexOf(a.month) - months.indexOf(b.month);
    });
  }, []);

  const timelineEvents = sortedEvents;
  const allYears = useMemo(() => Array.from(new Set(timelineEvents.map((e) => e.year))).sort(), [timelineEvents]);

  // state
  const [currentEventIndex, setCurrentEventIndex] = useState(0);
  const [selectedEvent, setSelectedEvent] = useState<TimelineEvent | null>(sortedEvents[0] ?? null);
  const [focusYear, setFocusYear] = useState<number>(sortedEvents[0]?.year ?? (allYears[0] ?? 0));
  const [hoveredEvent, setHoveredEvent] = useState<TimelineEvent | null>(null);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [isScrolling, setIsScrolling] = useState(false);

  // useRef fixes for browser (window.setTimeout returns number)
  const scrollTimeoutRef = useRef<number | null>(null);
  const lastScrollTime = useRef<number>(0);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // wheel accumulation (for trackpad / precision wheels)
  const wheelAccum = useRef(0);
  const wheelResetTimer = useRef<number | null>(null);

  // constants for layout
  const COLLAPSED_HEIGHT_MOBILE = 60; // px for mobile vertical layout
  const COLLAPSED_WIDTH = 60; // px reserved spacing used between collapsed years and also inside detailed block

  // --- Desktop Timeline layout generation ---
  const getDesktopTimelineStructure = useCallback(() => {
    const structure: Array<{ type: "detailed" | "collapsed"; year: number; width: number }> = [];
    const focusIndex = allYears.indexOf(focusYear);

    // collapsed years on left
    if (focusIndex > 0) {
      const leftYears = allYears.slice(0, focusIndex);
      leftYears.forEach((year) => structure.push({ type: "collapsed", year, width: COLLAPSED_WIDTH }));
    }

    // detailed (only focus year)
    structure.push({ type: "detailed", year: focusYear, width: 300 });

    // collapsed years on right
    if (focusIndex < allYears.length - 1) {
      const rightYears = allYears.slice(focusIndex + 1);
      rightYears.forEach((year) => structure.push({ type: "collapsed", year, width: COLLAPSED_WIDTH }));
    }

    return structure;
  }, [allYears, focusYear]);

  // --- Mobile Timeline layout generation ---
  const getMobileTimelineStructure = useCallback(() => {
    const structure: Array<{ type: "detailed" | "collapsed"; year: number; height: number }> = [];
    const focusIndex = allYears.indexOf(focusYear);

    // collapsed years on top
    if (focusIndex > 0) {
      const topYears = allYears.slice(0, focusIndex);
      topYears.forEach((year) => structure.push({ type: "collapsed", year, height: COLLAPSED_HEIGHT_MOBILE }));
    }

    // detailed (only focus year)
    structure.push({ type: "detailed", year: focusYear, height: 400 });

    // collapsed years on bottom
    if (focusIndex < allYears.length - 1) {
      const bottomYears = allYears.slice(focusIndex + 1);
      bottomYears.forEach((year) => structure.push({ type: "collapsed", year, height: COLLAPSED_HEIGHT_MOBILE }));
    }

    return structure;
  }, [allYears, focusYear]);

  const desktopTimelineStructure = useMemo(() => getDesktopTimelineStructure(), [getDesktopTimelineStructure]);
  const mobileTimelineStructure = useMemo(() => getMobileTimelineStructure(), [getMobileTimelineStructure]);
  
  const totalWidth = useMemo(() => desktopTimelineStructure.reduce((acc, it) => acc + it.width, 0), [desktopTimelineStructure]);
  const totalHeight = useMemo(() => mobileTimelineStructure.reduce((acc, it) => acc + it.height, 0), [mobileTimelineStructure]);

  // compute event position in percent across the full timeline (GLOBAL percent)
  const getDesktopEventPosition = useCallback(
    (event: TimelineEvent): number | null => {
      if (!desktopTimelineStructure || totalWidth === 0) return null;
      let currentPositionPx = 0;
      for (const section of desktopTimelineStructure) {
        const sectionStartPx = currentPositionPx;
        const sectionWidthPx = section.width;

        if (section.year === event.year) {
          if (section.type === "detailed") {
            const clampOffset = Math.min(COLLAPSED_WIDTH, Math.floor(sectionWidthPx * 0.35));
            const monthIndex = Math.max(0, Math.min(11, months.indexOf(event.month)));
            const monthPx =
              sectionStartPx + clampOffset + ((sectionWidthPx - clampOffset) * (monthIndex / 11));
            return (monthPx / totalWidth) * 100;
          } else {
            const centerPx = sectionStartPx + sectionWidthPx / 2;
            return (centerPx / totalWidth) * 100;
          }
        }
        currentPositionPx += section.width;
      }
      return null;
    },
    [desktopTimelineStructure, totalWidth]
  );

  // compute event position for mobile (vertical)
  const getMobileEventPosition = useCallback(
    (event: TimelineEvent): number | null => {
      if (!mobileTimelineStructure || totalHeight === 0) return null;
      let currentPositionPx = 0;
      for (const section of mobileTimelineStructure) {
        const sectionStartPx = currentPositionPx;
        const sectionHeightPx = section.height;

        if (section.year === event.year) {
          if (section.type === "detailed") {
            const clampOffset = Math.min(COLLAPSED_HEIGHT_MOBILE, Math.floor(sectionHeightPx * 0.2));
            const monthIndex = Math.max(0, Math.min(11, months.indexOf(event.month)));
            const monthPx =
              sectionStartPx + clampOffset + ((sectionHeightPx - clampOffset) * (monthIndex / 11));
            return (monthPx / totalHeight) * 100;
          } else {
            const centerPx = sectionStartPx + sectionHeightPx / 2;
            return (centerPx / totalHeight) * 100;
          }
        }
        currentPositionPx += section.height;
      }
      return null;
    },
    [mobileTimelineStructure, totalHeight]
  );

  // --- Scroll handling: move only 1 event per gesture (accumulate small deltas for touchpads) ---
  const SCROLL_THROTTLE_MS = 300;
  const WHEEL_THRESHOLD = 60;

  const handleScroll = useCallback(
    (rawEvent: WheelEvent) => {
      rawEvent.preventDefault();
      rawEvent.stopPropagation();

      if (!rawEvent.deltaY && !rawEvent.deltaX) return;

      const now = Date.now();
      const sinceLast = now - lastScrollTime.current;
      if (sinceLast < SCROLL_THROTTLE_MS) {
        wheelAccum.current += rawEvent.deltaY;
        if (wheelResetTimer.current !== null) {
          window.clearTimeout(wheelResetTimer.current);
        }
        wheelResetTimer.current = window.setTimeout(() => {
          wheelAccum.current = 0;
          wheelResetTimer.current = null;
        }, 150);
        return;
      }

      wheelAccum.current += rawEvent.deltaY;

      if (wheelResetTimer.current !== null) {
        window.clearTimeout(wheelResetTimer.current);
      }
      wheelResetTimer.current = window.setTimeout(() => {
        wheelAccum.current = 0;
        wheelResetTimer.current = null;
      }, 150);

      if (Math.abs(wheelAccum.current) < WHEEL_THRESHOLD) {
        return;
      }

      const direction = wheelAccum.current > 0 ? 1 : -1;
      const newIndex = Math.max(0, Math.min(sortedEvents.length - 1, currentEventIndex + direction));

      wheelAccum.current = 0;

      if (newIndex !== currentEventIndex) {
        lastScrollTime.current = now;
        setCurrentEventIndex(newIndex);
        const newEvent = sortedEvents[newIndex];
        setSelectedEvent(newEvent);
        setFocusYear(newEvent.year);
        setIsScrolling(true);

        if (scrollTimeoutRef.current !== null) {
          window.clearTimeout(scrollTimeoutRef.current);
        }
        scrollTimeoutRef.current = window.setTimeout(() => {
          setIsScrolling(false);
          scrollTimeoutRef.current = null;
        }, 600);
      } else {
        lastScrollTime.current = now;
      }
    },
    [currentEventIndex, sortedEvents]
  );

  // keyboard navigation
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        e.preventDefault();
        const newIndex = Math.min(sortedEvents.length - 1, currentEventIndex + 1);
        if (newIndex !== currentEventIndex) {
          setCurrentEventIndex(newIndex);
          const newEvent = sortedEvents[newIndex];
          setSelectedEvent(newEvent);
          setFocusYear(newEvent.year);
        }
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        const newIndex = Math.max(0, currentEventIndex - 1);
        if (newIndex !== currentEventIndex) {
          setCurrentEventIndex(newIndex);
          const newEvent = sortedEvents[newIndex];
          setSelectedEvent(newEvent);
          setFocusYear(newEvent.year);
        }
      }
    },
    [currentEventIndex, sortedEvents]
  );

  // attach listeners to container and window (cleanup correctly)
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener("wheel", handleScroll as EventListener, { passive: false } as AddEventListenerOptions);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      container.removeEventListener("wheel", handleScroll as EventListener);
      window.removeEventListener("keydown", handleKeyDown);
      if (scrollTimeoutRef.current !== null) {
        window.clearTimeout(scrollTimeoutRef.current);
        scrollTimeoutRef.current = null;
      }
      if (wheelResetTimer.current !== null) {
        window.clearTimeout(wheelResetTimer.current);
        wheelResetTimer.current = null;
      }
    };
  }, [handleScroll, handleKeyDown]);

  // clicking an event focuses it
  const handleEventClick = (event: TimelineEvent) => {
    const index = sortedEvents.findIndex((e) => e.id === event.id);
    if (index !== -1) {
      setCurrentEventIndex(index);
      setSelectedEvent(event);
      if (event.year !== focusYear) {
        setFocusYear(event.year);
      }
    }
  };

  const handleEventHover = (event: TimelineEvent | null, e?: React.MouseEvent) => {
    setHoveredEvent(event);
    if (e) setMousePosition({ x: e.clientX, y: e.clientY });
  };

  // keep selectedEvent in sync if sortedEvents change (safe-guard)
  useEffect(() => {
    if (!selectedEvent && sortedEvents.length > 0) {
      setSelectedEvent(sortedEvents[0]);
      setFocusYear(sortedEvents[0].year);
      setCurrentEventIndex(0);
    }
  }, [selectedEvent, sortedEvents]);

  // helper to convert an absolute px into a left percentage relative to a section block (so we can place children inside that section)
  function pxToRelativePercentInSection(absPx: number, sectionStartPx: number, sectionWidthPx: number, totalWidthPx: number) {
    const absPercent = (absPx / totalWidthPx) * 100;
    const sectionLeftPercent = (sectionStartPx / totalWidthPx) * 100;
    const sectionWidthPercent = (sectionWidthPx / totalWidthPx) * 100;
    if (sectionWidthPercent === 0) return 0;
    const relativePercentWithinSection = ((absPercent - sectionLeftPercent) / sectionWidthPercent) * 100;
    return relativePercentWithinSection;
  }

  // helper for mobile vertical layout
  function pxToRelativePercentInMobileSection(absPx: number, sectionStartPx: number, sectionHeightPx: number, totalHeightPx: number) {
    const absPercent = (absPx / totalHeightPx) * 100;
    const sectionTopPercent = (sectionStartPx / totalHeightPx) * 100;
    const sectionHeightPercent = (sectionHeightPx / totalHeightPx) * 100;
    if (sectionHeightPercent === 0) return 0;
    const relativePercentWithinSection = ((absPercent - sectionTopPercent) / sectionHeightPercent) * 100;
    return relativePercentWithinSection;
  }

  // --- DESKTOP RENDER ---
  if (!isMobile) {
    return (
      <div
        ref={containerRef}
        style={{
          minHeight: "100vh",
          background: "#000",
          fontFamily: "'Inter', system-ui, sans-serif",
          padding: 20,
          display: "flex",
          flexDirection: "column",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Hover Card */}
        {hoveredEvent && !selectedEvent && (
          <div
            style={{
              position: "fixed",
              left: `${mousePosition.x + 20}px`,
              top: `${mousePosition.y - 100}px`,
              zIndex: 100,
              background: "rgba(255, 255, 255, 0.95)",
              backdropFilter: "blur(20px)",
              padding: "20px",
              borderRadius: "16px",
              border: "1px solid rgba(255, 255, 255, 0.2)",
              boxShadow: "0 10px 40px rgba(0,0,0,0.2)",
              maxWidth: "300px",
              animation: "fadeInScale 0.2s ease-out",
              pointerEvents: "none",
            }}
          >
            <style>
              {`
                @keyframes fadeInScale {
                  from {
                    opacity: 0;
                    transform: scale(0.9) translateY(10px);
                  }
                  to {
                    opacity: 1;
                    transform: scale(1) translateY(0);
                  }
                }
              `}
            </style>
            <div
              style={{
                fontSize: "14px",
                color: "#ff8800",
                fontWeight: "500",
                marginBottom: "8px",
              }}
            >
              {hoveredEvent.month} {hoveredEvent.year}
            </div>
            <div
              style={{
                fontSize: "18px",
                fontWeight: "600",
                color: "#2d3748",
                marginBottom: "12px",
              }}
            >
              {hoveredEvent.title}
            </div>
            <div
              style={{
                fontSize: "14px",
                color: "#4a5568",
                lineHeight: "1.4",
              }}
            >
              {hoveredEvent.description.substring(0, 100)}...
            </div>
          </div>
        )}

        {/* Event Detail Card */}
        <div style={{ flex: 1, overflow: "hidden", position: "relative", minHeight: "400px" }}>
          {selectedEvent && (
            <div
              style={{
                position: "absolute",
                top: "5%",
                left: "5%",
                width: "90%",
                height: "85%",
                background: "rgba(0,0,0,0.7)",
                backdropFilter: "blur(20px)",
                display: "flex",
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 50,
                padding: "40px",
                borderRadius: "24px",
                boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
                transform: isScrolling ? "scale(0.95)" : "scale(0.9) translateY(20px)",
                opacity: isScrolling ? 0.8 : 1,
                animation: "slideUpIn 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards",
                transition: "transform 0.3s ease, opacity 0.3s ease",
              }}
            >
              <style>
                {`
                  @keyframes slideUpIn {
                    to {
                      transform: scale(1) translateY(0);
                      opacity: 1;
                    }
                  }
                `}
              </style>
              {/* Left Section - Images */}
              <div style={{ flex: 1, position: "relative", display: "flex", justifyContent: "center", alignItems: "center", height: "100%" }}>
                <div style={{ position: "relative", width: "300px", height: "300px" }}>
                  <img
                    src={`https://picsum.photos/id/${selectedEvent.imageId}/300/300`}
                    alt="Event"
                    style={{
                      width: "300px",
                      height: "300px",
                      borderRadius: "50%",
                      zIndex: 1,
                      objectFit: "cover",
                      boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
                      animation: "scaleIn 0.6s ease-out 0.2s backwards",
                    }}
                  />
                  <style>
                    {`
                      @keyframes scaleIn {
                        from {
                          transform: scale(0.5);
                          opacity: 0;
                        }
                        to {
                          transform: scale(1);
                          opacity: 1;
                        }
                      }
                    `}
                  </style>
                </div>
              </div>

              {/* Right Section - Content */}
              <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", height: "100%", paddingLeft: "60px" }}>
                <div
                  style={{
                    fontSize: "36px",
                    fontWeight: "700",
                    marginBottom: "18px",
                    color: "#ff8800",
                    textAlign: "center",
                    letterSpacing: "1px",
                    animation: "slideInRight 0.6s ease-out 0.3s backwards",
                  }}
                >
                  {selectedEvent.month} {selectedEvent.year}
                </div>
                <div
                  style={{
                    fontSize: "32px",
                    fontWeight: "700",
                    marginBottom: "18px",
                    color: "#fff",
                    textAlign: "left",
                    lineHeight: "1.2",
                    animation: "slideInRight 0.6s ease-out 0.4s backwards",
                  }}
                >
                  {selectedEvent.title}
                </div>
                <div
                  style={{
                    fontSize: "20px",
                    color: "#ff8800",
                    lineHeight: "1.7",
                    animation: "slideInRight 0.6s ease-out 0.5s backwards",
                  }}
                >
                  {selectedEvent.description}
                </div>
              </div>
              <style>
                {`
                  @keyframes slideInRight {
                    from {
                      transform: translateX(40px);
                      opacity: 0;
                    }
                    to {
                      transform: translateX(0);
                      opacity: 1;
                    }
                  }
                `}
              </style>
            </div>
          )}
        </div>

        {/* Timeline bar */}
        <div
          style={{
            height: 200,
            backdropFilter: "blur(14px)",
            position: "relative",
            borderRadius: 16,
            padding: "22px 28px",
            overflow: "hidden",
          }}
        >
          {/* baseline */}
          <div
            style={{
              position: "relative",
              height: "6px",
              background: "linear-gradient(90deg, rgba(255,255,255,0.2) 0%, rgba(255,255,255,0.4) 50%, rgba(255,255,255,0.2) 100%)",
              top: "30px",
              borderRadius: "3px",
              transition: "all 0.6s cubic-bezier(0.4, 0, 0.2, 1)",
              zIndex: 2,
            }}
          >
            {/* timeline sections */}
            {desktopTimelineStructure.map((section, sectionIndex) => {
              let currentX = 0;
              for (let i = 0; i < sectionIndex; i++) currentX += desktopTimelineStructure[i].width;
              const sectionStartPx = currentX;
              const sectionWidthPx = section.width;

              const leftPercent = (sectionStartPx / totalWidth) * 100;
              const widthPercent = (sectionWidthPx / totalWidth) * 100;

              const isDetailed = section.type === "detailed";
              const isFocus = isDetailed && section.year === focusYear;

              const absPxToRel = (absPx: number) =>
                pxToRelativePercentInSection(absPx, sectionStartPx, sectionWidthPx, totalWidth);

              return (
                <div
                  key={`${section.type}-${section.year}-${sectionIndex}`}
                  style={{
                    position: "absolute",
                    left: `${leftPercent}%`,
                    width: `${widthPercent}%`,
                    height: "100%",
                    transition: "all 0.6s cubic-bezier(0.2,0.9,0.2,1)",
                  }}
                >
                  {/* detailed year block */}
                  {isDetailed && (
                    <>
                      {(() => {
                        const clampOffset = Math.min(COLLAPSED_WIDTH, Math.floor(sectionWidthPx * 0.35));
                        const indicatorCenterPx = sectionStartPx + clampOffset / 2;
                        const indicatorRelPercent = absPxToRel(indicatorCenterPx);

                        const labelPx = sectionStartPx + clampOffset / 2;
                        const labelRelPercent = absPxToRel(labelPx);

                        return (
                          <>
                            {/* Month ticks */}
                            {Array.from({ length: 12 }, (_, monthIndex) => {
                              const monthAbsPx =
                                sectionStartPx + clampOffset + ((sectionWidthPx - clampOffset) * (monthIndex / 11));
                              const monthRelPercent = absPxToRel(monthAbsPx);
                              return (
                                <div
                                  key={`m-${section.year}-${monthIndex}`}
                                  style={{
                                    position: "absolute",
                                    left: `${monthRelPercent}%`,
                                    top: -7,
                                    width: 2,
                                    height: 18,
                                    background: "rgba(255,255,255,0.26)",
                                    transform: "translateX(-50%)",
                                  }}
                                />
                              );
                            })}

                            {/* Month labels for the focus year only */}
                            {section.year === focusYear &&
                              months.map((m, monthIndex) => {
                                const monthAbsPx =
                                  sectionStartPx + clampOffset + ((sectionWidthPx - clampOffset) * (monthIndex / 11));
                                const monthRelPercent = absPxToRel(monthAbsPx);
                                return (
                                  <div
                                    key={`label-${section.year}-${monthIndex}`}
                                    style={{
                                      position: "absolute",
                                      left: `${monthRelPercent}%`,
                                      top: 16,
                                      transform: "translateX(-50%)",
                                      fontSize: 10,
                                      color: "rgba(255,255,255,0.7)",
                                      fontWeight: 500,
                                      whiteSpace: "nowrap",
                                    }}
                                  >
                                    {m}
                                  </div>
                                );
                              })}

                            {/* Year label */}
                            <div
                              style={{
                                position: "absolute",
                                left: `${labelRelPercent}%`,
                                top: 20,
                                transform: "translateX(-50%)",
                                fontSize: isFocus ? 20 : 14,
                                fontWeight: 800,
                                color: isFocus ? "#fff" : "rgba(255,255,255,0.7)",
                                textShadow: isFocus ? "0 0 20px rgba(102,126,234,0.65)" : "none",
                              }}
                            >
                              {section.year}
                            </div>

                            {/* Year vertical indicator */}
                            <div
                              style={{
                                position: "absolute",
                                left: `${indicatorRelPercent}%`,
                                top: "-12px",
                                width: isFocus ? "4px" : "2px",
                                height: isFocus ? "30px" : "24px",
                                background: isFocus
                                  ? "linear-gradient(180deg, #667eea 0%, rgba(102,126,234,0.4) 100%)"
                                  : "rgba(255,255,255,0.5)",
                                borderRadius: "2px",
                                transform: "translateX(-50%)",
                                transition: "all 0.4s ease",
                                boxShadow: isFocus ? "0 0 20px rgba(102,126,234,0.6)" : "none",
                              }}
                            />
                          </>
                        );
                      })()}
                    </>
                  )}

                  {/* Collapsed Years */}
                  {section.type === "collapsed" && (
                    <>
                      {(() => {
                        const centerPx = sectionStartPx + sectionWidthPx / 2;
                        const centerRelPercent = pxToRelativePercentInSection(centerPx, sectionStartPx, sectionWidthPx, totalWidth);
                        const indicatorPx = sectionStartPx + sectionWidthPx / 2;
                        const indicatorRelPercent = pxToRelativePercentInSection(indicatorPx, sectionStartPx, sectionWidthPx, totalWidth);
                        return (
                          <>
                            <div
                              onClick={() => {
                                setFocusYear(section.year);
                                const eventsInYear = sortedEvents.filter((e) => e.year === section.year);
                                if (eventsInYear.length > 0) {
                                  const index = sortedEvents.findIndex((e) => e.id === eventsInYear[0].id);
                                  setCurrentEventIndex(index);
                                  setSelectedEvent(eventsInYear[0]);
                                }
                              }}
                              style={{
                                position: "absolute",
                                left: `${centerRelPercent}%`,
                                top: "30px",
                                fontSize: "14px",
                                fontWeight: "500",
                                color: "rgba(255,255,255,0.6)",
                                transform: "translateX(-50%)",
                                whiteSpace: "nowrap",
                                cursor: "pointer",
                                transition: "all 0.3s ease",
                              }}
                              onMouseEnter={(e) => {
                                (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.9)";
                                (e.currentTarget as HTMLElement).style.transform = "translateX(-50%) scale(1.1)";
                              }}
                              onMouseLeave={(e) => {
                                (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.6)";
                                (e.currentTarget as HTMLElement).style.transform = "translateX(-50%) scale(1)";
                              }}
                            >
                              {section.year}
                            </div>
                            <div
                              style={{
                                position: "absolute",
                                left: `${indicatorRelPercent}%`,
                                top: "-10px",
                                width: "4px",
                                height: "22px",
                                background: "rgba(255,255,255,0.4)",
                                borderRadius: "1px",
                                transform: "translateX(-50%)",
                                transition: "all 0.3s ease",
                              }}
                            />
                          </>
                        );
                      })()}
                    </>
                  )}
                </div>
              );
            })}

            {/* Event Dots */}
            {timelineEvents.map((event) => {
              const position = getDesktopEventPosition(event);
              if (position === null) return null;

              const isSelected = selectedEvent?.id === event.id;
              const isInFocusYear = event.year === focusYear;

              let size = 8;
              let opacity = 0.9;
              let zIndex = 5;

              if (isSelected) {
                size = 22;
                opacity = 1;
                zIndex = 60;
              } else if (isInFocusYear) {
                size = 14;
                opacity = 1;
                zIndex = 40;
              } else {
                size = 10;
                opacity = 0.85;
                zIndex = 20;
              }

              const baselineTop = -20;
              const topPx = baselineTop - size / 2;

              return (
                <div
                  key={event.id}
                  onClick={() => handleEventClick(event)}
                  onMouseEnter={(e) => {
                    handleEventHover(event, e);
                    if (!isSelected) {
                      (e.currentTarget as HTMLElement).style.transform = "translateX(-50%) scale(1.25)";
                      (e.currentTarget as HTMLElement).style.filter = "brightness(1.2)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    handleEventHover(null);
                    if (!isSelected) {
                      (e.currentTarget as HTMLElement).style.transform = "translateX(-50%) scale(1)";
                      (e.currentTarget as HTMLElement).style.filter = "brightness(1)";
                    }
                  }}
                  style={{
                    position: "absolute",
                    left: `${position}%`,
                    top: `${topPx}px`,
                    width: `${size}px`,
                    height: `${size}px`,
                    background: isSelected
                      ? "radial-gradient(circle, #fff 20%, #ffb86b 60%, #ff8800 100%)"
                      : isInFocusYear
                      ? "radial-gradient(circle, #fff 30%, #ffb86b 100%)"
                      : "radial-gradient(circle, rgba(255,200,120,0.9) 30%, rgba(255,150,60,0.9) 100%)",
                    borderRadius: "50%",
                    cursor: "pointer",
                    transform: "translateX(-50%)",
                    border: isSelected ? "3px solid #fff" : isInFocusYear ? "2px solid rgba(255,255,255,0.9)" : "1px solid rgba(255,255,255,0.5)",
                    boxShadow: isSelected ? "0 0 40px rgba(255,136,0,0.9), 0 0 20px rgba(255,255,255,0.8), 0 4px 15px rgba(0,0,0,0.3)" : "0 0 10px rgba(255,136,0,0.45)",
                    transition: "all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)",
                    zIndex: zIndex,
                    opacity: opacity,
                    animation: isSelected ? "pulse 2s ease-in-out infinite" : "none",
                    filter: "brightness(1)",
                  }}
                />
              );
            })}

            <style>
              {`
                @keyframes pulse {
                  0%, 100% { 
                    box-shadow: 0 0 40px rgba(255,136,0,0.95), 0 0 20px rgba(255,255,255,0.8), 0 4px 15px rgba(0,0,0,0.3);
                    transform: translateX(-50%) scale(1);
                  }
                  50% { 
                    box-shadow: 0 0 60px rgba(255,136,0,1), 0 0 40px rgba(255,255,255,1), 0 4px 20px rgba(0,0,0,0.3);
                    transform: translateX(-50%) scale(1.08);
                  }
                }
              `}
            </style>
          </div>
        </div>
      </div>
    );
  }

  // --- MOBILE RENDER ---
  return (
    <div
      ref={containerRef}
      style={{
        minHeight: "100vh",
        background: "#000",
        fontFamily: "'Inter', system-ui, sans-serif",
        display: "flex",
        flexDirection: "row",
        position: "relative",
        overflow: "hidden",
        padding: "20px 10px",
      }}
    >
      {/* Left Side - Vertical Timeline */}
      <div
        style={{
          width: "120px",
          position: "relative",
          paddingRight: "20px",
        }}
      >
        {/* Vertical baseline */}
        <div
          style={{
            position: "absolute",
            left: "30px",
            top: "20px",
            bottom: "20px",
            width: "4px",
            background: "linear-gradient(180deg, rgba(255,255,255,0.2) 0%, rgba(255,255,255,0.4) 50%, rgba(255,255,255,0.2) 100%)",
            borderRadius: "2px",
            zIndex: 2,
          }}
        >
          {/* Mobile timeline sections */}
          {mobileTimelineStructure.map((section, sectionIndex) => {
            let currentY = 0;
            for (let i = 0; i < sectionIndex; i++) currentY += mobileTimelineStructure[i].height;
            const sectionStartPx = currentY;
            const sectionHeightPx = section.height;

            const topPercent = (sectionStartPx / totalHeight) * 100;
            const heightPercent = (sectionHeightPx / totalHeight) * 100;

            const isDetailed = section.type === "detailed";
            const isFocus = isDetailed && section.year === focusYear;

            const absPxToRel = (absPx: number) =>
              pxToRelativePercentInMobileSection(absPx, sectionStartPx, sectionHeightPx, totalHeight);

            return (
              <div
                key={`mobile-${section.type}-${section.year}-${sectionIndex}`}
                style={{
                  position: "absolute",
                  top: `${topPercent}%`,
                  height: `${heightPercent}%`,
                  width: "100%",
                  transition: "all 0.6s cubic-bezier(0.2,0.9,0.2,1)",
                }}
              >
                {/* Detailed year block (vertical) */}
                {isDetailed && (
                  <>
                    {(() => {
                      const clampOffset = Math.min(COLLAPSED_HEIGHT_MOBILE, Math.floor(sectionHeightPx * 0.2));
                      const indicatorCenterPx = sectionStartPx + clampOffset / 2;
                      const indicatorRelPercent = absPxToRel(indicatorCenterPx);

                      const labelPx = sectionStartPx + clampOffset / 2;
                      const labelRelPercent = absPxToRel(labelPx);

                      return (
                        <>
                          {/* Month ticks (horizontal) */}
                          {Array.from({ length: 12 }, (_, monthIndex) => {
                            const monthAbsPx =
                              sectionStartPx + clampOffset + ((sectionHeightPx - clampOffset) * (monthIndex / 11));
                            const monthRelPercent = absPxToRel(monthAbsPx);
                            return (
                              <div
                                key={`mobile-m-${section.year}-${monthIndex}`}
                                style={{
                                  position: "absolute",
                                  top: `${monthRelPercent}%`,
                                  left: "-7px",
                                  width: "18px",
                                  height: "2px",
                                  background: "rgba(255,255,255,0.26)",
                                  transform: "translateY(-50%)",
                                }}
                              />
                            );
                          })}

                          {/* Month labels for the focus year only (horizontal) */}
                          {section.year === focusYear &&
                            months.map((m, monthIndex) => {
                              const monthAbsPx =
                                sectionStartPx + clampOffset + ((sectionHeightPx - clampOffset) * (monthIndex / 11));
                              const monthRelPercent = absPxToRel(monthAbsPx);
                              return (
                                <div
                                  key={`mobile-label-${section.year}-${monthIndex}`}
                                  style={{
                                    position: "absolute",
                                    top: `${monthRelPercent}%`,
                                    left: "16px",
                                    transform: "translateY(-50%)",
                                    fontSize: "10px",
                                    color: "rgba(255,255,255,0.7)",
                                    fontWeight: "500",
                                    whiteSpace: "nowrap",
                                  }}
                                >
                                  {m}
                                </div>
                              );
                            })}

                          {/* Year label */}
                          <div
                            style={{
                              position: "absolute",
                              top: `${labelRelPercent}%`,
                              left: "50px",
                              transform: "translateY(-50%)",
                              fontSize: isFocus ? "18px" : "14px",
                              fontWeight: "800",
                              color: isFocus ? "#fff" : "rgba(255,255,255,0.7)",
                              textShadow: isFocus ? "0 0 20px rgba(102,126,234,0.65)" : "none",
                              writingMode: "vertical-rl",
                              textOrientation: "mixed",
                            }}
                          >
                            {section.year}
                          </div>

                          {/* Year horizontal indicator */}
                          <div
                            style={{
                              position: "absolute",
                              top: `${indicatorRelPercent}%`,
                              left: "-12px",
                              width: isFocus ? "30px" : "24px",
                              height: isFocus ? "4px" : "2px",
                              background: isFocus
                                ? "linear-gradient(90deg, #667eea 0%, rgba(102,126,234,0.4) 100%)"
                                : "rgba(255,255,255,0.5)",
                              borderRadius: "2px",
                              transform: "translateY(-50%)",
                              transition: "all 0.4s ease",
                              boxShadow: isFocus ? "0 0 20px rgba(102,126,234,0.6)" : "none",
                            }}
                          />
                        </>
                      );
                    })()}
                  </>
                )}

                {/* Collapsed Years (vertical) */}
                {section.type === "collapsed" && (
                  <>
                    {(() => {
                      const centerPx = sectionStartPx + sectionHeightPx / 2;
                      const centerRelPercent = pxToRelativePercentInMobileSection(centerPx, sectionStartPx, sectionHeightPx, totalHeight);
                      const indicatorPx = sectionStartPx + sectionHeightPx / 2;
                      const indicatorRelPercent = pxToRelativePercentInMobileSection(indicatorPx, sectionStartPx, sectionHeightPx, totalHeight);
                      return (
                        <>
                          <div
                            onClick={() => {
                              setFocusYear(section.year);
                              const eventsInYear = sortedEvents.filter((e) => e.year === section.year);
                              if (eventsInYear.length > 0) {
                                const index = sortedEvents.findIndex((e) => e.id === eventsInYear[0].id);
                                setCurrentEventIndex(index);
                                setSelectedEvent(eventsInYear[0]);
                              }
                            }}
                            style={{
                              position: "absolute",
                              top: `${centerRelPercent}%`,
                              left: "50px",
                              fontSize: "14px",
                              fontWeight: "500",
                              color: "rgba(255,255,255,0.6)",
                              transform: "translateY(-50%)",
                              whiteSpace: "nowrap",
                              cursor: "pointer",
                              transition: "all 0.3s ease",
                              writingMode: "vertical-rl",
                              textOrientation: "mixed",
                            }}
                            onMouseEnter={(e) => {
                              (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.9)";
                              (e.currentTarget as HTMLElement).style.transform = "translateY(-50%) scale(1.1)";
                            }}
                            onMouseLeave={(e) => {
                              (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.6)";
                              (e.currentTarget as HTMLElement).style.transform = "translateY(-50%) scale(1)";
                            }}
                          >
                            {section.year}
                          </div>
                          <div
                            style={{
                              position: "absolute",
                              top: `${indicatorRelPercent}%`,
                              left: "-10px",
                              width: "22px",
                              height: "4px",
                              background: "rgba(255,255,255,0.4)",
                              borderRadius: "1px",
                              transform: "translateY(-50%)",
                              transition: "all 0.3s ease",
                            }}
                          />
                        </>
                      );
                    })()}
                  </>
                )}
              </div>
            );
          })}

          {/* Mobile Event Dots */}
          {timelineEvents.map((event) => {
            const position = getMobileEventPosition(event);
            if (position === null) return null;

            const isSelected = selectedEvent?.id === event.id;
            const isInFocusYear = event.year === focusYear;

            let size = 8;
            let opacity = 0.9;
            let zIndex = 5;

            if (isSelected) {
              size = 18;
              opacity = 1;
              zIndex = 60;
            } else if (isInFocusYear) {
              size = 12;
              opacity = 1;
              zIndex = 40;
            } else {
              size = 8;
              opacity = 0.85;
              zIndex = 20;
            }

            const leftPx = -size / 2;

            return (
              <div
                key={`mobile-${event.id}`}
                onClick={() => handleEventClick(event)}
                onMouseEnter={(e) => {
                  handleEventHover(event, e);
                  if (!isSelected) {
                    (e.currentTarget as HTMLElement).style.transform = "translateY(-50%) scale(1.25)";
                    (e.currentTarget as HTMLElement).style.filter = "brightness(1.2)";
                  }
                }}
                onMouseLeave={(e) => {
                  handleEventHover(null);
                  if (!isSelected) {
                    (e.currentTarget as HTMLElement).style.transform = "translateY(-50%) scale(1)";
                    (e.currentTarget as HTMLElement).style.filter = "brightness(1)";
                  }
                }}
                style={{
                  position: "absolute",
                  top: `${position}%`,
                  left: `${leftPx}px`,
                  width: `${size}px`,
                  height: `${size}px`,
                  background: isSelected
                    ? "radial-gradient(circle, #fff 20%, #ffb86b 60%, #ff8800 100%)"
                    : isInFocusYear
                    ? "radial-gradient(circle, #fff 30%, #ffb86b 100%)"
                    : "radial-gradient(circle, rgba(255,200,120,0.9) 30%, rgba(255,150,60,0.9) 100%)",
                  borderRadius: "50%",
                  cursor: "pointer",
                  transform: "translateY(-50%)",
                  border: isSelected ? "3px solid #fff" : isInFocusYear ? "2px solid rgba(255,255,255,0.9)" : "1px solid rgba(255,255,255,0.5)",
                  boxShadow: isSelected ? "0 0 30px rgba(255,136,0,0.9), 0 0 15px rgba(255,255,255,0.8), 0 4px 10px rgba(0,0,0,0.3)" : "0 0 8px rgba(255,136,0,0.45)",
                  transition: "all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)",
                  zIndex: zIndex,
                  opacity: opacity,
                  animation: isSelected ? "mobilePulse 2s ease-in-out infinite" : "none",
                  filter: "brightness(1)",
                }}
              />
            );
          })}

          <style>
            {`
              @keyframes mobilePulse {
                0%, 100% { 
                  box-shadow: 0 0 30px rgba(255,136,0,0.95), 0 0 15px rgba(255,255,255,0.8), 0 4px 10px rgba(0,0,0,0.3);
                  transform: translateY(-50%) scale(1);
                }
                50% { 
                  box-shadow: 0 0 45px rgba(255,136,0,1), 0 0 25px rgba(255,255,255,1), 0 4px 15px rgba(0,0,0,0.3);
                  transform: translateY(-50%) scale(1.08);
                }
              }
            `}
          </style>
        </div>
      </div>

      {/* Right Side - Content */}
      <div style={{ 
        flex: 1, 
        display: "flex", 
        flexDirection: "column", 
        alignItems: "center", 
        justifyContent: "center", 
        padding: "20px 10px",
        minHeight: "100vh",
        overflow: "hidden"
      }}>
        {selectedEvent && (
          <div
            style={{
              background: "rgba(0,0,0,0.8)",
              backdropFilter: "blur(20px)",
              borderRadius: "20px",
              padding: "20px",
              textAlign: "center",
              width: "100%",
              maxWidth: "350px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
              transform: isScrolling ? "scale(0.95)" : "scale(0.9) translateY(20px)",
              opacity: isScrolling ? 0.8 : 1,
              animation: "mobileSlideUpIn 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards",
              transition: "transform 0.3s ease, opacity 0.3s ease",
            }}
          >
            <style>
              {`
                @keyframes mobileSlideUpIn {
                  to {
                    transform: scale(1) translateY(0);
                    opacity: 1;
                  }
                }
              `}
            </style>
            
            {/* Image */}
            <div style={{ 
              marginBottom: "20px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "100%"
            }}>
              <img
                src={`https://picsum.photos/id/${selectedEvent.imageId}/300/300`}
                alt="Event"
                style={{
                  width: "min(200px, calc(100vw - 200px))",
                  height: "min(200px, calc(100vw - 200px))",
                  maxWidth: "200px",
                  maxHeight: "200px",
                  minWidth: "150px",
                  minHeight: "150px",
                  borderRadius: "50%",
                  objectFit: "cover",
                  boxShadow: "0 15px 40px rgba(0,0,0,0.2)",
                  animation: "mobileScaleIn 0.6s ease-out 0.2s backwards",
                  aspectRatio: "1",
                }}
              />
              <style>
                {`
                  @keyframes mobileScaleIn {
                    from {
                      transform: scale(0.5);
                      opacity: 0;
                    }
                    to {
                      transform: scale(1);
                      opacity: 1;
                    }
                  }
                `}
              </style>
            </div>

            {/* Date */}
            <div
              style={{
                fontSize: "clamp(18px, 5vw, 24px)",
                fontWeight: "700",
                marginBottom: "12px",
                color: "#ff8800",
                letterSpacing: "1px",
                animation: "mobileSlideInUp 0.6s ease-out 0.3s backwards",
                textAlign: "center",
                width: "100%",
              }}
            >
              {selectedEvent.month} {selectedEvent.year}
            </div>

            {/* Title */}
            <div
              style={{
                fontSize: "clamp(20px, 5.5vw, 26px)",
                fontWeight: "700",
                marginBottom: "12px",
                color: "#fff",
                lineHeight: "1.2",
                animation: "mobileSlideInUp 0.6s ease-out 0.4s backwards",
                textAlign: "center",
                width: "100%",
                wordWrap: "break-word",
                hyphens: "auto",
              }}
            >
              {selectedEvent.title}
            </div>

            {/* Description */}
            <div
              style={{
                fontSize: "clamp(14px, 4vw, 16px)",
                color: "#ff8800",
                lineHeight: "1.6",
                animation: "mobileSlideInUp 0.6s ease-out 0.5s backwards",
                textAlign: "center",
                width: "100%",
                wordWrap: "break-word",
                hyphens: "auto",
              }}
            >
              {selectedEvent.description}
            </div>

            <style>
              {`
                @keyframes mobileSlideInUp {
                  from {
                    transform: translateY(20px);
                    opacity: 0;
                  }
                  to {
                    transform: translateY(0);
                    opacity: 1;
                  }
                }
              `}
            </style>
          </div>
        )}
      </div>

      {/* Hover Card for Mobile */}
      {hoveredEvent && !selectedEvent && (
        <div
          style={{
            position: "fixed",
            left: `${mousePosition.x + 20}px`,
            top: `${mousePosition.y - 100}px`,
            zIndex: 100,
            background: "rgba(255, 255, 255, 0.95)",
            backdropFilter: "blur(20px)",
            padding: "15px",
            borderRadius: "12px",
            border: "1px solid rgba(255, 255, 255, 0.2)",
            boxShadow: "0 10px 30px rgba(0,0,0,0.2)",
            maxWidth: "250px",
            animation: "fadeInScale 0.2s ease-out",
            pointerEvents: "none",
            fontSize: "14px",
          }}
        >
          <div
            style={{
              fontSize: "12px",
              color: "#ff8800",
              fontWeight: "500",
              marginBottom: "6px",
            }}
          >
            {hoveredEvent.month} {hoveredEvent.year}
          </div>
          <div
            style={{
              fontSize: "16px",
              fontWeight: "600",
              color: "#2d3748",
              marginBottom: "8px",
            }}
          >
            {hoveredEvent.title}
          </div>
          <div
            style={{
              fontSize: "12px",
              color: "#4a5568",
              lineHeight: "1.4",
            }}
          >
            {hoveredEvent.description.substring(0, 80)}...
          </div>
        </div>
      )}
    </div>
  );
}