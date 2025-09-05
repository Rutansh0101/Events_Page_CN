"use client"

import * as React from "react"
import { motion, useScroll, useTransform, AnimatePresence } from "framer-motion"
import { Poppins } from "next/font/google"

// Load Poppins font
const inter = Poppins({ subsets: ["latin"], weight: ["400", "700"] })

export default function ScrollCardComponent() {
  const [isMobile, setIsMobile] = React.useState(false)
  const [selectedCard, setSelectedCard] = React.useState<any>(null)

  // Detect screen size to adjust layout for mobile
  React.useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768)
    checkMobile()
    window.addEventListener("resize", checkMobile)
    return () => window.removeEventListener("resize", checkMobile)
  }, [])

  // Card data with images, date, and description
  const cards = [
    { 
      id: 1,
      image: "https://picsum.photos/1200/900?random=1",
      month: "January",
      year: "2024",
      title: "Winter Wonderland",
      description: "A magical winter landscape captured during the first snowfall of the year. The pristine snow blankets everything in sight, creating a serene and peaceful atmosphere that marks the beginning of a new year filled with possibilities."
    },
    { 
      id: 2,
      image: "https://picsum.photos/1200/900?random=2",
      month: "February",
      year: "2024",
      title: "Love in Bloom",
      description: "Valentine's month brings warmth to the coldest time of year. This photograph captures the essence of love and connection, with delicate details that remind us of the beauty found in intimate moments and shared experiences."
    },
    { 
      id: 3,
      image: "https://picsum.photos/1200/900?random=3",
      month: "March",
      year: "2024",
      title: "Spring Awakening",
      description: "As winter fades away, nature begins its spectacular transformation. This image showcases the first signs of spring - fresh growth, renewed energy, and the promise of warmer days ahead filled with vibrant colors and new beginnings."
    },
    { 
      id: 4,
      image: "https://picsum.photos/1200/900?random=4",
      month: "April",
      year: "2024",
      title: "Blooming Beauty",
      description: "April showers bring May flowers, and this stunning capture embodies the full bloom of spring. Every detail speaks to the renewal of life, the power of growth, and the incredible beauty that emerges when nature awakens from its slumber."
    },
  ]

  const SEGMENT_VH = 300 // Scroll height per card
  const wrapperRef = React.useRef<HTMLDivElement>(null)

  // Track scroll position relative to wrapper
  const { scrollYProgress } = useScroll({
    target: wrapperRef,
    offset: ["start start", "end end"],
  })

  // Map scroll progress to card index range
  const cardProgress = useTransform(scrollYProgress, [0, 1], [0, cards.length])

  // Compute transforms for each card
  const transforms = cards.map((_, i) => {
    const incomingY = useTransform(cardProgress, [i, i + 1], [800, 0])
    const pushDownY = useTransform(cardProgress, [i + 1, i + 2], [0, 60])
    const scaleIn = useTransform(cardProgress, [i, i + 0.3], [0.95, 1])
    const scaleOut = useTransform(cardProgress, [i + 1, i + 2], [1, 0.85])
    const rotate = useTransform(cardProgress, [i, i + 0.5], [2, 0])
    const dateOpacity = useTransform(cardProgress, [i + 0.6, i + 1.4], [1, 0])

    // Combine transformations
    const y = useTransform(() => incomingY.get() + pushDownY.get())
    const scale = useTransform(() => scaleIn.get() * scaleOut.get())
    const zIndex = useTransform(cardProgress, (p) =>
      p >= i && p < i + 1 ? 1000 + i : i
    )

    return { y, scale, rotate, zIndex, dateOpacity }
  })

  // Fade-in for the last card's date
  const lastCardDateOpacity = useTransform(
    cardProgress,
    [cards.length - 0.2, cards.length],
    [0, 1]
  )

  const CARD_WIDTH = isMobile ? "90vw" : "min(1200px, 70vw)"
  const CARD_HEIGHT = isMobile ? "70vh" : "min(900px, 70vh)"

  // Handle card click (open modal)
  const handleCardClick = (card: any) => setSelectedCard(card)

  // Handle modal close
  const handleCloseModal = () => setSelectedCard(null)

  // Handle backdrop click (close modal if clicked outside content)
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) handleCloseModal()
  }

  // Prevent body scroll when modal is open
  React.useEffect(() => {
    if (selectedCard) {
      document.body.style.overflow = "hidden"
    } else {
      document.body.style.overflow = "unset"
    }
    return () => {
      document.body.style.overflow = "unset"
    }
  }, [selectedCard])

  return (
    <div style={{ backgroundColor: "#000", minHeight: "100vh" }} className={inter.className}>
      {/* Scrollable wrapper with dynamic height */}
      <div
        ref={wrapperRef}
        style={{ height: `${cards.length * SEGMENT_VH}vh`, position: "relative" }}
      >
        {/* Sticky container keeps cards and dates in place */}
        <div
          style={{
            position: "sticky",
            top: 0,
            height: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: isMobile ? "0" : "4rem",
          }}
        >
          {/* Date stack (shown only on desktop) */}
          {!isMobile && (
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
          )}

          {/* Card stack with images */}
          <div style={{ position: "relative", width: CARD_WIDTH, height: CARD_HEIGHT }}>
            {cards.map((c, i) => {
              const t = transforms[i]
              const isLastCard = i === cards.length - 1
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
                    cursor: "pointer",
                  }}
                  transition={{ ease: "easeInOut", duration: 0.6 }}
                  whileHover={{ scale: 1.02 }} // simple hover effect (fixed from invalid hook usage)
                  whileTap={{ scale: 0.98 }}   // simple tap effect
                  onClick={() => handleCardClick(c)}
                >
                  <img
                    src={c.image}
                    alt={c.title}
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />

                  {/* Date overlay for mobile view */}
                  {isMobile && (
                    <motion.div
                      style={{
                        position: "absolute",
                        top: "20px",
                        right: "20px",
                        textAlign: "right",
                        color: "#ffffff",
                        opacity: isLastCard ? lastCardDateOpacity : t.dateOpacity,
                        zIndex: 10,
                        textShadow: "2px 2px 4px rgba(0,0,0,0.8)",
                      }}
                    >
                      <div style={{ fontSize: 24, fontWeight: 700, marginBottom: "4px" }}>
                        {c.month}
                      </div>
                      <div
                        style={{
                          width: "40px",
                          height: "2px",
                          backgroundColor: "#ffffff",
                          marginLeft: "auto",
                          marginBottom: "4px",
                        }}
                      />
                      <div style={{ fontSize: 18, color: "#cccccc" }}>{c.year}</div>
                    </motion.div>
                  )}
                </motion.div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Modal overlay for card details */}
      <AnimatePresence>
        {selectedCard && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            style={{
              position: "fixed",
              inset: 0,
              backgroundColor: "rgba(0, 0, 0, 0.9)",
              backdropFilter: "blur(10px)",
              zIndex: 10000,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: isMobile ? "20px" : "40px",
            }}
            onClick={handleBackdropClick}
          >
            {/* Modal content */}
            <motion.div
              initial={{ scale: 0.8, opacity: 0, y: 50 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.8, opacity: 0, y: 50 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
              style={{
                backgroundColor: "#1a1a1a",
                borderRadius: "16px",
                overflow: "hidden",
                maxWidth: isMobile ? "100%" : "900px",
                maxHeight: "90vh",
                width: "100%",
                position: "relative",
                boxShadow: "0 25px 80px rgba(0, 0, 0, 0.6)",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Close button */}
              <motion.button
                whileHover={{ scale: 1.1, backgroundColor: "rgba(255, 255, 255, 0.2)" }}
                whileTap={{ scale: 0.9 }}
                onClick={handleCloseModal}
                style={{
                  position: "absolute",
                  top: "20px",
                  right: "20px",
                  width: "40px",
                  height: "40px",
                  borderRadius: "50%",
                  backgroundColor: "rgba(255, 255, 255, 0.1)",
                  border: "none",
                  color: "#ffffff",
                  fontSize: "20px",
                  cursor: "pointer",
                  zIndex: 10,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  backdropFilter: "blur(10px)",
                }}
              >
                ×
              </motion.button>

              {/* Modal content split into image and text */}
              <div style={{ 
                display: "flex", 
                flexDirection: isMobile ? "column" : "row",
                height: isMobile ? "auto" : "600px"
              }}>
                {/* Image section */}
                <div style={{ 
                  flex: isMobile ? "none" : "1.5",
                  height: isMobile ? "300px" : "100%",
                  overflow: "hidden"
                }}>
                  <motion.img
                    initial={{ scale: 1.1 }}
                    animate={{ scale: 1 }}
                    transition={{ duration: 0.6, ease: "easeOut" }}
                    src={selectedCard.image}
                    alt={selectedCard.title}
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                </div>

                {/* Text section */}
                <motion.div
                  initial={{ x: isMobile ? 0 : 50, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ duration: 0.5, delay: 0.2, ease: "easeOut" }}
                  style={{
                    flex: 1,
                    padding: isMobile ? "30px 20px" : "40px",
                    color: "#ffffff",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "center",
                  }}
                >
                  {/* Date */}
                  <motion.div
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ duration: 0.4, delay: 0.3 }}
                    style={{
                      fontSize: isMobile ? "14px" : "16px",
                      color: "#999999",
                      marginBottom: "10px",
                      textTransform: "uppercase",
                      letterSpacing: "1px",
                    }}
                  >
                    {selectedCard.month} {selectedCard.year}
                  </motion.div>

                  {/* Title */}
                  <motion.h2
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ duration: 0.4, delay: 0.4 }}
                    style={{
                      fontSize: isMobile ? "28px" : "36px",
                      fontWeight: 700,
                      marginBottom: "20px",
                      lineHeight: "1.2",
                    }}
                  >
                    {selectedCard.title}
                  </motion.h2>

                  {/* Divider */}
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: "60px" }}
                    transition={{ duration: 0.6, delay: 0.5 }}
                    style={{
                      height: "3px",
                      backgroundColor: "#ffffff",
                      marginBottom: "20px",
                    }}
                  />

                  {/* Description */}
                  <motion.p
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ duration: 0.4, delay: 0.6 }}
                    style={{
                      fontSize: isMobile ? "16px" : "18px",
                      lineHeight: "1.6",
                      color: "#cccccc",
                      margin: 0,
                    }}
                  >
                    {selectedCard.description}
                  </motion.p>
                </motion.div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
