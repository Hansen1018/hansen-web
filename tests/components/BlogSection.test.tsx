import { render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import BlogSection from '@/components/BlogSection'

interface FeedPost {
  date: string
  title: string
  url: string
  description: string
}

function post(title: string, url: string): FeedPost {
  return {
    date: '2026-08-30T00:00:00.000Z',
    title,
    url,
    description: `${title} description`,
  }
}

function mockFeed(posts: FeedPost[]) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => posts,
    }),
  )
}

describe('BlogSection feed deduplication', () => {
  it('removes duplicate URLs before applying the configured post limit', async () => {
    mockFeed([
      post('First article', '/first/'),
      post('Duplicate first article', '/first/'),
      post('Second article', '/second/'),
      post('Third article', '/third/'),
      post('Beyond the limit', '/fourth/'),
    ])

    render(<BlogSection />)

    expect(await screen.findByText('已加载 3 篇文章')).toBeInTheDocument()
    const cards = document.querySelectorAll<HTMLElement>('.blog-card')
    expect(cards).toHaveLength(3)
    expect(within(cards[0]!).getByRole('link')).toHaveTextContent('First article')
    expect(within(cards[1]!).getByRole('link')).toHaveTextContent('Second article')
    expect(within(cards[2]!).getByRole('link')).toHaveTextContent('Third article')
    expect(screen.queryByText('Duplicate first article')).not.toBeInTheDocument()
    expect(screen.queryByText('Beyond the limit')).not.toBeInTheDocument()
  })

  it('keeps separate URL-less posts while still deduplicating keyed posts', async () => {
    mockFeed([
      post('Draft without a URL', ''),
      post('Another URL-less draft', ''),
      post('Published article', '/published/'),
      post('Duplicate published article', '/published/'),
    ])

    render(<BlogSection />)

    expect(await screen.findByText('已加载 3 篇文章')).toBeInTheDocument()
    expect(screen.getByText('Draft without a URL')).toBeInTheDocument()
    expect(screen.getByText('Another URL-less draft')).toBeInTheDocument()
    expect(screen.getByText('Published article')).toBeInTheDocument()
    expect(screen.queryByText('Duplicate published article')).not.toBeInTheDocument()

    const fallbackLinks = screen
      .getAllByRole('link')
      .filter((link) => link.getAttribute('href')?.endsWith('#'))
    expect(fallbackLinks).toHaveLength(2)
  })
})
