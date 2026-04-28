import { createClient } from '@supabase/supabase-js'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import MatnyaApp from '@/app/page'

type PageProps = {
  params: Promise<{ id: string }>
}

type PostRow = {
  id: number
  title: string | null
  content: string | null
  category: string | null
  created_at: string | null
  hidden: boolean | null
}

const SITE_URL = 'https://www.matya.kr'

function getServerSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anonKey) {
    throw new Error('Supabase env 값이 없음')
  }
  return createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

function summarizeContent(content: string | null): string {
  const normalized = (content ?? '').replace(/\s+/g, ' ').trim()
  if (!normalized) {
    return '익명으로 선택하고 사람들 의견을 확인해보세요.'
  }
  return normalized.length > 120 ? `${normalized.slice(0, 117)}...` : normalized
}

async function fetchPostById(id: number): Promise<PostRow | null> {
  const supabase = getServerSupabase()
  const { data, error } = await supabase
    .from('posts')
    .select('id, title, content, category, created_at, hidden')
    .eq('id', id)
    .maybeSingle()

  if (error) return null
  return (data as PostRow | null) ?? null
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params
  const postId = Number(id)
  if (!Number.isFinite(postId) || postId <= 0) {
    return {
      title: '게시글을 찾을 수 없음 | 맞냐',
      description: '요청한 게시글을 찾을 수 없습니다.',
      alternates: { canonical: `${SITE_URL}/post/${id}` },
    }
  }

  const post = await fetchPostById(postId)
  if (!post || post.hidden) {
    return {
      title: '게시글을 찾을 수 없음 | 맞냐',
      description: '요청한 게시글을 찾을 수 없습니다.',
      alternates: { canonical: `${SITE_URL}/post/${postId}` },
    }
  }

  const title = `${post.title ?? '게시글'} | 맞냐`
  const description = summarizeContent(post.content)
  const canonicalUrl = `${SITE_URL}/post/${postId}`

  return {
    title,
    description,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title,
      description,
      url: canonicalUrl,
      siteName: '맞냐',
      type: 'article',
      locale: 'ko_KR',
      images: [
        {
          url: '/og-image.png',
          width: 1200,
          height: 630,
          alt: '맞냐',
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: ['/og-image.png'],
    },
  }
}

export default async function PostSeoPage({ params }: PageProps) {
  const { id } = await params
  const postId = Number(id)
  if (!Number.isFinite(postId) || postId <= 0) {
    notFound()
  }

  const post = await fetchPostById(postId)
  if (!post || post.hidden) {
    notFound()
  }

  return <MatnyaApp initialPostId={postId} />
}
