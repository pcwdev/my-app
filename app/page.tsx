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
  const total = leftVotes + rightVotes
  if (!total) return { left: 50, right: 50 }
  return {
    left: Math.round((leftVotes / total) * 100),
    right: Math.round((rightVotes / total) * 100),
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
  const total = left + right
  if (total === 0) return { left: 50, right: 50 }

  return {
    left: Math.round((left / total) * 100),
    right: Math.round((right / total) * 100),
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
  if (total < 5) return null

  const myVotes =
    mySide === 'left'
      ? Number(post.leftVotes ?? 0)
      : Number(post.rightVotes ?? 0)
  const ratio = myVotes / Math.max(total, 1)

  if (ratio < 0.2) return '😳 너만 틀림'
  if (ratio < 0.35) return '🤨 소수 의견'
  return null
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

const VoteOption = React.memo(function VoteOption({
  active,
  label,
  value,
  onClick,
}: {
  active: boolean
  label: string
  value: number
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full rounded-[22px] border px-4 py-2.5 text-left transition-all duration-200 ${
        active
          ? 'border-[#cfe0ff] bg-[linear-gradient(180deg,#f7faff_0%,#eaf1ff_100%)] shadow-[0_14px_26px_rgba(79,124,255,0.14)]'
          : 'border-slate-200/80 bg-white hover:-translate-y-0.5 hover:bg-slate-50 shadow-[0_7px_16px_rgba(15,23,42,0.04)]'
      }`}
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

        <div className="mt-3 flex items-center justify-between gap-3 text-xs">
          {!comment.hidden ? (
            <>
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
            </>
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
    </div>
  )
})

function MyActivityModal({
  open,
  onClose,
  myPosts,
  myComments,
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
  onOpenPost: (postId: number) => void
  onOpenComment: (postId: number) => void
  onLogout: () => void
  profile: ProfileRow | null
  stats: UserStatsRow
  badges: string[]
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
              onClick={() =>
                setVisibleCount((prev) => prev + INITIAL_COMMENT_BATCH)
              }
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
  const [currentIndex, setCurrentIndex] = useState(0)
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
  const [hotNowPosts, setHotNowPosts] = useState<PostItem[]>([])

  useEffect(() => {
    postsRef.current = posts
  }, [posts])

  const featuredBadge = badges[0] ?? null
  const currentActorKey = authUser?.id ?? voterKey ?? null

  const [deletedPosts, setDeletedPosts] = useState<PostItem[]>([])
  const [deletedComments, setDeletedComments] = useState<DeletedCommentItem[]>(
    [],
  )
  const [deletedOpen, setDeletedOpen] = useState(false)

  const [toast, setToast] = useState('')
  const [commentOpen, setCommentOpen] = useState(false)
  const [writeOpen, setWriteOpen] = useState(false)
  const [activityOpen, setActivityOpen] = useState(false)
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

      setLoading(false)
    },
    [loadDiscoveryData],
  )

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

  useEffect(() => {
    if (authUser?.id) {
      void fetchMyActivity(authUser.id)
    } else {
      setMyPosts([])
      setMyComments([])
    }
  }, [authUser?.id, fetchMyActivity])

  useEffect(() => {
    if (!voterKey) return
    void loadProgress()
  }, [voterKey, authUser?.id, loadProgress])

  useEffect(() => {
    return () => {
      if (sharePulseTimerRef.current) {
        clearTimeout(sharePulseTimerRef.current)
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
      await loadDiscoveryData()
      return nextShareId
    },
    [
      currentPost,
      voterKey,
      syncShareUrl,
      loadShareStatsBySessionId,
      logPostEvent,
      loadDiscoveryData,
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
    void loadDiscoveryData(postsRef.current)
  }, [currentPost?.id, logPostEvent, loadDiscoveryData])

  const handleVote = async (choice: VoteSide) => {
    if (!currentPost || !voterKey) return

    const prevChoice = votes[currentPost.id]
    if (prevChoice === choice) return

    const nextLeft =
      currentPost.leftVotes +
      (prevChoice === 'left' ? -1 : 0) +
      (choice === 'left' ? 1 : 0)

    const nextRight =
      currentPost.rightVotes +
      (prevChoice === 'right' ? -1 : 0) +
      (choice === 'right' ? 1 : 0)

    setPosts((prev) =>
      prev.map((post) =>
        post.id === currentPost.id
          ? {
              ...post,
              leftVotes: nextLeft,
              rightVotes: nextRight,
            }
          : post,
      ),
    )
    setVotes((prev) => ({ ...prev, [currentPost.id]: choice }))

    const { error: voteError } = await supabase.from('votes').upsert(
      {
        post_id: currentPost.id,
        voter_key: voterKey,
        side: choice,
      },
      { onConflict: 'post_id,voter_key' },
    )

    if (voteError) {
      console.error('투표 저장 실패', voteError)
      showToast('투표 저장 실패')
      void fetchAll(voterKey)
      return
    }

    const { error: postError } = await supabase
      .from('posts')
      .update({
        left_votes: nextLeft,
        right_votes: nextRight,
      })
      .eq('id', currentPost.id)

    if (postError) {
      console.error('게시글 투표수 업데이트 실패', postError)
      showToast('투표 반영 실패')
      void fetchAll(voterKey)
      return
    }

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

        if (!sessionPostId || sessionPostId !== Number(currentPost.id)) {
          console.error('공유 세션 post_id 불일치', {
            sessionPostId,
            currentPostId: currentPost.id,
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

    await logPostEvent({
      postId: currentPost.id,
      eventType: 'vote',
      side: choice,
    })

    if (activeShareSessionId && isSharedVisitor) {
      await logPostEvent({
        postId: currentPost.id,
        eventType: 'share_vote',
        side: choice,
        sessionId: activeShareSessionId,
      })
    }

    await loadDiscoveryData()

    await updateProgress(
      {
        points: 1,
        votes_count: prevChoice ? 0 : 1,
      },
      prevChoice ? '판단 변경 완료' : '🔥 +1 포인트',
    )

    markPostMeaningful({
      ...currentPost,
      leftVotes: nextLeft,
      rightVotes: nextRight,
    })
  }

  const prev = () => {
    endSharedEntryMode()
    setCurrentIndex((i) => Math.max(i - 1, 0))
  }

  const next = () => {
    endSharedEntryMode()
    setCurrentIndex((i) => Math.min(i + 1, filteredPosts.length - 1))
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
      endSharedEntryMode()
      setCurrentIndex(nextIndexInFiltered)
      return
    }

    const fallbackIndex = posts.findIndex((p) => p.id === postId)
    if (fallbackIndex >= 0) {
      endSharedEntryMode()
      setTab('추천')
      setSelectedCategory('전체')
      setCurrentIndex(fallbackIndex)
    }
  }

  const openPostDirect = (postId: number) => {
    const index = posts.findIndex((p) => p.id === postId)
    if (index >= 0) {
      endSharedEntryMode()
      setTab('추천')
      setSelectedCategory('전체')
      setCurrentIndex(index)
      setActivityOpen(false)
    }
  }

  const openCommentDirect = (postId: number) => {
    const index = posts.findIndex((p) => p.id === postId)
    if (index >= 0) {
      endSharedEntryMode()
      setTab('추천')
      setSelectedCategory('전체')
      setCurrentIndex(index)
      setActivityOpen(false)
      setCommentOpen(true)
    }
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
    await loadDiscoveryData()

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
    await loadDiscoveryData([newPost, ...posts])
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
                      onClick={() => setActivityOpen(true)}
                      className="flex h-10 min-w-[44px] items-center justify-center rounded-full border border-slate-200 bg-white px-3 text-slate-900 shadow-[0_6px_16px_rgba(15,23,42,0.05)]"
                    >
                      <span className="text-xs font-bold">
                        {profile?.anonymous_name ?? '익명'}
                      </span>
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
                    onClick={() => setActivityOpen(true)}
                    className={`flex h-10 min-w-[44px] items-center justify-center gap-1.5 rounded-full border px-3 text-slate-900 ${getLevelTheme(levelInfo.level).chipClass}`}
                  >
                    <span className="text-xs">
                      {getLevelTheme(levelInfo.level).icon}
                    </span>
                    <span className="text-xs font-bold">
                      Lv.{levelInfo.level}
                    </span>
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
          {discoveryTopPosts.length > 0 ? (
            <div className="mb-3 rounded-[24px] border border-white/90 bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(245,248,255,0.98)_100%)] p-3.5 shadow-[0_14px_30px_rgba(148,163,184,0.12)]">
              <div className="flex items-center gap-2 text-[11px] font-extrabold tracking-[0.18em] text-[#4f7cff]">
                <BarChart3 className="h-4 w-4" /> LIVE BOARD
              </div>
              <div className="mt-2 text-sm font-black text-slate-900">
                지금 판 커지는 글
              </div>
              <div className="mt-1 text-[12px] font-semibold text-slate-500">
                방금 불붙는 글부터 먼저 보게 만드는 실시간 보드
              </div>
              <div className="mt-3 space-y-2">
                {discoveryTopPosts.map((item, index) => {
                  const hotMeta = hotScoreMap[item.id]
                  const turningMeta = turningPointMap[item.id]
                  return (
                    <button
                      key={item.id}
                      onClick={() => moveToPostWithGuard(item.id)}
                      className="w-full rounded-2xl border border-slate-200/80 bg-white px-3.5 py-3 text-left shadow-[0_8px_18px_rgba(15,23,42,0.05)]"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-[11px] font-bold text-[#4f7cff]">
                            TOP {index + 1}
                          </div>
                          <div className="mt-1 line-clamp-1 text-sm font-bold text-slate-900">
                            {item.title}
                          </div>
                          <div className="mt-1 flex flex-wrap gap-1.5 text-[11px] text-slate-500">
                            <span>{hotMeta?.vote1h ?? 0}표/1시간</span>
                            <span>·</span>
                            <span>{item.comments.length}댓글</span>
                            <span>·</span>
                            <span>{item.leftVotes + item.rightVotes}참여</span>
                          </div>
                        </div>
                        <div className="shrink-0 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-extrabold text-slate-700">
                          {getTurningPointLabel(turningMeta?.eventLabel) ??
                            getHotBadge(hotMeta)?.label ??
                            '반응 중'}
                        </div>
                      </div>
                      <div className="mt-2 text-[11px] font-semibold text-slate-500">
                        {getTurningPointLabel(turningMeta?.eventLabel)
                          ? '지금 분위기가 바뀌는 중'
                          : getHotBadge(hotMeta)?.label === '🔥 지금 난리남'
                            ? '들어가면 바로 반응 쏟아지는 글'
                            : getHotBadge(hotMeta)?.label === '💬 댓글 폭발'
                              ? '댓글창에서 싸움 붙는 중'
                              : getHotBadge(hotMeta)?.label === '📤 퍼지는 중'
                                ? '공유 타고 퍼지는 글'
                                : '반응이 계속 올라오는 글'}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          ) : null}

          <AnimatePresence mode="wait">
            <motion.div
              key={`${tab}-${selectedCategory}-${currentPost.id}`}
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -18 }}
              transition={{ duration: 0.18 }}
              className="rounded-[30px] border border-white/90 bg-[linear-gradient(180deg,rgba(255,255,255,0.99)_0%,rgba(247,250,255,0.98)_100%)] p-4 shadow-[0_18px_42px_rgba(148,163,184,0.16),0_2px_10px_rgba(15,23,42,0.04)] backdrop-blur"
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
                </div>
                {currentHotMeta ? (
                  <div className="mt-3 grid grid-cols-3 gap-2 text-center text-[11px]">
                    <div className="rounded-2xl border border-rose-100 bg-[linear-gradient(180deg,#fff1f2_0%,#ffffff_100%)] px-2.5 py-2 shadow-[0_4px_12px_rgba(15,23,42,0.04)]">
                      <div className="text-rose-400">불붙는 표</div>
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
                    value={p.left}
                    onClick={() => void handleVote('left')}
                  />
                  <VoteOption
                    active={votes[currentPost.id] === 'right'}
                    label={currentPost.rightLabel}
                    value={p.right}
                    onClick={() => void handleVote('right')}
                  />

                  {votes[currentPost.id] ? (
                    <div className="space-y-4">
                      {(currentResultEmotion || currentMinorityLabel) && (
                        <div className="rounded-[24px] border border-slate-200/80 bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] p-3.5 shadow-[0_10px_24px_rgba(15,23,42,0.06)]">
                          <div className="flex flex-wrap items-center gap-2">
                            {currentResultEmotion ? (
                              <div className="inline-flex rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-[11px] font-black text-rose-700">
                                {currentResultEmotion}
                              </div>
                            ) : null}
                            {currentMinorityLabel ? (
                              <div className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[11px] font-black text-amber-700">
                                {currentMinorityLabel}
                              </div>
                            ) : null}
                          </div>
                          <div className="mt-2 text-[13px] font-semibold text-slate-600">
                            {currentMinorityLabel
                              ? '남들 의견이랑 갈릴수록 더 보고 싶어지는 글이다.'
                              : currentResultEmotion === '🔥 개싸움'
                                ? '지금 들어온 사람도 바로 갈릴 가능성이 높음.'
                                : currentResultEmotion === '👀 팽팽'
                                  ? '한두 표만 더 들어와도 분위기가 바뀔 수 있음.'
                                  : currentResultEmotion === '⚡ 기우는 중'
                                    ? '조금씩 한쪽으로 기울지만 아직 안 끝났다.'
                                    : '지금은 한쪽으로 몰렸지만 댓글에서 다시 불붙을 수 있음.'}
                          </div>
                        </div>
                      )}

                      <button
                        onClick={handleNextWithGuard}
                        className="w-full rounded-[24px] border border-[#dbe7ff] bg-[linear-gradient(180deg,#ffffff_0%,#f4f8ff_100%)] px-4 py-3 text-left transition-all shadow-[0_10px_24px_rgba(79,124,255,0.10)]"
                      >
                        <div className="text-xs font-bold text-[#4f7cff]">
                          다음 맞냐
                        </div>
                        <div className="mt-1 text-base font-bold text-slate-900">
                          {filteredPosts[
                            Math.min(currentIndex + 1, filteredPosts.length - 1)
                          ]?.title || '다음 글 보기'}
                        </div>
                        <div className="mt-1 text-xs text-slate-500">
                          눌러서 바로 이동
                        </div>
                      </button>

                      {controversialPosts.length > 0 && (
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

                          {isSharedOwnerViewingPost &&
                          !showOwnerShareResults ? (
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
            </motion.div>
          </AnimatePresence>
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
          onClose={() => setCommentOpen(false)}
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
