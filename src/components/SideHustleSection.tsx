import SectionShell from './SectionShell'
import { profile } from '@/data/profile'

export default function SideHustleSection() {
  return (
    <SectionShell id="side" index="06" eyebrow="Side Hustle" title="副业">
      {profile.sideHustles.length === 0 ? (
        <div className="empty">
          暂无内容。请到 <code>src/data/profile.ts</code> 的 <code>sideHustles</code> 数组添加。
        </div>
      ) : (
        <ul className="hustles">
          {profile.sideHustles.map((h, i) => (
            <li key={i} className="hustle__wrap">
              <div className="hustle">
                <div className="hustle__head">
                  <h3 className="hustle__title">{h.title}</h3>
                  {h.status && <span className="hustle__status">{h.status}</span>}
                </div>
                {h.desc && <p className="hustle__desc">{h.desc}</p>}
                <div className="hustle__foot">
                  {h.tags && h.tags.length > 0 && (
                    <div className="hustle__tags">
                      {h.tags.map((t) => (
                        <span key={t} className="hustle__tag">
                          {t}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="hustle__ctas">
                    {h.probe && (
                      <a
                        href={h.probe}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hustle__cta hustle__cta--probe"
                      >
                        探针
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                          <path
                            d="M3 12h4l3-9 4 18 3-9h4"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </a>
                    )}
                    {h.link && (
                      <a href={h.link} className="hustle__cta">
                        联系
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                          <path
                            d="M5 12h14M13 6l6 6-6 6"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </a>
                    )}
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </SectionShell>
  )
}
