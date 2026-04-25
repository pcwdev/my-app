'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  BarChart3,
  Flag,
  Flame,
  MessageCircle,
  MoreHorizontal,
  Plus,
  Send,
  Shield,
  User,
  X,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'

const LIMITS = {
  title: 32,
  content: 220,
  option: 12,
  comment: 60,
}

const categories = ['연애', '직장', '돈', '인간관계', '기타']
const categoryFilters = ['전체']
const ageGroups = ['10대', '20대', '30대', '40대', '50대+']
const reportReasons = [
  '욕설/비방',
  '개인정보 노출',
  '허위사실',
  '음란/부적절',
  '도배/광고',
]

const inquiryTypeMeta: Record<
  InquiryType,
  { label: string; helper: string; placeholder: string }
> = {
  bug: {
    label: '버그 신고',
    helper: '화면 오류나 기능 문제가 있다면 알려주세요.',
    placeholder: '어떤 화면에서 어떤 문제가 생겼는지 적어주세요.',
  },
  general: {
    label: '운영 문의',
    helper: '서비스 이용 중 궁금한 점이나 운영 관련 의견을 남겨주세요.',
    placeholder: '문의하거나 제안하고 싶은 내용을 적어주세요.',
  },
  partnership: {
    label: '제안 및 제휴',
    helper: '맞냐와 함께할 좋은 제안이 있다면 알려주세요.',
    placeholder: '제안 내용, 협업 방식, 연락 가능한 정보를 적어주세요.',
  },
}

const inquiryStatusMeta: Record<
  InquiryStatus,
  { label: string; className: string }
> = {
  pending: {
    label: '접수됨',
    className: 'border-slate-200 bg-slate-50 text-slate-600',
  },
  reviewing: {
    label: '확인중',
    className: 'border-blue-200 bg-blue-50 text-blue-700',
  },
  resolved: {
    label: '처리완료',
    className: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  },
  rejected: {
    label: '보류',
    className: 'border-amber-200 bg-amber-50 text-amber-700',
  },
}

const INITIAL_COMMENT_BATCH = 20
const REPORT_HIDE_THRESHOLD = 3

const STORAGE_KEYS = {
  voterKey: 'matnya_voter_key',
  guestName: 'matnya_guest_name',
  shareInboxSeen: 'matnya_share_inbox_seen_v1',
}

const PREFIXES = [
  '익명',
  '판단',
  '냉정',
  '현실',
  '직설',
  '공감',
  '한마디',
  '썰쟁이',
]

type Side = 'left' | 'right'
type VoteSide = 'left' | 'right'

type CommentItem = {
  id: number
  author: string
  authorKey?: string | null
  side: Side
  text: string
  likes: number
  reportCount: number
  hidden: boolean
  createdAt?: string | null
  replyToCommentId?: number | null
}

type CommentReactionType = 'agree' | 'disagree' | 'wow' | 'relatable' | 'absurd'

type PostReactionType =
  | 'controversial'
  | 'curious'
  | 'suspicious'
  | 'minority'
  | 'shareworthy'

type CommentReactionSummary = Record<CommentReactionType, number>

type PostReactionSummary = {
  controversial: number
  curious: number
  suspicious: number
  minority: number
  shareworthy: number
}

type PostOutcomeItem = {
  id: number
  postId: number
  outcomeType: 'resolved' | 'update' | 'author_followup' | 'twist'
  summary: string
  createdAt: string | null
}

type UserStreakRow = {
  streakType:
    | 'daily_visit'
    | 'daily_vote'
    | 'consecutive_votes'
    | 'majority_hit'
    | 'minority_pick'
  currentCount: number
  bestCount: number
  lastActionAt?: string | null
}

type NextQueueItem = {
  fromPostId: number
  toPostId: number
  reasonType:
    | 'hot'
    | 'controversial'
    | 'same_category'
    | 'opposite_majority'
    | 'comment_burst'
    | 'followup'
  score: number
}

type WatchlistItem = {
  id: number
  postId: number
  title: string
  category: string
  ageGroup: string
  createdAt: string | null
  latestOutcomeType: PostOutcomeItem['outcomeType'] | null
  latestOutcomeSummary: string | null
  latestOutcomeCreatedAt: string | null
  hasOutcome: boolean
  unreadOutcome: boolean
  watchStatus: 'waiting' | 'updated' | 'archived'
  archivedAt: string | null
}

type PostItem = {
  id: number
  category: string
  ageGroup: string
  title: string
  content: string
  leftLabel: string
  rightLabel: string
  leftVotes: number
  rightVotes: number
  reportCount: number
  hidden: boolean
  authorKey?: string | null
  comments: CommentItem[]
  views: number
}

type VoteRow = {
  post_id: number
  voter_key: string
  side: VoteSide
}

type ProfileRow = {
  id: string
  email: string | null
  anonymous_name: string
  role: 'user' | 'admin'
}

type InquiryType = 'bug' | 'general' | 'partnership'
type InquiryStatus = 'pending' | 'reviewing' | 'resolved' | 'rejected'

type InquiryRow = {
  id: number
  inquiry_type: InquiryType
  title: string
  content: string
  contact: string | null
  page_url: string | null
  user_agent: string | null
  reporter_key: string | null
  status: InquiryStatus
  admin_note: string | null
  created_at: string | null
  resolved_at: string | null
}

type MyPostItem = {
  id: number
  postId: number
  title: string
  category: string
  ageGroup: string
  hasNewComments?: boolean
  newCommentsCount?: number
  totalCommentsCount?: number
}

type MyCommentItem = {
  id: number
  commentId: number
  postId: number
  postTitle: string
  text: string
  hasNewReplies?: boolean
  newRepliesCount?: number
  totalRepliesCount?: number
}

type UserActivityReadRow = {
  id: number
  actor_key: string
  target_type: 'post' | 'comment'
  target_id: number
  last_seen_at: string | null
}

type DeletedCommentItem = {
  id: number
  postId: number
  postTitle: string
  author: string
  text: string
}

type UserStatsRow = {
  id: string
  user_id: string | null
  voter_key: string | null
  points: number
  level: number
  votes_count: number
  comments_count: number
  posts_count: number
  likes_received: number
  created_at?: string
}

type UserBadgeRow = {
  id: string
  user_id: string | null
  voter_key: string | null
  badge_name: string
  created_at?: string
}

type HotScoreRow = {
  post_id: number
  score: number
  view_1h: number
  vote_1h: number
  comment_1h: number
  share_24h: number
  controversy_ratio: number
  updated_at?: string | null
}

type TurningPointRow = {
  post_id: number
  event_label: string
  leader_side: 'left' | 'right' | 'tie' | null
  snapshot_left_votes: number
  snapshot_right_votes: number
  created_at?: string | null
}

type HotMeta = {
  score: number
  view1h: number
  vote1h: number
  comment1h: number
  share24h: number
  controversyRatio: number
  updatedAt: string | null
}

type TurningPointMeta = {
  eventLabel: string
  leaderSide: 'left' | 'right' | 'tie' | null
  leftVotes: number
  rightVotes: number
  createdAt: string | null
}

type PostFlipEventItem = {
  postId: number
  beforeLeader: 'left' | 'right' | 'tie' | null
  afterLeader: 'left' | 'right' | 'tie' | null
  beforeLeftVotes: number
  beforeRightVotes: number
  afterLeftVotes: number
  afterRightVotes: number
  createdAt: string | null
}

type ShadowWatchItem = {
  postId: number
  viewCount: number
  isAutoSaved: boolean
  firstSeenAt: string | null
  lastSeenAt: string | null
}

type ChoicePathTopItem = {
  fromPostId: number
  toPostId: number
  chosenSide: VoteSide
  count: number
}

type PostTensionState = {
  postId: number
  tensionType: 'flip_imminent' | 'tight' | 'brawl' | 'leaning' | 'landslide'
  voteDiff: number
  totalVotes: number
  isFlipImminent: boolean
  updatedAt: string | null
}

type ResultUnlockItem = {
  postId: number
  voterKey: string
  unlockLevel: number
  commentReads: number
  isWatchlisted: boolean
  createdAt: string | null
  updatedAt: string | null
}

type ResultRevealStage = {
  level: number
  label: string
  helper: string
  toneClass: string
  leftValue: number
  rightValue: number
  showExact: boolean
  showOutcome: boolean
}

type ResultUnlockPatch = {
  unlockLevel?: number
  commentReadsDelta?: number
  forceCommentReads?: number
  isWatchlisted?: boolean
}

type AuthorMeta = {
  level: number
  badgeName: string | null
}

function getAuthorMetaKey(author: string, authorKey?: string | null) {
  return authorKey && String(authorKey).trim()
    ? `key:${String(authorKey).trim()}`
    : `name:${(author || '').trim()}`
}

const LEVELS = [
  { level: 1, min: 0, label: '새싹' },
  { level: 2, min: 10, label: '입문자' },
  { level: 3, min: 30, label: '판단러' },
  { level: 4, min: 60, label: '의견쟁이' },
  { level: 5, min: 100, label: '반응유저' },
  { level: 6, min: 160, label: '논쟁참여자' },
  { level: 7, min: 250, label: '공감수집가' },
  { level: 8, min: 400, label: '판정고수' },
  { level: 9, min: 600, label: '논쟁지배자' },
  { level: 10, min: 1000, label: '맞냐장인' },
]

const BADGE_RULES = [
  { name: '첫 판단', check: (s: UserStatsRow) => s.votes_count >= 1 },
  { name: '판단러', check: (s: UserStatsRow) => s.votes_count >= 10 },
  { name: '판단중독', check: (s: UserStatsRow) => s.votes_count >= 50 },
  { name: '첫 댓글', check: (s: UserStatsRow) => s.comments_count >= 1 },
  { name: '댓글러', check: (s: UserStatsRow) => s.comments_count >= 10 },
  { name: '키보드전사', check: (s: UserStatsRow) => s.comments_count >= 50 },
  { name: '첫 글', check: (s: UserStatsRow) => s.posts_count >= 1 },
  { name: '썰장인', check: (s: UserStatsRow) => s.posts_count >= 5 },
  { name: '공감받기 시작', check: (s: UserStatsRow) => s.likes_received >= 10 },
  { name: '반응유발자', check: (s: UserStatsRow) => s.likes_received >= 50 },
  { name: '댓글스타', check: (s: UserStatsRow) => s.likes_received >= 100 },
] as const

function getOrCreateVoterKey(): string {
  if (typeof window === 'undefined') return 'server'
  const saved = window.localStorage.getItem(STORAGE_KEYS.voterKey)
  if (saved) return saved

  const newKey =
    'vk_' + Math.random().toString(36).slice(2) + Date.now().toString(36)

  window.localStorage.setItem(STORAGE_KEYS.voterKey, newKey)
  return newKey
}

function makeAnonymousName() {
  const prefix = PREFIXES[Math.floor(Math.random() * PREFIXES.length)]
  const suffix = Math.floor(100 + Math.random() * 900)
  return `${prefix}${suffix}`
}

function getOrCreateGuestName() {
  if (typeof window === 'undefined') return '익명000'
  const saved = window.localStorage.getItem(STORAGE_KEYS.guestName)
  if (saved) return saved

  const newName = makeAnonymousName()
  window.localStorage.setItem(STORAGE_KEYS.guestName, newName)
  return newName
}

function isKakaoInAppBrowser() {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent || ''
  return /KAKAOTALK/i.test(ua)
}

function mergeResultUnlockPatch(
  base: ResultUnlockPatch | undefined,
  next: ResultUnlockPatch,
): ResultUnlockPatch {
  return {
    unlockLevel:
      Math.max(Number(base?.unlockLevel ?? 0), Number(next.unlockLevel ?? 0)) ||
      undefined,
    commentReadsDelta:
      Number(base?.commentReadsDelta ?? 0) +
        Number(next.commentReadsDelta ?? 0) || undefined,
    forceCommentReads:
      typeof next.forceCommentReads === 'number'
        ? next.forceCommentReads
        : base?.forceCommentReads,
    isWatchlisted:
      typeof next.isWatchlisted === 'boolean'
        ? next.isWatchlisted
        : base?.isWatchlisted,
  }
}

async function signInWithGoogle() {
  const origin =
    typeof window !== 'undefined' ? window.location.origin : undefined

  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: origin,
    },
  })

  if (error) throw error
}

async function signOutAuth() {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

async function ensureProfile() {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError) throw userError
  if (!user) return { user: null, profile: null }

  const { data: existing, error: existingError } = await supabase
    .from('profiles')
    .select('id, email, anonymous_name, role')
    .eq('id', user.id)
    .maybeSingle()

  if (existingError) throw existingError

  if (existing) {
    return { user, profile: existing as ProfileRow }
  }

  const { data: inserted, error: insertError } = await supabase
    .from('profiles')
    .insert({
      id: user.id,
      email: user.email ?? null,
      anonymous_name: makeAnonymousName(),
      role: 'user',
    })
    .select('id, email, anonymous_name, role')
    .single()

  if (insertError) throw insertError

  return { user, profile: inserted as ProfileRow }
}

async function migrateGuestActivityToAccount(params: {
  voterKey: string
  userId: string
}) {
  const guestActorKey = `voter:${params.voterKey}`
  const userActorKey = `user:${params.userId}`

  const failIfError = (error: any, label: string) => {
    if (error) {
      console.error(label, error)
      throw error
    }
  }

  let migratedCount = 0

  const [
    guestWatchlistRes,
    userWatchlistRes,
    guestUnlockRes,
    userUnlockRes,
    guestPostReactionRes,
    guestCommentReactionRes,
    guestStreakRes,
    userStreakRes,
    guestStatsRes,
    userStatsRes,
    guestBadgesRes,
    userBadgesRes,
  ] = await Promise.all([
    supabase
      .from('post_watchlist')
      .select('post_id, watch_type, created_at, watch_status, archived_at')
      .eq('actor_key', guestActorKey),
    supabase
      .from('post_watchlist')
      .select('post_id, watch_type, created_at, watch_status, archived_at')
      .eq('actor_key', userActorKey),
    supabase
      .from('post_result_unlocks')
      .select(
        'post_id, unlock_level, comment_reads, is_watchlisted, created_at, updated_at',
      )
      .eq('voter_key', guestActorKey),
    supabase
      .from('post_result_unlocks')
      .select(
        'post_id, unlock_level, comment_reads, is_watchlisted, created_at, updated_at',
      )
      .eq('voter_key', userActorKey),
    supabase
      .from('post_reactions')
      .select('post_id, reaction_type')
      .eq('reactor_key', guestActorKey),
    supabase
      .from('comment_reactions')
      .select('comment_id, reaction_type')
      .eq('reactor_key', guestActorKey),
    supabase
      .from('user_streaks')
      .select('streak_type, current_count, best_count, last_action_at')
      .eq('actor_key', guestActorKey),
    supabase
      .from('user_streaks')
      .select('streak_type, current_count, best_count, last_action_at')
      .eq('actor_key', userActorKey),
    supabase
      .from('user_stats')
      .select('*')
      .eq('voter_key', params.voterKey)
      .limit(1)
      .maybeSingle(),
    supabase
      .from('user_stats')
      .select('*')
      .eq('user_id', params.userId)
      .limit(1)
      .maybeSingle(),
    supabase
      .from('user_badges')
      .select('badge_name')
      .eq('voter_key', params.voterKey),
    supabase
      .from('user_badges')
      .select('badge_name')
      .eq('user_id', params.userId),
  ])

  failIfError(guestWatchlistRes.error, 'guest watchlist 조회 실패')
  failIfError(userWatchlistRes.error, 'user watchlist 조회 실패')
  failIfError(guestUnlockRes.error, 'guest result unlock 조회 실패')
  failIfError(userUnlockRes.error, 'user result unlock 조회 실패')
  failIfError(guestPostReactionRes.error, 'guest post reactions 조회 실패')
  failIfError(
    guestCommentReactionRes.error,
    'guest comment reactions 조회 실패',
  )
  failIfError(guestStreakRes.error, 'guest streak 조회 실패')
  failIfError(userStreakRes.error, 'user streak 조회 실패')
  failIfError(guestStatsRes.error, 'guest user_stats 조회 실패')
  failIfError(userStatsRes.error, 'user user_stats 조회 실패')
  failIfError(guestBadgesRes.error, 'guest badges 조회 실패')
  failIfError(userBadgesRes.error, 'user badges 조회 실패')

  const watchStatusRank: Record<string, number> = {
    updated: 3,
    waiting: 2,
    archived: 1,
  }

  const mergedWatchlistMap = new Map<string, any>()

  ;(userWatchlistRes.data ?? []).forEach((row: any) => {
    mergedWatchlistMap.set(`${row.post_id}:${row.watch_type ?? 'curious'}`, {
      post_id: row.post_id,
      actor_key: userActorKey,
      watch_type: row.watch_type ?? 'curious',
      created_at: row.created_at ?? null,
      watch_status: row.watch_status ?? 'waiting',
      archived_at: row.archived_at ?? null,
    })
  })
  ;(guestWatchlistRes.data ?? []).forEach((row: any) => {
    const key = `${row.post_id}:${row.watch_type ?? 'curious'}`
    const prev = mergedWatchlistMap.get(key)

    if (!prev) {
      mergedWatchlistMap.set(key, {
        post_id: row.post_id,
        actor_key: userActorKey,
        watch_type: row.watch_type ?? 'curious',
        created_at: row.created_at ?? null,
        watch_status: row.watch_status ?? 'waiting',
        archived_at: row.archived_at ?? null,
      })
      migratedCount += 1
      return
    }

    const nextStatus =
      (watchStatusRank[row.watch_status ?? 'waiting'] ?? 0) >
      (watchStatusRank[prev.watch_status ?? 'waiting'] ?? 0)
        ? (row.watch_status ?? 'waiting')
        : (prev.watch_status ?? 'waiting')

    mergedWatchlistMap.set(key, {
      ...prev,
      created_at:
        [prev.created_at, row.created_at].filter(Boolean).sort()[0] ??
        prev.created_at ??
        row.created_at ??
        null,
      watch_status: nextStatus,
      archived_at:
        nextStatus === 'archived'
          ? ([prev.archived_at, row.archived_at]
              .filter(Boolean)
              .sort()
              .reverse()[0] ?? null)
          : null,
    })
    migratedCount += 1
  })

  if (mergedWatchlistMap.size > 0) {
    const { error } = await supabase
      .from('post_watchlist')
      .upsert(Array.from(mergedWatchlistMap.values()), {
        onConflict: 'actor_key,post_id,watch_type',
      })
    failIfError(error, 'watchlist 병합 저장 실패')
  }

  const mergedUnlockMap = new Map<number, any>()

  ;(userUnlockRes.data ?? []).forEach((row: any) => {
    mergedUnlockMap.set(Number(row.post_id), {
      post_id: Number(row.post_id),
      voter_key: userActorKey,
      unlock_level: Number(row.unlock_level ?? 0),
      comment_reads: Number(row.comment_reads ?? 0),
      is_watchlisted: !!row.is_watchlisted,
      created_at: row.created_at ?? null,
      updated_at: row.updated_at ?? null,
    })
  })
  ;(guestUnlockRes.data ?? []).forEach((row: any) => {
    const postId = Number(row.post_id)
    const prev = mergedUnlockMap.get(postId)

    if (!prev) {
      mergedUnlockMap.set(postId, {
        post_id: postId,
        voter_key: userActorKey,
        unlock_level: Number(row.unlock_level ?? 0),
        comment_reads: Number(row.comment_reads ?? 0),
        is_watchlisted: !!row.is_watchlisted,
        created_at: row.created_at ?? null,
        updated_at: row.updated_at ?? null,
      })
      migratedCount += 1
      return
    }

    mergedUnlockMap.set(postId, {
      ...prev,
      unlock_level: Math.max(
        Number(prev.unlock_level ?? 0),
        Number(row.unlock_level ?? 0),
      ),
      comment_reads: Math.max(
        Number(prev.comment_reads ?? 0),
        Number(row.comment_reads ?? 0),
      ),
      is_watchlisted: !!prev.is_watchlisted || !!row.is_watchlisted,
      created_at:
        [prev.created_at, row.created_at].filter(Boolean).sort()[0] ??
        prev.created_at ??
        row.created_at ??
        null,
      updated_at:
        [prev.updated_at, row.updated_at].filter(Boolean).sort().reverse()[0] ??
        prev.updated_at ??
        row.updated_at ??
        null,
    })
    migratedCount += 1
  })

  if (mergedUnlockMap.size > 0) {
    const { error } = await supabase
      .from('post_result_unlocks')
      .upsert(Array.from(mergedUnlockMap.values()), {
        onConflict: 'post_id,voter_key',
      })
    failIfError(error, 'result unlock 병합 저장 실패')
  }

  const guestPostReactions = guestPostReactionRes.data ?? []
  if (guestPostReactions.length > 0) {
    const { error } = await supabase.from('post_reactions').upsert(
      guestPostReactions.map((row: any) => ({
        post_id: row.post_id,
        reactor_key: userActorKey,
        reaction_type: row.reaction_type,
      })),
      {
        onConflict: 'post_id,reactor_key,reaction_type',
        ignoreDuplicates: true,
      },
    )
    failIfError(error, 'post reactions 병합 저장 실패')
    migratedCount += guestPostReactions.length
  }

  const guestCommentReactions = guestCommentReactionRes.data ?? []
  if (guestCommentReactions.length > 0) {
    const { error } = await supabase.from('comment_reactions').upsert(
      guestCommentReactions.map((row: any) => ({
        comment_id: row.comment_id,
        reactor_key: userActorKey,
        reaction_type: row.reaction_type,
      })),
      {
        onConflict: 'comment_id,reactor_key,reaction_type',
        ignoreDuplicates: true,
      },
    )
    failIfError(error, 'comment reactions 병합 저장 실패')
    migratedCount += guestCommentReactions.length
  }

  const mergedStreakMap = new Map<string, any>()

  ;(userStreakRes.data ?? []).forEach((row: any) => {
    mergedStreakMap.set(String(row.streak_type), {
      actor_key: userActorKey,
      streak_type: row.streak_type,
      current_count: Number(row.current_count ?? 0),
      best_count: Number(row.best_count ?? 0),
      last_action_at: row.last_action_at ?? null,
    })
  })
  ;(guestStreakRes.data ?? []).forEach((row: any) => {
    const key = String(row.streak_type)
    const prev = mergedStreakMap.get(key)

    if (!prev) {
      mergedStreakMap.set(key, {
        actor_key: userActorKey,
        streak_type: row.streak_type,
        current_count: Number(row.current_count ?? 0),
        best_count: Number(row.best_count ?? 0),
        last_action_at: row.last_action_at ?? null,
      })
      migratedCount += 1
      return
    }

    mergedStreakMap.set(key, {
      actor_key: userActorKey,
      streak_type: row.streak_type,
      current_count: Math.max(
        Number(prev.current_count ?? 0),
        Number(row.current_count ?? 0),
      ),
      best_count: Math.max(
        Number(prev.best_count ?? 0),
        Number(row.best_count ?? 0),
      ),
      last_action_at:
        [prev.last_action_at, row.last_action_at]
          .filter(Boolean)
          .sort()
          .reverse()[0] ??
        prev.last_action_at ??
        row.last_action_at ??
        null,
    })
    migratedCount += 1
  })

  if (mergedStreakMap.size > 0) {
    const { error } = await supabase
      .from('user_streaks')
      .upsert(Array.from(mergedStreakMap.values()), {
        onConflict: 'actor_key,streak_type',
      })
    failIfError(error, 'streak 병합 저장 실패')
  }

  const guestStats = guestStatsRes.data
  const userStats = userStatsRes.data

  if (guestStats || userStats) {
    const totalPoints =
      Number(guestStats?.points ?? 0) + Number(userStats?.points ?? 0)
    const totalVotes =
      Number(guestStats?.votes_count ?? 0) + Number(userStats?.votes_count ?? 0)
    const totalComments =
      Number(guestStats?.comments_count ?? 0) +
      Number(userStats?.comments_count ?? 0)
    const totalPosts =
      Number(guestStats?.posts_count ?? 0) + Number(userStats?.posts_count ?? 0)
    const totalLikes =
      Number(guestStats?.likes_received ?? 0) +
      Number(userStats?.likes_received ?? 0)
    const levelInfo = getLevelInfo(totalPoints)

    const statsPayload = {
      user_id: params.userId,
      voter_key: null,
      points: totalPoints,
      level: levelInfo.level,
      votes_count: totalVotes,
      comments_count: totalComments,
      posts_count: totalPosts,
      likes_received: totalLikes,
    }

    if (userStats?.id) {
      const { error } = await supabase
        .from('user_stats')
        .update(statsPayload)
        .eq('id', userStats.id)
      failIfError(error, 'user_stats 업데이트 실패')
    } else {
      const { error } = await supabase.from('user_stats').insert(statsPayload)
      failIfError(error, 'user_stats 생성 실패')
    }

    if (guestStats?.id) {
      const { error } = await supabase
        .from('user_stats')
        .delete()
        .eq('id', guestStats.id)
      failIfError(error, 'guest user_stats 삭제 실패')
    }

    migratedCount += Number(!!guestStats)
  }

  const userBadgeSet = new Set(
    (userBadgesRes.data ?? []).map((row: any) => String(row.badge_name)),
  )
  const guestBadgeNames = (guestBadgesRes.data ?? []).map((row: any) =>
    String(row.badge_name),
  )
  const badgesToInsert = guestBadgeNames
    .filter((badgeName) => !userBadgeSet.has(badgeName))
    .map((badgeName) => ({
      user_id: params.userId,
      voter_key: null,
      badge_name: badgeName,
    }))

  if (badgesToInsert.length > 0) {
    const { error } = await supabase.from('user_badges').insert(badgesToInsert)
    failIfError(error, 'user_badges 병합 저장 실패')
    migratedCount += badgesToInsert.length
  }

  await Promise.all([
    supabase.from('post_watchlist').delete().eq('actor_key', guestActorKey),
    supabase
      .from('post_result_unlocks')
      .delete()
      .eq('voter_key', guestActorKey),
    supabase.from('post_reactions').delete().eq('reactor_key', guestActorKey),
    supabase
      .from('comment_reactions')
      .delete()
      .eq('reactor_key', guestActorKey),
    supabase.from('user_streaks').delete().eq('actor_key', guestActorKey),
    supabase.from('user_badges').delete().eq('voter_key', params.voterKey),
  ])

  return {
    migratedCount,
  }
}

function percent(
  leftVotes: number,
  rightVotes: number,
): { left: number; right: number } {
  const left = Math.max(0, Number(leftVotes ?? 0))
  const right = Math.max(0, Number(rightVotes ?? 0))
  const total = left + right
  if (total <= 0) return { left: 50, right: 50 }
  return {
    left: Math.round((left / total) * 100),
    right: Math.round((right / total) * 100),
  }
}

function getCounterTone(
  length: number,
  max: number,
  warnAt = 0.7,
  dangerAt = 0.9,
) {
  const ratio = length / max
  if (ratio >= dangerAt) return 'text-red-500'
  if (ratio >= warnAt) return 'text-amber-500'
  return 'text-slate-400'
}

function getLevelInfo(points: number) {
  let current = LEVELS[0]

  for (const item of LEVELS) {
    if (points >= item.min) current = item
  }

  const next = LEVELS.find((item) => item.level === current.level + 1) ?? null

  return {
    level: current.level,
    label: current.label,
    currentMin: current.min,
    nextMin: next?.min ?? current.min,
    nextLabel: next?.label ?? null,
    progress:
      next != null
        ? Math.min(
            100,
            Math.round(
              ((points - current.min) / Math.max(1, next.min - current.min)) *
                100,
            ),
          )
        : 100,
  }
}

function normalizeStats(row?: Partial<UserStatsRow> | null): UserStatsRow {
  const points = Number(row?.points ?? 0)
  const levelInfo = getLevelInfo(points)

  return {
    id: String(row?.id ?? ''),
    user_id: row?.user_id ?? null,
    voter_key: row?.voter_key ?? null,
    points,
    level: Number(row?.level ?? levelInfo.level),
    votes_count: Number(row?.votes_count ?? 0),
    comments_count: Number(row?.comments_count ?? 0),
    posts_count: Number(row?.posts_count ?? 0),
    likes_received: Number(row?.likes_received ?? 0),
    created_at: row?.created_at,
  }
}

type StoredPostSignal = {
  meaningful: boolean
  viewedAt: number
  commentsCount: number
  votesTotal: number
}

type RevisitMeta = {
  label: string
}

type ShareInboxItem = {
  sessionId: string
  postId: number
  title: string
  ownerChoice: VoteSide | null
  createdAt: string | null
  leftCount: number
  rightCount: number
  totalCount: number
  unreadCount: number
  overallLeftCount: number
  overallRightCount: number
  overallTotalCount: number
  leftLabel?: string
  rightLabel?: string
}

const POST_SIGNAL_STORAGE_KEY = 'matnya_post_signals_v1'

function readStoredPostSignal(postId: number): StoredPostSignal | null {
  if (typeof window === 'undefined') return null

  try {
    const raw = window.localStorage.getItem(POST_SIGNAL_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Record<string, StoredPostSignal>
    return parsed[String(postId)] ?? null
  } catch {
    return null
  }
}

function writeStoredPostSignal(
  postId: number,
  patch: Partial<StoredPostSignal>,
) {
  if (typeof window === 'undefined') return

  try {
    const raw = window.localStorage.getItem(POST_SIGNAL_STORAGE_KEY)
    const parsed = raw
      ? (JSON.parse(raw) as Record<string, StoredPostSignal>)
      : {}
    const prev = parsed[String(postId)] ?? {
      meaningful: false,
      viewedAt: 0,
      commentsCount: 0,
      votesTotal: 0,
    }

    parsed[String(postId)] = {
      ...prev,
      ...patch,
    }

    window.localStorage.setItem(POST_SIGNAL_STORAGE_KEY, JSON.stringify(parsed))
  } catch {
    // noop
  }
}

function readShareInboxSeenMap(): Record<string, number> {
  if (typeof window === 'undefined') return {}

  try {
    const raw = window.localStorage.getItem(STORAGE_KEYS.shareInboxSeen)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Record<string, number>
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function writeShareInboxSeenMap(map: Record<string, number>) {
  if (typeof window === 'undefined') return

  try {
    window.localStorage.setItem(
      STORAGE_KEYS.shareInboxSeen,
      JSON.stringify(map),
    )
  } catch {
    // noop
  }
}

function getShareTensionMeta(left: number, right: number) {
  const total = left + right

  if (total === 0) {
    return {
      label: '응답 대기중',
      toneClass: 'border-slate-200 bg-slate-50 text-slate-600',
      helper: '첫 친구 반응이 들어오면 여기서 바로 흐름이 살아남',
    }
  }

  const diffRatio = Math.abs(left - right) / Math.max(total, 1)

  if (diffRatio <= 0.12) {
    return {
      label: '🔥 개싸움',
      toneClass: 'border-rose-200 bg-rose-50 text-rose-700',
      helper: '의견이 거의 반반이라 다시 보내면 더 재밌어짐',
    }
  }

  if (diffRatio <= 0.28) {
    return {
      label: '👀 팽팽',
      toneClass: 'border-amber-200 bg-amber-50 text-amber-700',
      helper: '한두 명만 더 들어와도 분위기 바뀔 수 있음',
    }
  }

  if (diffRatio <= 0.5) {
    return {
      label: '⚡ 기울는 중',
      toneClass: 'border-sky-200 bg-sky-50 text-sky-700',
      helper: '한쪽으로 기울지만 아직 뒤집힐 여지는 있음',
    }
  }

  return {
    label: '😴 한쪽 몰림',
    toneClass: 'border-slate-200 bg-slate-50 text-slate-600',
    helper: '지금은 한쪽 몰림. 다른 친구 반응 받아보면 그림이 달라질 수 있음',
  }
}

function getShareNextActionText(totalCount: number, unreadCount: number) {
  if (unreadCount > 0)
    return `새 응답 ${unreadCount}개 도착 · 🔥 지금 갈리는 중`
  if (totalCount === 0) return '첫 친구 보내기부터 시작하면 여기서 쌓임'
  if (totalCount === 1) return '한 명 더 모이면 진짜 갈리는지 보이기 시작함'
  if (totalCount === 2)
    return '지금부터 재밌는 구간 · 한 명만 더 오면 분위기 선명해짐'
  if (totalCount <= 4) return '결과 보는 재미 구간 · 더 보내면 판이 더 커짐'
  return '이미 판이 열림 · 가장 뜨거운 논쟁인지 확인해봐'
}

function getPercentPair(left: number, right: number) {
  const safeLeft = Math.max(0, Number(left ?? 0))
  const safeRight = Math.max(0, Number(right ?? 0))
  const total = safeLeft + safeRight
  if (total <= 0) return { left: 50, right: 50 }

  return {
    left: Math.round((safeLeft / total) * 100),
    right: Math.round((safeRight / total) * 100),
  }
}

function getOwnerChoiceInsight(
  ownerChoice: VoteSide | null,
  left: number,
  right: number,
  leftLabel?: string,
  rightLabel?: string,
) {
  const ownerLabel =
    ownerChoice === 'left'
      ? (leftLabel ?? '왼쪽')
      : ownerChoice === 'right'
        ? (rightLabel ?? '오른쪽')
        : '선택 안 함'

  const total = left + right

  if (!ownerChoice) {
    return {
      ownerLabel,
      friendLabel: '친구 반응 대기중',
      relationLabel: '아직 비교 전',
      relationTone: 'border-slate-200 bg-slate-50 text-slate-600',
      helper: '내 선택이 저장되면 친구들 의견과 바로 비교됨',
    }
  }

  if (total === 0) {
    return {
      ownerLabel,
      friendLabel: '아직 친구 반응 없음',
      relationLabel: '첫 반응 기다리는 중',
      relationTone: 'border-slate-200 bg-slate-50 text-slate-600',
      helper: '첫 친구가 고르면 내 선택과 바로 비교 가능',
    }
  }

  const friendMajority =
    left === right ? 'tie' : left > right ? 'left' : 'right'
  const friendLabel =
    friendMajority === 'tie'
      ? '친구들 의견 팽팽'
      : friendMajority === 'left'
        ? `${leftLabel ?? '왼쪽'} 우세`
        : `${rightLabel ?? '오른쪽'} 우세`

  if (friendMajority === 'tie') {
    return {
      ownerLabel,
      friendLabel,
      relationLabel: '친구들끼리도 갈리는 중',
      relationTone: 'border-amber-200 bg-amber-50 text-amber-700',
      helper:
        '내 선택이 맞는지 아직 안 끝남. 한 명만 더 와도 흐름 바뀔 수 있음',
    }
  }

  const sameSide = ownerChoice === friendMajority

  return {
    ownerLabel,
    friendLabel,
    relationLabel: sameSide ? '내 선택 쪽이 우세' : '친구들은 반대로 가는 중',
    relationTone: sameSide
      ? 'border-rose-100 bg-emerald-50 text-rose-600'
      : 'border-rose-200 bg-rose-50 text-rose-700',
    helper: sameSide
      ? '내 감이 맞는 흐름. 더 보내면 우세가 굳는지 볼 수 있음'
      : '내 선택과 친구들 의견이 갈림. 그래서 지금 더 재밌는 판임',
  }
}

function markShareSessionSeen(sessionId: string, totalCount: number) {
  if (!sessionId) return
  const map = readShareInboxSeenMap()
  map[String(sessionId)] = Number(totalCount ?? 0)
  writeShareInboxSeenMap(map)
}

function getLevelTheme(level: number) {
  if (level >= 10) {
    return {
      icon: '👑',
      chipClass:
        'border-amber-300 bg-[linear-gradient(135deg,#fff7cc_0%,#ffe082_100%)] text-amber-900 shadow-[0_10px_22px_rgba(245,158,11,0.18)]',
      softClass: 'bg-amber-50 text-amber-800 border-amber-200',
      ringClass: 'from-amber-300 via-yellow-300 to-amber-400',
    }
  }
  if (level >= 9) {
    return {
      icon: '🔥',
      chipClass:
        'border-orange-300 bg-[linear-gradient(135deg,#fff1e6_0%,#fdba74_100%)] text-orange-900 shadow-[0_10px_22px_rgba(249,115,22,0.16)]',
      softClass: 'bg-orange-50 text-orange-800 border-orange-200',
      ringClass: 'from-orange-300 via-amber-300 to-orange-400',
    }
  }
  if (level >= 7) {
    return {
      icon: '🟣',
      chipClass:
        'border-violet-300 bg-[linear-gradient(135deg,#f5f3ff_0%,#c4b5fd_100%)] text-violet-900 shadow-[0_10px_22px_rgba(124,58,237,0.14)]',
      softClass: 'bg-violet-50 text-violet-800 border-violet-200',
      ringClass: 'from-violet-300 via-fuchsia-300 to-violet-400',
    }
  }
  if (level >= 5) {
    return {
      icon: '🟢',
      chipClass:
        'border-emerald-300 bg-[linear-gradient(135deg,#ecfdf5_0%,#86efac_100%)] text-emerald-900 shadow-[0_10px_22px_rgba(16,185,129,0.14)]',
      softClass: 'bg-emerald-50 text-emerald-800 border-rose-100',
      ringClass: 'from-emerald-300 via-lime-300 to-emerald-400',
    }
  }
  if (level >= 3) {
    return {
      icon: '🔵',
      chipClass:
        'border-blue-300 bg-[linear-gradient(135deg,#eff6ff_0%,#93c5fd_100%)] text-blue-900 shadow-[0_10px_22px_rgba(59,130,246,0.14)]',
      softClass: 'bg-blue-50 text-blue-800 border-blue-200',
      ringClass: 'from-blue-300 via-sky-300 to-blue-400',
    }
  }
  return {
    icon: '⚪',
    chipClass:
      'border-slate-300 bg-[linear-gradient(135deg,#ffffff_0%,#e2e8f0_100%)] text-slate-800 shadow-[0_8px_18px_rgba(148,163,184,0.14)]',
    softClass: 'bg-slate-50 text-slate-700 border-slate-200',
    ringClass: 'from-slate-200 via-slate-300 to-slate-300',
  }
}

function getBadgeTheme(badgeName?: string | null) {
  if (!badgeName) {
    return {
      icon: '✨',
      pillClass: 'border-slate-200 bg-slate-50 text-slate-700',
      softClass: 'border-slate-200 bg-slate-50 text-slate-700',
    }
  }

  if (badgeName.includes('댓글')) {
    return {
      icon: '💬',
      pillClass: 'border-sky-200 bg-sky-50 text-sky-800',
      softClass: 'border-sky-200 bg-sky-50 text-sky-800',
    }
  }

  if (badgeName.includes('판단')) {
    return {
      icon: '⚡',
      pillClass: 'border-indigo-200 bg-indigo-50 text-indigo-800',
      softClass: 'border-indigo-200 bg-indigo-50 text-indigo-800',
    }
  }

  if (badgeName.includes('글') || badgeName.includes('썰')) {
    return {
      icon: '✍️',
      pillClass: 'border-rose-100 bg-emerald-50 text-emerald-800',
      softClass: 'border-rose-100 bg-emerald-50 text-emerald-800',
    }
  }

  if (badgeName.includes('공감')) {
    return {
      icon: '❤️',
      pillClass: 'border-rose-200 bg-rose-50 text-rose-800',
      softClass: 'border-rose-200 bg-rose-50 text-rose-800',
    }
  }

  if (badgeName.includes('반응')) {
    return {
      icon: '🔥',
      pillClass: 'border-amber-200 bg-amber-50 text-amber-800',
      softClass: 'border-amber-200 bg-amber-50 text-amber-800',
    }
  }

  return {
    icon: '🏆',
    pillClass: 'border-amber-200 bg-amber-50 text-amber-800',
    softClass: 'border-amber-200 bg-amber-50 text-amber-800',
  }
}

const AUTHOR_BADGE_POOL = [
  '판단러',
  '댓글러',
  '썰장인',
  '공감받기 시작',
  '반응유발자',
  '첫 판단',
] as const

function getFallbackAuthorMeta(author: string): AuthorMeta {
  const safe = (author || '익명000').trim()
  const hash = Array.from(safe).reduce((acc, ch, index) => {
    return acc + ch.charCodeAt(0) * (index + 1)
  }, 0)

  return {
    level: 2 + (hash % 7),
    badgeName: AUTHOR_BADGE_POOL[hash % AUTHOR_BADGE_POOL.length],
  }
}

function resolveAuthorMeta(
  comment: Pick<CommentItem, 'author' | 'authorKey'>,
  map: Record<string, AuthorMeta>,
  currentUserName?: string,
  currentUserLevel?: number,
  currentFeaturedBadge?: string | null,
  currentActorKey?: string | null,
): AuthorMeta {
  const metaKey = getAuthorMetaKey(comment.author, comment.authorKey)

  if (
    currentActorKey &&
    comment.authorKey &&
    String(comment.authorKey) === String(currentActorKey)
  ) {
    return {
      level: currentUserLevel ?? 1,
      badgeName: currentFeaturedBadge ?? null,
    }
  }

  if (
    !comment.authorKey &&
    currentUserName &&
    comment.author === currentUserName
  ) {
    return {
      level: currentUserLevel ?? 1,
      badgeName: currentFeaturedBadge ?? null,
    }
  }

  return map[metaKey] ?? getFallbackAuthorMeta(comment.author)
}

function getHotBadge(meta?: HotMeta | null) {
  if (!meta) return null

  if (meta.vote1h >= 15) {
    return {
      label: '🔥 지금 난리남',
      toneClass: 'border-rose-200 bg-rose-50 text-rose-700',
    }
  }

  if (meta.comment1h >= 10) {
    return {
      label: '💬 댓글 폭발',
      toneClass: 'border-violet-200 bg-violet-50 text-violet-700',
    }
  }

  if (meta.share24h >= 5) {
    return {
      label: '📤 퍼지는 중',
      toneClass: 'border-amber-200 bg-amber-50 text-amber-700',
    }
  }

  if (meta.view1h >= 30) {
    return {
      label: '👀 계속 보는 중',
      toneClass: 'border-sky-200 bg-sky-50 text-sky-700',
    }
  }

  if (meta.vote1h >= 8 || meta.comment1h >= 6) {
    return {
      label: '⚡ 슬슬 붙는 중',
      toneClass: 'border-indigo-200 bg-indigo-50 text-indigo-700',
    }
  }

  return {
    label: '✨ 반응 올라오는 중',
    toneClass: 'border-slate-200 bg-slate-50 text-slate-600',
  }
}

function getTurningPointLabel(eventLabel?: string | null) {
  switch (eventLabel) {
    case 'flipped':
      return '⚡ 방금 뒤집힘'
    case 'tied':
      return '👀 지금 반반'
    case 'landslide':
      return '😴 한쪽 몰림'
    case 'first_lead':
      return '🚀 판 시작됨'
    default:
      return null
  }
}

function buildPostTensionState(
  postId: number,
  left: number,
  right: number,
): PostTensionState {
  const totalVotes = Number(left ?? 0) + Number(right ?? 0)
  const voteDiff = Math.abs(Number(left ?? 0) - Number(right ?? 0))

  let tensionType: PostTensionState['tensionType'] = 'landslide'
  let isFlipImminent = false

  if (totalVotes >= 4 && voteDiff === 1) {
    tensionType = 'flip_imminent'
    isFlipImminent = true
  } else if (totalVotes >= 8 && voteDiff / Math.max(totalVotes, 1) <= 0.12) {
    tensionType = 'brawl'
  } else if (totalVotes >= 4 && voteDiff <= 2) {
    tensionType = 'tight'
  } else if (totalVotes > 0 && voteDiff / Math.max(totalVotes, 1) <= 0.35) {
    tensionType = 'leaning'
  }

  return {
    postId,
    tensionType,
    voteDiff,
    totalVotes,
    isFlipImminent,
    updatedAt: null,
  }
}

function getTensionMeta(tension?: PostTensionState | null) {
  switch (tension?.tensionType) {
    case 'flip_imminent':
      return {
        label: '⚡ 한 명만 더 오면 뒤집힘',
        helper: '지금 네 선택이 흐름을 바꿀 수도 있음',
        toneClass: 'border-rose-200 bg-rose-50 text-rose-700',
      }
    case 'brawl':
      return {
        label: '🔥 지금 개싸움',
        helper: '계속 갈리는 판이라 다음 반응도 궁금해짐',
        toneClass: 'border-amber-200 bg-amber-50 text-amber-700',
      }
    case 'tight':
      return {
        label: '👀 지금 팽팽',
        helper: '한두 표만 더 들어와도 분위기가 달라질 수 있음',
        toneClass: 'border-sky-200 bg-sky-50 text-sky-700',
      }
    case 'leaning':
      return {
        label: '⚡ 한쪽으로 기우는 중',
        helper: '기울고는 있지만 아직 끝난 판은 아님',
        toneClass: 'border-indigo-200 bg-indigo-50 text-indigo-700',
      }
    default:
      return {
        label: '😴 한쪽 몰림',
        helper: '지금은 몰리지만 댓글에서 다시 붙을 수도 있음',
        toneClass: 'border-slate-200 bg-slate-50 text-slate-600',
      }
  }
}

function getLeaderSideFromVotes(
  left: number,
  right: number,
): 'left' | 'right' | 'tie' {
  if (left === right) return 'tie'
  return left > right ? 'left' : 'right'
}

function getFlipDramaLabel(flip?: PostFlipEventItem | null) {
  if (!flip) return null

  if (flip.afterLeader === 'tie') {
    return {
      text: '👀 방금 다시 반반됨',
      helper: '한두 표만 더 들어와도 흐름이 또 바뀔 수 있음',
      toneClass: 'border-amber-200 bg-amber-50 text-amber-700',
    }
  }

  if (flip.beforeLeader === 'tie') {
    return {
      text: '⚡ 방금 한쪽이 앞서기 시작함',
      helper: '막 붙기 시작한 판이라 다시 흔들릴 가능성도 큼',
      toneClass: 'border-sky-200 bg-sky-50 text-sky-700',
    }
  }

  return {
    text: '🔥 방금 판 뒤집힘',
    helper: '내가 아까 본 결과랑 지금 흐름이 달라졌음',
    toneClass: 'border-rose-200 bg-rose-50 text-rose-700',
  }
}

function getShadowWatchLabel(item?: ShadowWatchItem | null) {
  if (!item || item.viewCount < 2) return null

  if (item.viewCount >= 4) {
    return {
      text: '🫣 계속 신경 쓰는 글',
      helper: `벌써 ${item.viewCount}번 다시 봄`,
      toneClass: 'border-violet-200 bg-violet-50 text-violet-700',
    }
  }

  return {
    text: '👀 자꾸 다시 보는 글',
    helper: `${item.viewCount}번째 확인 중`,
    toneClass: 'border-slate-200 bg-slate-50 text-slate-700',
  }
}

function getResultEmotion(left: number, right: number) {
  const total = left + right
  if (total === 0) return null

  const diff = Math.abs(left - right) / total

  if (diff <= 0.1) return '🔥 개싸움'
  if (diff <= 0.25) return '👀 팽팽'
  if (diff <= 0.5) return '⚡ 기우는 중'
  return '😴 한쪽 몰림'
}

function getMinorityLabel(mySide: VoteSide | null, post?: PostItem | null) {
  if (!mySide || !post) return null

  const total = Number(post.leftVotes ?? 0) + Number(post.rightVotes ?? 0)
  if (total < 3) return null

  const myVotes =
    mySide === 'left'
      ? Number(post.leftVotes ?? 0)
      : Number(post.rightVotes ?? 0)
  const ratio = myVotes / Math.max(total, 1)
  const minorityThreshold = total < 10 ? 0.25 : 0.15
  const minoritySecondaryThreshold = total < 10 ? 0.4 : 0.3

  if (ratio <= minorityThreshold) {
    return {
      text: '😳 너만 틀림',
      toneClass: 'border-rose-200 bg-rose-50 text-rose-700',
      helper: '완전 반대로 가는 중',
    }
  }

  if (ratio <= minoritySecondaryThreshold) {
    return {
      text: '🤨 소수 의견',
      toneClass: 'border-amber-200 bg-amber-50 text-amber-700',
      helper: '갈리는 판이라 더 재밌음',
    }
  }

  return null
}

function roundPairToStep(left: number, right: number, step: number) {
  const roundedLeft = Math.round(left / step) * step
  const boundedLeft = Math.max(step, Math.min(100 - step, roundedLeft))
  return {
    left: boundedLeft,
    right: 100 - boundedLeft,
  }
}

function getRevealStateLabel(leftVotes: number, rightVotes: number) {
  const left = Math.max(0, Number(leftVotes ?? 0))
  const right = Math.max(0, Number(rightVotes ?? 0))
  const total = left + right

  if (total <= 0) {
    return {
      label: '아직 판이 안 열림',
      helper: '첫 반응이 들어오면 흐름이 시작됨',
      toneClass: 'border-slate-200 bg-slate-50 text-slate-600',
    }
  }

  const diffRatio = Math.abs(left - right) / Math.max(total, 1)

  if (diffRatio <= 0.1) {
    return {
      label: '🔥 지금 완전 개싸움',
      helper: '거의 반반이라 다음 반응이 중요함',
      toneClass: 'border-rose-200 bg-rose-50 text-rose-700',
    }
  }

  if (diffRatio <= 0.25) {
    return {
      label: '👀 생각보다 엄청 갈리는 중',
      helper: '한두 표만 더 들어와도 분위기 바뀜',
      toneClass: 'border-amber-200 bg-amber-50 text-amber-700',
    }
  }

  if (diffRatio <= 0.5) {
    return {
      label: '⚡ 한쪽이 확실히 앞서는 중',
      helper: '아직 끝난 건 아니지만 흐름이 보임',
      toneClass: 'border-sky-200 bg-sky-50 text-sky-700',
    }
  }

  return {
    label: '😳 거의 한쪽으로 몰리는 중',
    helper: '지금은 한쪽 우세. 댓글에서 다시 붙을 수도 있음',
    toneClass: 'border-slate-200 bg-slate-50 text-slate-600',
  }
}

function getPreVoteSignalTitle(
  totalVotes: number,
  commentsCount: number,
  tension?: PostTensionState | null,
) {
  if (tension?.isFlipImminent) return '다음 한 표면 뒤집힘'
  if (tension?.tensionType === 'brawl') return '지금 완전 갈리는 판'
  if (tension?.tensionType === 'tight') return '생각보다 팽팽한 판'
  if (commentsCount >= 20) return '댓글도 꽤 붙은 판'
  if (totalVotes >= 50) return '사람들이 많이 보고 있는 판'
  if (totalVotes >= 10) return '이미 반응이 들어온 판'
  return '지금 반응이 쌓이는 중'
}

function getPreVoteSignalHelper(
  totalVotes: number,
  commentsCount: number,
  tension?: PostTensionState | null,
) {
  if (tension?.isFlipImminent) {
    return '지금 분위기가 바로 바뀔 수 있음'
  }

  if (tension?.tensionType === 'brawl') {
    return '생각보다 꽤 갈리는 중 · 선택하면 분위기 공개'
  }

  if (tension?.tensionType === 'tight') {
    return '팽팽하게 갈리는 중 · 선택하면 분위기 공개'
  }

  if (commentsCount >= 20) {
    return '댓글도 계속 붙는 중 · 선택하면 분위기 공개'
  }

  if (totalVotes >= 50) {
    return '사람들이 계속 보는 판 · 선택하면 분위기 공개'
  }

  if (totalVotes >= 10) {
    return '이미 반응이 들어온 판 · 선택하면 분위기 공개'
  }

  return '지금 반응 오는 중 · 선택하면 분위기 공개'
}

function getRevealHintLabel(leftVotes: number, rightVotes: number) {
  const left = Math.max(0, Number(leftVotes ?? 0))
  const right = Math.max(0, Number(rightVotes ?? 0))
  const total = left + right

  if (total <= 0) return '댓글 반응이 아직 없음'

  const diffRatio = Math.abs(left - right) / Math.max(total, 1)

  if (left === right || diffRatio <= 0.1) return '댓글 분위기: 거의 반반'
  if (left > right * 2 || right > left * 2)
    return '댓글 분위기: 한쪽 의견이 훨씬 많음'
  return '댓글 분위기: 생각보다 꽤 갈림'
}

function getResultRevealStage(
  unlockLevel: number,
  leftVotes: number,
  rightVotes: number,
  hasOutcome: boolean,
): ResultRevealStage {
  const exact = percent(leftVotes, rightVotes)
  const effectiveLevel = hasOutcome ? unlockLevel : Math.min(unlockLevel, 3)

  if (effectiveLevel >= 4) {
    return {
      level: 4,
      label: '후기 있음',
      helper: '결국 어떻게 됐는지까지 볼 수 있음',
      toneClass: 'border-rose-100 bg-emerald-50 text-rose-600',
      leftValue: exact.left,
      rightValue: exact.right,
      showExact: true,
      showOutcome: true,
    }
  }

  if (effectiveLevel >= 3) {
    return {
      level: 3,
      label: '지금 결과 보기',
      helper: '사람들이 계속 들어오고 있어서 결과는 조금씩 달라질 수 있음',
      toneClass: 'border-blue-200 bg-blue-50 text-blue-700',
      leftValue: exact.left,
      rightValue: exact.right,
      showExact: true,
      showOutcome: false,
    }
  }

  if (effectiveLevel >= 2) {
    const stateMeta = getRevealStateLabel(leftVotes, rightVotes)
    return {
      level: 2,
      label: '댓글 분위기',
      helper: '댓글에서 사람들이 왜 그렇게 보는지 바로 느낄 수 있음',
      toneClass: stateMeta.toneClass,
      leftValue: exact.left,
      rightValue: exact.right,
      showExact: false,
      showOutcome: false,
    }
  }

  const stateMeta = getRevealStateLabel(leftVotes, rightVotes)
  return {
    level: 1,
    label: '지금 분위기',
    helper: stateMeta.helper,
    toneClass: stateMeta.toneClass,
    leftValue: exact.left,
    rightValue: exact.right,
    showExact: false,
    showOutcome: false,
  }
}

function formatRelativeShort(value?: string | null) {
  if (!value) return ''

  const diffMs = Date.now() - new Date(value).getTime()
  if (!Number.isFinite(diffMs) || diffMs < 0) return '방금'

  const minutes = Math.floor(diffMs / 60000)
  if (minutes < 1) return '방금'
  if (minutes < 60) return `${minutes}분 전`

  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}시간 전`

  const days = Math.floor(hours / 24)
  return `${days}일 전`
}

const EMPTY_COMMENT_REACTION_SUMMARY: CommentReactionSummary = {
  agree: 0,
  disagree: 0,
  wow: 0,
  relatable: 0,
  absurd: 0,
}

const EMPTY_POST_REACTION_SUMMARY: PostReactionSummary = {
  controversial: 0,
  curious: 0,
  suspicious: 0,
  minority: 0,
  shareworthy: 0,
}

const COMMENT_REACTION_META: Record<
  CommentReactionType,
  { label: string; activeClass: string; idleClass: string }
> = {
  relatable: {
    label: '공감',
    activeClass: 'border-sky-200 bg-sky-50 text-sky-700',
    idleClass: 'border-slate-200 bg-white text-slate-500',
  },
  disagree: {
    label: '반박',
    activeClass: 'border-rose-200 bg-rose-50 text-rose-700',
    idleClass: 'border-slate-200 bg-white text-slate-500',
  },
  agree: {
    label: '보조',
    activeClass: 'border-slate-200 bg-slate-50 text-slate-500',
    idleClass: 'border-slate-200 bg-white text-slate-400',
  },
  wow: {
    label: '보조',
    activeClass: 'border-slate-200 bg-slate-50 text-slate-500',
    idleClass: 'border-slate-200 bg-white text-slate-400',
  },
  absurd: {
    label: '보조',
    activeClass: 'border-slate-200 bg-slate-50 text-slate-500',
    idleClass: 'border-slate-200 bg-white text-slate-400',
  },
}

const POST_REACTION_META: Record<
  PostReactionType,
  { label: string; activeClass: string; idleClass: string }
> = {
  controversial: {
    label: '👍 공감함',
    activeClass: 'border-sky-200 bg-sky-50 text-sky-700',
    idleClass: 'border-slate-200 bg-white text-slate-500',
  },
  curious: {
    label: '😒 억까임',
    activeClass: 'border-amber-200 bg-amber-50 text-amber-700',
    idleClass: 'border-slate-200 bg-white text-slate-500',
  },
  suspicious: {
    label: '🤨 주작같음',
    activeClass: 'border-orange-200 bg-orange-50 text-orange-700',
    idleClass: 'border-slate-200 bg-white text-slate-500',
  },
  minority: {
    label: '😳 내가 소수네',
    activeClass: 'border-fuchsia-200 bg-fuchsia-50 text-fuchsia-700',
    idleClass: 'border-slate-200 bg-white text-slate-500',
  },
  shareworthy: {
    label: '숨김',
    activeClass: 'border-slate-200 bg-slate-50 text-slate-500',
    idleClass: 'border-slate-200 bg-white text-slate-400',
  },
}

const QUICK_REACTION_ORDER: PostReactionType[] = [
  'controversial',
  'curious',
  'suspicious',
  'minority',
]

function getActorUnifiedKey(userId?: string | null, voterKey?: string | null) {
  if (userId) return `user:${userId}`
  if (voterKey) return `voter:${voterKey}`
  return null
}

function getRawActorKey(userId?: string | null, voterKey?: string | null) {
  if (userId) return userId
  if (voterKey) return voterKey
  return null
}

function getOutcomeTone(outcomeType: PostOutcomeItem['outcomeType']) {
  switch (outcomeType) {
    case 'resolved':
      return 'border-rose-100 bg-emerald-50 text-rose-600'
    case 'update':
      return 'border-sky-200 bg-sky-50 text-sky-700'
    case 'author_followup':
      return 'border-violet-200 bg-violet-50 text-violet-700'
    case 'twist':
      return 'border-rose-200 bg-rose-50 text-rose-700'
    default:
      return 'border-slate-200 bg-slate-50 text-slate-600'
  }
}

function getOutcomeLabel(outcomeType: PostOutcomeItem['outcomeType']) {
  switch (outcomeType) {
    case 'resolved':
      return '결국 이렇게 됨 👀'
    case 'update':
      return '후기 떴다 🔥'
    case 'author_followup':
      return '작성자 등판 👀'
    case 'twist':
      return '판 뒤집힘 ⚡'
    default:
      return '업데이트'
  }
}

function getWatchlistStatusMeta(status: WatchlistItem['watchStatus']) {
  switch (status) {
    case 'updated':
      return {
        label: '새 소식',
        helper: '후기/결말 먼저 확인',
        toneClass: 'border-rose-200 bg-rose-50 text-rose-700',
      }
    case 'archived':
      return {
        label: '보관됨',
        helper: '이미 확인한 업데이트',
        toneClass: 'border-slate-200 bg-slate-50 text-slate-600',
      }
    default:
      return {
        label: '대기중',
        helper: '아직 새 후기가 없음',
        toneClass: 'border-sky-200 bg-sky-50 text-sky-700',
      }
  }
}

function compareWatchlistItems(a: WatchlistItem, b: WatchlistItem) {
  const order: Record<WatchlistItem['watchStatus'], number> = {
    updated: 0,
    waiting: 1,
    archived: 2,
  }

  if (order[a.watchStatus] !== order[b.watchStatus]) {
    return order[a.watchStatus] - order[b.watchStatus]
  }

  const aSignalTime =
    a.watchStatus === 'updated'
      ? a.latestOutcomeCreatedAt
      : (a.archivedAt ?? a.createdAt)
  const bSignalTime =
    b.watchStatus === 'updated'
      ? b.latestOutcomeCreatedAt
      : (b.archivedAt ?? b.createdAt)

  return (
    new Date(bSignalTime ?? 0).getTime() - new Date(aSignalTime ?? 0).getTime()
  )
}

function normalizeWatchStatus(
  value?: string | null,
): WatchlistItem['watchStatus'] {
  if (value === 'updated' || value === 'archived') return value
  return 'waiting'
}

function resolveWatchlistStatus(input: {
  unreadOutcome: boolean
  latestOutcomeCreatedAt?: string | null
  archivedAt?: string | null
  storedStatus?: string | null
}): WatchlistItem['watchStatus'] {
  if (input.unreadOutcome && input.latestOutcomeCreatedAt) return 'updated'
  if (
    input.archivedAt ||
    normalizeWatchStatus(input.storedStatus) === 'archived'
  ) {
    return 'archived'
  }
  return 'waiting'
}

function getStreakTone(count: number) {
  if (count >= 10) return 'border-amber-200 bg-amber-50 text-amber-700'
  if (count >= 5) return 'border-violet-200 bg-violet-50 text-violet-700'
  if (count >= 3) return 'border-sky-200 bg-sky-50 text-sky-700'
  return 'border-slate-200 bg-slate-50 text-slate-600'
}

function getNextReasonLabel(reasonType?: NextQueueItem['reasonType']) {
  switch (reasonType) {
    case 'hot':
      return '지금 뜨는 판'
    case 'controversial':
      return '더 갈리는 판'
    case 'same_category':
      return '같은 카테고리'
    case 'opposite_majority':
      return '너랑 반대 많은 판'
    case 'comment_burst':
      return '댓글 붙는 판'
    case 'followup':
      return '후속 흐름'
    default:
      return '다음 맞냐'
  }
}

const VoteOption = React.memo(function VoteOption({
  active,
  label,
  value,
  showValue = false,
  previewTitle = '의견이 갈리는 중',
  previewHelper = '선택하면 현재 분위기가 열림',
  onClick,
  disabled = false,
}: {
  active: boolean
  label: string
  value: number
  showValue?: boolean
  previewTitle?: string
  previewHelper?: string
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`group relative w-full overflow-hidden rounded-[26px] border px-4 py-4 text-left transition-all duration-200 ${
        active
          ? 'border-slate-950 bg-[linear-gradient(180deg,#ffffff_0%,#f7f7f8_100%)] shadow-[0_18px_36px_rgba(15,23,42,0.14)]'
          : 'border-slate-200/90 bg-white shadow-[0_10px_24px_rgba(15,23,42,0.05)]'
      } ${disabled ? 'cursor-not-allowed opacity-70' : 'hover:-translate-y-0.5 hover:border-slate-400 hover:shadow-[0_16px_34px_rgba(15,23,42,0.10)]'}`}
    >
      <div className="pointer-events-none absolute inset-y-0 left-0 w-1.5 bg-slate-950 opacity-0 transition-opacity duration-200 group-hover:opacity-60" />
      {active ? (
        <div className="pointer-events-none absolute inset-y-0 left-0 w-1.5 bg-slate-950" />
      ) : null}

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-black tracking-[0.18em] text-slate-400">
            내 판단
          </div>
          <div className="mt-1 text-[17px] font-black leading-snug tracking-[-0.03em] text-slate-950">
            {label}
          </div>
        </div>

        {showValue ? (
          <div className="shrink-0 text-right">
            <div className="text-[22px] font-black leading-none text-slate-950">
              {value}%
            </div>
            <div className="mt-1 text-[10px] font-bold text-slate-400">
              현재 선택
            </div>
          </div>
        ) : (
          <div className="shrink-0 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-[11px] font-black text-slate-600">
            고르기
          </div>
        )}
      </div>

      {showValue ? (
        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-slate-950 transition-all duration-300"
            style={{ width: `${value}%` }}
          />
        </div>
      ) : (
        <div className="mt-3 rounded-2xl bg-slate-50 px-3 py-2 text-[12px] font-semibold leading-5 text-slate-500">
          <span className="font-black text-slate-700">{previewTitle}</span>
          <span className="mx-1 text-slate-300">·</span>
          {previewHelper}
        </div>
      )}
    </button>
  )
})

function InquiryCenterModal({
  open,
  onClose,
  onSubmit,
}: {
  open: boolean
  onClose: () => void
  onSubmit: (input: {
    inquiryType: InquiryType
    title: string
    content: string
    contact: string
  }) => Promise<void>
}) {
  const [inquiryType, setInquiryType] = useState<InquiryType>('bug')
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [contact, setContact] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [submitError, setSubmitError] = useState('')

  useEffect(() => {
    if (!open) return
    setInquiryType('bug')
    setTitle('')
    setContent('')
    setContact('')
    setSubmitting(false)
    setSubmitted(false)
    setSubmitError('')
  }, [open])

  if (!open) return null

  if (submitted) {
    return (
      <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/35 px-4 py-6 backdrop-blur-md">
        <div className="mx-auto max-w-sm rounded-[32px] border border-slate-200 bg-white p-5 text-slate-900 shadow-2xl">
          <div className="rounded-[28px] border border-emerald-200 bg-emerald-50 px-4 py-5 text-center">
            <div className="text-3xl">✓</div>
            <div className="mt-2 text-lg font-black tracking-[-0.03em] text-slate-900">
              문의가 접수됐어요
            </div>
            <div className="mt-2 text-sm font-semibold leading-6 text-slate-600">
              운영팀이 확인 중입니다. 추가로 남길 내용이 있으면 새 문의를 작성할
              수 있어요.
            </div>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700"
            >
              닫기
            </button>
            <button
              type="button"
              onClick={() => {
                setInquiryType('bug')
                setTitle('')
                setContent('')
                setContact('')
                setSubmitError('')
                setSubmitting(false)
                setSubmitted(false)
              }}
              className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-black text-white shadow-[0_12px_24px_rgba(15,23,42,0.20)]"
            >
              새 문의
            </button>
          </div>
        </div>
      </div>
    )
  }

  const currentMeta = inquiryTypeMeta[inquiryType]
  const canSubmit = title.trim().length >= 2 && content.trim().length >= 5

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/35 px-4 py-6 backdrop-blur-md">
      <div className="mx-auto max-w-sm rounded-[32px] border border-slate-200 bg-white p-5 text-slate-900 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[11px] font-black tracking-[0.18em] text-slate-400">
              CONTACT CENTER
            </div>
            <div className="mt-1 text-xl font-black tracking-[-0.03em]">
              문의하기
            </div>
            <div className="mt-1 text-sm leading-5 text-slate-500">
              답변이 필요하면 연락처를 남겨주세요. 익명으로도 접수 가능해요.
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500"
            aria-label="닫기"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-5 grid grid-cols-3 gap-2">
          {(Object.keys(inquiryTypeMeta) as InquiryType[]).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setInquiryType(item)}
              className={
                (inquiryType === item
                  ? 'border-slate-950 bg-slate-950 text-white shadow-[0_12px_24px_rgba(15,23,42,0.18)]'
                  : 'border-slate-200 bg-white text-slate-700') +
                ' rounded-2xl border px-2 py-3 text-center transition'
              }
            >
              <div className="text-[12px] font-black leading-tight">
                {inquiryTypeMeta[item].label}
              </div>
            </button>
          ))}
        </div>

        <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold leading-6 text-slate-600">
          {currentMeta.helper}
        </div>

        <label className="mt-4 block">
          <span className="text-xs font-black text-slate-500">제목</span>
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value.slice(0, 60))}
            placeholder="짧게 적어주세요"
            className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-900 outline-none focus:border-slate-950"
          />
        </label>

        <label className="mt-3 block">
          <span className="text-xs font-black text-slate-500">내용</span>
          <textarea
            value={content}
            onChange={(event) => setContent(event.target.value.slice(0, 1000))}
            placeholder={currentMeta.placeholder}
            className="mt-1 min-h-[132px] w-full resize-none rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold leading-6 text-slate-900 outline-none focus:border-slate-950"
          />
          <div className="mt-1 text-right text-[11px] font-bold text-slate-400">
            {content.length}/1000
          </div>
        </label>

        <label className="mt-2 block">
          <span className="text-xs font-black text-slate-500">
            연락처 선택 입력
          </span>
          <input
            value={contact}
            onChange={(event) => setContact(event.target.value.slice(0, 120))}
            placeholder="이메일 또는 오픈채팅 링크"
            className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-900 outline-none focus:border-slate-950"
          />
        </label>

        {submitError ? (
          <div className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">
            {submitError}
          </div>
        ) : null}

        <div className="mt-5 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700"
          >
            취소
          </button>
          <button
            type="button"
            disabled={!canSubmit || submitting}
            onClick={async () => {
              if (!canSubmit || submitting) return
              setSubmitError('')
              setSubmitting(true)
              try {
                await onSubmit({
                  inquiryType,
                  title: title.trim(),
                  content: content.trim(),
                  contact: contact.trim(),
                })
                setSubmitted(true)
              } catch (error) {
                console.error('문의 접수 실패', error)
                setSubmitError('접수에 실패했어요. 잠시 후 다시 시도해주세요.')
              } finally {
                setSubmitting(false)
              }
            }}
            className={
              (canSubmit && !submitting ? 'bg-slate-950' : 'bg-slate-300') +
              ' rounded-2xl px-4 py-3 text-sm font-black text-white shadow-[0_12px_24px_rgba(15,23,42,0.20)]'
            }
          >
            {submitting ? '접수중' : '접수하기'}
          </button>
        </div>
      </div>
    </div>
  )
}

function InquiryAdminModal({
  open,
  onClose,
  items,
  loading,
  onRefresh,
  onUpdateStatus,
}: {
  open: boolean
  onClose: () => void
  items: InquiryRow[]
  loading: boolean
  onRefresh: () => void
  onUpdateStatus: (id: number, status: InquiryStatus) => void
}) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/35 px-4 py-6 backdrop-blur-md">
      <div className="mx-auto max-w-md rounded-[32px] border border-slate-200 bg-white p-5 text-slate-900 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[11px] font-black tracking-[0.18em] text-slate-400">
              ADMIN INBOX
            </div>
            <div className="mt-1 text-xl font-black tracking-[-0.03em]">
              문의함
            </div>
            <div className="mt-1 text-sm text-slate-500">
              버그 신고, 운영 문의, 제안 및 제휴 접수 목록
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500"
            aria-label="닫기"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={onRefresh}
            className="rounded-full bg-slate-950 px-4 py-2 text-xs font-black text-white"
          >
            새로고침
          </button>
          <div className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-black text-slate-500">
            {items.length}건
          </div>
        </div>

        <div className="mt-4 max-h-[70vh] space-y-3 overflow-y-auto pr-1">
          {loading ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm font-bold text-slate-500">
              불러오는 중
            </div>
          ) : items.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm font-bold text-slate-500">
              접수된 문의가 없음
            </div>
          ) : (
            items.map((item) => {
              const statusMeta =
                inquiryStatusMeta[item.status] ?? inquiryStatusMeta.pending
              return (
                <div
                  key={item.id}
                  className="rounded-3xl border border-slate-200 bg-white p-4 shadow-[0_8px_18px_rgba(15,23,42,0.05)]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="rounded-full bg-slate-950 px-2.5 py-1 text-[10px] font-black text-white">
                          {inquiryTypeMeta[item.inquiry_type]?.label ?? '문의'}
                        </span>
                        <span
                          className={
                            'rounded-full border px-2.5 py-1 text-[10px] font-black ' +
                            statusMeta.className
                          }
                        >
                          {statusMeta.label}
                        </span>
                      </div>
                      <div className="mt-2 line-clamp-2 text-sm font-black text-slate-900">
                        {item.title}
                      </div>
                    </div>
                    <div className="text-[11px] font-bold text-slate-400">
                      #{item.id}
                    </div>
                  </div>
                  <div className="mt-3 whitespace-pre-wrap rounded-2xl bg-slate-50 px-3 py-3 text-sm font-semibold leading-6 text-slate-700">
                    {item.content}
                  </div>
                  {item.contact ? (
                    <div className="mt-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600">
                      연락처: {item.contact}
                    </div>
                  ) : null}
                  <div className="mt-3 grid grid-cols-4 gap-1.5">
                    {(
                      [
                        'pending',
                        'reviewing',
                        'resolved',
                        'rejected',
                      ] as InquiryStatus[]
                    ).map((status) => (
                      <button
                        key={status}
                        type="button"
                        onClick={() => onUpdateStatus(item.id, status)}
                        className={
                          (item.status === status
                            ? 'border-slate-950 bg-slate-950 text-white'
                            : 'border-slate-200 bg-white text-slate-500') +
                          ' rounded-xl border px-2 py-2 text-[10px] font-black'
                        }
                      >
                        {inquiryStatusMeta[status].label}
                      </button>
                    ))}
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}

function ReportModal({
  open,
  onClose,
  onSubmit,
  targetLabel,
}: {
  open: boolean
  onClose: () => void
  onSubmit: (reason: string) => void
  targetLabel: string
}) {
  const [reason, setReason] = useState(reportReasons[0])

  useEffect(() => {
    if (open) setReason(reportReasons[0])
  }, [open])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/30 backdrop-blur-md">
      <div className="mx-auto mt-24 max-w-sm rounded-[32px] border border-slate-200 bg-white p-5 text-slate-900 shadow-2xl">
        <div className="mb-1 text-lg font-bold">신고하기</div>
        <div className="mb-4 text-sm text-slate-500">{targetLabel}</div>
        <div className="space-y-2">
          {reportReasons.map((item) => (
            <button
              key={item}
              onClick={() => setReason(item)}
              className={`w-full rounded-2xl border px-4 py-3 text-left text-sm font-bold ${
                reason === item
                  ? 'border-[#bcd0ff] bg-[#4f7cff] text-white shadow-[0_12px_24px_rgba(79,124,255,0.20)]'
                  : 'border-slate-200/80 bg-white text-slate-900'
              }`}
            >
              {item}
            </button>
          ))}
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <button
            onClick={onClose}
            className="rounded-2xl border border-slate-200/80 bg-white px-4 py-3 shadow-[0_2px_10px_rgba(15,23,42,0.03)] font-bold"
          >
            취소
          </button>
          <button
            onClick={() => onSubmit(reason)}
            className="rounded-2xl bg-slate-950 px-4 py-3 font-bold text-white shadow-[0_12px_24px_rgba(15,23,42,0.20)]"
          >
            신고 접수
          </button>
        </div>
      </div>
    </div>
  )
}

function AuthOptionalModal({
  open,
  onClose,
  onGoogleLogin,
}: {
  open: boolean
  onClose: () => void
  onGoogleLogin: () => void
}) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/30 backdrop-blur-md">
      <div className="mx-auto mt-24 max-w-sm rounded-[32px] border border-slate-200 bg-white p-5 text-slate-900 shadow-2xl">
        <div className="mb-1 text-lg font-bold">로그인은 선택</div>
        <div className="mb-4 text-sm leading-6 text-slate-500">
          글쓰기와 댓글쓰기는 로그인 없이 가능.
          <br />
          로그인 없이도 대부분 이용 가능. 로그인하면 내 활동, 포인트, 뱃지를
          기기 바뀌어도 이어서 저장할 수 있음.
        </div>

        <div className="space-y-2">
          <button
            onClick={onGoogleLogin}
            className="w-full rounded-2xl bg-slate-950 px-4 py-3 font-bold text-white shadow-[0_12px_24px_rgba(15,23,42,0.20)]"
          >
            구글로 시작
          </button>

          <button
            onClick={onClose}
            className="w-full rounded-2xl border border-slate-200/80 bg-white px-4 py-3 shadow-[0_2px_10px_rgba(15,23,42,0.03)] font-bold text-slate-900"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  )
}

const CommentCard = React.memo(function CommentCard({
  comment,
  leftLabel,
  rightLabel,
  onOpenReportComment,
  adminMode,
  onAdminRestoreComment,
  onAdminDeleteComment,
  authorMeta,
  reactionSummary = EMPTY_COMMENT_REACTION_SUMMARY,
  myReactionMap = {},
  onReactComment,
  pulseReactionType = null,
  liveBattleFocus = false,
}: {
  comment: CommentItem
  leftLabel: string
  rightLabel: string
  onOpenReportComment: (commentId: number) => void
  adminMode: boolean
  onAdminRestoreComment: (commentId: number) => void
  onAdminDeleteComment: (commentId: number) => void
  authorMeta?: AuthorMeta
  reactionSummary?: CommentReactionSummary
  myReactionMap?: Partial<Record<CommentReactionType, boolean>>
  onReactComment: (
    commentId: number,
    reactionType: CommentReactionType,
  ) => void | Promise<void>
  pulseReactionType?: CommentReactionType | null
  liveBattleFocus?: boolean
}) {
  if (comment.hidden && !adminMode) return null

  const isLeft = comment.side === 'left'
  const sideLabel = isLeft ? leftLabel : rightLabel
  const sideBadgeClass = isLeft
    ? 'border-blue-200 bg-blue-50/90 text-blue-700'
    : 'border-violet-200 bg-violet-50/90 text-violet-700'
  const resolvedMeta = authorMeta ?? getFallbackAuthorMeta(comment.author)
  const badgeTheme = getBadgeTheme(resolvedMeta.badgeName)
  const levelTheme = getLevelTheme(resolvedMeta.level)

  return (
    <div
      className={`overflow-hidden rounded-[16px] border shadow-[0_6px_16px_rgba(15,23,42,0.045)] ${
        comment.hidden
          ? 'border-red-200 bg-red-50'
          : 'border-white/90 bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(248,250,255,0.96)_100%)]'
      }`}
    >
      <div
        className={`h-[2px] w-full ${
          comment.hidden
            ? 'bg-red-200'
            : isLeft
              ? 'bg-[linear-gradient(90deg,#60a5fa_0%,#4f7cff_100%)]'
              : 'bg-[linear-gradient(90deg,#8b5cf6_0%,#a78bfa_100%)]'
        }`}
      />
      <div className="p-2">
        <div className="mb-1.5 flex items-start justify-between gap-1">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1">
              <span
                className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold ${sideBadgeClass}`}
              >
                {sideLabel}
              </span>
              <span className="max-w-[96px] truncate text-[11px] font-semibold text-slate-900">
                {comment.author}
              </span>
              <span
                className={`inline-flex rounded-full border px-1.5 py-0.5 text-[9px] font-extrabold ${levelTheme.softClass}`}
              >
                {levelTheme.icon} Lv.{resolvedMeta.level}
              </span>
              {resolvedMeta.badgeName ? (
                <span
                  className={`inline-flex max-w-[110px] truncate rounded-full border px-1.5 py-0.5 text-[9px] font-bold ${badgeTheme.softClass}`}
                >
                  {badgeTheme.icon} {resolvedMeta.badgeName}
                </span>
              ) : null}
            </div>
          </div>

          {!comment.hidden ? (
            <button
              onClick={() => onOpenReportComment(comment.id)}
              className="inline-flex h-6.5 w-6.5 shrink-0 items-center justify-center rounded-full border border-slate-200/80 bg-white/90 text-slate-400 transition hover:bg-slate-50 hover:text-slate-600"
              aria-label="댓글 신고"
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
          ) : null}
        </div>

        <div className="text-[12.5px] leading-[1.4] tracking-[-0.01em] text-slate-700 line-clamp-2">
          {comment.hidden ? '신고 누적으로 숨김된 댓글' : comment.text}
        </div>

        {!comment.hidden ? (
          <div className="mt-1.5">
            {liveBattleFocus ? (
              <div className="mb-1.5 flex items-center gap-1 text-[10px] font-black tracking-[0.02em] text-rose-600">
                <span className="inline-flex h-2 w-2 rounded-full bg-rose-500 animate-pulse" />
                지금 서로 물고 늘어지는 중
              </div>
            ) : null}
            <div className="flex items-center gap-1 text-[11px]">
              {[
                {
                  reactionType: 'relatable' as CommentReactionType,
                  label: '공감',
                  leading: '💬',
                  count:
                    Number(reactionSummary.relatable ?? 0) +
                    Number(reactionSummary.agree ?? 0) +
                    Number(reactionSummary.wow ?? 0),
                  active: !!myReactionMap.relatable,
                  activeClass:
                    'border-sky-200 bg-sky-50 text-sky-700 shadow-[0_6px_14px_rgba(56,189,248,0.12)]',
                  idleClass: 'border-slate-200 bg-white/90 text-slate-500',
                },
                {
                  reactionType: 'disagree' as CommentReactionType,
                  label: '반박',
                  leading: '🔥',
                  count: Number(reactionSummary.disagree ?? 0),
                  active: !!myReactionMap.disagree,
                  activeClass:
                    'border-rose-200 bg-rose-50 text-rose-700 shadow-[0_6px_14px_rgba(244,63,94,0.12)]',
                  idleClass: 'border-slate-200 bg-white/90 text-slate-500',
                },
              ].map((item) => {
                const isPulse = pulseReactionType === item.reactionType
                return (
                  <button
                    key={item.reactionType}
                    onClick={() =>
                      onReactComment(comment.id, item.reactionType)
                    }
                    className={`inline-flex h-8 items-center gap-1.5 rounded-full border px-3 font-bold transition duration-200 ${item.active ? item.activeClass : item.idleClass} ${isPulse ? 'scale-[1.08] shadow-[0_10px_20px_rgba(15,23,42,0.12)]' : 'scale-100'}`}
                  >
                    <span>{item.leading}</span>
                    <span>{item.label}</span>
                    <span className={isPulse ? 'animate-pulse' : ''}>
                      {item.count}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        ) : null}

        {adminMode && comment.hidden && (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button
              onClick={() => onAdminRestoreComment(comment.id)}
              className="rounded-full bg-[#4f7cff] px-3 py-1.5 text-xs font-bold text-white"
            >
              숨김 해제
            </button>
            <button
              onClick={() => onAdminDeleteComment(comment.id)}
              className="rounded-full bg-red-500 px-3 py-1.5 text-xs font-bold text-white"
            >
              삭제
            </button>
          </div>
        )}
      </div>
    </div>
  )
})

function OutcomeWriteModal({
  open,
  onClose,
  onSubmit,
  postTitle,
  initialType = 'author_followup',
}: {
  open: boolean
  onClose: () => void
  onSubmit: (
    outcomeType: PostOutcomeItem['outcomeType'],
    summary: string,
  ) => void | Promise<void>
  postTitle: string
  initialType?: PostOutcomeItem['outcomeType']
}) {
  const [outcomeType, setOutcomeType] =
    useState<PostOutcomeItem['outcomeType']>(initialType)
  const [summary, setSummary] = useState('')

  useEffect(() => {
    if (!open) return
    setOutcomeType(initialType)
    setSummary('')
  }, [open, initialType])

  if (!open) return null

  const options: Array<{
    value: PostOutcomeItem['outcomeType']
    label: string
    helper: string
  }> = [
    {
      value: 'author_followup',
      label: '작성자 등판 👀',
      helper: '작성자가 직접 남기는 추가 설명',
    },
    {
      value: 'update',
      label: '후기 추가 🔥',
      helper: '중간 진행 상황을 바로 공유',
    },
    {
      value: 'resolved',
      label: '결말 공개 👀',
      helper: '결과가 확실하게 정리됨',
    },
    {
      value: 'twist',
      label: '판 뒤집힘 ⚡',
      helper: '예상과 다르게 흐름이 바뀜',
    },
  ]

  const handleSubmit = () => {
    const trimmed = summary.trim()
    if (!trimmed) return
    void onSubmit(outcomeType, trimmed)
  }

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/30 backdrop-blur-md">
      <div className="mx-auto mt-16 max-w-sm rounded-[32px] border border-slate-200 bg-white p-5 text-slate-900 shadow-2xl">
        <div className="mb-1 text-lg font-bold">후기 등록</div>
        <div className="mb-4 text-sm text-slate-500">{postTitle}</div>

        <div className="space-y-2">
          {options.map((option) => {
            const active = outcomeType === option.value
            return (
              <button
                key={option.value}
                onClick={() => setOutcomeType(option.value)}
                className={`w-full rounded-2xl border px-4 py-3 text-left transition ${
                  active
                    ? 'border-[#bcd0ff] bg-[#4f7cff] text-white shadow-[0_12px_24px_rgba(79,124,255,0.20)]'
                    : 'border-slate-200/80 bg-white text-slate-900'
                }`}
              >
                <div className="text-sm font-bold">{option.label}</div>
                <div
                  className={`mt-1 text-xs ${active ? 'text-white/85' : 'text-slate-500'}`}
                >
                  {option.helper}
                </div>
              </button>
            )
          })}
        </div>

        <div className="mt-4">
          <textarea
            value={summary}
            maxLength={140}
            onChange={(e) => setSummary(e.target.value)}
            placeholder="예: 결국 연락했고 잘 됐음 / 퇴사 안 하고 합의봄 / 내가 오해한 거였음"
            className="min-h-[110px] w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none placeholder:text-slate-400"
          />
          <div className="mt-2 text-right text-[11px] text-slate-400">
            {summary.length}/140
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <button
            onClick={onClose}
            className="rounded-2xl border border-slate-200/80 bg-white px-4 py-3 font-bold shadow-[0_2px_10px_rgba(15,23,42,0.03)]"
          >
            취소
          </button>
          <button
            onClick={handleSubmit}
            className="rounded-2xl bg-slate-950 px-4 py-3 font-bold text-white shadow-[0_12px_24px_rgba(15,23,42,0.20)]"
          >
            후기 등록
          </button>
        </div>
      </div>
    </div>
  )
}

function MyActivityModal({
  open,
  onClose,
  myPosts,
  myComments,
  watchlistItems,
  unreadWatchlistCount,
  initialTab = 'posts',
  onOpenPost,
  onOpenWatchlistItem,
  onOpenComment,
  onLogout,
  onLogin,
  onMarkAllPostsSeen,
  onMarkAllCommentsSeen,
  onMarkAllWatchlistSeen,
  profile,
  stats,
  badges,
}: {
  open: boolean
  onClose: () => void
  myPosts: MyPostItem[]
  myComments: MyCommentItem[]
  watchlistItems: WatchlistItem[]
  unreadWatchlistCount: number
  initialTab?: 'posts' | 'comments' | 'watchlist'
  onOpenPost: (postId: number, markSeenPostId?: number) => void
  onOpenWatchlistItem: (item: WatchlistItem) => void
  onOpenComment: (postId: number, commentId?: number) => void
  onLogout: () => void
  onLogin: () => void
  onMarkAllPostsSeen: () => void
  onMarkAllCommentsSeen: () => void
  onMarkAllWatchlistSeen: () => void
  profile: ProfileRow | null
  stats: UserStatsRow
  badges: string[]
}) {
  const [tab, setTab] = useState<'posts' | 'comments' | 'watchlist'>(initialTab)
  const [profileExpanded, setProfileExpanded] = useState(false)
  const [watchlistFilter, setWatchlistFilter] =
    useState<WatchlistItem['watchStatus']>('updated')
  const [postFilter, setPostFilter] = useState<'new' | 'all'>('new')
  const [commentFilter, setCommentFilter] = useState<'new' | 'all'>('new')

  useEffect(() => {
    if (open) {
      setTab(initialTab)
      setProfileExpanded(false)
      setWatchlistFilter('updated')
      setPostFilter('new')
      setCommentFilter('new')
    }
  }, [open, initialTab])

  if (!open) return null

  const levelInfo = getLevelInfo(stats.points)
  const levelTheme = getLevelTheme(levelInfo.level)
  const topBadges = badges.slice(0, 3)
  const extraBadgeCount = Math.max(0, badges.length - topBadges.length)
  const summaryStats = [
    { label: '글', value: stats.posts_count },
    { label: '댓글', value: stats.comments_count },
    { label: '궁금', value: watchlistItems.length },
  ]

  const unreadMyPostCount = myPosts.filter(
    (item) => Number(item.newCommentsCount ?? 0) > 0,
  ).length
  const unreadMyCommentCount = myComments.filter(
    (item) => Number(item.newRepliesCount ?? 0) > 0,
  ).length

  const updatedWatchlistItems = watchlistItems.filter(
    (item) => item.watchStatus === 'updated',
  )
  const waitingWatchlistItems = watchlistItems.filter(
    (item) => item.watchStatus === 'waiting',
  )
  const archivedWatchlistItems = watchlistItems.filter(
    (item) => item.watchStatus === 'archived',
  )
  const filteredWatchlistItems =
    watchlistFilter === 'updated'
      ? updatedWatchlistItems
      : watchlistFilter === 'waiting'
        ? waitingWatchlistItems
        : archivedWatchlistItems

  const postsWithNew = myPosts.filter(
    (item) => Number(item.newCommentsCount ?? 0) > 0,
  )
  const commentsWithNew = myComments.filter(
    (item) => Number(item.newRepliesCount ?? 0) > 0,
  )

  const filteredMyPosts = postFilter === 'new' ? postsWithNew : myPosts
  const filteredMyComments =
    commentFilter === 'new' ? commentsWithNew : myComments

  return (
    <div className="fixed inset-0 z-40 overflow-hidden bg-slate-900/30 backdrop-blur-md">
      <div className="mx-auto flex h-[100svh] w-full min-h-0 max-w-md flex-col overflow-hidden bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] pb-[env(safe-area-inset-bottom)] text-slate-900">
        <div className="shrink-0 flex items-center justify-between border-b border-slate-200/80 px-5 py-4">
          <div>
            <div className="text-lg font-bold">내 활동</div>
            <div className="text-sm text-slate-500">
              내 글, 댓글, 저장한 글 모아보기
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white shadow-[0_6px_18px_rgba(15,23,42,0.05)]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="shrink-0 px-4 pt-3">
          <div className="rounded-[28px] border border-slate-200/90 bg-white/95 px-4 py-3 shadow-[0_12px_30px_rgba(15,23,42,0.05)]">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="truncate text-[15px] font-bold text-slate-900">
                    {profile?.anonymous_name ?? '익명 유저'}
                  </div>
                  <span
                    className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-bold ${levelTheme.chipClass}`}
                  >
                    <span>{levelTheme.icon}</span>
                    <span>Lv.{levelInfo.level}</span>
                    <span>{levelInfo.label}</span>
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                  <span className="rounded-full bg-[#eef3ff] px-2.5 py-1 font-black text-[#4f7cff]">
                    {stats.points}P
                  </span>
                  <span>판단 {stats.votes_count}</span>
                  <span>·</span>
                  <span>받은 공감 {stats.likes_received}</span>
                </div>
              </div>

              <button
                onClick={() => setProfileExpanded((prev) => !prev)}
                className="shrink-0 rounded-full border border-slate-200 bg-white px-3 py-1 text-slate-500.5 text-[11px] font-bold text-slate-600"
              >
                {profileExpanded ? '접기' : '더보기'}
              </button>
            </div>

            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              {summaryStats.map((item) => (
                <div
                  key={item.label}
                  className="rounded-2xl bg-slate-50 px-2 py-2.5"
                >
                  <div className="text-[10px] font-semibold text-slate-400">
                    {item.label}
                  </div>
                  <div className="mt-1 text-sm font-extrabold text-slate-900">
                    {item.value}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              {topBadges.length === 0 ? (
                <div className="text-[11px] text-slate-400">
                  아직 획득한 뱃지 없음
                </div>
              ) : (
                topBadges.map((badge) => {
                  const badgeTheme = getBadgeTheme(badge)
                  return (
                    <span
                      key={badge}
                      className={`rounded-full border px-2.5 py-1 text-[10px] font-bold ${badgeTheme.pillClass}`}
                    >
                      {badgeTheme.icon} {badge}
                    </span>
                  )
                })
              )}
              {extraBadgeCount > 0 ? (
                <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-bold text-slate-500">
                  +{extraBadgeCount}
                </span>
              ) : null}
            </div>

            <div className="overflow-hidden">
              {profileExpanded ? (
                <div className="overflow-hidden">
                  <div className="mt-3 border-t border-slate-100 pt-3">
                    <div className="mb-1 flex items-center justify-between text-[11px] text-slate-500">
                      <span>다음 레벨 진행도</span>
                      <span>{levelInfo.progress}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-100">
                      <div
                        className="h-2 rounded-full bg-[#4f7cff] transition-all"
                        style={{ width: `${levelInfo.progress}%` }}
                      />
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                      <div className="rounded-2xl bg-slate-50 px-3 py-2">
                        <div className="text-slate-400">판단</div>
                        <div className="mt-1 font-bold text-slate-900">
                          {stats.votes_count}
                        </div>
                      </div>
                      <div className="rounded-2xl bg-slate-50 px-3 py-2">
                        <div className="text-slate-400">받은 공감</div>
                        <div className="mt-1 font-bold text-slate-900">
                          {stats.likes_received}
                        </div>
                      </div>
                    </div>

                    {badges.length > 0 ? (
                      <div className="mt-3">
                        <div className="mb-2 text-[11px] font-semibold text-slate-500">
                          전체 뱃지
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {badges.map((badge) => {
                            const badgeTheme = getBadgeTheme(badge)
                            return (
                              <span
                                key={`expanded-${badge}`}
                                className={`rounded-full border px-2.5 py-1 text-[10px] font-bold ${badgeTheme.pillClass}`}
                              >
                                {badgeTheme.icon} {badge}
                              </span>
                            )
                          })}
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          <div className="mt-3 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <button
              onClick={() => setTab('posts')}
              className={`shrink-0 rounded-full px-4 py-2 text-[13px] font-bold shadow-sm ${
                tab === 'posts'
                  ? 'bg-[#4f7cff] text-white shadow-[0_10px_24px_rgba(79,124,255,0.26)]'
                  : 'bg-slate-100 text-slate-700'
              }`}
            >
              내 글
              {unreadMyPostCount > 0 ? (
                <span className="ml-1.5 inline-flex min-w-[18px] items-center justify-center rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-black text-white">
                  {unreadMyPostCount}
                </span>
              ) : null}
            </button>
            <button
              onClick={() => setTab('comments')}
              className={`shrink-0 rounded-full px-4 py-2 text-[13px] font-bold shadow-sm ${
                tab === 'comments'
                  ? 'bg-[#4f7cff] text-white shadow-[0_10px_24px_rgba(79,124,255,0.26)]'
                  : 'bg-slate-100 text-slate-700'
              }`}
            >
              내 댓글
              {unreadMyCommentCount > 0 ? (
                <span className="ml-1.5 inline-flex min-w-[18px] items-center justify-center rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-black text-white">
                  {unreadMyCommentCount}
                </span>
              ) : null}
            </button>
            <button
              onClick={() => setTab('watchlist')}
              className={`shrink-0 rounded-full px-4 py-2 text-[13px] font-bold shadow-sm ${
                tab === 'watchlist'
                  ? 'bg-[#4f7cff] text-white shadow-[0_10px_24px_rgba(79,124,255,0.26)]'
                  : 'bg-slate-100 text-slate-700'
              }`}
            >
              궁금한 글
              {unreadWatchlistCount > 0 ? (
                <span className="ml-1.5 inline-flex min-w-[18px] items-center justify-center rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-black text-white">
                  {unreadWatchlistCount}
                </span>
              ) : null}
            </button>
          </div>

          {tab === 'posts' ? (
            <div className="mt-3 rounded-3xl border border-slate-200/80 bg-white p-3 shadow-[0_12px_30px_rgba(15,23,42,0.05)]">
              <div className="flex items-center justify-between gap-2">
                <div className="flex flex-wrap gap-2">
                  {[
                    {
                      key: 'new',
                      label: '새 반응',
                      count: postsWithNew.length,
                    },
                    { key: 'all', label: '전체', count: myPosts.length },
                  ].map((item) => {
                    const active = postFilter === item.key
                    return (
                      <button
                        key={item.key}
                        onClick={() => setPostFilter(item.key as 'new' | 'all')}
                        className={`rounded-full px-3.5 py-2 text-[12px] font-bold transition ${
                          active
                            ? 'bg-[#4f7cff] text-white shadow-[0_10px_24px_rgba(79,124,255,0.22)]'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {item.label}
                        <span
                          className={`ml-1.5 inline-flex min-w-[18px] items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-black ${
                            active
                              ? 'bg-white/20 text-white'
                              : 'bg-white text-slate-500'
                          }`}
                        >
                          {item.count}
                        </span>
                      </button>
                    )
                  })}
                </div>
                {unreadMyPostCount > 0 ? (
                  <button
                    onClick={onMarkAllPostsSeen}
                    className="shrink-0 rounded-full border border-rose-200 bg-rose-50 px-3 py-1.5 text-[11px] font-bold text-rose-600"
                  >
                    전체 읽음
                  </button>
                ) : null}
              </div>
            </div>
          ) : null}

          {tab === 'comments' ? (
            <div className="mt-3 rounded-3xl border border-slate-200/80 bg-white p-3 shadow-[0_12px_30px_rgba(15,23,42,0.05)]">
              <div className="flex items-center justify-between gap-2">
                <div className="flex flex-wrap gap-2">
                  {[
                    {
                      key: 'new',
                      label: '새 반응',
                      count: commentsWithNew.length,
                    },
                    { key: 'all', label: '전체', count: myComments.length },
                  ].map((item) => {
                    const active = commentFilter === item.key
                    return (
                      <button
                        key={item.key}
                        onClick={() =>
                          setCommentFilter(item.key as 'new' | 'all')
                        }
                        className={`rounded-full px-3.5 py-2 text-[12px] font-bold transition ${
                          active
                            ? 'bg-[#4f7cff] text-white shadow-[0_10px_24px_rgba(79,124,255,0.22)]'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {item.label}
                        <span
                          className={`ml-1.5 inline-flex min-w-[18px] items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-black ${
                            active
                              ? 'bg-white/20 text-white'
                              : 'bg-white text-slate-500'
                          }`}
                        >
                          {item.count}
                        </span>
                      </button>
                    )
                  })}
                </div>
                {unreadMyCommentCount > 0 ? (
                  <button
                    onClick={onMarkAllCommentsSeen}
                    className="shrink-0 rounded-full border border-rose-200 bg-rose-50 px-3 py-1.5 text-[11px] font-bold text-rose-600"
                  >
                    전체 읽음
                  </button>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3.5 [webkit-overflow-scrolling:touch]">
          {tab === 'posts' && filteredMyPosts.length === 0 ? (
            <div className="rounded-3xl border border-slate-200 bg-white px-4 py-5 text-sm text-slate-500 shadow-[0_12px_30px_rgba(15,23,42,0.05)]">
              {postFilter === 'new'
                ? '아직 새 반응이 온 글이 없음'
                : '아직 작성한 글이 없음'}
            </div>
          ) : null}

          {tab === 'comments' && filteredMyComments.length === 0 ? (
            <div className="rounded-3xl border border-slate-200 bg-white px-4 py-5 text-sm text-slate-500 shadow-[0_12px_30px_rgba(15,23,42,0.05)]">
              {commentFilter === 'new'
                ? '아직 새 반응이 온 댓글이 없음'
                : '아직 작성한 댓글이 없음'}
            </div>
          ) : null}

          {tab === 'watchlist' && (
            <>
              <div className="rounded-3xl border border-slate-200/80 bg-white p-3 shadow-[0_12px_30px_rgba(15,23,42,0.05)]">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex flex-wrap gap-2">
                    {[
                      {
                        key: 'updated',
                        label: '새 소식',
                        count: updatedWatchlistItems.length,
                      },
                      {
                        key: 'waiting',
                        label: '대기중',
                        count: waitingWatchlistItems.length,
                      },
                      {
                        key: 'archived',
                        label: '보관됨',
                        count: archivedWatchlistItems.length,
                      },
                    ].map((item) => {
                      const active = watchlistFilter === item.key
                      return (
                        <button
                          key={item.key}
                          onClick={() =>
                            setWatchlistFilter(
                              item.key as WatchlistItem['watchStatus'],
                            )
                          }
                          className={`rounded-full px-3.5 py-2 text-[12px] font-bold transition ${
                            active
                              ? 'bg-[#4f7cff] text-white shadow-[0_10px_24px_rgba(79,124,255,0.22)]'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {item.label}
                          <span
                            className={`ml-1.5 inline-flex min-w-[18px] items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-black ${
                              active
                                ? 'bg-white/20 text-white'
                                : 'bg-white text-slate-500'
                            }`}
                          >
                            {item.count}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                  {unreadWatchlistCount > 0 ? (
                    <button
                      onClick={onMarkAllWatchlistSeen}
                      className="shrink-0 rounded-full border border-rose-200 bg-rose-50 px-3 py-1.5 text-[11px] font-bold text-rose-600"
                    >
                      전체 읽음
                    </button>
                  ) : null}
                </div>
                <div className="mt-2 text-[11px] text-slate-500">
                  새 소식을 누르면 먼저 보여주고, 확인한 글은 보관됨으로 자동
                  이동
                </div>
              </div>

              {watchlistItems.length === 0 ? (
                <div className="rounded-3xl border border-slate-200 bg-white px-4 py-5 text-sm text-slate-500 shadow-[0_12px_30px_rgba(15,23,42,0.05)]">
                  결말궁금으로 저장한 글이 없음
                </div>
              ) : filteredWatchlistItems.length === 0 ? (
                <div className="rounded-3xl border border-slate-200 bg-white px-4 py-5 text-sm text-slate-500 shadow-[0_12px_30px_rgba(15,23,42,0.05)]">
                  {watchlistFilter === 'updated'
                    ? '아직 새로 도착한 후기가 없음'
                    : watchlistFilter === 'waiting'
                      ? '후기 대기중인 글이 없음'
                      : '보관된 업데이트가 없음'}
                </div>
              ) : null}
            </>
          )}

          {tab === 'posts' &&
            filteredMyPosts.map((item) => (
              <button
                key={item.id}
                onClick={() => onOpenPost(item.postId, item.postId)}
                className="w-full rounded-3xl border border-slate-200/80 bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] p-4 text-left shadow-[0_12px_30px_rgba(15,23,42,0.06)]"
              >
                <div className="text-xs text-slate-500">
                  {item.category} · {item.ageGroup}
                </div>
                <div className="mt-1 font-bold text-slate-900">
                  {item.title}
                </div>
                {item.hasNewComments ? (
                  <div className="mt-2 inline-flex items-center rounded-full border border-rose-100 bg-emerald-50 px-2.5 py-1 text-[11px] font-black text-rose-600">
                    새 댓글 {item.newCommentsCount ?? 1}개
                  </div>
                ) : (item.totalCommentsCount ?? 0) > 0 ? (
                  <div className="mt-2 inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-black text-slate-600">
                    댓글 {item.totalCommentsCount ?? 0}개
                  </div>
                ) : (
                  <div className="mt-2 inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-black text-slate-400">
                    아직 반응 없음
                  </div>
                )}
                <div className="mt-2 text-xs text-slate-400">올린 글 보기</div>
              </button>
            ))}

          {tab === 'comments' &&
            filteredMyComments.map((item) => (
              <button
                key={item.id}
                onClick={() => onOpenComment(item.postId, item.commentId)}
                className="w-full rounded-3xl border border-slate-200/80 bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] p-4 text-left shadow-[0_12px_30px_rgba(15,23,42,0.06)]"
              >
                <div className="text-xs text-slate-500">{item.postTitle}</div>
                <div className="mt-1 text-sm text-slate-900/85">
                  {item.text}
                </div>
                {item.hasNewReplies ? (
                  <div className="mt-2 inline-flex items-center rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-[11px] font-black text-rose-700">
                    🔥 새 반박 {item.newRepliesCount ?? 1}개
                  </div>
                ) : (item.totalRepliesCount ?? 0) > 0 ? (
                  <div className="mt-2 inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-black text-slate-600">
                    반박 {item.totalRepliesCount ?? 0}개
                  </div>
                ) : (
                  <div className="mt-2 inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-black text-slate-400">
                    아직 반응 없음
                  </div>
                )}
                <div className="mt-2 text-xs text-slate-400">
                  댓글 단 글로 이동
                </div>
              </button>
            ))}

          {tab === 'watchlist' &&
            filteredWatchlistItems.map((item) => {
              const statusMeta = getWatchlistStatusMeta(item.watchStatus)
              return (
                <button
                  key={item.id}
                  onClick={() => onOpenWatchlistItem(item)}
                  className="w-full rounded-3xl border border-slate-200/80 bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] p-4 text-left shadow-[0_12px_30px_rgba(15,23,42,0.06)]"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="text-xs text-slate-500">
                      {item.category} · {item.ageGroup}
                    </div>
                    <span
                      className={`rounded-full border px-2.5 py-1 text-[10px] font-bold ${statusMeta.toneClass}`}
                    >
                      {statusMeta.label}
                    </span>
                    {item.latestOutcomeType ? (
                      <span
                        className={`rounded-full border px-2.5 py-1 text-[10px] font-bold ${getOutcomeTone(item.latestOutcomeType)}`}
                      >
                        {getOutcomeLabel(item.latestOutcomeType)}
                      </span>
                    ) : null}
                    {item.unreadOutcome ? (
                      <span className="rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-[10px] font-black text-rose-700">
                        읽기 전
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-1 font-bold text-slate-900">
                    {item.title}
                  </div>
                  <div className="mt-2 text-xs text-slate-500">
                    {item.latestOutcomeSummary ??
                      (item.watchStatus === 'archived'
                        ? '이미 확인한 업데이트 글'
                        : '나중에 결과 보려고 저장한 글')}
                  </div>
                  <div className="mt-2 text-xs text-slate-400">
                    {item.watchStatus === 'updated'
                      ? '눌러서 확인하면 보관됨으로 이동'
                      : item.watchStatus === 'archived'
                        ? '다시 본 업데이트 글'
                        : '결말 기다리는 글'}
                  </div>
                </button>
              )
            })}
        </div>

        <div className="shrink-0 border-t border-slate-200 px-5 py-4">
          {profile?.id ? (
            <button
              onClick={onLogout}
              className="w-full rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-600"
            >
              로그아웃
            </button>
          ) : (
            <button
              onClick={onLogin}
              className="w-full rounded-2xl border border-[#cdd9ff] bg-[#eef3ff] px-4 py-3 text-sm font-bold text-[#335cff]"
            >
              로그인하고 이어보기
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function DeletedItemsModal({
  open,
  onClose,
  deletedPosts,
  deletedComments,
  onRestorePost,
  onRestoreComment,
}: {
  open: boolean
  onClose: () => void
  deletedPosts: PostItem[]
  deletedComments: DeletedCommentItem[]
  onRestorePost: (postId: number) => void
  onRestoreComment: (commentId: number) => void
}) {
  const [tab, setTab] = useState<'posts' | 'comments'>('posts')

  useEffect(() => {
    if (open) setTab('posts')
  }, [open])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-40 overflow-hidden bg-slate-900/30 backdrop-blur-md">
      <div className="mx-auto flex h-[100svh] w-full min-h-0 max-w-md flex-col overflow-hidden bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] pb-[env(safe-area-inset-bottom)] text-slate-900">
        <div className="shrink-0 flex items-center justify-between border-b border-slate-200/80 px-5 py-4">
          <div>
            <div className="text-lg font-bold">삭제 항목 관리</div>
            <div className="text-sm text-slate-500">관리자만 복구 가능</div>
          </div>
          <button
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white shadow-[0_6px_18px_rgba(15,23,42,0.05)]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-5 pt-4">
          <div className="flex gap-2">
            <button
              onClick={() => setTab('posts')}
              className={`rounded-full px-4 py-2 text-sm font-bold ${
                tab === 'posts'
                  ? 'bg-[#4f7cff] text-slate-900'
                  : 'bg-slate-100 text-slate-700'
              }`}
            >
              삭제된 글
            </button>
            <button
              onClick={() => setTab('comments')}
              className={`rounded-full px-4 py-2 text-sm font-bold ${
                tab === 'comments'
                  ? 'bg-[#4f7cff] text-slate-900'
                  : 'bg-slate-100 text-slate-700'
              }`}
            >
              삭제된 댓글
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {tab === 'posts' && deletedPosts.length === 0 && (
            <div className="text-sm text-slate-500">삭제된 글이 없음</div>
          )}
          {tab === 'comments' && deletedComments.length === 0 && (
            <div className="text-sm text-slate-500">삭제된 댓글이 없음</div>
          )}

          {tab === 'posts' &&
            deletedPosts.map((post) => (
              <div
                key={post.id}
                className="rounded-3xl border border-slate-200/80 bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] p-4 shadow-[0_12px_30px_rgba(15,23,42,0.06)]"
              >
                <div className="text-xs text-slate-500">
                  {post.category} · {post.ageGroup}
                </div>
                <div className="mt-1 font-bold text-slate-900">
                  {post.title}
                </div>
                <div className="mt-2 text-sm text-slate-600 line-clamp-2">
                  {post.content}
                </div>
                <button
                  onClick={() => onRestorePost(post.id)}
                  className="mt-3 rounded-2xl bg-[#4f7cff] px-4 py-2 text-sm font-bold text-slate-900"
                >
                  글 복구
                </button>
              </div>
            ))}

          {tab === 'comments' &&
            deletedComments.map((comment) => (
              <div
                key={comment.id}
                className="rounded-3xl border border-slate-200/80 bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] p-4 shadow-[0_12px_30px_rgba(15,23,42,0.06)]"
              >
                <div className="text-xs text-slate-500">
                  {comment.postTitle}
                </div>
                <div className="mt-1 text-sm font-semibold text-slate-900">
                  {comment.author}
                </div>
                <div className="mt-2 text-sm text-slate-700">
                  {comment.text}
                </div>
                <button
                  onClick={() => onRestoreComment(comment.id)}
                  className="mt-3 rounded-2xl bg-[#4f7cff] px-4 py-2 text-sm font-bold text-slate-900"
                >
                  댓글 복구
                </button>
              </div>
            ))}
        </div>
      </div>
    </div>
  )
}

function CommentModal({
  post,
  open,
  onClose,
  onAddComment,
  onOpenReportComment,
  adminMode,
  onAdminRestoreComment,
  onAdminDeleteComment,
  guestName,
  featuredBadge,
  currentUserLevel,
  authorMetaMap,
  currentActorKey,
  commentReactionMap,
  myCommentReactions,
  initialHighlightCommentId,
  onReactComment,
  onExposeComments,
}: {
  post: PostItem | null
  open: boolean
  onClose: () => void
  onAddComment: (
    text: string,
    side: Side,
    replyToCommentId?: number | null,
  ) => Promise<void> | void
  onOpenReportComment: (commentId: number) => void
  adminMode: boolean
  onAdminRestoreComment: (commentId: number) => void
  onAdminDeleteComment: (commentId: number) => void
  guestName: string
  featuredBadge?: string | null
  currentUserLevel?: number
  authorMetaMap: Record<string, AuthorMeta>
  currentActorKey?: string | null
  commentReactionMap: Record<number, CommentReactionSummary>
  myCommentReactions: Record<string, boolean>
  initialHighlightCommentId?: number | null
  onReactComment: (
    commentId: number,
    reactionType: CommentReactionType,
  ) => void | Promise<void>
  onExposeComments?: (count: number) => void
}) {
  const [text, setText] = useState('')
  const [commentSide, setCommentSide] = useState<Side>('left')
  const [activeTab, setActiveTab] = useState<Side>('left')
  const [sortType, setSortType] = useState<'best' | 'battle' | 'latest'>('best')
  const [visibleCount, setVisibleCount] = useState(12)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [pendingScrollId, setPendingScrollId] = useState<number | null>(null)
  const [replyTarget, setReplyTarget] = useState<{
    commentId: number
    author: string
    side: Side
  } | null>(null)
  const [reactionPulseKey, setReactionPulseKey] = useState<string | null>(null)
  const [recentBattleCommentId, setRecentBattleCommentId] = useState<
    number | null
  >(null)
  const [pendingOwnCommentMatch, setPendingOwnCommentMatch] = useState<{
    text: string
    side: Side
    author: string
  } | null>(null)
  const [highlightCommentId, setHighlightCommentId] = useState<number | null>(
    null,
  )
  const [lastSubmittedCommentId, setLastSubmittedCommentId] = useState<
    number | null
  >(null)
  const [suppressAutoKeyboard, setSuppressAutoKeyboard] = useState(true)
  const inputRef = useRef<HTMLTextAreaElement | null>(null)
  const replyTargetRef = useRef<{
    commentId: number
    author: string
    side: Side
  } | null>(null)
  const unlockingKeyboardRef = useRef(false)
  const scrollAreaRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return
    setVisibleCount(12)
    setPendingScrollId(null)
    setReplyTarget(null)
    setReactionPulseKey(null)
    setRecentBattleCommentId(null)
    setPendingOwnCommentMatch(null)
    setHighlightCommentId(null)
    setLastSubmittedCommentId(null)
    setSuppressAutoKeyboard(true)
    replyTargetRef.current = null
    unlockingKeyboardRef.current = false
  }, [open, post?.id])

  const unlockCommentInput = useCallback(() => {
    if (!suppressAutoKeyboard || unlockingKeyboardRef.current) return
    unlockingKeyboardRef.current = true
    setSuppressAutoKeyboard(false)

    if (typeof window === 'undefined') return

    const target = inputRef.current
    if (!target) {
      unlockingKeyboardRef.current = false
      return
    }

    try {
      target.scrollIntoView({ behavior: 'smooth', block: 'center' })
    } catch {}

    window.setTimeout(() => {
      const liveTarget = inputRef.current
      if (!liveTarget) {
        unlockingKeyboardRef.current = false
        return
      }

      try {
        liveTarget.focus({ preventScroll: true })
      } catch {
        liveTarget.focus()
      }

      try {
        const valueLength = liveTarget.value?.length ?? 0
        liveTarget.setSelectionRange(valueLength, valueLength)
      } catch {}

      window.setTimeout(() => {
        unlockingKeyboardRef.current = false
      }, 120)
    }, 220)
  }, [suppressAutoKeyboard])

  useEffect(() => {
    if (!open) return
    setCommentSide(activeTab)
  }, [activeTab, open])

  useEffect(() => {
    if (!open || !post) return

    const exposedCount = Math.min(
      5,
      (post.comments ?? []).filter((comment) => !comment.hidden || adminMode)
        .length,
    )

    if (exposedCount > 0) {
      onExposeComments?.(exposedCount)
    }
  }, [open, post?.id, adminMode, onExposeComments])

  useEffect(() => {
    if (!pendingScrollId || typeof window === 'undefined') return

    const timer = window.setTimeout(() => {
      const el = document.getElementById(`comment-row-${pendingScrollId}`)
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
      setPendingScrollId(null)
    }, 120)

    return () => {
      window.clearTimeout(timer)
    }
  }, [pendingScrollId, activeTab, sortType])

  const visiblePool = useMemo(() => {
    if (!post) return []
    return (post.comments ?? []).filter(
      (comment) => !comment.hidden || adminMode,
    )
  }, [post, adminMode])

  const commentRows = useMemo(() => {
    if (!post) return []

    const leftCommentCount = visiblePool.filter(
      (comment) => comment.side === 'left',
    ).length
    const rightCommentCount = visiblePool.filter(
      (comment) => comment.side === 'right',
    ).length
    const majoritySide: Side | null =
      leftCommentCount === rightCommentCount
        ? null
        : leftCommentCount > rightCommentCount
          ? 'left'
          : 'right'

    return visiblePool.map((comment) => {
      const reactionSummary =
        commentReactionMap[comment.id] ?? EMPTY_COMMENT_REACTION_SUMMARY

      const supportiveReactionTotal =
        Number(reactionSummary.relatable ?? 0) +
        Number(reactionSummary.agree ?? 0) +
        Number(reactionSummary.wow ?? 0)

      const conflictReactionTotal =
        Number(reactionSummary.disagree ?? 0) +
        Number(reactionSummary.absurd ?? 0)

      const reactionTotal = supportiveReactionTotal + conflictReactionTotal
      const isMinority = !!majoritySide && comment.side !== majoritySide

      return {
        comment,
        reactionSummary,
        reactionTotal,
        supportiveReactionTotal,
        conflictReactionTotal,
        heatScore: supportiveReactionTotal,
        battleScore:
          reactionTotal >= 3
            ? Math.max(
                0,
                Math.min(supportiveReactionTotal, conflictReactionTotal),
              ) *
                2 +
              conflictReactionTotal * 2 +
              (reactionTotal >= 6 ? 2 : 0)
            : 0,
        isMinority,
      }
    })
  }, [post, visiblePool, commentReactionMap])

  const leftRows = useMemo(
    () => commentRows.filter((item) => item.comment.side === 'left'),
    [commentRows],
  )

  const rightRows = useMemo(
    () => commentRows.filter((item) => item.comment.side === 'right'),
    [commentRows],
  )

  const sortRows = useCallback(
    (rows: typeof commentRows) => {
      const cloned = [...rows]
      if (sortType === 'latest') {
        return cloned.sort((a, b) => b.comment.id - a.comment.id)
      }
      if (sortType === 'battle') {
        return cloned.sort((a, b) => {
          if (b.battleScore !== a.battleScore)
            return b.battleScore - a.battleScore
          if (b.reactionTotal !== a.reactionTotal)
            return b.reactionTotal - a.reactionTotal
          return b.comment.id - a.comment.id
        })
      }
      return cloned.sort((a, b) => {
        if (b.heatScore !== a.heatScore) return b.heatScore - a.heatScore
        if (b.reactionTotal !== a.reactionTotal)
          return b.reactionTotal - a.reactionTotal
        return b.comment.id - a.comment.id
      })
    },
    [sortType],
  )

  const sortedLeftRows = useMemo(() => sortRows(leftRows), [leftRows, sortRows])
  const sortedRightRows = useMemo(
    () => sortRows(rightRows),
    [rightRows, sortRows],
  )

  const currentRows = activeTab === 'left' ? sortedLeftRows : sortedRightRows
  const visibleRows = currentRows.slice(0, visibleCount)
  const hasMoreComments = currentRows.length > visibleCount

  const sideSummary = useMemo(() => {
    const total = commentRows.length
    const leftCount = leftRows.length
    const rightCount = rightRows.length
    const leftPercent = total > 0 ? Math.round((leftCount / total) * 100) : 50
    const rightPercent = total > 0 ? Math.round((rightCount / total) * 100) : 50

    return {
      total,
      leftCount,
      rightCount,
      leftPercent,
      rightPercent,
    }
  }, [commentRows.length, leftRows.length, rightRows.length])

  const bestCommentRow = useMemo(() => {
    return (
      [...commentRows].sort((a, b) => {
        if (b.heatScore !== a.heatScore) return b.heatScore - a.heatScore
        if (b.reactionTotal !== a.reactionTotal)
          return b.reactionTotal - a.reactionTotal
        return b.comment.id - a.comment.id
      })[0] ?? null
    )
  }, [commentRows])

  const liveCommentRow = useMemo(() => {
    return (
      [...commentRows].sort((a, b) => {
        if (b.battleScore !== a.battleScore)
          return b.battleScore - a.battleScore
        if (b.reactionTotal !== a.reactionTotal)
          return b.reactionTotal - a.reactionTotal
        return b.comment.id - a.comment.id
      })[0] ?? null
    )
  }, [commentRows])

  const liveBattleHelperText = useMemo(() => {
    if (!liveCommentRow || liveCommentRow.battleScore < 2) {
      return '아직 제대로 붙은 댓글은 없음'
    }

    if (recentBattleCommentId === liveCommentRow.comment.id) {
      return '방금 반박 들어옴 · 지금 전투감 제일 강함'
    }

    if (liveCommentRow.conflictReactionTotal >= 3) {
      return '반박이 계속 꽂히는 중'
    }

    if (liveCommentRow.reactionTotal >= 6) {
      return '사람들이 계속 달려드는 댓글'
    }

    return '반박이 오가기 시작한 댓글'
  }, [liveCommentRow, recentBattleCommentId])

  const scrollCommentListToTop = useCallback(() => {
    if (typeof window === 'undefined') return

    window.requestAnimationFrame(() => {
      scrollAreaRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
    })
  }, [])

  useEffect(() => {
    if (!open || !post || !pendingOwnCommentMatch) return

    const targetComment = [...(post.comments ?? [])]
      .filter(
        (comment) =>
          !comment.hidden &&
          comment.side === pendingOwnCommentMatch.side &&
          comment.author === pendingOwnCommentMatch.author &&
          comment.text.trim() === pendingOwnCommentMatch.text.trim(),
      )
      .sort((a, b) => b.id - a.id)[0]

    if (!targetComment) return

    setActiveTab(pendingOwnCommentMatch.side)
    setSortType('latest')
    setVisibleCount((prev) => Math.max(prev, 12))
    scrollCommentListToTop()
    setPendingScrollId(targetComment.id)
    setHighlightCommentId(targetComment.id)
    setLastSubmittedCommentId(targetComment.id)
    setPendingOwnCommentMatch(null)

    if (typeof window !== 'undefined') {
      window.setTimeout(() => {
        setHighlightCommentId((prev) =>
          prev === targetComment.id ? null : prev,
        )
      }, 3000)
      window.setTimeout(() => {
        setLastSubmittedCommentId((prev) =>
          prev === targetComment.id ? null : prev,
        )
      }, 3600)
    }
  }, [open, post, pendingOwnCommentMatch, scrollCommentListToTop])

  const openHighlightComment = useCallback(
    (row: (typeof commentRows)[number] | null, mode?: 'best' | 'battle') => {
      if (!row) return

      const nextTab = row.comment.side
      const targetRows = nextTab === 'left' ? sortedLeftRows : sortedRightRows
      const targetIndex = targetRows.findIndex(
        (item) => item.comment.id === row.comment.id,
      )

      if (mode) {
        setSortType(mode)
      }
      setActiveTab(nextTab)
      if (targetIndex >= 0) {
        setVisibleCount((prev) => Math.max(prev, targetIndex + 1, 12))
      }
      scrollCommentListToTop()
      setPendingScrollId(row.comment.id)
    },
    [scrollCommentListToTop, sortedLeftRows, sortedRightRows],
  )

  useEffect(() => {
    if (!open || !post || !initialHighlightCommentId) return

    const targetComment = (post.comments ?? []).find(
      (comment) => !comment.hidden && comment.id === initialHighlightCommentId,
    )

    if (!targetComment) return

    setActiveTab(targetComment.side)
    setSortType('latest')
    setVisibleCount(9999)
    setPendingScrollId(targetComment.id)
    setHighlightCommentId(targetComment.id)

    if (typeof window !== 'undefined') {
      window.setTimeout(() => {
        setHighlightCommentId((prev) =>
          prev === targetComment.id ? null : prev,
        )
      }, 3000)
    }
  }, [open, post, initialHighlightCommentId])

  const handleSortChange = useCallback(
    (nextSortType: 'best' | 'battle' | 'latest') => {
      setSortType(nextSortType)
      scrollCommentListToTop()
    },
    [scrollCommentListToTop],
  )

  if (!open || !post) return null

  const handleCommentReaction = async (
    commentId: number,
    reactionType: CommentReactionType,
    side: Side,
    author: string,
  ) => {
    const reactionKey = `${commentId}:${reactionType}`
    const wasActive = !!myCommentReactions[reactionKey]

    if (reactionType === 'disagree') {
      setRecentBattleCommentId(commentId)
      if (typeof window !== 'undefined') {
        window.setTimeout(() => {
          setRecentBattleCommentId((prev) => (prev === commentId ? null : prev))
        }, 2600)
      }
    }

    await Promise.resolve(onReactComment(commentId, reactionType))

    if (!wasActive) {
      const pulseKey = `${commentId}:${reactionType}`
      setReactionPulseKey(pulseKey)
      if (typeof window !== 'undefined') {
        window.setTimeout(() => {
          setReactionPulseKey((prev) => (prev === pulseKey ? null : prev))
        }, 520)
      }
    }
  }

  const submitComment = async () => {
    const trimmed = text.trim()
    if (!trimmed || isSubmitting) return

    setIsSubmitting(true)

    try {
      console.log('[matnya] submitComment', {
        text: trimmed,
        commentSide,
        replyTarget: null,
        replyTargetRef: null,
        resolvedReplyToCommentId: null,
      })
      await Promise.resolve(onAddComment(trimmed, commentSide, null))
      setPendingOwnCommentMatch({
        text: trimmed,
        side: commentSide,
        author: guestName,
      })
      setText('')
      setReplyTarget(null)
      replyTargetRef.current = null
    } catch (error) {
      console.error('댓글 등록 실패', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-40 overflow-hidden bg-slate-900/35 backdrop-blur-sm">
      <div className="mx-auto flex h-[100svh] w-full min-h-0 max-w-md flex-col overflow-hidden bg-[linear-gradient(180deg,#f9fbff_0%,#f4f7fc_100%)] text-slate-900">
        <div className="shrink-0 border-b border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.94)_0%,rgba(248,250,255,0.94)_100%)] px-3 py-2.5 shadow-[0_8px_20px_rgba(15,23,42,0.05)] backdrop-blur-xl">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#4f7cff]">
                comments
              </div>
              <div className="mt-0.5 text-[17px] font-extrabold tracking-tight text-slate-950">
                댓글 분위기 보기
              </div>
            </div>
            <button
              onClick={onClose}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200/80 bg-white/90 shadow-[0_8px_18px_rgba(15,23,42,0.06)]"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="mt-2 rounded-[18px] border border-slate-200/80 bg-white/90 p-2.5 shadow-[0_6px_18px_rgba(15,23,42,0.05)]">
            <div className="grid grid-cols-2 gap-1.5">
              <button
                onClick={() => setActiveTab('left')}
                className={`rounded-[14px] border px-2.5 py-1.5 text-left transition ${
                  activeTab === 'left'
                    ? 'border-blue-200 bg-blue-50 shadow-[0_8px_18px_rgba(59,130,246,0.10)]'
                    : 'border-slate-200 bg-white'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[12px] font-black text-blue-600">
                    {post.leftLabel}
                  </span>
                  <span className="text-[14px] font-black tracking-[-0.02em] text-blue-700">
                    {sideSummary.leftPercent}%
                  </span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-blue-100/80">
                  <div
                    className="h-full rounded-full bg-[#4f7cff] transition-all duration-500"
                    style={{
                      width: `${Math.max(sideSummary.leftPercent, sideSummary.leftCount > 0 ? 10 : 0)}%`,
                    }}
                  />
                </div>
              </button>

              <button
                onClick={() => setActiveTab('right')}
                className={`rounded-[14px] border px-2.5 py-1.5 text-left transition ${
                  activeTab === 'right'
                    ? 'border-violet-200 bg-violet-50 shadow-[0_8px_18px_rgba(124,58,237,0.10)]'
                    : 'border-slate-200 bg-white'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[12px] font-black text-violet-600">
                    {post.rightLabel}
                  </span>
                  <span className="text-[14px] font-black tracking-[-0.02em] text-violet-700">
                    {sideSummary.rightPercent}%
                  </span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-violet-100/80">
                  <div
                    className="h-full rounded-full bg-violet-500 transition-all duration-500"
                    style={{
                      width: `${Math.max(sideSummary.rightPercent, sideSummary.rightCount > 0 ? 10 : 0)}%`,
                    }}
                  />
                </div>
              </button>
            </div>

            <div className="mt-2 grid grid-cols-2 gap-2">
              <button
                onClick={() => openHighlightComment(bestCommentRow, 'best')}
                className="rounded-[18px] border border-amber-300/90 bg-[linear-gradient(135deg,rgba(255,251,235,0.99)_0%,rgba(254,243,199,0.98)_48%,rgba(255,255,255,0.98)_100%)] px-3 py-2.5 text-left shadow-[0_14px_28px_rgba(245,158,11,0.16)] transition hover:-translate-y-[1px] hover:shadow-[0_18px_32px_rgba(245,158,11,0.18)]"
              >
                <div className="flex items-center gap-1 text-[10px] font-extrabold tracking-[0.14em] text-amber-700">
                  <Flame className="h-3.5 w-3.5" />
                  BEST COMMENT
                </div>
                <div className="mt-0.5 text-[12px] font-black text-amber-950">
                  가장 반응 많은 댓글
                </div>
                <div className="mt-1 text-[11px] font-semibold text-amber-700/90">
                  사람들이 제일 신경 쓰는 한마디
                </div>
              </button>

              <button
                onClick={() => openHighlightComment(liveCommentRow, 'battle')}
                className="rounded-[18px] border border-rose-300/90 bg-[linear-gradient(135deg,rgba(255,241,242,0.99)_0%,rgba(254,205,211,0.98)_48%,rgba(255,255,255,0.98)_100%)] px-3 py-2.5 text-left shadow-[0_14px_28px_rgba(244,63,94,0.16)] transition hover:-translate-y-[1px] hover:shadow-[0_18px_32px_rgba(244,63,94,0.18)]"
              >
                <div className="flex items-center gap-1 text-[10px] font-extrabold tracking-[0.14em] text-rose-700">
                  <MessageCircle className="h-3.5 w-3.5" />
                  LIVE BATTLE
                </div>
                <div className="mt-0.5 text-[12px] font-black text-rose-950">
                  지금 싸우는 댓글
                </div>
                <div className="mt-1 text-[11px] font-semibold text-rose-700/90">
                  {liveBattleHelperText}
                </div>
              </button>
            </div>

            <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
              {[
                { value: 'best', label: '인기 댓글' },
                { value: 'battle', label: '싸우는 댓글' },
                { value: 'latest', label: '최신 댓글' },
              ].map((item) => (
                <button
                  key={item.value}
                  onClick={() =>
                    handleSortChange(item.value as 'best' | 'battle' | 'latest')
                  }
                  className={`rounded-full px-3 py-1.5 text-[11px] font-bold ${
                    sortType === item.value
                      ? 'bg-[linear-gradient(135deg,#5b7cff_0%,#4f7cff_55%,#6d8fff_100%)] text-white shadow-[0_10px_20px_rgba(79,124,255,0.20)]'
                      : 'border border-slate-200 bg-white text-slate-600'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div
          ref={scrollAreaRef}
          className="min-h-0 flex-1 overflow-y-auto px-2 py-2 [webkit-overflow-scrolling:touch]"
        >
          {visibleRows.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-white/90 px-4 py-6 text-center shadow-[0_8px_22px_rgba(15,23,42,0.04)]">
              <div className="text-sm font-bold text-slate-900">
                {activeTab === 'left' ? post.leftLabel : post.rightLabel} 쪽
                댓글이 아직 없음
              </div>
              <div className="mt-1 text-[13px] text-slate-500">
                첫 댓글이 붙으면 이 탭에서 바로 보임
              </div>
            </div>
          ) : (
            <div className="space-y-1.5">
              {visibleRows.map((item) => {
                const comment = item.comment
                const isBestComment = bestCommentRow?.comment.id === comment.id
                const isLiveBattle =
                  liveCommentRow?.comment.id === comment.id &&
                  item.battleScore >= 2
                const isLastSubmitted = lastSubmittedCommentId === comment.id
                const sideToneClass = isBestComment
                  ? 'border border-amber-300 bg-[linear-gradient(135deg,rgba(255,251,235,0.96)_0%,rgba(254,243,199,0.92)_45%,rgba(255,255,255,0.98)_100%)] shadow-[0_14px_28px_rgba(245,158,11,0.14)]'
                  : isLiveBattle
                    ? 'border border-rose-300 bg-[linear-gradient(135deg,rgba(255,241,242,0.96)_0%,rgba(254,205,211,0.92)_45%,rgba(255,255,255,0.98)_100%)] shadow-[0_14px_28px_rgba(244,63,94,0.14)]'
                    : 'border border-slate-200/80 bg-white/95 shadow-[0_6px_16px_rgba(15,23,42,0.04)]'

                return (
                  <div
                    key={comment.id}
                    id={`comment-row-${comment.id}`}
                    className={`rounded-[18px] transition-all duration-500 ${sideToneClass} ${
                      highlightCommentId === comment.id
                        ? 'ring-2 ring-[#4f7cff]/35 shadow-[0_0_0_1px_rgba(79,124,255,0.10),0_18px_34px_rgba(79,124,255,0.18)]'
                        : isLastSubmitted
                          ? 'ring-1 ring-[#4f7cff]/20 shadow-[0_0_0_1px_rgba(79,124,255,0.06),0_12px_28px_rgba(79,124,255,0.10)]'
                          : ''
                    }`}
                  >
                    <div className="px-1.5 py-1.5">
                      <div className="mb-1.5 flex items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-1">
                          {isBestComment ? (
                            <span className="rounded-full border border-amber-300 bg-[linear-gradient(135deg,#fff8dc_0%,#fde68a_100%)] px-2 py-0.5 text-[10px] font-black text-amber-900 shadow-[0_8px_16px_rgba(245,158,11,0.18)]">
                              🏆 최고의 댓글
                            </span>
                          ) : null}

                          {isLiveBattle ? (
                            <span className="rounded-full border border-rose-300 bg-[linear-gradient(135deg,#fff1f2_0%,#fda4af_100%)] px-2 py-0.5 text-[10px] font-black text-rose-900 shadow-[0_8px_16px_rgba(244,63,94,0.16)]">
                              🔥 지금 싸우는 중
                            </span>
                          ) : null}

                          {isLastSubmitted ? (
                            <span className="rounded-full border border-[#cfe0ff] bg-[#eef4ff] px-2 py-0.5 text-[10px] font-black text-[#4f7cff]">
                              방금 작성한 댓글
                            </span>
                          ) : null}

                          {item.isMinority ? (
                            <span className="rounded-full border border-fuchsia-200 bg-fuchsia-50 px-2 py-0.5 text-[10px] font-bold text-fuchsia-700">
                              😳 소수 의견
                            </span>
                          ) : null}
                        </div>
                      </div>

                      {isLiveBattle || isLastSubmitted ? (
                        <div
                          className={`mb-1 rounded-[14px] px-2 py-1 text-[11px] font-semibold ${
                            isLiveBattle
                              ? 'bg-rose-50 text-rose-700'
                              : 'bg-[#eef4ff] text-[#4f7cff]'
                          }`}
                        >
                          {isLastSubmitted
                            ? '내가 방금 쓴 댓글 · 지금 바로 반응 붙는지 보기 좋음'
                            : liveBattleHelperText}
                        </div>
                      ) : null}

                      <CommentCard
                        comment={comment}
                        leftLabel={post.leftLabel}
                        rightLabel={post.rightLabel}
                        onOpenReportComment={onOpenReportComment}
                        adminMode={adminMode}
                        onAdminRestoreComment={onAdminRestoreComment}
                        onAdminDeleteComment={onAdminDeleteComment}
                        authorMeta={resolveAuthorMeta(
                          {
                            author: comment.author,
                            authorKey: comment.authorKey ?? null,
                          },
                          authorMetaMap,
                          guestName,
                          currentUserLevel,
                          featuredBadge,
                          currentActorKey,
                        )}
                        reactionSummary={item.reactionSummary}
                        myReactionMap={{
                          agree: !!myCommentReactions[`${comment.id}:agree`],
                          disagree:
                            !!myCommentReactions[`${comment.id}:disagree`],
                          wow: !!myCommentReactions[`${comment.id}:wow`],
                          relatable:
                            !!myCommentReactions[`${comment.id}:relatable`],
                          absurd: !!myCommentReactions[`${comment.id}:absurd`],
                        }}
                        onReactComment={(commentId, reactionType) =>
                          void handleCommentReaction(
                            commentId,
                            reactionType,
                            comment.side,
                            comment.author,
                          )
                        }
                        pulseReactionType={
                          reactionPulseKey === `${comment.id}:relatable`
                            ? 'relatable'
                            : reactionPulseKey === `${comment.id}:disagree`
                              ? 'disagree'
                              : null
                        }
                        liveBattleFocus={
                          recentBattleCommentId === comment.id ||
                          (isLiveBattle && item.battleScore >= 2)
                        }
                      />
                    </div>
                  </div>
                )
              })}

              {hasMoreComments ? (
                <button
                  onClick={() => setVisibleCount((prev) => prev + 12)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 shadow-[0_6px_16px_rgba(15,23,42,0.04)]"
                >
                  댓글 더 보기
                </button>
              ) : null}
            </div>
          )}
        </div>

        <div className="shrink-0 border-t border-white/60 bg-[linear-gradient(180deg,rgba(255,255,255,0.62)_0%,rgba(246,249,255,0.9)_100%)] px-3 pb-[calc(env(safe-area-inset-bottom)+10px)] pt-2 shadow-[0_-10px_30px_rgba(15,23,42,0.05)] backdrop-blur-xl">
          <div className="mx-auto max-w-md rounded-[22px] border border-white/90 bg-[linear-gradient(180deg,rgba(255,255,255,0.94)_0%,rgba(247,250,255,0.92)_100%)] p-1.5 shadow-[0_12px_26px_rgba(15,23,42,0.09)] backdrop-blur-2xl">
            <div className="mb-1 text-[10px] font-semibold text-slate-400">
              반박 버튼 수는 바로 반영되고 내 활동에도 새 반박으로 잡힘
            </div>
            <div className="mb-2 grid grid-cols-2 gap-1 rounded-[22px] border border-slate-200/80 bg-[linear-gradient(180deg,#f8faff_0%,#eef3ff_100%)] p-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.92)]">
              <button
                onClick={() => setCommentSide('left')}
                className={`h-9 rounded-[14px] px-3 text-[13px] font-black tracking-[-0.01em] transition ${
                  commentSide === 'left'
                    ? 'border border-blue-200/90 bg-[linear-gradient(135deg,#ffffff_0%,#eff6ff_100%)] text-blue-700 shadow-[0_10px_22px_rgba(59,130,246,0.14)]'
                    : 'border border-transparent bg-transparent text-slate-500'
                }`}
              >
                {post.leftLabel}
              </button>
              <button
                onClick={() => setCommentSide('right')}
                className={`h-9 rounded-[14px] px-3 text-[13px] font-black tracking-[-0.01em] transition ${
                  commentSide === 'right'
                    ? 'border border-violet-200/90 bg-[linear-gradient(135deg,#ffffff_0%,#f5f3ff_100%)] text-violet-700 shadow-[0_10px_22px_rgba(124,58,237,0.14)]'
                    : 'border border-transparent bg-transparent text-slate-500'
                }`}
              >
                {post.rightLabel}
              </button>
            </div>

            <div className="flex items-center gap-1.5 rounded-[18px] border border-slate-200/80 bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] px-1.5 py-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.92)]">
              <div className="relative flex-1 overflow-hidden rounded-[14px] border border-slate-200/70 bg-white/95 shadow-[inset_0_1px_0_rgba(255,255,255,0.96)]">
                <textarea
                  ref={inputRef}
                  rows={1}
                  readOnly={suppressAutoKeyboard}
                  value={text}
                  onTouchStart={unlockCommentInput}
                  onPointerDown={unlockCommentInput}
                  onFocus={() => {
                    if (suppressAutoKeyboard) {
                      unlockCommentInput()
                    }
                  }}
                  onChange={(event) =>
                    setText(event.target.value.slice(0, LIMITS.comment))
                  }
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && !event.shiftKey) {
                      event.preventDefault()
                      void submitComment()
                      return
                    }
                  }}
                  placeholder={'너의 의견은?'}
                  style={{ fontSize: 16, lineHeight: '20px' }}
                  className="h-[38px] w-full resize-none bg-transparent pl-3 pr-12 pt-[8px] text-base leading-5 text-slate-900 outline-none placeholder:text-slate-400 [text-size-adjust:100%] [-webkit-text-size-adjust:100%]"
                />
                <span
                  className={`pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-semibold ${getCounterTone(text.length, LIMITS.comment)}`}
                >
                  {text.length}/{LIMITS.comment}
                </span>
              </div>
              <button
                onClick={() => void submitComment()}
                aria-label="댓글 전송"
                aria-disabled={!text.trim() || isSubmitting}
                className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition active:scale-[0.98] ${text.trim() && !isSubmitting ? 'bg-slate-950 text-white shadow-[0_12px_24px_rgba(15,23,42,0.22)]' : 'border border-slate-200/80 bg-[linear-gradient(180deg,#ffffff_0%,#f3f6fb_100%)] text-slate-400 shadow-[inset_0_1px_0_rgba(255,255,255,0.96)]'}`}
              >
                <Send className="h-[17px] w-[17px]" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function CreatePostModal({
  open,
  onClose,
  onCreate,
  guestName,
  featuredBadge,
}: {
  open: boolean
  onClose: () => void
  onCreate: (input: {
    category: string
    ageGroup: string
    title: string
    content: string
    leftLabel: string
    rightLabel: string
  }) => void
  guestName: string
  featuredBadge?: string | null
}) {
  const [category, setCategory] = useState('연애')
  const [ageGroup, setAgeGroup] = useState('20대')
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [leftLabel, setLeftLabel] = useState('')
  const [rightLabel, setRightLabel] = useState('')

  if (!open) return null

  const submit = () => {
    const trimmedTitle = title.trim()
    const trimmedContent = content.trim()
    const trimmedLeft = leftLabel.trim()
    const trimmedRight = rightLabel.trim()

    if (!trimmedTitle || !trimmedContent || !trimmedLeft || !trimmedRight)
      return

    onCreate({
      category,
      ageGroup,
      title: trimmedTitle,
      content: trimmedContent,
      leftLabel: trimmedLeft,
      rightLabel: trimmedRight,
    })

    setCategory('연애')
    setAgeGroup('20대')
    setTitle('')
    setContent('')
    setLeftLabel('')
    setRightLabel('')
  }

  return (
    <div className="fixed inset-0 z-40 overflow-hidden bg-slate-900/30 backdrop-blur-md">
      <div className="mx-auto flex h-[100svh] w-full min-h-0 max-w-md flex-col overflow-hidden bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] pb-[env(safe-area-inset-bottom)] text-slate-900">
        <div className="shrink-0 flex items-center justify-between border-b border-slate-200/80 px-5 py-4">
          <div>
            <div className="text-lg font-bold">맞냐 글쓰기</div>
            <div className="mt-1 text-xs text-slate-500">
              현재 작성자: {guestName}
            </div>
            {featuredBadge
              ? (() => {
                  const badgeTheme = getBadgeTheme(featuredBadge)
                  return (
                    <div
                      className={`mt-2 inline-flex rounded-full border px-3 py-1 text-[11px] font-bold ${badgeTheme.pillClass}`}
                    >
                      {badgeTheme.icon} 대표 뱃지: {featuredBadge}
                    </div>
                  )
                })()
              : null}
          </div>
          <button
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white shadow-[0_6px_18px_rgba(15,23,42,0.05)]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3.5 space-y-3.5 [webkit-overflow-scrolling:touch]">
          <div className="rounded-[24px] border border-slate-200/80 bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] px-4 py-3 shadow-[0_8px_22px_rgba(15,23,42,0.05)] text-sm text-slate-600">
            로그인 없이 바로 글 작성 가능. 로그인은 내 활동 저장용.
          </div>

          <div className="grid grid-cols-2 gap-3">
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="rounded-2xl border border-slate-200/80 bg-white px-4 py-3 shadow-[0_2px_10px_rgba(15,23,42,0.03)] text-slate-900 outline-none"
            >
              {categories.map((item) => (
                <option key={item} value={item} className="text-slate-900">
                  {item}
                </option>
              ))}
            </select>
            <select
              value={ageGroup}
              onChange={(e) => setAgeGroup(e.target.value)}
              className="rounded-2xl border border-slate-200/80 bg-white px-4 py-3 shadow-[0_2px_10px_rgba(15,23,42,0.03)] text-slate-900 outline-none"
            >
              {ageGroups.map((item) => (
                <option key={item} value={item} className="text-slate-900">
                  {item}
                </option>
              ))}
            </select>
          </div>

          <div>
            <input
              value={title}
              maxLength={LIMITS.title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="제목"
              className="w-full rounded-2xl border border-slate-200/80 bg-white px-4 py-3 shadow-[0_2px_10px_rgba(15,23,42,0.03)] text-slate-900 outline-none placeholder:text-slate-400"
            />
            <div
              className={`mt-1 text-right text-xs ${getCounterTone(
                title.length,
                LIMITS.title,
                0.56,
                0.84,
              )}`}
            >
              {title.length}/{LIMITS.title}
            </div>
          </div>

          <div>
            <textarea
              value={content}
              maxLength={LIMITS.content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="상황 설명"
              rows={6}
              className="w-full rounded-2xl border border-slate-200/80 bg-white px-4 py-3 shadow-[0_2px_10px_rgba(15,23,42,0.03)] text-slate-900 outline-none placeholder:text-slate-400"
            />
            <div
              className={`mt-1 flex items-center justify-between text-xs ${getCounterTone(
                content.length,
                LIMITS.content,
                0.64,
                0.82,
              )}`}
            >
              <span>짧을수록 판단이 잘 갈림</span>
              <span>
                {content.length}/{LIMITS.content}
              </span>
            </div>
          </div>

          <div>
            <input
              value={leftLabel}
              maxLength={LIMITS.option}
              onChange={(e) => setLeftLabel(e.target.value)}
              placeholder="왼쪽 선택지"
              className="w-full rounded-2xl border border-slate-200/80 bg-white px-4 py-3 shadow-[0_2px_10px_rgba(15,23,42,0.03)] text-slate-900 outline-none placeholder:text-slate-400"
            />
            <div
              className={`mt-1 text-right text-xs ${getCounterTone(
                leftLabel.length,
                LIMITS.option,
                0.75,
                0.92,
              )}`}
            >
              {leftLabel.length}/{LIMITS.option}
            </div>
          </div>

          <div>
            <input
              value={rightLabel}
              maxLength={LIMITS.option}
              onChange={(e) => setRightLabel(e.target.value)}
              placeholder="오른쪽 선택지"
              className="w-full rounded-2xl border border-slate-200/80 bg-white px-4 py-3 shadow-[0_2px_10px_rgba(15,23,42,0.03)] text-slate-900 outline-none placeholder:text-slate-400"
            />
            <div
              className={`mt-1 text-right text-xs ${getCounterTone(
                rightLabel.length,
                LIMITS.option,
                0.75,
                0.92,
              )}`}
            >
              {rightLabel.length}/{LIMITS.option}
            </div>
          </div>
        </div>

        <div className="shrink-0 border-t border-slate-200 px-5 py-4">
          <button
            onClick={submit}
            className="w-full rounded-2xl bg-slate-950 px-4 py-4 font-bold text-white shadow-[0_16px_28px_rgba(15,23,42,0.24)]"
          >
            글쓰기
          </button>
        </div>
      </div>
    </div>
  )
}

function ShareInboxModal({
  open,
  onClose,
  items,
  loading,
  onOpenItem,
  onReshare,
}: {
  open: boolean
  onClose: () => void
  items: ShareInboxItem[]
  loading: boolean
  onOpenItem: (item: ShareInboxItem) => void
  onReshare: (item: ShareInboxItem) => void
}) {
  const [filter, setFilter] = useState<'new' | 'ready' | 'all'>('all')

  useEffect(() => {
    if (!open) return
    setFilter((prev) => {
      if (prev === 'new' || prev === 'ready' || prev === 'all') return prev
      if (items.some((item) => item.unreadCount > 0)) return 'new'
      if (items.some((item) => item.totalCount > 0)) return 'ready'
      return 'all'
    })
  }, [open])

  if (!open) return null

  const hottestItem =
    items.slice().sort((a, b) => b.totalCount - a.totalCount)[0] ?? null
  const mostDivisiveItem =
    items.slice().sort((a, b) => {
      const aTotal = a.leftCount + a.rightCount
      const bTotal = b.leftCount + b.rightCount
      const aScore =
        aTotal === 0 ? 999 : Math.abs(a.leftCount - a.rightCount) / aTotal
      const bScore =
        bTotal === 0 ? 999 : Math.abs(b.leftCount - b.rightCount) / bTotal
      return aScore - bScore || bTotal - aTotal
    })[0] ?? null
  const readyCount = items.filter((item) => item.totalCount > 0).length
  const totalUnread = items.reduce((sum, item) => sum + item.unreadCount, 0)
  const filteredItems = items.filter((item) => {
    if (filter === 'new') return item.unreadCount > 0
    if (filter === 'ready') return item.totalCount > 0
    return true
  })
  const filterDescription =
    filter === 'new'
      ? '새 응답 온 판만 모아보는 중'
      : filter === 'ready'
        ? '지금 결과 볼 만한 판만 모아보는 중'
        : '내가 보낸 공유 전체를 보는 중'

  return (
    <div className="fixed inset-0 z-40 overflow-hidden bg-slate-900/30 backdrop-blur-md">
      <div className="mx-auto flex h-[100svh] w-full min-h-0 max-w-md flex-col overflow-hidden bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] pb-[env(safe-area-inset-bottom)] text-slate-900">
        <div className="shrink-0 border-b border-slate-200/80 px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[11px] font-extrabold tracking-[0.2em] text-[#4f7cff]">
                SHARE INBOX
              </div>
              <div className="mt-1 text-[22px] font-black tracking-[-0.02em] text-slate-950">
                보낸 공유함
              </div>
              <div className="mt-1 text-sm text-slate-500">
                로그인 없이도 내가 친구에게 던진 논쟁을 다시 모아봄
              </div>
            </div>
            <button
              onClick={onClose}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white shadow-[0_6px_18px_rgba(15,23,42,0.05)]"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="shrink-0 border-b border-slate-200/70 px-5 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setFilter('new')}
              className={`inline-flex rounded-full border px-3 py-1 text-[12px] font-bold transition ${
                filter === 'new'
                  ? 'border-[#bfd2ff] bg-[#4f7cff] text-white shadow-[0_10px_18px_rgba(79,124,255,0.18)]'
                  : 'border-[#dbe7ff] bg-[#f4f8ff] text-[#4f7cff]'
              }`}
            >
              새 응답 {totalUnread}
            </button>
            <button
              onClick={() => setFilter('ready')}
              className={`inline-flex rounded-full border px-3 py-1 text-[12px] font-bold transition ${
                filter === 'ready'
                  ? 'border-[#bfd2ff] bg-[#4f7cff] text-white shadow-[0_10px_18px_rgba(79,124,255,0.18)]'
                  : 'border-slate-200 bg-white text-slate-700'
              }`}
            >
              결과 볼 수 있음 {readyCount}
            </button>
            <button
              onClick={() => setFilter('all')}
              className={`inline-flex rounded-full border px-3 py-1 text-[12px] font-bold transition ${
                filter === 'all'
                  ? 'border-[#bfd2ff] bg-[#4f7cff] text-white shadow-[0_10px_18px_rgba(79,124,255,0.18)]'
                  : 'border-slate-200 bg-white text-slate-700'
              }`}
            >
              보낸 공유 {items.length}
            </button>
          </div>
          <div className="mt-2 text-[12px] font-semibold text-slate-500">
            {filterDescription}
          </div>
          {hottestItem ||
          (mostDivisiveItem && mostDivisiveItem.totalCount > 0) ? (
            <div className="mt-2 flex flex-wrap items-center gap-2 text-[12px] text-slate-500">
              {hottestItem ? (
                <button
                  onClick={() => onOpenItem(hottestItem)}
                  className="inline-flex max-w-full items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 font-semibold text-amber-700"
                >
                  <span>🔥 핫한 판</span>
                  <span className="max-w-[140px] truncate">
                    {hottestItem.title}
                  </span>
                </button>
              ) : null}
              {mostDivisiveItem && mostDivisiveItem.totalCount > 0 ? (
                <button
                  onClick={() => onOpenItem(mostDivisiveItem)}
                  className="inline-flex max-w-full items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-3 py-1 font-semibold text-rose-700"
                >
                  <span>⚡ 가장 갈리는 판</span>
                  <span className="max-w-[140px] truncate">
                    {mostDivisiveItem.title}
                  </span>
                </button>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pt-4 pb-[104px] space-y-3.5 [webkit-overflow-scrolling:touch]">
          {loading ? (
            <div className="rounded-[24px] border border-slate-200/80 bg-white px-4 py-5 text-sm text-slate-500 shadow-[0_10px_24px_rgba(15,23,42,0.05)]">
              보낸 공유함 불러오는 중...
            </div>
          ) : null}

          {!loading && items.length === 0 ? (
            <div className="rounded-[24px] border border-dashed border-slate-300 bg-white/90 px-4 py-6 text-center shadow-[0_10px_24px_rgba(15,23,42,0.05)]">
              <div className="text-base font-bold text-slate-900">
                아직 보낸 공유가 없음
              </div>
              <div className="mt-2 text-sm leading-6 text-slate-500">
                글에서 먼저 선택하고 친구한테 보내기를 누르면 여기에 차곡차곡
                쌓임
              </div>
            </div>
          ) : null}

          {!loading && items.length > 0 && filteredItems.length === 0 ? (
            <div className="rounded-[24px] border border-dashed border-slate-300 bg-white/90 px-4 py-6 text-center shadow-[0_10px_24px_rgba(15,23,42,0.05)]">
              <div className="text-base font-bold text-slate-900">
                {filter === 'new'
                  ? '새 응답 온 공유가 아직 없음'
                  : filter === 'ready'
                    ? '아직 결과 볼 만큼 열린 판이 없음'
                    : '보낸 공유가 아직 없음'}
              </div>
              <div className="mt-2 text-sm leading-6 text-slate-500">
                {filter === 'new'
                  ? '친구 반응이 도착하면 여기서 바로 확인 가능'
                  : filter === 'ready'
                    ? '친구 반응이 1개 이상 쌓이면 여기에 나타남'
                    : '다른 글에서 친구에게 보내기를 누르면 여기에 쌓임'}
              </div>
            </div>
          ) : null}

          {!loading &&
            filteredItems.map((item) => {
              const tensionMeta = getShareTensionMeta(
                item.leftCount,
                item.rightCount,
              )
              const leadLabel =
                item.leftCount === item.rightCount
                  ? '의견 팽팽'
                  : item.leftCount > item.rightCount
                    ? `${item.leftLabel ?? '왼쪽'} 우세`
                    : `${item.rightLabel ?? '오른쪽'} 우세`
              const percentPair = getPercentPair(
                item.leftCount,
                item.rightCount,
              )
              const actionText = getShareNextActionText(
                item.totalCount,
                item.unreadCount,
              )
              const ownerInsight = getOwnerChoiceInsight(
                item.ownerChoice,
                item.leftCount,
                item.rightCount,
                item.leftLabel,
                item.rightLabel,
              )

              return (
                <div
                  key={item.sessionId}
                  className="overflow-hidden rounded-[28px] border border-white/90 bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] shadow-[0_16px_30px_rgba(15,23,42,0.06)]"
                >
                  <div
                    className={`h-1.5 w-full ${item.unreadCount > 0 ? 'bg-[linear-gradient(90deg,#22c55e_0%,#4ade80_100%)]' : 'bg-[linear-gradient(90deg,#c7d2fe_0%,#93c5fd_100%)]'}`}
                  />
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full border border-[#dbe7ff] bg-[#eef3ff] px-2.5 py-1 text-[11px] font-bold text-[#4f7cff]">
                            {item.totalCount === 0
                              ? '응답 대기중'
                              : `${item.totalCount}명 반응`}
                          </span>
                          {item.unreadCount > 0 ? (
                            <span className="rounded-full border border-rose-100 bg-emerald-50 px-2.5 py-1 text-[11px] font-black text-emerald-600">
                              새 응답 +{item.unreadCount}
                            </span>
                          ) : null}
                        </div>
                        <div className="mt-2 line-clamp-2 text-[17px] leading-[1.35] font-black tracking-[-0.02em] text-slate-900">
                          {item.title}
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-[12px] text-slate-500">
                          <span>
                            {item.createdAt
                              ? new Date(item.createdAt).toLocaleString('ko-KR')
                              : '방금 공유'}
                          </span>
                          <span>·</span>
                          <span>{leadLabel}</span>
                          <span
                            className={`rounded-full border px-2 py-0.5 text-[10px] font-extrabold ${tensionMeta.toneClass}`}
                          >
                            {tensionMeta.label}
                          </span>
                        </div>
                        <div className="mt-2 text-[12px] leading-5 text-slate-600">
                          {actionText}
                        </div>
                      </div>
                      <div className="shrink-0 rounded-2xl border border-slate-200/80 bg-white px-3 py-2 text-right shadow-[0_8px_18px_rgba(15,23,42,0.05)]">
                        <div className="text-[11px] text-slate-400">
                          친구 반응
                        </div>
                        <div className="mt-1 text-lg font-black text-slate-900">
                          {item.totalCount}
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 rounded-2xl border border-slate-200/80 bg-white px-3 py-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-[11px] font-extrabold tracking-[0.14em] text-slate-400">
                          전체 결과
                        </div>
                        <div className="text-[11px] font-bold text-slate-500">
                          {item.overallTotalCount}명 참여
                        </div>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 px-3 py-3 text-center">
                          <div className="text-[11px] text-slate-400">
                            {item.leftLabel ?? '왼쪽'}
                          </div>
                          <div className="mt-1 text-base font-black text-slate-900">
                            {item.overallLeftCount}명
                          </div>
                          <div className="mt-1 text-[11px] font-bold text-slate-500">
                            {
                              getPercentPair(
                                item.overallLeftCount,
                                item.overallRightCount,
                              ).left
                            }
                            %
                          </div>
                          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
                            <div
                              className="h-full rounded-full bg-[#4f7cff] transition-all duration-500"
                              style={{
                                width: `${Math.max(getPercentPair(item.overallLeftCount, item.overallRightCount).left, item.overallTotalCount === 0 ? 0 : 8)}%`,
                              }}
                            />
                          </div>
                        </div>
                        <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 px-3 py-3 text-center">
                          <div className="text-[11px] text-slate-400">
                            {item.rightLabel ?? '오른쪽'}
                          </div>
                          <div className="mt-1 text-base font-black text-slate-900">
                            {item.overallRightCount}명
                          </div>
                          <div className="mt-1 text-[11px] font-bold text-slate-500">
                            {
                              getPercentPair(
                                item.overallLeftCount,
                                item.overallRightCount,
                              ).right
                            }
                            %
                          </div>
                          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
                            <div
                              className="h-full rounded-full bg-[#facc15] transition-all duration-500"
                              style={{
                                width: `${Math.max(getPercentPair(item.overallLeftCount, item.overallRightCount).right, item.overallTotalCount === 0 ? 0 : 8)}%`,
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 rounded-2xl border border-slate-200/80 bg-white px-3 py-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-[11px] font-extrabold tracking-[0.14em] text-slate-400">
                          친구 결과
                        </div>
                        <div
                          className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-extrabold ${tensionMeta.toneClass}`}
                        >
                          {tensionMeta.label}
                        </div>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 px-3 py-3 text-center">
                          <div className="text-[11px] text-slate-400">
                            {item.leftLabel ?? '왼쪽'}
                          </div>
                          <div className="mt-1 text-base font-black text-slate-900">
                            {item.leftCount}명
                          </div>
                          <div className="mt-1 text-[11px] font-bold text-slate-500">
                            {percentPair.left}%
                          </div>
                          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
                            <div
                              className="h-full rounded-full bg-[#4f7cff] transition-all duration-500"
                              style={{
                                width: `${Math.max(percentPair.left, item.totalCount === 0 ? 0 : 8)}%`,
                              }}
                            />
                          </div>
                        </div>
                        <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 px-3 py-3 text-center">
                          <div className="text-[11px] text-slate-400">
                            {item.rightLabel ?? '오른쪽'}
                          </div>
                          <div className="mt-1 text-base font-black text-slate-900">
                            {item.rightCount}명
                          </div>
                          <div className="mt-1 text-[11px] font-bold text-slate-500">
                            {percentPair.right}%
                          </div>
                          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
                            <div
                              className="h-full rounded-full bg-[#facc15] transition-all duration-500"
                              style={{
                                width: `${Math.max(percentPair.right, item.totalCount === 0 ? 0 : 8)}%`,
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <div className="rounded-2xl border border-slate-200/80 bg-white px-3 py-3">
                        <div className="text-[11px] text-slate-400">
                          내 선택
                        </div>
                        <div className="mt-1 text-sm font-black text-slate-900">
                          {ownerInsight.ownerLabel}
                        </div>
                        <div
                          className={`mt-2 inline-flex rounded-full border px-2 py-0.5 text-[10px] font-extrabold ${ownerInsight.relationTone}`}
                        >
                          {ownerInsight.relationLabel}
                        </div>
                      </div>
                      <div className="rounded-2xl border border-slate-200/80 bg-white px-3 py-3">
                        <div className="text-[11px] text-slate-400">
                          전체 흐름
                        </div>
                        <div className="mt-1 text-sm font-black text-slate-900">
                          {item.overallLeftCount === item.overallRightCount
                            ? '전체 의견 팽팽'
                            : item.overallLeftCount > item.overallRightCount
                              ? `${item.leftLabel ?? '왼쪽'} 우세`
                              : `${item.rightLabel ?? '오른쪽'} 우세`}
                        </div>
                        <div
                          className={`mt-2 inline-flex rounded-full border px-2 py-0.5 text-[10px] font-extrabold ${getShareTensionMeta(item.overallLeftCount, item.overallRightCount).toneClass}`}
                        >
                          {
                            getShareTensionMeta(
                              item.overallLeftCount,
                              item.overallRightCount,
                            ).label
                          }
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 rounded-2xl border border-slate-200/80 bg-white/90 px-3 py-3 text-[12px] leading-5 text-slate-600">
                      익명 전체 흐름 먼저 보고, 그 아래 친구들 반응까지 같이
                      보면 더 재밌음 · {ownerInsight.helper}
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <button
                        onClick={() => onOpenItem(item)}
                        className="rounded-[18px] bg-slate-950 text-white px-4 py-3 text-sm font-black text-slate-900 shadow-[0_12px_22px_rgba(79,124,255,0.16)]"
                      >
                        결과 보기
                      </button>
                      <button
                        onClick={() => onReshare(item)}
                        className="rounded-[18px] bg-[linear-gradient(135deg,#fde047_0%,#facc15_100%)] px-4 py-3 text-sm font-black text-slate-900 shadow-[0_12px_22px_rgba(250,204,21,0.22)]"
                      >
                        친구 더 보내기
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}

          <div className="h-10 shrink-0" aria-hidden="true" />
        </div>
      </div>
    </div>
  )
}

export default function MatnyaApp() {
  const [posts, setPosts] = useState<PostItem[]>([])
  const postsRef = useRef<PostItem[]>([])
  const currentPostCardRef = useRef<HTMLDivElement | null>(null)
  const postFocusPulseTimerRef = useRef<number | null>(null)
  const pendingPostFocusRef = useRef(false)
  const kakaoTransitionLockRef = useRef(false)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [postFocusPulse, setPostFocusPulse] = useState(false)
  const [tab, setTab] = useState<'추천' | '인기' | '최신'>('추천')
  const [selectedCategory, setSelectedCategory] = useState<string>('전체')
  const [newPostNoticeIds, setNewPostNoticeIds] = useState<number[]>([])
  const latestSeenPostIdRef = useRef<number | null>(null)
  const [votes, setVotes] = useState<Record<number, VoteSide>>({})
  const [reportedPosts, setReportedPosts] = useState<Record<number, boolean>>(
    {},
  )
  const [reportedComments, setReportedComments] = useState<
    Record<number, boolean>
  >({})
  const [voterKey, setVoterKey] = useState('')

  const [authUser, setAuthUser] = useState<any>(null)
  const [profile, setProfile] = useState<ProfileRow | null>(null)
  const [authOpen, setAuthOpen] = useState(false)
  const [guestName, setGuestName] = useState('익명000')

  const [myPosts, setMyPosts] = useState<MyPostItem[]>([])
  const [myComments, setMyComments] = useState<MyCommentItem[]>([])
  const [stats, setStats] = useState<UserStatsRow>(
    normalizeStats({
      points: 0,
      level: 1,
      votes_count: 0,
      comments_count: 0,
      posts_count: 0,
      likes_received: 0,
    }),
  )
  const [badges, setBadges] = useState<string[]>([])
  const [authorMetaMap, setAuthorMetaMap] = useState<
    Record<string, AuthorMeta>
  >({})
  const [shareId, setShareId] = useState<string | null>(null)
  const [shareStats, setShareStats] = useState({ left: 0, right: 0 })
  const [shareOwnerKey, setShareOwnerKey] = useState<string | null>(null)
  const [sharedPostId, setSharedPostId] = useState<number | null>(null)
  const [sharedEntryActive, setSharedEntryActive] = useState(false)
  const [showOwnerShareResults, setShowOwnerShareResults] = useState(false)
  const [sharePulse, setSharePulse] = useState(false)
  const [ownerShareDelta, setOwnerShareDelta] = useState(0)
  const [shareInboxOpen, setShareInboxOpen] = useState(false)
  const [shareInboxLoading, setShareInboxLoading] = useState(false)
  const [shareInboxItems, setShareInboxItems] = useState<ShareInboxItem[]>([])
  const [shareInboxUnreadCount, setShareInboxUnreadCount] = useState(0)
  const [commentReactionMap, setCommentReactionMap] = useState<
    Record<number, CommentReactionSummary>
  >({})
  const [myCommentReactions, setMyCommentReactions] = useState<
    Record<string, boolean>
  >({})
  const [postReactionSummaryMap, setPostReactionSummaryMap] = useState<
    Record<number, PostReactionSummary>
  >({})
  const [myPostReactions, setMyPostReactions] = useState<
    Record<string, boolean>
  >({})
  const [postOutcomeMap, setPostOutcomeMap] = useState<
    Record<number, PostOutcomeItem[]>
  >({})
  const [streakMap, setStreakMap] = useState<Record<string, UserStreakRow>>({})
  const [nextQueueMap, setNextQueueMap] = useState<
    Record<number, NextQueueItem[]>
  >({})
  const [watchlistItems, setWatchlistItems] = useState<WatchlistItem[]>([])
  const [myWatchlistMap, setMyWatchlistMap] = useState<Record<number, boolean>>(
    {},
  )
  const [watchOutcomeSeenMap, setWatchOutcomeSeenMap] = useState<
    Record<number, string | null>
  >({})
  const [resultUnlockMap, setResultUnlockMap] = useState<
    Record<number, ResultUnlockItem>
  >({})
  const sharePulseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastShareTotalRef = useRef<number>(0)
  const [revisitMeta, setRevisitMeta] = useState<RevisitMeta | null>(null)
  const [justCreatedPostId, setJustCreatedPostId] = useState<number | null>(
    null,
  )
  const isKakaoSafeMode = useMemo(() => isKakaoInAppBrowser(), [])
  const [hotScoreMap, setHotScoreMap] = useState<Record<number, HotMeta>>({})
  const [turningPointMap, setTurningPointMap] = useState<
    Record<number, TurningPointMeta>
  >({})
  const [postFlipMap, setPostFlipMap] = useState<
    Record<number, PostFlipEventItem>
  >({})
  const [shadowWatchMap, setShadowWatchMap] = useState<
    Record<number, ShadowWatchItem>
  >({})
  const [choicePathTopMap, setChoicePathTopMap] = useState<
    Record<string, ChoicePathTopItem>
  >({})
  const [postTensionMap, setPostTensionMap] = useState<
    Record<number, PostTensionState>
  >({})
  const [hotNowPosts, setHotNowPosts] = useState<PostItem[]>([])
  const [isVoting, setIsVoting] = useState(false)
  const voteLockRef = useRef(false)
  const discoveryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const metaRefreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const metaRefreshInFlightRef = useRef(false)
  const metaRefreshQueuedRef = useRef(false)
  const lastMetaRefreshAtRef = useRef(0)
  const shadowViewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const authHydrationInFlightRef = useRef(false)
  const lastAuthUserIdRef = useRef<string | null>(null)
  const resultUnlockInFlightRef = useRef<Record<number, boolean>>({})
  const resultUnlockQueuedPatchRef = useRef<Record<number, ResultUnlockPatch>>(
    {},
  )
  const autoUnlockSignatureRef = useRef<Record<string, string>>({})
  const postReactionInFlightRef = useRef<Record<string, boolean>>({})
  const commentReactionInFlightRef = useRef<Record<string, boolean>>({})
  const guestMergeDoneRef = useRef(false)
  const lastGuestMergeSignatureRef = useRef<string | null>(null)

  useEffect(() => {
    postsRef.current = posts
  }, [posts])

  useEffect(() => {
    return () => {
      if (shadowViewTimerRef.current) {
        clearTimeout(shadowViewTimerRef.current)
      }
    }
  }, [])

  const featuredBadge = badges[0] ?? null
  const currentActorKey = authUser?.id ?? voterKey ?? null
  const currentActorUnifiedKey = getActorUnifiedKey(
    authUser?.id ?? null,
    voterKey,
  )
  const currentRawActorKey = getRawActorKey(authUser?.id ?? null, voterKey)

  const [deletedPosts, setDeletedPosts] = useState<PostItem[]>([])
  const [deletedComments, setDeletedComments] = useState<DeletedCommentItem[]>(
    [],
  )
  const [deletedOpen, setDeletedOpen] = useState(false)

  const [toast, setToast] = useState('')
  const [commentOpen, setCommentOpen] = useState(false)
  const [commentInitialHighlightId, setCommentInitialHighlightId] = useState<
    number | null
  >(null)
  const [writeOpen, setWriteOpen] = useState(false)
  const [activityOpen, setActivityOpen] = useState(false)
  const [activityInitialTab, setActivityInitialTab] = useState<
    'posts' | 'comments' | 'watchlist'
  >('posts')
  const [outcomeModalOpen, setOutcomeModalOpen] = useState(false)
  const [adminMode, setAdminMode] = useState(false)
  const [loading, setLoading] = useState(true)

  const [reportModal, setReportModal] = useState<{
    open: boolean
    type: 'post' | 'comment' | null
    id: number | null
    label: string
  }>({
    open: false,
    type: null,
    id: null,
    label: '',
  })
  const [inquiryOpen, setInquiryOpen] = useState(false)
  const [inquiryModalKey, setInquiryModalKey] = useState(0)
  const [inquiryAdminOpen, setInquiryAdminOpen] = useState(false)
  const [inquiryAdminItems, setInquiryAdminItems] = useState<InquiryRow[]>([])
  const [inquiryAdminLoading, setInquiryAdminLoading] = useState(false)

  const isAdmin = profile?.role === 'admin'

  const openInquiryCenter = useCallback(() => {
    setInquiryModalKey((prev) => prev + 1)
    setInquiryOpen(true)
  }, [])

  const showToast = useCallback((msg: string) => {
    setToast(msg)
    const timer = setTimeout(() => setToast(''), 1400)
    return () => clearTimeout(timer)
  }, [])

  const submitInquiry = useCallback(
    async (input: {
      inquiryType: InquiryType
      title: string
      content: string
      contact: string
    }) => {
      const pageUrl =
        typeof window !== 'undefined' ? window.location.href : null
      const userAgent =
        typeof navigator !== 'undefined' ? navigator.userAgent : null
      const actorKey =
        getActorUnifiedKey(authUser?.id ?? null, voterKey) ?? null

      const { error } = await supabase.from('inquiries').insert({
        inquiry_type: input.inquiryType,
        title: input.title,
        content: input.content,
        contact: input.contact || null,
        page_url: pageUrl,
        user_agent: userAgent,
        reporter_key: actorKey,
        status: 'pending',
      })

      if (error) {
        console.error('문의 접수 실패', error)
        showToast('문의 접수 실패')
        throw error
      }

      showToast('문의 접수 완료 · 운영팀이 확인 중')
    },
    [authUser?.id, showToast, voterKey],
  )

  const loadInquiryAdminItems = useCallback(async () => {
    if (!isAdmin) return
    setInquiryAdminLoading(true)
    try {
      const { data, error } = await supabase
        .from('inquiries')
        .select(
          'id, inquiry_type, title, content, contact, page_url, user_agent, reporter_key, status, admin_note, created_at, resolved_at',
        )
        .order('created_at', { ascending: false })
        .limit(80)
      if (error) throw error
      setInquiryAdminItems((data ?? []) as InquiryRow[])
    } catch (error) {
      console.error('문의함 조회 실패', error)
      showToast('문의함 조회 실패')
    } finally {
      setInquiryAdminLoading(false)
    }
  }, [isAdmin, showToast])

  const updateInquiryStatus = useCallback(
    async (id: number, status: InquiryStatus) => {
      if (!isAdmin) return
      const resolvedAt =
        status === 'resolved' || status === 'rejected'
          ? new Date().toISOString()
          : null
      const { error } = await supabase
        .from('inquiries')
        .update({ status, resolved_at: resolvedAt })
        .eq('id', id)
      if (error) {
        console.error('문의 상태 변경 실패', error)
        showToast('상태 변경 실패')
        return
      }
      setInquiryAdminItems((prev) =>
        prev.map((item) =>
          item.id === id ? { ...item, status, resolved_at: resolvedAt } : item,
        ),
      )
      showToast('문의 상태 변경 완료')
    },
    [isAdmin, showToast],
  )

  const clearAuthLocalState = useCallback(() => {
    setAuthUser(null)
    setProfile(null)
    setAdminMode(false)
    setDeletedOpen(false)
    setMyPosts([])
    setMyComments([])
    setWatchlistItems([])
    setMyWatchlistMap({})
    setStats(
      normalizeStats({
        points: 0,
        level: 1,
        votes_count: 0,
        comments_count: 0,
        posts_count: 0,
        likes_received: 0,
      }),
    )
    setBadges([])
    setStreakMap({})
    setCommentOpen(false)
    setActivityOpen(false)
    setActivityInitialTab('posts')
  }, [])

  const loadAuthState = useCallback(
    async (force = false) => {
      if (authHydrationInFlightRef.current && !force) return

      authHydrationInFlightRef.current = true

      try {
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession()

        if (sessionError) throw sessionError

        const sessionUser = session?.user ?? null
        const nextUserId = sessionUser?.id ?? null

        if (!nextUserId) {
          lastAuthUserIdRef.current = null
          clearAuthLocalState()
          return
        }

        if (
          !force &&
          lastAuthUserIdRef.current === nextUserId &&
          authUser?.id === nextUserId &&
          profile?.id === nextUserId
        ) {
          return
        }

        const result = await ensureProfile()
        lastAuthUserIdRef.current = result.user?.id ?? null
        setAuthUser(result.user)
        setProfile(result.profile)
      } catch (error: any) {
        if (error?.name === 'AuthSessionMissingError') {
          lastAuthUserIdRef.current = null
          clearAuthLocalState()
          return
        }

        console.error('auth/profile 로딩 실패', {
          message: error?.message,
          name: error?.name,
          details: error?.details,
          hint: error?.hint,
          code: error?.code,
        })
      } finally {
        authHydrationInFlightRef.current = false
      }
    },
    [authUser?.id, clearAuthLocalState, profile?.id],
  )

  const markPostMeaningful = useCallback(
    (post: PostItem | null | undefined) => {
      if (!post) return

      writeStoredPostSignal(post.id, {
        meaningful: true,
        viewedAt: Date.now(),
        commentsCount: post.comments.length,
        votesTotal: post.leftVotes + post.rightVotes,
      })
    },
    [],
  )

  const loadDiscoveryData = useCallback(async (sourcePosts?: PostItem[]) => {
    const basePosts = sourcePosts ?? postsRef.current

    if (basePosts.length === 0) {
      setHotScoreMap({})
      setTurningPointMap({})
      setHotNowPosts([])
      return
    }

    const postIds = basePosts.map((post) => post.id)

    const [hotResult, turningResult] = await Promise.all([
      supabase
        .from('post_hot_scores')
        .select(
          'post_id, score, view_1h, vote_1h, comment_1h, share_24h, controversy_ratio, updated_at',
        )
        .in('post_id', postIds),
      supabase
        .from('post_turning_points')
        .select(
          'post_id, event_label, leader_side, snapshot_left_votes, snapshot_right_votes, created_at',
        )
        .in('post_id', postIds)
        .order('created_at', { ascending: false }),
    ])

    if (hotResult.error) {
      console.error('post_hot_scores 불러오기 실패', hotResult.error)
    }

    if (turningResult.error) {
      console.error('post_turning_points 불러오기 실패', turningResult.error)
    }

    const nextHotMap: Record<number, HotMeta> = {}
    ;(hotResult.data ?? []).forEach((row: any) => {
      nextHotMap[Number(row.post_id)] = {
        score: Number(row.score ?? 0),
        view1h: Number(row.view_1h ?? 0),
        vote1h: Number(row.vote_1h ?? 0),
        comment1h: Number(row.comment_1h ?? 0),
        share24h: Number(row.share_24h ?? 0),
        controversyRatio: Number(row.controversy_ratio ?? 1),
        updatedAt: row.updated_at ?? null,
      }
    })
    setHotScoreMap(nextHotMap)

    const nextTurningMap: Record<number, TurningPointMeta> = {}
    ;(turningResult.data ?? []).forEach((row: any) => {
      const postId = Number(row.post_id)
      if (nextTurningMap[postId]) return
      nextTurningMap[postId] = {
        eventLabel: row.event_label,
        leaderSide: row.leader_side ?? null,
        leftVotes: Number(row.snapshot_left_votes ?? 0),
        rightVotes: Number(row.snapshot_right_votes ?? 0),
        createdAt: row.created_at ?? null,
      }
    })
    setTurningPointMap(nextTurningMap)

    const ranked = [...basePosts]
      .filter((post) => !post.hidden)
      .sort((a, b) => {
        const scoreA = nextHotMap[a.id]?.score ?? 0
        const scoreB = nextHotMap[b.id]?.score ?? 0
        if (scoreB !== scoreA) return scoreB - scoreA
        return (
          b.comments.length +
          b.leftVotes +
          b.rightVotes -
          (a.comments.length + a.leftVotes + a.rightVotes)
        )
      })
      .slice(0, 3)

    setHotNowPosts(ranked)
  }, [])

  const scheduleDiscoveryRefresh = useCallback(
    (sourcePosts?: PostItem[]) => {
      if (discoveryTimerRef.current) {
        clearTimeout(discoveryTimerRef.current)
      }

      discoveryTimerRef.current = setTimeout(() => {
        void loadDiscoveryData(sourcePosts ?? postsRef.current)
      }, 250)
    },
    [loadDiscoveryData],
  )

  const logPostEvent = useCallback(
    async ({
      postId,
      eventType,
      side,
      sessionId,
      refId,
    }: {
      postId: number
      eventType:
        | 'view'
        | 'vote'
        | 'comment'
        | 'share_create'
        | 'share_open'
        | 'share_vote'
      side?: VoteSide | null
      sessionId?: string | null
      refId?: number | null
    }) => {
      const { error } = await supabase.from('post_events').insert({
        post_id: postId,
        voter_key: voterKey || null,
        event_type: eventType,
        side: side ?? null,
        session_id: sessionId ?? null,
        ref_id: refId ?? null,
      })

      if (error) {
        console.error('post_events 저장 실패', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code,
          postId,
          eventType,
        })
      }
    },
    [voterKey],
  )

  const loadReactionAndOutcomeData = useCallback(
    async (postIds: number[], commentIds: number[]) => {
      const [commentSummaryRes, postSummaryRes, outcomesRes, nextQueueRes] =
        await Promise.all([
          commentIds.length > 0
            ? supabase
                .from('v_comment_reaction_summary')
                .select('*')
                .in('comment_id', commentIds)
            : Promise.resolve({ data: [], error: null } as any),
          postIds.length > 0
            ? supabase
                .from('v_post_reaction_summary')
                .select('*')
                .in('post_id', postIds)
            : Promise.resolve({ data: [], error: null } as any),
          postIds.length > 0
            ? supabase
                .from('post_outcomes')
                .select('id, post_id, outcome_type, summary, created_at')
                .in('post_id', postIds)
                .order('created_at', { ascending: false })
            : Promise.resolve({ data: [], error: null } as any),
          postIds.length > 0
            ? supabase
                .from('post_next_queue')
                .select('from_post_id, to_post_id, reason_type, score')
                .in('from_post_id', postIds)
                .order('score', { ascending: false })
            : Promise.resolve({ data: [], error: null } as any),
        ])

      if (!commentSummaryRes.error) {
        const nextMap: Record<number, CommentReactionSummary> = {}
        ;(commentSummaryRes.data ?? []).forEach((row: any) => {
          nextMap[Number(row.comment_id)] = {
            agree: Number(row.agree_count ?? 0),
            disagree: Number(row.disagree_count ?? 0),
            wow: Number(row.wow_count ?? 0),
            relatable: Number(row.relatable_count ?? 0),
            absurd: Number(row.absurd_count ?? 0),
          }
        })
        setCommentReactionMap(nextMap)
      }

      if (!postSummaryRes.error) {
        const nextMap: Record<number, PostReactionSummary> = {}
        ;(postSummaryRes.data ?? []).forEach((row: any) => {
          nextMap[Number(row.post_id)] = {
            controversial: Number(row.controversial_count ?? 0),
            curious: Number(row.curious_count ?? 0),
            suspicious: Number(row.suspicious_count ?? 0),
            minority: Number(row.minority_count ?? 0),
            shareworthy: Number(row.shareworthy_count ?? 0),
          }
        })
        setPostReactionSummaryMap(nextMap)
      }

      if (!outcomesRes.error) {
        const nextMap: Record<number, PostOutcomeItem[]> = {}
        ;(outcomesRes.data ?? []).forEach((row: any) => {
          const postId = Number(row.post_id)
          if (!nextMap[postId]) nextMap[postId] = []
          nextMap[postId].push({
            id: Number(row.id),
            postId,
            outcomeType: row.outcome_type,
            summary: row.summary,
            createdAt: row.created_at ?? null,
          })
        })
        setPostOutcomeMap(nextMap)
      }

      if (!nextQueueRes.error) {
        const nextMap: Record<number, NextQueueItem[]> = {}
        ;(nextQueueRes.data ?? []).forEach((row: any) => {
          const fromPostId = Number(row.from_post_id)
          if (!nextMap[fromPostId]) nextMap[fromPostId] = []
          nextMap[fromPostId].push({
            fromPostId,
            toPostId: Number(row.to_post_id),
            reasonType: row.reason_type,
            score: Number(row.score ?? 0),
          })
        })
        setNextQueueMap(nextMap)
      }
    },
    [],
  )

  const loadDramaEnhancementData = useCallback(
    async (postIds: number[]) => {
      const [flipRes, choicePathRes, shadowRes, tensionRes] = await Promise.all(
        [
          postIds.length > 0
            ? supabase
                .from('post_flip_events')
                .select(
                  'post_id, before_leader, after_leader, before_left_votes, before_right_votes, after_left_votes, after_right_votes, created_at',
                )
                .in('post_id', postIds)
                .order('created_at', { ascending: false })
            : Promise.resolve({ data: [], error: null } as any),
          postIds.length > 0
            ? supabase
                .from('v_choice_path_top')
                .select('from_post_id, to_post_id, chosen_side, path_count')
                .in('from_post_id', postIds)
            : Promise.resolve({ data: [], error: null } as any),
          currentActorUnifiedKey && postIds.length > 0
            ? supabase
                .from('user_shadow_watchlist')
                .select(
                  'post_id, view_count, is_auto_saved, first_seen_at, last_seen_at',
                )
                .eq('actor_key', currentActorUnifiedKey)
                .in('post_id', postIds)
            : Promise.resolve({ data: [], error: null } as any),
          postIds.length > 0
            ? supabase
                .from('post_tension_state')
                .select(
                  'post_id, tension_type, vote_diff, total_votes, is_flip_imminent, updated_at',
                )
                .in('post_id', postIds)
            : Promise.resolve({ data: [], error: null } as any),
        ],
      )

      if (!flipRes.error) {
        const nextMap: Record<number, PostFlipEventItem> = {}
        ;(flipRes.data ?? []).forEach((row: any) => {
          const postId = Number(row.post_id)
          if (nextMap[postId]) return
          nextMap[postId] = {
            postId,
            beforeLeader: row.before_leader ?? null,
            afterLeader: row.after_leader ?? null,
            beforeLeftVotes: Number(row.before_left_votes ?? 0),
            beforeRightVotes: Number(row.before_right_votes ?? 0),
            afterLeftVotes: Number(row.after_left_votes ?? 0),
            afterRightVotes: Number(row.after_right_votes ?? 0),
            createdAt: row.created_at ?? null,
          }
        })
        setPostFlipMap(nextMap)
      }

      if (!choicePathRes.error) {
        const nextMap: Record<string, ChoicePathTopItem> = {}
        ;(choicePathRes.data ?? []).forEach((row: any) => {
          nextMap[`${Number(row.from_post_id)}:${row.chosen_side}`] = {
            fromPostId: Number(row.from_post_id),
            toPostId: Number(row.to_post_id),
            chosenSide: row.chosen_side,
            count: Number(row.path_count ?? 0),
          }
        })
        setChoicePathTopMap(nextMap)
      }

      if (!shadowRes.error) {
        const nextMap: Record<number, ShadowWatchItem> = {}
        ;(shadowRes.data ?? []).forEach((row: any) => {
          nextMap[Number(row.post_id)] = {
            postId: Number(row.post_id),
            viewCount: Number(row.view_count ?? 0),
            isAutoSaved: Boolean(row.is_auto_saved ?? false),
            firstSeenAt: row.first_seen_at ?? null,
            lastSeenAt: row.last_seen_at ?? null,
          }
        })
        setShadowWatchMap(nextMap)
      }

      if (!tensionRes.error) {
        const nextMap: Record<number, PostTensionState> = {}
        ;(tensionRes.data ?? []).forEach((row: any) => {
          nextMap[Number(row.post_id)] = {
            postId: Number(row.post_id),
            tensionType: (row.tension_type ??
              'landslide') as PostTensionState['tensionType'],
            voteDiff: Number(row.vote_diff ?? 0),
            totalVotes: Number(row.total_votes ?? 0),
            isFlipImminent: Boolean(row.is_flip_imminent ?? false),
            updatedAt: row.updated_at ?? null,
          }
        })
        setPostTensionMap(nextMap)
      }
    },
    [currentActorUnifiedKey],
  )

  const loadActorReactionSelections = useCallback(
    async (postIds: number[], commentIds: number[]) => {
      if (!currentActorUnifiedKey) {
        setMyCommentReactions({})
        setMyPostReactions({})
        setMyWatchlistMap({})
        return
      }

      const [commentReactionRes, postReactionRes, streakRes, watchlistRes] =
        await Promise.all([
          commentIds.length > 0
            ? supabase
                .from('comment_reactions')
                .select('comment_id, reaction_type')
                .eq('reactor_key', currentActorUnifiedKey)
                .in('comment_id', commentIds)
            : Promise.resolve({ data: [], error: null } as any),
          postIds.length > 0
            ? supabase
                .from('post_reactions')
                .select('post_id, reaction_type')
                .eq('reactor_key', currentActorUnifiedKey)
                .in('post_id', postIds)
            : Promise.resolve({ data: [], error: null } as any),
          supabase
            .from('user_streaks')
            .select('streak_type, current_count, best_count, last_action_at')
            .eq('actor_key', currentActorUnifiedKey),
          postIds.length > 0
            ? supabase
                .from('post_watchlist')
                .select('post_id')
                .eq('actor_key', currentActorUnifiedKey)
                .eq('watch_type', 'curious')
                .in('post_id', postIds)
            : Promise.resolve({ data: [], error: null } as any),
        ])

      if (!commentReactionRes.error) {
        const nextMap: Record<string, boolean> = {}
        ;(commentReactionRes.data ?? []).forEach((row: any) => {
          nextMap[`${Number(row.comment_id)}:${row.reaction_type}`] = true
        })
        setMyCommentReactions(nextMap)
      }

      if (!postReactionRes.error) {
        const nextMap: Record<string, boolean> = {}
        ;(postReactionRes.data ?? []).forEach((row: any) => {
          nextMap[`${Number(row.post_id)}:${row.reaction_type}`] = true
        })
        setMyPostReactions(nextMap)
      }

      if (!streakRes.error) {
        const nextMap: Record<string, UserStreakRow> = {}
        ;(streakRes.data ?? []).forEach((row: any) => {
          nextMap[row.streak_type] = {
            streakType: row.streak_type,
            currentCount: Number(row.current_count ?? 0),
            bestCount: Number(row.best_count ?? 0),
            lastActionAt: row.last_action_at ?? null,
          }
        })
        setStreakMap(nextMap)
      }

      if (!watchlistRes.error) {
        const nextMap: Record<number, boolean> = {}
        ;(watchlistRes.data ?? []).forEach((row: any) => {
          nextMap[Number(row.post_id)] = true
        })
        setMyWatchlistMap(nextMap)
      }
    },
    [currentActorUnifiedKey],
  )

  const fetchAll = useCallback(
    async (key: string) => {
      setLoading(true)

      const { data: postsData, error: postsError } = await supabase
        .from('posts')
        .select('*')
        .neq('status', 'deleted')
        .order('created_at', { ascending: false })

      if (postsError) {
        console.error('posts 불러오기 실패', postsError)
        setLoading(false)
        return
      }

      const { data: commentsData, error: commentsError } = await supabase
        .from('comments')
        .select('*')
        .neq('status', 'deleted')
        .order('created_at', { ascending: false })

      if (commentsError) {
        console.error('comments 불러오기 실패', commentsError)
        setLoading(false)
        return
      }

      const { data: voteRows, error: votesError } = await supabase
        .from('votes')
        .select('post_id, voter_key, side')
        .eq('voter_key', key)

      if (votesError) {
        console.error('votes 불러오기 실패', votesError)
      }

      const merged: PostItem[] = (postsData ?? []).map((post) => ({
        id: Number(post.id),
        category: post.category,
        ageGroup: post.age_group,
        title: post.title,
        content: post.content,
        leftLabel: post.left_label,
        rightLabel: post.right_label,
        leftVotes: Number(post.left_votes ?? 0),
        rightVotes: Number(post.right_votes ?? 0),
        reportCount: Number(post.report_count ?? 0),
        hidden: Boolean(post.hidden ?? false),
        authorKey: post.author_key ?? null,
        views: Number(post.views ?? 0),
        comments: (commentsData ?? [])
          .filter((comment) => Number(comment.post_id) === Number(post.id))
          .map((comment) => ({
            id: Number(comment.id),
            author: comment.author,
            authorKey: comment.author_key ?? null,
            side: comment.side as Side,
            text: comment.text,
            likes: Number(comment.likes ?? 0),
            reportCount: Number(comment.report_count ?? 0),
            hidden: Boolean(comment.hidden ?? false),
          })),
      }))

      setPosts(merged)
      if (!latestSeenPostIdRef.current && merged.length > 0) {
        latestSeenPostIdRef.current = merged[0].id
      }

      const voteMap: Record<number, VoteSide> = {}
      ;(voteRows ?? []).forEach((row: VoteRow) => {
        voteMap[Number(row.post_id)] = row.side
      })
      setVotes(voteMap)
      await loadDiscoveryData(merged)

      const postIds = merged.map((post) => post.id)
      const commentIds = merged.flatMap((post) =>
        post.comments.map((comment) => comment.id),
      )
      await loadReactionAndOutcomeData(postIds, commentIds)
      await loadDramaEnhancementData(postIds)
      await loadActorReactionSelections(postIds, commentIds)

      setLoading(false)
    },
    [
      loadActorReactionSelections,
      loadDiscoveryData,
      loadDramaEnhancementData,
      loadReactionAndOutcomeData,
    ],
  )

  useEffect(() => {
    const postIds = posts.map((post) => post.id)
    const commentIds = posts.flatMap((post) =>
      post.comments.map((comment) => comment.id),
    )
    if (postIds.length === 0 && commentIds.length === 0) return
    void loadActorReactionSelections(postIds, commentIds)
  }, [posts, loadActorReactionSelections])

  const refreshCommentsForPost = useCallback(
    async (postId: number) => {
      const { data: commentsData, error: commentsError } = await supabase
        .from('comments')
        .select('*')
        .eq('post_id', postId)
        .neq('status', 'deleted')
        .order('created_at', { ascending: false })

      if (commentsError) {
        console.error('단일 글 comments 새로고침 실패', commentsError)
        return
      }

      const nextComments: CommentItem[] = (commentsData ?? []).map(
        (comment: any) => ({
          id: Number(comment.id),
          author: comment.author,
          authorKey: comment.author_key ?? null,
          side: comment.side as Side,
          text: comment.text,
          likes: Number(comment.likes ?? 0),
          reportCount: Number(comment.report_count ?? 0),
          hidden: Boolean(comment.hidden ?? false),
          createdAt: comment.created_at ?? null,
          replyToCommentId:
            comment.reply_to_comment_id != null
              ? Number(comment.reply_to_comment_id)
              : null,
        }),
      )

      setPosts((prev) =>
        prev.map((post) =>
          post.id === postId
            ? {
                ...post,
                comments: nextComments,
              }
            : post,
        ),
      )

      const commentIds = nextComments.map((comment) => comment.id)
      await loadReactionAndOutcomeData([postId], commentIds)
      await loadActorReactionSelections([postId], commentIds)
    },
    [loadActorReactionSelections, loadReactionAndOutcomeData],
  )

  const fetchMyActivity = useCallback(async (actorKey: string) => {
    if (!actorKey) return

    console.groupCollapsed('[matnya] fetchMyActivity')
    console.log('actorKey', actorKey)

    const [myPostsRes, myCommentsRes] = await Promise.all([
      supabase
        .from('posts')
        .select('id, title, category, age_group, created_at')
        .eq('author_key', actorKey)
        .neq('status', 'deleted')
        .order('created_at', { ascending: false }),
      supabase
        .from('comments')
        .select('id, post_id, text, created_at')
        .eq('author_key', actorKey)
        .neq('status', 'deleted')
        .order('created_at', { ascending: false }),
    ])

    if (myPostsRes.error) {
      console.error('내 글 불러오기 실패', myPostsRes.error)
      setMyPosts([])
    }

    if (myCommentsRes.error) {
      console.error('내 댓글 불러오기 실패', myCommentsRes.error)
      setMyComments([])
      console.groupEnd()
      return
    }

    const myPostsData = myPostsRes.data ?? []
    const myCommentsData = myCommentsRes.data ?? []

    const postIds = myPostsData.map((post: any) => Number(post.id))
    const commentRows = myCommentsData.map((comment: any) => ({
      id: Number(comment.id),
      commentId: Number(comment.id),
      postId: Number(comment.post_id),
      text: comment.text,
    }))
    const commentIds = commentRows.map((item) => item.commentId)
    const uniquePostIds = [...new Set(commentRows.map((item) => item.postId))]
    const activityTargetIds = [...new Set([...postIds, ...commentIds])]

    const [
      commentPostsRes,
      activityReadsRes,
      postCommentsRes,
      replyReactionsRes,
    ] = await Promise.all([
      uniquePostIds.length > 0
        ? supabase.from('posts').select('id, title').in('id', uniquePostIds)
        : Promise.resolve({ data: [], error: null } as any),
      activityTargetIds.length > 0
        ? supabase
            .from('user_activity_reads')
            .select('id, actor_key, target_type, target_id, last_seen_at')
            .eq('actor_key', actorKey)
            .in('target_id', activityTargetIds)
        : Promise.resolve({ data: [], error: null } as any),
      postIds.length > 0
        ? supabase
            .from('comments')
            .select('id, post_id, author_key, created_at')
            .in('post_id', postIds)
            .neq('status', 'deleted')
        : Promise.resolve({ data: [], error: null } as any),
      commentIds.length > 0
        ? supabase
            .from('comment_reactions')
            .select('id, comment_id, reactor_key, reaction_type, created_at')
            .eq('reaction_type', 'disagree')
            .in('comment_id', commentIds)
        : Promise.resolve({ data: [], error: null } as any),
    ])

    if (commentPostsRes.error) {
      console.error('댓글 글 제목 불러오기 실패', commentPostsRes.error)
    }
    if (activityReadsRes.error) {
      console.error('활동 읽음 상태 불러오기 실패', activityReadsRes.error)
    }
    if (postCommentsRes.error) {
      console.error('내 글 새 댓글 불러오기 실패', postCommentsRes.error)
    }
    if (replyReactionsRes.error) {
      console.error('내 댓글 반박 불러오기 실패', replyReactionsRes.error)
    }

    const postTitleMap = new Map<number, string>()
    ;(commentPostsRes.data ?? []).forEach((post: any) => {
      postTitleMap.set(Number(post.id), post.title)
    })

    const readMap = new Map<string, string | null>()
    ;(activityReadsRes.data ?? []).forEach((row: any) => {
      readMap.set(
        `${row.target_type}:${Number(row.target_id)}`,
        row.last_seen_at ?? null,
      )
    })

    const totalCommentCountMap = new Map<number, number>()
    const newCommentCountMap = new Map<number, number>()
    ;(postCommentsRes.data ?? []).forEach((row: any) => {
      const postId = Number(row.post_id)
      const seenAt = readMap.get(`post:${postId}`)
      const createdAt = row.created_at ? new Date(row.created_at).getTime() : 0
      const seenTime = seenAt ? new Date(seenAt).getTime() : 0
      const isOtherUser = String(row.author_key ?? '') !== String(actorKey)
      if (isOtherUser) {
        totalCommentCountMap.set(
          postId,
          Number(totalCommentCountMap.get(postId) ?? 0) + 1,
        )
      }
      if (!isOtherUser || createdAt <= seenTime) return
      newCommentCountMap.set(
        postId,
        Number(newCommentCountMap.get(postId) ?? 0) + 1,
      )
    })

    const totalReplyCountMap = new Map<number, number>()
    const newReplyCountMap = new Map<number, number>()
    ;(replyReactionsRes.data ?? []).forEach((row: any) => {
      const commentId = Number(row.comment_id)
      const seenAt = readMap.get(`comment:${commentId}`)
      const createdAt = row.created_at ? new Date(row.created_at).getTime() : 0
      const seenTime = seenAt ? new Date(seenAt).getTime() : 0
      const isOtherUser = String(row.reactor_key ?? '') !== String(actorKey)
      totalReplyCountMap.set(
        commentId,
        Number(totalReplyCountMap.get(commentId) ?? 0) + 1,
      )
      if (!isOtherUser || createdAt <= seenTime) return
      newReplyCountMap.set(
        commentId,
        Number(newReplyCountMap.get(commentId) ?? 0) + 1,
      )
    })

    const nextMyPosts = myPostsData.map((post: any) => ({
      id: Number(post.id),
      postId: Number(post.id),
      title: post.title,
      category: post.category,
      ageGroup: post.age_group,
      hasNewComments: Number(newCommentCountMap.get(Number(post.id)) ?? 0) > 0,
      newCommentsCount: Number(newCommentCountMap.get(Number(post.id)) ?? 0),
      totalCommentsCount: Number(
        totalCommentCountMap.get(Number(post.id)) ?? 0,
      ),
    }))

    const nextMyComments = commentRows.map((comment) => ({
      ...comment,
      postTitle: postTitleMap.get(comment.postId) ?? '원글',
      hasNewReplies: Number(newReplyCountMap.get(comment.commentId) ?? 0) > 0,
      newRepliesCount: Number(newReplyCountMap.get(comment.commentId) ?? 0),
      totalRepliesCount: Number(totalReplyCountMap.get(comment.commentId) ?? 0),
    }))

    console.log('myPosts', nextMyPosts)
    console.log('myComments', nextMyComments)
    console.log('replyReactionsRaw', replyReactionsRes.data ?? [])
    console.groupEnd()

    setMyPosts(nextMyPosts)
    setMyComments(nextMyComments)
  }, [])

  const markAllMyPostsSeen = useCallback(async () => {
    if (!currentRawActorKey) return

    const targetPostIds = myPosts
      .filter((item) => Number(item.newCommentsCount ?? 0) > 0)
      .map((item) => Number(item.postId))
      .filter(Boolean)

    if (targetPostIds.length === 0) return

    const seenAt = new Date().toISOString()
    const { error } = await supabase.from('user_activity_reads').upsert(
      targetPostIds.map((postId) => ({
        actor_key: currentRawActorKey,
        target_type: 'post',
        target_id: postId,
        last_seen_at: seenAt,
      })),
      { onConflict: 'actor_key,target_type,target_id' },
    )

    if (error) {
      console.error('내 글 전체 읽음 처리 실패', error)
      return
    }

    void fetchMyActivity(currentRawActorKey)
  }, [currentRawActorKey, fetchMyActivity, myPosts])

  const markAllMyCommentsSeen = useCallback(async () => {
    if (!currentRawActorKey) return

    const targetCommentIds = myComments
      .filter((item) => Number(item.newRepliesCount ?? 0) > 0)
      .map((item) => Number(item.commentId))
      .filter(Boolean)

    if (targetCommentIds.length === 0) return

    const seenAt = new Date().toISOString()
    const { error } = await supabase.from('user_activity_reads').upsert(
      targetCommentIds.map((commentId) => ({
        actor_key: currentRawActorKey,
        target_type: 'comment',
        target_id: commentId,
        last_seen_at: seenAt,
      })),
      { onConflict: 'actor_key,target_type,target_id' },
    )

    if (error) {
      console.error('내 댓글 전체 읽음 처리 실패', error)
      return
    }

    void fetchMyActivity(currentRawActorKey)
  }, [currentRawActorKey, fetchMyActivity, myComments])

  const fetchDeletedItems = useCallback(async () => {
    const { data: deletedPostsData, error: deletedPostsError } = await supabase
      .from('posts')
      .select('*')
      .eq('status', 'deleted')
      .order('created_at', { ascending: false })

    if (deletedPostsError) {
      console.error('삭제된 글 불러오기 실패', deletedPostsError)
      return
    }

    setDeletedPosts(
      (deletedPostsData ?? []).map((post) => ({
        id: Number(post.id),
        category: post.category,
        ageGroup: post.age_group,
        title: post.title,
        content: post.content,
        leftLabel: post.left_label,
        rightLabel: post.right_label,
        leftVotes: Number(post.left_votes ?? 0),
        rightVotes: Number(post.right_votes ?? 0),
        reportCount: Number(post.report_count ?? 0),
        hidden: Boolean(post.hidden ?? false),
        views: Number(post.views ?? 0),
        comments: [],
      })),
    )

    const { data: deletedCommentsData, error: deletedCommentsError } =
      await supabase
        .from('comments')
        .select('id, post_id, author, text')
        .eq('status', 'deleted')
        .order('created_at', { ascending: false })

    if (deletedCommentsError) {
      console.error('삭제된 댓글 불러오기 실패', deletedCommentsError)
      return
    }

    const rows = (deletedCommentsData ?? []).map((comment) => ({
      id: Number(comment.id),
      postId: Number(comment.post_id),
      author: comment.author,
      text: comment.text,
    }))

    if (rows.length === 0) {
      setDeletedComments([])
      return
    }

    const uniquePostIds = [...new Set(rows.map((item) => item.postId))]

    const { data: postRows, error: postRowsError } = await supabase
      .from('posts')
      .select('id, title')
      .in('id', uniquePostIds)

    if (postRowsError) {
      console.error('삭제 댓글 원글 조회 실패', postRowsError)
      setDeletedComments(
        rows.map((item) => ({
          ...item,
          postTitle: '삭제되었거나 찾을 수 없는 글',
        })),
      )
      return
    }

    const postMap = new Map<number, string>()
    ;(postRows ?? []).forEach((post) => {
      postMap.set(Number(post.id), post.title)
    })

    setDeletedComments(
      rows.map((item) => ({
        ...item,
        postTitle: postMap.get(item.postId) ?? '삭제되었거나 찾을 수 없는 글',
      })),
    )
  }, [])

  const loadProgress = useCallback(async () => {
    const currentUserId = authUser?.id ?? null
    const currentVoterKey = currentUserId ? null : voterKey

    if (!currentUserId && !currentVoterKey) return

    let statsQuery = supabase.from('user_stats').select('*').limit(1)
    statsQuery = currentUserId
      ? statsQuery.eq('user_id', currentUserId)
      : statsQuery.eq('voter_key', currentVoterKey)

    const { data: statsData, error: statsError } =
      await statsQuery.maybeSingle()

    if (statsError) {
      console.error('user_stats 조회 실패', statsError)
    } else if (statsData) {
      setStats(normalizeStats(statsData as Partial<UserStatsRow>))
    } else {
      const base = normalizeStats({
        user_id: currentUserId,
        voter_key: currentVoterKey,
      })
      setStats(base)

      const { error: insertError } = await supabase.from('user_stats').insert({
        user_id: currentUserId,
        voter_key: currentVoterKey,
        points: 0,
        level: 1,
        votes_count: 0,
        comments_count: 0,
        posts_count: 0,
        likes_received: 0,
      })

      if (insertError) {
        console.error('user_stats 초기 생성 실패', insertError)
      }
    }

    let badgeQuery = supabase
      .from('user_badges')
      .select('badge_name')
      .order('created_at', { ascending: false })

    badgeQuery = currentUserId
      ? badgeQuery.eq('user_id', currentUserId)
      : badgeQuery.eq('voter_key', currentVoterKey)

    const { data: badgeRows, error: badgeError } = await badgeQuery

    if (badgeError) {
      console.error('user_badges 조회 실패', badgeError)
    } else {
      setBadges((badgeRows ?? []).map((row) => row.badge_name))
    }

    const actorKey = getActorUnifiedKey(currentUserId, currentVoterKey ?? '')
    if (actorKey) {
      const { data: streakRows, error: streakError } = await supabase
        .from('user_streaks')
        .select('streak_type, current_count, best_count, last_action_at')
        .eq('actor_key', actorKey)

      if (streakError) {
        console.error('user_streaks 조회 실패', streakError)
      } else {
        const nextStreakMap: Record<string, UserStreakRow> = {}

        ;(streakRows ?? []).forEach((row: any) => {
          const streakType = row.streak_type as UserStreakRow['streakType']
          nextStreakMap[streakType] = {
            streakType,
            currentCount: Number(row.current_count ?? 0),
            bestCount: Number(row.best_count ?? 0),
            lastActionAt: row.last_action_at ?? null,
          }
        })

        setStreakMap(nextStreakMap)
      }
    } else {
      setStreakMap({})
    }
  }, [authUser?.id, voterKey])

  const refreshBadges = useCallback(async () => {
    const currentUserId = authUser?.id ?? null
    const currentVoterKey = currentUserId ? null : voterKey
    if (!currentUserId && !currentVoterKey) return []

    let badgeQuery = supabase
      .from('user_badges')
      .select('badge_name')
      .order('created_at', { ascending: false })

    badgeQuery = currentUserId
      ? badgeQuery.eq('user_id', currentUserId)
      : badgeQuery.eq('voter_key', currentVoterKey)

    const { data, error } = await badgeQuery

    if (error) {
      console.error('user_badges 새로고침 실패', error)
      return []
    }

    const nextBadges = Array.from(
      new Set((data ?? []).map((row) => String(row.badge_name))),
    )
    setBadges(nextBadges)
    return nextBadges
  }, [authUser?.id, voterKey])

  const awardBadgesFromStats = useCallback(
    async (nextStats: UserStatsRow) => {
      const currentUserId = authUser?.id ?? null
      const currentVoterKey = currentUserId ? null : voterKey
      if (!currentUserId && !currentVoterKey) return

      const latestBadges = await refreshBadges()
      const latestBadgeSet = new Set(latestBadges)

      const nextBadgeNames = BADGE_RULES.filter((rule) =>
        rule.check(nextStats),
      ).map((rule) => rule.name)

      const newlyEarned = nextBadgeNames.filter(
        (name) => !latestBadgeSet.has(name),
      )
      if (newlyEarned.length === 0) return

      const insertedBadges: string[] = []

      for (const badgeName of newlyEarned) {
        const { error } = await supabase.from('user_badges').insert({
          user_id: currentUserId,
          voter_key: currentVoterKey,
          badge_name: badgeName,
        })

        if (error) {
          if (error.code === '23505') {
            continue
          }

          console.error('뱃지 저장 실패', error)
          continue
        }

        insertedBadges.push(badgeName)
      }

      const finalBadges = await refreshBadges()

      if (insertedBadges.length > 0) {
        setBadges((prev) => {
          const merged = [...insertedBadges, ...finalBadges, ...prev]
          return Array.from(new Set(merged))
        })

        insertedBadges.forEach((badgeName) => showToast(`🏆 ${badgeName} 획득`))
      }
    },
    [authUser?.id, voterKey, refreshBadges, showToast],
  )

  const upsertStreak = useCallback(
    async (streakType: UserStreakRow['streakType'], nextCount: number) => {
      if (!currentActorUnifiedKey) return

      const prev = streakMap[streakType]
      const optimisticRow: UserStreakRow = {
        streakType,
        currentCount: nextCount,
        bestCount: Math.max(prev?.bestCount ?? 0, nextCount),
        lastActionAt: new Date().toISOString(),
      }

      setStreakMap((prevMap) => ({
        ...prevMap,
        [streakType]: optimisticRow,
      }))

      const { data, error } = await supabase.rpc('rpc_upsert_user_streak', {
        p_actor_key: currentActorUnifiedKey,
        p_streak_type: streakType,
        p_next_count: nextCount,
      })

      if (error) {
        console.error('streak 업데이트 실패', error)
        return
      }

      if (data) {
        const row = data as any

        setStreakMap((prevMap) => ({
          ...prevMap,
          [streakType]: {
            streakType,
            currentCount: Number(row.current_count ?? nextCount),
            bestCount: Number(row.best_count ?? optimisticRow.bestCount),
            lastActionAt: row.last_action_at ?? optimisticRow.lastActionAt,
          },
        }))
      }
    },
    [currentActorUnifiedKey, streakMap],
  )

  const updateProgress = useCallback(
    async (delta: Partial<UserStatsRow>, rewardMessage?: string) => {
      const currentUserId = authUser?.id ?? null
      const currentVoterKey = currentUserId ? null : voterKey
      if (!currentUserId && !currentVoterKey) return

      const optimisticStats = normalizeStats({
        ...stats,
        user_id: currentUserId,
        voter_key: currentVoterKey,
        points: stats.points + Number(delta.points ?? 0),
        votes_count: stats.votes_count + Number(delta.votes_count ?? 0),
        comments_count:
          stats.comments_count + Number(delta.comments_count ?? 0),
        posts_count: stats.posts_count + Number(delta.posts_count ?? 0),
        likes_received:
          stats.likes_received + Number(delta.likes_received ?? 0),
      })

      optimisticStats.level = getLevelInfo(optimisticStats.points).level
      setStats(optimisticStats)

      const { data, error } = await supabase.rpc(
        'rpc_increment_user_progress',
        {
          p_user_id: currentUserId,
          p_voter_key: currentVoterKey,
          p_points_delta: Number(delta.points ?? 0),
          p_votes_delta: Number(delta.votes_count ?? 0),
          p_comments_delta: Number(delta.comments_count ?? 0),
          p_posts_delta: Number(delta.posts_count ?? 0),
          p_likes_received_delta: Number(delta.likes_received ?? 0),
        },
      )

      if (error) {
        console.error('포인트 업데이트 실패', error)
        return
      }

      const returnedStats = data as
        | Partial<UserStatsRow>
        | Partial<UserStatsRow>[]
        | null
      const rpcStats = Array.isArray(returnedStats)
        ? returnedStats[0]
        : returnedStats

      if (rpcStats) {
        const nextStats = normalizeStats(rpcStats)
        setStats(nextStats)
        await awardBadgesFromStats(nextStats)
      } else {
        await awardBadgesFromStats(optimisticStats)
      }

      if (rewardMessage) {
        showToast(rewardMessage)
      }
    },
    [authUser?.id, voterKey, stats, showToast, awardBadgesFromStats],
  )

  const loadAuthorMeta = useCallback(async () => {
    const allComments = posts.flatMap((post) => post.comments)

    if (allComments.length === 0) {
      setAuthorMetaMap({})
      return
    }

    const baseMap: Record<string, AuthorMeta> = {}
    const userIdKeys = new Set<string>()
    const voterKeys = new Set<string>()

    allComments.forEach((comment) => {
      const metaKey = getAuthorMetaKey(comment.author, comment.authorKey)
      baseMap[metaKey] = getFallbackAuthorMeta(comment.author)

      const rawKey = String(comment.authorKey ?? '').trim()
      if (!rawKey) return

      if (rawKey.startsWith('vk_') || rawKey.startsWith('seed_vk_')) {
        voterKeys.add(rawKey)
      } else {
        userIdKeys.add(rawKey)
      }
    })

    const userIds = [...userIdKeys]
    const guestKeys = [...voterKeys]

    const [statsByUserRes, statsByGuestRes, badgesByUserRes, badgesByGuestRes] =
      await Promise.all([
        userIds.length > 0
          ? supabase
              .from('user_stats')
              .select('user_id, level')
              .in('user_id', userIds)
          : Promise.resolve({ data: [], error: null } as any),
        guestKeys.length > 0
          ? supabase
              .from('user_stats')
              .select('voter_key, level')
              .in('voter_key', guestKeys)
          : Promise.resolve({ data: [], error: null } as any),
        userIds.length > 0
          ? supabase
              .from('user_badges')
              .select('user_id, badge_name, created_at')
              .in('user_id', userIds)
              .order('created_at', { ascending: false })
          : Promise.resolve({ data: [], error: null } as any),
        guestKeys.length > 0
          ? supabase
              .from('user_badges')
              .select('voter_key, badge_name, created_at')
              .in('voter_key', guestKeys)
              .order('created_at', { ascending: false })
          : Promise.resolve({ data: [], error: null } as any),
      ])

    if (statsByUserRes.error)
      console.error('작성자 레벨(user_id) 조회 실패', statsByUserRes.error)
    if (statsByGuestRes.error)
      console.error('작성자 레벨(voter_key) 조회 실패', statsByGuestRes.error)
    if (badgesByUserRes.error)
      console.error('작성자 뱃지(user_id) 조회 실패', badgesByUserRes.error)
    if (badgesByGuestRes.error)
      console.error('작성자 뱃지(voter_key) 조회 실패', badgesByGuestRes.error)

    const levelByKey = new Map<string, number>()
    ;(statsByUserRes.data ?? []).forEach((row: any) => {
      if (row.user_id)
        levelByKey.set(`key:${String(row.user_id)}`, Number(row.level ?? 1))
    })
    ;(statsByGuestRes.data ?? []).forEach((row: any) => {
      if (row.voter_key)
        levelByKey.set(`key:${String(row.voter_key)}`, Number(row.level ?? 1))
    })

    const badgeByKey = new Map<string, string>()
    ;(badgesByUserRes.data ?? []).forEach((row: any) => {
      const key = row.user_id ? `key:${String(row.user_id)}` : ''
      if (key && !badgeByKey.has(key))
        badgeByKey.set(key, String(row.badge_name))
    })
    ;(badgesByGuestRes.data ?? []).forEach((row: any) => {
      const key = row.voter_key ? `key:${String(row.voter_key)}` : ''
      if (key && !badgeByKey.has(key))
        badgeByKey.set(key, String(row.badge_name))
    })

    Object.keys(baseMap).forEach((metaKey) => {
      baseMap[metaKey] = {
        level: levelByKey.get(metaKey) ?? baseMap[metaKey].level,
        badgeName: badgeByKey.get(metaKey) ?? baseMap[metaKey].badgeName,
      }
    })

    setAuthorMetaMap(baseMap)
  }, [posts])

  const handleAdminToggle = async () => {
    if (!isAdmin) {
      showToast('관리자 계정만 가능')
      return
    }

    try {
      setAdminMode(true)
      await fetchDeletedItems()
      setDeletedOpen(true)
      showToast('삭제 항목 관리 열림')
    } catch (error) {
      console.error('관리자 데이터 로딩 실패', error)
      showToast('관리자 데이터 로딩 실패')
    }
  }

  const handleGoogleLogin = async () => {
    try {
      await signInWithGoogle()
    } catch (error) {
      console.error('로그인하고 이어보기 실패', error)
      showToast('로그인하고 이어보기 실패')
    }
  }

  const handleLogout = async () => {
    try {
      setActivityOpen(false)
      setCommentOpen(false)
      setWriteOpen(false)
      setDeletedOpen(false)
      setAuthOpen(false)

      await signOutAuth()

      setAuthUser(null)
      setProfile(null)
      setMyPosts([])
      setMyComments([])
      setStats(
        normalizeStats({
          points: 0,
          level: 1,
          votes_count: 0,
          comments_count: 0,
          posts_count: 0,
          likes_received: 0,
        }),
      )
      setBadges([])
      setStreakMap({})
      setAdminMode(false)

      showToast('로그아웃 완료')
    } catch (error) {
      console.error('로그아웃 실패', error)
      showToast('로그아웃 실패')
    }
  }

  useEffect(() => {
    setGuestName(getOrCreateGuestName())
    void loadAuthState(true)

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const nextUserId = session?.user?.id ?? null

      if (!nextUserId) {
        lastAuthUserIdRef.current = null
        clearAuthLocalState()
        return
      }

      if (
        lastAuthUserIdRef.current === nextUserId &&
        authUser?.id === nextUserId
      ) {
        return
      }

      lastAuthUserIdRef.current = nextUserId
      void loadAuthState(true)
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [authUser?.id, clearAuthLocalState, loadAuthState])

  useEffect(() => {
    const key = getOrCreateVoterKey()
    setVoterKey(key)
    void fetchAll(key)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return

    const params = new URLSearchParams(window.location.search)
    const incomingShareId = params.get('share')
    const incomingPostId = params.get('post')

    if (incomingShareId) {
      setShareId(incomingShareId)
      setSharedEntryActive(true)
    }
    if (incomingPostId && !Number.isNaN(Number(incomingPostId))) {
      setSharedPostId(Number(incomingPostId))
    }
  }, [])

  const fetchWatchlist = useCallback(async (actorKey: string | null) => {
    if (!actorKey) {
      setWatchlistItems([])
      setMyWatchlistMap({})
      setWatchOutcomeSeenMap({})
      return
    }

    const { data: watchRows, error: watchError } = await supabase
      .from('post_watchlist')
      .select('id, post_id, created_at, watch_status, archived_at')
      .eq('actor_key', actorKey)
      .eq('watch_type', 'curious')
      .order('created_at', { ascending: false })

    if (watchError) {
      console.error('궁금한 글 불러오기 실패', watchError)
      return
    }

    const rows = (watchRows ?? []).map((row: any) => ({
      id: Number(row.id),
      postId: Number(row.post_id),
      createdAt: row.created_at ?? null,
      watchStatus: normalizeWatchStatus(row.watch_status),
      archivedAt: row.archived_at ?? null,
    }))

    if (rows.length === 0) {
      setWatchlistItems([])
      setMyWatchlistMap({})
      return
    }

    const postIds = [...new Set(rows.map((row) => row.postId))]
    const [watchPostsRes, outcomesRes, seenRes] = await Promise.all([
      supabase
        .from('posts')
        .select('id, title, category, age_group')
        .in('id', postIds),
      supabase
        .from('post_outcomes')
        .select('id, post_id, outcome_type, summary, created_at')
        .in('post_id', postIds)
        .order('created_at', { ascending: false }),
      supabase
        .from('post_watchlist_outcome_reads')
        .select('post_id, last_seen_outcome_created_at')
        .eq('actor_key', actorKey)
        .in('post_id', postIds),
    ])

    if (watchPostsRes.error) {
      console.error('궁금한 글 게시글 불러오기 실패', watchPostsRes.error)
      return
    }

    const postMap = new Map<number, any>()
    ;(watchPostsRes.data ?? []).forEach((row: any) => {
      postMap.set(Number(row.id), row)
    })

    const outcomeMap = new Map<number, any>()
    ;(outcomesRes.data ?? []).forEach((row: any) => {
      const postId = Number(row.post_id)
      if (!outcomeMap.has(postId)) {
        outcomeMap.set(postId, row)
      }
    })

    const seenMap = new Map<number, string | null>()
    ;(seenRes.data ?? []).forEach((row: any) => {
      seenMap.set(Number(row.post_id), row.last_seen_outcome_created_at ?? null)
    })

    const watchedMap: Record<number, boolean> = {}
    const nextSeenState: Record<number, string | null> = {}
    const items: WatchlistItem[] = rows
      .map((row) => {
        const post = postMap.get(row.postId)
        if (!post) return null
        const latestOutcome = outcomeMap.get(row.postId) ?? null
        const lastSeenAt = seenMap.get(row.postId) ?? null
        const latestOutcomeAt = latestOutcome?.created_at ?? null
        const unreadOutcome =
          !!latestOutcomeAt &&
          (!lastSeenAt ||
            new Date(latestOutcomeAt).getTime() >
              new Date(lastSeenAt).getTime())

        watchedMap[row.postId] = true
        nextSeenState[row.postId] = lastSeenAt
        const latestOutcomeCreatedAt = latestOutcome?.created_at ?? null
        const watchStatus = resolveWatchlistStatus({
          unreadOutcome,
          latestOutcomeCreatedAt,
          archivedAt: row.archivedAt,
          storedStatus: row.watchStatus,
        })

        return {
          id: row.id,
          postId: row.postId,
          title: post.title,
          category: post.category,
          ageGroup: post.age_group,
          createdAt: row.createdAt,
          latestOutcomeType: latestOutcome?.outcome_type ?? null,
          latestOutcomeSummary: latestOutcome?.summary ?? null,
          latestOutcomeCreatedAt,
          hasOutcome: !!latestOutcome,
          unreadOutcome,
          watchStatus,
          archivedAt: row.archivedAt,
        } satisfies WatchlistItem
      })
      .filter(Boolean) as WatchlistItem[]

    items.sort(compareWatchlistItems)

    setWatchlistItems(items)
    setMyWatchlistMap(watchedMap)
    setWatchOutcomeSeenMap(nextSeenState)
  }, [])

  useEffect(() => {
    if (currentActorKey) {
      void fetchMyActivity(currentActorKey)
    } else {
      setMyPosts([])
      setMyComments([])
    }
  }, [currentActorKey, fetchMyActivity])

  useEffect(() => {
    void fetchWatchlist(currentActorUnifiedKey)
  }, [currentActorUnifiedKey, fetchWatchlist])

  useEffect(() => {
    const run = async () => {
      if (!authUser?.id || !voterKey) return

      const signature = `${authUser.id}:${voterKey}`

      if (
        guestMergeDoneRef.current &&
        lastGuestMergeSignatureRef.current === signature
      ) {
        return
      }

      try {
        guestMergeDoneRef.current = true
        lastGuestMergeSignatureRef.current = signature

        const mergeResult = await migrateGuestActivityToAccount({
          voterKey,
          userId: authUser.id,
        })

        if ((mergeResult?.migratedCount ?? 0) > 0) {
          showToast('비로그인 활동이 계정에 이어서 연결됨')
        }

        await Promise.all([
          fetchWatchlist(`user:${authUser.id}`),
          fetchMyActivity(authUser.id),
          fetchAll(voterKey),
        ])
      } catch (error) {
        console.error('게스트 활동 계정 연결 실패', error)
        guestMergeDoneRef.current = false
      }
    }

    void run()
  }, [
    authUser?.id,
    voterKey,
    fetchAll,
    fetchMyActivity,
    fetchWatchlist,
    showToast,
  ])

  const loadResultUnlocks = useCallback(
    async (postIds: number[]) => {
      if (!currentActorUnifiedKey || postIds.length === 0) {
        setResultUnlockMap({})
        return
      }

      const { data, error } = await supabase
        .from('post_result_unlocks')
        .select(
          'post_id, voter_key, unlock_level, comment_reads, is_watchlisted, created_at, updated_at',
        )
        .eq('voter_key', currentActorUnifiedKey)
        .in('post_id', postIds)

      if (error) {
        console.error('결과 공개 단계 불러오기 실패', error)
        return
      }

      const nextMap: Record<number, ResultUnlockItem> = {}
      ;(data ?? []).forEach((row: any) => {
        const postId = Number(row.post_id)
        nextMap[postId] = {
          postId,
          voterKey: String(row.voter_key ?? currentActorUnifiedKey),
          unlockLevel: Math.max(1, Number(row.unlock_level ?? 1)),
          commentReads: Number(row.comment_reads ?? 0),
          isWatchlisted: Boolean(row.is_watchlisted ?? false),
          createdAt: row.created_at ?? null,
          updatedAt: row.updated_at ?? null,
        }
      })
      setResultUnlockMap(nextMap)
    },
    [currentActorUnifiedKey],
  )

  useEffect(() => {
    const postIds = posts.map((post) => post.id)
    if (!currentActorUnifiedKey || postIds.length === 0) {
      setResultUnlockMap({})
      return
    }
    void loadResultUnlocks(postIds)
  }, [currentActorUnifiedKey, posts, loadResultUnlocks])

  const loadOwnerShareInbox = useCallback(
    async (silent = false) => {
      if (!voterKey) {
        setShareInboxItems([])
        setShareInboxUnreadCount(0)
        return
      }

      if (!silent) setShareInboxLoading(true)

      const { data: sessions, error: sessionsError } = await supabase
        .from('share_sessions')
        .select('id, post_id, owner_choice, created_at')
        .eq('owner_key', voterKey)
        .order('created_at', { ascending: false })
        .limit(40)

      if (sessionsError) {
        console.error('보낸 공유함 조회 실패', sessionsError)
        if (!silent) setShareInboxLoading(false)
        return
      }

      const sessionRows = (sessions ?? []) as Array<{
        id: string
        post_id: number | null
        owner_choice?: VoteSide | null
        created_at?: string | null
      }>

      if (sessionRows.length === 0) {
        setShareInboxItems([])
        setShareInboxUnreadCount(0)
        if (!silent) setShareInboxLoading(false)
        return
      }

      const sessionIds = sessionRows.map((item) => String(item.id))
      const postIds = Array.from(
        new Set(
          sessionRows
            .map((item) => Number(item.post_id ?? 0))
            .filter((value) => value > 0),
        ),
      )

      const [
        { data: statsRows, error: statsError },
        { data: postRows, error: postError },
      ] = await Promise.all([
        supabase
          .from('share_session_stats')
          .select('share_session_id, left_count, right_count')
          .in('share_session_id', sessionIds),
        supabase
          .from('posts')
          .select('id, title, left_label, right_label, left_votes, right_votes')
          .in('id', postIds),
      ])

      if (statsError) {
        console.error('보낸 공유함 집계 조회 실패', statsError)
      }
      if (postError) {
        console.error('보낸 공유함 게시글 조회 실패', postError)
      }

      const statsMap = new Map<string, { left: number; right: number }>()
      for (const row of (statsRows ?? []) as Array<any>) {
        statsMap.set(String(row.share_session_id), {
          left: Number(row.left_count ?? 0),
          right: Number(row.right_count ?? 0),
        })
      }

      const postMap = new Map<
        number,
        {
          title: string
          leftLabel?: string
          rightLabel?: string
          overallLeftCount: number
          overallRightCount: number
        }
      >()
      for (const row of (postRows ?? []) as Array<any>) {
        postMap.set(Number(row.id), {
          title: String(row.title ?? '공유한 글'),
          leftLabel: row.left_label ?? undefined,
          rightLabel: row.right_label ?? undefined,
          overallLeftCount: Number(row.left_votes ?? 0),
          overallRightCount: Number(row.right_votes ?? 0),
        })
      }

      const seenMap = readShareInboxSeenMap()
      const items: ShareInboxItem[] = sessionRows.map((session) => {
        const sessionId = String(session.id)
        const postId = Number(session.post_id ?? 0)
        const stats = statsMap.get(sessionId) ?? { left: 0, right: 0 }
        const totalCount = stats.left + stats.right
        const seenCount = Number(seenMap[sessionId] ?? 0)
        const unreadCount = Math.max(0, totalCount - seenCount)
        const postMeta = postMap.get(postId)

        return {
          sessionId,
          postId,
          title: postMeta?.title ?? '공유한 글',
          ownerChoice: session.owner_choice ?? null,
          createdAt: session.created_at ?? null,
          leftCount: stats.left,
          rightCount: stats.right,
          totalCount,
          unreadCount,
          overallLeftCount: Number(postMeta?.overallLeftCount ?? 0),
          overallRightCount: Number(postMeta?.overallRightCount ?? 0),
          overallTotalCount:
            Number(postMeta?.overallLeftCount ?? 0) +
            Number(postMeta?.overallRightCount ?? 0),
          leftLabel: postMeta?.leftLabel,
          rightLabel: postMeta?.rightLabel,
        }
      })

      setShareInboxItems(items)
      setShareInboxUnreadCount(
        items.filter((item) => item.unreadCount > 0).length,
      )
      if (!silent) setShareInboxLoading(false)
    },
    [voterKey],
  )

  const upsertLocalShareInboxItem = useCallback(
    (input: {
      sessionId: string
      postId: number
      title: string
      ownerChoice: VoteSide | null
      createdAt?: string | null
      leftLabel?: string
      rightLabel?: string
      totalCount?: number
      leftCount?: number
      rightCount?: number
      overallLeftCount?: number
      overallRightCount?: number
    }) => {
      const nextItem: ShareInboxItem = {
        sessionId: input.sessionId,
        postId: input.postId,
        title: input.title,
        ownerChoice: input.ownerChoice,
        createdAt: input.createdAt ?? new Date().toISOString(),
        leftCount: Number(input.leftCount ?? 0),
        rightCount: Number(input.rightCount ?? 0),
        totalCount: Number(input.totalCount ?? 0),
        unreadCount: 0,
        overallLeftCount: Number(input.overallLeftCount ?? 0),
        overallRightCount: Number(input.overallRightCount ?? 0),
        overallTotalCount:
          Number(input.overallLeftCount ?? 0) +
          Number(input.overallRightCount ?? 0),
        leftLabel: input.leftLabel,
        rightLabel: input.rightLabel,
      }

      setShareInboxItems((prev) => {
        const existingIndex = prev.findIndex(
          (item) => item.sessionId === nextItem.sessionId,
        )
        if (existingIndex >= 0) {
          const cloned = [...prev]
          cloned[existingIndex] = {
            ...cloned[existingIndex],
            ...nextItem,
            unreadCount: cloned[existingIndex].unreadCount,
          }
          return cloned
        }
        return [nextItem, ...prev]
      })
    },
    [],
  )

  const refreshLightweightMetaNow = useCallback(async () => {
    if (!currentActorUnifiedKey) return

    if (metaRefreshInFlightRef.current) {
      metaRefreshQueuedRef.current = true
      return
    }

    metaRefreshInFlightRef.current = true
    lastMetaRefreshAtRef.current = Date.now()

    const postIds = posts.map((post) => post.id)
    const commentIds = posts.flatMap((post) =>
      post.comments.map((comment) => comment.id),
    )

    try {
      await fetchWatchlist(currentActorUnifiedKey)
      if (voterKey) {
        await loadOwnerShareInbox(true)
      }
      await loadReactionAndOutcomeData(postIds, commentIds)
      await loadDramaEnhancementData(postIds)
      await loadResultUnlocks(postIds)
    } finally {
      metaRefreshInFlightRef.current = false

      if (metaRefreshQueuedRef.current) {
        metaRefreshQueuedRef.current = false

        if (metaRefreshTimerRef.current) {
          clearTimeout(metaRefreshTimerRef.current)
        }

        metaRefreshTimerRef.current = setTimeout(() => {
          metaRefreshTimerRef.current = null
          void refreshLightweightMetaNow()
        }, 180)
      }
    }
  }, [
    currentActorUnifiedKey,
    fetchWatchlist,
    loadDramaEnhancementData,
    loadOwnerShareInbox,
    loadReactionAndOutcomeData,
    loadResultUnlocks,
    posts,
    voterKey,
  ])

  const requestLightweightMetaRefresh = useCallback(
    (options?: { immediate?: boolean; delay?: number }) => {
      if (!currentActorUnifiedKey) return

      const immediate = options?.immediate ?? false
      const baseDelay = options?.delay ?? 160

      if (immediate) {
        if (metaRefreshTimerRef.current) {
          clearTimeout(metaRefreshTimerRef.current)
          metaRefreshTimerRef.current = null
        }

        void refreshLightweightMetaNow()
        return
      }

      const sinceLast = Date.now() - lastMetaRefreshAtRef.current
      const delay = sinceLast < 1200 ? Math.max(baseDelay, 260) : baseDelay

      if (metaRefreshTimerRef.current) {
        clearTimeout(metaRefreshTimerRef.current)
      }

      metaRefreshTimerRef.current = setTimeout(() => {
        metaRefreshTimerRef.current = null
        void refreshLightweightMetaNow()
      }, delay)
    },
    [currentActorUnifiedKey, refreshLightweightMetaNow],
  )

  const refreshNewPostSignalsAfterAction = useCallback((delay = 140) => {
    window.setTimeout(
      async () => {
        const { data, error } = await supabase
          .from('posts')
          .select('id')
          .neq('status', 'deleted')
          .order('created_at', { ascending: false })
          .limit(8)

        if (error) {
          console.error('새 글 신호 조회 실패', error)
          return
        }

        const latestIds = (data ?? [])
          .map((row: any) => Number(row.id))
          .filter((id: number) => Number.isFinite(id) && id > 0)

        if (latestIds.length === 0) return

        const latestTopId = latestIds[0]
        const previousTopId = latestSeenPostIdRef.current

        if (!previousTopId) {
          latestSeenPostIdRef.current = latestTopId
          return
        }

        if (latestTopId === previousTopId) return

        const cutoffIndex = latestIds.findIndex(
          (id: number) => id == previousTopId,
        )
        const unseenIds =
          cutoffIndex >= 0 ? latestIds.slice(0, cutoffIndex) : latestIds

        if (unseenIds.length === 0) return

        setNewPostNoticeIds(unseenIds)
      },
      Math.max(80, delay),
    )
  }, [])

  const refreshWatchlistSignalsAfterAction = useCallback(
    (delay = 120) => {
      if (!currentActorUnifiedKey) return

      window.setTimeout(() => {
        requestLightweightMetaRefresh({ delay })
        refreshNewPostSignalsAfterAction(delay)
        if (currentRawActorKey) {
          window.setTimeout(
            () => {
              void fetchMyActivity(currentRawActorKey)
            },
            Math.max(80, delay),
          )
        }
      }, 0)
    },
    [
      currentActorUnifiedKey,
      currentRawActorKey,
      fetchMyActivity,
      requestLightweightMetaRefresh,
      refreshNewPostSignalsAfterAction,
    ],
  )

  const refreshPostCommentsAfterAction = useCallback(
    (postIds: Array<number | null | undefined>, delay = 120) => {
      const uniquePostIds = [
        ...new Set(
          postIds
            .map((id) => Number(id))
            .filter((id) => Number.isFinite(id) && id > 0),
        ),
      ]

      if (uniquePostIds.length === 0) return

      window.setTimeout(
        () => {
          void Promise.all(
            uniquePostIds.map((postId) => refreshCommentsForPost(postId)),
          )
        },
        Math.max(60, delay),
      )
    },
    [refreshCommentsForPost],
  )

  const upsertResultUnlock = useCallback(
    async (postId: number, patch: ResultUnlockPatch) => {
      if (!currentActorUnifiedKey || !postId) return null

      const existing = resultUnlockMap[postId] ?? null
      const base: ResultUnlockItem = existing ?? {
        postId,
        voterKey: currentActorUnifiedKey,
        unlockLevel: Number(patch.unlockLevel ?? 1),
        commentReads: 0,
        isWatchlisted: !!myWatchlistMap[postId],
        createdAt: null,
        updatedAt: null,
      }

      const nextUnlockLevel = Math.max(
        Number(base.unlockLevel ?? 1),
        Number(patch.unlockLevel ?? base.unlockLevel ?? 1),
      )
      const nextCommentReads =
        typeof patch.forceCommentReads === 'number'
          ? Math.max(0, patch.forceCommentReads)
          : Math.max(
              0,
              Number(base.commentReads ?? 0) +
                Number(patch.commentReadsDelta ?? 0),
            )

      const nextItem: ResultUnlockItem = {
        ...base,
        unlockLevel: nextUnlockLevel,
        commentReads: nextCommentReads,
        isWatchlisted:
          typeof patch.isWatchlisted === 'boolean'
            ? patch.isWatchlisted
            : base.isWatchlisted,
        updatedAt: new Date().toISOString(),
      }

      if (
        existing &&
        existing.unlockLevel === nextItem.unlockLevel &&
        existing.commentReads === nextItem.commentReads &&
        existing.isWatchlisted === nextItem.isWatchlisted
      ) {
        return existing
      }

      setResultUnlockMap((prev) => ({
        ...prev,
        [postId]: nextItem,
      }))

      if (resultUnlockInFlightRef.current[postId]) {
        resultUnlockQueuedPatchRef.current[postId] = mergeResultUnlockPatch(
          resultUnlockQueuedPatchRef.current[postId],
          patch,
        )
        return nextItem
      }

      resultUnlockInFlightRef.current[postId] = true

      try {
        const { data, error } = await supabase
          .from('post_result_unlocks')
          .upsert(
            {
              post_id: postId,
              voter_key: currentActorUnifiedKey,
              unlock_level: nextItem.unlockLevel,
              comment_reads: nextItem.commentReads,
              is_watchlisted: nextItem.isWatchlisted,
              updated_at: nextItem.updatedAt,
            },
            {
              onConflict: 'post_id,voter_key',
            },
          )
          .select(
            'post_id, voter_key, unlock_level, comment_reads, is_watchlisted, created_at, updated_at',
          )
          .maybeSingle()

        if (error) {
          const lockBroken = /Lock broken|AbortError|timeout/i.test(
            String(error?.message ?? error?.details ?? ''),
          )

          if (!lockBroken) {
            console.error('결과 공개 단계 저장 실패', error)
          }

          return nextItem
        }

        if (data) {
          const savedItem: ResultUnlockItem = {
            postId: Number(data.post_id),
            voterKey: String(data.voter_key ?? currentActorUnifiedKey),
            unlockLevel: Math.max(
              1,
              Number(data.unlock_level ?? nextItem.unlockLevel),
            ),
            commentReads: Number(data.comment_reads ?? nextItem.commentReads),
            isWatchlisted: Boolean(
              data.is_watchlisted ?? nextItem.isWatchlisted,
            ),
            createdAt: data.created_at ?? nextItem.createdAt,
            updatedAt: data.updated_at ?? nextItem.updatedAt,
          }
          setResultUnlockMap((prev) => ({
            ...prev,
            [postId]: savedItem,
          }))
          return savedItem
        }

        return nextItem
      } finally {
        resultUnlockInFlightRef.current[postId] = false

        const queuedPatch = resultUnlockQueuedPatchRef.current[postId]
        if (queuedPatch) {
          delete resultUnlockQueuedPatchRef.current[postId]
          window.setTimeout(
            () => {
              void upsertResultUnlock(postId, queuedPatch)
            },
            isKakaoInAppBrowser() ? 240 : 80,
          )
        }
      }
    },
    [currentActorUnifiedKey, myWatchlistMap, resultUnlockMap],
  )

  useEffect(() => {
    if (!voterKey) return
    void loadProgress()
  }, [voterKey, authUser?.id, loadProgress])

  useEffect(() => {
    return () => {
      if (sharePulseTimerRef.current) {
        clearTimeout(sharePulseTimerRef.current)
      }
      if (discoveryTimerRef.current) {
        clearTimeout(discoveryTimerRef.current)
      }
      if (metaRefreshTimerRef.current) {
        clearTimeout(metaRefreshTimerRef.current)
      }
    }
  }, [])

  const loadShareStatsBySessionId = useCallback(
    async (sessionId: string | null) => {
      if (!sessionId) {
        setShareStats({ left: 0, right: 0 })
        return
      }

      const { data, error } = await supabase
        .from('share_session_stats')
        .select('left_count, right_count')
        .eq('share_session_id', sessionId)
        .maybeSingle()

      if (error) {
        console.error('share stats 조회 실패', error)
        return
      }

      setShareStats({
        left: Number(data?.left_count ?? 0),
        right: Number(data?.right_count ?? 0),
      })
    },
    [],
  )

  const loadShareSession = useCallback(async () => {
    if (!shareId) return

    const { data, error } = await supabase
      .from('share_sessions')
      .select('id, post_id, owner_key, owner_choice')
      .eq('id', shareId)
      .maybeSingle()

    if (error) {
      console.error('share session 조회 실패', error)
      return
    }

    if (data) {
      setShareId(String(data.id))
      setShareOwnerKey(data.owner_key ?? null)
      if (data.post_id) setSharedPostId(Number(data.post_id))
      await loadShareStatsBySessionId(String(data.id))
    }
  }, [shareId, loadShareStatsBySessionId])

  const loadShareStats = useCallback(async () => {
    await loadShareStatsBySessionId(shareId)
  }, [shareId, loadShareStatsBySessionId])

  const syncShareUrl = useCallback((postId: number, id: string) => {
    if (typeof window === 'undefined') return
    const url = new URL(window.location.href)
    url.searchParams.set('post', String(postId))
    url.searchParams.set('share', id)
    window.history.replaceState({}, '', url.toString())
  }, [])

  const clearShareMode = useCallback(() => {
    setShareId(null)
    setSharedPostId(null)
    setShareOwnerKey(null)
    setShareStats({ left: 0, right: 0 })
    setSharedEntryActive(false)
    setShowOwnerShareResults(false)
    setSharePulse(false)
    setOwnerShareDelta(0)
    lastShareTotalRef.current = 0

    if (typeof window === 'undefined') return

    const url = new URL(window.location.href)
    url.searchParams.delete('post')
    url.searchParams.delete('share')
    window.history.replaceState({}, '', url.toString())
  }, [])

  const endSharedEntryMode = useCallback(() => {
    setSharedEntryActive(false)
  }, [])

  const applySeenToShareInbox = useCallback(
    (sessionId: string, totalCount: number) => {
      markShareSessionSeen(sessionId, totalCount)
      setShareInboxItems((prev) =>
        prev.map((item) =>
          item.sessionId === sessionId ? { ...item, unreadCount: 0 } : item,
        ),
      )
      setShareInboxUnreadCount((prev) => Math.max(0, prev - 1))
    },
    [],
  )

  const openShareInbox = useCallback(() => {
    setShareInboxOpen(true)
    void loadOwnerShareInbox()
  }, [loadOwnerShareInbox])

  useEffect(() => {
    if (!voterKey) return

    const refreshShareInboxSignals = () => {
      void loadOwnerShareInbox(true)
    }

    const intervalId = window.setInterval(refreshShareInboxSignals, 4000)
    const visibilityHandler = () => {
      if (document.visibilityState === 'visible') {
        refreshShareInboxSignals()
      }
    }

    window.addEventListener('focus', refreshShareInboxSignals)
    document.addEventListener('visibilitychange', visibilityHandler)

    return () => {
      window.clearInterval(intervalId)
      window.removeEventListener('focus', refreshShareInboxSignals)
      document.removeEventListener('visibilitychange', visibilityHandler)
    }
  }, [voterKey, loadOwnerShareInbox])

  const filteredPosts = useMemo(() => {
    let result =
      selectedCategory === '전체'
        ? posts
        : posts.filter((post) => post.category === selectedCategory)

    if (tab === '인기') {
      result = [...result].sort((a, b) => {
        const scoreA =
          a.leftVotes + a.rightVotes + a.comments.length * 40 + a.views * 0.02
        const scoreB =
          b.leftVotes + b.rightVotes + b.comments.length * 40 + b.views * 0.02
        return scoreB - scoreA
      })
    } else if (tab === '최신') {
      result = [...result].sort((a, b) => b.id - a.id)
    }

    return result
  }, [posts, tab, selectedCategory])

  const openOwnerShareSession = useCallback(
    async (item: ShareInboxItem) => {
      if (!item.postId) return

      setShareId(item.sessionId)
      setShareOwnerKey(voterKey || null)
      setSharedPostId(item.postId)
      setSharedEntryActive(false)
      setShowOwnerShareResults(true)
      syncShareUrl(item.postId, item.sessionId)

      const nextIndexInFiltered = filteredPosts.findIndex(
        (p) => p.id === item.postId,
      )
      if (nextIndexInFiltered >= 0) {
        setCurrentIndex(nextIndexInFiltered)
      } else {
        const fallbackIndex = posts.findIndex((p) => p.id === item.postId)
        if (fallbackIndex >= 0) {
          setTab('추천')
          setSelectedCategory('전체')
          setCurrentIndex(fallbackIndex)
        }
      }

      await loadShareStatsBySessionId(item.sessionId)
      applySeenToShareInbox(item.sessionId, item.totalCount)
      setShareInboxOpen(false)
    },
    [
      voterKey,
      syncShareUrl,
      filteredPosts,
      posts,
      loadShareStatsBySessionId,
      applySeenToShareInbox,
    ],
  )

  const reshareFromInbox = useCallback(
    async (item: ShareInboxItem) => {
      if (typeof window === 'undefined') return

      const shareUrl = `${window.location.origin}${window.location.pathname}?post=${item.postId}&share=${item.sessionId}`
      const shareText = `이거 맞냐?
${item.title}

너라면 뭐 선택함?`

      void loadOwnerShareInbox(true)

      try {
        if (navigator.share) {
          await navigator.share({
            title: item.title,
            text: shareText,
            url: shareUrl,
          })
        } else if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(`${shareText}
${shareUrl}`)
          showToast('공유 링크 복사 완료')
        } else {
          window.prompt('아래 링크를 복사해서 공유해줘', shareUrl)
        }
      } catch (error) {
        console.error('공유 실패', error)
      }
    },
    [showToast],
  )

  useEffect(() => {
    if (shareId) void loadShareSession()
  }, [shareId, loadShareSession])

  useEffect(() => {
    if (shareId) void loadShareStats()
  }, [shareId, loadShareStats])

  useEffect(() => {
    if (!voterKey) return
    void loadOwnerShareInbox(true)
  }, [voterKey, loadOwnerShareInbox])

  useEffect(() => {
    if (!shareInboxOpen || !voterKey) return

    const interval = window.setInterval(() => {
      void loadOwnerShareInbox(true)
    }, 5000)

    return () => window.clearInterval(interval)
  }, [shareInboxOpen, voterKey, loadOwnerShareInbox])

  useEffect(() => {
    if (currentIndex > 0 && currentIndex >= filteredPosts.length) {
      setCurrentIndex(Math.max(filteredPosts.length - 1, 0))
    }
  }, [filteredPosts.length, currentIndex])

  const currentPost: PostItem | null =
    filteredPosts[currentIndex] ?? filteredPosts[0] ?? null

  useEffect(() => {
    setOutcomeModalOpen(false)
  }, [currentPost?.id])

  const isViewingSharedPost =
    !!shareId &&
    !!sharedPostId &&
    !!currentPost &&
    Number(currentPost.id) === Number(sharedPostId)

  const isSharedVisitor =
    isViewingSharedPost &&
    !!shareOwnerKey &&
    !!voterKey &&
    String(shareOwnerKey) !== String(voterKey)

  const isSharedOwnerViewingPost =
    isViewingSharedPost &&
    !!shareOwnerKey &&
    !!voterKey &&
    String(shareOwnerKey) === String(voterKey)

  const shareResponseTotal = shareStats.left + shareStats.right
  const shareTensionMeta = getShareTensionMeta(
    shareStats.left,
    shareStats.right,
  )
  const ownerChoiceInsight = getOwnerChoiceInsight(
    votes[currentPost?.id ?? 0] ?? null,
    shareStats.left,
    shareStats.right,
    currentPost?.leftLabel,
    currentPost?.rightLabel,
  )
  const currentHotMeta = hotScoreMap[currentPost?.id ?? 0] ?? null
  const currentTurningPoint = turningPointMap[currentPost?.id ?? 0] ?? null
  const currentHotBadge = getHotBadge(currentHotMeta)
  const currentTurningPointLabel = getTurningPointLabel(
    currentTurningPoint?.eventLabel,
  )
  const currentVoteSide = votes[currentPost?.id ?? 0] ?? null
  const currentMinorityLabel = getMinorityLabel(currentVoteSide, currentPost)
  const currentResultEmotion = currentPost
    ? getResultEmotion(currentPost.leftVotes, currentPost.rightVotes)
    : null
  const currentOutcomeItems = currentPost
    ? (postOutcomeMap[currentPost.id] ?? [])
    : []
  const latestOutcome = currentOutcomeItems[0] ?? null
  const currentFlipEvent = currentPost
    ? (postFlipMap[currentPost.id] ?? null)
    : null
  const currentFlipDrama = getFlipDramaLabel(currentFlipEvent)
  const currentShadowWatch = currentPost
    ? (shadowWatchMap[currentPost.id] ?? null)
    : null
  const currentShadowDrama = getShadowWatchLabel(currentShadowWatch)
  const currentTension = currentPost
    ? (postTensionMap[currentPost.id] ?? null)
    : null
  const currentTensionMeta = getTensionMeta(currentTension)
  const currentPreVoteSignalTitle = currentPost
    ? getPreVoteSignalTitle(
        currentPost.leftVotes + currentPost.rightVotes,
        currentPost.comments.length,
        currentTension,
      )
    : '지금 반응이 쌓이는 중'
  const currentPreVoteSignalHelper = currentPost
    ? getPreVoteSignalHelper(
        currentPost.leftVotes + currentPost.rightVotes,
        currentPost.comments.length,
        currentTension,
      )
    : '선택하면 분위기 공개'
  const isOwnCurrentPost =
    !!currentActorKey &&
    !!currentPost?.authorKey &&
    String(currentPost.authorKey) === String(currentActorKey)
  const shouldRenderKakaoHeavyBlocks = true
  const currentWatchlisted = !!(currentPost && myWatchlistMap[currentPost.id])
  const unreadWatchlistCount = watchlistItems.filter(
    (item) => item.unreadOutcome,
  ).length
  const unreadMyPostsTopCount = myPosts.filter(
    (item) => Number(item.newCommentsCount ?? 0) > 0,
  ).length
  const unreadMyCommentsTopCount = myComments.filter(
    (item) => Number(item.newRepliesCount ?? 0) > 0,
  ).length
  const unreadActivityBadgeCount =
    unreadWatchlistCount + unreadMyPostsTopCount + unreadMyCommentsTopCount
  const newPostNoticeCount = newPostNoticeIds.length
  const currentWatchUnread =
    !!currentPost &&
    (watchlistItems.find((item) => item.postId === currentPost.id)
      ?.unreadOutcome ??
      false)
  const currentResultUnlock =
    currentPost && votes[currentPost.id]
      ? (resultUnlockMap[currentPost.id] ?? null)
      : null
  const currentResultUnlockLevel =
    currentPost && votes[currentPost.id]
      ? Math.max(1, currentResultUnlock?.unlockLevel ?? 1)
      : 0
  const currentResultReveal = currentPost
    ? getResultRevealStage(
        currentResultUnlockLevel,
        currentPost.leftVotes,
        currentPost.rightVotes,
        !!latestOutcome,
      )
    : null
  const canAdminWriteOutcome = isAdmin && adminMode
  const canWriteOutcome =
    (!!currentPost?.authorKey &&
      !!currentActorKey &&
      String(currentPost.authorKey) === String(currentActorKey)) ||
    canAdminWriteOutcome
  const outcomeActionLabel = canAdminWriteOutcome
    ? '관리자 후기 등록'
    : '작성자 후기 남기기'
  const currentPostReactionSummary =
    (currentPost ? postReactionSummaryMap[currentPost.id] : null) ??
    EMPTY_POST_REACTION_SUMMARY
  const currentVoteStreak = streakMap.consecutive_votes ?? null
  const currentChoicePathTop =
    currentPost && currentVoteSide
      ? (choicePathTopMap[`${currentPost.id}:${currentVoteSide}`] ?? null)
      : null
  const queuedNextPost = useMemo(() => {
    if (!currentPost) return null
    const queue = nextQueueMap[currentPost.id] ?? []
    if (queue.length === 0) return null
    const target = queue
      .map((item) => ({
        item,
        post: posts.find((post) => post.id === item.toPostId) ?? null,
      }))
      .find((entry) => !!entry.post && !entry.post.hidden)
    return target ?? null
  }, [currentPost, nextQueueMap, posts])

  const choicePathNextPost = useMemo(() => {
    if (!currentChoicePathTop) return null
    return (
      posts.find(
        (post) => post.id === currentChoicePathTop.toPostId && !post.hidden,
      ) ?? null
    )
  }, [currentChoicePathTop, posts])

  const nextRecommendationReason = choicePathNextPost
    ? '너처럼 고른 사람들 다음 판'
    : queuedNextPost
      ? getNextReasonLabel(queuedNextPost.item.reasonType)
      : '다음 맞냐'

  const nextRecommendationTitle =
    choicePathNextPost?.title ||
    queuedNextPost?.post?.title ||
    filteredPosts[Math.min(currentIndex + 1, filteredPosts.length - 1)]
      ?.title ||
    '다음 글 보기'

  const nextRecommendationHelper = choicePathNextPost
    ? `${currentChoicePathTop?.count ?? 0}번 이어서 눌린 흐름임`
    : '지금 가장 오래 보게 만들 다음 판으로 이동'

  const currentTotalVotes = currentPost
    ? Number(currentPost.leftVotes ?? 0) + Number(currentPost.rightVotes ?? 0)
    : 0
  const currentCommentCount = currentPost?.comments.length ?? 0
  const currentWinnerLabel = currentPost
    ? currentPost.leftVotes === currentPost.rightVotes
      ? '아직 반반'
      : currentPost.leftVotes > currentPost.rightVotes
        ? currentPost.leftLabel
        : currentPost.rightLabel
    : '결과 대기'
  const dopamineCommentArena = useMemo(() => {
    if (!currentPost) {
      return {
        topComment: null as CommentItem | null,
        rebuttalComment: null as CommentItem | null,
        topCommentScore: 0,
        rebuttalScore: 0,
        rebuttalReplyCount: 0,
        rebuttalReactionCount: 0,
      }
    }

    const visibleComments = [...currentPost.comments].filter(
      (comment) => !comment.hidden && comment.text.trim().length > 0,
    )

    const replyCountByCommentId = visibleComments.reduce<
      Record<number, number>
    >((acc, comment) => {
      const parentId = Number(comment.replyToCommentId ?? 0)
      if (parentId > 0) {
        acc[parentId] = Number(acc[parentId] ?? 0) + 1
      }
      return acc
    }, {})

    const getCommentArenaScore = (comment: CommentItem) => {
      const summary =
        commentReactionMap[comment.id] ?? EMPTY_COMMENT_REACTION_SUMMARY

      const supportiveTotal =
        Number(comment.likes ?? 0) +
        Number(summary.relatable ?? 0) +
        Number(summary.agree ?? 0) +
        Number(summary.wow ?? 0)

      const rebuttalReactionTotal =
        Number(summary.disagree ?? 0) + Number(summary.absurd ?? 0)

      const directReplyCount = Number(replyCountByCommentId[comment.id] ?? 0)
      const totalReaction = supportiveTotal + rebuttalReactionTotal

      return {
        supportiveTotal,
        rebuttalReactionTotal,
        directReplyCount,
        total: totalReaction + directReplyCount,
        // 베스트 반박은 "가장 뜨거운 댓글에 달린 대댓글"이 아니라
        // 실제로 반박 반응이 많이 꽂혔거나, 반박 대댓글이 많이 달린 댓글이다.
        rebuttalScore:
          rebuttalReactionTotal * 10 + directReplyCount * 4 + totalReaction,
      }
    }

    const sortByHotScore = (a: CommentItem, b: CommentItem) => {
      const aScore = getCommentArenaScore(a)
      const bScore = getCommentArenaScore(b)

      if (bScore.supportiveTotal !== aScore.supportiveTotal) {
        return bScore.supportiveTotal - aScore.supportiveTotal
      }

      if (bScore.total !== aScore.total) {
        return bScore.total - aScore.total
      }

      return b.id - a.id
    }

    const sortByRebuttalScore = (a: CommentItem, b: CommentItem) => {
      const aScore = getCommentArenaScore(a)
      const bScore = getCommentArenaScore(b)

      if (bScore.rebuttalScore !== aScore.rebuttalScore) {
        return bScore.rebuttalScore - aScore.rebuttalScore
      }

      if (bScore.rebuttalReactionTotal !== aScore.rebuttalReactionTotal) {
        return bScore.rebuttalReactionTotal - aScore.rebuttalReactionTotal
      }

      if (bScore.directReplyCount !== aScore.directReplyCount) {
        return bScore.directReplyCount - aScore.directReplyCount
      }

      return b.id - a.id
    }

    const topComment = [...visibleComments].sort(sortByHotScore)[0] ?? null

    const rebuttalComment =
      [...visibleComments]
        .filter((comment) => {
          const score = getCommentArenaScore(comment)
          return score.rebuttalReactionTotal > 0 || score.directReplyCount > 0
        })
        .sort(sortByRebuttalScore)[0] ?? null

    const rebuttalMeta = rebuttalComment
      ? getCommentArenaScore(rebuttalComment)
      : null

    return {
      topComment,
      rebuttalComment,
      topCommentScore: topComment
        ? getCommentArenaScore(topComment).supportiveTotal
        : 0,
      rebuttalScore: rebuttalMeta?.rebuttalScore ?? 0,
      rebuttalReplyCount: rebuttalMeta?.directReplyCount ?? 0,
      rebuttalReactionCount: rebuttalMeta?.rebuttalReactionTotal ?? 0,
    }
  }, [currentPost, commentReactionMap])
  const dopamineTopComment = dopamineCommentArena.topComment
  const dopamineCounterComment = dopamineCommentArena.rebuttalComment
  const dopamineTopCommentScore = dopamineCommentArena.topCommentScore
  const dopamineCounterCommentScore = dopamineCommentArena.rebuttalScore
  const dopamineCounterReactionCount =
    dopamineCommentArena.rebuttalReactionCount
  const dopamineCounterReplyCount = dopamineCommentArena.rebuttalReplyCount
  const dopamineLiveEvents = useMemo(() => {
    if (!currentPost) return [] as string[]
    const events: string[] = []
    if (currentTension?.isFlipImminent) events.push('⚡ 한 표면 뒤집힘')
    if (currentMinorityLabel) events.push(`${currentMinorityLabel.text} 감지`)
    if (currentCommentCount > 0) events.push('💬 댓글 구경 시작')
    if (currentWatchlisted) events.push('👀 결말 저장됨')
    if (latestOutcome) events.push('🔥 후기 떴다')
    if (events.length === 0) events.push('🔥 첫 판단 대기중')
    return events.slice(0, 3)
  }, [
    currentPost,
    currentTension?.isFlipImminent,
    currentMinorityLabel,
    currentCommentCount,
    currentWatchlisted,
    latestOutcome,
  ])
  const dopamineResultTitle = currentMinorityLabel
    ? currentMinorityLabel.text
    : currentResultEmotion === '🔥 개싸움'
      ? '🔥 완전 갈리는 중'
      : currentResultEmotion === '👀 팽팽'
        ? '👀 아직 안 끝난 판'
        : currentResultEmotion === '⚡ 기우는 중'
          ? '⚡ 흐름 기우는 중'
          : votes[currentPost?.id ?? 0]
            ? `지금은 ${currentWinnerLabel} 우세`
            : '선택하면 결과 열림'
  const dopamineResultHelper = votes[currentPost?.id ?? 0]
    ? (currentMinorityLabel?.helper ?? currentTensionMeta.helper)
    : '먼저 고르면 사람들 생각이 바로 열림'

  useEffect(() => {
    if (!currentPost?.id || !votes[currentPost.id] || !currentActorUnifiedKey)
      return
    if (!currentWatchlisted) return

    const signature = `${currentActorUnifiedKey}:${currentPost.id}:watch:${Number(currentWatchlisted)}`
    if (autoUnlockSignatureRef.current.watch === signature) return
    autoUnlockSignatureRef.current.watch = signature

    void upsertResultUnlock(currentPost.id, {
      unlockLevel: 3,
      isWatchlisted: true,
    })
  }, [
    currentActorUnifiedKey,
    currentPost?.id,
    currentWatchlisted,
    votes,
    upsertResultUnlock,
  ])

  useEffect(() => {
    if (!currentPost?.id || !votes[currentPost.id] || !currentActorUnifiedKey)
      return
    if (!latestOutcome) return

    const signature = `${currentActorUnifiedKey}:${currentPost.id}:outcome:${latestOutcome.id}`
    if (autoUnlockSignatureRef.current.outcome === signature) return
    autoUnlockSignatureRef.current.outcome = signature

    void upsertResultUnlock(currentPost.id, {
      unlockLevel: 4,
    })
  }, [
    currentActorUnifiedKey,
    currentPost?.id,
    latestOutcome?.id,
    votes,
    upsertResultUnlock,
  ])

  const nextHookPost = useMemo(() => {
    if (!currentPost) return null

    const sameCategory = filteredPosts.filter(
      (post) =>
        post.id !== currentPost.id &&
        post.category === currentPost.category &&
        !post.hidden,
    )

    const pool =
      sameCategory.length > 0
        ? sameCategory
        : filteredPosts.filter(
            (post) => post.id !== currentPost.id && !post.hidden,
          )

    return (
      [...pool].sort((a, b) => {
        const scoreA =
          a.comments.length * 2 +
          a.leftVotes +
          a.rightVotes +
          Math.min(Math.abs(a.leftVotes - a.rightVotes), 12)
        const scoreB =
          b.comments.length * 2 +
          b.leftVotes +
          b.rightVotes +
          Math.min(Math.abs(b.leftVotes - b.rightVotes), 12)
        return scoreB - scoreA
      })[0] ?? null
    )
  }, [currentPost, filteredPosts])

  useEffect(() => {
    if (!isViewingSharedPost) return
    void loadShareStats()
  }, [isViewingSharedPost, loadShareStats])

  useEffect(() => {
    if (
      !isSharedVisitor ||
      !shareId ||
      !currentPost?.id ||
      typeof window === 'undefined'
    )
      return

    const key = `matnya_share_open_${shareId}_${currentPost.id}_${voterKey}`
    if (window.sessionStorage.getItem(key)) return
    window.sessionStorage.setItem(key, '1')
    void logPostEvent({
      postId: currentPost.id,
      eventType: 'share_open',
      sessionId: shareId,
    })
  }, [isSharedVisitor, shareId, currentPost?.id, voterKey, logPostEvent])

  useEffect(() => {
    if (!isSharedOwnerViewingPost || !shareId) return

    const interval = window.setInterval(() => {
      void loadShareStatsBySessionId(shareId)
    }, 4000)

    return () => window.clearInterval(interval)
  }, [isSharedOwnerViewingPost, shareId, loadShareStatsBySessionId])

  useEffect(() => {
    if (!isSharedOwnerViewingPost) {
      lastShareTotalRef.current = shareResponseTotal
      setOwnerShareDelta(0)
      return
    }

    const previousTotal = lastShareTotalRef.current

    if (shareResponseTotal > previousTotal) {
      const diff = shareResponseTotal - previousTotal
      showToast(diff > 1 ? `친구 응답 ${diff}개 도착` : '친구가 응답했어요')
      setOwnerShareDelta(diff)
      setSharePulse(true)
      setShowOwnerShareResults(false)
      void loadOwnerShareInbox(true)
      if (sharePulseTimerRef.current) {
        clearTimeout(sharePulseTimerRef.current)
      }
      sharePulseTimerRef.current = setTimeout(() => {
        setSharePulse(false)
        setOwnerShareDelta(0)
      }, 1800)
    }

    lastShareTotalRef.current = shareResponseTotal
  }, [
    isSharedOwnerViewingPost,
    shareResponseTotal,
    showToast,
    loadOwnerShareInbox,
  ])

  useEffect(() => {
    if (!currentPost) {
      setRevisitMeta(null)
      return
    }

    const savedSignal = readStoredPostSignal(currentPost.id)
    const isOwnPost =
      !!currentActorKey &&
      !!currentPost.authorKey &&
      String(currentPost.authorKey) === String(currentActorKey)

    if (!savedSignal?.meaningful || isOwnPost) {
      setRevisitMeta(null)
      return
    }

    const currentVotesTotal = currentPost.leftVotes + currentPost.rightVotes
    const commentsDiff = Math.max(
      0,
      currentPost.comments.length - Number(savedSignal.commentsCount ?? 0),
    )
    const votesDiff = Math.max(
      0,
      currentVotesTotal - Number(savedSignal.votesTotal ?? 0),
    )

    if (commentsDiff > 0) {
      setRevisitMeta({ label: `봤던 글 · 댓글 +${commentsDiff}` })
      return
    }

    if (votesDiff > 0) {
      setRevisitMeta({ label: `봤던 글 · 참여 +${votesDiff}` })
      return
    }

    setRevisitMeta({ label: '다시 보는 글' })
  }, [currentPost, currentActorKey])

  useEffect(() => {
    if (!sharedEntryActive || !sharedPostId || posts.length === 0) return

    const filteredIndex = filteredPosts.findIndex(
      (post) => post.id === sharedPostId,
    )
    if (filteredIndex >= 0) {
      setCurrentIndex(filteredIndex)
      return
    }

    const allIndex = posts.findIndex((post) => post.id === sharedPostId)
    if (allIndex >= 0) {
      setTab('추천')
      setSelectedCategory('전체')
      setCurrentIndex(allIndex)
    }
  }, [sharedEntryActive, sharedPostId, posts, filteredPosts])

  const createShareSession = useCallback(
    async (choice: VoteSide) => {
      if (!currentPost || !voterKey) return null

      const { data, error } = await supabase
        .from('share_sessions')
        .insert({
          post_id: currentPost.id,
          owner_key: voterKey,
          owner_choice: choice,
        })
        .select('id, post_id, owner_key')
        .single()

      if (error || !data?.id) {
        console.error('share session 생성 실패', error)
        return null
      }

      const nextShareId = String(data.id)
      setShareId(nextShareId)
      setShareOwnerKey(String(data.owner_key ?? voterKey))
      setSharedPostId(Number(data.post_id ?? currentPost.id))
      syncShareUrl(currentPost.id, nextShareId)
      upsertLocalShareInboxItem({
        sessionId: nextShareId,
        postId: Number(data.post_id ?? currentPost.id),
        title: currentPost.title,
        ownerChoice: choice,
        createdAt: new Date().toISOString(),
        leftLabel: currentPost.leftLabel,
        rightLabel: currentPost.rightLabel,
        totalCount: 0,
        leftCount: 0,
        rightCount: 0,
        overallLeftCount: currentPost.leftVotes,
        overallRightCount: currentPost.rightVotes,
      })
      await loadShareStatsBySessionId(nextShareId)
      await logPostEvent({
        postId: currentPost.id,
        eventType: 'share_create',
        side: choice,
        sessionId: nextShareId,
      })
      scheduleDiscoveryRefresh()
      return nextShareId
    },
    [
      currentPost,
      voterKey,
      syncShareUrl,
      upsertLocalShareInboxItem,
      loadShareStatsBySessionId,
      logPostEvent,
      scheduleDiscoveryRefresh,
    ],
  )

  const saveShareResponse = useCallback(
    async (sessionId: string, responderKey: string, choice: VoteSide) => {
      const normalizedSessionId = String(sessionId || '').trim()
      const normalizedResponderKey = String(responderKey || '').trim()

      if (!normalizedSessionId) {
        console.error('share response 저장 중 share_session_id 없음', {
          sessionId,
          responderKey,
          choice,
        })
        showToast('공유 세션이 없음')
        return false
      }

      if (!normalizedResponderKey) {
        console.error('share response 저장 중 responder_key 없음', {
          sessionId,
          responderKey,
          choice,
        })
        showToast('응답자 키가 없음')
        return false
      }

      const payload = {
        share_session_id: normalizedSessionId,
        responder_key: normalizedResponderKey,
        choice,
        created_at: new Date().toISOString(),
      }

      console.log('share response upsert 직전', payload)

      const { data, error } = await supabase
        .from('share_responses')
        .upsert(payload, {
          onConflict: 'share_session_id,responder_key',
        })
        .select('id, share_session_id, responder_key, choice')
        .single()

      if (error) {
        console.error('share response upsert 실패', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code,
          payload,
        })
        showToast('응답 저장 실패')
        return false
      }

      console.log('share response upsert 성공', data)
      return true
    },
    [showToast],
  )

  const shareCurrentPost = useCallback(async () => {
    if (!currentPost) return
    if (typeof window === 'undefined') return

    const currentChoice = votes[currentPost.id]
    if (!currentChoice) {
      showToast('먼저 선택해야 공유할 수 있음')
      return
    }

    const shouldCreateNewShare =
      !shareId ||
      !sharedPostId ||
      Number(sharedPostId) !== Number(currentPost.id)

    let activeShareId = shareId

    if (shouldCreateNewShare) {
      activeShareId = await createShareSession(currentChoice)
      if (!activeShareId) {
        showToast('공유 링크 생성 실패')
        return
      }
      setSharedEntryActive(false)
      lastShareTotalRef.current = 0
    } else if (activeShareId) {
      await loadShareStatsBySessionId(activeShareId)
      syncShareUrl(currentPost.id, activeShareId)
      upsertLocalShareInboxItem({
        sessionId: activeShareId,
        postId: currentPost.id,
        title: currentPost.title,
        ownerChoice: currentChoice,
        createdAt: new Date().toISOString(),
        leftLabel: currentPost.leftLabel,
        rightLabel: currentPost.rightLabel,
        totalCount: shareStats.left + shareStats.right,
        leftCount: shareStats.left,
        rightCount: shareStats.right,
        overallLeftCount: currentPost.leftVotes,
        overallRightCount: currentPost.rightVotes,
      })
    }

    if (!activeShareId) {
      showToast('공유 링크 생성 실패')
      return
    }

    setShareId(activeShareId)
    setShareOwnerKey(voterKey || null)
    setSharedPostId(currentPost.id)
    setSharedEntryActive(false)
    setShowOwnerShareResults(false)
    upsertLocalShareInboxItem({
      sessionId: activeShareId,
      postId: currentPost.id,
      title: currentPost.title,
      ownerChoice: currentChoice,
      createdAt: new Date().toISOString(),
      leftLabel: currentPost.leftLabel,
      rightLabel: currentPost.rightLabel,
      totalCount: shouldCreateNewShare ? 0 : shareStats.left + shareStats.right,
      leftCount: shouldCreateNewShare ? 0 : shareStats.left,
      rightCount: shouldCreateNewShare ? 0 : shareStats.right,
      overallLeftCount: currentPost.leftVotes,
      overallRightCount: currentPost.rightVotes,
    })
    void loadOwnerShareInbox(true)
    showToast('보낸 공유함에 저장됨 · 친구 답변 오면 빨간불로 알려줌')

    const shareUrl = `${window.location.origin}${window.location.pathname}?post=${currentPost.id}&share=${activeShareId}`
    const shareText = `이거 맞냐?
${currentPost.title}

너라면 뭐 선택함?`

    try {
      if (navigator.share) {
        await navigator.share({
          title: currentPost.title,
          text: shareText,
          url: shareUrl,
        })
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(`${shareText}
${shareUrl}`)
        showToast('공유 링크 복사 완료')
      } else {
        window.prompt('아래 링크를 복사해서 공유해줘', shareUrl)
      }
    } catch (error) {
      console.error('공유 실패', error)
    } finally {
      void loadOwnerShareInbox(true)
    }
  }, [
    currentPost,
    shareId,
    sharedPostId,
    shareStats.left,
    shareStats.right,
    votes,
    voterKey,
    createShareSession,
    loadShareStatsBySessionId,
    loadOwnerShareInbox,
    syncShareUrl,
    upsertLocalShareInboxItem,
    showToast,
  ])

  const controversialPosts = useMemo(() => {
    if (!currentPost) return []
    return [...posts]
      .filter((post) => post.id !== currentPost.id)
      .map((post) => {
        const total = post.leftVotes + post.rightVotes
        const diff = Math.abs(post.leftVotes - post.rightVotes)
        return {
          ...post,
          total,
          controversyScore: total > 0 ? diff / total : 1,
        }
      })
      .sort((a, b) => a.controversyScore - b.controversyScore)
      .slice(0, 3)
  }, [posts, currentPost])

  const discoveryTopPosts = useMemo(
    () => hotNowPosts.filter((post) => post.id !== currentPost?.id).slice(0, 3),
    [hotNowPosts, currentPost?.id],
  )

  const [liveTickerIndex, setLiveTickerIndex] = useState(0)

  const liveTickerItems = useMemo(() => {
    const sourcePosts = [...posts]
      .filter((post) => !post.hidden)
      .map((item) => {
        const hotMeta = hotScoreMap[item.id]
        const turningMeta = turningPointMap[item.id]
        const tension = postTensionMap[item.id]
        const fallbackTension = buildPostTensionState(
          item.id,
          item.leftVotes,
          item.rightVotes,
        )
        const effectiveTension = tension ?? fallbackTension
        const tensionMeta = getTensionMeta(effectiveTension)
        const totalVotes =
          Number(item.leftVotes ?? 0) + Number(item.rightVotes ?? 0)
        const commentCount = Number(item.comments?.length ?? 0)
        const commentBurst = Number(hotMeta?.comment1h ?? 0)
        const voteBurst = Number(hotMeta?.vote1h ?? 0)
        const shareBurst = Number(hotMeta?.share24h ?? 0)
        const viewBurst = Number(hotMeta?.view1h ?? 0)
        const turningLabel = getTurningPointLabel(turningMeta?.eventLabel)
        const hotBadgeLabel = getHotBadge(hotMeta)?.label
        const isBrawl =
          effectiveTension.tensionType === 'brawl' ||
          effectiveTension.tensionType === 'tight' ||
          effectiveTension.isFlipImminent

        const emotionLabel =
          turningLabel ??
          (effectiveTension.isFlipImminent ? tensionMeta.label : null) ??
          (isBrawl ? tensionMeta.label : null) ??
          hotBadgeLabel ??
          (commentCount >= 5 ? '💬 댓글 붙는 중' : null) ??
          '👀 반응 붙는 중'

        const liveBadgeLabel =
          turningLabel != null
            ? '방금 뒤집힘'
            : effectiveTension.isFlipImminent
              ? '역전 임박'
              : effectiveTension.tensionType === 'brawl'
                ? '개싸움'
                : commentBurst >= 8 || commentCount >= 8
                  ? '댓글 폭발'
                  : shareBurst >= 3
                    ? '퍼지는 중'
                    : voteBurst >= 8 || totalVotes >= 20
                      ? '지금 뜨는 판'
                      : '실시간 논쟁'

        const shortMetric =
          turningLabel != null
            ? '방금 판이 흔들렸음'
            : effectiveTension.isFlipImminent
              ? '한 표만 더 오면 뒤집힐 수 있음'
              : effectiveTension.tensionType === 'brawl'
                ? '의견이 거의 반반으로 갈리는 중'
                : commentBurst >= 8 || commentCount >= 8
                  ? '댓글 싸움이 붙는 중'
                  : shareBurst >= 3
                    ? '친구 공유로 번지는 중'
                    : viewBurst >= 20
                      ? '사람들이 계속 보는 중'
                      : '선택하면 분위기가 바로 공개됨'

        const score =
          Number(hotMeta?.score ?? 0) +
          commentBurst * 9 +
          voteBurst * 5 +
          shareBurst * 7 +
          viewBurst * 2 +
          commentCount * 3 +
          totalVotes * 1.2 +
          (turningLabel ? 120 : 0) +
          (effectiveTension.isFlipImminent ? 100 : 0) +
          (effectiveTension.tensionType === 'brawl' ? 80 : 0) +
          (effectiveTension.tensionType === 'tight' ? 50 : 0)

        return {
          id: item.id,
          title: item.title,
          category: item.category,
          shortMetric,
          emotionLabel,
          liveBadgeLabel,
          score,
          signalType:
            turningLabel != null
              ? 'flip'
              : effectiveTension.isFlipImminent
                ? 'imminent'
                : effectiveTension.tensionType === 'brawl'
                  ? 'brawl'
                  : commentBurst >= 8 || commentCount >= 8
                    ? 'comment'
                    : 'hot',
        }
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 10)

    return sourcePosts.map((item, index) => ({
      ...item,
      rank: index + 1,
      rankToneClass:
        index === 0
          ? 'text-rose-600'
          : index === 1
            ? 'text-violet-600'
            : 'text-sky-600',
    }))
  }, [hotScoreMap, postTensionMap, posts, turningPointMap])

  const liveOperationStats = useMemo(() => {
    const topItems = liveTickerItems.slice(0, 10)
    return {
      hot: topItems.filter((item) => item.signalType === 'hot').length,
      flip: topItems.filter(
        (item) => item.signalType === 'flip' || item.signalType === 'imminent',
      ).length,
      brawl: topItems.filter((item) => item.signalType === 'brawl').length,
      comment: topItems.filter((item) => item.signalType === 'comment').length,
    }
  }, [liveTickerItems])

  useEffect(() => {
    if (liveTickerItems.length <= 1) return

    const timer = window.setInterval(() => {
      setLiveTickerIndex((prev) => (prev + 1) % liveTickerItems.length)
    }, 3200)

    return () => window.clearInterval(timer)
  }, [liveTickerItems])

  useEffect(() => {
    if (liveTickerIndex >= liveTickerItems.length) {
      setLiveTickerIndex(0)
    }
  }, [liveTickerIndex, liveTickerItems.length])

  const activeLiveTickerItem =
    liveTickerItems[liveTickerIndex] ?? liveTickerItems[0] ?? null

  const handleLiveTickerOpen = () => {
    if (!activeLiveTickerItem) return
    requestCurrentPostFocus()
    moveToPostWithGuard(activeLiveTickerItem.id)
  }

  useEffect(() => {
    if (!currentPost?.id) return

    const viewedKey = `viewed_post_${currentPost.id}`
    const alreadyViewed =
      typeof window !== 'undefined' ? sessionStorage.getItem(viewedKey) : '1'

    if (alreadyViewed) return

    const increaseView = async () => {
      const nextViews = (currentPost.views ?? 0) + 1

      setPosts((prev) =>
        prev.map((p) =>
          p.id === currentPost.id ? { ...p, views: nextViews } : p,
        ),
      )

      const { error } = await supabase
        .from('posts')
        .update({ views: nextViews })
        .eq('id', currentPost.id)

      if (error) {
        console.error('조회수 증가 실패', error)
      } else if (typeof window !== 'undefined') {
        sessionStorage.setItem(viewedKey, '1')
      }
    }

    void increaseView()
    void logPostEvent({
      postId: currentPost.id,
      eventType: 'view',
    })
    scheduleDiscoveryRefresh(postsRef.current)
  }, [currentPost?.id, logPostEvent, scheduleDiscoveryRefresh])

  useEffect(() => {
    if (!currentPost?.id || !currentActorUnifiedKey) return

    if (shadowViewTimerRef.current) {
      clearTimeout(shadowViewTimerRef.current)
    }

    shadowViewTimerRef.current = setTimeout(() => {
      const postId = currentPost.id

      setShadowWatchMap((prev) => {
        const existing = prev[postId]
        const nextCount = Number(existing?.viewCount ?? 0) + 1
        return {
          ...prev,
          [postId]: {
            postId,
            viewCount: nextCount,
            isAutoSaved: nextCount >= 3 || Boolean(existing?.isAutoSaved),
            firstSeenAt: existing?.firstSeenAt ?? new Date().toISOString(),
            lastSeenAt: new Date().toISOString(),
          },
        }
      })

      void supabase.rpc('record_shadow_view', {
        p_actor_key: currentActorUnifiedKey,
        p_post_id: postId,
      })
    }, 1600)

    return () => {
      if (shadowViewTimerRef.current) {
        clearTimeout(shadowViewTimerRef.current)
      }
    }
  }, [currentActorUnifiedKey, currentPost?.id])

  const handleVote = async (choice: VoteSide) => {
    if (!currentPost || !voterKey) return
    if (voteLockRef.current || isVoting) return

    const currentPostId = currentPost.id
    const prevPosts = postsRef.current
    const prevVotesMap = votes
    const prevChoice = prevVotesMap[currentPostId]

    if (prevChoice === choice) {
      showToast('이미 이쪽으로 선택한 글임')
      return
    }

    const latestPost = prevPosts.find((post) => post.id === currentPostId)
    if (!latestPost) return

    voteLockRef.current = true
    setIsVoting(true)

    const safeLeft = Math.max(0, Number(latestPost.leftVotes ?? 0))
    const safeRight = Math.max(0, Number(latestPost.rightVotes ?? 0))

    const nextLeft = Math.max(
      0,
      safeLeft + (prevChoice === 'left' ? -1 : 0) + (choice === 'left' ? 1 : 0),
    )

    const nextRight = Math.max(
      0,
      safeRight +
        (prevChoice === 'right' ? -1 : 0) +
        (choice === 'right' ? 1 : 0),
    )

    const optimisticPosts = prevPosts.map((post) =>
      post.id === currentPostId
        ? {
            ...post,
            leftVotes: nextLeft,
            rightVotes: nextRight,
          }
        : post,
    )
    const optimisticTension = buildPostTensionState(
      currentPostId,
      nextLeft,
      nextRight,
    )

    postsRef.current = optimisticPosts
    setPosts(optimisticPosts)
    setVotes((prev) => ({ ...prev, [currentPostId]: choice }))
    setPostTensionMap((prev) => ({
      ...prev,
      [currentPostId]: {
        ...optimisticTension,
        updatedAt: new Date().toISOString(),
      },
    }))

    try {
      const { error: voteError } = await supabase.from('votes').upsert(
        {
          post_id: currentPostId,
          voter_key: voterKey,
          side: choice,
        },
        { onConflict: 'post_id,voter_key' },
      )

      if (voteError) {
        throw voteError
      }

      const [leftCountResult, rightCountResult] = await Promise.all([
        supabase
          .from('votes')
          .select('*', { count: 'exact', head: true })
          .eq('post_id', currentPostId)
          .eq('side', 'left'),
        supabase
          .from('votes')
          .select('*', { count: 'exact', head: true })
          .eq('post_id', currentPostId)
          .eq('side', 'right'),
      ])

      if (leftCountResult.error) throw leftCountResult.error
      if (rightCountResult.error) throw rightCountResult.error

      const authoritativeLeft = Math.max(
        0,
        Number(leftCountResult.count ?? nextLeft),
      )
      const authoritativeRight = Math.max(
        0,
        Number(rightCountResult.count ?? nextRight),
      )

      const syncedPosts = postsRef.current.map((post) =>
        post.id === currentPostId
          ? {
              ...post,
              leftVotes: authoritativeLeft,
              rightVotes: authoritativeRight,
            }
          : post,
      )
      const syncedTension = buildPostTensionState(
        currentPostId,
        authoritativeLeft,
        authoritativeRight,
      )

      postsRef.current = syncedPosts
      setPosts(syncedPosts)
      setPostTensionMap((prev) => ({
        ...prev,
        [currentPostId]: {
          ...syncedTension,
          updatedAt: new Date().toISOString(),
        },
      }))

      const { error: postError } = await supabase
        .from('posts')
        .update({
          left_votes: authoritativeLeft,
          right_votes: authoritativeRight,
        })
        .eq('id', currentPostId)

      if (postError) {
        throw postError
      }

      const beforeLeader = getLeaderSideFromVotes(safeLeft, safeRight)
      const afterLeader = getLeaderSideFromVotes(
        authoritativeLeft,
        authoritativeRight,
      )

      if (beforeLeader !== afterLeader) {
        const optimisticFlip: PostFlipEventItem = {
          postId: currentPostId,
          beforeLeader,
          afterLeader,
          beforeLeftVotes: safeLeft,
          beforeRightVotes: safeRight,
          afterLeftVotes: authoritativeLeft,
          afterRightVotes: authoritativeRight,
          createdAt: new Date().toISOString(),
        }

        setPostFlipMap((prev) => ({
          ...prev,
          [currentPostId]: optimisticFlip,
        }))

        void supabase.rpc('record_post_flip_event', {
          p_post_id: currentPostId,
          p_before_left_votes: safeLeft,
          p_before_right_votes: safeRight,
          p_after_left_votes: authoritativeLeft,
          p_after_right_votes: authoritativeRight,
        })
      }

      void supabase.rpc('refresh_post_tension_state', {
        p_post_id: currentPostId,
      })

      let activeShareSessionId: string | null = shareId

      if (!activeShareSessionId && typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search)
        const urlShareId = params.get('share')
        if (urlShareId) {
          activeShareSessionId = urlShareId
        }
      }

      if (activeShareSessionId) {
        const { data: validSession, error: validSessionError } = await supabase
          .from('share_sessions')
          .select('id, post_id, owner_key')
          .eq('id', activeShareSessionId)
          .maybeSingle()

        if (validSessionError) {
          console.error('share session 검증 실패', {
            message: validSessionError.message,
            details: validSessionError.details,
            hint: validSessionError.hint,
            code: validSessionError.code,
            activeShareSessionId,
          })
        } else if (validSession?.id) {
          const normalizedSessionId = String(validSession.id)
          const sessionPostId = Number(validSession.post_id ?? 0)

          setShareId(normalizedSessionId)
          setShareOwnerKey(String(validSession.owner_key ?? ''))
          if (sessionPostId) {
            setSharedPostId(sessionPostId)
          }

          if (!sessionPostId || sessionPostId !== Number(currentPostId)) {
            console.error('공유 세션 post_id 불일치', {
              sessionPostId,
              currentPostId,
              normalizedSessionId,
            })
            showToast('공유 글 정보가 맞지 않음')
          } else if (
            !validSession.owner_key ||
            String(validSession.owner_key) !== String(voterKey)
          ) {
            const ok = await saveShareResponse(
              normalizedSessionId,
              voterKey,
              choice,
            )

            if (ok) {
              await loadShareStatsBySessionId(normalizedSessionId)
              showToast('친구 응답 반영 완료')
            }
          } else {
            await loadShareStatsBySessionId(normalizedSessionId)
          }
        } else {
          console.error('share session 없음', activeShareSessionId)
        }
      }

      void logPostEvent({
        postId: currentPostId,
        eventType: 'vote',
        side: choice,
      })

      if (activeShareSessionId && isSharedVisitor) {
        void logPostEvent({
          postId: currentPostId,
          eventType: 'share_vote',
          side: choice,
          sessionId: activeShareSessionId,
        })
      }

      scheduleDiscoveryRefresh(syncedPosts)
      requestLightweightMetaRefresh({ immediate: true })

      void updateProgress(
        {
          points: 1,
          votes_count: prevChoice ? 0 : 1,
        },
        prevChoice ? '판단 변경 완료' : '🔥 +1 포인트',
      )
      void upsertStreak(
        'consecutive_votes',
        (streakMap.consecutive_votes?.currentCount ?? 0) + 1,
      )
      void upsertStreak(
        'daily_vote',
        (streakMap.daily_vote?.currentCount ?? 0) + 1,
      )

      void upsertResultUnlock(currentPostId, {
        unlockLevel: latestOutcome ? 4 : currentWatchlisted ? 3 : undefined,
        isWatchlisted: currentWatchlisted,
      })

      markPostMeaningful({
        ...latestPost,
        leftVotes: authoritativeLeft,
        rightVotes: authoritativeRight,
      })
    } catch (error) {
      console.error('투표 처리 실패', error)
      postsRef.current = prevPosts
      setPosts(prevPosts)
      setVotes(prevVotesMap)
      const fallbackPost = prevPosts.find((post) => post.id === currentPostId)
      if (fallbackPost) {
        setPostTensionMap((prev) => ({
          ...prev,
          [currentPostId]: buildPostTensionState(
            currentPostId,
            Math.max(0, Number(fallbackPost.leftVotes ?? 0)),
            Math.max(0, Number(fallbackPost.rightVotes ?? 0)),
          ),
        }))
      }
      showToast('투표 반영 실패')
    } finally {
      window.setTimeout(() => {
        voteLockRef.current = false
        setIsVoting(false)
      }, 220)
    }
  }

  const focusCurrentPostCard = useCallback(
    (behavior: ScrollBehavior = 'smooth') => {
      if (typeof window === 'undefined') return

      window.requestAnimationFrame(() => {
        const target = currentPostCardRef.current
        if (!target) return

        const rect = target.getBoundingClientRect()
        const absoluteTop = window.scrollY + rect.top
        const topOffset = 84
        const nextTop = Math.max(absoluteTop - topOffset, 0)

        window.scrollTo({ top: nextTop, behavior })

        try {
          target.focus({ preventScroll: true })
        } catch {
          target.focus()
        }

        setPostFocusPulse(true)
        if (postFocusPulseTimerRef.current) {
          window.clearTimeout(postFocusPulseTimerRef.current)
        }
        postFocusPulseTimerRef.current = window.setTimeout(() => {
          setPostFocusPulse(false)
        }, 900)
      })
    },
    [],
  )

  const requestCurrentPostFocus = useCallback(() => {
    pendingPostFocusRef.current = true
  }, [])

  useEffect(() => {
    if (
      typeof window === 'undefined' ||
      !currentPost?.id ||
      !pendingPostFocusRef.current
    )
      return

    pendingPostFocusRef.current = false
    const timer = window.setTimeout(
      () => {
        focusCurrentPostCard(isKakaoSafeMode ? 'auto' : 'smooth')
      },
      isKakaoSafeMode ? 90 : 40,
    )

    return () => {
      window.clearTimeout(timer)
    }
  }, [
    currentPost?.id,
    tab,
    selectedCategory,
    focusCurrentPostCard,
    isKakaoSafeMode,
  ])

  useEffect(() => {
    return () => {
      if (postFocusPulseTimerRef.current) {
        window.clearTimeout(postFocusPulseTimerRef.current)
      }
    }
  }, [])

  useEffect(() => {
    return () => {
      if (kakaoTransitionLockRef.current) {
        kakaoTransitionLockRef.current = false
      }
    }
  }, [])

  const runKakaoSafeTransition = useCallback(
    (callback: () => void, delay = 24) => {
      if (!isKakaoSafeMode || typeof window === 'undefined') {
        callback()
        return
      }

      if (kakaoTransitionLockRef.current) return
      kakaoTransitionLockRef.current = true

      window.setTimeout(() => {
        window.requestAnimationFrame(() => {
          callback()
          window.setTimeout(() => {
            kakaoTransitionLockRef.current = false
          }, 180)
        })
      }, delay)
    },
    [isKakaoSafeMode],
  )

  const recordChoicePath = useCallback(
    (fromPostId: number, toPostId: number) => {
      if (!currentActorUnifiedKey || fromPostId === toPostId) return

      const chosenSide = votes[fromPostId]
      if (!chosenSide) return

      void supabase.rpc('record_choice_path', {
        p_actor_key: currentActorUnifiedKey,
        p_from_post_id: fromPostId,
        p_to_post_id: toPostId,
        p_chosen_side: chosenSide,
      })
    },
    [currentActorUnifiedKey, votes],
  )

  const prev = () => {
    const targetIndex = Math.max(currentIndex - 1, 0)
    const targetPost = filteredPosts[targetIndex]

    if (currentPost && targetPost) {
      recordChoicePath(currentPost.id, targetPost.id)
    }

    requestCurrentPostFocus()
    runKakaoSafeTransition(() => {
      endSharedEntryMode()
      setCurrentIndex(targetIndex)
    })
    refreshWatchlistSignalsAfterAction(120)
    refreshPostCommentsAfterAction([currentPost?.id, targetPost?.id], 140)
  }

  const next = () => {
    const targetIndex = Math.min(currentIndex + 1, filteredPosts.length - 1)
    const targetPost = filteredPosts[targetIndex]

    if (currentPost && targetPost) {
      recordChoicePath(currentPost.id, targetPost.id)
    }

    requestCurrentPostFocus()
    runKakaoSafeTransition(() => {
      endSharedEntryMode()
      setCurrentIndex(targetIndex)
    })
    refreshWatchlistSignalsAfterAction(120)
    refreshPostCommentsAfterAction([currentPost?.id, targetPost?.id], 140)
  }

  const handleNextWithGuard = () => {
    if (!currentPost) return
    if (!votes[currentPost.id]) {
      showToast('먼저 선택하고 넘어가야 함')
      return
    }
    next()
  }

  const moveToPostWithGuard = (postId: number) => {
    if (!currentPost) return
    if (!votes[currentPost.id]) {
      showToast('먼저 지금 글에 선택해야 이동할 수 있음')
      return
    }

    const nextIndexInFiltered = filteredPosts.findIndex((p) => p.id === postId)
    if (nextIndexInFiltered >= 0) {
      recordChoicePath(currentPost.id, postId)
      requestCurrentPostFocus()
      runKakaoSafeTransition(() => {
        endSharedEntryMode()
        setCurrentIndex(nextIndexInFiltered)
      })
      refreshWatchlistSignalsAfterAction(120)
      refreshPostCommentsAfterAction([currentPost?.id, postId], 140)
      return
    }

    const fallbackIndex = posts.findIndex((p) => p.id === postId)
    if (fallbackIndex >= 0) {
      recordChoicePath(currentPost.id, postId)
      requestCurrentPostFocus()
      runKakaoSafeTransition(() => {
        endSharedEntryMode()
        setTab('추천')
        setSelectedCategory('전체')
        setCurrentIndex(fallbackIndex)
      })
      refreshWatchlistSignalsAfterAction(120)
    }
  }

  const markActivitySeen = useCallback(
    async (targetType: 'post' | 'comment', targetId: number) => {
      if (!currentRawActorKey || !targetId) return

      console.log('[matnya] markActivitySeen', {
        targetType,
        targetId,
        actorKey: currentRawActorKey,
      })

      const { error } = await supabase.from('user_activity_reads').upsert(
        {
          actor_key: currentRawActorKey,
          target_type: targetType,
          target_id: targetId,
          last_seen_at: new Date().toISOString(),
        },
        { onConflict: 'actor_key,target_type,target_id' },
      )

      if (error) {
        console.error('활동 읽음 처리 실패', error)
        return
      }

      void fetchMyActivity(currentRawActorKey)
    },
    [currentRawActorKey, fetchMyActivity],
  )

  const openPostDirect = (postId: number, markSeenPostId?: number) => {
    const index = posts.findIndex((p) => p.id === postId)
    if (index >= 0) {
      const latestSeenAt = postOutcomeMap[postId]?.[0]?.createdAt ?? null
      if (currentPost) {
        recordChoicePath(currentPost.id, postId)
      }
      requestCurrentPostFocus()
      runKakaoSafeTransition(() => {
        endSharedEntryMode()
        setTab('추천')
        setSelectedCategory('전체')
        setCurrentIndex(index)
        setActivityOpen(false)
      })
      if (newPostNoticeIds.includes(postId)) {
        latestSeenPostIdRef.current = postId
        setNewPostNoticeIds((prev) => prev.filter((id) => id !== postId))
      }
      refreshWatchlistSignalsAfterAction(80)
      refreshPostCommentsAfterAction([postId], 100)
      if (markSeenPostId) {
        void markActivitySeen('post', markSeenPostId)
      }
      if (myWatchlistMap[postId] && latestSeenAt) {
        void markWatchlistOutcomeSeen(postId, latestSeenAt)
      }
    }
  }

  const openWatchlistItemDirect = (item: WatchlistItem) => {
    openPostDirect(item.postId)
    if (item.latestOutcomeCreatedAt) {
      void markWatchlistOutcomeSeen(item.postId, item.latestOutcomeCreatedAt)
    }
  }

  const openCommentDirect = (postId: number, commentId?: number) => {
    const index = posts.findIndex((p) => p.id === postId)
    if (index >= 0) {
      if (currentPost) {
        recordChoicePath(currentPost.id, postId)
      }
      requestCurrentPostFocus()
      runKakaoSafeTransition(() => {
        endSharedEntryMode()
        setTab('추천')
        setSelectedCategory('전체')
        setCurrentIndex(index)
        setActivityOpen(false)
        setCommentOpen(true)
      })
      if (newPostNoticeIds.includes(postId)) {
        latestSeenPostIdRef.current = postId
        setNewPostNoticeIds((prev) => prev.filter((id) => id !== postId))
      }
      refreshPostCommentsAfterAction([postId], 100)
      if (commentId) {
        void markActivitySeen('comment', commentId)
      }
    }
  }

  const openNewestPostNotice = async () => {
    const noticeIds = newPostNoticeIds.filter(
      (id) => Number.isFinite(id) && id > 0,
    )
    const newestPostId = noticeIds[0]
    if (!newestPostId) return

    latestSeenPostIdRef.current = newestPostId

    const missingIds = noticeIds.filter(
      (postId) => !posts.some((post) => Number(post.id) === Number(postId)),
    )

    if (missingIds.length > 0) {
      const [
        { data: postRows, error: postError },
        { data: commentRows, error: commentsError },
      ] = await Promise.all([
        supabase
          .from('posts')
          .select('*')
          .in('id', missingIds)
          .neq('status', 'deleted')
          .order('created_at', { ascending: false }),
        supabase
          .from('comments')
          .select('*')
          .in('post_id', missingIds)
          .neq('status', 'deleted')
          .order('created_at', { ascending: false }),
      ])

      if (postError) {
        console.error('새 글 이동용 게시글 조회 실패', postError)
        return
      }

      if (commentsError) {
        console.error('새 글 이동용 댓글 조회 실패', commentsError)
      }

      const commentsByPostId = new Map<number, any[]>()
      ;(commentRows ?? []).forEach((comment: any) => {
        const postId = Number(comment.post_id)
        const bucket = commentsByPostId.get(postId) ?? []
        bucket.push(comment)
        commentsByPostId.set(postId, bucket)
      })

      const hydratedPosts = (postRows ?? []).map((postRow: any) => ({
        id: Number(postRow.id),
        category: postRow.category,
        ageGroup: postRow.age_group,
        title: postRow.title,
        content: postRow.content,
        leftLabel: postRow.left_label,
        rightLabel: postRow.right_label,
        leftVotes: Number(postRow.left_votes ?? 0),
        rightVotes: Number(postRow.right_votes ?? 0),
        reportCount: Number(postRow.report_count ?? 0),
        hidden: Boolean(postRow.hidden ?? false),
        authorKey: postRow.author_key ?? null,
        views: Number(postRow.views ?? 0),
        comments: (commentsByPostId.get(Number(postRow.id)) ?? []).map(
          (comment: any) => ({
            id: Number(comment.id),
            author: comment.author,
            authorKey: comment.author_key ?? null,
            side: comment.side as Side,
            text: comment.text,
            likes: Number(comment.likes ?? 0),
            reportCount: Number(comment.report_count ?? 0),
            hidden: Boolean(comment.hidden ?? false),
            createdAt: comment.created_at ?? null,
            replyToCommentId:
              comment.reply_to_comment_id != null
                ? Number(comment.reply_to_comment_id)
                : null,
          }),
        ),
      })) as PostItem[]

      const hydratedById = new Map<number, PostItem>()
      hydratedPosts.forEach((post) => {
        hydratedById.set(Number(post.id), post)
      })

      setPosts((prev) => {
        const orderedHydrated = noticeIds
          .map((postId) => hydratedById.get(Number(postId)))
          .filter(Boolean) as PostItem[]

        const existingNoticePosts = noticeIds
          .map((postId) =>
            prev.find((post) => Number(post.id) === Number(postId)),
          )
          .filter(Boolean) as PostItem[]

        const prepended =
          orderedHydrated.length > 0 ? orderedHydrated : existingNoticePosts
        const prependedIds = new Set(prepended.map((post) => Number(post.id)))
        const remaining = prev.filter(
          (post) => !prependedIds.has(Number(post.id)),
        )
        return [...prepended, ...remaining]
      })
    }

    setNewPostNoticeIds([])

    requestCurrentPostFocus()
    runKakaoSafeTransition(() => {
      endSharedEntryMode()
      setTab('추천')
      setSelectedCategory('전체')
      setCurrentIndex(0)
    })

    refreshWatchlistSignalsAfterAction(80)
    refreshPostCommentsAfterAction(noticeIds, 100)
  }

  const openWatchlistActivity = () => {
    setActivityInitialTab('watchlist')
    setActivityOpen(true)
    requestLightweightMetaRefresh()
  }

  const reactToComment = async (
    commentId: number,
    reactionType: CommentReactionType,
  ) => {
    if (!currentActorUnifiedKey) return
    if (reactionType !== 'relatable' && reactionType !== 'disagree') return

    const mapKey = `${commentId}:${reactionType}`
    if (commentReactionInFlightRef.current[mapKey]) return

    const oppositeReactionType: CommentReactionType =
      reactionType === 'relatable' ? 'disagree' : 'relatable'
    const oppositeMapKey = `${commentId}:${oppositeReactionType}`
    const alreadyActive = !!myCommentReactions[mapKey]
    const oppositeActive = !!myCommentReactions[oppositeMapKey]

    commentReactionInFlightRef.current[mapKey] = true
    if (oppositeActive) {
      commentReactionInFlightRef.current[oppositeMapKey] = true
    }

    setMyCommentReactions((prev) => ({
      ...prev,
      [mapKey]: !alreadyActive,
      ...(oppositeActive ? { [oppositeMapKey]: false } : {}),
    }))

    setCommentReactionMap((prev) => {
      const base = prev[commentId] ?? EMPTY_COMMENT_REACTION_SUMMARY
      return {
        ...prev,
        [commentId]: {
          ...base,
          [reactionType]: Math.max(
            0,
            Number(base[reactionType] ?? 0) + (alreadyActive ? -1 : 1),
          ),
          ...(oppositeActive
            ? {
                [oppositeReactionType]: Math.max(
                  0,
                  Number(base[oppositeReactionType] ?? 0) - 1,
                ),
              }
            : {}),
        },
      }
    })

    try {
      if (alreadyActive) {
        const { error } = await supabase
          .from('comment_reactions')
          .delete()
          .eq('comment_id', commentId)
          .eq('reactor_key', currentActorUnifiedKey)
          .eq('reaction_type', reactionType)

        if (error) {
          console.error('댓글 반응 삭제 실패', error)
          showToast('댓글 반응 반영 실패')
          void fetchAll(voterKey)
          return
        }

        showToast('반응 취소')
        if (currentRawActorKey) {
          void fetchMyActivity(currentRawActorKey)
        }
        return
      }

      if (oppositeActive) {
        const { error: oppositeDeleteError } = await supabase
          .from('comment_reactions')
          .delete()
          .eq('comment_id', commentId)
          .eq('reactor_key', currentActorUnifiedKey)
          .eq('reaction_type', oppositeReactionType)

        if (oppositeDeleteError) {
          console.error('반대 댓글 반응 삭제 실패', oppositeDeleteError)
          showToast('댓글 반응 반영 실패')
          void fetchAll(voterKey)
          return
        }
      }

      const { error } = await supabase.from('comment_reactions').upsert(
        {
          comment_id: commentId,
          reactor_key: currentActorUnifiedKey,
          reaction_type: reactionType,
        },
        {
          onConflict: 'comment_id,reactor_key,reaction_type',
          ignoreDuplicates: true,
        },
      )

      if (error && error.code !== '23505') {
        console.error('댓글 반응 등록 실패', error)
        showToast('댓글 반응 반영 실패')
        void fetchAll(voterKey)
        return
      }

      showToast(reactionType === 'relatable' ? '공감 반영' : '반박 반영')
      if (currentRawActorKey) {
        void fetchMyActivity(currentRawActorKey)
      }
    } finally {
      commentReactionInFlightRef.current[mapKey] = false
      commentReactionInFlightRef.current[oppositeMapKey] = false
    }
  }

  const markWatchlistOutcomeSeen = useCallback(
    async (postId: number, outcomeCreatedAt?: string | null) => {
      if (!currentActorUnifiedKey || !postId) return

      const latestSeenAt =
        outcomeCreatedAt ?? postOutcomeMap[postId]?.[0]?.createdAt ?? null

      if (!latestSeenAt) return

      setWatchOutcomeSeenMap((prev) => ({
        ...prev,
        [postId]: latestSeenAt,
      }))
      setWatchlistItems((prev) =>
        prev
          .map((item) =>
            item.postId === postId
              ? ({
                  ...item,
                  unreadOutcome: false,
                  watchStatus: normalizeWatchStatus(
                    item.latestOutcomeType ? 'archived' : item.watchStatus,
                  ),
                  archivedAt:
                    item.latestOutcomeType && !item.archivedAt
                      ? new Date().toISOString()
                      : item.archivedAt,
                } as WatchlistItem)
              : item,
          )
          .sort(compareWatchlistItems),
      )

      const seenAt = new Date().toISOString()
      const [{ error }, { error: watchUpdateError }] = await Promise.all([
        supabase.from('post_watchlist_outcome_reads').upsert(
          {
            actor_key: currentActorUnifiedKey,
            post_id: postId,
            last_seen_outcome_created_at: latestSeenAt,
            updated_at: seenAt,
          },
          {
            onConflict: 'actor_key,post_id',
          },
        ),
        supabase
          .from('post_watchlist')
          .update({
            watch_status: 'archived',
            archived_at: seenAt,
          })
          .eq('actor_key', currentActorUnifiedKey)
          .eq('post_id', postId)
          .eq('watch_type', 'curious'),
      ])

      if (error) {
        console.error('궁금한 글 읽음 처리 실패', error)
      }
      if (watchUpdateError) {
        console.error('궁금한 글 상태 업데이트 실패', watchUpdateError)
      }
    },
    [currentActorUnifiedKey, postOutcomeMap],
  )

  const markAllWatchlistSeen = useCallback(async () => {
    const targets = watchlistItems.filter(
      (item) => !!item.unreadOutcome && !!item.latestOutcomeCreatedAt,
    )

    if (targets.length === 0) return

    await Promise.all(
      targets.map((item) =>
        markWatchlistOutcomeSeen(item.postId, item.latestOutcomeCreatedAt),
      ),
    )
  }, [markWatchlistOutcomeSeen, watchlistItems])
  const submitOutcome = async (
    outcomeType: PostOutcomeItem['outcomeType'],
    summary: string,
  ) => {
    if (!currentPost) return

    const authorKey = currentPost.authorKey ?? null
    const isAuthor =
      !!authorKey &&
      !!currentActorKey &&
      String(authorKey) === String(currentActorKey)
    const canManageOutcome = isAuthor || (isAdmin && adminMode)

    if (!canManageOutcome) {
      showToast('작성자 또는 관리자만 후기 등록 가능')
      return
    }

    const trimmed = summary.trim()
    if (!trimmed) {
      showToast('후기 내용을 입력해줘')
      return
    }

    const { data: inserted, error } = await supabase
      .from('post_outcomes')
      .insert({
        post_id: currentPost.id,
        outcome_type: outcomeType,
        summary: trimmed,
        created_by_key: currentActorUnifiedKey ?? currentActorKey,
      })
      .select('id, post_id, outcome_type, summary, created_at')
      .single()

    if (error) {
      console.error('후기 등록 실패', error)
      showToast('후기 등록 실패')
      return
    }

    const nextItem: PostOutcomeItem = {
      id: Number(inserted.id),
      postId: Number(inserted.post_id),
      outcomeType: inserted.outcome_type as PostOutcomeItem['outcomeType'],
      summary: inserted.summary,
      createdAt: inserted.created_at ?? null,
    }

    setPostOutcomeMap((prev) => {
      const prevItems = prev[currentPost.id] ?? []
      return {
        ...prev,
        [currentPost.id]: [nextItem, ...prevItems].sort((a, b) => {
          const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0
          const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0
          return bTime - aTime
        }),
      }
    })

    const shouldTriggerWatchlistUnread = !!myWatchlistMap[currentPost.id]

    setWatchlistItems((prev) =>
      prev
        .map((item) =>
          item.postId === currentPost.id
            ? ({
                ...item,
                latestOutcomeType: nextItem.outcomeType,
                latestOutcomeSummary: nextItem.summary,
                latestOutcomeCreatedAt: nextItem.createdAt,
                hasOutcome: true,
                unreadOutcome: shouldTriggerWatchlistUnread,
                watchStatus: shouldTriggerWatchlistUnread
                  ? 'updated'
                  : 'archived',
                archivedAt: shouldTriggerWatchlistUnread
                  ? null
                  : new Date().toISOString(),
              } as WatchlistItem)
            : item,
        )
        .sort(compareWatchlistItems),
    )

    void upsertResultUnlock(currentPost.id, {
      unlockLevel: 4,
      isWatchlisted: currentWatchlisted,
    })
    requestLightweightMetaRefresh({ immediate: true, delay: 0 })
    refreshWatchlistSignalsAfterAction(0)
    setOutcomeModalOpen(false)
    showToast(
      shouldTriggerWatchlistUnread
        ? '후기 등록 완료 · 새 후기로 표시됨'
        : '후기 등록 완료',
    )
  }

  const toggleCurrentPostWatchlist = async () => {
    if (!currentPost || !currentActorUnifiedKey) return

    const alreadyActive = !!myWatchlistMap[currentPost.id]

    setMyWatchlistMap((prev) => ({
      ...prev,
      [currentPost.id]: !alreadyActive,
    }))

    if (alreadyActive) {
      setWatchlistItems((prev) =>
        prev.filter((item) => item.postId !== currentPost.id),
      )
      void upsertResultUnlock(currentPost.id, {
        isWatchlisted: false,
      })
      const { error } = await supabase
        .from('post_watchlist')
        .delete()
        .eq('post_id', currentPost.id)
        .eq('actor_key', currentActorUnifiedKey)
        .eq('watch_type', 'curious')

      if (error) {
        console.error('궁금한 글 해제 실패', error)
        showToast('결말궁금 반영 실패')
        void fetchWatchlist(currentActorUnifiedKey)
        return
      }

      refreshWatchlistSignalsAfterAction(80)
      showToast('궁금한 글 해제')
      return
    }

    const optimisticItem: WatchlistItem = {
      id: -currentPost.id,
      postId: currentPost.id,
      title: currentPost.title,
      category: currentPost.category,
      ageGroup: currentPost.ageGroup,
      createdAt: new Date().toISOString(),
      latestOutcomeType: latestOutcome?.outcomeType ?? null,
      latestOutcomeSummary: latestOutcome?.summary ?? null,
      latestOutcomeCreatedAt: latestOutcome?.createdAt ?? null,
      hasOutcome: !!latestOutcome,
      unreadOutcome: false,
      watchStatus: normalizeWatchStatus(latestOutcome ? 'archived' : 'waiting'),
      archivedAt: latestOutcome ? new Date().toISOString() : null,
    }

    setWatchlistItems((prev) => {
      const next = [
        optimisticItem,
        ...prev.filter((item) => item.postId !== currentPost.id),
      ]
      next.sort(compareWatchlistItems)
      return next
    })

    const { data, error } = await supabase
      .from('post_watchlist')
      .insert({
        post_id: currentPost.id,
        actor_key: currentActorUnifiedKey,
        watch_type: 'curious',
        watch_status: latestOutcome ? 'archived' : 'waiting',
        archived_at: latestOutcome ? new Date().toISOString() : null,
      })
      .select('id, created_at')
      .single()

    if (error) {
      console.error('궁금한 글 등록 실패', error)
      showToast('결말궁금 반영 실패')
      void fetchWatchlist(currentActorUnifiedKey)
      return
    }

    setWatchlistItems((prev) =>
      prev
        .map((item) =>
          item.postId === currentPost.id
            ? ({
                ...item,
                id: Number(data?.id ?? item.id),
                createdAt: data?.created_at ?? item.createdAt,
              } as WatchlistItem)
            : item,
        )
        .sort(compareWatchlistItems),
    )

    void upsertResultUnlock(currentPost.id, {
      unlockLevel: 3,
      isWatchlisted: true,
    })
    refreshWatchlistSignalsAfterAction(80)
    showToast(
      authUser?.id
        ? '결말궁금 저장됨'
        : '이 기기에는 저장됨 · 로그인하면 계속 이어볼 수 있음',
    )
  }

  const reactToPost = async (reactionType: PostReactionType) => {
    if (!currentPost || !currentActorUnifiedKey) return

    const mapKey = `${currentPost.id}:${reactionType}`
    if (postReactionInFlightRef.current[mapKey]) return

    const alreadyActive = !!myPostReactions[mapKey]

    postReactionInFlightRef.current[mapKey] = true

    setMyPostReactions((prev) => ({
      ...prev,
      [mapKey]: !alreadyActive,
    }))

    setPostReactionSummaryMap((prev) => {
      const base = prev[currentPost.id] ?? EMPTY_POST_REACTION_SUMMARY
      return {
        ...prev,
        [currentPost.id]: {
          ...base,
          [reactionType]: Math.max(
            0,
            Number(base[reactionType] ?? 0) + (alreadyActive ? -1 : 1),
          ),
        },
      }
    })

    try {
      if (alreadyActive) {
        const { error } = await supabase
          .from('post_reactions')
          .delete()
          .eq('post_id', currentPost.id)
          .eq('reactor_key', currentActorUnifiedKey)
          .eq('reaction_type', reactionType)

        if (error) {
          console.error('게시글 반응 삭제 실패', error)
          showToast('게시글 반응 반영 실패')
          void fetchAll(voterKey)
          return
        }

        showToast('반응 취소')
        if (currentRawActorKey) {
          void fetchMyActivity(currentRawActorKey)
        }
        return
      }

      const { error } = await supabase.from('post_reactions').upsert(
        {
          post_id: currentPost.id,
          reactor_key: currentActorUnifiedKey,
          reaction_type: reactionType,
        },
        {
          onConflict: 'post_id,reactor_key,reaction_type',
          ignoreDuplicates: true,
        },
      )

      if (error && error.code !== '23505') {
        console.error('게시글 반응 등록 실패', error)
        showToast('게시글 반응 반영 실패')
        void fetchAll(voterKey)
        return
      }

      showToast('반응 반영')
    } finally {
      postReactionInFlightRef.current[mapKey] = false
    }
  }

  const addComment = async (
    text: string,
    side: Side,
    replyToCommentId?: number | null,
  ) => {
    if (!currentPost) return

    const targetPostId = currentPost.id
    const targetPostTitle = currentPost.title
    const authorName = profile?.anonymous_name ?? guestName

    console.log('[matnya] addComment:start', {
      text,
      side,
      replyToCommentId: replyToCommentId ?? null,
      currentPostId: targetPostId,
    })

    const commentInsertPayload = {
      post_id: targetPostId,
      author: authorName,
      side,
      text,
      author_key: authUser?.id ?? voterKey,
      reply_to_comment_id: replyToCommentId ?? null,
      parent_comment_id: replyToCommentId ?? null,
      status: 'active' as const,
    }

    console.log('[matnya] addComment:payload', commentInsertPayload)

    const { data: inserted, error } = await supabase
      .from('comments')
      .insert(commentInsertPayload)
      .select()
      .single()

    if (error) {
      console.error('댓글 등록 실패', error)
      showToast('댓글 등록 실패')
      return
    }

    console.log('[matnya] addComment:inserted', inserted)

    const newComment: CommentItem = {
      id: Number(inserted.id),
      author: inserted.author,
      authorKey: inserted.author_key ?? null,
      side: inserted.side as Side,
      text: inserted.text,
      likes: Number(inserted.likes ?? 0),
      reportCount: Number(inserted.report_count ?? 0),
      hidden: Boolean(inserted.hidden ?? false),
      createdAt: inserted.created_at ?? null,
      replyToCommentId:
        inserted.reply_to_comment_id != null
          ? Number(inserted.reply_to_comment_id)
          : null,
    }

    setPosts((prev) =>
      prev.map((post) =>
        post.id === targetPostId
          ? {
              ...post,
              comments: [
                newComment,
                ...post.comments.filter(
                  (comment) => comment.id !== newComment.id,
                ),
              ],
            }
          : post,
      ),
    )

    setMyComments((prev) => [
      {
        id: newComment.id,
        commentId: newComment.id,
        postId: targetPostId,
        postTitle: targetPostTitle,
        text: newComment.text,
        hasNewReplies: false,
        newRepliesCount: 0,
      },
      ...prev.filter((comment) => comment.commentId !== newComment.id),
    ])

    showToast('댓글 등록됨')

    await Promise.all([
      logPostEvent({
        postId: targetPostId,
        eventType: 'comment',
        side,
        refId: newComment.id,
      }),
      updateProgress(
        {
          points: 3,
          comments_count: 1,
        },
        '🔥 +3 포인트',
      ),
      refreshCommentsForPost(targetPostId),
    ])

    scheduleDiscoveryRefresh()
    refreshWatchlistSignalsAfterAction(120)
    if (currentRawActorKey) {
      void fetchMyActivity(currentRawActorKey)
    }
  }

  const openReportPost = () => {
    if (!currentPost) return
    if (reportedPosts[currentPost.id]) {
      showToast('이미 신고한 글임')
      return
    }
    setReportModal({
      open: true,
      type: 'post',
      id: currentPost.id,
      label: '현재 글 신고',
    })
  }

  const openReportComment = (commentId: number) => {
    if (reportedComments[commentId]) {
      showToast('이미 신고한 댓글임')
      return
    }
    setReportModal({
      open: true,
      type: 'comment',
      id: commentId,
      label: '댓글 신고',
    })
  }

  const submitReport = async (reason: string) => {
    const reportId = reportModal.id
    if (reportId == null || !voterKey || !reportModal.type) return

    const targetType = reportModal.type

    const { error: insertReportError } = await supabase.from('reports').insert({
      target_type: targetType,
      target_id: reportId,
      reporter_key: voterKey,
      reason,
    })

    if (insertReportError) {
      const message = String(insertReportError.message || '')
      const details = String(insertReportError.details || '')

      if (
        insertReportError.code === '23505' ||
        message.includes('duplicate') ||
        details.includes('already exists')
      ) {
        showToast(
          targetType === 'post' ? '이미 신고한 글임' : '이미 신고한 댓글임',
        )
        return
      }

      console.error('신고 저장 실패', insertReportError)
      showToast('신고 저장 실패')
      return
    }

    const { count: latestReportCount, error: countError } = await supabase
      .from('reports')
      .select('*', { count: 'exact', head: true })
      .eq('target_type', targetType)
      .eq('target_id', reportId)

    if (countError) {
      console.error('신고 수 조회 실패', countError)
      showToast('신고 반영 실패')
      return
    }

    const safeReportCount = Number(latestReportCount ?? 0)
    const nextHidden = safeReportCount >= REPORT_HIDE_THRESHOLD

    if (targetType === 'post') {
      const { error: updatePostError } = await supabase
        .from('posts')
        .update({
          report_count: safeReportCount,
          hidden: nextHidden,
          status: nextHidden ? 'hidden' : 'active',
        })
        .eq('id', reportId)

      if (updatePostError) {
        console.error('게시글 신고 반영 실패', updatePostError)
        showToast('신고 반영 실패')
        return
      }

      setReportedPosts((prev) => ({ ...prev, [reportId]: true }))
      setPosts((prev) =>
        prev.map((p) =>
          p.id === reportId
            ? {
                ...p,
                reportCount: safeReportCount,
                hidden: nextHidden,
              }
            : p,
        ),
      )
    }

    if (targetType === 'comment') {
      if (!currentPost) return

      const { error: updateCommentError } = await supabase
        .from('comments')
        .update({
          report_count: safeReportCount,
          hidden: nextHidden,
          status: nextHidden ? 'hidden' : 'active',
        })
        .eq('id', reportId)

      if (updateCommentError) {
        console.error('댓글 신고 반영 실패', updateCommentError)
        showToast('신고 반영 실패')
        return
      }

      setReportedComments((prev) => ({ ...prev, [reportId]: true }))
      setPosts((prev) =>
        prev.map((p) =>
          p.id === currentPost.id
            ? {
                ...p,
                comments: p.comments.map((c) =>
                  c.id === reportId
                    ? {
                        ...c,
                        reportCount: safeReportCount,
                        hidden: nextHidden,
                      }
                    : c,
                ),
              }
            : p,
        ),
      )
    }

    setReportModal({
      open: false,
      type: null,
      id: null,
      label: '',
    })

    showToast(
      nextHidden ? `${reason} 신고 접수 · 숨김 처리됨` : `${reason} 신고 접수`,
    )
  }

  const createPost = async (data: {
    category: string
    ageGroup: string
    title: string
    content: string
    leftLabel: string
    rightLabel: string
  }) => {
    const { data: inserted, error } = await supabase
      .from('posts')
      .insert({
        category: data.category,
        age_group: data.ageGroup,
        title: data.title,
        content: data.content,
        left_label: data.leftLabel,
        right_label: data.rightLabel,
        author_key: authUser?.id ?? voterKey,
        status: 'active',
      })
      .select()
      .single()

    if (error) {
      console.error('글 등록 실패', error)
      showToast('글 등록 실패')
      return
    }

    const newPost: PostItem = {
      id: Number(inserted.id),
      category: inserted.category,
      ageGroup: inserted.age_group,
      title: inserted.title,
      content: inserted.content,
      leftLabel: inserted.left_label,
      rightLabel: inserted.right_label,
      leftVotes: Number(inserted.left_votes ?? 0),
      rightVotes: Number(inserted.right_votes ?? 0),
      reportCount: Number(inserted.report_count ?? 0),
      hidden: Boolean(inserted.hidden ?? false),
      authorKey: inserted.author_key ?? null,
      comments: [],
      views: Number(inserted.views ?? 0),
    }

    setPosts((prev) => [newPost, ...prev])
    latestSeenPostIdRef.current = Number(newPost.id)
    setNewPostNoticeIds([])

    setMyPosts((prev) => [
      {
        id: newPost.id,
        postId: newPost.id,
        title: newPost.title,
        category: newPost.category,
        ageGroup: newPost.ageGroup,
        hasNewComments: false,
        newCommentsCount: 0,
      },
      ...prev.filter((item) => item.postId !== newPost.id),
    ])

    clearShareMode()
    requestCurrentPostFocus()
    runKakaoSafeTransition(() => {
      setTab('최신')
      setSelectedCategory('전체')
      setCurrentIndex(0)
      setJustCreatedPostId(newPost.id)
      setWriteOpen(false)
      setCommentOpen(false)
      setActivityOpen(false)
    })
    markPostMeaningful(newPost)
    scheduleDiscoveryRefresh([newPost, ...posts])
    showToast('내가 쓴 글 등록 완료')

    await updateProgress(
      {
        points: 5,
        posts_count: 1,
      },
      '🔥 글 작성 +5 포인트',
    )
  }

  const adminRestorePost = async () => {
    if (!currentPost) return

    const { error } = await supabase
      .from('posts')
      .update({
        hidden: false,
        report_count: 0,
        status: 'active',
      })
      .eq('id', currentPost.id)

    if (error) {
      console.error('글 숨김 해제 실패', error)
      showToast('숨김 해제 실패')
      return
    }

    setPosts((prev) =>
      prev.map((p) =>
        p.id === currentPost.id ? { ...p, hidden: false, reportCount: 0 } : p,
      ),
    )
    showToast('글 숨김 해제 완료')
  }

  const adminDeletePost = async () => {
    if (!currentPost) return

    const { error } = await supabase
      .from('posts')
      .update({
        status: 'deleted',
        hidden: true,
      })
      .eq('id', currentPost.id)

    if (error) {
      console.error('글 삭제 실패', error)
      showToast('글 삭제 실패')
      return
    }

    const nextPosts = posts.filter((p) => p.id !== currentPost.id)
    setPosts(nextPosts)
    setMyPosts((prev) => prev.filter((item) => item.postId !== currentPost.id))
    setMyComments((prev) =>
      prev.filter((item) => item.postId !== currentPost.id),
    )
    setCurrentIndex(0)
    await fetchDeletedItems()
    showToast('글 삭제 완료')
  }

  const adminRestoreComment = async (commentId: number) => {
    if (!currentPost) return

    const { error } = await supabase
      .from('comments')
      .update({
        hidden: false,
        report_count: 0,
        status: 'active',
      })
      .eq('id', commentId)

    if (error) {
      console.error('댓글 숨김 해제 실패', error)
      showToast('댓글 숨김 해제 실패')
      return
    }

    setPosts((prev) =>
      prev.map((p) =>
        p.id === currentPost.id
          ? {
              ...p,
              comments: p.comments.map((c) =>
                c.id === commentId
                  ? { ...c, hidden: false, reportCount: 0 }
                  : c,
              ),
            }
          : p,
      ),
    )
    showToast('댓글 숨김 해제 완료')
  }

  const adminDeleteComment = async (commentId: number) => {
    if (!currentPost) return

    const { error } = await supabase
      .from('comments')
      .update({
        status: 'deleted',
        hidden: true,
      })
      .eq('id', commentId)

    if (error) {
      console.error('댓글 삭제 실패', error)
      showToast('댓글 삭제 실패')
      return
    }

    setPosts((prev) =>
      prev.map((p) =>
        p.id === currentPost.id
          ? { ...p, comments: p.comments.filter((c) => c.id !== commentId) }
          : p,
      ),
    )

    setMyComments((prev) => prev.filter((item) => item.commentId !== commentId))
    await fetchDeletedItems()
    showToast('댓글 삭제 완료')
  }

  const adminRestoreDeletedPost = async (postId: number) => {
    const { error } = await supabase
      .from('posts')
      .update({
        status: 'active',
        hidden: false,
      })
      .eq('id', postId)

    if (error) {
      console.error('삭제 글 복구 실패', error)
      showToast('글 복구 실패')
      return
    }

    const restored = deletedPosts.find((p) => p.id === postId)
    if (restored) {
      setPosts((prev) => [restored, ...prev])
      setDeletedPosts((prev) => prev.filter((p) => p.id !== postId))
    }

    showToast('글 복구 완료')
  }

  const adminRestoreDeletedComment = async (commentId: number) => {
    const { data: restoredRow, error } = await supabase
      .from('comments')
      .update({
        status: 'active',
        hidden: false,
      })
      .eq('id', commentId)
      .select()
      .single()

    if (error) {
      console.error('삭제 댓글 복구 실패', error)
      showToast('댓글 복구 실패')
      return
    }

    const restoredComment: CommentItem = {
      id: Number(restoredRow.id),
      author: restoredRow.author,
      side: (restoredRow.side as Side) ?? 'left',
      text: restoredRow.text,
      likes: Number(restoredRow.likes ?? 0),
      reportCount: Number(restoredRow.report_count ?? 0),
      hidden: Boolean(restoredRow.hidden ?? false),
    }

    setPosts((prev) =>
      prev.map((post) =>
        post.id === Number(restoredRow.post_id)
          ? { ...post, comments: [restoredComment, ...post.comments] }
          : post,
      ),
    )

    setDeletedComments((prev) => prev.filter((c) => c.id !== commentId))
    showToast('댓글 복구 완료')
  }

  const levelInfo = getLevelInfo(stats.points)

  const isModalOpen =
    commentOpen ||
    writeOpen ||
    activityOpen ||
    outcomeModalOpen ||
    deletedOpen ||
    authOpen ||
    shareInboxOpen ||
    inquiryOpen ||
    inquiryAdminOpen

  if (loading) {
    return (
      <div className="min-h-[100dvh] bg-[radial-gradient(circle_at_top,_rgba(79,124,255,0.10),_transparent_30%),linear-gradient(180deg,#f5f7fb_0%,#eef2f7_100%)] text-slate-900 flex items-center justify-center px-6 text-center">
        <div>
          <div className="text-lg font-bold">불러오는 중...</div>
          <div className="mt-2 text-sm text-slate-500">
            글 목록을 가져오는 중
          </div>
        </div>
      </div>
    )
  }

  if (currentPost) {
    const p = percent(currentPost.leftVotes, currentPost.rightVotes)
    const displayedPercent = currentResultReveal
      ? {
          left: currentResultReveal.leftValue,
          right: currentResultReveal.rightValue,
        }
      : p
    const liveResultLeft = Math.max(
      0,
      Math.min(100, Number(displayedPercent?.left ?? 0)),
    )
    const liveResultRight = Math.max(
      0,
      Math.min(
        100,
        Number(displayedPercent?.right ?? Math.max(0, 100 - liveResultLeft)),
      ),
    )
    const liveResultPercentText = `${liveResultLeft}% vs ${liveResultRight}%`

    return (
      <div className="min-h-[100dvh] bg-[radial-gradient(circle_at_top,_rgba(79,124,255,0.10),_transparent_30%),linear-gradient(180deg,#f5f7fb_0%,#eef2f7_100%)] text-slate-900">
        <div className="mx-auto flex min-h-[100dvh] w-full max-w-md flex-col overflow-x-hidden bg-transparent">
          <header className="sticky top-0 z-30 px-3 pt-2 sm:px-4 sm:pt-3">
            <div className="overflow-hidden rounded-[24px] border border-white/80 bg-white/94 shadow-[0_10px_30px_rgba(15,23,42,0.08)] backdrop-blur-xl sm:rounded-[32px] sm:shadow-[0_18px_48px_rgba(15,23,42,0.09)]">
              <div className="relative px-3 pb-3 pt-3 sm:px-4 sm:pb-4 sm:pt-4">
                <div className="pointer-events-none absolute -right-12 -top-16 h-36 w-36 rounded-full bg-[#dbe7ff] blur-2xl" />
                <div className="pointer-events-none absolute -left-10 top-8 h-28 w-28 rounded-full bg-rose-100/70 blur-2xl" />

                <div className="relative flex items-start justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      requestCurrentPostFocus()
                      refreshWatchlistSignalsAfterAction(120)
                    }}
                    className="min-w-0 flex-1 text-left"
                  >
                    <div className="flex items-center gap-2">
                      <div className="text-[31px] leading-none font-black tracking-[-0.08em] text-slate-950 sm:text-[44px]">
                        맞냐
                      </div>
                      <span className="rounded-full bg-slate-950 px-2 py-0.5 text-[9px] font-black tracking-[0.12em] text-white shadow-[0_8px_18px_rgba(15,23,42,0.20)] sm:px-2.5 sm:py-1 sm:text-[10px]">
                        LIVE
                      </span>
                    </div>
                    <div className="mt-0.5 text-[11px] font-extrabold tracking-[-0.03em] text-slate-500 sm:mt-1 sm:text-[13px]">
                      오늘 가장 많이 갈리는 이야기
                    </div>
                  </button>

                  <div className="flex shrink-0 items-center gap-1.5 self-start">
                    <button
                      onClick={openWatchlistActivity}
                      className={`relative flex h-9 min-w-[42px] items-center justify-center gap-1 rounded-full border px-2 text-slate-900 sm:h-10 sm:min-w-[48px] sm:px-3 ${getLevelTheme(levelInfo.level).chipClass}`}
                    >
                      <span className="text-xs">
                        {getLevelTheme(levelInfo.level).icon}
                      </span>
                      <span className="text-[11px] font-black sm:text-xs">
                        Lv.{levelInfo.level}
                      </span>
                      {unreadActivityBadgeCount > 0 ? (
                        <span className="absolute -right-0.5 -top-0.5 inline-flex h-2.5 w-2.5 rounded-full bg-rose-500 ring-2 ring-white" />
                      ) : null}
                    </button>

                    {isAdmin && (
                      <button
                        onClick={() => void handleAdminToggle()}
                        className={`flex h-10 w-10 items-center justify-center rounded-full ${
                          adminMode
                            ? 'bg-[#4f7cff] text-white shadow-[0_12px_24px_rgba(79,124,255,0.24)]'
                            : 'border border-slate-200 bg-white text-slate-900 shadow-[0_6px_18px_rgba(15,23,42,0.05)]'
                        }`}
                      >
                        <Shield className="h-5 w-5" />
                      </button>
                    )}

                    {isAdmin ? (
                      <button
                        onClick={() => {
                          setInquiryAdminOpen(true)
                          void loadInquiryAdminItems()
                        }}
                        className="hidden h-9 items-center justify-center rounded-full border border-slate-200/80 bg-white/95 px-3 text-[11px] font-black text-slate-900 shadow-[0_10px_22px_rgba(15,23,42,0.06)] transition active:scale-[0.96] sm:flex sm:h-10"
                        aria-label="문의함"
                      >
                        문의함
                      </button>
                    ) : null}

                    <button
                      onClick={openInquiryCenter}
                      className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200/80 bg-white/95 text-[16px] font-black text-slate-900 shadow-[0_10px_22px_rgba(15,23,42,0.06)] transition active:scale-[0.96] sm:h-10 sm:w-10"
                      aria-label="문의하기"
                      title="문의하기"
                    >
                      ?
                    </button>

                    <button
                      onClick={() => setWriteOpen(true)}
                      className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-950 text-white shadow-[0_14px_26px_rgba(15,23,42,0.26)] transition active:scale-[0.96] sm:h-10 sm:w-10"
                      aria-label="글쓰기"
                    >
                      <Plus className="h-5 w-5" />
                    </button>
                  </div>
                </div>

                <div className="relative mt-2 hidden grid-cols-3 gap-1.5 sm:mt-4 sm:grid">
                  <div className="rounded-2xl border border-rose-100 bg-rose-50/80 px-3 py-2 text-center">
                    <div className="text-[10px] font-black text-rose-500">
                      LIVE
                    </div>
                    <div className="mt-0.5 text-[12px] font-black text-slate-950">
                      갈리는 판{' '}
                      {liveOperationStats.brawl || liveOperationStats.hot || 1}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-amber-100 bg-amber-50/80 px-3 py-2 text-center">
                    <div className="text-[10px] font-black text-amber-600">
                      FLIP
                    </div>
                    <div className="mt-0.5 text-[12px] font-black text-slate-950">
                      역전 신호 {liveOperationStats.flip || 'ON'}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-blue-100 bg-blue-50/80 px-3 py-2 text-center">
                    <div className="text-[10px] font-black text-blue-600">
                      COMMENT
                    </div>
                    <div className="mt-0.5 text-[12px] font-black text-slate-950">
                      댓글 붙는 중
                    </div>
                  </div>
                </div>

                <div className="relative mt-2 grid grid-cols-3 gap-1 rounded-[18px] border border-slate-200/70 bg-slate-100/80 p-1 sm:mt-4 sm:gap-1.5 sm:rounded-[22px] sm:p-1.5">
                  {(
                    [
                      { value: '추천', label: '🔥 HOT' },
                      { value: '최신', label: '⚡ 방금' },
                      { value: '인기', label: '🥊 개싸움' },
                    ] as const
                  ).map((item) => (
                    <button
                      key={item.value}
                      onClick={() => {
                        requestCurrentPostFocus()
                        runKakaoSafeTransition(() => {
                          setTab(item.value)
                          setCurrentIndex(0)
                        })
                        refreshWatchlistSignalsAfterAction(120)
                      }}
                      className={`rounded-[14px] px-1.5 py-2 text-[12px] font-black tracking-[-0.03em] transition sm:rounded-[17px] sm:px-2 sm:py-2.5 sm:text-[13px] ${
                        tab === item.value
                          ? 'bg-[linear-gradient(135deg,#111827_0%,#334155_100%)] text-white shadow-[0_12px_24px_rgba(15,23,42,0.18)]'
                          : 'bg-white/80 text-slate-600 shadow-[0_6px_14px_rgba(15,23,42,0.04)]'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </header>

          <main className="px-3 pb-28 pt-1.5 sm:px-4 sm:pb-32 sm:pt-2">
            {activeLiveTickerItem ? (
              <div className="mb-2 overflow-hidden rounded-[22px] border border-white/90 bg-[radial-gradient(circle_at_top_left,rgba(79,124,255,0.14),transparent_34%),linear-gradient(135deg,#ffffff_0%,#f8fbff_44%,#fff7f7_100%)] shadow-[0_12px_30px_rgba(79,124,255,0.12)] sm:mb-3 sm:rounded-[30px] sm:shadow-[0_22px_52px_rgba(79,124,255,0.14)]">
                <div className="flex items-center justify-between gap-2 border-b border-slate-100/80 px-3 py-2 sm:px-4 sm:py-3">
                  <div className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-3 py-1.5 text-[11px] font-black tracking-[0.08em] text-white shadow-[0_10px_24px_rgba(15,23,42,0.22)]">
                    <span className="relative flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-300 opacity-80" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-300" />
                    </span>
                    LIVE
                  </div>
                  <button
                    type="button"
                    onClick={handleLiveTickerOpen}
                    className="rounded-full border border-rose-100 bg-white px-2.5 py-1 text-[10px] font-black text-rose-600 shadow-[0_8px_18px_rgba(244,63,94,0.08)] sm:px-3 sm:text-[11px]"
                  >
                    지금 보기
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handleLiveTickerOpen}
                  className="block w-full px-3 py-2.5 text-left transition hover:bg-white/60 sm:px-4 sm:py-4"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[16px] bg-[linear-gradient(135deg,#fb7185_0%,#ef4444_100%)] text-[12px] font-black text-white shadow-[0_10px_22px_rgba(244,63,94,0.24)] sm:h-12 sm:w-12 sm:rounded-[22px] sm:text-[15px] sm:shadow-[0_12px_28px_rgba(244,63,94,0.28)]">
                      {activeLiveTickerItem.rank}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="shrink-0 rounded-full bg-[linear-gradient(135deg,#111827_0%,#334155_100%)] px-2.5 py-1 text-[10px] font-black text-white">
                          {activeLiveTickerItem.liveBadgeLabel ?? '실시간 논쟁'}
                        </span>
                        <span className="truncate text-[11px] font-black tracking-[0.12em] text-slate-400">
                          {activeLiveTickerItem.category}
                        </span>
                      </div>
                      <div className="mt-1 line-clamp-1 text-[14px] font-black leading-[1.25] tracking-[-0.05em] text-slate-950 sm:mt-2 sm:line-clamp-2 sm:text-[18px]">
                        {activeLiveTickerItem.title}
                      </div>
                      <div className="mt-1 text-[11px] font-bold text-slate-500 sm:mt-2 sm:text-[12px]">
                        {activeLiveTickerItem.shortMetric}
                      </div>
                    </div>
                    <div className="hidden shrink-0 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-black text-slate-500 sm:block">
                      이동 ›
                    </div>
                  </div>
                </button>

                <div className="hidden grid-cols-3 gap-1.5 border-t border-slate-100/80 p-2 sm:grid">
                  {liveTickerItems.slice(0, 3).map((item, index) => {
                    const active = index === liveTickerIndex
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          setLiveTickerIndex(index)
                          requestCurrentPostFocus()
                          moveToPostWithGuard(item.id)
                        }}
                        className={`min-w-0 rounded-[18px] border px-2.5 py-2.5 text-left transition ${
                          active
                            ? 'border-[#4f7cff] bg-white shadow-[0_10px_22px_rgba(79,124,255,0.16)] scale-[1.02]'
                            : 'border-slate-100 bg-white/60 hover:bg-white'
                        }`}
                      >
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-black ${
                              active
                                ? 'bg-[#4f7cff] text-white'
                                : 'bg-slate-100 text-slate-500'
                            }`}
                          >
                            {index + 1}
                          </span>
                          <span className="truncate text-[10px] font-black text-slate-500">
                            {item.liveBadgeLabel}
                          </span>
                        </div>
                        <div className="mt-1 line-clamp-2 text-[11px] font-black leading-[1.25] tracking-[-0.04em] text-slate-900">
                          {item.title}
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            ) : null}

            {newPostNoticeCount > 0 ? (
              <button
                type="button"
                onClick={() => void openNewestPostNotice()}
                className="mb-3 flex w-full items-center justify-between gap-3 rounded-[24px] border border-rose-100 bg-[linear-gradient(135deg,#fff1f2_0%,#ffffff_100%)] px-4 py-3 text-left shadow-[0_14px_32px_rgba(244,63,94,0.12)]"
              >
                <div className="min-w-0">
                  <div className="text-[11px] font-extrabold tracking-[0.18em] text-rose-500">
                    NEW
                  </div>
                  <div className="mt-1 text-sm font-black text-slate-900">
                    새 글 {newPostNoticeCount}개 올라옴
                  </div>
                </div>
                <div className="shrink-0 rounded-full border border-rose-100 bg-white px-3 py-1 text-[11px] font-black text-rose-600">
                  보러가기
                </div>
              </button>
            ) : null}

            <div
              key={`${currentPost.id}-${tab}-${selectedCategory}-${shouldRenderKakaoHeavyBlocks ? 'rich' : 'safe'}`}
              ref={currentPostCardRef}
              tabIndex={-1}
              className={`relative overflow-hidden rounded-[26px] border bg-white p-4 sm:rounded-[34px] sm:p-5 shadow-[0_24px_58px_rgba(15,23,42,0.10),0_2px_10px_rgba(15,23,42,0.03)] backdrop-blur transition-[border-color,box-shadow,transform] duration-220 before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-24 before:bg-[linear-gradient(180deg,rgba(79,124,255,0.10)_0%,rgba(255,255,255,0)_100%)] ${postFocusPulse ? 'border-[#9db7ff] ring-4 ring-[#dfe9ff] shadow-[0_28px_64px_rgba(79,124,255,0.18),0_2px_10px_rgba(15,23,42,0.04)]' : 'border-white/95'}`}
            >
              <div className="relative mb-4 flex items-center justify-between gap-2">
                <div className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-3 py-1.5 text-[11px] font-black tracking-[0.04em] text-white shadow-[0_10px_24px_rgba(15,23,42,0.20)]">
                  <span>🔥 오늘의 판</span>
                </div>
                <div className="rounded-full border border-blue-100 bg-blue-50 px-3 py-1.5 text-[11px] font-black text-blue-700">
                  선택하면 결과 공개
                </div>
              </div>

              <div className="relative mb-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-slate-500">
                    {currentPost.category}
                  </span>
                  <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-slate-500">
                    {currentPost.ageGroup}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={openReportPost}
                    className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-[0_8px_18px_rgba(15,23,42,0.05)] transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600 active:scale-[0.96] sm:h-9 sm:w-9"
                    aria-label="현재 글 신고"
                    title="현재 글 신고"
                  >
                    <Flag className="h-4 w-4" />
                  </button>

                  {adminMode && (
                    <div className="flex gap-2">
                      <button
                        onClick={async () => {
                          await fetchDeletedItems()
                          setDeletedOpen(true)
                        }}
                        className="rounded-2xl bg-[#4f7cff] px-3 py-2 text-xs font-bold text-slate-900"
                      >
                        복구 관리
                      </button>

                      {currentPost.hidden && (
                        <>
                          <button
                            onClick={() => void adminRestorePost()}
                            className="rounded-2xl bg-[#4f7cff] px-3 py-2 text-xs font-bold text-slate-900"
                          >
                            숨김 해제
                          </button>
                          <button
                            onClick={() => void adminDeletePost()}
                            className="rounded-2xl bg-red-500 px-3 py-2 text-xs font-bold text-slate-900"
                          >
                            삭제
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-[24px] border border-transparent bg-transparent p-0 shadow-none">
                <div className="hidden">today issue</div>
                <h1 className="mt-4 text-[29px] font-black leading-[1.16] tracking-[-0.055em] text-slate-950">
                  {currentPost.hidden && !adminMode
                    ? '신고 누적으로 숨겨진 글'
                    : currentPost.title}
                </h1>
                <p className="mt-3 whitespace-pre-line text-[15px] font-medium leading-7 tracking-[-0.025em] text-slate-600">
                  {currentPost.hidden && !adminMode
                    ? '관리자 확인 전까지 숨김 처리됩니다.'
                    : currentPost.content}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {isSharedVisitor && (
                    <div className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[11px] font-bold text-amber-700">
                      {votes[currentPost.id]
                        ? '✨ 친구랑 결과 보는 중'
                        : '🔥 친구가 보낸 맞냐 · 선택하면 바로 결과 공개'}
                    </div>
                  )}
                  {isSharedOwnerViewingPost && (
                    <div
                      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-bold transition-all duration-300 ${sharePulse ? 'border-emerald-300 bg-[linear-gradient(135deg,#ecfdf5_0%,#d1fae5_100%)] text-rose-600 shadow-[0_12px_26px_rgba(16,185,129,0.18)] -translate-y-0.5' : 'border-blue-200 bg-blue-50 text-blue-700'}`}
                    >
                      <span>
                        {shareResponseTotal > 0
                          ? `⚡ 친구 응답 ${shareResponseTotal}개 도착`
                          : '📨 친구 응답 기다리는 중'}
                      </span>
                      {ownerShareDelta > 0 ? (
                        <span className="rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-extrabold text-emerald-600 shadow-sm">
                          +{ownerShareDelta}
                        </span>
                      ) : null}
                    </div>
                  )}
                  {isOwnCurrentPost && (
                    <div className="inline-flex rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-[11px] font-bold text-blue-700">
                      ✍️ 내가 쓴 글 · 첫 반응 기다리는 중
                    </div>
                  )}
                  {!isOwnCurrentPost && revisitMeta && (
                    <div className="inline-flex rounded-full border border-slate-200 bg-white px-3 py-1 text-slate-500 text-[11px] font-bold text-slate-600">
                      👀 {revisitMeta.label}
                    </div>
                  )}
                  {currentHotBadge ? (
                    <div
                      className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-bold ${currentHotBadge.toneClass}`}
                    >
                      {currentHotBadge.label}
                    </div>
                  ) : null}
                  {currentTurningPointLabel ? (
                    <div className="inline-flex rounded-full border border-[#dbe7ff] bg-[#eff4ff] px-3 py-1 text-[11px] font-bold text-[#315fdc]">
                      {currentTurningPointLabel}
                      {currentTurningPoint?.createdAt
                        ? ` · ${formatRelativeShort(currentTurningPoint.createdAt)}`
                        : ''}
                    </div>
                  ) : null}
                  {currentTension?.isFlipImminent ? (
                    <div
                      className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-black ${currentTensionMeta.toneClass}`}
                    >
                      {currentTensionMeta.label}
                    </div>
                  ) : null}
                  {latestOutcome ? (
                    <div
                      className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-black ${getOutcomeTone(latestOutcome.outcomeType)}`}
                    >
                      {getOutcomeLabel(latestOutcome.outcomeType)}
                    </div>
                  ) : null}
                </div>
                {currentHotMeta
                  ? (() => {
                      const signalCards = [
                        currentHotMeta.vote1h >= 3
                          ? {
                              key: 'vote1h',
                              label: '최근 참여',
                              value: `${currentHotMeta.vote1h}명`,
                              toneClass:
                                'border-rose-100 bg-[linear-gradient(180deg,#fff1f2_0%,#ffffff_100%)] text-rose-500',
                            }
                          : null,
                        currentHotMeta.comment1h >= 2
                          ? {
                              key: 'comment1h',
                              label: '붙는 댓글',
                              value: `${currentHotMeta.comment1h}개`,
                              toneClass:
                                'border-violet-100 bg-[linear-gradient(180deg,#f5f3ff_0%,#ffffff_100%)] text-violet-500',
                            }
                          : null,
                        currentHotMeta.share24h >= 1
                          ? {
                              key: 'share24h',
                              label: '퍼지는 중',
                              value: `${currentHotMeta.share24h}건`,
                              toneClass:
                                'border-amber-100 bg-[linear-gradient(180deg,#fffbeb_0%,#ffffff_100%)] text-amber-500',
                            }
                          : null,
                      ].filter(Boolean) as Array<{
                        key: string
                        label: string
                        value: string
                        toneClass: string
                      }>

                      const quietSignal =
                        currentHotMeta.vote1h <= 2 &&
                        currentHotMeta.comment1h <= 1 &&
                        currentHotMeta.share24h === 0

                      if (quietSignal) {
                        return (
                          <div className="mt-3 rounded-2xl border border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] px-3 py-2.5 text-[11px] shadow-[0_4px_12px_rgba(15,23,42,0.04)]">
                            <div className="font-bold text-slate-600">
                              반응 올라오는 중
                            </div>
                            <div className="mt-1 text-slate-400">
                              댓글이나 공유가 붙기 시작하면 여기서 바로 보여줌
                            </div>
                          </div>
                        )
                      }

                      return (
                        <div
                          className={`mt-3 grid gap-2 text-center text-[11px] ${signalCards.length === 1 ? 'grid-cols-1' : signalCards.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}
                        >
                          {signalCards.map((item) => (
                            <div
                              key={item.key}
                              className={`rounded-2xl border px-2.5 py-2 shadow-[0_4px_12px_rgba(15,23,42,0.04)] ${item.toneClass}`}
                            >
                              <div>{item.label}</div>
                              <div className="mt-1 text-sm font-black text-slate-900">
                                {item.value}
                              </div>
                            </div>
                          ))}
                        </div>
                      )
                    })()
                  : null}
              </div>

              {(!currentPost.hidden || adminMode) && (
                <div className="mt-4 space-y-3">
                  <div className="overflow-hidden rounded-[28px] border border-slate-200/90 bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] p-4 shadow-[0_16px_34px_rgba(15,23,42,0.07)]">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-[11px] font-black tracking-[0.18em] text-slate-400">
                          선택의 순간
                        </div>
                        <div className="mt-1 text-[19px] font-black tracking-[-0.04em] text-slate-950">
                          {votes[currentPost.id]
                            ? dopamineResultTitle
                            : '내 생각은 어느 쪽에 가까워?'}
                        </div>
                      </div>
                      <div className="shrink-0 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-black text-slate-700 shadow-[0_8px_18px_rgba(15,23,42,0.05)]">
                        {votes[currentPost.id] ? '분위기 공개' : '선택 전'}
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {dopamineLiveEvents.slice(0, 3).map((event) => (
                        <div
                          key={event}
                          className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-bold text-slate-600 shadow-[0_6px_14px_rgba(15,23,42,0.04)]"
                        >
                          {event}
                        </div>
                      ))}
                    </div>
                    <div className="mt-3 rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-[12px] font-semibold leading-5 text-slate-600">
                      {dopamineResultHelper}
                    </div>
                  </div>
                  <VoteOption
                    active={votes[currentPost.id] === 'left'}
                    label={currentPost.leftLabel}
                    value={displayedPercent.left}
                    showValue={!!votes[currentPost.id]}
                    previewTitle={currentPreVoteSignalTitle}
                    previewHelper={currentPreVoteSignalHelper}
                    onClick={() => void handleVote('left')}
                    disabled={isVoting}
                  />
                  <div className="flex items-center gap-3 px-1">
                    <div className="h-px flex-1 bg-slate-200" />
                    <div className="text-[11px] font-black tracking-[0.16em] text-slate-400">
                      또는
                    </div>
                    <div className="h-px flex-1 bg-slate-200" />
                  </div>
                  <VoteOption
                    active={votes[currentPost.id] === 'right'}
                    label={currentPost.rightLabel}
                    value={displayedPercent.right}
                    showValue={!!votes[currentPost.id]}
                    previewTitle={currentPreVoteSignalTitle}
                    previewHelper={currentPreVoteSignalHelper}
                    onClick={() => void handleVote('right')}
                    disabled={isVoting}
                  />

                  {votes[currentPost.id] ? (
                    <div className="space-y-4">
                      {(currentResultEmotion ||
                        currentMinorityLabel ||
                        currentTensionMeta ||
                        votes[currentPost.id]) && (
                        <div className="rounded-[24px] border border-slate-200/80 bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] p-3.5 shadow-[0_10px_24px_rgba(15,23,42,0.06)]">
                          <div className="flex flex-wrap items-center gap-2">
                            {currentTensionMeta ? (
                              <div
                                className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-black ${currentTensionMeta.toneClass}`}
                              >
                                {currentTensionMeta.label}
                              </div>
                            ) : null}
                            {currentResultEmotion ? (
                              <div className="inline-flex rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-[11px] font-black text-rose-700">
                                {currentResultEmotion}
                              </div>
                            ) : null}
                            {currentMinorityLabel ? (
                              <div
                                className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-black ${currentMinorityLabel.toneClass}`}
                              >
                                {currentMinorityLabel.text}
                              </div>
                            ) : null}
                          </div>

                          {votes[currentPost.id] ? (
                            <div className="mt-3 rounded-2xl border border-slate-200/80 bg-white px-3 py-3 shadow-[0_6px_14px_rgba(15,23,42,0.04)]">
                              <div className="flex items-end justify-between gap-3">
                                <div>
                                  <div className="text-[11px] font-extrabold tracking-[0.14em] text-slate-400">
                                    LIVE RESULT
                                  </div>
                                  <div className="mt-1 text-base font-black text-slate-900">
                                    지금 사람들 반응
                                  </div>
                                </div>
                                <div className="inline-flex rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-[10px] font-black text-blue-700">
                                  결과 보기
                                </div>
                              </div>
                              <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
                                <div className="text-base font-black text-slate-900">
                                  {liveResultPercentText}
                                </div>
                                <div className="mt-1 text-[12px] text-slate-500">
                                  사람들이 계속 들어오고 있어서 결과는 조금씩
                                  달라질 수 있음
                                </div>
                              </div>

                              <div className="mt-3 text-[13px] font-semibold text-slate-600">
                                {currentTension?.isFlipImminent
                                  ? currentTensionMeta.helper
                                  : currentMinorityLabel
                                    ? currentMinorityLabel.helper
                                    : currentResultEmotion === '🔥 개싸움'
                                      ? '지금 들어온 사람도 바로 갈릴 가능성이 높음.'
                                      : currentResultEmotion === '👀 팽팽'
                                        ? '한두 표만 더 들어와도 분위기가 바뀔 수 있음.'
                                        : currentResultEmotion ===
                                            '⚡ 기우는 중'
                                          ? '조금씩 한쪽으로 기울지만 아직 안 끝났다.'
                                          : currentTensionMeta
                                            ? currentTensionMeta.helper
                                            : '지금은 한쪽으로 몰렸지만 댓글에서 다시 불붙을 수 있음.'}
                              </div>

                              {!latestOutcome ? (
                                <div className="mt-3 rounded-[22px] border border-[#dbe7ff] bg-[linear-gradient(180deg,#ffffff_0%,#f4f8ff_100%)] px-3 py-3 shadow-[0_10px_20px_rgba(79,124,255,0.10)]">
                                  <div className="flex items-start justify-between gap-3">
                                    <div>
                                      <div className="text-[11px] font-extrabold tracking-[0.14em] text-[#4f7cff]">
                                        WATCHLIST
                                      </div>
                                      <div className="mt-1 text-[15px] font-black tracking-[-0.01em] text-slate-900">
                                        👀 이 글 결말이 궁금함?
                                      </div>
                                      <div className="mt-1 text-[12px] leading-5 text-slate-600">
                                        {currentWatchlisted
                                          ? authUser?.id
                                            ? '내 활동 > 결말궁금 에서 계속 확인 가능'
                                            : '이 기기에는 저장됨 · 로그인하면 계속 이어볼 수 있음'
                                          : '후기 올라오면 빨간불로 바로 알려줌'}
                                      </div>
                                    </div>
                                    {currentWatchUnread ? (
                                      <span className="rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-[10px] font-black text-rose-700">
                                        새 후기
                                      </span>
                                    ) : null}
                                  </div>
                                  <button
                                    onClick={() =>
                                      void toggleCurrentPostWatchlist()
                                    }
                                    className={`mt-3 inline-flex items-center rounded-full px-4 py-2 text-[13px] font-black shadow-[0_10px_18px_rgba(79,124,255,0.14)] transition ${
                                      currentWatchlisted
                                        ? 'border border-indigo-200 bg-indigo-50 text-indigo-700'
                                        : 'bg-slate-950 text-white'
                                    }`}
                                  >
                                    {currentWatchlisted
                                      ? '결말궁금 저장됨 ✓'
                                      : '결말궁금 저장'}
                                  </button>
                                </div>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                      )}

                      <div className="rounded-[26px] border border-slate-200/80 bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] p-3.5 shadow-[0_14px_32px_rgba(15,23,42,0.07)]">
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <div className="text-[11px] font-black tracking-[0.16em] text-rose-500">
                              COMMENT ARENA
                            </div>
                            <div className="mt-1 text-[16px] font-black tracking-[-0.03em] text-slate-950">
                              댓글 구경이 진짜 본게임
                            </div>
                          </div>
                          <button
                            onClick={() => {
                              markPostMeaningful(currentPost)
                              setCommentOpen(true)
                            }}
                            className="rounded-full bg-slate-950 px-3 py-2 text-[12px] font-black text-white shadow-[0_10px_22px_rgba(15,23,42,0.22)]"
                          >
                            댓글 보기
                          </button>
                        </div>

                        <div className="mt-3 space-y-2">
                          {dopamineTopComment ? (
                            <button
                              onClick={() => {
                                markPostMeaningful(currentPost)
                                setCommentInitialHighlightId(
                                  dopamineTopComment.id,
                                )
                                setCommentOpen(true)
                              }}
                              className="w-full rounded-2xl border border-rose-100 bg-[linear-gradient(135deg,#fff1f2_0%,#ffffff_100%)] px-3 py-3 text-left shadow-[0_8px_18px_rgba(244,63,94,0.08)]"
                            >
                              <div className="text-[11px] font-black tracking-[0.14em] text-rose-500">
                                🔥 가장 뜨거운 댓글
                              </div>
                              <div className="mt-1 line-clamp-2 text-[14px] font-black leading-5 text-slate-900">
                                “{dopamineTopComment.text}”
                              </div>
                              <div className="mt-1 text-[11px] font-bold text-slate-500">
                                공감 {dopamineTopCommentScore} · 바로 반박하러
                                가기
                              </div>
                            </button>
                          ) : (
                            <button
                              onClick={() => {
                                markPostMeaningful(currentPost)
                                setCommentInitialHighlightId(null)
                                setCommentOpen(true)
                              }}
                              className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-left shadow-[0_8px_18px_rgba(15,23,42,0.05)]"
                            >
                              <div className="text-[11px] font-black tracking-[0.14em] text-slate-400">
                                FIRST COMMENT
                              </div>
                              <div className="mt-1 text-[14px] font-black text-slate-900">
                                첫 댓글 달면 이 판 분위기 바로 바뀜
                              </div>
                            </button>
                          )}

                          {dopamineCounterComment ? (
                            <button
                              onClick={() => {
                                markPostMeaningful(currentPost)
                                setCommentInitialHighlightId(
                                  dopamineCounterComment.id,
                                )
                                setCommentOpen(true)
                              }}
                              className="w-full rounded-2xl border border-blue-100 bg-[linear-gradient(135deg,#eff6ff_0%,#ffffff_100%)] px-3 py-3 text-left shadow-[0_8px_18px_rgba(59,130,246,0.08)]"
                            >
                              <div className="text-[11px] font-black tracking-[0.14em] text-blue-500">
                                🥊 반박 많이 받은 댓글
                              </div>
                              <div className="mt-1 line-clamp-2 text-[14px] font-black leading-5 text-slate-900">
                                “{dopamineCounterComment.text}”
                              </div>
                              <div className="mt-1 text-[11px] font-bold text-slate-500">
                                반박 {dopamineCounterReactionCount} · 대댓글{' '}
                                {dopamineCounterReplyCount} · 해당 댓글 보기
                              </div>
                            </button>
                          ) : null}
                        </div>
                      </div>

                      <div className="rounded-[24px] border border-slate-200/80 bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] p-3.5 shadow-[0_10px_24px_rgba(15,23,42,0.06)]">
                        <div className="text-[11px] font-extrabold tracking-[0.14em] text-slate-400">
                          DRAMA SIGNAL
                        </div>
                        <div className="mt-3 space-y-2">
                          {currentFlipDrama ? (
                            <div className="rounded-2xl border border-slate-200/80 bg-white px-3 py-3">
                              <div
                                className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-black ${currentFlipDrama.toneClass}`}
                              >
                                {currentFlipDrama.text}
                              </div>
                              <div className="mt-2 text-[13px] font-semibold text-slate-600">
                                {currentFlipDrama.helper}
                              </div>
                            </div>
                          ) : null}
                          {currentShadowDrama ? (
                            <div className="rounded-2xl border border-slate-200/80 bg-white px-3 py-3">
                              <div
                                className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-black ${currentShadowDrama.toneClass}`}
                              >
                                {currentShadowDrama.text}
                              </div>
                              <div className="mt-2 text-[13px] font-semibold text-slate-600">
                                {currentShadowDrama.helper}
                              </div>
                            </div>
                          ) : null}
                          {currentChoicePathTop && choicePathNextPost ? (
                            <button
                              onClick={() =>
                                moveToPostWithGuard(choicePathNextPost.id)
                              }
                              className="w-full rounded-2xl border border-[#dbe7ff] bg-[linear-gradient(180deg,#ffffff_0%,#f4f8ff_100%)] px-3 py-3 text-left"
                            >
                              <div className="text-[11px] font-extrabold tracking-[0.14em] text-[#4f7cff]">
                                SAME SIDE NEXT
                              </div>
                              <div className="mt-1 text-sm font-black text-slate-900">
                                너처럼 고른 사람들 다음으로 이 글 봄
                              </div>
                              <div className="mt-1 line-clamp-1 text-[13px] text-slate-600">
                                {choicePathNextPost.title}
                              </div>
                              <div className="mt-1 text-[12px] text-slate-500">
                                같은 선택 흐름에서 {currentChoicePathTop.count}
                                번 이어짐
                              </div>
                            </button>
                          ) : null}
                          {!currentFlipDrama &&
                          !currentShadowDrama &&
                          !(currentChoicePathTop && choicePathNextPost) ? (
                            <div className="rounded-2xl border border-slate-200/80 bg-white px-3 py-3">
                              <div className="inline-flex rounded-full border border-slate-200 bg-white px-3 py-1 text-slate-500 text-[11px] font-black text-slate-600">
                                지금은 조용한 판
                              </div>
                              <div className="mt-2 text-[13px] font-semibold text-slate-600">
                                아직 크게 흔들린 신호는 없지만 댓글이나 다음
                                반응에서 다시 붙을 수 있음.
                              </div>
                            </div>
                          ) : null}
                        </div>
                      </div>

                      <div className="rounded-[24px] border border-slate-200/80 bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] p-3.5 shadow-[0_10px_24px_rgba(15,23,42,0.06)]">
                        <div className="text-[11px] font-extrabold tracking-[0.14em] text-slate-400">
                          QUICK REACTION
                        </div>
                        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                          {QUICK_REACTION_ORDER.map((reactionType) => {
                            const meta = POST_REACTION_META[reactionType]
                            const count = Number(
                              currentPostReactionSummary[reactionType] ?? 0,
                            )
                            const active =
                              !!myPostReactions[
                                `${currentPost.id}:${reactionType}`
                              ]
                            return (
                              <button
                                key={reactionType}
                                onClick={() => void reactToPost(reactionType)}
                                className={`rounded-2xl border px-3 py-3 text-[13px] font-bold shadow-[0_8px_18px_rgba(15,23,42,0.05)] transition active:scale-[0.98] ${active ? meta.activeClass : meta.idleClass}`}
                              >
                                <div className="flex items-center justify-center gap-1">
                                  <span>{meta.label}</span>
                                </div>
                                <div className="mt-1 text-[11px] font-semibold opacity-80">
                                  {count > 0 ? `${count}명` : '첫 반응'}
                                </div>
                              </button>
                            )
                          })}
                        </div>

                        {latestOutcome ? (
                          <div className="mt-3 rounded-2xl border border-slate-200/80 bg-white px-3 py-3 text-[13px] font-semibold text-slate-700 shadow-[0_6px_14px_rgba(15,23,42,0.04)]">
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <div className="text-[11px] font-extrabold tracking-[0.14em] text-slate-400">
                                  {getOutcomeLabel(latestOutcome.outcomeType)}
                                </div>
                                {currentWatchUnread ? (
                                  <span className="rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[10px] font-black text-rose-700">
                                    새 후기
                                  </span>
                                ) : null}
                              </div>
                              {canWriteOutcome ? (
                                <button
                                  onClick={() => setOutcomeModalOpen(true)}
                                  className="rounded-full border border-[#dbe7ff] bg-[#f4f8ff] px-2.5 py-1 text-[11px] font-bold text-[#4f7cff]"
                                >
                                  {canAdminWriteOutcome
                                    ? '관리자 후기 등록'
                                    : '후기 추가'}
                                </button>
                              ) : null}
                            </div>
                            <div className="mt-1">
                              {latestOutcome.summary || '작성자 후기가 등록됨'}
                            </div>
                          </div>
                        ) : latestOutcome ? (
                          <button
                            onClick={() => void toggleCurrentPostWatchlist()}
                            className="mt-3 w-full rounded-2xl border border-amber-200 bg-[linear-gradient(180deg,#fffdf7_0%,#fff7db_100%)] px-4 py-3 text-left shadow-[0_8px_18px_rgba(250,204,21,0.12)]"
                          >
                            <div className="text-[11px] font-extrabold tracking-[0.14em] text-amber-600">
                              OUTCOME TEASER
                            </div>
                            <div className="mt-1 text-sm font-bold text-slate-900">
                              후기 도착 · 저장하면 결말까지 공개
                            </div>
                            <div className="mt-1 text-xs text-slate-500">
                              지금은 일부만 열려 있음. 결말궁금에 넣으면 이 글의
                              이후 상황까지 바로 확인 가능
                            </div>
                          </button>
                        ) : canWriteOutcome ? (
                          <button
                            onClick={() => setOutcomeModalOpen(true)}
                            className="mt-3 w-full rounded-2xl border border-[#dbe7ff] bg-[linear-gradient(180deg,#ffffff_0%,#f4f8ff_100%)] px-4 py-3 text-left shadow-[0_8px_18px_rgba(79,124,255,0.08)]"
                          >
                            <div className="text-[11px] font-extrabold tracking-[0.14em] text-[#4f7cff]">
                              AUTHOR UPDATE
                            </div>
                            <div className="mt-1 text-sm font-bold text-slate-900">
                              {outcomeActionLabel}
                            </div>
                            <div className="mt-1 text-xs text-slate-500">
                              이 글의 이후 상황이나 결말을 짧게 등록할 수 있음
                            </div>
                          </button>
                        ) : null}
                      </div>

                      <button
                        onClick={() => {
                          if (choicePathNextPost) {
                            moveToPostWithGuard(choicePathNextPost.id)
                            return
                          }
                          if (queuedNextPost?.post) {
                            moveToPostWithGuard(queuedNextPost.post.id)
                            return
                          }
                          handleNextWithGuard()
                        }}
                        className="w-full rounded-[24px] border border-slate-900 bg-slate-950 px-4 py-3.5 text-center text-white transition-all shadow-[0_16px_30px_rgba(15,23,42,0.22)]"
                      >
                        <div className="text-xs font-black text-white/70">
                          NEXT DOPAMINE · {nextRecommendationReason}
                        </div>
                        <div className="mt-1 text-base font-black text-white">
                          {nextRecommendationTitle}
                        </div>
                        <div className="mt-1 text-xs font-semibold text-white/60">
                          {nextRecommendationHelper}
                        </div>
                      </button>

                      {shouldRenderKakaoHeavyBlocks &&
                        controversialPosts.length > 0 && (
                          <div className="rounded-[24px] border border-white/80 bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] p-3.5 shadow-[0_10px_24px_rgba(15,23,42,0.06)]">
                            <div className="mb-3 text-sm font-bold text-slate-900">
                              지금 들어가면 바로 갈릴 논쟁 TOP3
                            </div>
                            <div className="space-y-2">
                              {controversialPosts.map((item) => (
                                <button
                                  key={item.id}
                                  onClick={() => moveToPostWithGuard(item.id)}
                                  className="w-full rounded-2xl border border-slate-100 bg-white px-4 py-3 text-left transition hover:-translate-y-0.5 hover:bg-slate-50"
                                >
                                  <div className="text-sm font-semibold text-slate-900">
                                    {item.title}
                                  </div>
                                  <div className="mt-1 text-xs text-slate-500">
                                    {item.total}명 참여 · 의견 팽팽
                                  </div>
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                      {shouldRenderKakaoHeavyBlocks && !isViewingSharedPost ? (
                        <div className="grid grid-cols-2 gap-1.5">
                          <button
                            onClick={() => void shareCurrentPost()}
                            className="rounded-[20px] bg-[linear-gradient(135deg,#fde047_0%,#facc15_100%)] px-4 py-3 text-sm font-black text-slate-900 shadow-[0_12px_24px_rgba(250,204,21,0.24)]"
                          >
                            친구한테 보내기
                          </button>
                          <button
                            onClick={openShareInbox}
                            className="relative rounded-[20px] border border-[#dbe7ff] bg-[linear-gradient(180deg,#ffffff_0%,#f4f8ff_100%)] px-4 py-3 text-sm font-black text-slate-900 shadow-[0_12px_24px_rgba(79,124,255,0.10)]"
                          >
                            보낸 공유함
                            {shareInboxUnreadCount > 0 ? (
                              <span className="absolute right-2 top-2 inline-flex min-w-[22px] items-center justify-center rounded-full bg-emerald-500 px-1.5 py-0.5 text-[10px] font-extrabold text-white shadow-[0_8px_16px_rgba(16,185,129,0.24)]">
                                {shareInboxUnreadCount}
                              </span>
                            ) : shareInboxItems.length > 0 ? (
                              <span className="absolute right-2 top-2 inline-flex min-w-[22px] items-center justify-center rounded-full bg-slate-900 px-1.5 py-0.5 text-[10px] font-extrabold text-white shadow-[0_8px_16px_rgba(15,23,42,0.18)]">
                                {shareInboxItems.length}
                              </span>
                            ) : null}
                          </button>
                        </div>
                      ) : null}

                      {isViewingSharedPost ? (
                        <div
                          className={`rounded-[24px] p-4 ${isSharedOwnerViewingPost ? 'border border-[#dbe7ff] bg-[linear-gradient(180deg,#ffffff_0%,#f4f8ff_100%)] shadow-[0_12px_26px_rgba(79,124,255,0.10)]' : 'border border-[#f5e3a3] bg-[linear-gradient(180deg,#fffdf5_0%,#fff7db_100%)] shadow-[0_12px_26px_rgba(245,158,11,0.10)]'}`}
                        >
                          <div className="flex items-start justify-between gap-3 sm:gap-4">
                            <div className="min-w-0 flex-1 pr-1">
                              <div
                                className={`text-[11px] font-extrabold tracking-[0.18em] ${isSharedOwnerViewingPost ? 'text-[#4f7cff]' : 'text-amber-600'}`}
                              >
                                {isSharedOwnerViewingPost
                                  ? 'LIVE SHARE'
                                  : 'FRIEND REACTION'}
                              </div>
                              <div className="mt-1 text-[17px] leading-[1.32] font-black tracking-[-0.02em] text-slate-900 sm:text-[18px]">
                                {isSharedOwnerViewingPost
                                  ? shareResponseTotal > 0
                                    ? '친구 반응이 실시간으로 들어오는 중'
                                    : '친구 응답 기다리는 중'
                                  : '친구들 반응 모아보기'}
                              </div>
                            </div>
                            <div
                              className={`shrink-0 whitespace-nowrap rounded-full border bg-white/95 px-4 py-2 text-[12px] font-extrabold leading-none shadow-[0_8px_18px_rgba(15,23,42,0.06)] ${isSharedOwnerViewingPost ? 'border-[#d6e4ff] text-[#4f7cff]' : 'border-amber-200 text-amber-700'}`}
                            >
                              {isSharedOwnerViewingPost
                                ? '실시간 반영'
                                : '익명 집계'}
                            </div>
                          </div>

                          {isSharedOwnerViewingPost &&
                          !showOwnerShareResults ? (
                            <div className="mt-3 space-y-3">
                              <div
                                className={`rounded-2xl border px-4 py-3.5 text-[15px] leading-7 font-semibold transition-all duration-300 ${sharePulse ? 'border-rose-100 bg-[linear-gradient(135deg,#ecfdf5_0%,#f0fdf4_100%)] text-rose-600 shadow-[0_12px_26px_rgba(16,185,129,0.10)]' : 'border-slate-200/80 bg-white text-slate-700'}`}
                              >
                                {shareResponseTotal === 0
                                  ? '아직 친구 반응 없음. 링크를 더 보내서 첫 응답을 받아봐.'
                                  : ownerShareDelta > 0
                                    ? `방금 친구 응답 +${ownerShareDelta}. 지금 보면 판이 더 재밌음.`
                                    : shareResponseTotal === 1
                                      ? '첫 반응 도착. 한 명 더 모이면 진짜 갈리는지 보이기 시작함.'
                                      : shareResponseTotal === 2
                                        ? '지금부터 재밌는 구간. 한 명만 더 오면 분위기가 선명해짐.'
                                        : `친구 응답 ${shareResponseTotal}개 도착. 결과 보면 어디로 기우는지 바로 보임.`}
                              </div>

                              <div className="grid grid-cols-2 gap-1.5">
                                <button
                                  onClick={() => setShowOwnerShareResults(true)}
                                  className={`rounded-[18px] px-4 py-3 text-sm font-black text-white shadow-[0_14px_26px_rgba(15,23,42,0.24)] transition-all duration-300 ${sharePulse ? 'scale-[1.02] bg-[linear-gradient(135deg,#bbf7d0_0%,#86efac_48%,#4ade80_100%)]' : 'bg-slate-950 text-white'}`}
                                >
                                  {ownerShareDelta > 0
                                    ? `결과 보기 +${ownerShareDelta}`
                                    : '결과 보기'}
                                </button>
                                <button
                                  onClick={() => void shareCurrentPost()}
                                  className="rounded-[18px] bg-[linear-gradient(135deg,#fde047_0%,#facc15_100%)] px-4 py-3 text-sm font-black text-slate-900 shadow-[0_12px_24px_rgba(250,204,21,0.24)]"
                                >
                                  친구 더 보내기
                                </button>
                              </div>
                              {nextHookPost ? (
                                <button
                                  onClick={handleNextWithGuard}
                                  className="w-full rounded-[18px] border border-slate-200/80 bg-white px-4 py-3 text-left text-sm font-semibold text-slate-700 shadow-[0_8px_18px_rgba(15,23,42,0.05)]"
                                >
                                  <div className="text-[11px] font-extrabold tracking-[0.16em] text-slate-400">
                                    NEXT HOOK
                                  </div>
                                  <div className="mt-1 line-clamp-1 text-sm font-black text-slate-900">
                                    {nextHookPost.title}
                                  </div>
                                  <div className="mt-1 text-[12px] text-slate-500">
                                    결과 보기 전에 다른 논쟁 하나 더 보면 더
                                    오래 머물게 됨
                                  </div>
                                </button>
                              ) : null}
                            </div>
                          ) : (
                            <>
                              <div className="mt-3 rounded-2xl border border-slate-200/80 bg-white px-3 py-3 shadow-[0_6px_14px_rgba(15,23,42,0.04)]">
                                <div className="flex items-center justify-between gap-2">
                                  <div className="text-[11px] font-extrabold tracking-[0.14em] text-slate-400">
                                    전체 결과
                                  </div>
                                  <div className="text-[11px] font-bold text-slate-500">
                                    {currentPost.leftVotes +
                                      currentPost.rightVotes}
                                    명 참여
                                  </div>
                                </div>
                                <div className="mt-3 grid grid-cols-2 gap-2">
                                  <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 px-3 py-3 text-center">
                                    <div className="text-[11px] text-slate-400">
                                      전체 {currentPost.leftLabel}
                                    </div>
                                    <div className="mt-1 text-lg font-black text-slate-900">
                                      {currentPost.leftVotes}명
                                    </div>
                                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
                                      <div
                                        className="h-full rounded-full bg-[#4f7cff] transition-all duration-500"
                                        style={{
                                          width: `${Math.max(getPercentPair(currentPost.leftVotes, currentPost.rightVotes).left, currentPost.leftVotes + currentPost.rightVotes === 0 ? 0 : 8)}%`,
                                        }}
                                      />
                                    </div>
                                  </div>
                                  <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 px-3 py-3 text-center">
                                    <div className="text-[11px] text-slate-400">
                                      전체 {currentPost.rightLabel}
                                    </div>
                                    <div className="mt-1 text-lg font-black text-slate-900">
                                      {currentPost.rightVotes}명
                                    </div>
                                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
                                      <div
                                        className="h-full rounded-full bg-[#facc15] transition-all duration-500"
                                        style={{
                                          width: `${Math.max(getPercentPair(currentPost.leftVotes, currentPost.rightVotes).right, currentPost.leftVotes + currentPost.rightVotes === 0 ? 0 : 8)}%`,
                                        }}
                                      />
                                    </div>
                                  </div>
                                </div>
                              </div>

                              <div className="mt-3 rounded-2xl border border-slate-200/80 bg-white px-3 py-3 shadow-[0_6px_14px_rgba(15,23,42,0.04)]">
                                <div className="flex items-center justify-between gap-2">
                                  <div className="text-[11px] font-extrabold tracking-[0.14em] text-slate-400">
                                    친구 결과
                                  </div>
                                  <div
                                    className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-extrabold ${shareTensionMeta.toneClass}`}
                                  >
                                    {shareTensionMeta.label}
                                  </div>
                                </div>
                                <div className="mt-3 grid grid-cols-2 gap-2">
                                  <div
                                    className={`rounded-2xl border px-3 py-3 text-center transition-all duration-300 ${sharePulse ? 'border-rose-100 bg-[linear-gradient(135deg,#ffffff_0%,#ecfdf5_100%)] shadow-[0_14px_26px_rgba(16,185,129,0.12)] scale-[1.02]' : 'border-slate-200/80 bg-slate-50/80'}`}
                                  >
                                    <div className="text-[11px] text-slate-400">
                                      친구들 {currentPost.leftLabel}
                                    </div>
                                    <div className="mt-1 flex items-center justify-center gap-1 text-lg font-black text-slate-900">
                                      <span>{shareStats.left}명</span>
                                      {sharePulse &&
                                      shareStats.left > 0 &&
                                      shareStats.left >= shareStats.right ? (
                                        <span className="rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-extrabold text-emerald-600">
                                          HOT
                                        </span>
                                      ) : null}
                                    </div>
                                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
                                      <div
                                        className={`h-full rounded-full transition-all duration-500 ${sharePulse ? 'bg-emerald-400' : 'bg-[#4f7cff]'}`}
                                        style={{
                                          width: `${shareResponseTotal === 0 ? 0 : Math.max(8, Math.round((shareStats.left / shareResponseTotal) * 100))}%`,
                                        }}
                                      />
                                    </div>
                                  </div>
                                  <div
                                    className={`rounded-2xl border px-3 py-3 text-center transition-all duration-300 ${sharePulse ? 'border-rose-100 bg-[linear-gradient(135deg,#ffffff_0%,#ecfdf5_100%)] shadow-[0_14px_26px_rgba(16,185,129,0.12)] scale-[1.02]' : 'border-slate-200/80 bg-slate-50/80'}`}
                                  >
                                    <div className="text-[11px] text-slate-400">
                                      친구들 {currentPost.rightLabel}
                                    </div>
                                    <div className="mt-1 flex items-center justify-center gap-1 text-lg font-black text-slate-900">
                                      <span>{shareStats.right}명</span>
                                      {sharePulse &&
                                      shareStats.right > 0 &&
                                      shareStats.right > shareStats.left ? (
                                        <span className="rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-extrabold text-emerald-600">
                                          HOT
                                        </span>
                                      ) : null}
                                    </div>
                                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
                                      <div
                                        className={`h-full rounded-full transition-all duration-500 ${sharePulse ? 'bg-emerald-400' : 'bg-[#4f7cff]'}`}
                                        style={{
                                          width: `${shareResponseTotal === 0 ? 0 : Math.max(8, Math.round((shareStats.right / shareResponseTotal) * 100))}%`,
                                        }}
                                      />
                                    </div>
                                  </div>
                                </div>
                              </div>

                              <div className="mt-3 grid grid-cols-2 gap-2">
                                <div className="rounded-2xl border border-slate-200/80 bg-white px-3 py-3 shadow-[0_6px_14px_rgba(15,23,42,0.04)]">
                                  <div className="text-[11px] text-slate-400">
                                    내 선택
                                  </div>
                                  <div className="mt-1 text-sm font-black text-slate-900">
                                    {ownerChoiceInsight.ownerLabel}
                                  </div>
                                  <div
                                    className={`mt-2 inline-flex rounded-full border px-2 py-0.5 text-[10px] font-extrabold ${ownerChoiceInsight.relationTone}`}
                                  >
                                    {ownerChoiceInsight.relationLabel}
                                  </div>
                                </div>
                                <div className="rounded-2xl border border-slate-200/80 bg-white px-3 py-3 shadow-[0_6px_14px_rgba(15,23,42,0.04)]">
                                  <div className="text-[11px] text-slate-400">
                                    전체 흐름
                                  </div>
                                  <div className="mt-1 text-sm font-black text-slate-900">
                                    {currentPost.leftVotes ===
                                    currentPost.rightVotes
                                      ? '전체 의견 팽팽'
                                      : currentPost.leftVotes >
                                          currentPost.rightVotes
                                        ? `${currentPost.leftLabel} 우세`
                                        : `${currentPost.rightLabel} 우세`}
                                  </div>
                                  <div
                                    className={`mt-2 inline-flex rounded-full border px-2 py-0.5 text-[10px] font-extrabold ${getShareTensionMeta(currentPost.leftVotes, currentPost.rightVotes).toneClass}`}
                                  >
                                    {
                                      getShareTensionMeta(
                                        currentPost.leftVotes,
                                        currentPost.rightVotes,
                                      ).label
                                    }
                                  </div>
                                </div>
                              </div>

                              <div className="mt-3 rounded-2xl border border-slate-200/80 bg-white/90 px-3 py-2.5 text-xs text-slate-600 shadow-[0_6px_14px_rgba(15,23,42,0.04)]">
                                익명 전체 흐름 먼저 보고, 친구들 반응이 얼마나
                                다른지도 같이 보는 판임 ·{' '}
                                {ownerChoiceInsight.helper}
                              </div>

                              {nextHookPost ? (
                                <button
                                  onClick={handleNextWithGuard}
                                  className="mt-3 w-full rounded-[20px] border border-[#dbe7ff] bg-[linear-gradient(180deg,#ffffff_0%,#f4f8ff_100%)] px-4 py-3 text-left shadow-[0_10px_24px_rgba(79,124,255,0.10)]"
                                >
                                  <div className="text-[11px] font-extrabold tracking-[0.16em] text-[#4f7cff]">
                                    NEXT HOOK
                                  </div>
                                  <div className="mt-1 text-sm font-black text-slate-900">
                                    이 판 본 사람은 이것도 많이 눌러봄
                                  </div>
                                  <div className="mt-1 line-clamp-1 text-[13px] text-slate-600">
                                    {nextHookPost.title}
                                  </div>
                                </button>
                              ) : null}

                              <div className="mt-3 grid grid-cols-2 gap-2">
                                {isSharedOwnerViewingPost ? (
                                  <button
                                    onClick={() =>
                                      setShowOwnerShareResults(false)
                                    }
                                    className="rounded-[18px] border border-slate-200/80 bg-white px-4 py-3 text-sm font-bold text-slate-700 shadow-[0_8px_18px_rgba(15,23,42,0.05)]"
                                  >
                                    결과 접기
                                  </button>
                                ) : null}
                                <button
                                  onClick={() => void shareCurrentPost()}
                                  className={`${isSharedOwnerViewingPost ? '' : 'col-span-2 '}rounded-[18px] bg-[linear-gradient(135deg,#fde047_0%,#facc15_100%)] px-4 py-3 text-sm font-black text-slate-900 shadow-[0_12px_24px_rgba(250,204,21,0.24)]`}
                                >
                                  친구 더 보내기
                                </button>
                              </div>

                              {isSharedOwnerViewingPost ? (
                                <button
                                  onClick={openShareInbox}
                                  className="mt-2.5 w-full rounded-[18px] border border-[#dbe7ff] bg-white/90 px-4 py-3 text-sm font-black text-[#4f7cff] shadow-[0_8px_18px_rgba(79,124,255,0.08)]"
                                >
                                  보낸 공유함에서 다른 논쟁도 보기
                                </button>
                              ) : null}
                            </>
                          )}
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              )}

              <div className="mt-4 rounded-[22px] border border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] px-3.5 py-3 shadow-[0_10px_20px_rgba(15,23,42,0.06)]">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-full border px-2.5 py-1 text-[11px] font-extrabold ${getLevelTheme(levelInfo.level).chipClass}`}
                  >
                    {getLevelTheme(levelInfo.level).icon} Lv.{levelInfo.level}{' '}
                    {levelInfo.label}
                  </span>
                  {featuredBadge ? (
                    (() => {
                      const badgeTheme = getBadgeTheme(featuredBadge)
                      return (
                        <span
                          className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${badgeTheme.pillClass}`}
                        >
                          {badgeTheme.icon} {featuredBadge}
                        </span>
                      )
                    })()
                  ) : (
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-bold text-slate-600">
                      ✨ 첫 뱃지 도전중
                    </span>
                  )}
                </div>
                <div className="mt-2 text-[12px] leading-5 text-slate-600">
                  활동할수록 레벨이 오르고, 행동에 따라 뱃지가 쌓임.
                </div>
              </div>

              <div className="mt-5 border-t border-slate-200 pt-3">
                <div className="mb-3 flex items-center justify-between text-sm text-slate-600">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1">
                      <BarChart3 className="h-4 w-4" />
                      {currentPost.leftVotes + currentPost.rightVotes}
                    </div>

                    <button
                      onClick={() => {
                        markPostMeaningful(currentPost)
                        setCommentOpen(true)
                      }}
                      className="flex items-center gap-1"
                    >
                      <MessageCircle className="h-4 w-4" />
                      {currentPost.comments.length}
                    </button>
                  </div>

                  <div>조회 {currentPost.views}</div>
                </div>
              </div>
            </div>
          </main>

          {!isModalOpen && (
            <div className="fixed bottom-3 left-0 right-0 z-[9999] px-4">
              <div className="mx-auto max-w-[392px] rounded-[24px] border border-white/90 bg-white/92 px-3 pb-[calc(8px+env(safe-area-inset-bottom))] pt-2 backdrop-blur-xl shadow-[0_14px_28px_rgba(148,163,184,0.18),0_2px_8px_rgba(15,23,42,0.04)]">
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={prev}
                    className="rounded-[18px] border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-semibold text-slate-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]"
                  >
                    이전 글
                  </button>

                  <button
                    onClick={handleNextWithGuard}
                    className="rounded-[18px] bg-slate-950 px-4 py-2.5 text-sm font-black text-white shadow-[0_14px_26px_rgba(15,23,42,0.24)] transition active:scale-[0.98]"
                  >
                    다음 글
                  </button>
                </div>
              </div>
            </div>
          )}

          {toast ? (
            <div className="pointer-events-none fixed inset-x-0 bottom-24 z-30 flex justify-center px-4">
              <div className="rounded-full bg-slate-900 px-4 py-2 text-sm font-bold text-white shadow-[0_12px_28px_rgba(15,23,42,0.22)]">
                {toast}
              </div>
            </div>
          ) : null}

          <CommentModal
            post={currentPost}
            open={commentOpen}
            onClose={() => {
              setCommentOpen(false)
              setCommentInitialHighlightId(null)
              requestLightweightMetaRefresh()
            }}
            onAddComment={(text, side, replyToCommentId) =>
              void addComment(text, side, replyToCommentId ?? null)
            }
            onOpenReportComment={openReportComment}
            adminMode={adminMode}
            onAdminRestoreComment={(commentId) =>
              void adminRestoreComment(commentId)
            }
            onAdminDeleteComment={(commentId) =>
              void adminDeleteComment(commentId)
            }
            guestName={profile?.anonymous_name ?? guestName}
            featuredBadge={featuredBadge}
            currentUserLevel={stats.level}
            authorMetaMap={authorMetaMap}
            currentActorKey={authUser?.id ?? voterKey}
            commentReactionMap={commentReactionMap}
            myCommentReactions={myCommentReactions}
            initialHighlightCommentId={commentInitialHighlightId}
            onReactComment={(commentId, reactionType) =>
              void reactToComment(commentId, reactionType)
            }
            onExposeComments={() => {
              // result flow 제거: 댓글은 그냥 바로 보여주기만 함
            }}
          />

          <CreatePostModal
            open={writeOpen}
            onClose={() => setWriteOpen(false)}
            onCreate={(input) => void createPost(input)}
            guestName={profile?.anonymous_name ?? guestName}
          />

          <MyActivityModal
            open={activityOpen}
            onClose={() => {
              setActivityOpen(false)
              refreshWatchlistSignalsAfterAction(80)
            }}
            myPosts={myPosts}
            myComments={myComments}
            watchlistItems={watchlistItems}
            unreadWatchlistCount={unreadWatchlistCount}
            initialTab={activityInitialTab}
            onOpenPost={openPostDirect}
            onOpenWatchlistItem={openWatchlistItemDirect}
            onOpenComment={openCommentDirect}
            onLogout={() => void handleLogout()}
            onLogin={() => void handleGoogleLogin()}
            onMarkAllPostsSeen={() => void markAllMyPostsSeen()}
            onMarkAllCommentsSeen={() => void markAllMyCommentsSeen()}
            onMarkAllWatchlistSeen={() => void markAllWatchlistSeen()}
            profile={profile}
            stats={stats}
            badges={badges}
          />

          <DeletedItemsModal
            open={deletedOpen}
            onClose={() => setDeletedOpen(false)}
            deletedPosts={deletedPosts}
            deletedComments={deletedComments}
            onRestorePost={(postId) => void adminRestoreDeletedPost(postId)}
            onRestoreComment={(commentId) =>
              void adminRestoreDeletedComment(commentId)
            }
          />

          <ShareInboxModal
            open={shareInboxOpen}
            onClose={() => setShareInboxOpen(false)}
            items={shareInboxItems}
            loading={shareInboxLoading}
            onOpenItem={(item) => void openOwnerShareSession(item)}
            onReshare={(item) => void reshareFromInbox(item)}
          />

          <AuthOptionalModal
            open={authOpen}
            onClose={() => setAuthOpen(false)}
            onGoogleLogin={() => void handleGoogleLogin()}
          />

          <OutcomeWriteModal
            open={outcomeModalOpen}
            onClose={() => setOutcomeModalOpen(false)}
            onSubmit={(outcomeType, summary) =>
              void submitOutcome(outcomeType, summary)
            }
            postTitle={currentPost?.title ?? '후기 등록'}
            initialType="author_followup"
          />

          <InquiryCenterModal
            key={inquiryModalKey}
            open={inquiryOpen}
            onClose={() => setInquiryOpen(false)}
            onSubmit={submitInquiry}
          />

          <InquiryAdminModal
            open={inquiryAdminOpen}
            onClose={() => setInquiryAdminOpen(false)}
            items={inquiryAdminItems}
            loading={inquiryAdminLoading}
            onRefresh={() => void loadInquiryAdminItems()}
            onUpdateStatus={(id, status) =>
              void updateInquiryStatus(id, status)
            }
          />

          <ReportModal
            open={reportModal.open}
            onClose={() =>
              setReportModal({
                open: false,
                type: null,
                id: null,
                label: '',
              })
            }
            onSubmit={(reason) => void submitReport(reason)}
            targetLabel={reportModal.label}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-[100dvh] bg-[radial-gradient(circle_at_top,_rgba(79,124,255,0.10),_transparent_30%),linear-gradient(180deg,#f5f7fb_0%,#eef2f7_100%)] text-slate-900 flex items-center justify-center px-6 text-center">
      <div>
        <div className="text-lg font-bold">표시할 글이 없음</div>
        <div className="mt-2 text-sm text-slate-500">
          새 글을 작성하거나 데이터를 다시 불러와줘
        </div>
      </div>
    </div>
  )
}
