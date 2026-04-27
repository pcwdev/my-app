import { getSupabaseAdmin } from '@/lib/supabase-admin'

type QueueRow = {
  id: number
  target_type: 'post' | 'comment'
  post_id: number | null
  payload: Record<string, unknown>
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

function toSafeNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
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
    .from('seed_content_queue')
    .select('id, target_type, post_id, payload, scheduled_at')
    .eq('status', 'scheduled')
    .eq('target_type', 'post')
    .lte('scheduled_at', nowIso)
    .order('scheduled_at', { ascending: true })
    .limit(1)

  if (dueError) {
    return Response.json(
      { ok: false, error: 'failed_to_load_due_items', detail: dueError.message },
      { status: 500 },
    )
  }

  const queueItems = (dueItems ?? []) as QueueRow[]
  if (queueItems.length === 0) {
    return Response.json({ ok: true, processed: 0, published: 0, failed: 0 })
  }

  let published = 0
  let failed = 0

  for (const item of queueItems) {
    let logStatus: 'published' | 'failed' = 'published'
    let logError: string | null = null
    let publishedPostId: number | null = null
    let publishedCommentId: number | null = null

    try {
      if (item.target_type === 'post') {
        const postPayload = item.payload ?? {}
        const postAuthor = toSafeString(postPayload.author) || '익명'
        const postLastActivityAt =
          toSafeString(postPayload.last_activity_at) ||
          toSafeString(postPayload.created_at) ||
          new Date().toISOString()

        const { data: insertedPost, error: insertPostError } = await supabaseAdmin
          .from('posts')
          .insert({
            category: toSafeString(postPayload.category) || null,
            age_group: toSafeString(postPayload.age_group) || null,
            title: toSafeString(postPayload.title),
            content:
              toSafeString(postPayload.content) ||
              toSafeString(postPayload.body) ||
              toSafeString(postPayload.description) ||
              '',
            left_label: toSafeString(postPayload.left_label),
            right_label: toSafeString(postPayload.right_label),
            left_votes: toSafeNumber(postPayload.left_votes, 0),
            right_votes: toSafeNumber(postPayload.right_votes, 0),
            likes: toSafeNumber(postPayload.likes, 0),
            views: toSafeNumber(postPayload.views, 0),
            reaction_count: toSafeNumber(postPayload.reaction_count, 0),
            outcome_count: toSafeNumber(postPayload.outcome_count, 0),
            author: postAuthor,
            author_key: toSafeString(postPayload.author_key) || null,
            status: toSafeString(postPayload.status) || 'active',
            hidden: false,
            report_count: 0,
            last_activity_at: postLastActivityAt,
          })
          .select('id')
          .single()

        if (insertPostError) {
          throw insertPostError
        }

        publishedPostId = Number(insertedPost.id)
        const rawComments = Array.isArray(postPayload.comments) ? postPayload.comments : []
        if (rawComments.length > 0) {
          const commentRows = rawComments.map((comment, index) => {
            const commentObject =
              comment && typeof comment === 'object'
                ? (comment as Record<string, unknown>)
                : ({} as Record<string, unknown>)
            const commentCreatedAt =
              toSafeString(commentObject.created_at) || new Date().toISOString()

            return {
              post_id: publishedPostId,
              author: toSafeString(commentObject.author) || '익명',
              author_key:
                toSafeString(commentObject.author_key) || `seed_queue_comment_${item.id}_${index + 1}`,
              side: toSafeString(commentObject.side),
              text: toSafeString(commentObject.text),
              created_at: commentCreatedAt,
            }
          })

          const { data: insertedComments, error: insertCommentsError } = await supabaseAdmin
            .from('comments')
            .insert(commentRows)
            .select('id')

          if (insertCommentsError) {
            throw insertCommentsError
          }

          if ((insertedComments ?? []).length > 0) {
            publishedCommentId = Number(insertedComments?.[0]?.id ?? null)
          }
        }
      } else {
        const commentPayload = item.payload ?? {}
        const fallbackCommentAuthorKey = `seed_queue_comment_${item.id}`
        const commentAuthorKey =
          toSafeString(commentPayload.author_key) || fallbackCommentAuthorKey
        const resolvedPostId = Number(commentPayload.post_id ?? item.post_id ?? 0)
        if (!Number.isFinite(resolvedPostId) || resolvedPostId <= 0) {
          throw new Error('invalid comment post_id')
        }

        const { data: insertedComment, error: insertCommentError } = await supabaseAdmin
          .from('comments')
          .insert({
            post_id: resolvedPostId,
            content: toSafeString(commentPayload.content),
            hidden: false,
            report_count: 0,
            author_key: commentAuthorKey,
          })
          .select('id')
          .single()

        if (insertCommentError) {
          throw insertCommentError
        }

        publishedCommentId = Number(insertedComment.id)
      }
    } catch (error) {
      logStatus = 'failed'
      logError = error instanceof Error ? error.message : 'unknown_error'
    }

    const { error: logErrorInsert } = await supabaseAdmin
      .from('scheduled_publish_log')
      .insert({
        queue_id: item.id,
        target_type: item.target_type,
        target_post_id: publishedPostId,
        target_comment_id: publishedCommentId,
        status: logStatus,
        error_message: logError,
      })

    if (logErrorInsert) {
      return Response.json(
        {
          ok: false,
          error: 'failed_to_write_publish_log',
          detail: logErrorInsert.message,
          queueId: item.id,
        },
        { status: 500 },
      )
    }

    const { error: queueUpdateError } = await supabaseAdmin
      .from('seed_content_queue')
      .update({
        status: logStatus,
        published_at: logStatus === 'published' ? new Date().toISOString() : null,
        error_message: logError,
      })
      .eq('id', item.id)

    if (queueUpdateError) {
      return Response.json(
        {
          ok: false,
          error: 'failed_to_update_queue_status',
          detail: queueUpdateError.message,
          queueId: item.id,
        },
        { status: 500 },
      )
    }

    if (logStatus === 'published') {
      published += 1
    } else {
      failed += 1
    }
  }

  return Response.json({
    ok: true,
    processed: queueItems.length,
    published,
    failed,
  })
}

export async function GET(request: Request) {
  return runPublishJob(request)
}

export async function POST(request: Request) {
  return runPublishJob(request)
}
