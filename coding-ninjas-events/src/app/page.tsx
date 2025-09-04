"use client"

import * as React from "react"
import { motion, useScroll, useTransform } from "framer-motion"
import { Poppins } from "next/font/google"

const inter = Poppins({ subsets: ["latin"], weight: ["400", "700"] })

export default function ScrollCardComponent() {
  const cards = [
    { id: 1, image: "https://picsum.photos/1200/900?random=1", month: "January", year: "2024" },
    { id: 2, image: "https://picsum.photos/1200/900?random=2", month: "February", year: "2024" },
    { id: 3, image: "https://picsum.photos/1200/900?random=3", month: "March", year: "2024" },
    { id: 4, image: "https://picsum.photos/1200/900?random=4", month: "April", year: "2024" },
  ]

  const SEGMENT_VH = 300 // scroll height per card
  const wrapperRef = React.useRef<HTMLDivElement>(null)

  // Track scroll progress relative to wrapper
  const { scrollYProgress } = useScroll({
    target: wrapperRef,
    offset: ["start start", "end end"],
  })

  // Map scroll to card index (0 to last card)
  const cardProgress = useTransform(scrollYProgress, [0, 1], [0, cards.length])

  // Build transforms for each card
  const transforms = cards.map((_, i) => {
    const incomingY = useTransform(cardProgress, [i, i + 1], [800, 0]) // enter from bottom
    const pushDownY = useTransform(cardProgress, [i + 1, i + 2], [0, 60]) // pushed down by next
    const scaleIn = useTransform(cardProgress, [i, i + 0.3], [0.95, 1]) // scale in
    const scaleOut = useTransform(cardProgress, [i + 1, i + 2], [1, 0.85]) // shrink out
    const rotate = useTransform(cardProgress, [i, i + 0.5], [2, 0]) // slight rotation
    const dateOpacity = useTransform(cardProgress, [i + 0.6, i + 1.4], [1, 0]) // fade out date

    const y = useTransform(() => incomingY.get() + pushDownY.get())
    const scale = useTransform(() => scaleIn.get() * scaleOut.get())
    const zIndex = useTransform(cardProgress, (p) =>
      p >= i && p < i + 1 ? 1000 + i : i
    )

    return { y, scale, rotate, zIndex, dateOpacity }
  })

  // Fade in date for last card
  const lastCardDateOpacity = useTransform(
    cardProgress,
    [cards.length - 0.2, cards.length],
    [0, 1]
  )

  const CARD_WIDTH = "min(1200px, 70vw)"
  const CARD_HEIGHT = "min(900px, 70vh)"

  return (
    <div style={{ backgroundColor: "#000", minHeight: "100vh" }} className={inter.className}>
      {/* Scroll wrapper with total height */}
      <div
        ref={wrapperRef}
        style={{ height: `${cards.length * SEGMENT_VH}vh`, position: "relative" }}
      >
        {/* Sticky container for dates and cards */}
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
  const t = transforms[i] // transforms for current card
  const isLastCard = i === cards.length - 1 // check if it's the final card

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
                    alt=""
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                    }}
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
