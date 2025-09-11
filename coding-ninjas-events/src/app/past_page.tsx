"use client"
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import timelineData from './data.json';

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
  return function(i: number) {
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
  const allYears = useMemo(() => Array.from(new Set(timelineEvents.map(e => e.year))).sort(), [timelineEvents]);

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

  // --- Timeline layout generation ---
  const getTimelineStructure = useCallback(() => {
    const structure: Array<{ type: 'detailed' | 'collapsed'; year: number; width: number }> = [];
    const focusIndex = allYears.indexOf(focusYear);
    const detailedStart = focusIndex;
    const detailedEnd = focusIndex;

    // collapsed years on left
    if (detailedStart > 0) {
      const leftYears = allYears.slice(0, detailedStart);
      leftYears.forEach(year => structure.push({ type: 'collapsed', year, width: 60 }));
    }

    // detailed (only focus year)
    for (let i = detailedStart; i <= detailedEnd; i++) {
      if (allYears[i] !== undefined) {
        structure.push({ type: 'detailed', year: allYears[i], width: 300 });
      }
    }

    // collapsed years on right
    if (detailedEnd < allYears.length - 1) {
      const rightYears = allYears.slice(detailedEnd + 1);
      rightYears.forEach(year => structure.push({ type: 'collapsed', year, width: 60 }));
    }

    return structure;
  }, [allYears, focusYear]);

  const timelineStructure = useMemo(() => getTimelineStructure(), [getTimelineStructure]);
  const totalWidth = useMemo(() => timelineStructure.reduce((acc, it) => acc + it.width, 0), [timelineStructure]);

  // compute event position in percent across the full timeline
  const getEventPosition = useCallback((event: TimelineEvent): number | null => {
    let currentPosition = 0;
    for (const section of timelineStructure) {
      const sectionStartPercent = (currentPosition / totalWidth) * 100;
      const sectionWidthPercent = (section.width / totalWidth) * 100;

      if (section.year === event.year) {
        if (section.type === 'detailed') {
          const monthIndex = Math.max(0, Math.min(11, months.indexOf(event.month)));
          const monthPercentWithinSection = (monthIndex / 11) * sectionWidthPercent;
          return sectionStartPercent + monthPercentWithinSection;
        } else {
          // collapsed: center of the collapsed block
          return sectionStartPercent + sectionWidthPercent / 2;
        }
      }
      currentPosition += section.width;
    }
    // not found
    return null;
  }, [timelineStructure, totalWidth]);

  // --- Scroll handling: move only 1 event per gesture (debounced) ---
  const handleScroll = useCallback((rawEvent: WheelEvent) => {
    // prevent default to avoid native page scrolling inside container
    rawEvent.preventDefault();

    const now = Date.now();
    const timeSinceLast = now - lastScrollTime.current;

    // ignore multiple wheel events that happen too close together (touchpads send many)
    if (timeSinceLast < 450) {
      return;
    }

    // single step only (1 up or down)
    const direction = rawEvent.deltaY > 0 ? 1 : -1;
    const newIndex = Math.max(0, Math.min(sortedEvents.length - 1, currentEventIndex + direction));

    if (newIndex !== currentEventIndex) {
      lastScrollTime.current = now;
      setCurrentEventIndex(newIndex);
      const newEvent = sortedEvents[newIndex];
      setSelectedEvent(newEvent);
      setFocusYear(newEvent.year);
      setIsScrolling(true);

      // clear previous timeout
      if (scrollTimeoutRef.current !== null) {
        window.clearTimeout(scrollTimeoutRef.current);
      }
      // after animation settle, clear scrolling state
      scrollTimeoutRef.current = window.setTimeout(() => {
        setIsScrolling(false);
        scrollTimeoutRef.current = null;
      }, 600);
    }
  }, [currentEventIndex, sortedEvents]);

  // keyboard navigation
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      const newIndex = Math.min(sortedEvents.length - 1, currentEventIndex + 1);
      if (newIndex !== currentEventIndex) {
        setCurrentEventIndex(newIndex);
        const newEvent = sortedEvents[newIndex];
        setSelectedEvent(newEvent);
        setFocusYear(newEvent.year);
      }
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      const newIndex = Math.max(0, currentEventIndex - 1);
      if (newIndex !== currentEventIndex) {
        setCurrentEventIndex(newIndex);
        const newEvent = sortedEvents[newIndex];
        setSelectedEvent(newEvent);
        setFocusYear(newEvent.year);
      }
    }
  }, [currentEventIndex, sortedEvents]);

  // attach listeners to container and window (cleanup correctly)
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // use non-passive to allow preventDefault
    container.addEventListener('wheel', handleScroll as EventListener, { passive: false } as AddEventListenerOptions);
      window.addEventListener('keydown', handleKeyDown);

      return () => {
      container.removeEventListener('wheel', handleScroll as EventListener);
        window.removeEventListener('keydown', handleKeyDown);
      if (scrollTimeoutRef.current !== null) {
        window.clearTimeout(scrollTimeoutRef.current);
        scrollTimeoutRef.current = null;
        }
      };
  }, [handleScroll, handleKeyDown]);

  // clicking an event focuses it
  const handleEventClick = (event: TimelineEvent) => {
    const index = sortedEvents.findIndex(e => e.id === event.id);
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
        <div style={{
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
          pointerEvents: "none"
        }}>
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
          <div style={{ 
            fontSize: "14px", 
            color: "#ff8800", 
            fontWeight: "500",
            marginBottom: "8px"
          }}>
            {hoveredEvent.month} {hoveredEvent.year}
          </div>
          <div style={{ 
            fontSize: "18px", 
            fontWeight: "600", 
            color: "#2d3748",
            marginBottom: "12px"
          }}>
            {hoveredEvent.title}
          </div>
          <div style={{ 
            fontSize: "14px", 
            color: "#4a5568",
            lineHeight: "1.4"
          }}>
            {hoveredEvent.description.substring(0, 100)}...
          </div>
        </div>
      )}

      {/* Event Detail Card */}
      <div style={{ flex: 1, overflow: "hidden", position: "relative", minHeight: "400px" }}>
        {selectedEvent && (
          <div style={{
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
            transition: "transform 0.3s ease, opacity 0.3s ease"
          }}>
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
            <div style={{ 
              flex: 1, 
              position: "relative", 
              display: "flex", 
              justifyContent: "center", 
              alignItems: "center",
              height: "100%" 
            }}>
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
                    animation: "scaleIn 0.6s ease-out 0.2s backwards"
                  }}
                />

                {/* small circles around big circle — deterministic positions & varied sizes */}
                {/* {smallCirclesForSelected.map((c, index) => {
                  return (
                    <img
                      key={index}
                      src={`https://picsum.photos/id/${c.imgId}/${Math.round(c.size)}/${Math.round(c.size)}`}
                      alt="Related"
                      style={{
                        position: "absolute",
             
                        width: `${c.size}px`,
                        height: `${c.size}px`,
                        borderRadius: "50%",
                        top: `calc(50% + ${c.y}px - ${c.size / 2}px)`,
                        left: `calc(50% + ${c.x}px - ${c.size / 2}px)`,
                        boxShadow: "0 8px 20px rgba(0,0,0,0.15)",
                        objectFit: "cover",
                        animation: `floatIn${index} 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) ${0.1 + index * 0.02}s backwards`
                      }}
                    />
                  );
                })} */}

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
                  {smallCirclesForSelected.map((_, i) => `
                    @keyframes floatIn${i} {
                      from {
                        transform: scale(0) translateY(-10px);
                        opacity: 0;
                      }
                      to {
                        transform: scale(1) translateY(0);
                        opacity: 1;
                      }
                    }
                  `).join('\n')}
                </style>
              </div>
            </div>
            {/* Right Section - Content */}
            <div style={{ 
              flex: 1, 
              display: "flex", 
              flexDirection: "column", 
              justifyContent: "center", 
              height: "100%",
              paddingLeft: "60px" 
            }}>
              <div style={{ 
                fontSize: "36px", 
                fontWeight: "700", 
                marginBottom: "18px",
                color: "#ff8800",
                textAlign: "center",
                letterSpacing: "1px",
                animation: "slideInRight 0.6s ease-out 0.3s backwards"
              }}>
                {selectedEvent.month} {selectedEvent.year}
              </div>
              <div style={{ 
                fontSize: "32px", 
                fontWeight: "700", 
                marginBottom: "18px",
                color: "#fff",
                textAlign: "left",
                lineHeight: "1.2",
                animation: "slideInRight 0.6s ease-out 0.4s backwards"
              }}>
                {selectedEvent.title}
              </div>
              <div style={{ 
                fontSize: "20px", 
                color: "#ff8800",
                lineHeight: "1.7",
                animation: "slideInRight 0.6s ease-out 0.5s backwards"
              }}>
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
      <div style={{ 
        height: 120,
        backdropFilter: "blur(14px)",
        position: "relative",
        borderRadius: 16,
        padding: "22px 28px",
        overflow: "hidden",
      }}>
        {/* baseline */}
        <div style={{ 
          position: "relative", 
          height: "6px", 
          background: "linear-gradient(90deg, rgba(255,255,255,0.2) 0%, rgba(255,255,255,0.4) 50%, rgba(255,255,255,0.2) 100%)", 
          top: "30px",
          borderRadius: "3px",
          transition: "all 0.6s cubic-bezier(0.4, 0, 0.2, 1)",
          zIndex: 2
        }}>

          {/* timeline sections */}
          {timelineStructure.map((section, sectionIndex) => {
            let currentX = 0;
            for (let i = 0; i < sectionIndex; i++) currentX += timelineStructure[i].width;
            const leftPercent = (currentX / totalWidth) * 100;
            const widthPercent = (section.width / totalWidth) * 100;

            const isDetailed = section.type === 'detailed';
            const isFocus = isDetailed && section.year === focusYear;

            return (
              <div key={`${section.type}-${section.year}-${sectionIndex}`} style={{
                position: "absolute",
                left: `${leftPercent}%`,
                width: `${widthPercent}%`,
                height: "100%",
                transition: "all 0.6s cubic-bezier(0.2,0.9,0.2,1)",
              }}>
                {/* detailed year block */}
                {isDetailed && (
                  <>
                    {/* Month ticks (positioned between year label and baseline) */}
                    {Array.from({ length: 12 }, (_, monthIndex) => {
                      const monthPosition = (monthIndex / 11) * 100;
                      return (
                        <div key={`m-${section.year}-${monthIndex}`} style={{
                          position: "absolute",
                          left: `${monthPosition}%`,
                          top: -7,        
                          width: 2,
                          height: 18,
                          background: "rgba(255,255,255,0.26)",
                          transform: "translateX(-50%)",
                        }}>
                        </div>
                      );
                    })}

                    {/* Month labels for the focus year only -> show alternate (full) names */}
                    {section.year === focusYear && months.map((m, monthIndex) => {
                      const monthPosition = (monthIndex / 11) * 100;
                      return (
                        <div key={`label-${section.year}-${monthIndex}`} style={{
                          position: "absolute",
                          left: `${monthPosition}%`,
                      
                          top: 16,                 // below baseline, between baseline and year
                          transform: "translateX(-50%)",
                          fontSize: 10,
                          color: "rgba(255,255,255,0.7)",
                          fontWeight: 500,
                          whiteSpace: "nowrap",
                        }}>
                          {m}
                        </div>
                      );
                    })}

                    {/* Year label placed at bottom of the section (per your request) */}
                    <div style={{ 
                      position: "absolute",
                      left: "50%",
                      top: 82,
                      transform: "translateX(-50%)",
                      fontSize: isFocus ? 20 : 14,
                      fontWeight: 800,
                      color: isFocus ? "#fff" : "rgba(255,255,255,0.7)",
                      textShadow: isFocus ? "0 0 20px rgba(102,126,234,0.65)" : "none",
                    }}>
                      {section.year}
                    </div>

                    {/* Year vertical indicator (between baseline and year label) */}
                    <div style={{
                      position: "absolute",
                      left: "10%",
                      top: "-12px",
                      width: section.year === focusYear ? "4px" : "2px",
                      height: section.year === focusYear ? "30px" : "24px",
                      background: section.year === focusYear 
                        ? "linear-gradient(180deg, #667eea 0%, rgba(102,126,234,0.4) 100%)" 
                        : "rgba(255,255,255,0.5)",
                      borderRadius: "2px",
                      transition: "all 0.4s ease",
                      boxShadow: section.year === focusYear ? "0 0 20px rgba(102,126,234,0.6)" : "none"
                    }} />

                    {/* Month markers for detailed years — placed between years, evenly spaced, aligned to baseline */}
                 
                  </>
                )}

                {/* Collapsed Years */}
                {section.type === 'collapsed' && (
                  <>
                    <div 
                      onClick={() => {
                        setFocusYear(section.year);
                        const eventsInYear = sortedEvents.filter(e => e.year === section.year);
                        if (eventsInYear.length > 0) {
                          const index = sortedEvents.findIndex(e => e.id === eventsInYear[0].id);
                          setCurrentEventIndex(index);
                          setSelectedEvent(eventsInYear[0]);
                        }
                      }}
                      style={{
                        position: "absolute",
                        left: "50%",
                        top: "30px",
                        fontSize: "14px",
                        fontWeight: "500",
                        color: "rgba(255,255,255,0.6)",
                        transform: "translateX(-50%)",
                        whiteSpace: "nowrap",
                        cursor: "pointer",
                        transition: "all 0.3s ease"
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.color = "rgba(255,255,255,0.9)";
                        e.currentTarget.style.transform = "translateX(-50%) scale(1.1)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.color = "rgba(255,255,255,0.6)";
                        e.currentTarget.style.transform = "translateX(-50%) scale(1)";
                      }}
                    >
                      {section.year}
                    </div>
                    <div style={{
                      position: "absolute",
                      left: "50%",
                      top: "-10px",
                      width: "4px",
                      height: "22px",
                      background: "rgba(255,255,255,0.4)",
                      borderRadius: "1px",
                      transform: "translateX(-50%)",
                      transition: "all 0.3s ease"
                    }} />
                  </>
                )}
              </div>
            );
          })}

          {/* Event Dots — now orange, aligned to month baseline exactly */}
          {timelineEvents.map((event) => {
            const position = getEventPosition(event);
            if (position === null) return null;

            const isSelected = selectedEvent?.id === event.id;
            const isInFocusYear = event.year === focusYear;
            const isInNextYear = event.year === focusYear + 1;
            const isInDetailedRange = isInFocusYear || isInNextYear;

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
            } else if (isInNextYear) {
              size = 12;
              opacity = 0.9;
              zIndex = 30;
            } else if (isInDetailedRange) {
              size = 10;
              opacity = 0.85;
              zIndex = 20;
            }

            // baseline top is 30px in the timeline container; align dot center on that baseline
            const baselineTop = -30; // px
            const topPx = baselineTop - size / 2;

            return (
              <div
                key={event.id}
                onClick={() => handleEventClick(event)}
                onMouseEnter={(e) => {
                  handleEventHover(event, e);
                  if (!isSelected) {
                    e.currentTarget.style.transform = "translateX(-50%) scale(1.25)";
                    e.currentTarget.style.filter = "brightness(1.2)";
                  }
                }}
                onMouseLeave={(e) => {
                  handleEventHover(null);
                  if (!isSelected) {
                    e.currentTarget.style.transform = "translateX(-50%) scale(1)";
                    e.currentTarget.style.filter = "brightness(1)";
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
                    : isInNextYear
                    ? "radial-gradient(circle, #fff 30%, #ffb86b 100%)"
                    : "radial-gradient(circle, rgba(255,200,120,0.9) 30%, rgba(255,150,60,0.9) 100%)",
                  borderRadius: "50%",
                  cursor: "pointer",
                  transform: "translateX(-50%)",
                  border: isSelected 
                    ? "3px solid #fff"
                    : isInFocusYear
                    ? "2px solid rgba(255,255,255,0.9)"
                    : isInDetailedRange
                    ? "2px solid rgba(255,255,255,0.7)"
                    : "1px solid rgba(255,255,255,0.5)",
                  boxShadow: isSelected 
                    ? "0 0 40px rgba(255,136,0,0.9), 0 0 20px rgba(255,255,255,0.8), 0 4px 15px rgba(0,0,0,0.3)" 
                    : "0 0 10px rgba(255,136,0,0.45)",
                  transition: "all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)",
                  zIndex: zIndex,
                  opacity: opacity,
                  animation: isSelected ? "pulse 2s ease-in-out infinite" : "none",
                  filter: "brightness(1)"
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

      {/* Instructions (kept empty per your style) */}
      <div style={{
        position: "fixed",
        bottom: "30px",
        left: "50%",
        transform: "translateX(-50%)",
        display: "flex",
        gap: "30px",
        fontSize: "12px",
        color: "rgba(255,255,255,0.4)",
        zIndex: 90
      }}>
      </div>
    </div>
  );
}
