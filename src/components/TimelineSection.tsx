import SectionShell from './SectionShell'
import { profile } from '@/data/profile'

export default function TimelineSection() {
  return (
    <SectionShell id="timeline" index="05" eyebrow="Journey" title="经历">
      {profile.timeline.length === 0 ? (
        <div className="empty">
          暂无经历。请到 <code>src/data/profile/timeline.ts</code> 的 <code>profileTimeline</code> 数组添加。
        </div>
      ) : (
        <ol className="timeline">
          {profile.timeline.map((item, i) => (
            <li key={i} className="timeline__item">
              <div className="timeline__node">
                <span className="timeline__dot"></span>
              </div>
              <div className="timeline__card">
                <div className="timeline__head">
                  <span className="timeline__year">{item.year}</span>
                  <span className="timeline__org">{item.org}</span>
                </div>
                <h3 className="timeline__title">{item.title}</h3>
                <p className="timeline__desc">{item.desc}</p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </SectionShell>
  )
}
