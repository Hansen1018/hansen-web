'use client'

import SectionShell from './SectionShell'
import { profile } from '@/data/profile'

function hashHue(str: string): number {
  let h = 0
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0
  return Math.abs(h) % 360
}

/**
 * ProjectsSection — 精选项目卡片网格。
 * hashHue 给每张卡片生成稳定色相；带 logo 的用 logo 缩略图，无 logo 用首字母。
 * 'use client' 是因为 <img onError> 是浏览器端事件。
 */
export default function ProjectsSection() {
  if (profile.projects.length === 0) {
    return (
      <SectionShell id="projects" index="02" eyebrow="Selected Work" title="精选项目">
        <div className="empty">
          暂无项目。请到 <code>src/data/profile.ts</code> 的 <code>projects</code> 数组添加。
        </div>
      </SectionShell>
    )
  }

  const list = profile.projects.map((p, i) => ({
    ...p,
    hue: (hashHue(p.title) + i * 47) % 360,
  }))

  return (
    <SectionShell id="projects" index="02" eyebrow="Selected Work" title="精选项目">
      <div className="grid">
        {list.map((p) => (
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
              {p.logo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={p.logo}
                  alt={`${p.title} preview`}
                  className={`card__thumb-logo${p.logoFit === 'cover' ? ' card__thumb-logo--cover' : ''}`}
                  loading="lazy"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none'
                  }}
                />
              ) : (
                <span className="card__thumb-text">{p.title.charAt(0).toUpperCase()}</span>
              )}
              <div className="card__thumb-grid"></div>
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
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
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
        ))}
      </div>
    </SectionShell>
  )
}
