'use client'

import { useEffect, useState } from 'react'
import SectionShell from './SectionShell'
import { profile } from '@/data/profile'

interface BlogPost {
  date: string
  title: string
  url: string
  description: string
  content?: string  // hugo index.json 返回的 markdown 全文，目前未消费，typed 保留
  tags?: string[]
}

const blogCfg = profile.blog  // profile.blog 永远 defined（BlogConfig 必填字段）

/**
 * BlogSection — 客户端从 https://blog.hansendong.top/index.json 拉取最近文章。
 * 1:1 移植 Vue 版的 fetch + 加载/错误/空态 fallback。
 * AbortController 防止 unmount 后 setState 触发 React 警告。
 */
export default function BlogSection() {
  const [posts, setPosts] = useState<BlogPost[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const ctrl = new AbortController()
    async function load() {
      try {
        const res = await fetch(`${blogCfg.feed}?v=${Date.now()}`, {
          cache: 'no-store',
          signal: ctrl.signal,
        })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const all = await res.json()
        if (!ctrl.signal.aborted) {
          setPosts((Array.isArray(all) ? all : []).slice(0, blogCfg.limit || 3))
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
    // 5 分钟轮询 + tab 重新可见时立刻拉一次：新文章不用等 reload
    const REFRESH_INTERVAL_MS = 5 * 60 * 1000
    const interval = setInterval(load, REFRESH_INTERVAL_MS)
    const onVisibility = () => {
      if (document.visibilityState === 'visible') load()
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      ctrl.abort()
      clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])

  // 中文长格式：2026-08-16 → 2026年8月16日
  const formatDate = (d: string) => {
    const dt = new Date(d)
    if (isNaN(dt.getTime())) return d
    return dt.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' })
  }

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
          {posts.map((p) => (
            <article key={p.url} className="blog-card">
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
