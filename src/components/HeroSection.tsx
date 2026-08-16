'use client'

import { useEffect, useMemo, useState } from 'react'
import { profile } from '@/data/profile'
import { socialIconPaths, getSocialHandle } from './socialIcons'

const TYPE_SPEED = 110
const DELETE_SPEED = 60
const PAUSE_FULL = 1600
const PAUSE_EMPTY = 350

/**
 * HeroSection — first screen: avatar / social / status chips / typewriter name / CTA / scroll indicator.
 * Typewriter loops profile.name, controlled by type/delete state machine.
 */
export default function HeroSection() {
  const [typed, setTyped] = useState('')
  const word = profile.name

  useEffect(() => {
    let charIdx = 0
    let phase: 'typing' | 'deleting' | 'pause' = 'typing'
    let timer: ReturnType<typeof setTimeout> | null = null

    function tick() {
      if (phase === 'typing') {
        if (charIdx < word.length) {
          charIdx++
          setTyped(word.slice(0, charIdx))
          timer = setTimeout(tick, TYPE_SPEED)
        } else {
          phase = 'pause'
          timer = setTimeout(() => {
            phase = 'deleting'
            tick()
          }, PAUSE_FULL)
        }
      } else if (phase === 'deleting') {
        if (charIdx > 0) {
          charIdx--
          setTyped(word.slice(0, charIdx))
          timer = setTimeout(tick, DELETE_SPEED)
        } else {
          timer = setTimeout(() => {
            phase = 'typing'
            tick()
          }, PAUSE_EMPTY)
        }
      }
    }

    tick()
    return () => {
      if (timer) clearTimeout(timer)
    }
  }, [word])

  const socials = useMemo(
    () => profile.socials.map((s) => ({ ...s, handle: getSocialHandle(s.url, s.label) })),
    [],
  )

  return (
    <section id="hero" className="hero">
      <div className="hero__inner">
        <div className="hero__avatar fade-up" style={{ animationDelay: '.05s' }}>
          <div className="hero__avatar-ring"></div>
          {profile.avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={profile.avatar}
              alt={`${profile.name} avatar`}
              className="hero__avatar-img"
              onError={(e) => {
                e.currentTarget.style.display = 'none'
              }}
            />
          ) : (
            <div className="hero__avatar-core">
              <span>{profile.initials}</span>
            </div>
          )}
          <span className="hero__status" title={profile.availability}>
            <span className="hero__status-dot"></span>
          </span>
        </div>

        <div className="hero__socials fade-up" style={{ animationDelay: '.1s' }}>
          {socials.map((s) => (
            <a
              key={s.label}
              href={s.url}
              className={`social-icon social-icon--${s.icon}`}
              target="_blank"
              rel="noopener noreferrer"
              title={`${s.label}: ${s.handle || s.url}`}
            >
              <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16" aria-hidden="true">
                <path
                  d={
                    socialIconPaths[s.icon as keyof typeof socialIconPaths] || socialIconPaths.link
                  }
                />
              </svg>
            </a>
          ))}
        </div>

        <div className="hero__chips fade-up" style={{ animationDelay: '.15s' }}>
          <span className="chip">
            <span className="chip__dot chip__dot--green"></span>
            {profile.status}
          </span>
          <span className="chip">
            <span className="chip__dot chip__dot--cyan"></span>
            {profile.location}
          </span>
          <span className="chip">
            <span className="chip__dot chip__dot--violet"></span>
            {profile.availability}
          </span>
        </div>

        <h1 className="hero__name fade-up" style={{ animationDelay: '.22s' }}>
          <span className="hero__hi">👋 Hi, I&apos;m</span>
          <span className="hero__name-text">
            {typed}
            <span className="hero__name-caret" aria-hidden="true"></span>
            <span className="hero__name-dot">.</span>
          </span>
        </h1>

        <p className="hero__role fade-up" style={{ animationDelay: '.3s' }}>
          {profile.role}
        </p>

        <p className="hero__tagline fade-up" style={{ animationDelay: '.38s' }}>
          {profile.tagline}
        </p>

        <div className="hero__cta fade-up" style={{ animationDelay: '.46s' }}>
          <a href="#projects" className="btn btn--primary">
            查看作品
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path
                d="M5 12h14M13 6l6 6-6 6"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </a>
          <a
            href="https://blog.hansendong.top/about"
            target="_blank"
            rel="noopener"
            className="btn btn--ghost"
          >
            联系我
          </a>
        </div>
      </div>

      <a href="#about" className="hero__scroll" aria-label="向下滚动">
        <span className="hero__scroll-line"></span>
      </a>
    </section>
  )
}
