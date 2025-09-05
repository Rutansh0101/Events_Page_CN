"use client"

import React, { useState, useEffect, useRef } from "react"
import {
  motion,
  useScroll,
  useTransform,
  useMotionValue,
  MotionValue,
} from "framer-motion"

// Define type for a card
interface Card {
  id: number
  image: string
  month: string
  year: string
}

export default function ScrollCardComponent() {
  // Initial cards
  const cards: Card[] = [
    { id: 1, image: "https://picsum.photos/1200/900?random=1", month: "January", year: "2024" },
    { id: 2, image: "https://picsum.photos/1200/900?random=2", month: "February", year: "2024" },
    { id: 3, image: "https://picsum.photos/1200/900?random=3", month: "March", year: "2024" },
    { id: 4, image: "https://picsum.photos/1200/900?random=4", month: "April", year: "2024" },
    { id: 5, image: "https://picsum.photos/1200/900?random=5", month: "May", year: "2024" },
    { id: 6, image: "https://picsum.photos/1200/900?random=6", month: "June", year: "2024" },
  ]

  // State for mobile deck
  const [mobileCards, setMobileCards] = useState<Card[]>(cards)

  // Track screen size for desktop/mobile switch
  const [isDesktop, setIsDesktop] = useState<boolean>(true)

  // Reference for scroll container (desktop only)
  const wrapperRef = useRef<HTMLDivElement | null>(null)

  // Framer Motion scroll progress (desktop only)
  const { scrollYProgress } = useScroll({
    target: wrapperRef,
    offset: ["start start", "end end"],
  })

  // Convert scroll position into "card index" progress
  const cardProgress = useTransform(scrollYProgress, [0, 1], [0, cards.length])

  // Screen size listener
  useEffect(() => {
    const checkScreenSize = () => {
      setIsDesktop(window.innerWidth >= 768)
    }

    checkScreenSize()
    window.addEventListener("resize", checkScreenSize)
    return () => window.removeEventListener("resize", checkScreenSize)
  }, [])

  // Motion transforms for desktop card animations
  const transforms = cards.map((_, i) => {
    const incomingY = useTransform(cardProgress, [i, i + 1], [800, 0])
    const pushDownY = useTransform(cardProgress, [i + 1, i + 2], [0, 60])
    const scaleIn = useTransform(cardProgress, [i, i + 0.3], [0.95, 1])
    const scaleOut = useTransform(cardProgress, [i + 1, i + 2], [1, 0.85])
    const rotate = useTransform(cardProgress, [i, i + 0.5], [2, 0])
    const dateOpacity = useTransform(cardProgress, [i + 0.6, i + 1.4], [1, 0])

    const y = useTransform(() => incomingY.get() + pushDownY.get())
    const scale = useTransform(() => scaleIn.get() * scaleOut.get())
    const zIndex = useTransform(cardProgress, (p) =>
      p >= i && p < i + 1 ? 1000 + i : i
    )

    return { y, scale, rotate, zIndex, dateOpacity }
  })

  // Special handling for last card’s date fade-in
  const lastCardDateOpacity = useTransform(
    cardProgress,
    [cards.length - 0.2, cards.length],
    [0, 1]
  )

  /**
   * Handle swipe logic on mobile:
   * - Swipe right → put card at the back
   * - Swipe left → remove card forever
   */
  const handleSwipe = (cardIndex: number, direction: "right" | "left") => {
    if (direction === "right") {
      setTimeout(() => {
        setMobileCards((prevCards) => {
          const newCards = [...prevCards]
          const [removedCard] = newCards.splice(cardIndex, 1)
          return [...newCards, removedCard]
        })
      }, 300)
    } else {
      setTimeout(() => {
        setMobileCards((prevCards) =>
          prevCards.filter((_, index) => index !== cardIndex)
        )
      }, 300)
    }
  }

  /**
   * A single swipeable card (mobile only).
   * Uses x motion value to calculate rotation, opacity, and swipe detection.
   */
  const SwipeableCard: React.FC<{ card: Card; index: number }> = ({ card, index }) => {
    const x = useMotionValue(0)
    const rotate = useTransform(x, [-300, 0, 300], [-30, 0, 30])
    const opacity = useTransform(x, [-250, -150, 0, 150, 250], [0.5, 0.8, 1, 0.8, 0.5])
    const dateOpacity = useTransform(x, [-200, -100, 0, 100, 200], [0.3, 0.7, 1, 0.7, 0.3])

    // Stack positioning
    const stackOffset = index * 4
    const stackScale = 1 - index * 0.03
    const stackRotate = index * 1

    const handleDragEnd = (
      _: MouseEvent | TouchEvent | PointerEvent,
      info: { offset: { x: number } }
    ) => {
      const threshold = 120
      if (Math.abs(info.offset.x) > threshold && index === 0) {
        const direction = info.offset.x > 0 ? "right" : "left"
        const exitX = info.offset.x > 0 ? 1000 : -1000
        x.set(exitX) // Push off-screen
        handleSwipe(index, direction)
      } else {
        x.set(0) // Snap back if not enough swipe
      }
    }

    return (
      <motion.div
        style={{
          position: "absolute",
          width: "100%",
          height: "100%",
          x: index === 0 ? (x as MotionValue<number>) : 0,
          rotate: index === 0 ? rotate : stackRotate,
          opacity: index === 0 ? opacity : Math.max(0.4, 1 - index * 0.2),
          scale: stackScale,
          zIndex: 1000 - index,
          y: -stackOffset,
          borderRadius: 16,
          overflow: "hidden",
          boxShadow:
            index === 0
              ? "0 25px 50px rgba(0,0,0,0.5), 0 10px 20px rgba(0,0,0,0.3)"
              : "0 10px 30px rgba(0,0,0,0.3)",
          cursor: index === 0 ? "grab" : "default",
        }}
        drag={index === 0 ? "x" : false}
        dragConstraints={{ left: -300, right: 300 }}
        dragElastic={0.2}
        onDragEnd={handleDragEnd}
        whileDrag={{
          cursor: "grabbing",
          scale: 1.05,
          boxShadow: "0 30px 60px rgba(0,0,0,0.6), 0 15px 25px rgba(0,0,0,0.4)",
        }}
      >
        {/* Background image */}
        <img
          src={card.image}
          alt={`${card.month} ${card.year}`}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            pointerEvents: "none",
            userSelect: "none",
          }}
        />

        {/* Date label in top-right */}
        <motion.div
          style={{
            position: "absolute",
            top: 20,
            right: 20,
            textAlign: "center",
            color: "#ffffff",
            opacity: index === 0 ? dateOpacity : 0.8,
            background: "rgba(0,0,0,0.6)",
            backdropFilter: "blur(10px)",
            borderRadius: 12,
            padding: "12px 16px",
            border: "1px solid rgba(255,255,255,0.1)",
          }}
        >
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: "4px" }}>
            {card.month}
          </div>
          <div
            style={{
              width: "24px",
              height: "1px",
              backgroundColor: "#ffffff",
              margin: "0 auto 4px auto",
              opacity: 0.8,
            }}
          />
          <div style={{ fontSize: 12, color: "#cccccc" }}>{card.year}</div>
        </motion.div>
      </motion.div>
    )
  }

  const CARD_WIDTH = "min(1200px, 70vw)"
  const CARD_HEIGHT = "min(900px, 70vh)"
  const MOBILE_CARD_WIDTH = "90vw"
  const MOBILE_CARD_HEIGHT = "70vh"

  // ---------------- MOBILE LAYOUT ----------------
  if (!isDesktop) {
    return (
      <div
        style={{
          backgroundColor: "#000",
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "20px",
        }}
      >
        <div
          style={{
            position: "relative",
            width: MOBILE_CARD_WIDTH,
            height: MOBILE_CARD_HEIGHT,
            maxWidth: "400px",
            perspective: "1000px",
          }}
        >
          {mobileCards.length > 0 ? (
            mobileCards.slice(0, 4).map((card, index) => (
              <SwipeableCard key={card.id} card={card} index={index} />
            ))
          ) : (
            <div
              style={{
                width: "100%",
                height: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#666",
                fontSize: 18,
                textAlign: "center",
                background: "rgba(255,255,255,0.05)",
                borderRadius: 16,
                border: "2px dashed rgba(255,255,255,0.2)",
              }}
            >
              No more cards
            </div>
          )}
        </div>

        {/* Instructions + remaining cards count */}
        <motion.div
          style={{
            marginTop: 30,
            textAlign: "center",
            color: "#888",
            fontSize: 14,
          }}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <div style={{ marginBottom: 8 }}>
            <span style={{ color: "#2ed573", fontWeight: 600 }}>Swipe right</span>{" "}
            to keep •{" "}
            <span style={{ color: "#ff4757", fontWeight: 600 }}>Swipe left</span>{" "}
            to delete
          </div>
          <div style={{ fontSize: 12, opacity: 0.6 }}>
            Cards remaining: {mobileCards.length}
          </div>
        </motion.div>
      </div>
    )
  }

  // ---------------- DESKTOP LAYOUT ----------------
  return (
    <div style={{ backgroundColor: "#000", minHeight: "100vh" }}>
      <div
        ref={wrapperRef}
        style={{ height: `${cards.length * 300}vh`, position: "relative" }}
      >
        <div
          style={{
            position: "sticky",
            top: 0,
            height: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "4rem",
          }}
        >
          {/* Date stack */}
          <motion.div
            style={{
              position: "relative",
              height: CARD_HEIGHT,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              minWidth: "200px",
              textAlign: "center",
            }}
          >
            {cards.map((c, i) => {
              const t = transforms[i]
              const isLastCard = i === cards.length - 1
              return (
                <motion.div
                  key={c.id + "-date"}
                  style={{
                    position: "absolute",
                    y: t.y,
                    zIndex: t.zIndex,
                    textAlign: "center",
                    opacity: isLastCard ? lastCardDateOpacity : t.dateOpacity,
                    color: "#ffffff",
                    width: "100%",
                  }}
                >
                  <div style={{ fontSize: 42, fontWeight: 700, marginBottom: "8px" }}>
                    {c.month}
                  </div>
                  <div
                    style={{
                      width: "80px",
                      height: "2px",
                      backgroundColor: "#ffffff",
                      margin: "0 auto 8px auto",
                    }}
                  />
                  <div style={{ fontSize: 28, color: "#cccccc" }}>{c.year}</div>
                </motion.div>
              )
            })}
          </motion.div>

          {/* Image card stack */}
          <div style={{ position: "relative", width: CARD_WIDTH, height: CARD_HEIGHT }}>
            {cards.map((c, i) => {
              const t = transforms[i]
              return (
                <motion.div
                  key={c.id}
                  style={{
                    position: "absolute",
                    inset: 0,
                    borderRadius: 8,
                    y: t.y,
                    scale: t.scale,
                    rotate: t.rotate,
                    zIndex: t.zIndex,
                    boxShadow: "0 20px 60px rgba(0,0,0,0.4)",
                    overflow: "hidden",
                  }}
                  transition={{ ease: "easeInOut", duration: 0.6 }}
                >
                  <img
                    src={c.image}
                    alt={`${c.month} ${c.year}`}
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                </motion.div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
