import { getSupabaseAdmin } from '@/lib/supabase-admin'

type CandidatePost = {
  id: number
  category: string | null
  left_votes: number | null
  right_votes: number | null
  report_count: number | null
  created_at: string | null
  last_activity_at: string | null
}

type FragmentRow = {
  type: string
  category: string | null
  side: string | null
  text: string
}

const AUTHOR_POOL = ['익명281', '공감442', '현실주의자', '냉정하게봄']
const FALLBACK_FRAGMENTS: FragmentRow[] = [
  { type: 'starter', category: 'common', side: null, text: '이건 관점 차이가 큰 주제네.' },
  { type: 'judgement', category: 'common', side: null, text: '결국 기준을 어디에 두느냐 문제 같아.' },
  { type: 'ending', category: 'common', side: null, text: '서로 다르게 느낄 수 있는 포인트인 듯.' },
  { type: 'reaction', category: 'common', side: null, text: '댓글들 보니까 양쪽 다 이해가 됨.' },
  { type: 'reply', category: 'common', side: null, text: '위 의견은 맥락상 일리가 있어 보여.' },
]

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function unauthorizedResponse() {
  return Response.json({ ok: false, error: 'unauthorized' }, { status: 401 })
}

function toSafeString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function toSafeNumber(value: unknown): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function randomPick<T>(items: T[]): T | null {
  if (items.length === 0) return null
  return items[Math.floor(Math.random() * items.length)] ?? null
}

function isAuthorized(request: Request, cronSecret: string): boolean {
  const bearerHeader = request.headers.get('authorization')
  const bearerToken = bearerHeader?.startsWith('Bearer ')
    ? bearerHeader.slice('Bearer '.length).trim()
    : ''
  const xCronSecret = request.headers.get('x-cron-secret')?.trim() ?? ''
  return bearerToken === cronSecret || xCronSecret === cronSecret
}

function buildAuthorKey(): string {
  const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const randPart = Math.random().toString(36).slice(2, 8)
  return `operator_auto_${datePart}_${randPart}`
}

function buildScheduledAt(): string {
  const delayMinutes = 17 + Math.floor(Math.random() * (95 - 17 + 1))
  return new Date(Date.now() + delayMinutes * 60 * 1000).toISOString()
}

function calcBalanceScore(leftVotes: number, rightVotes: number): number {
  const total = leftVotes + rightVotes
  if (total <= 0) return 1
  const ratio = leftVotes / total
  return Math.abs(0.5 - ratio)
}

function chooseSide(leftVotes: number, rightVotes: number): 'left' | 'right' {
  if (leftVotes > rightVotes) return 'right'
  if (rightVotes > leftVotes) return 'left'
  return Math.random() > 0.5 ? 'left' : 'right'
}

function pickFragment(
  fragments: FragmentRow[],
  type: string,
  category: string,
  side: 'left' | 'right',
): string {
  const typeRows = fragments.filter((row) => row.type === type)
  const categoryRows = typeRows.filter((row) => (row.category ?? 'common') === category)
  const sideRows = categoryRows.filter((row) => !row.side || row.side === side)
  const commonRows = typeRows.filter((row) => (row.category ?? 'common') === 'common')

  return (
    randomPick(sideRows)?.text ||
    randomPick(categoryRows)?.text ||
    randomPick(commonRows)?.text ||
    randomPick(typeRows)?.text ||
    ''
  )
}

function composeCommentText(
  fragments: FragmentRow[],
  category: string,
  side: 'left' | 'right',
): string {
  const patterns = ['starter+judgement+ending', 'reaction+judgement', 'reply+judgement'] as const
  const pickedPattern = randomPick([...patterns]) ?? 'starter+judgement+ending'

  if (pickedPattern === 'starter+judgement+ending') {
    return [
      pickFragment(fragments, 'starter', category, side),
      pickFragment(fragments, 'judgement', category, side),
      pickFragment(fragments, 'ending', category, side),
    ]
      .filter(Boolean)
      .join(' ')
  }

  if (pickedPattern === 'reaction+judgement') {
    return [
      pickFragment(fragments, 'reaction', category, side),
      pickFragment(fragments, 'judgement', category, side),
    ]
      .filter(Boolean)
      .join(' ')
  }

  return [
    pickFragment(fragments, 'reply', category, side),
    pickFragment(fragments, 'judgement', category, side),
  ]
    .filter(Boolean)
    .join(' ')
}

async function runFillJob(request: Request) {
  let supabaseAdmin: ReturnType<typeof getSupabaseAdmin>
  try {
    supabaseAdmin = getSupabaseAdmin()
  } catch (error) {
    return Response.json(
      {
        ok: false,
        error:
          error instanceof Error ? error.message : 'failed_to_create_supabase_admin_client',
      },
      { status: 500 },
    )
  }

  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    return Response.json({ ok: false, error: 'CRON_SECRET env is missing' }, { status: 500 })
  }
  if (!isAuthorized(request, cronSecret)) {
    return unauthorizedResponse()
  }

  const now = Date.now()
  const fortyEightHoursAgo = new Date(now - 48 * 60 * 60 * 1000).toISOString()
  const twelveHoursAgo = new Date(now - 12 * 60 * 60 * 1000).toISOString()

  const { data: recentQueueRows, error: recentQueueError } = await supabaseAdmin
    .from('operator_comment_queue')
    .select('post_id')
    .gte('scheduled_at', twelveHoursAgo)

  if (recentQueueError) {
    return Response.json(
      { ok: false, error: 'failed_to_load_recent_queue', detail: recentQueueError.message },
      { status: 500 },
    )
  }

  const blockedPostIds = new Set(
    (recentQueueRows ?? [])
      .map((row) => toSafeNumber((row as { post_id: unknown }).post_id))
      .filter((id) => id > 0),
  )

  const { data: candidateRows, error: candidateError } = await supabaseAdmin
    .from('posts')
    .select(
      'id, category, left_votes, right_votes, report_count, created_at, last_activity_at, hidden, status',
    )
    .eq('hidden', false)
    .eq('status', 'active')
    .gte('created_at', fortyEightHoursAgo)
    .lt('report_count', 5)
    .order('last_activity_at', { ascending: false })
    .limit(80)

  if (candidateError) {
    return Response.json(
      { ok: false, error: 'failed_to_load_posts', detail: candidateError.message },
      { status: 500 },
    )
  }

  const candidates = (candidateRows ?? []) as Array<CandidatePost & { hidden?: boolean; status?: string }>
  const filteredCandidates: Array<CandidatePost & { commentCount: number; balanceScore: number }> = []

  for (const post of candidates) {
    const postId = Number(post.id)
    if (!Number.isFinite(postId) || blockedPostIds.has(postId)) continue

    const leftVotes = toSafeNumber(post.left_votes)
    const rightVotes = toSafeNumber(post.right_votes)
    const totalVotes = leftVotes + rightVotes
    if (totalVotes > 0) {
      const ratio = leftVotes / totalVotes
      if (ratio <= 0.2 || ratio >= 0.8) continue
    }

    const { count, error: countError } = await supabaseAdmin
      .from('comments')
      .select('*', { count: 'exact', head: true })
      .eq('post_id', postId)
      .eq('hidden', false)

    if (countError) continue
    const commentCount = Number(count ?? 0)
    if (commentCount < 2) continue

    filteredCandidates.push({
      ...post,
      commentCount,
      balanceScore: calcBalanceScore(leftVotes, rightVotes),
    })
  }

  if (filteredCandidates.length === 0) {
    return Response.json({ ok: true, processed: 0, inserted: 0 })
  }

  filteredCandidates.sort((a, b) => {
    if (a.balanceScore !== b.balanceScore) return a.balanceScore - b.balanceScore
    if (a.commentCount !== b.commentCount) return b.commentCount - a.commentCount
    const aActivity = new Date(a.last_activity_at ?? a.created_at ?? 0).getTime()
    const bActivity = new Date(b.last_activity_at ?? b.created_at ?? 0).getTime()
    return bActivity - aActivity
  })

  const target = filteredCandidates[0]
  const targetCategory = toSafeString(target.category) || 'common'
  const targetSide = chooseSide(toSafeNumber(target.left_votes), toSafeNumber(target.right_votes))

  const { data: fragmentRows, error: fragmentError } = await supabaseAdmin
    .from('comment_seed_fragments')
    .select('type, category, side, text')

  const fragments = fragmentError
    ? FALLBACK_FRAGMENTS
    : ((fragmentRows ?? []) as FragmentRow[]).filter((row) => toSafeString(row.text).length > 0)
  const safeFragments = fragments.length > 0 ? fragments : FALLBACK_FRAGMENTS
  const text = composeCommentText(safeFragments, targetCategory, targetSide)

  if (!text) {
    return Response.json({ ok: false, error: 'failed_to_compose_text' }, { status: 500 })
  }

  const insertPayload = {
    post_id: Number(target.id),
    side: targetSide,
    text,
    author: randomPick(AUTHOR_POOL) ?? '익명281',
    author_key: buildAuthorKey(),
    scheduled_at: buildScheduledAt(),
    status: 'scheduled',
  }

  const { error: insertError } = await supabaseAdmin.from('operator_comment_queue').insert(insertPayload)
  if (insertError) {
    return Response.json(
      { ok: false, error: 'failed_to_insert_operator_queue', detail: insertError.message },
      { status: 500 },
    )
  }

  return Response.json({ ok: true, processed: 1, inserted: 1 })
}

export async function GET(request: Request) {
  return runFillJob(request)
}

export async function POST(request: Request) {
  return runFillJob(request)
}
