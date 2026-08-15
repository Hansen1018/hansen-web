import type { Metadata, Viewport } from 'next'
import './globals.css'
import '../styles/components.css'

const SITE_URL = 'https://hansendong.top'

export const viewport: Viewport = {
  themeColor: '#0b0d12',
  colorScheme: 'dark',
  width: 'device-width',
  initialScale: 1,
}

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: 'Hansen · 主页',
  description:
    'Hansen 的个人主页：1989 年生的完美主义者、Vibe Coding 工程师。记录博主经历、客制外设经销与 PT/服务器副业。',
  authors: [{ name: 'Hansen', url: SITE_URL }],
  keywords: ['Hansen', '个人主页', 'Vibe Coding', '客制键盘', 'PT', '服务器租用', '博主'],
  alternates: { canonical: '/' },
  openGraph: {
    type: 'profile',
    title: 'Hansen · 主页',
    description:
      '1989 年生的完美主义者，Vibe Coding 工程师。记录博主、客制外设与 PT/服务器副业。',
    url: '/',
    siteName: 'Hansen',
    images: [{ url: '/og.png', width: 1200, height: 630, alt: 'Hansen · 主页' }],
    locale: 'zh_CN',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Hansen · 主页',
    description: '1989 年生的完美主义者，Vibe Coding 工程师。',
    images: ['/og.png'],
  },
  robots: {
    index: true,
    follow: true,
  },
  icons: {
    icon: [{ url: '/favicon.svg', type: 'image/svg+xml' }],
    apple: '/favicon.svg',
  },
}

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Person',
      '@id': `${SITE_URL}/#person`,
      name: 'Hansen',
      alternateName: 'Hansen1018',
      url: `${SITE_URL}/`,
      jobTitle: 'Vibe Coding Engineer',
      description: '1989 年生的完美主义者，Vibe Coding 工程师，博主，客制外设经销。',
      knowsAbout: [
        'Vibe Coding',
        'Blogging',
        'Custom Mechanical Keyboards',
        'Private Trackers',
        'Linux',
      ],
      sameAs: [
        'https://github.com/Hansen1018',
        'https://twitter.com/Hansen1018',
        'https://t.me/Hansen1018',
      ],
      email: 'mailto:hansendong1018@gmail.com',
      homeLocation: { '@type': 'Place', name: '深圳' },
    },
    {
      '@type': 'WebSite',
      '@id': `${SITE_URL}/#website`,
      url: `${SITE_URL}/`,
      name: 'Hansen',
      description: 'Hansen 的个人主页：Vibe Coding 工程师，博主，客制外设经销。',
      inLanguage: 'zh-CN',
      publisher: { '@id': `${SITE_URL}/#person` },
    },
    {
      '@type': 'WebPage',
      '@id': `${SITE_URL}/#webpage`,
      url: `${SITE_URL}/`,
      name: 'Hansen · 主页',
      description:
        '1989 年生的完美主义者，Vibe Coding 工程师。记录博主经历、客制外设经销与 PT/服务器副业。',
      isPartOf: { '@id': `${SITE_URL}/#website` },
      about: { '@id': `${SITE_URL}/#person` },
      inLanguage: 'zh-CN',
      primaryImageOfPage: {
        '@type': 'ImageObject',
        url: `${SITE_URL}/og.png`,
        width: 1200,
        height: 630,
      },
    },
  ],
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>
        {children}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </body>
    </html>
  )
}
