import { profile } from '@/data/profile'
import { socialIconPaths } from './socialIcons'

export default function ContactSection() {
  return (
    <section id="contact" className="contact">
      <div className="contact__card">
        <div className="contact__inner">
          <span className="contact__eyebrow">07 · Get in touch</span>
          <h2 className="contact__title">
            让我们一起
            <br />
            <span className="contact__title-accent">做点有意思的事</span>
          </h2>
          <p className="contact__lede">
            无论是合作项目、机会分享，或只是想打个招呼——
            <br />
            欢迎随时联系。
          </p>

          <a href={`mailto:${profile.email}`} className="contact__mail">
            <span className="contact__mail-text">{profile.email}</span>
            <svg
              className="contact__mail-icon"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M5 12h14M13 6l6 6-6 6"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </a>

          {profile.socials.length > 0 && (
            <ul className="contact__socials">
              {profile.socials.map((s) => (
                <li key={s.url}>
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="social"
                    title={s.label}
                  >
                    <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18" aria-hidden="true">
                      <path
                        d={
                          socialIconPaths[s.icon as keyof typeof socialIconPaths] ||
                          socialIconPaths.link
                        }
                      />
                    </svg>
                    <span>{s.label}</span>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <footer className="legal">
        <span>© {new Date().getFullYear()} {profile.name}.</span>
        <span className="legal__sep" aria-hidden="true">·</span>
        <span>Built with Next.js</span>
      </footer>
    </section>
  )
}
