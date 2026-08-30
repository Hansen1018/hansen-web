'use client'

import { useEffect, useRef, useState } from 'react'
import SectionShell from './SectionShell'
import { profile } from '@/data/profile'

interface BlogPost {
  date: string
  title: string
  url: string
  description: string
  content?: string  // markdown full text returned by hugo index.json, currently not consumed, kept for typing
  tags?: string[]
}

const blogCfg = profile.blog  // profile.blog is always defined (BlogConfig required field)

/**
 * BlogSection — client-side fetches latest articles from the configured feed URL.
 * - Single in-flight AbortController ref prevents overlapping fetches from racing
 *   (visibilitychange + setInterval would otherwise cancel each other via the
 *   outer effect's AbortController, but the newer one wins).
 * - Loading/error/empty states are wrapped in role="status" aria-live="polite"
 *   so screen readers announce the transition.
 */
export default function BlogSection() {
  const [posts, setPosts] = useState<BlogPost[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const inFlightRef = useRef<AbortController | null>(null)

  useEffect(() => {
    async function load() {
      // Cancel any in-flight request before starting a new one.
      inFlightRef.current?.abort()
      const ctrl = new AbortController()
      inFlightRef.current = ctrl

      try {
        const res = await fetch(`${blogCfg.feed}?v=${Date.now()}`, {
          cache: 'no-store',
          signal: ctrl.signal,
        })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const all = await res.json()
        if (!ctrl.signal.aborted) {
          const arr = Array.isArray(all) ? all : []
          // Dedupe by URL — Hugo index.json occasionally surfaces duplicates
          // when a post is listed under multiple sections.
          const seen = new Set<string>()
          const unique = arr.filter((p: BlogPost) => {
            const k = p.url || `__nokey_${seen.size}`
            if (seen.has(k)) return false
            seen.add(k)
            return true
          })
          setPosts(unique.slice(0, blogCfg.limit || 3))
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return
        if (!ctrl.signal.aborted) {
          setError(err instanceof Error ? err.message : String(err))
        }
      } finally {
        if (!ctrl.signal.aborted) setLoading(false)
      }
    }

    load()
    // 5-minute polling + immediate fetch when tab becomes visible again: new articles don't require reload
    const REFRESH_INTERVAL_MS = 5 * 60 * 1000
    const interval = setInterval(load, REFRESH_INTERVAL_MS)
    const onVisibility = () => {
      if (document.visibilityState === 'visible') load()
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      inFlightRef.current?.abort()
      clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])

  // Chinese long format: 2026-08-16 → 2026年8月16日
  const formatDate = (d: string) => {
    const dt = new Date(d)
    if (isNaN(dt.getTime())) return d
    return dt.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' })
  }

  return (
    <SectionShell id="blog" index="04" eyebrow="Latest" title="Blog">
      <p role="status" aria-live="polite" className="sr-only">
        {loading ? '正在加载最新文章' : error ? '加载失败' : posts.length > 0 ? `已加载 ${posts.length} 篇文章` : '暂无文章'}
      </p>
      {loading ? (
        <div className="blog-grid">
          <p className="blog-loading">加载中…</p>
        </div>
      ) : error ? (
        <div className="blog-grid">
          <p className="blog-loading">博客最新文章暂时无法索取，等会再试。</p>
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
            <article key={p.url || `blog-${i}`} className="blog-card">
              <div className="blog-card__meta">{formatDate(p.date)}</div>
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
