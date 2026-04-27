import { getSupabaseAdmin } from '@/lib/supabase-admin'

type OperatorCommentQueueRow = {
  id: number
  post_id: number | null
  author: string | null
  author_key: string | null
  side: string | null
  text: string | null
  scheduled_at: string
}

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function unauthorizedResponse() {
  return Response.json({ ok: false, error: 'unauthorized' }, { status: 401 })
}

function toSafeString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function isAuthorized(request: Request, cronSecret: string): boolean {
  const bearerHeader = request.headers.get('authorization')
  const bearerToken = bearerHeader?.startsWith('Bearer ')
    ? bearerHeader.slice('Bearer '.length).trim()
    : ''
  const xCronSecret = request.headers.get('x-cron-secret')?.trim() ?? ''

  return bearerToken === cronSecret || xCronSecret === cronSecret
}

async function runPublishJob(request: Request) {
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
    return Response.json(
      { ok: false, error: 'CRON_SECRET env is missing' },
      { status: 500 },
    )
  }

  if (!isAuthorized(request, cronSecret)) {
    return unauthorizedResponse()
  }

  const nowIso = new Date().toISOString()
  const { data: dueItems, error: dueError } = await supabaseAdmin
    .from('operator_comment_queue')
    .select('id, post_id, author, author_key, side, text, scheduled_at')
    .eq('status', 'scheduled')
    .lte('scheduled_at', nowIso)
    .order('scheduled_at', { ascending: true })
    .limit(1)

  if (dueError) {
    return Response.json(
      { ok: false, error: 'failed_to_load_due_items', detail: dueError.message },
      { status: 500 },
    )
  }

  const queueItems = (dueItems ?? []) as OperatorCommentQueueRow[]
  if (queueItems.length === 0) {
    return Response.json({ ok: true, processed: 0, published: 0, failed: 0, skipped: 0 })
  }

  const item = queueItems[0]
  const now = new Date().toISOString()
  const safePostId = Number(item.post_id ?? 0)

  if (!Number.isFinite(safePostId) || safePostId <= 0) {
    const { error: updateError } = await supabaseAdmin
      .from('operator_comment_queue')
      .update({
        status: 'failed',
        error_message: 'invalid post_id',
        updated_at: now,
      })
      .eq('id', item.id)

    if (updateError) {
      return Response.json(
        { ok: false, error: 'failed_to_update_queue_status', detail: updateError.message },
        { status: 500 },
      )
    }

    return Response.json({ ok: true, processed: 1, published: 0, failed: 1, skipped: 0 })
  }

  const { data: targetPost, error: postLoadError } = await supabaseAdmin
    .from('posts')
    .select('id, hidden')
    .eq('id', safePostId)
    .maybeSingle()

  if (postLoadError) {
    const { error: updateError } = await supabaseAdmin
      .from('operator_comment_queue')
      .update({
        status: 'failed',
        error_message: postLoadError.message,
        updated_at: now,
      })
      .eq('id', item.id)

    if (updateError) {
      return Response.json(
        { ok: false, error: 'failed_to_update_queue_status', detail: updateError.message },
        { status: 500 },
      )
    }

    return Response.json({ ok: true, processed: 1, published: 0, failed: 1, skipped: 0 })
  }

  if (!targetPost || Boolean(targetPost.hidden)) {
    const { error: skipUpdateError } = await supabaseAdmin
      .from('operator_comment_queue')
      .update({
        status: 'failed',
        error_message: 'target post is hidden or not found',
        updated_at: now,
      })
      .eq('id', item.id)

    if (skipUpdateError) {
      return Response.json(
        { ok: false, error: 'failed_to_update_queue_status', detail: skipUpdateError.message },
        { status: 500 },
      )
    }

    return Response.json({ ok: true, processed: 1, published: 0, failed: 0, skipped: 1 })
  }

  const insertPayload = {
    post_id: safePostId,
    author: toSafeString(item.author) || '익명',
    author_key: toSafeString(item.author_key) || `operator_queue_${item.id}`,
    side: toSafeString(item.side),
    text: toSafeString(item.text),
  }

  const { data: insertedComment, error: insertCommentError } = await supabaseAdmin
    .from('comments')
    .insert(insertPayload)
    .select('id')
    .single()

  if (insertCommentError) {
    const { error: updateError } = await supabaseAdmin
      .from('operator_comment_queue')
      .update({
        status: 'failed',
        error_message: insertCommentError.message,
        updated_at: now,
      })
      .eq('id', item.id)

    if (updateError) {
      return Response.json(
        { ok: false, error: 'failed_to_update_queue_status', detail: updateError.message },
        { status: 500 },
      )
    }

    return Response.json({ ok: true, processed: 1, published: 0, failed: 1, skipped: 0 })
  }

  const insertedCommentId = Number(insertedComment.id)
  const { error: updatePostError } = await supabaseAdmin
    .from('posts')
    .update({ last_activity_at: now })
    .eq('id', safePostId)

  if (updatePostError) {
    const { error: updateError } = await supabaseAdmin
      .from('operator_comment_queue')
      .update({
        status: 'failed',
        error_message: updatePostError.message,
        updated_at: now,
      })
      .eq('id', item.id)

    if (updateError) {
      return Response.json(
        { ok: false, error: 'failed_to_update_queue_status', detail: updateError.message },
        { status: 500 },
      )
    }

    return Response.json({ ok: true, processed: 1, published: 0, failed: 1, skipped: 0 })
  }

  const { error: queueUpdateError } = await supabaseAdmin
    .from('operator_comment_queue')
    .update({
      status: 'published',
      published_at: now,
      comment_id: insertedCommentId,
      error_message: null,
      updated_at: now,
    })
    .eq('id', item.id)

  if (queueUpdateError) {
    return Response.json(
      { ok: false, error: 'failed_to_update_queue_status', detail: queueUpdateError.message },
      { status: 500 },
    )
  }

  return Response.json({ ok: true, processed: 1, published: 1, failed: 0, skipped: 0 })
}

export async function GET(request: Request) {
  return runPublishJob(request)
}

export async function POST(request: Request) {
  return runPublishJob(request)
}
