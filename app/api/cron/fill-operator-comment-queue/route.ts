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

const FALLBACK_FRAGMENTS: FragmentRow[] = [
  { type: 'starter', category: 'common', side: null, text: '이건 좀 애매한데' },
  { type: 'judgement', category: 'common', side: null, text: '솔직히 저건 서운하지' },
  { type: 'ending', category: 'common', side: null, text: '나라면 선 긋는다' },
  { type: 'reaction', category: 'common', side: null, text: '근데 이건 반대로 봐도 빡셈' },
  { type: 'reply', category: 'common', side: null, text: '한두 번이면 몰라도 반복이면 문제임' },
]

/** 금지 포함어 — 너무 범용적이거나 AI스러운 표현 */
const BANNED_SUBSTRINGS = [
  '양쪽 다 이해',
  '기준',
  '사람마다',
  '상황에 따라',
  '의미 부여',
  '성향 차이',
  '확인받으려는 게 반복되면 피곤함',
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

function randomThreeDigits(): string {
  return String(Math.floor(Math.random() * 1000)).padStart(3, '0')
}

/** 85% 익명### , 15% 공감### 만 사용 */
function buildAuthorName(): string {
  return Math.random() < 0.85 ? `익명${randomThreeDigits()}` : `공감${randomThreeDigits()}`
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

/** 연애/관계 글로 보는 카테고리 — judgement 필터 완화용 */
function isRomanceCategory(categoryLabel: string): boolean {
  const c = categoryLabel.normalize('NFKC').toLowerCase()
  return (
    /연애|데이트|남친|여친|커플|썸|사귀|소개팅/.test(c) ||
    /카톡|애인|연락|답장|읽씹/.test(categoryLabel)
  )
}

/** 비연애 글에서 배제할 조각 — 연애톤 키워드가 들어간 조각 */
function isRomanceOnlyToneFragment(row: FragmentRow): boolean {
  const cat = (row.category ?? '').normalize('NFKC')
  const t = row.text.normalize('NFKC')
  if (/연애/.test(cat)) return true
  return /카톡|애인|연애|남친|여친|답장|확인받/.test(t)
}

function hasBannedSubstring(text: string): boolean {
  const n = text.normalize('NFKC').toLowerCase()
  return BANNED_SUBSTRINGS.some((b) => n.includes(b.normalize('NFKC').toLowerCase()))
}

function normalizeForDup(text: string): string {
  return text.normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase()
}

/** 긴 공통 부분 문자열이면 같은 judgement 반복으로 간주 */
function isOverlappingDuplicate(a: string, b: string): boolean {
  const na = normalizeForDup(a)
  const nb = normalizeForDup(b)
  if (!na.length || !nb.length) return false
  const shorter = na.length <= nb.length ? na : nb
  const longer = na.length <= nb.length ? nb : na
  const win = Math.min(28, shorter.length)
  if (win < 14) return false
  for (let len = win; len >= 14; len--) {
    for (let i = 0; i <= shorter.length - len; i++) {
      const chunk = shorter.slice(i, i + len)
      if (longer.includes(chunk)) return true
    }
  }
  return false
}

function isDuplicateAgainstRecent(composed: string, recentTexts: string[]): boolean {
  const n = normalizeForDup(composed)
  if (!n.length) return true
  for (const r of recentTexts) {
    if (normalizeForDup(composed) === normalizeForDup(r)) return true
    if (isOverlappingDuplicate(composed, r)) return true
  }
  return false
}

function filterFragmentsForPost(
  fragments: FragmentRow[],
  categoryLabel: string,
): FragmentRow[] {
  const romanceOk = isRomanceCategory(categoryLabel)
  return fragments.filter((row) => {
    const t = row.text
    if (!toSafeString(t)) return false
    if (hasBannedSubstring(t)) return false
    if (!romanceOk && isRomanceOnlyToneFragment(row)) return false
    return true
  })
}

function shuffleFragments(frags: FragmentRow[], seedSalt: number): FragmentRow[] {
  const arr = [...frags]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = ((seedSalt * 9301 + i * 49297) >>> 0) % (i + 1)
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
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

async function loadRecentQueueTexts(
  supabaseAdmin: ReturnType<typeof getSupabaseAdmin>,
  seventyTwoHoursAgoIso: string,
): Promise<string[]> {
  const primary = await supabaseAdmin
    .from('operator_comment_queue')
    .select('text')
    .gte('created_at', seventyTwoHoursAgoIso)

  if (!primary.error && primary.data) {
    return (primary.data as { text?: string | null }[])
      .map((row) => toSafeString(row.text))
      .filter(Boolean)
  }

  const fb = await supabaseAdmin
    .from('operator_comment_queue')
    .select('text')
    .order('id', { ascending: false })
    .limit(250)

  if (fb.error) return []
  return (fb.data as { text?: string | null }[])
    .map((row) => toSafeString(row.text))
    .filter(Boolean)
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
  const seventyTwoHoursAgoIso = new Date(now - 72 * 60 * 60 * 1000).toISOString()

  const recentQueueTexts = await loadRecentQueueTexts(supabaseAdmin, seventyTwoHoursAgoIso)

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

  const { data: fragmentRows, error: fragmentError } = await supabaseAdmin
    .from('comment_seed_fragments')
    .select('fragment_type, category, side, content')

  const rawFragments = fragmentError
    ? FALLBACK_FRAGMENTS
    : ((fragmentRows ?? []).map((row) => {
        const source = row as {
          fragment_type?: unknown
          category?: unknown
          side?: unknown
          content?: unknown
        }
        return {
          type: toSafeString(source.fragment_type),
          category: toSafeString(source.category) || 'common',
          side: toSafeString(source.side) || null,
          text: toSafeString(source.content),
        } as FragmentRow
      }) as FragmentRow[]).filter((row) => toSafeString(row.text).length > 0)

  const baseFragments = rawFragments.length > 0 ? rawFragments : FALLBACK_FRAGMENTS

  const MAX_ATTEMPTS = 5

  for (const target of filteredCandidates) {
    const targetCategory = toSafeString(target.category) || 'common'
    const targetSide = chooseSide(toSafeNumber(target.left_votes), toSafeNumber(target.right_votes))

    const filteredFragments = filterFragmentsForPost(baseFragments, targetCategory)
    if (filteredFragments.length < 3) continue

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const seed = target.id * 7919 + attempt * 65537 + Math.floor(now / 60000)
      const frags = shuffleFragments(filteredFragments, seed)
      const text = composeCommentText(frags, targetCategory, targetSide)

      if (!text.trim()) continue
      if (hasBannedSubstring(text)) continue
      if (isDuplicateAgainstRecent(text, recentQueueTexts)) continue

      const insertPayload = {
        post_id: Number(target.id),
        side: targetSide,
        text,
        author: buildAuthorName(),
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
  }

  return Response.json({ ok: true, processed: 1, inserted: 0 })
}

export async function GET(request: Request) {
  return runFillJob(request)
}

export async function POST(request: Request) {
  return runFillJob(request)
}
