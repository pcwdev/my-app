'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  BarChart3,
  Flag,
  Flame,
  Heart,
  MessageCircle,
  MoreHorizontal,
  Plus,
  Send,
  Shield,
  User,
  X,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '@/lib/supabase'

const LIMITS = {
  title: 32,
  content: 220,
  option: 12,
  comment: 60,
}

const categories = ['연애', '직장', '돈', '인간관계', '기타']
const categoryFilters = ['전체', ...categories]
const ageGroups = ['10대', '20대', '30대', '40대', '50대+']
const reportReasons = [
  '욕설/비방',
  '개인정보 노출',
  '허위사실',
  '음란/부적절',
  '도배/광고',
]

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
  hasOutcome: boolean
  unreadOutcome: boolean
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

type MyPostItem = {
  id: number
  postId: number
  title: string
  category: string
  ageGroup: string
}

type MyCommentItem = {
  id: number
  commentId: number
  postId: number
  postTitle: string
  text: string
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
      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
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
      softClass: 'bg-emerald-50 text-emerald-800 border-emerald-200',
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
      pillClass: 'border-emerald-200 bg-emerald-50 text-emerald-800',
      softClass: 'border-emerald-200 bg-emerald-50 text-emerald-800',
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

function getRevealHintLabel(leftVotes: number, rightVotes: number) {
  const left = Math.max(0, Number(leftVotes ?? 0))
  const right = Math.max(0, Number(rightVotes ?? 0))
  const total = left + right

  if (total <= 0) return '첫 반응이 아직 없음'
  if (left === right) return '거의 반반 수준'
  if (left > right * 2 || right > left * 2) return '대부분이 한쪽 의견'
  return '생각보다 더 많이 갈리는 중'
}

function getResultRevealStage(
  unlockLevel: number,
  leftVotes: number,
  rightVotes: number,
  hasOutcome: boolean,
): ResultRevealStage {
  const exact = percent(leftVotes, rightVotes)

  if (unlockLevel >= 4) {
    return {
      level: 4,
      label: hasOutcome ? '결말까지 공개됨' : '최종 결과 공개',
      helper: hasOutcome
        ? '이제 결과뿐 아니라 후기와 결말까지 같이 보면 됨'
        : '정확한 결과가 전부 공개된 상태',
      toneClass: 'border-emerald-200 bg-emerald-50 text-emerald-700',
      leftValue: exact.left,
      rightValue: exact.right,
      showExact: true,
      showOutcome: true,
    }
  }

  if (unlockLevel >= 3) {
    return {
      level: 3,
      label: '정확한 결과 공개',
      helper: '실시간 반응이 계속 들어와 수치는 조금씩 달라질 수 있음',
      toneClass: 'border-blue-200 bg-blue-50 text-blue-700',
      leftValue: exact.left,
      rightValue: exact.right,
      showExact: true,
      showOutcome: false,
    }
  }

  if (unlockLevel >= 2) {
    const stateMeta = getRevealStateLabel(leftVotes, rightVotes)
    return {
      level: 2,
      label: getRevealHintLabel(leftVotes, rightVotes),
      helper: '실시간 반응이 계속 들어와 정확한 수치는 마지막에 공개됨',
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
    label: stateMeta.label,
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
  agree: {
    label: '맞말',
    activeClass: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    idleClass: 'border-slate-200 bg-white text-slate-500',
  },
  disagree: {
    label: '억까',
    activeClass: 'border-rose-200 bg-rose-50 text-rose-700',
    idleClass: 'border-slate-200 bg-white text-slate-500',
  },
  wow: {
    label: '소름',
    activeClass: 'border-violet-200 bg-violet-50 text-violet-700',
    idleClass: 'border-slate-200 bg-white text-slate-500',
  },
  relatable: {
    label: '공감',
    activeClass: 'border-sky-200 bg-sky-50 text-sky-700',
    idleClass: 'border-slate-200 bg-white text-slate-500',
  },
  absurd: {
    label: '어이없음',
    activeClass: 'border-amber-200 bg-amber-50 text-amber-700',
    idleClass: 'border-slate-200 bg-white text-slate-500',
  },
}

const POST_REACTION_META: Record<
  PostReactionType,
  { label: string; activeClass: string; idleClass: string }
> = {
  controversial: {
    label: '개갈림',
    activeClass: 'border-rose-200 bg-rose-50 text-rose-700',
    idleClass: 'border-slate-200 bg-white text-slate-500',
  },
  curious: {
    label: '결말궁금',
    activeClass: 'border-indigo-200 bg-indigo-50 text-indigo-700',
    idleClass: 'border-slate-200 bg-white text-slate-500',
  },
  suspicious: {
    label: '주작같음',
    activeClass: 'border-amber-200 bg-amber-50 text-amber-700',
    idleClass: 'border-slate-200 bg-white text-slate-500',
  },
  minority: {
    label: '내가 소수네',
    activeClass: 'border-fuchsia-200 bg-fuchsia-50 text-fuchsia-700',
    idleClass: 'border-slate-200 bg-white text-slate-500',
  },
  shareworthy: {
    label: '친구보내기',
    activeClass: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    idleClass: 'border-slate-200 bg-white text-slate-500',
  },
}

function getActorUnifiedKey(userId?: string | null, voterKey?: string | null) {
  if (userId) return `user:${userId}`
  if (voterKey) return `voter:${voterKey}`
  return null
}

function getOutcomeTone(outcomeType: PostOutcomeItem['outcomeType']) {
  switch (outcomeType) {
    case 'resolved':
      return 'border-emerald-200 bg-emerald-50 text-emerald-700'
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
      return '결말 나옴'
    case 'update':
      return '후기 있음'
    case 'author_followup':
      return '작성자 후기'
    case 'twist':
      return '반전 있음'
    default:
      return '업데이트'
  }
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
  onClick,
  disabled = false,
}: {
  active: boolean
  label: string
  value: number
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`w-full rounded-[22px] border px-4 py-2.5 text-left transition-all duration-200 ${
        active
          ? 'border-[#cfe0ff] bg-[linear-gradient(180deg,#f7faff_0%,#eaf1ff_100%)] shadow-[0_14px_26px_rgba(79,124,255,0.14)]'
          : 'border-slate-200/80 bg-white shadow-[0_7px_16px_rgba(15,23,42,0.04)]'
      } ${disabled ? 'cursor-not-allowed opacity-70' : 'hover:-translate-y-0.5 hover:bg-slate-50'}`}
    >
      <div className="mb-2 flex items-center justify-between gap-3">
        <span
          className={`inline-flex rounded-xl px-2.5 py-1 text-[12px] font-bold ${
            active ? 'bg-[#4f7cff] text-white' : 'bg-slate-100 text-slate-700'
          }`}
        >
          {label}
        </span>
        <span className="text-[17px] font-extrabold text-slate-900">
          {value}%
        </span>
      </div>
      <div className="h-1.5 w-full rounded-full border border-slate-200 bg-white shadow-[0_4px_10px_rgba(15,23,42,0.04)]">
        <div
          className="h-full rounded-full bg-[#4f7cff] transition-all duration-150 shadow-[0_4px_12px_rgba(79,124,255,0.28)]"
          style={{ width: `${value}%` }}
        />
      </div>
    </button>
  )
})

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
            className="rounded-2xl bg-[#4f7cff] px-4 py-3 font-bold text-white"
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
          로그인하면 내 활동, 포인트, 뱃지 저장용으로 쓸 수 있게 확장하기 좋음.
        </div>

        <div className="space-y-3">
          <button
            onClick={onGoogleLogin}
            className="w-full rounded-2xl bg-[#4f7cff] px-4 py-3 font-bold text-white"
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
  onLikeComment,
  isLiked,
  onOpenReportComment,
  adminMode,
  onAdminRestoreComment,
  onAdminDeleteComment,
  authorMeta,
  reactionSummary = EMPTY_COMMENT_REACTION_SUMMARY,
  myReactionMap = {},
  onReactComment,
}: {
  comment: CommentItem
  leftLabel: string
  rightLabel: string
  onLikeComment: (commentId: number) => void | Promise<void>
  isLiked: boolean
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
      className={`overflow-hidden rounded-[24px] border shadow-[0_14px_30px_rgba(15,23,42,0.06)] ${
        comment.hidden
          ? 'border-red-200 bg-red-50'
          : 'border-white/90 bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(248,250,255,0.98)_100%)]'
      }`}
    >
      <div
        className={`h-1 w-full ${
          comment.hidden
            ? 'bg-red-200'
            : isLeft
              ? 'bg-[linear-gradient(90deg,#60a5fa_0%,#4f7cff_100%)]'
              : 'bg-[linear-gradient(90deg,#8b5cf6_0%,#a78bfa_100%)]'
        }`}
      />
      <div className="p-3.5">
        <div className="mb-2 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-bold ${sideBadgeClass}`}
              >
                {sideLabel}
              </span>
              <span className="max-w-[140px] truncate text-[13px] font-semibold text-slate-900">
                {comment.author}
              </span>
              <span
                className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-extrabold ${levelTheme.softClass}`}
              >
                {levelTheme.icon} Lv.{resolvedMeta.level}
              </span>
              {resolvedMeta.badgeName ? (
                <span
                  className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold ${badgeTheme.softClass}`}
                >
                  {badgeTheme.icon} {resolvedMeta.badgeName}
                </span>
              ) : null}
            </div>
          </div>
        </div>

        <div className="text-[14px] leading-6 tracking-[-0.01em] text-slate-700">
          {comment.hidden ? '신고 누적으로 숨김된 댓글' : comment.text}
        </div>

        {!comment.hidden ? (
          <div className="mt-3 space-y-2.5">
            <div className="flex flex-wrap gap-1.5 text-[11px]">
              {(
                Object.keys(COMMENT_REACTION_META) as CommentReactionType[]
              ).map((reactionType) => {
                const meta = COMMENT_REACTION_META[reactionType]
                const count = Number(reactionSummary[reactionType] ?? 0)
                const active = !!myReactionMap[reactionType]
                return (
                  <button
                    key={reactionType}
                    onClick={() => onReactComment(comment.id, reactionType)}
                    className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 font-bold transition ${active ? meta.activeClass : meta.idleClass}`}
                  >
                    <span>{meta.label}</span>
                    <span>{count}</span>
                  </button>
                )
              })}
            </div>

            <div className="flex items-center justify-between gap-3 text-xs">
              <button
                onClick={() => onLikeComment(comment.id)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 font-semibold transition ${
                  isLiked
                    ? 'border-rose-200 bg-rose-50 text-rose-600'
                    : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
                }`}
              >
                <Heart
                  className={`h-3.5 w-3.5 ${isLiked ? 'fill-[#ef4444]' : ''}`}
                />
                <span>{comment.likes}</span>
              </button>

              <button
                onClick={() => onOpenReportComment(comment.id)}
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-400 transition hover:bg-slate-50 hover:text-slate-600"
                aria-label="댓글 신고"
              >
                <MoreHorizontal className="h-4 w-4" />
              </button>
            </div>
          </div>
        ) : null}

        {adminMode && comment.hidden && (
          <div className="flex flex-wrap items-center gap-2">
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
      label: '작성자 후기',
      helper: '직접 남기는 추가 설명',
    },
    { value: 'update', label: '후기 있음', helper: '중간 진행 상황 공유' },
    { value: 'resolved', label: '결말 나옴', helper: '결과가 확정됨' },
    { value: 'twist', label: '반전 있음', helper: '예상과 다르게 흘러감' },
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
            className="rounded-2xl bg-[#4f7cff] px-4 py-3 font-bold text-white"
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
  onOpenComment,
  onLogout,
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
  onOpenPost: (postId: number) => void
  onOpenComment: (postId: number) => void
  onLogout: () => void
  profile: ProfileRow | null
  stats: UserStatsRow
  badges: string[]
}) {
  const [tab, setTab] = useState<'posts' | 'comments' | 'watchlist'>(initialTab)

  useEffect(() => {
    if (open) setTab(initialTab)
  }, [open, initialTab])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-40 overflow-hidden bg-slate-900/30 backdrop-blur-md">
      <div className="mx-auto flex h-[100svh] w-full min-h-0 max-w-md flex-col overflow-hidden bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] pb-[env(safe-area-inset-bottom)] text-slate-900">
        <div className="shrink-0 flex items-center justify-between border-b border-slate-200/80 px-5 py-4">
          <div>
            <div className="text-lg font-bold">내 활동</div>
            <div className="text-sm text-slate-500">
              로그인 계정으로 남긴 글과 댓글
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white shadow-[0_6px_18px_rgba(15,23,42,0.05)]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="shrink-0 px-5 pt-4">
          {(() => {
            const levelInfo = getLevelInfo(stats.points)
            const levelTheme = getLevelTheme(levelInfo.level)

            return (
              <div className="mb-3 rounded-3xl border border-slate-200 bg-white/95 px-4 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-slate-900">
                      {profile?.anonymous_name ?? '익명 유저'}
                    </div>
                    <div className="mt-2">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-bold ${levelTheme.chipClass}`}
                      >
                        <span>{levelTheme.icon}</span>
                        <span>Lv.{levelInfo.level}</span>
                        <span>{levelInfo.label}</span>
                      </span>
                    </div>
                  </div>
                  <div className="rounded-full bg-[#eef3ff] px-3 py-1 text-xs font-bold text-[#4f7cff]">
                    {stats.points}P
                  </div>
                </div>

                <div className="mt-3">
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
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-2xl bg-slate-50 px-3 py-2">
                    <div className="text-slate-400">판단</div>
                    <div className="mt-1 font-bold text-slate-900">
                      {stats.votes_count}
                    </div>
                  </div>
                  <div className="rounded-2xl bg-slate-50 px-3 py-2">
                    <div className="text-slate-400">댓글</div>
                    <div className="mt-1 font-bold text-slate-900">
                      {stats.comments_count}
                    </div>
                  </div>
                  <div className="rounded-2xl bg-slate-50 px-3 py-2">
                    <div className="text-slate-400">글</div>
                    <div className="mt-1 font-bold text-slate-900">
                      {stats.posts_count}
                    </div>
                  </div>
                  <div className="rounded-2xl bg-slate-50 px-3 py-2">
                    <div className="text-slate-400">받은 공감</div>
                    <div className="mt-1 font-bold text-slate-900">
                      {stats.likes_received}
                    </div>
                  </div>
                </div>

                <div className="mt-3">
                  <div className="mb-2 text-xs font-semibold text-slate-500">
                    획득 뱃지
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {badges.length === 0 ? (
                      <div className="text-xs text-slate-400">
                        아직 획득한 뱃지가 없음
                      </div>
                    ) : (
                      badges.map((badge) => {
                        const badgeTheme = getBadgeTheme(badge)
                        return (
                          <span
                            key={badge}
                            className={`rounded-full border px-3 py-1 text-[11px] font-bold ${badgeTheme.pillClass}`}
                          >
                            {badgeTheme.icon} {badge}
                          </span>
                        )
                      })
                    )}
                  </div>
                </div>
              </div>
            )
          })()}

          <div className="flex gap-2">
            <button
              onClick={() => setTab('posts')}
              className={`rounded-full px-4 py-2 text-[13px] font-bold shadow-sm ${
                tab === 'posts'
                  ? 'bg-[#4f7cff] text-slate-900'
                  : 'bg-slate-100 text-slate-700'
              }`}
            >
              내가 올린 글
            </button>
            <button
              onClick={() => setTab('comments')}
              className={`rounded-full px-4 py-2 text-[13px] font-bold shadow-sm ${
                tab === 'comments'
                  ? 'bg-[#4f7cff] text-slate-900'
                  : 'bg-slate-100 text-slate-700'
              }`}
            >
              내가 남긴 댓글
            </button>
            <button
              onClick={() => setTab('watchlist')}
              className={`rounded-full px-4 py-2 text-[13px] font-bold shadow-sm ${
                tab === 'watchlist'
                  ? 'bg-[#4f7cff] text-slate-900'
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
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3.5 space-y-3.5 [webkit-overflow-scrolling:touch]">
          {tab === 'posts' && myPosts.length === 0 && (
            <div className="text-sm text-slate-500">
              로그인 후 작성한 글이 없음
            </div>
          )}
          {tab === 'comments' && myComments.length === 0 && (
            <div className="text-sm text-slate-500">
              로그인 후 작성한 댓글이 없음
            </div>
          )}
          {tab === 'watchlist' && watchlistItems.length === 0 && (
            <div className="text-sm text-slate-500">
              결말궁금으로 저장한 글이 없음
            </div>
          )}

          {tab === 'posts' &&
            myPosts.map((item) => (
              <button
                key={item.id}
                onClick={() => onOpenPost(item.postId)}
                className="w-full rounded-3xl border border-slate-200/80 bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] p-4 shadow-[0_12px_30px_rgba(15,23,42,0.06)] text-left"
              >
                <div className="text-xs text-slate-500">
                  {item.category} · {item.ageGroup}
                </div>
                <div className="mt-1 font-bold text-slate-900">
                  {item.title}
                </div>
                <div className="mt-2 text-xs text-slate-400">올린 글 보기</div>
              </button>
            ))}

          {tab === 'comments' &&
            myComments.map((item) => (
              <button
                key={item.id}
                onClick={() => onOpenComment(item.postId)}
                className="w-full rounded-3xl border border-slate-200/80 bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] p-4 shadow-[0_12px_30px_rgba(15,23,42,0.06)] text-left"
              >
                <div className="text-xs text-slate-500">{item.postTitle}</div>
                <div className="mt-1 text-sm text-slate-900/85">
                  {item.text}
                </div>
                <div className="mt-2 text-xs text-slate-400">
                  댓글 단 글로 이동
                </div>
              </button>
            ))}

          {tab === 'watchlist' &&
            watchlistItems.map((item) => (
              <button
                key={item.id}
                onClick={() => onOpenPost(item.postId)}
                className="w-full rounded-3xl border border-slate-200/80 bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] p-4 shadow-[0_12px_30px_rgba(15,23,42,0.06)] text-left"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <div className="text-xs text-slate-500">
                    {item.category} · {item.ageGroup}
                  </div>
                  {item.latestOutcomeType ? (
                    <>
                      <span
                        className={`rounded-full border px-2.5 py-1 text-[10px] font-bold ${getOutcomeTone(item.latestOutcomeType)}`}
                      >
                        {getOutcomeLabel(item.latestOutcomeType)}
                      </span>
                      {item.unreadOutcome ? (
                        <span className="rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-[10px] font-black text-rose-700">
                          새 후기
                        </span>
                      ) : null}
                    </>
                  ) : (
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-bold text-slate-500">
                      후기 대기중
                    </span>
                  )}
                </div>
                <div className="mt-1 font-bold text-slate-900">
                  {item.title}
                </div>
                <div className="mt-2 text-xs text-slate-500">
                  {item.latestOutcomeSummary ?? '나중에 결과 보려고 저장한 글'}
                </div>
                <div className="mt-2 text-xs text-slate-400">
                  {item.hasOutcome ? '후기 확인하러 가기' : '결말 기다리는 글'}
                </div>
              </button>
            ))}
        </div>

        <div className="shrink-0 border-t border-slate-200 px-5 py-4">
          <button
            onClick={onLogout}
            className="w-full rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-600"
          >
            로그아웃
          </button>
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
  onLikeComment,
  likedComments,
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
  onReactComment,
  onExposeComments,
}: {
  post: PostItem | null
  open: boolean
  onClose: () => void
  onAddComment: (text: string, side: Side) => void
  onLikeComment: (commentId: number) => void
  likedComments: Record<number, boolean>
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
  onReactComment: (
    commentId: number,
    reactionType: CommentReactionType,
  ) => void | Promise<void>
  onExposeComments?: (count: number) => void
}) {
  const [text, setText] = useState('')
  const [commentSide, setCommentSide] = useState<Side>('left')
  const [sortType, setSortType] = useState<'best' | 'latest'>('best')
  const [visibleCount, setVisibleCount] = useState(INITIAL_COMMENT_BATCH)
  const inputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (!open) return

    const isMobile =
      typeof window !== 'undefined' &&
      /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)

    if (isMobile) return

    const timer = setTimeout(() => inputRef.current?.focus(), 80)
    return () => clearTimeout(timer)
  }, [open])

  useEffect(() => {
    if (open) setVisibleCount(INITIAL_COMMENT_BATCH)
  }, [open, post?.id, sortType])

  useEffect(() => {
    if (!open || !post) return

    const exposedCount = Math.min(
      3,
      (post.comments ?? []).filter((comment) => !comment.hidden || adminMode)
        .length,
    )

    if (exposedCount > 0) {
      onExposeComments?.(exposedCount)
    }
  }, [open, post?.id])

  const sortedComments = useMemo(() => {
    if (!post) return []
    return [...post.comments].sort((a, b) => b.likes - a.likes)
  }, [post])

  const latestComments = useMemo(() => {
    if (!post) return []
    return [...post.comments].sort((a, b) => b.id - a.id)
  }, [post])

  if (!open || !post) return null

  const baseComments = sortType === 'best' ? sortedComments : latestComments
  const filteredVisibleComments = baseComments.filter(
    (comment) => !comment.hidden || adminMode,
  )
  const visibleComments = filteredVisibleComments.slice(0, visibleCount)
  const bestComment = sortedComments.find((c) => !c.hidden) || sortedComments[0]
  const bestCommentMeta = bestComment
    ? resolveAuthorMeta(
        {
          author: bestComment.author,
          authorKey: bestComment.authorKey ?? null,
        },
        authorMetaMap,
        guestName,
        currentUserLevel,
        featuredBadge,
        currentActorKey,
      )
    : null
  const hasMoreComments = filteredVisibleComments.length > visibleCount
  const selectedIsLeft = commentSide === 'left'

  const submitComment = () => {
    const trimmed = text.trim()
    if (!trimmed) return
    onAddComment(trimmed, commentSide)
    setText('')
  }

  return (
    <div className="fixed inset-0 z-40 overflow-hidden bg-slate-900/35 backdrop-blur-md">
      <div className="mx-auto flex h-[100svh] w-full min-h-0 max-w-md flex-col overflow-hidden bg-[linear-gradient(180deg,#f9fbff_0%,#f4f7fc_100%)] text-slate-900">
        <div className="shrink-0 border-b border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.92)_0%,rgba(248,250,255,0.92)_100%)] px-4 py-3.5 shadow-[0_10px_24px_rgba(15,23,42,0.05)] backdrop-blur-xl">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#4f7cff]">
                comments
              </div>
              <div className="mt-1 text-[20px] font-extrabold tracking-tight text-slate-950">
                반응 {post.comments.length}개
              </div>
            </div>
            <button
              onClick={onClose}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200/80 bg-white/90 shadow-[0_8px_18px_rgba(15,23,42,0.06)]"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2.5">
            <div className="max-w-full rounded-full border border-slate-200/80 bg-white/80 px-3 py-1.5 text-[11px] text-slate-500 shadow-[0_4px_12px_rgba(15,23,42,0.04)]">
              <span className="font-semibold text-slate-900">{guestName}</span>{' '}
              이름으로 바로 참여 가능
              {featuredBadge ? (
                <span className="ml-2 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 font-bold text-amber-700">
                  🏆 {featuredBadge}
                </span>
              ) : null}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setSortType('best')}
                className={`rounded-full px-3.5 py-2 text-[12px] font-bold transition ${
                  sortType === 'best'
                    ? 'bg-[linear-gradient(135deg,#5b7cff_0%,#4f7cff_55%,#6d8fff_100%)] text-white shadow-[0_10px_20px_rgba(79,124,255,0.22)]'
                    : 'border border-slate-200 bg-white text-slate-700 shadow-[0_4px_12px_rgba(15,23,42,0.04)]'
                }`}
              >
                베스트
              </button>
              <button
                onClick={() => setSortType('latest')}
                className={`rounded-full px-3.5 py-2 text-[12px] font-bold transition ${
                  sortType === 'latest'
                    ? 'bg-[linear-gradient(135deg,#5b7cff_0%,#4f7cff_55%,#6d8fff_100%)] text-white shadow-[0_10px_20px_rgba(79,124,255,0.22)]'
                    : 'border border-slate-200 bg-white text-slate-700 shadow-[0_4px_12px_rgba(15,23,42,0.04)]'
                }`}
              >
                최신
              </button>
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3.5 space-y-3.5 [webkit-overflow-scrolling:touch]">
          {bestComment && !bestComment.hidden && (
            <div className="overflow-hidden rounded-[28px] border border-amber-200 bg-[linear-gradient(180deg,#fffbeb_0%,#fef3c7_100%)] shadow-[0_16px_34px_rgba(245,158,11,0.14)]">
              <div className="h-1.5 w-full bg-[linear-gradient(90deg,#fbbf24_0%,#f59e0b_55%,#facc15_100%)]" />
              <div className="p-4">
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div>
                    <div className="text-[10px] font-extrabold tracking-[0.18em] text-amber-600/80">
                      BEST COMMENT
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-sm font-bold text-amber-700">
                      <Flame className="h-4 w-4 text-amber-500" /> 지금 가장
                      공감받는 반응
                    </div>
                  </div>
                  <div className="shrink-0 rounded-full border border-amber-200 bg-white/80 px-2.5 py-1 text-xs font-bold text-amber-700 shadow-[0_4px_12px_rgba(15,23,42,0.04)]">
                    공감 {bestComment.likes}
                  </div>
                </div>
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span
                    className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-bold ${
                      bestComment.side === 'left'
                        ? 'border-blue-200 bg-blue-50 text-blue-700'
                        : 'border-violet-200 bg-violet-50 text-violet-700'
                    }`}
                  >
                    {bestComment.side === 'left'
                      ? post.leftLabel
                      : post.rightLabel}
                  </span>
                  <span className="text-sm font-semibold text-slate-900">
                    {bestComment.author}
                  </span>
                  {bestCommentMeta ? (
                    <>
                      <span
                        className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-extrabold ${getLevelTheme(bestCommentMeta.level).softClass}`}
                      >
                        {getLevelTheme(bestCommentMeta.level).icon} Lv.
                        {bestCommentMeta.level}
                      </span>
                      {bestCommentMeta.badgeName ? (
                        <span
                          className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold ${getBadgeTheme(bestCommentMeta.badgeName).softClass}`}
                        >
                          {getBadgeTheme(bestCommentMeta.badgeName).icon}{' '}
                          {bestCommentMeta.badgeName}
                        </span>
                      ) : null}
                    </>
                  ) : null}
                </div>
                <div className="text-[15px] leading-6 tracking-[-0.01em] text-slate-800">
                  {bestComment.text}
                </div>
              </div>
            </div>
          )}

          <div className="space-y-3.5">
            {visibleComments.map((comment) => (
              <CommentCard
                key={comment.id}
                comment={comment}
                leftLabel={post.leftLabel}
                rightLabel={post.rightLabel}
                onLikeComment={onLikeComment}
                isLiked={!!likedComments[comment.id]}
                onOpenReportComment={onOpenReportComment}
                adminMode={adminMode}
                onAdminRestoreComment={onAdminRestoreComment}
                onAdminDeleteComment={onAdminDeleteComment}
                reactionSummary={
                  commentReactionMap[comment.id] ??
                  EMPTY_COMMENT_REACTION_SUMMARY
                }
                myReactionMap={{
                  agree: !!myCommentReactions[`${comment.id}:agree`],
                  disagree: !!myCommentReactions[`${comment.id}:disagree`],
                  wow: !!myCommentReactions[`${comment.id}:wow`],
                  relatable: !!myCommentReactions[`${comment.id}:relatable`],
                  absurd: !!myCommentReactions[`${comment.id}:absurd`],
                }}
                onReactComment={onReactComment}
                authorMeta={resolveAuthorMeta(
                  comment,
                  authorMetaMap,
                  guestName,
                  currentUserLevel,
                  featuredBadge,
                  currentActorKey,
                )}
              />
            ))}
          </div>

          {hasMoreComments && (
            <button
              onClick={() => {
                setVisibleCount((prev) => prev + INITIAL_COMMENT_BATCH)
                onExposeComments?.(INITIAL_COMMENT_BATCH)
              }}
              className="w-full rounded-[22px] border border-slate-200/80 bg-white/90 px-4 py-3 text-sm font-bold text-slate-900 shadow-[0_8px_20px_rgba(15,23,42,0.05)]"
            >
              반응 더보기
            </button>
          )}
        </div>

        <div className="shrink-0 border-t border-white/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.94)_0%,rgba(247,250,255,0.96)_100%)] px-4 pt-2.5 pb-[max(10px,env(safe-area-inset-bottom))] shadow-[0_-10px_24px_rgba(15,23,42,0.04)] backdrop-blur-xl">
          <div className="rounded-[26px] border border-slate-200/80 bg-white/90 p-2 shadow-[0_8px_22px_rgba(15,23,42,0.05)]">
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setCommentSide('left')}
                className={`rounded-[18px] px-4 py-2.5 text-sm font-bold transition ${
                  commentSide === 'left'
                    ? 'bg-[linear-gradient(135deg,#5b7cff_0%,#4f7cff_55%,#6d8fff_100%)] text-white shadow-[0_10px_20px_rgba(79,124,255,0.22)]'
                    : 'border border-slate-200 bg-slate-50 text-slate-700'
                }`}
              >
                {post.leftLabel}
              </button>
              <button
                onClick={() => setCommentSide('right')}
                className={`rounded-[18px] px-4 py-2.5 text-sm font-bold transition ${
                  commentSide === 'right'
                    ? 'bg-[linear-gradient(135deg,#8b5cf6_0%,#7c3aed_55%,#a78bfa_100%)] text-white shadow-[0_10px_20px_rgba(124,58,237,0.20)]'
                    : 'border border-slate-200 bg-slate-50 text-slate-700'
                }`}
              >
                {post.rightLabel}
              </button>
            </div>

            <div className="mt-2 flex min-w-0 items-center gap-2">
              <input
                ref={inputRef}
                value={text}
                maxLength={LIMITS.comment}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                    e.preventDefault()
                    submitComment()
                  }
                }}
                placeholder={
                  selectedIsLeft
                    ? `${post.leftLabel} 쪽 의견 남기기`
                    : `${post.rightLabel} 쪽 의견 남기기`
                }
                className="h-[48px] min-w-0 flex-1 rounded-[18px] border border-slate-200 bg-slate-50/80 px-4 text-[16px] text-slate-900 outline-none placeholder:text-slate-400"
              />

              <button
                onClick={submitComment}
                className={`flex h-[48px] w-[48px] shrink-0 items-center justify-center rounded-[18px] text-white shadow-[0_14px_26px_rgba(15,23,42,0.12)] ${
                  selectedIsLeft
                    ? 'bg-[linear-gradient(135deg,#5b7cff_0%,#4f7cff_55%,#6d8fff_100%)]'
                    : 'bg-[linear-gradient(135deg,#8b5cf6_0%,#7c3aed_55%,#a78bfa_100%)]'
                }`}
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="mt-1.5 text-right text-[11px] text-slate-400">
            {text.length}/{LIMITS.comment}
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
            className="w-full rounded-2xl bg-[#4f7cff] px-4 py-4 font-bold text-white shadow-[0_16px_28px_rgba(79,124,255,0.24)]"
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
                            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-black text-emerald-600">
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
                        className="rounded-[18px] bg-[linear-gradient(135deg,#c7d2fe_0%,#93c5fd_100%)] px-4 py-3 text-sm font-black text-slate-900 shadow-[0_12px_22px_rgba(79,124,255,0.16)]"
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
  const [currentIndex, setCurrentIndex] = useState(0)
  const [postFocusPulse, setPostFocusPulse] = useState(false)
  const [tab, setTab] = useState<'추천' | '인기' | '최신'>('추천')
  const [selectedCategory, setSelectedCategory] = useState<string>('전체')
  const [votes, setVotes] = useState<Record<number, VoteSide>>({})
  const [likedComments, setLikedComments] = useState<Record<number, boolean>>(
    {},
  )
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

  const [deletedPosts, setDeletedPosts] = useState<PostItem[]>([])
  const [deletedComments, setDeletedComments] = useState<DeletedCommentItem[]>(
    [],
  )
  const [deletedOpen, setDeletedOpen] = useState(false)

  const [toast, setToast] = useState('')
  const [commentOpen, setCommentOpen] = useState(false)
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

  const showToast = useCallback((msg: string) => {
    setToast(msg)
    const timer = setTimeout(() => setToast(''), 1400)
    return () => clearTimeout(timer)
  }, [])

  const isAdmin = profile?.role === 'admin'

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
    setCommentOpen(false)
    setActivityOpen(false)
    setActivityInitialTab('posts')
  }, [])

  const loadAuthState = useCallback(async () => {
    try {
      const result = await ensureProfile()
      setAuthUser(result.user)
      setProfile(result.profile)
    } catch (error: any) {
      if (error?.name === 'AuthSessionMissingError') {
        setAuthUser(null)
        setProfile(null)
        return
      }

      console.error('auth/profile 로딩 실패', {
        message: error?.message,
        name: error?.name,
        details: error?.details,
        hint: error?.hint,
        code: error?.code,
      })
    }
  }, [])

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

  const fetchMyActivity = useCallback(async (userId: string) => {
    if (!userId) return

    const { data: myPostsData, error: myPostsError } = await supabase
      .from('posts')
      .select('id, title, category, age_group')
      .eq('author_key', userId)
      .neq('status', 'deleted')
      .order('created_at', { ascending: false })

    if (myPostsError) {
      console.error('내 글 불러오기 실패', myPostsError)
    } else {
      setMyPosts(
        (myPostsData ?? []).map((post) => ({
          id: Number(post.id),
          postId: Number(post.id),
          title: post.title,
          category: post.category,
          ageGroup: post.age_group,
        })),
      )
    }

    const { data: myCommentsData, error: myCommentsError } = await supabase
      .from('comments')
      .select('id, post_id, text')
      .eq('author_key', userId)
      .neq('status', 'deleted')
      .order('created_at', { ascending: false })

    if (myCommentsError) {
      console.error('내 댓글 불러오기 실패', myCommentsError)
      return
    }

    const commentRows = (myCommentsData ?? []).map((comment) => ({
      id: Number(comment.id),
      commentId: Number(comment.id),
      postId: Number(comment.post_id),
      text: comment.text,
    }))

    const uniquePostIds = [...new Set(commentRows.map((item) => item.postId))]

    if (uniquePostIds.length === 0) {
      setMyComments([])
      return
    }

    const { data: commentPostsData, error: commentPostsError } = await supabase
      .from('posts')
      .select('id, title')
      .in('id', uniquePostIds)

    if (commentPostsError) {
      console.error('댓글 대상 글 불러오기 실패', commentPostsError)
      setMyComments(
        commentRows.map((comment) => ({
          ...comment,
          postTitle: '삭제되었거나 찾을 수 없는 글',
        })),
      )
      return
    }

    const postTitleMap = new Map<number, string>()
    ;(commentPostsData ?? []).forEach((post) => {
      postTitleMap.set(Number(post.id), post.title)
    })

    setMyComments(
      commentRows.map((comment) => ({
        ...comment,
        postTitle:
          postTitleMap.get(comment.postId) ?? '삭제되었거나 찾을 수 없는 글',
      })),
    )
  }, [])

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
  }, [authUser?.id, voterKey])

  const awardBadgesFromStats = useCallback(
    async (nextStats: UserStatsRow) => {
      const currentUserId = authUser?.id ?? null
      const currentVoterKey = currentUserId ? null : voterKey
      if (!currentUserId && !currentVoterKey) return

      const nextBadgeNames = BADGE_RULES.filter((rule) =>
        rule.check(nextStats),
      ).map((rule) => rule.name)

      const newlyEarned = nextBadgeNames.filter(
        (name) => !badges.includes(name),
      )
      if (newlyEarned.length === 0) return

      const rows = newlyEarned.map((badgeName) => ({
        user_id: currentUserId,
        voter_key: currentVoterKey,
        badge_name: badgeName,
      }))

      const { error } = await supabase.from('user_badges').insert(rows)
      if (error) {
        console.error('뱃지 저장 실패', error)
        return
      }

      setBadges((prev) => [...newlyEarned, ...prev])
      newlyEarned.forEach((badgeName) => showToast(`🏆 ${badgeName} 획득`))
    },
    [authUser?.id, voterKey, badges, showToast],
  )

  const upsertStreak = useCallback(
    async (streakType: UserStreakRow['streakType'], nextCount: number) => {
      if (!currentActorUnifiedKey) return

      const prev = streakMap[streakType]
      const nextRow: UserStreakRow = {
        streakType,
        currentCount: nextCount,
        bestCount: Math.max(prev?.bestCount ?? 0, nextCount),
        lastActionAt: new Date().toISOString(),
      }

      setStreakMap((prevMap) => ({
        ...prevMap,
        [streakType]: nextRow,
      }))

      const { error } = await supabase.from('user_streaks').upsert(
        {
          actor_key: currentActorUnifiedKey,
          streak_type: streakType,
          current_count: nextRow.currentCount,
          best_count: nextRow.bestCount,
          last_action_at: nextRow.lastActionAt,
        },
        { onConflict: 'actor_key,streak_type' },
      )

      if (error) {
        console.error('streak 업데이트 실패', error)
      }
    },
    [currentActorUnifiedKey, streakMap],
  )

  const updateProgress = useCallback(
    async (delta: Partial<UserStatsRow>, rewardMessage?: string) => {
      const currentUserId = authUser?.id ?? null
      const currentVoterKey = currentUserId ? null : voterKey
      if (!currentUserId && !currentVoterKey) return

      const nextStats = normalizeStats({
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

      const nextLevelInfo = getLevelInfo(nextStats.points)
      nextStats.level = nextLevelInfo.level

      setStats(nextStats)

      let query = supabase.from('user_stats').update({
        points: nextStats.points,
        level: nextStats.level,
        votes_count: nextStats.votes_count,
        comments_count: nextStats.comments_count,
        posts_count: nextStats.posts_count,
        likes_received: nextStats.likes_received,
      })

      query = currentUserId
        ? query.eq('user_id', currentUserId)
        : query.eq('voter_key', currentVoterKey)

      const { error } = await query
      if (error) {
        console.error('포인트 업데이트 실패', error)
        return
      }

      if (rewardMessage) {
        showToast(rewardMessage)
      }

      await awardBadgesFromStats(nextStats)
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
      console.error('구글 로그인 실패', error)
      showToast('구글 로그인 실패')
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
      setAdminMode(false)

      showToast('로그아웃 완료')
    } catch (error) {
      console.error('로그아웃 실패', error)
      showToast('로그아웃 실패')
    }
  }

  useEffect(() => {
    setGuestName(getOrCreateGuestName())
    void loadAuthState()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session?.user) {
        clearAuthLocalState()
      }
      void loadAuthState()
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [clearAuthLocalState, loadAuthState])

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
      .select('id, post_id, created_at')
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
        return {
          id: row.id,
          postId: row.postId,
          title: post.title,
          category: post.category,
          ageGroup: post.age_group,
          createdAt: row.createdAt,
          latestOutcomeType: latestOutcome?.outcome_type ?? null,
          latestOutcomeSummary: latestOutcome?.summary ?? null,
          hasOutcome: !!latestOutcome,
          unreadOutcome,
        } satisfies WatchlistItem
      })
      .filter(Boolean) as WatchlistItem[]

    items.sort((a, b) => {
      if (a.unreadOutcome !== b.unreadOutcome) return a.unreadOutcome ? -1 : 1
      if (a.hasOutcome !== b.hasOutcome) return a.hasOutcome ? -1 : 1
      return (
        new Date(b.createdAt ?? 0).getTime() -
        new Date(a.createdAt ?? 0).getTime()
      )
    })

    setWatchlistItems(items)
    setMyWatchlistMap(watchedMap)
    setWatchOutcomeSeenMap(nextSeenState)
  }, [])

  useEffect(() => {
    if (authUser?.id) {
      void fetchMyActivity(authUser.id)
    } else {
      setMyPosts([])
      setMyComments([])
    }
  }, [authUser?.id, fetchMyActivity])

  useEffect(() => {
    void fetchWatchlist(currentActorUnifiedKey)
  }, [currentActorUnifiedKey, fetchWatchlist])

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
      await Promise.all([
        fetchWatchlist(currentActorUnifiedKey),
        loadReactionAndOutcomeData(postIds, commentIds),
        loadDramaEnhancementData(postIds),
        loadResultUnlocks(postIds),
      ])
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
    loadReactionAndOutcomeData,
    loadResultUnlocks,
    posts,
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

  const upsertResultUnlock = useCallback(
    async (
      postId: number,
      patch: {
        unlockLevel?: number
        commentReadsDelta?: number
        forceCommentReads?: number
        isWatchlisted?: boolean
      },
    ) => {
      if (!currentActorUnifiedKey || !postId) return null

      const existing = resultUnlockMap[postId] ?? null
      let base = existing

      if (!base) {
        const { count, error: countError } = await supabase
          .from('post_result_unlocks')
          .select('*', { count: 'exact', head: true })
          .eq('voter_key', currentActorUnifiedKey)

        if (countError) {
          console.error('결과 공개 단계 개수 조회 실패', countError)
        }

        base = {
          postId,
          voterKey: currentActorUnifiedKey,
          unlockLevel: Number(count ?? 0) < 3 ? 3 : 1,
          commentReads: 0,
          isWatchlisted: !!myWatchlistMap[postId],
          createdAt: null,
          updatedAt: null,
        }
      }

      const nextUnlockLevel = Math.max(
        base.unlockLevel,
        Number(patch.unlockLevel ?? base.unlockLevel),
      )
      const nextCommentReads =
        typeof patch.forceCommentReads === 'number'
          ? Math.max(0, patch.forceCommentReads)
          : Math.max(
              0,
              base.commentReads + Number(patch.commentReadsDelta ?? 0),
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

      setResultUnlockMap((prev) => ({
        ...prev,
        [postId]: nextItem,
      }))

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
        console.error('결과 공개 단계 저장 실패', error)
        return null
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
          isWatchlisted: Boolean(data.is_watchlisted ?? nextItem.isWatchlisted),
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

  const openShareInbox = useCallback(() => {
    setShareInboxOpen(true)
    void loadOwnerShareInbox()
  }, [loadOwnerShareInbox])

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
  const currentWatchlisted = !!(currentPost && myWatchlistMap[currentPost.id])
  const unreadWatchlistCount = watchlistItems.filter(
    (item) => item.unreadOutcome,
  ).length
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

  const nextRecommendationReason = queuedNextPost
    ? getNextReasonLabel(queuedNextPost.item.reasonType)
    : '다음 맞냐'

  const nextRecommendationTitle =
    choicePathNextPost?.title ||
    queuedNextPost?.post?.title ||
    filteredPosts[Math.min(currentIndex + 1, filteredPosts.length - 1)]
      ?.title ||
    '다음 글 보기'

  const nextRecommendationHelper = '지금 가장 오래 보게 만들 다음 판으로 이동'

  useEffect(() => {
    if (!currentPost?.id || !votes[currentPost.id] || !currentActorUnifiedKey)
      return

    if (currentWatchlisted) {
      void upsertResultUnlock(currentPost.id, {
        unlockLevel: 3,
        isWatchlisted: true,
      })
    }
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

    if (latestOutcome || revisitMeta) {
      void upsertResultUnlock(currentPost.id, {
        unlockLevel: 4,
      })
    }
  }, [
    currentActorUnifiedKey,
    currentPost?.id,
    latestOutcome?.id,
    revisitMeta?.label,
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
      setShowOwnerShareResults(false)
      lastShareTotalRef.current = 0
    } else if (activeShareId) {
      await loadShareStatsBySessionId(activeShareId)
      syncShareUrl(currentPost.id, activeShareId)
    }

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
    }
  }, [
    currentPost,
    shareId,
    sharedPostId,
    votes,
    createShareSession,
    loadShareStatsBySessionId,
    syncShareUrl,
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
    return discoveryTopPosts.slice(0, 3).map((item, index) => {
      const hotMeta = hotScoreMap[item.id]
      const turningMeta = turningPointMap[item.id]
      const tension = postTensionMap[item.id]
      const tensionMeta = getTensionMeta(tension)
      const totalVotes =
        Number(item.leftVotes ?? 0) + Number(item.rightVotes ?? 0)
      const commentBurst = Number(hotMeta?.comment1h ?? 0)
      const voteBurst = Number(hotMeta?.vote1h ?? 0)
      const turningLabel = getTurningPointLabel(turningMeta?.eventLabel)
      const hotBadgeLabel = getHotBadge(hotMeta)?.label
      const emotionLabel =
        turningLabel ??
        (tension?.isFlipImminent ? tensionMeta.label : null) ??
        hotBadgeLabel ??
        '👀 반응 붙는 중'

      const shortMetric = turningLabel
        ? '방금 판 뒤집힘'
        : tension?.isFlipImminent
          ? '지금 네 한 표가 흐름 바꿀 수 있음'
          : commentBurst >= 8
            ? `댓글 ${commentBurst}개 확 붙음`
            : voteBurst >= 1
              ? `지금 ${voteBurst}명 붙는 중`
              : totalVotes >= 1
                ? `현재 ${totalVotes}명 참여중`
                : '첫 반응 기다리는 중'

      const liveBadgeLabel =
        turningLabel != null
          ? '방금 뒤집힘'
          : tension?.isFlipImminent
            ? '역전 임박'
            : commentBurst >= 8
              ? '댓글 폭발'
              : voteBurst >= 8
                ? '지금 뜨는 판'
                : '실시간 논쟁'

      const rankToneClass =
        index === 0
          ? 'text-rose-600'
          : index === 1
            ? 'text-violet-600'
            : 'text-sky-600'

      return {
        id: item.id,
        rank: index + 1,
        title: item.title,
        category: item.category,
        shortMetric,
        emotionLabel,
        liveBadgeLabel,
        rankToneClass,
      }
    })
  }, [discoveryTopPosts, hotScoreMap, postTensionMap, turningPointMap])

  useEffect(() => {
    if (liveTickerItems.length <= 1) return

    const timer = window.setInterval(() => {
      setLiveTickerIndex((prev) => (prev + 1) % liveTickerItems.length)
    }, 2400)

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

  useEffect(() => {
    return () => {
      if (postFocusPulseTimerRef.current) {
        window.clearTimeout(postFocusPulseTimerRef.current)
      }
    }
  }, [])

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

    endSharedEntryMode()
    setCurrentIndex(targetIndex)
    requestLightweightMetaRefresh()
    focusCurrentPostCard()
  }

  const next = () => {
    const targetIndex = Math.min(currentIndex + 1, filteredPosts.length - 1)
    const targetPost = filteredPosts[targetIndex]

    if (currentPost && targetPost) {
      recordChoicePath(currentPost.id, targetPost.id)
    }

    endSharedEntryMode()
    setCurrentIndex(targetIndex)
    requestLightweightMetaRefresh()
    focusCurrentPostCard()
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
      endSharedEntryMode()
      setCurrentIndex(nextIndexInFiltered)
      focusCurrentPostCard()
      return
    }

    const fallbackIndex = posts.findIndex((p) => p.id === postId)
    if (fallbackIndex >= 0) {
      recordChoicePath(currentPost.id, postId)
      endSharedEntryMode()
      setTab('추천')
      setSelectedCategory('전체')
      setCurrentIndex(fallbackIndex)
      focusCurrentPostCard()
    }
  }

  const openPostDirect = (postId: number) => {
    const index = posts.findIndex((p) => p.id === postId)
    if (index >= 0) {
      const latestSeenAt = postOutcomeMap[postId]?.[0]?.createdAt ?? null
      if (currentPost) {
        recordChoicePath(currentPost.id, postId)
      }
      endSharedEntryMode()
      setTab('추천')
      setSelectedCategory('전체')
      setCurrentIndex(index)
      focusCurrentPostCard()
      setActivityOpen(false)
      if (myWatchlistMap[postId] && latestSeenAt) {
        void markWatchlistOutcomeSeen(postId, latestSeenAt)
      }
    }
  }

  const openCommentDirect = (postId: number) => {
    const index = posts.findIndex((p) => p.id === postId)
    if (index >= 0) {
      if (currentPost) {
        recordChoicePath(currentPost.id, postId)
      }
      endSharedEntryMode()
      setTab('추천')
      setSelectedCategory('전체')
      setCurrentIndex(index)
      setActivityOpen(false)
      setCommentOpen(true)
    }
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

    const mapKey = `${commentId}:${reactionType}`
    const alreadyActive = !!myCommentReactions[mapKey]

    setMyCommentReactions((prev) => ({
      ...prev,
      [mapKey]: !alreadyActive,
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
        },
      }
    })

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
      return
    }

    const { error } = await supabase.from('comment_reactions').insert({
      comment_id: commentId,
      reactor_key: currentActorUnifiedKey,
      reaction_type: reactionType,
    })

    if (error) {
      console.error('댓글 반응 등록 실패', error)
      showToast('댓글 반응 반영 실패')
      void fetchAll(voterKey)
      return
    }

    showToast('반응 반영')
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
            item.postId === postId ? { ...item, unreadOutcome: false } : item,
          )
          .sort((a, b) => {
            if (a.unreadOutcome !== b.unreadOutcome)
              return a.unreadOutcome ? -1 : 1
            if (a.hasOutcome !== b.hasOutcome) return a.hasOutcome ? -1 : 1
            return (
              new Date(b.createdAt ?? 0).getTime() -
              new Date(a.createdAt ?? 0).getTime()
            )
          }),
      )

      const { error } = await supabase
        .from('post_watchlist_outcome_reads')
        .upsert(
          {
            actor_key: currentActorUnifiedKey,
            post_id: postId,
            last_seen_outcome_created_at: latestSeenAt,
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: 'actor_key,post_id',
          },
        )

      if (error) {
        console.error('궁금한 글 읽음 처리 실패', error)
      }
    },
    [currentActorUnifiedKey, postOutcomeMap],
  )

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

    setWatchlistItems((prev) =>
      prev
        .map((item) =>
          item.postId === currentPost.id
            ? {
                ...item,
                latestOutcomeType: nextItem.outcomeType,
                latestOutcomeSummary: nextItem.summary,
                hasOutcome: true,
                unreadOutcome: false,
              }
            : item,
        )
        .sort((a, b) => {
          if (a.unreadOutcome !== b.unreadOutcome)
            return a.unreadOutcome ? -1 : 1
          if (a.hasOutcome !== b.hasOutcome) return a.hasOutcome ? -1 : 1
          return (
            new Date(b.createdAt ?? 0).getTime() -
            new Date(a.createdAt ?? 0).getTime()
          )
        }),
    )

    await markWatchlistOutcomeSeen(currentPost.id, nextItem.createdAt)
    void upsertResultUnlock(currentPost.id, {
      unlockLevel: 4,
      isWatchlisted: currentWatchlisted,
    })
    requestLightweightMetaRefresh({ immediate: true, delay: 0 })
    setOutcomeModalOpen(false)
    showToast('후기 등록 완료')
  }

  const toggleCurrentPostWatchlist = async () => {
    if (!currentPost || !currentActorUnifiedKey) return

    const targetPostId = currentPost.id
    const alreadyActive = !!myWatchlistMap[targetPostId]

    setMyWatchlistMap((prev) => ({
      ...prev,
      [targetPostId]: !alreadyActive,
    }))

    if (alreadyActive) {
      const removedItem =
        watchlistItems.find((item) => item.postId === targetPostId) ?? null

      setWatchlistItems((prev) =>
        prev.filter((item) => item.postId !== targetPostId),
      )
      void upsertResultUnlock(targetPostId, {
        isWatchlisted: false,
      })

      const { error } = await supabase
        .from('post_watchlist')
        .delete()
        .eq('post_id', targetPostId)
        .eq('actor_key', currentActorUnifiedKey)
        .eq('watch_type', 'curious')

      if (error) {
        console.error('궁금한 글 해제 실패', error)
        setMyWatchlistMap((prev) => ({
          ...prev,
          [targetPostId]: true,
        }))
        if (removedItem) {
          setWatchlistItems((prev) => {
            const next = [
              removedItem,
              ...prev.filter((item) => item.postId !== targetPostId),
            ]
            next.sort((a, b) => {
              if (a.unreadOutcome !== b.unreadOutcome)
                return a.unreadOutcome ? -1 : 1
              if (a.hasOutcome !== b.hasOutcome) return a.hasOutcome ? -1 : 1
              return (
                new Date(b.createdAt ?? 0).getTime() -
                new Date(a.createdAt ?? 0).getTime()
              )
            })
            return next
          })
        }
        showToast('결말궁금 반영 실패')
        void fetchWatchlist(currentActorUnifiedKey)
        return
      }

      requestLightweightMetaRefresh({ immediate: true, delay: 0 })
      showToast('궁금한 글 해제')
      return
    }

    const optimisticItem: WatchlistItem = {
      id: -targetPostId,
      postId: targetPostId,
      title: currentPost.title,
      category: currentPost.category,
      ageGroup: currentPost.ageGroup,
      createdAt: new Date().toISOString(),
      latestOutcomeType: latestOutcome?.outcomeType ?? null,
      latestOutcomeSummary: latestOutcome?.summary ?? null,
      hasOutcome: !!latestOutcome,
      unreadOutcome: false,
    }

    setWatchlistItems((prev) => {
      const next = [
        optimisticItem,
        ...prev.filter((item) => item.postId !== targetPostId),
      ]
      next.sort((a, b) => {
        if (a.unreadOutcome !== b.unreadOutcome) return a.unreadOutcome ? -1 : 1
        if (a.hasOutcome !== b.hasOutcome) return a.hasOutcome ? -1 : 1
        return (
          new Date(b.createdAt ?? 0).getTime() -
          new Date(a.createdAt ?? 0).getTime()
        )
      })
      return next
    })

    const { data, error } = await supabase
      .from('post_watchlist')
      .upsert(
        {
          post_id: targetPostId,
          actor_key: currentActorUnifiedKey,
          watch_type: 'curious',
        },
        {
          onConflict: 'post_id,actor_key,watch_type',
          ignoreDuplicates: false,
        },
      )
      .select('id, created_at')
      .single()

    if (error) {
      console.error('궁금한 글 등록 실패', error)
      setMyWatchlistMap((prev) => ({
        ...prev,
        [targetPostId]: false,
      }))
      setWatchlistItems((prev) =>
        prev.filter((item) => item.postId !== targetPostId),
      )
      showToast('결말궁금 반영 실패')
      void fetchWatchlist(currentActorUnifiedKey)
      return
    }

    setWatchlistItems((prev) =>
      prev
        .map((item) =>
          item.postId === targetPostId
            ? {
                ...item,
                id: Number(data?.id ?? item.id),
                createdAt: data?.created_at ?? item.createdAt,
              }
            : item,
        )
        .sort((a, b) => {
          if (a.unreadOutcome !== b.unreadOutcome)
            return a.unreadOutcome ? -1 : 1
          if (a.hasOutcome !== b.hasOutcome) return a.hasOutcome ? -1 : 1
          return (
            new Date(b.createdAt ?? 0).getTime() -
            new Date(a.createdAt ?? 0).getTime()
          )
        }),
    )

    void upsertResultUnlock(targetPostId, {
      unlockLevel: 3,
      isWatchlisted: true,
    })
    requestLightweightMetaRefresh({ immediate: true, delay: 0 })
    showToast('결말궁금 저장')
  }

  const reactToPost = async (reactionType: PostReactionType) => {
    if (!currentPost || !currentActorUnifiedKey) return

    const mapKey = `${currentPost.id}:${reactionType}`
    const alreadyActive = !!myPostReactions[mapKey]

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
      return
    }

    const { error } = await supabase.from('post_reactions').insert({
      post_id: currentPost.id,
      reactor_key: currentActorUnifiedKey,
      reaction_type: reactionType,
    })

    if (error) {
      console.error('게시글 반응 등록 실패', error)
      showToast('게시글 반응 반영 실패')
      void fetchAll(voterKey)
      return
    }

    showToast('반응 반영')
  }

  const addComment = async (text: string, side: Side) => {
    if (!currentPost) return

    const authorName = profile?.anonymous_name ?? guestName

    const { data: inserted, error } = await supabase
      .from('comments')
      .insert({
        post_id: currentPost.id,
        author: authorName,
        side,
        text,
        author_key: authUser?.id ?? voterKey,
        status: 'active',
      })
      .select()
      .single()

    if (error) {
      console.error('댓글 등록 실패', error)
      showToast('댓글 등록 실패')
      return
    }

    const newComment: CommentItem = {
      id: Number(inserted.id),
      author: inserted.author,
      authorKey: inserted.author_key ?? null,
      side: inserted.side as Side,
      text: inserted.text,
      likes: Number(inserted.likes ?? 0),
      reportCount: Number(inserted.report_count ?? 0),
      hidden: Boolean(inserted.hidden ?? false),
    }

    setPosts((prev) =>
      prev.map((p) =>
        p.id === currentPost.id
          ? { ...p, comments: [newComment, ...p.comments] }
          : p,
      ),
    )

    if (authUser) {
      setMyComments((prev) => [
        {
          id: newComment.id,
          commentId: newComment.id,
          postId: currentPost.id,
          postTitle: currentPost.title,
          text: newComment.text,
        },
        ...prev,
      ])
    }

    await logPostEvent({
      postId: currentPost.id,
      eventType: 'comment',
      side,
      refId: newComment.id,
    })
    scheduleDiscoveryRefresh()

    await updateProgress(
      {
        points: 3,
        comments_count: 1,
      },
      '🔥 +3 포인트',
    )
  }

  const likeComment = async (commentId: number): Promise<void> => {
    if (!currentPost) return

    const targetComment = currentPost.comments.find((c) => c.id === commentId)
    if (!targetComment) return

    const alreadyLiked = !!likedComments[commentId]
    const nextLikes = alreadyLiked
      ? Math.max(0, targetComment.likes - 1)
      : targetComment.likes + 1

    setLikedComments((prev) => ({
      ...prev,
      [commentId]: !alreadyLiked,
    }))

    setPosts((prev) =>
      prev.map((p) =>
        p.id === currentPost.id
          ? {
              ...p,
              comments: p.comments.map((c) =>
                c.id === commentId ? { ...c, likes: nextLikes } : c,
              ),
            }
          : p,
      ),
    )

    const { error } = await supabase
      .from('comments')
      .update({ likes: nextLikes })
      .eq('id', commentId)

    if (error) {
      console.error('댓글 공감 업데이트 실패', error)
      showToast('공감 반영 실패')
      void fetchAll(voterKey)
      return
    }

    showToast(alreadyLiked ? '공감 취소' : '공감 반영')

    if (
      !alreadyLiked &&
      targetComment.author === (profile?.anonymous_name ?? guestName)
    ) {
      await updateProgress(
        {
          points: 2,
          likes_received: 1,
        },
        '🔥 공감 받아 +2 포인트',
      )
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

    if (authUser) {
      setMyPosts((prev) => [
        {
          id: newPost.id,
          postId: newPost.id,
          title: newPost.title,
          category: newPost.category,
          ageGroup: newPost.ageGroup,
        },
        ...prev.filter((item) => item.postId !== newPost.id),
      ])
    }

    clearShareMode()
    setTab('최신')
    setSelectedCategory('전체')
    setCurrentIndex(0)
    setJustCreatedPostId(newPost.id)
    setWriteOpen(false)
    setCommentOpen(false)
    setActivityOpen(false)
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

  const isModalOpen =
    commentOpen ||
    writeOpen ||
    activityOpen ||
    outcomeModalOpen ||
    deletedOpen ||
    authOpen ||
    shareInboxOpen

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

  if (!currentPost) {
    return (
      <div className="min-h-[100dvh] bg-[radial-gradient(circle_at_top,_rgba(79,124,255,0.10),_transparent_30%),linear-gradient(180deg,#f5f7fb_0%,#eef2f7_100%)] text-slate-900">
        <div className="mx-auto flex min-h-[100dvh] w-full max-w-md flex-col overflow-x-hidden bg-transparent">
          <header className="sticky top-0 z-30 px-4 pt-3">
            <div className="rounded-[30px] border border-white/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(245,248,255,0.98)_100%)] px-4 pb-3 pt-3 shadow-[0_18px_44px_rgba(148,163,184,0.16),0_2px_10px_rgba(15,23,42,0.04)] backdrop-blur-xl">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-xs uppercase tracking-[0.28em] text-[#4f7cff]">
                    맞냐
                  </div>
                  <div className="mt-1 text-[22px] font-extrabold tracking-tight text-slate-950">
                    이거 맞냐?
                  </div>
                  {unreadWatchlistCount > 0 ? (
                    <button
                      onClick={openWatchlistActivity}
                      className="mt-2 inline-flex items-center gap-2 rounded-full border border-rose-200 bg-rose-50 px-3 py-1.5 text-[11px] font-black text-rose-700"
                    >
                      <span>새 후기 도착</span>
                      <span>{unreadWatchlistCount}개</span>
                    </button>
                  ) : null}
                </div>

                <div className="flex items-center gap-2">
                  {!authUser ? (
                    <button
                      onClick={() => setAuthOpen(true)}
                      className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-900 shadow-[0_6px_16px_rgba(15,23,42,0.05)]"
                    >
                      <User className="h-5 w-5" />
                    </button>
                  ) : (
                    <button
                      onClick={openWatchlistActivity}
                      className="relative flex h-10 min-w-[44px] items-center justify-center rounded-full border border-slate-200 bg-white px-3 text-slate-900 shadow-[0_6px_16px_rgba(15,23,42,0.05)]"
                    >
                      <span className="text-xs font-bold">
                        {profile?.anonymous_name ?? '익명'}
                      </span>
                      {unreadWatchlistCount > 0 ? (
                        <span className="absolute -right-1 -top-1 inline-flex min-w-[18px] items-center justify-center rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-black text-white">
                          {unreadWatchlistCount}
                        </span>
                      ) : null}
                    </button>
                  )}

                  {isAdmin && (
                    <button
                      onClick={() => void handleAdminToggle()}
                      className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-900 shadow-[0_6px_16px_rgba(15,23,42,0.05)]"
                    >
                      <Shield className="h-5 w-5" />
                    </button>
                  )}

                  <button
                    onClick={() => setWriteOpen(true)}
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-[#4f7cff] text-white shadow-[0_12px_22px_rgba(79,124,255,0.26)]"
                  >
                    <Plus className="h-5 w-5" />
                  </button>
                </div>
              </div>
            </div>
          </header>

          <main className="flex flex-1 items-center justify-center px-6 text-center">
            <div>
              <div className="text-lg font-bold">아직 글이 없음</div>
              <div className="mt-2 text-sm text-slate-500">
                첫 글을 올려서 흐름을 만들어봐
              </div>
            </div>
          </main>
        </div>

        {toast ? (
          <div className="pointer-events-none fixed inset-x-0 bottom-24 z-30 flex justify-center px-4">
            <div className="rounded-full bg-slate-900 px-4 py-2 text-sm font-bold text-white shadow-[0_12px_28px_rgba(15,23,42,0.22)]">
              {toast}
            </div>
          </div>
        ) : null}

        <CreatePostModal
          open={writeOpen}
          onClose={() => setWriteOpen(false)}
          onCreate={(input) => void createPost(input)}
          guestName={profile?.anonymous_name ?? guestName}
          featuredBadge={featuredBadge}
        />

        <MyActivityModal
          open={activityOpen}
          onClose={() => setActivityOpen(false)}
          myPosts={myPosts}
          myComments={myComments}
          watchlistItems={watchlistItems}
          unreadWatchlistCount={unreadWatchlistCount}
          initialTab={activityInitialTab}
          onOpenPost={openPostDirect}
          onOpenComment={openCommentDirect}
          onLogout={() => void handleLogout()}
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
      </div>
    )
  }

  const p = percent(currentPost.leftVotes, currentPost.rightVotes)
  const displayedPercent = currentResultReveal
    ? {
        left: currentResultReveal.leftValue,
        right: currentResultReveal.rightValue,
      }
    : p
  const levelInfo = getLevelInfo(stats.points)
  const isOwnCurrentPost =
    !!currentActorKey &&
    !!currentPost.authorKey &&
    String(currentPost.authorKey) === String(currentActorKey)

  return (
    <div className="min-h-[100dvh] bg-[radial-gradient(circle_at_top,_rgba(79,124,255,0.10),_transparent_30%),linear-gradient(180deg,#f5f7fb_0%,#eef2f7_100%)] text-slate-900">
      <div className="mx-auto flex min-h-[100dvh] w-full max-w-md flex-col overflow-x-hidden bg-transparent">
        <header className="sticky top-0 z-30 px-4 pt-3">
          <div className="rounded-[30px] border border-white/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(245,248,255,0.98)_100%)] px-4 pb-3 pt-3 shadow-[0_18px_44px_rgba(148,163,184,0.16),0_2px_10px_rgba(15,23,42,0.04)] backdrop-blur-xl">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#4f7cff]">
                  맞냐
                </div>
                <div className="mt-1 text-[22px] font-extrabold tracking-tight text-slate-950">
                  이거 맞냐?
                </div>
                {currentVoteStreak && currentVoteStreak.currentCount > 0 ? (
                  <div
                    className={`mt-2 inline-flex rounded-full border px-3 py-1 text-[11px] font-black ${getStreakTone(currentVoteStreak.currentCount)}`}
                  >
                    ⚡ 연속 판단 {currentVoteStreak.currentCount}회
                  </div>
                ) : null}
                {unreadWatchlistCount > 0 ? (
                  <button
                    onClick={openWatchlistActivity}
                    className="mt-2 inline-flex items-center gap-2 rounded-full border border-rose-200 bg-rose-50 px-3 py-1.5 text-[11px] font-black text-rose-700"
                  >
                    <span>새 후기 도착</span>
                    <span>{unreadWatchlistCount}개</span>
                  </button>
                ) : null}
              </div>

              <div className="flex items-center gap-2">
                {!authUser ? (
                  <button
                    onClick={() => setAuthOpen(true)}
                    className={`flex h-10 min-w-[44px] items-center justify-center gap-1.5 rounded-full border px-3 text-slate-900 ${getLevelTheme(levelInfo.level).chipClass}`}
                  >
                    <span className="text-xs">
                      {getLevelTheme(levelInfo.level).icon}
                    </span>
                    <span className="text-xs font-bold">
                      Lv.{levelInfo.level}
                    </span>
                  </button>
                ) : (
                  <button
                    onClick={openWatchlistActivity}
                    className={`relative flex h-10 min-w-[44px] items-center justify-center gap-1.5 rounded-full border px-3 text-slate-900 ${getLevelTheme(levelInfo.level).chipClass}`}
                  >
                    <span className="text-xs">
                      {getLevelTheme(levelInfo.level).icon}
                    </span>
                    <span className="text-xs font-bold">
                      Lv.{levelInfo.level}
                    </span>
                    {unreadWatchlistCount > 0 ? (
                      <span className="absolute -right-1 -top-1 inline-flex min-w-[18px] items-center justify-center rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-black text-white">
                        {unreadWatchlistCount}
                      </span>
                    ) : null}
                  </button>
                )}

                {isAdmin && (
                  <button
                    onClick={() => void handleAdminToggle()}
                    className={`flex h-11 w-11 items-center justify-center rounded-full ${
                      adminMode
                        ? 'bg-[#4f7cff] text-white shadow-[0_12px_24px_rgba(79,124,255,0.24)]'
                        : 'border border-slate-200 bg-white text-slate-900 shadow-[0_6px_18px_rgba(15,23,42,0.05)]'
                    }`}
                  >
                    <Shield className="h-5 w-5" />
                  </button>
                )}

                <button
                  onClick={openReportPost}
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-900 shadow-[0_6px_16px_rgba(15,23,42,0.05)]"
                >
                  <Flag className="h-5 w-5" />
                </button>

                <button
                  onClick={() => setWriteOpen(true)}
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-[#4f7cff] text-white shadow-[0_12px_22px_rgba(79,124,255,0.26)]"
                >
                  <Plus className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="mt-3 flex gap-2">
              {(['추천', '인기', '최신'] as const).map((label) => (
                <button
                  key={label}
                  onClick={() => {
                    setTab(label)
                    setCurrentIndex(0)
                  }}
                  className={`rounded-full px-4 py-2 text-[13px] font-semibold tracking-[-0.01em] transition ${
                    tab === label
                      ? 'bg-[linear-gradient(135deg,#5b7cff_0%,#4f7cff_55%,#6d8fff_100%)] text-white shadow-[0_12px_24px_rgba(79,124,255,0.24)]'
                      : 'border border-slate-200 bg-white text-slate-700 shadow-[0_6px_16px_rgba(15,23,42,0.04)]'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="mt-3 -mx-1 overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
              <div className="flex min-w-max gap-2 px-1">
                {categoryFilters.map((category) => (
                  <button
                    key={category}
                    onClick={() => {
                      setSelectedCategory(category)
                      setCurrentIndex(0)
                    }}
                    className={`whitespace-nowrap rounded-full px-3 py-2 text-[12px] font-semibold tracking-[-0.01em] transition ${
                      selectedCategory === category
                        ? 'border border-[#cfe0ff] bg-[linear-gradient(180deg,#eff4ff_0%,#e7efff_100%)] text-[#315fdc] shadow-[0_10px_20px_rgba(79,124,255,0.12)]'
                        : 'border border-slate-200/90 bg-white/95 text-slate-600 shadow-[0_6px_14px_rgba(15,23,42,0.04)]'
                    }`}
                  >
                    {category}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </header>

        <div className="px-4">
          <div className="mx-1 border-t border-slate-200/80" />
        </div>

        <main className="px-4 pb-32 pt-2">
          {activeLiveTickerItem ? (
            <div className="mb-3 overflow-hidden rounded-[18px] border border-[#dbe7ff] bg-[linear-gradient(180deg,#ffffff_0%,#f4f8ff_100%)] shadow-[0_12px_28px_rgba(79,124,255,0.12)]">
              <div className="flex items-center gap-2 px-3 py-2.5">
                <div className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[linear-gradient(135deg,#4f7cff_0%,#7c5cff_100%)] px-2 py-1 text-[10px] font-black tracking-[0.04em] text-white shadow-[0_8px_20px_rgba(79,124,255,0.22)]">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white/70 opacity-80" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
                  </span>
                  <span>
                    {activeLiveTickerItem.liveBadgeLabel ?? '실시간 논쟁'}
                  </span>
                </div>

                <div className="relative h-[24px] min-w-0 flex-1 overflow-hidden">
                  <AnimatePresence mode="wait">
                    <motion.button
                      key={activeLiveTickerItem.id}
                      type="button"
                      onClick={handleLiveTickerOpen}
                      initial={{ y: 18, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      exit={{ y: -18, opacity: 0 }}
                      transition={{ duration: 0.22 }}
                      className="absolute inset-0 flex w-full items-center gap-2 text-left"
                    >
                      <span
                        className={`shrink-0 text-[12px] font-black ${activeLiveTickerItem.rankToneClass}`}
                      >
                        {activeLiveTickerItem.rank}위
                      </span>
                      <span className="min-w-0 flex-1 truncate text-[13px] font-extrabold tracking-[-0.01em] text-slate-900">
                        {activeLiveTickerItem.title}
                      </span>
                      <span className="shrink-0 rounded-full bg-rose-50 px-1.5 py-0.5 text-[10px] font-bold text-rose-600">
                        {activeLiveTickerItem.emotionLabel}
                      </span>
                    </motion.button>
                  </AnimatePresence>
                </div>
              </div>

              <div className="flex items-center justify-between gap-2 border-t border-slate-200/70 bg-white/70 px-3 py-2">
                <button
                  type="button"
                  onClick={handleLiveTickerOpen}
                  className="min-w-0 flex-1 text-left"
                >
                  <div className="flex min-w-0 items-center gap-1.5 text-[11px] font-semibold text-slate-600">
                    <span className="shrink-0 rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-bold text-slate-600">
                      {activeLiveTickerItem.category}
                    </span>
                    <span className="truncate">
                      {activeLiveTickerItem.shortMetric}
                    </span>
                  </div>
                </button>

                <div className="flex shrink-0 items-center gap-1.5">
                  {liveTickerItems.map((item, index) => {
                    const active = index === liveTickerIndex
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setLiveTickerIndex(index)}
                        aria-label={`${item.rank}위 보기`}
                        className={`h-1.5 rounded-full transition-all ${
                          active ? 'w-5 bg-[#4f7cff]' : 'w-1.5 bg-slate-300'
                        }`}
                      />
                    )
                  })}
                </div>
              </div>
            </div>
          ) : null}

          <div
            ref={currentPostCardRef}
            className={`rounded-[30px] border bg-[linear-gradient(180deg,rgba(255,255,255,0.99)_0%,rgba(247,250,255,0.98)_100%)] p-4 shadow-[0_18px_42px_rgba(148,163,184,0.16),0_2px_10px_rgba(15,23,42,0.04)] backdrop-blur transition-[border-color,box-shadow,transform] duration-220 ${postFocusPulse ? 'border-[#9db7ff] ring-4 ring-[#dfe9ff] shadow-[0_22px_48px_rgba(79,124,255,0.18),0_2px_10px_rgba(15,23,42,0.04)]' : 'border-white/90'}`}
          >
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1">
                  {currentPost.category}
                </span>
                <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1">
                  {currentPost.ageGroup}
                </span>
              </div>

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

            <div className="rounded-[24px] border border-slate-200/90 bg-[linear-gradient(180deg,#ffffff_0%,#f9fbff_100%)] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_10px_22px_rgba(148,163,184,0.12)]">
              <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">
                today issue
              </div>
              <h1 className="text-[22px] font-black leading-tight tracking-tight text-slate-900">
                {currentPost.hidden && !adminMode
                  ? '신고 누적으로 숨겨진 글'
                  : currentPost.title}
              </h1>
              <p className="mt-3 whitespace-pre-line text-[15px] leading-7 text-slate-700">
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
                    className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-bold transition-all duration-300 ${sharePulse ? 'border-emerald-300 bg-[linear-gradient(135deg,#ecfdf5_0%,#d1fae5_100%)] text-emerald-700 shadow-[0_12px_26px_rgba(16,185,129,0.18)] -translate-y-0.5' : 'border-blue-200 bg-blue-50 text-blue-700'}`}
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
                  <div className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-bold text-slate-600">
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
              {currentHotMeta ? (
                <div className="mt-3 grid grid-cols-3 gap-2 text-center text-[11px]">
                  <div className="rounded-2xl border border-rose-100 bg-[linear-gradient(180deg,#fff1f2_0%,#ffffff_100%)] px-2.5 py-2 shadow-[0_4px_12px_rgba(15,23,42,0.04)]">
                    <div className="text-rose-400">최근 참여자</div>
                    <div className="mt-1 text-sm font-black text-slate-900">
                      {currentHotMeta.vote1h}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-violet-100 bg-[linear-gradient(180deg,#f5f3ff_0%,#ffffff_100%)] px-2.5 py-2 shadow-[0_4px_12px_rgba(15,23,42,0.04)]">
                    <div className="text-violet-400">붙는 댓글</div>
                    <div className="mt-1 text-sm font-black text-slate-900">
                      {currentHotMeta.comment1h}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-amber-100 bg-[linear-gradient(180deg,#fffbeb_0%,#ffffff_100%)] px-2.5 py-2 shadow-[0_4px_12px_rgba(15,23,42,0.04)]">
                    <div className="text-amber-500">퍼진 공유</div>
                    <div className="mt-1 text-sm font-black text-slate-900">
                      {currentHotMeta.share24h}
                    </div>
                  </div>
                </div>
              ) : null}
            </div>

            {(!currentPost.hidden || adminMode) && (
              <div className="mt-4 space-y-2.5">
                <VoteOption
                  active={votes[currentPost.id] === 'left'}
                  label={currentPost.leftLabel}
                  value={votes[currentPost.id] ? displayedPercent.left : p.left}
                  onClick={() => void handleVote('left')}
                  disabled={isVoting}
                />
                <VoteOption
                  active={votes[currentPost.id] === 'right'}
                  label={currentPost.rightLabel}
                  value={
                    votes[currentPost.id] ? displayedPercent.right : p.right
                  }
                  onClick={() => void handleVote('right')}
                  disabled={isVoting}
                />

                {votes[currentPost.id] ? (
                  <div className="space-y-4">
                    {(currentResultEmotion ||
                      currentMinorityLabel ||
                      currentTensionMeta ||
                      currentResultReveal) && (
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
                          {currentResultReveal ? (
                            <div
                              className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-black ${currentResultReveal.toneClass}`}
                            >
                              {currentResultReveal.label}
                            </div>
                          ) : null}
                        </div>

                        {currentResultReveal ? (
                          <div className="mt-3 rounded-2xl border border-slate-200/80 bg-white px-3 py-3 shadow-[0_6px_14px_rgba(15,23,42,0.04)]">
                            <div className="flex items-end justify-between gap-3">
                              <div>
                                <div className="text-[11px] font-extrabold tracking-[0.14em] text-slate-400">
                                  RESULT FLOW
                                </div>
                                <div className="mt-1 text-base font-black text-slate-900">
                                  {currentResultReveal.label}
                                </div>
                              </div>
                              <div
                                className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-black ${currentResultReveal.toneClass}`}
                              >
                                {currentResultUnlockLevel > 0
                                  ? `공개 ${currentResultUnlockLevel}/4`
                                  : '공개 0/4'}
                              </div>
                            </div>
                            <div className="mt-2 text-[13px] font-semibold text-slate-600">
                              {currentResultReveal.helper}
                            </div>

                            {currentResultReveal.showExact ? (
                              <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
                                <div className="text-[11px] font-extrabold tracking-[0.14em] text-slate-400">
                                  LIVE RESULT
                                </div>
                                <div className="mt-1 text-base font-black text-slate-900">
                                  {displayedPercent.left}% vs{' '}
                                  {displayedPercent.right}%
                                </div>
                                <div className="mt-1 text-[12px] text-slate-500">
                                  실시간 반응이 계속 들어와 수치는 조금씩 달라질
                                  수 있음
                                </div>
                              </div>
                            ) : null}

                            {currentResultUnlockLevel < 3 ? (
                              <div className="mt-3 grid grid-cols-2 gap-2">
                                <button
                                  onClick={() => setCommentOpen(true)}
                                  className="rounded-[18px] border border-slate-200 bg-white px-3 py-2 text-[12px] font-bold text-slate-700"
                                >
                                  댓글 보면 더 공개
                                </button>
                                <button
                                  onClick={() =>
                                    void toggleCurrentPostWatchlist()
                                  }
                                  className="rounded-[18px] bg-[linear-gradient(135deg,#c7d2fe_0%,#93c5fd_100%)] px-3 py-2 text-[12px] font-black text-slate-900 shadow-[0_10px_18px_rgba(79,124,255,0.16)]"
                                >
                                  결말궁금 저장
                                </button>
                              </div>
                            ) : null}
                          </div>
                        ) : null}

                        <div className="mt-2 text-[13px] font-semibold text-slate-600">
                          {currentTension?.isFlipImminent
                            ? currentTensionMeta.helper
                            : currentMinorityLabel
                              ? currentMinorityLabel.helper
                              : currentResultEmotion === '🔥 개싸움'
                                ? '지금 들어온 사람도 바로 갈릴 가능성이 높음.'
                                : currentResultEmotion === '👀 팽팽'
                                  ? '한두 표만 더 들어와도 분위기가 바뀔 수 있음.'
                                  : currentResultEmotion === '⚡ 기우는 중'
                                    ? '조금씩 한쪽으로 기울지만 아직 안 끝났다.'
                                    : currentTensionMeta
                                      ? currentTensionMeta.helper
                                      : (currentResultReveal?.helper ??
                                        '지금은 한쪽으로 몰렸지만 댓글에서 다시 불붙을 수 있음.')}
                        </div>
                      </div>
                    )}

                    {currentFlipDrama ||
                    currentShadowDrama ||
                    currentChoicePathTop ? (
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
                        </div>
                      </div>
                    ) : null}

                    <div className="rounded-[24px] border border-slate-200/80 bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] p-3.5 shadow-[0_10px_24px_rgba(15,23,42,0.06)]">
                      <div className="text-[11px] font-extrabold tracking-[0.14em] text-slate-400">
                        QUICK REACTION
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {(
                          Object.keys(POST_REACTION_META) as PostReactionType[]
                        ).map((reactionType) => {
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
                              className={`inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-[12px] font-bold transition ${active ? meta.activeClass : meta.idleClass}`}
                            >
                              <span>{meta.label}</span>
                              <span>{count}</span>
                            </button>
                          )
                        })}
                      </div>
                      <div className="mt-3 flex items-center gap-2">
                        <button
                          onClick={() => void toggleCurrentPostWatchlist()}
                          className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-[12px] font-bold transition ${
                            currentWatchlisted
                              ? 'border-indigo-200 bg-indigo-50 text-indigo-700'
                              : 'border-slate-200 bg-white text-slate-600'
                          }`}
                        >
                          <span>
                            {currentWatchlisted ? '결말기다림 ✓' : '결말궁금'}
                          </span>
                          <span className="text-[11px] text-slate-400">
                            {currentWatchlisted
                              ? '내 활동에서 다시 보기'
                              : '나중에 결과 보기'}
                          </span>
                        </button>
                      </div>
                      {latestOutcome && currentResultReveal?.showOutcome ? (
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
                          <div className="mt-1">{latestOutcome.summary}</div>
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
                      className="w-full rounded-[24px] border border-[#dbe7ff] bg-[linear-gradient(180deg,#ffffff_0%,#f4f8ff_100%)] px-4 py-3 text-left transition-all shadow-[0_10px_24px_rgba(79,124,255,0.10)]"
                    >
                      <div className="text-xs font-bold text-[#4f7cff]">
                        {nextRecommendationReason}
                      </div>
                      <div className="mt-1 text-base font-bold text-slate-900">
                        {nextRecommendationTitle}
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        {nextRecommendationHelper}
                      </div>
                    </button>

                    {!isViewingSharedPost ? (
                      <div className="grid grid-cols-2 gap-2">
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

                        {isSharedOwnerViewingPost && !showOwnerShareResults ? (
                          <div className="mt-3 space-y-3">
                            <div
                              className={`rounded-2xl border px-4 py-3.5 text-[15px] leading-7 font-semibold transition-all duration-300 ${sharePulse ? 'border-emerald-200 bg-[linear-gradient(135deg,#ecfdf5_0%,#f0fdf4_100%)] text-emerald-700 shadow-[0_12px_26px_rgba(16,185,129,0.10)]' : 'border-slate-200/80 bg-white text-slate-700'}`}
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

                            <div className="grid grid-cols-2 gap-2">
                              <button
                                onClick={() => setShowOwnerShareResults(true)}
                                className={`rounded-[18px] px-4 py-3 text-sm font-black text-slate-900 shadow-[0_12px_24px_rgba(79,124,255,0.16)] transition-all duration-300 ${sharePulse ? 'scale-[1.02] bg-[linear-gradient(135deg,#bbf7d0_0%,#86efac_48%,#4ade80_100%)]' : 'bg-[linear-gradient(135deg,#c7d2fe_0%,#93c5fd_100%)]'}`}
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
                                  결과 보기 전에 다른 논쟁 하나 더 보면 더 오래
                                  머물게 됨
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
                                  className={`rounded-2xl border px-3 py-3 text-center transition-all duration-300 ${sharePulse ? 'border-emerald-200 bg-[linear-gradient(135deg,#ffffff_0%,#ecfdf5_100%)] shadow-[0_14px_26px_rgba(16,185,129,0.12)] scale-[1.02]' : 'border-slate-200/80 bg-slate-50/80'}`}
                                >
                                  <div className="text-[11px] text-slate-400">
                                    친구들 {currentPost.leftLabel}
                                  </div>
                                  <div className="mt-1 flex items-center justify-center gap-1.5 text-lg font-black text-slate-900">
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
                                  className={`rounded-2xl border px-3 py-3 text-center transition-all duration-300 ${sharePulse ? 'border-emerald-200 bg-[linear-gradient(135deg,#ffffff_0%,#ecfdf5_100%)] shadow-[0_14px_26px_rgba(16,185,129,0.12)] scale-[1.02]' : 'border-slate-200/80 bg-slate-50/80'}`}
                                >
                                  <div className="text-[11px] text-slate-400">
                                    친구들 {currentPost.rightLabel}
                                  </div>
                                  <div className="mt-1 flex items-center justify-center gap-1.5 text-lg font-black text-slate-900">
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
                  className="rounded-[18px] bg-[linear-gradient(135deg,#5b7cff_0%,#4f7cff_55%,#6d8fff_100%)] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_12px_22px_rgba(79,124,255,0.22)]"
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
            requestLightweightMetaRefresh()
          }}
          onAddComment={(text, side) => void addComment(text, side)}
          onLikeComment={(commentId) => void likeComment(commentId)}
          likedComments={likedComments}
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
          onReactComment={(commentId, reactionType) =>
            void reactToComment(commentId, reactionType)
          }
          onExposeComments={(count) => {
            if (!currentPost?.id || !votes[currentPost.id]) return
            const currentReads =
              resultUnlockMap[currentPost.id]?.commentReads ?? 0
            const nextReads = currentReads + count
            void upsertResultUnlock(currentPost.id, {
              commentReadsDelta: count,
              unlockLevel: nextReads >= 3 ? 2 : undefined,
              isWatchlisted: currentWatchlisted,
            })
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
          onClose={() => setActivityOpen(false)}
          myPosts={myPosts}
          myComments={myComments}
          watchlistItems={watchlistItems}
          unreadWatchlistCount={unreadWatchlistCount}
          initialTab={activityInitialTab}
          onOpenPost={openPostDirect}
          onOpenComment={openCommentDirect}
          onLogout={() => void handleLogout()}
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
