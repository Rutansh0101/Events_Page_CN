"use client"

import * as React from "react"
import { motion, useScroll, useTransform, AnimatePresence } from "framer-motion"
import { Poppins } from "next/font/google"

// Load Poppins font
const inter = Poppins({ subsets: ["latin"], weight: ["400", "700"] })

export default function ScrollCardComponent() {
  const [isMobile, setIsMobile] = React.useState(false)
  const [selectedCard, setSelectedCard] = React.useState<any>(null)

  // Screen size detection for responsive layout
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

  const SEGMENT_VH = 300 // Vertical height per card segment
  const wrapperRef = React.useRef<HTMLDivElement>(null)

  // Track scroll position within wrapper
  const { scrollYProgress } = useScroll({
    target: wrapperRef,
    offset: ["start start", "end end"],
  })

  // Map scroll to card progress (0 to cards.length)
  const cardProgress = useTransform(scrollYProgress, [0, 1], [0, cards.length])

  // Calculate transformations for each card based on scroll position
  const transforms = cards.map((_, i) => {
    // Card enters from bottom (y=800 to y=0)
    const incomingY = useTransform(cardProgress, [i, i + 1], [800, 0])
    // Card gets pushed down as next card enters
    const pushDownY = useTransform(cardProgress, [i + 1, i + 2], [0, 60])
    // Card scales up as it enters
    const scaleIn = useTransform(cardProgress, [i, i + 0.3], [0.95, 1])
    // Card scales down as it exits
    const scaleOut = useTransform(cardProgress, [i + 1, i + 2], [1, 0.85])
    // Card rotates slightly as it enters
    const rotate = useTransform(cardProgress, [i, i + 0.5], [2, 0])
    // Date opacity fades in/out with card
    const dateOpacity = useTransform(cardProgress, [i + 0.6, i + 1.4], [1, 0])

    // Combine transformations
    const y = useTransform(() => incomingY.get() + pushDownY.get())
    const scale = useTransform(() => scaleIn.get() * scaleOut.get())
    const zIndex = useTransform(cardProgress, (p) =>
      p >= i && p < i + 1 ? 1000 + i : i
    )

    return { y, scale, rotate, zIndex, dateOpacity }
  })

  // Last card's date opacity fades in at the end of scroll
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

  // Prevent scrolling when modal is open
  React.useEffect(() => {
    document.body.style.overflow = selectedCard ? "hidden" : "unset"
    return () => { document.body.style.overflow = "unset" }
  }, [selectedCard])

  return (
    <div style={{ backgroundColor: "#000", minHeight: "100vh" }} className={inter.className}>
      {/* Scrollable container */}
      <div
        ref={wrapperRef}
        style={{ height: `${cards.length * SEGMENT_VH}vh`, position: "relative" }}
      >
        {/* Sticky container for cards and dates */}
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
          {/* Date column (desktop only) */}
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

          {/* Card stack */}
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
                  }}
                  transition={{ ease: "easeInOut", duration: 0.6 }}
                  onClick={() => handleCardClick(c)}
                >
                  <img
                    src={c.image}
                    alt={c.title}
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />

                  {/* Mobile date overlay */}
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

      {/* Modal */}
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
              backdropFilter: "blur(5px)",
              zIndex: 10000,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: isMobile ? "20px" : "40px",
              overflowY: "auto"
            }}
            onClick={handleBackdropClick}
          >
            {/* Modal content */}
            <motion.div
              initial={{ scale: 0.8, opacity: 0, y: 50 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.8, opacity: 0, y: 50 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              style={{
                backgroundColor: "#1a1a1a",
                borderRadius: "16px",
                overflow: "hidden",
                maxWidth: isMobile ? "100%" : "900px",
                width: "100%",
                position: "relative",
                boxShadow: "0 25px 80px rgba(0, 0, 0, 0.6)",
                maxHeight: isMobile ? "none" : "90vh",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Content container with blurred background image */}
              <div style={{
                position: "relative",
                overflow: "hidden",
                width: "100%",
                minHeight: isMobile ? "auto" : "500px",
                maxHeight: isMobile ? "none" : "90vh",
                display: "flex",
                flexDirection: "column"
              }}>
                {/* Blurred background image */}
                <div style={{
                  position: "absolute",
                  inset: 0,
                  overflow: "hidden",
                  zIndex: 1
                }}>
                  <motion.img
                    initial={{ scale: 1.1, filter: "blur(5px)" }}
                    animate={{ scale: 1, filter: "blur(5px)" }} // Increased blur
                    transition={{ duration: 0.8, ease: "easeOut" }}
                    src={selectedCard.image}
                    alt="Background"
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                      opacity: 0.7 // Reduced opacity for better text contrast
                    }}
                  />

                  {/* Gradient overlay for better text readability */}
                  <div style={{
                    position: "absolute",
                    inset: 0,
                    background: "linear-gradient(to bottom, rgba(0,0,0,0.2) 0%, rgba(0,0,0,0.7) 100%)",
                    zIndex: 2
                  }} />
                </div>

                {/* Text content positioned over the image */}
                <motion.div
                  initial={{ y: 30, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ duration: 0.5, delay: 0.2, ease: "easeOut" }}
                  style={{
                    position: "relative",
                    zIndex: 3,
                    padding: isMobile ? "25px 20px 30px" : "40px",
                    color: "#ffffff",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "center",
                    overflow: "auto",
                    maxHeight: "100%",
                    width: "100%",
                    flex: 1
                  }}
                >
                  {/* Date */}
                  <motion.div
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ duration: 0.4, delay: 0.3 }}
                    style={{
                      fontSize: isMobile ? "14px" : "16px",
                      color: "#ffffff",
                      marginBottom: "5px",
                      textTransform: "uppercase",
                      letterSpacing: "1px",
                      textShadow: "0 2px 4px rgba(0,0,0,0.4)"
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
                      fontSize: isMobile ? "28px" : "42px",
                      fontWeight: 700,
                      marginBottom: "20px",
                      lineHeight: "1.2",
                      margin: "0 0 20px 0",
                      textShadow: "0 2px 8px rgba(0,0,0,0.6)"
                    }}
                  >
                    {selectedCard.title}
                  </motion.h2>

                  {/* Divider */}
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: isMobile ? "95%" : selectedCard.title.length * 20 + (100 - selectedCard.title.length) }}
                    transition={{ duration: 0.6, delay: 0.5 }}
                    style={{
                      height: "3px",
                      backgroundColor: "#ffffff",
                      marginBottom: "20px",
                      borderRadius: "10px"
                    }}
                  />

                  {/* Description with proper text wrapping */}
                  <motion.p
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ duration: 0.4, delay: 0.6 }}
                    style={{
                      fontSize: isMobile ? "16px" : "18px",
                      lineHeight: "1.7",
                      color: "#ffffff",
                      margin: 0,
                      wordWrap: "break-word",
                      overflow: "visible",
                      maxWidth: isMobile ? "100%" : "800px",
                      textShadow: "0 1px 3px rgba(0,0,0,0.4)"
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
