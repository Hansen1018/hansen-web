'use client'

import { useEffect, useState } from 'react'
import SectionShell from './SectionShell'
import { profile } from '@/data/profile'

interface BlogPost {
  date: string
  title: string
  url: string
  description: string
  tags?: string[]
}

const blogCfg = profile.blog || {
  feed: 'https://blog.hansendong.top/index.json',
  limit: 3,
  base: 'https://blog.hansendong.top',
  moreUrl: 'https://blog.hansendong.top/',
}

/**
 * BlogSection — 客户端从 /blog-feed.json 拉取最近文章。
 * 1:1 移植 Vue 版的 fetch + 加载/错误/空态 fallback。
 */
export default function BlogSection() {
  const [posts, setPosts] = useState<BlogPost[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(`${blogCfg.feed}?v=${Date.now()}`, { cache: 'no-store' })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const all = await res.json()
        setPosts((Array.isArray(all) ? all : []).slice(0, blogCfg.limit || 3))
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  return (
    <SectionShell id="blog" index="04" eyebrow="Latest" title="Blog">
      {loading ? (
        <div className="blog-grid">
          <p className="blog-loading">加载中…</p>
        </div>
      ) : error ? (
        <div className="blog-grid">
          <p className="blog-loading">博客暂时拿不到，等会再试。({error})</p>
        </div>
      ) : posts.length === 0 ? (
        <div className="blog-grid">
          <p className="blog-loading">
            还没有文章，先去{' '}
            <a href={blogCfg.moreUrl} target="_blank" rel="noopener noreferrer">
              blog.hansendong.top
            </a>{' '}
            看看。
          </p>
        </div>
      ) : (
        <div className="blog-grid">
          {posts.map((p, i) => (
            <article key={i} className="blog-card">
              <div className="blog-card__meta">{p.date}</div>
              <h3 className="blog-card__title">
                <a
                  href={`${blogCfg.base}${p.url || '#'}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {p.title}
                </a>
              </h3>
              <p className="blog-card__desc">{p.description}</p>
              {p.tags && p.tags.length > 0 && (
                <div className="blog-card__tags">
                  {p.tags.slice(0, 3).map((t) => (
                    <span key={t} className="blog-tag">
                      {t}
                    </span>
                  ))}
                </div>
              )}
            </article>
          ))}
        </div>
      )}

      <a href={blogCfg.moreUrl} target="_blank" rel="noopener noreferrer" className="blog-more">
        查看博客 →
      </a>
    </SectionShell>
  )
}
