import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import './style.css'

import { supabase } from '../services/supabaseClient'
import { currency } from '../utils/format'

export default function Home() {
  const carouselRef = useRef(null)
  const heroRef = useRef(null)
  const aboutRef = useRef(null)
  const [arrivals, setArrivals] = useState([])

  // Carousel behavior: nav buttons and keyboard arrows move by one card
  useEffect(() => {
    const carousel = carouselRef.current
    if (!carousel) return
    const track = carousel.querySelector('.carousel-track')
    const prev = carousel.querySelector('.prev')
    const next = carousel.querySelector('.next')
    if (!track) return

    function getScrollAmount() {
      const card = track.querySelector('.product-card')
      const gap = 24
      if (!card) return 320
      const rect = card.getBoundingClientRect()
      return Math.round(rect.width + gap)
    }

    const scrollByCard = (direction) => {
      const amount = getScrollAmount() * (direction === 'next' ? 1 : -1)
      const target = (track.scrollLeft || 0) + amount
      try {
        if (typeof track.scrollTo === 'function') {
          track.scrollTo({ left: target, behavior: 'smooth' })
        } else if (typeof track.scrollBy === 'function') {
          track.scrollBy({ left: amount, behavior: 'smooth' })
        } else {
          track.scrollLeft = target
        }
      } catch {
        track.scrollLeft = target
      }
    }

    const onPrev = () => scrollByCard('prev')
    const onNext = () => scrollByCard('next')
    prev && prev.addEventListener('click', onPrev)
    next && next.addEventListener('click', onNext)

    // a11y
    carousel.setAttribute('role', 'region')
    carousel.setAttribute('aria-label', 'Latest Collection carousel')
    const live = document.createElement('div')
    live.setAttribute('aria-live', 'polite')
    live.setAttribute('aria-atomic', 'true')
    Object.assign(live.style, {
      position: 'absolute', width: '1px', height: '1px', overflow: 'hidden', clip: 'rect(1px, 1px, 1px, 1px)'
    })
    carousel.appendChild(live)

    const onKeyDown = (e) => {
      if (e.key === 'ArrowRight') {
        e.preventDefault()
        scrollByCard('next')
        live.textContent = 'Moved to next products'
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        scrollByCard('prev')
        live.textContent = 'Moved to previous products'
      }
    }
    track.addEventListener('keydown', onKeyDown)
    if (!track.hasAttribute('tabindex')) track.setAttribute('tabindex', '0')
    const onFocusIn = () => track.focus()
    carousel.addEventListener('focusin', onFocusIn)

    let ro
    if ('ResizeObserver' in window) {
      ro = new ResizeObserver(() => {})
      track.querySelectorAll('.product-card').forEach((c) => ro.observe(c))
    }

    return () => {
      prev && prev.removeEventListener('click', onPrev)
      next && next.removeEventListener('click', onNext)
      track.removeEventListener('keydown', onKeyDown)
      carousel.removeEventListener('focusin', onFocusIn)
      if (ro) ro.disconnect()
      if (live && live.parentNode) live.parentNode.removeChild(live)
    }
  }, [arrivals])

  // Hero background rotator
  useEffect(() => {
    const hero = heroRef.current
    if (!hero) return
    const bg1 = hero.querySelector('.hero-bg.bg1')
    const bg2 = hero.querySelector('.hero-bg.bg2')
    const tint = hero.querySelector('.hero-tint')
    if (!bg1 || !bg2 || !tint) return

    let current = 1
    bg1.classList.add('visible')
    bg2.classList.remove('visible')

    let paused = false
    const swap = () => {
      if (paused) return
      if (current === 1) {
        bg1.classList.remove('visible')
        bg2.classList.add('visible')
        current = 2
      } else {
        bg2.classList.remove('visible')
        bg1.classList.add('visible')
        current = 1
      }
    }
    const interval = setInterval(swap, 5000)
    const onEnter = () => (paused = true)
    const onLeave = () => (paused = false)
    hero.addEventListener('mouseenter', onEnter)
    hero.addEventListener('mouseleave', onLeave)
    hero.addEventListener('focusin', onEnter)
    hero.addEventListener('focusout', onLeave)

    return () => {
      clearInterval(interval)
      hero.removeEventListener('mouseenter', onEnter)
      hero.removeEventListener('mouseleave', onLeave)
      hero.removeEventListener('focusin', onEnter)
      hero.removeEventListener('focusout', onLeave)
    }
  }, [])

  // About background rotator
  useEffect(() => {
    const about = aboutRef.current
    if (!about) return
    const layers = Array.from(about.querySelectorAll('.about-bg'))
    if (!layers.length) return
    let current = layers.findIndex((l) => l.classList.contains('visible'))
    if (current === -1) {
      current = 0
      layers[0].classList.add('visible')
    }
    let paused = false
    const swap = () => {
      if (paused) return
      const next = (current + 1) % layers.length
      layers[current].classList.remove('visible')
      layers[next].classList.add('visible')
      current = next
    }
    const iv = setInterval(swap, 5000)
    const onEnter = () => (paused = true)
    const onLeave = () => (paused = false)
    about.addEventListener('mouseenter', onEnter)
    about.addEventListener('mouseleave', onLeave)
    about.addEventListener('focusin', onEnter)
    about.addEventListener('focusout', onLeave)
    return () => {
      clearInterval(iv)
      about.removeEventListener('mouseenter', onEnter)
      about.removeEventListener('mouseleave', onLeave)
      about.removeEventListener('focusin', onEnter)
      about.removeEventListener('focusout', onLeave)
    }
  }, [])

  // Load New Arrivals (recent items)
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { data, error } = await supabase
        .from('items')
        .select('id,name,sell_price,image_url,created_at')
        .order('created_at', { ascending: false })
        .limit(10)
      if (!cancelled) setArrivals(error ? [] : (data || []))
    })()
    return () => { cancelled = true }
  }, [])

  return (
    <main>
      {/* Hero Section */}
      <section className="hero" ref={heroRef}>
        {/* background layers (banner images) */}
        <div className="hero-bg bg1 visible" aria-hidden="true"></div>
        <div className="hero-bg bg2" aria-hidden="true"></div>
        <div className="hero-tint" aria-hidden="true"></div>
        <div className="container">
          <div className="hero-content">
            <h4 className="subtitle">Mag's D. Jewelry</h4>
            <h1 className="title">Unveiling Brilliance and Timeless Elegance, Crafted for You.</h1>
            <Link to="/products" className="btn btn-primary">SHOP NOW</Link>
          </div>
          {/* Hero image removed intentionally */}
        </div>
      </section>

      {/* Latest Collection */}
      <section className="collection section-dark">
        <div className="container">
          <h5>Latest Collection</h5>
          <h2>New Arrivals</h2>
          <div className="collection-carousel" ref={carouselRef}>
            <button type="button" className="carousel-nav prev" aria-label="Previous">‹</button>
            <div className="carousel-track" tabIndex={0}>
              {(arrivals.length ? arrivals : []).map((it) => (
                <div className="product-card" key={it.id}>
                  <div className="product-image">
                    <img src={it.image_url || '/vite.svg'} alt={it.name} />
                  </div>
                  <div className="product-info">
                    <h3>{it.name}</h3>
                    <p className="price">{currency(it.sell_price)}</p>
                    <Link to="/products" className="btn btn-primary">View</Link>
                  </div>
                </div>
              ))}
            </div>
            <button type="button" className="carousel-nav next" aria-label="Next">›</button>
          </div>
          <div className="section-cta">
            <Link to="/products" className="btn btn-primary">Browse More</Link>
          </div>
        </div>
      </section>

      {/* Best Sellers */}
      <section className="watch section-light">
        <div className="container">
          <h5>Highlights</h5>
          <h2>Best Sellers</h2>
          <div className="product-grid">
            {(arrivals.slice(0,3)).map((it) => (
              <div className="product-card" key={`best-${it.id}`}>
                <div className="product-image">
                  <img src={it.image_url || '/vite.svg'} alt={it.name} />
                </div>
                <div className="product-info">
                  <h3>{it.name}</h3>
                  <p className="price">{currency(it.sell_price)}</p>
                  <Link to="/products" className="btn btn-primary">View</Link>
                </div>
              </div>
            ))}
          </div>
          <div className="section-cta">
            <Link to="/products" className="btn btn-primary">Browse More</Link>
          </div>
        </div>
      </section>

      {/* About Us */}
      <section className="about section-light" ref={aboutRef}>
        {/* about background layers (rotating banners) */}
        <div className="about-bg bg1 visible" aria-hidden="true"></div>
        <div className="about-bg bg2" aria-hidden="true"></div>
        <div className="about-bg bg3" aria-hidden="true"></div>
        <div className="about-tint" aria-hidden="true"></div>
        <div className="container about-inner">
          <div className="about-image" aria-hidden="true"></div>
          <div className="about-content">
            <h5>About Us</h5>
            <h2>Crafting Memories, One Piece at a Time</h2>
            <p>
              At Mag's D. Jewelry, we specialize in handcrafted pieces that blend timeless design with modern
              sophistication. Each piece is carefully made to celebrate life's special moments.
            </p>
            <div className="section-cta">
              <Link to="/about" className="btn btn-secondary">Learn More</Link>
            </div>
          </div>
        </div>
      </section>

      {/* Contact / Find Us */}
      <section className="contact section-dark">
        <div className="container flex-center">
          <div className="contact-image" aria-hidden="true"></div>
          <div className="contact-info">
            <h5>Get In Touch</h5>
            <h2>Find Us Here</h2>
            <p>2nd floor, Gaisano Mall Digos, Quezon Ave., Tres De Mayo, Digos City</p>
            <p>Mon – Sun: 9am – 9pm</p>
            <p>
              <a href="mailto:jenniferprudente42@yahoo.com.ph" className="email-link">
                jenniferprudente42@yahoo.com.ph
              </a>
            </p>
          </div>
        </div>
      </section>

      {/* Newsletter intentionally removed per requirement */}
    </main>
  )
}
