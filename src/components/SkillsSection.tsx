import SectionShell from './SectionShell'
import { profile } from '@/data/profile'
import { hashHue } from '@/lib/hash'

export default function SkillsSection() {
  const isEmpty =
    profile.skills.length === 0 || profile.skills.every((g) => g.items.length === 0)

  const groups = profile.skills.map((g) => ({
    ...g,
    items: g.items.map((s) => ({ name: s, hue: hashHue(s) })),
  }))

  return (
    <SectionShell id="skills" index="03" eyebrow="Toolbox" title="技能栈">
      {isEmpty ? (
        <div className="empty">
          暂无数据。请到 <code>src/data/profile/skills.ts</code> 的 <code>skills</code> 数组添加。
        </div>
      ) : (
        <div className="skills">
          {groups.map((g) => (
            <div key={g.group} className="skills__group">
              <div className="skills__label">{g.group}</div>
              <ul className="skills__list">
                {g.items.map((item) => (
                  <li
                    key={item.name}
                    className="chip"
                    style={{ '--hue': item.hue } as React.CSSProperties}
                  >
                    {item.name}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </SectionShell>
  )
}
