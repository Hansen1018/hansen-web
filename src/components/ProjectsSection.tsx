'use client'

import { useState } from 'react'
import SectionShell from './SectionShell'
import { profile } from '@/data/profile'
import { hashHue } from '@/lib/hash'

/**
 * ProjectsSection — curated project card grid.
 * hashHue generates a stable hue for each card; cards with logos use logo thumbnails,
 * cards without logos (or where logo 404s) use the first letter.
 * 'use client' is because <img onError> is a browser-side event.
 */
export default function ProjectsSection() {
  // Local error state per-card would be cleaner with a Map, but a single set of
  // failed URLs works fine for the small project list.
  const [failedLogos, setFailedLogos] = useState<Set<string>>(new Set())

  if (profile.projects.length === 0) {
    return (
      <SectionShell id="projects" index="02" eyebrow="Selected Work" title="精选项目">
        <div className="empty">
          暂无项目。请到 <code>src/data/profile/projects.ts</code> 的 <code>projects</code> 数组添加。
        </div>
      </SectionShell>
    )
  }

  const list = profile.projects.map((p, i) => ({
    ...p,
    hue: (hashHue(p.title) + i * 47) % 360,
  }))

  const markFailed = (url: string) => {
    setFailedLogos((prev) => {
      if (prev.has(url)) return prev
      const next = new Set(prev)
      next.add(url)
      return next
    })
  }

  return (
    <SectionShell id="projects" index="02" eyebrow="Selected Work" title="精选项目">
      <div className="grid">
        {list.map((p) => {
          const showLogo = p.logo && !failedLogos.has(p.logo)
          return (
            <a
              key={p.title}
              className={`card${p.featured ? ' card--feature' : ''}`}
              href={p.link || p.repo || '#'}
              target="_blank"
              rel="noopener noreferrer"
            >
              <div
                className="card__thumb"
                style={{
                  background: `linear-gradient(135deg, hsl(${p.hue} 70% 55% / 0.85), hsl(${(p.hue + 60) % 360} 70% 45% / 0.85))`,
                }}
              >
                {showLogo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={p.logo}
                    alt={`${p.title} preview`}
                    className={`card__thumb-logo${p.logoFit === 'cover' ? ' card__thumb-logo--cover' : ''}`}
                    loading="lazy"
                    onError={() => p.logo && markFailed(p.logo)}
                  />
                ) : (
                  <span className="card__thumb-text">{p.title.charAt(0).toUpperCase()}</span>
                )}
                <div className="card__thumb-grid" aria-hidden="true"></div>
              </div>

              <div className="card__body">
                <div className="card__meta">
                  {p.year && <span className="card__year">{p.year}</span>}
                  {p.featured && <span className="card__badge">Featured</span>}
                </div>

                <h3 className="card__title">{p.title}</h3>
                <p className="card__desc">{p.desc}</p>

                {p.tags && p.tags.length > 0 && (
                  <div className="card__tags">
                    {p.tags.map((t) => (
                      <span key={t} className="card__tag">
                        {t}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <span className="card__arrow" aria-hidden="true">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path
                    d="M7 17 17 7M9 7h8v8"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
            </a>
          )
        })}
      </div>
    </SectionShell>
  )
}
