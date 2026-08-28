import SectionShell from './SectionShell'
import { profile } from '@/data/profile'

export default function SideHustleSection() {
  if (profile.sideHustles.length === 0) {
    return (
      <SectionShell id="side" index="06" eyebrow="Side Hustle" title="副业">
        <div className="empty">
          暂无内容。请到 <code>src/data/profile/side-hustles.ts</code> 的 <code>profileSideHustles</code> 数组添加。
        </div>
      </SectionShell>
    )
  }

  return (
    <SectionShell id="side" index="06" eyebrow="Side Hustle" title="副业">
      <ul className="hustles">
        {profile.sideHustles.map((h, i) => (
          <li key={i} className="hustle__wrap">
            <div className="hustle">
              <div className="hustle__head">
                <h3 className="hustle__title">{h.title}</h3>
                {h.status && <span className="hustle__status">{h.status}</span>}
              </div>
              {h.desc && <p className="hustle__desc">{h.desc}</p>}
              {h.tags && h.tags.length > 0 && (
                <div className="hustle__tags">
                  {h.tags.map((t) => (
                    <span key={t} className="hustle__tag">
                      {t}
                    </span>
                  ))}
                </div>
              )}
              <div className="hustle__foot">
                <div className="hustle__ctas">
                  {h.probe && (
                    <a
                      href={h.probe}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hustle__cta hustle__cta--probe"
                    >
                      实时状态 ↗
                    </a>
                  )}
                  <a
                    href={h.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hustle__cta"
                  >
                    咨询 →
                  </a>
                </div>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </SectionShell>
  )
}
