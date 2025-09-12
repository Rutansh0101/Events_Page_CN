"use client";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import timelineData from "./data.json";

const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

interface TimelineEvent {
  id: number;
  year: number;
  month: string;
  title: string;
  description: string;
  imageId: number;
}

// small helper (keeps deterministic pseudo-random positions if you re-enable)
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

export default function ModernTimeline(): JSX.Element {
  // --- memoize sorted events so the identity doesn't change every render ---
  const sortedEvents = useMemo(() => {
    return [...timelineData.timelineEvents].sort((a: TimelineEvent, b: TimelineEvent) => {
      if (a.year !== b.year) return a.year - b.year;
      return months.indexOf(a.month) - months.indexOf(b.month);
    });
  }, []);

  const timelineEvents = sortedEvents;
  const allYears = useMemo(() => Array.from(new Set(timelineEvents.map((e) => e.year))).sort(), [timelineEvents]);

  // current year
  const currentYear = new Date().getFullYear();

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
  const COLLAPSED_WIDTH = 60; // px reserved spacing used between collapsed years and also inside detailed block

  // --- Timeline layout generation ---
  const getTimelineStructure = useCallback(() => {
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

  const timelineStructure = useMemo(() => getTimelineStructure(), [getTimelineStructure]);
  const totalWidth = useMemo(() => timelineStructure.reduce((acc, it) => acc + it.width, 0), [timelineStructure]); // px

  // compute event position in percent across the full timeline (GLOBAL percent)
  const getEventPosition = useCallback(
    (event: TimelineEvent): number | null => {
      if (!timelineStructure || totalWidth === 0) return null;
      let currentPositionPx = 0;
      for (const section of timelineStructure) {
        const sectionStartPx = currentPositionPx;
        const sectionWidthPx = section.width;

        if (section.year === event.year) {
          if (section.type === "detailed") {
            // months start after a left padding equal to COLLAPSED_WIDTH inside the detailed block
            const clampOffset = Math.min(COLLAPSED_WIDTH, Math.floor(sectionWidthPx * 0.35)); // ensure we don't exceed reasonable fraction
            const monthIndex = Math.max(0, Math.min(11, months.indexOf(event.month)));
            const monthPx =
              sectionStartPx + clampOffset + ((sectionWidthPx - clampOffset) * (monthIndex / 11));
            return (monthPx / totalWidth) * 100;
          } else {
            // collapsed: center of the collapsed block
            const centerPx = sectionStartPx + sectionWidthPx / 2;
            return (centerPx / totalWidth) * 100;
          }
        }
        currentPositionPx += section.width;
      }
      return null;
    },
    [timelineStructure, totalWidth]
  );

  // --- Scroll handling: move only 1 event per gesture (accumulate small deltas for touchpads) ---
  const SCROLL_THROTTLE_MS = 300; // minimal time between moves
  const WHEEL_THRESHOLD = 60; // accumulated deltaY threshold for trackpad gestures

  const handleScroll = useCallback(
    (rawEvent: WheelEvent) => {
      // only when container present
      rawEvent.preventDefault();
      rawEvent.stopPropagation();

      // ignore weird zero events
      if (!rawEvent.deltaY && !rawEvent.deltaX) return;

      const now = Date.now();
      const sinceLast = now - lastScrollTime.current;
      if (sinceLast < SCROLL_THROTTLE_MS) {
        // still consume / accumulate delta to avoid jitter, but don't move yet
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

      // accumulate small deltas (makes trackpad gestures deliberate)
      wheelAccum.current += rawEvent.deltaY;

      // reset any reset timer
      if (wheelResetTimer.current !== null) {
        window.clearTimeout(wheelResetTimer.current);
      }
      wheelResetTimer.current = window.setTimeout(() => {
        wheelAccum.current = 0;
        wheelResetTimer.current = null;
      }, 150);

      // if we haven't reached the threshold yet, don't move
      if (Math.abs(wheelAccum.current) < WHEEL_THRESHOLD) {
        return;
      }

      // one event per gesture: direction by sign of accumulated delta
      const direction = wheelAccum.current > 0 ? 1 : -1;
      const newIndex = Math.max(0, Math.min(sortedEvents.length - 1, currentEventIndex + direction));

      // reset accumulator immediately (so further small events need another deliberate gesture)
      wheelAccum.current = 0;

      if (newIndex !== currentEventIndex) {
        lastScrollTime.current = now;
        setCurrentEventIndex(newIndex);
        const newEvent = sortedEvents[newIndex];
        setSelectedEvent(newEvent);
        setFocusYear(newEvent.year);
        setIsScrolling(true);

        // clear previous timeout if any
        if (scrollTimeoutRef.current !== null) {
          window.clearTimeout(scrollTimeoutRef.current);
        }
        // after animation settle, clear scrolling state (gives user visual feedback)
        scrollTimeoutRef.current = window.setTimeout(() => {
          setIsScrolling(false);
          scrollTimeoutRef.current = null;
        }, 600);
      } else {
        // still set lastScrollTime so repeated gestures don't try again immed.
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

    // use non-passive to allow preventDefault
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

  // deterministic small circles around main image (commented out in render — re-enable if desired)
  const smallCirclesForSelected = useMemo(() => {
    if (!selectedEvent) return [];
    const rand = seededRandom(selectedEvent.id);
    const ids = getRandomIds(selectedEvent.imageId, 6);
    return ids.map((imgId, idx) => {
      const r = 120 + Math.floor(rand(idx) * 140); // radial band
      const angle = rand(idx) * Math.PI * 2;
      const size = 24 + Math.floor(rand(idx + 20) * 50); // sizes between ~24-74
      const x = Math.cos(angle) * r;
      const y = Math.sin(angle) * r;
      return { imgId, x, y, size };
    });
  }, [selectedEvent]);

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
    const absPercent = (absPx / totalWidthPx) * 100; // global percent
    const sectionLeftPercent = (sectionStartPx / totalWidthPx) * 100; // global percent of section start
    const sectionWidthPercent = (sectionWidthPx / totalWidthPx) * 100;
    if (sectionWidthPercent === 0) return 0;
    const relativePercentWithinSection = ((absPercent - sectionLeftPercent) / sectionWidthPercent) * 100;
    return relativePercentWithinSection;
  }

  // --- Render ---
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
      {/* Hover Card (unchanged) */}
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
          {timelineStructure.map((section, sectionIndex) => {
            // compute px-based positions for this section
            let currentX = 0;
            for (let i = 0; i < sectionIndex; i++) currentX += timelineStructure[i].width;
            const sectionStartPx = currentX;
            const sectionWidthPx = section.width;

            // global percent of this section start and width
            const leftPercent = (sectionStartPx / totalWidth) * 100;
            const widthPercent = (sectionWidthPx / totalWidth) * 100;

            const isDetailed = section.type === "detailed";
            const isFocus = isDetailed && section.year === focusYear;

            // helpers for absolute px->relative percent inside this section
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
                      // clamp offset so we don't use more than a portion of section
                      const clampOffset = Math.min(COLLAPSED_WIDTH, Math.floor(sectionWidthPx * 0.35));
                      // indicator center px (place at start of detailed block but offset by half collapsed spacing,
                      // so indicator spacing looks consistent with collapsed year spacing)
                      const indicatorCenterPx = sectionStartPx + clampOffset / 2;
                      const indicatorRelPercent = absPxToRel(indicatorCenterPx);

                      // year label px (place close to indicator but slightly below)
                      const labelPx = sectionStartPx + clampOffset / 2;
                      const labelRelPercent = absPxToRel(labelPx);

                      return (
                        <>
                          {/* Month ticks — compute global px then convert to percent inside this section */}
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

                          {/* Month labels for the focus year only -> placed same as ticks */}
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

                          {/* Year label — placed near the left indicator (NOT centered) */}
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

                          {/* Year vertical indicator — positioned at the left/start of the detailed block (with spacing) */}
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
                      // center px for collapsed block
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

          {/* Event Dots — now orange, aligned to month baseline exactly (global percents from getEventPosition) */}
          {timelineEvents.map((event) => {
            const position = getEventPosition(event);
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

            // baseline top is 30px in the timeline container; align dot center on that baseline
            const baselineTop = -20; // px (this matches baseline top: "30px")
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
