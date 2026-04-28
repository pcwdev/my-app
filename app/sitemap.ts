import { createClient } from '@supabase/supabase-js'
import type { MetadataRoute } from 'next'

const SITE_URL = 'https://www.matya.kr'

type SitemapPostRow = {
  id: number
  updated_at: string | null
  created_at: string | null
}

function getBaseSitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: SITE_URL,
      lastModified: new Date(),
      changeFrequency: 'hourly',
      priority: 1,
    },
  ]
}

function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseAnonKey) return null

  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = getBaseSitemap()
  const supabase = getSupabaseClient()
  if (!supabase) return base

  try {
    const { data, error } = await supabase
      .from('posts')
      .select('id, updated_at, created_at')
      .eq('hidden', false)
      .order('updated_at', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false, nullsFirst: false })
      .limit(500)

    if (error) return base

    const postItems = ((data ?? []) as SitemapPostRow[]).map((post) => ({
      url: `${SITE_URL}/post/${post.id}`,
      lastModified: new Date(post.updated_at ?? post.created_at ?? Date.now()),
      changeFrequency: 'daily' as const,
      priority: 0.8,
    }))

    return [...base, ...postItems]
  } catch {
    return base
  }
}
