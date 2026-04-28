import { createClient } from '@supabase/supabase-js'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

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

  const title = post.title?.trim() || '제목 없음'
  const content = post.content?.trim() || '내용 없음'

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-10 text-slate-900">
      <h1 className="text-2xl font-black tracking-tight">{title}</h1>
      <p className="mt-3 text-sm text-slate-500">
        {post.category ? `${post.category} · ` : ''}
        {post.created_at ? new Date(post.created_at).toLocaleString('ko-KR') : ''}
      </p>
      <article className="mt-6 whitespace-pre-wrap rounded-2xl border border-slate-200 bg-white p-5 leading-7 text-slate-800">
        {content}
      </article>
      <p className="mt-6 text-xs text-slate-500">
        더 많은 반응과 투표는 메인 화면에서 확인할 수 있습니다.
      </p>
    </main>
  )
}
