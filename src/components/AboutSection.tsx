import SectionShell from './SectionShell'
import { profile } from '@/data/profile'

export default function AboutSection() {
  return (
    <SectionShell id="about" index="01" eyebrow="About" title="关于我">
      <div className="about">
        <div className="about__copy">
          <p className="about__lede">{profile.about.intro}</p>
          {profile.about.paragraphs.map((p, i) => (
            <p key={i} className="about__p">
              {p}
            </p>
          ))}
        </div>

        <ul className="about__stats">
          {profile.about.highlights.map((h, i) => (
            <li key={i} className="about__stat">
              <span className="about__stat-label">{h.label}</span>
              <span className="about__stat-value">{h.value}</span>
            </li>
          ))}
        </ul>
      </div>
    </SectionShell>
  )
}
