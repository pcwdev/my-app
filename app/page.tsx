'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  BarChart3,
  Flag,
  Flame,
  Heart,
  MessageCircle,
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
  if (ratio >= dangerAt) return 'text-red-300'
  if (ratio >= warnAt) return 'text-yellow-300'
  return 'text-white/35'
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
      className={`w-full rounded-[28px] border px-4 py-4 text-left transition-all ${
        active
          ? 'border-[#6d8dff]/45 bg-[#6d8dff]/16 shadow-[0_8px_30px_rgba(79,124,255,0.18)]'
          : 'border-white/10 bg-white/[0.05] hover:bg-white/[0.08]'
      }`}
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <span
          className={`inline-flex rounded-xl px-2 py-1 text-[13px] font-bold ${
            active ? 'bg-[#4f7cff] text-white' : 'bg-white/10 text-white/90'
          }`}
        >
          {label}
        </span>
        <span className="text-[22px] font-extrabold text-white">{value}%</span>
      </div>
      <div className="h-2.5 w-full rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-[#6d8dff] transition-all duration-150"
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
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm">
      <div className="mx-auto mt-24 max-w-sm rounded-[32px] border border-white/10 bg-[#131722] p-5 text-white shadow-2xl">
        <div className="mb-1 text-lg font-bold">신고하기</div>
        <div className="mb-4 text-sm text-white/45">{targetLabel}</div>
        <div className="space-y-2">
          {reportReasons.map((item) => (
            <button
              key={item}
              onClick={() => setReason(item)}
              className={`w-full rounded-2xl border px-4 py-3 text-left text-sm font-bold ${
                reason === item
                  ? 'border-[#6d8dff]/45 bg-[#4f7cff] text-white'
                  : 'border-white/10 bg-white/[0.05] text-white'
              }`}
            >
              {item}
            </button>
          ))}
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <button
            onClick={onClose}
            className="rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 font-bold"
          >
            취소
          </button>
          <button
            onClick={() => onSubmit(reason)}
            className="rounded-2xl bg-[#f5f7ff] px-4 py-3 font-bold text-[#111827]"
          >
            신고 접수
          </button>
        </div>
      </div>
    </div>
  )
}

function AuthRequiredModal({
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
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm">
      <div className="mx-auto mt-24 max-w-sm rounded-[32px] border border-white/10 bg-[#131722] p-5 text-white shadow-2xl">
        <div className="mb-1 text-lg font-bold">한 번만 로그인</div>
        <div className="mb-4 text-sm text-white/45">
          로그인해도 화면에서는 익명 닉네임만 보여
        </div>

        <div className="space-y-3">
          <button
            onClick={onGoogleLogin}
            className="w-full rounded-2xl bg-[#f5f7ff] px-4 py-3 font-bold text-[#111827]"
          >
            구글로 1초 시작
          </button>

          <button
            onClick={onClose}
            className="w-full rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 font-bold text-white"
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
  onLikeComment,
  isLiked,
  onOpenReportComment,
  adminMode,
  onAdminRestoreComment,
  onAdminDeleteComment,
}: {
  comment: CommentItem
  onLikeComment: (commentId: number) => void | Promise<void>
  isLiked: boolean
  onOpenReportComment: (commentId: number) => void
  adminMode: boolean
  onAdminRestoreComment: (commentId: number) => void
  onAdminDeleteComment: (commentId: number) => void
}) {
  if (comment.hidden && !adminMode) return null

  return (
    <div
      className={`rounded-3xl border p-3 ${
        comment.hidden
          ? 'border-red-400/20 bg-red-400/10'
          : 'border-white/10 bg-white/[0.04]'
      }`}
    >
      <div className="mb-1 flex items-center justify-between text-xs">
        <div className="font-bold text-white">{comment.author}</div>
        <div className="text-white/40">공감 {comment.likes}</div>
      </div>
      <div className="text-[14px] leading-6 text-white/80">
        {comment.hidden ? '신고 누적으로 숨김된 댓글' : comment.text}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {!comment.hidden && (
          <button
            onClick={() => onLikeComment(comment.id)}
            className={`flex items-center gap-1 transition ${
              isLiked ? 'text-[#ff4d6d]' : 'text-white/50'
            }`}
          >
            <Heart className={`h-4 w-4 ${isLiked ? 'fill-[#ff4d6d]' : ''}`} />
            <span>{comment.likes}</span>
          </button>
        )}
        {!comment.hidden && (
          <button
            onClick={() => onOpenReportComment(comment.id)}
            className="text-white/40 transition hover:text-white/70"
          >
            신고
          </button>
        )}
        {adminMode && comment.hidden && (
          <>
            <button
              onClick={() => onAdminRestoreComment(comment.id)}
              className="rounded-full bg-[#f5f7ff] px-3 py-1 text-xs font-bold text-[#111827]"
            >
              숨김 해제
            </button>
            <button
              onClick={() => onAdminDeleteComment(comment.id)}
              className="rounded-full bg-red-500 px-3 py-1 text-xs font-bold text-white"
            >
              삭제
            </button>
          </>
        )}
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
}: {
  open: boolean
  onClose: () => void
  myPosts: MyPostItem[]
  myComments: MyCommentItem[]
  onOpenPost: (postId: number) => void
  onOpenComment: (postId: number) => void
  onLogout: () => void
  profile: ProfileRow | null
}) {
  const [tab, setTab] = useState<'posts' | 'comments'>('posts')

  useEffect(() => {
    if (open) setTab('posts')
  }, [open])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm">
      <div className="mx-auto flex h-[100dvh] min-h-0 max-w-md flex-col bg-[#131722] pb-[env(safe-area-inset-bottom)] text-white">
        <div className="shrink-0 flex items-center justify-between border-b border-white/10 px-5 py-4">
          <div>
            <div className="text-lg font-bold">내 흔적</div>
            <div className="text-sm text-white/45">
              내가 올린 글과 남긴 댓글
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white/[0.07]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="shrink-0 px-5 pt-4">
          <div className="mb-3 rounded-3xl border border-white/10 bg-white/[0.04] px-4 py-3">
            <div className="text-sm font-semibold text-white">
              {profile?.anonymous_name ?? '익명 유저'}
            </div>
            <div className="mt-1 text-xs text-white/45">
              로그인해도 화면에는 익명 닉네임만 보여짐
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setTab('posts')}
              className={`rounded-full px-4 py-2 text-sm font-bold ${
                tab === 'posts'
                  ? 'bg-[#f5f7ff] text-[#111827]'
                  : 'bg-white/[0.07] text-white/80'
              }`}
            >
              내가 올린 글
            </button>
            <button
              onClick={() => setTab('comments')}
              className={`rounded-full px-4 py-2 text-sm font-bold ${
                tab === 'comments'
                  ? 'bg-[#f5f7ff] text-[#111827]'
                  : 'bg-white/[0.07] text-white/80'
              }`}
            >
              내가 남긴 댓글
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 space-y-4 [webkit-overflow-scrolling:touch]">
          {tab === 'posts' && myPosts.length === 0 && (
            <div className="text-sm text-white/50">아직 올린 글이 없음</div>
          )}
          {tab === 'comments' && myComments.length === 0 && (
            <div className="text-sm text-white/50">아직 남긴 댓글이 없음</div>
          )}

          {tab === 'posts' &&
            myPosts.map((item) => (
              <button
                key={item.id}
                onClick={() => onOpenPost(item.postId)}
                className="w-full rounded-3xl border border-white/10 bg-white/[0.04] p-4 text-left"
              >
                <div className="text-xs text-white/45">
                  {item.category} · {item.ageGroup}
                </div>
                <div className="mt-1 font-bold text-white">{item.title}</div>
                <div className="mt-2 text-xs text-white/40">올린 글 보기</div>
              </button>
            ))}

          {tab === 'comments' &&
            myComments.map((item) => (
              <button
                key={item.id}
                onClick={() => onOpenComment(item.postId)}
                className="w-full rounded-3xl border border-white/10 bg-white/[0.04] p-4 text-left"
              >
                <div className="text-xs text-white/45">{item.postTitle}</div>
                <div className="mt-1 text-sm text-white/85">{item.text}</div>
                <div className="mt-2 text-xs text-white/40">
                  댓글 단 글로 이동
                </div>
              </button>
            ))}
        </div>

        <div className="shrink-0 border-t border-white/10 px-5 py-4">
          <button
            onClick={onLogout}
            className="w-full rounded-2xl border border-red-400/20 bg-red-500/15 px-4 py-3 text-sm font-bold text-red-200"
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
    <div className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm">
      <div className="mx-auto flex h-[100dvh] min-h-0 max-w-md flex-col bg-[#131722] pb-[env(safe-area-inset-bottom)] text-white">
        <div className="shrink-0 flex items-center justify-between border-b border-white/10 px-5 py-4">
          <div>
            <div className="text-lg font-bold">삭제 항목 관리</div>
            <div className="text-sm text-white/45">관리자만 복구 가능</div>
          </div>
          <button
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white/[0.07]"
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
                  ? 'bg-[#f5f7ff] text-[#111827]'
                  : 'bg-white/[0.07] text-white/80'
              }`}
            >
              삭제된 글
            </button>
            <button
              onClick={() => setTab('comments')}
              className={`rounded-full px-4 py-2 text-sm font-bold ${
                tab === 'comments'
                  ? 'bg-[#f5f7ff] text-[#111827]'
                  : 'bg-white/[0.07] text-white/80'
              }`}
            >
              삭제된 댓글
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {tab === 'posts' && deletedPosts.length === 0 && (
            <div className="text-sm text-white/50">삭제된 글이 없음</div>
          )}
          {tab === 'comments' && deletedComments.length === 0 && (
            <div className="text-sm text-white/50">삭제된 댓글이 없음</div>
          )}

          {tab === 'posts' &&
            deletedPosts.map((post) => (
              <div
                key={post.id}
                className="rounded-3xl border border-white/10 bg-white/[0.04] p-4"
              >
                <div className="text-xs text-white/45">
                  {post.category} · {post.ageGroup}
                </div>
                <div className="mt-1 font-bold text-white">{post.title}</div>
                <div className="mt-2 text-sm text-white/70 line-clamp-2">
                  {post.content}
                </div>
                <button
                  onClick={() => onRestorePost(post.id)}
                  className="mt-3 rounded-2xl bg-[#f5f7ff] px-4 py-2 text-sm font-bold text-[#111827]"
                >
                  글 복구
                </button>
              </div>
            ))}

          {tab === 'comments' &&
            deletedComments.map((comment) => (
              <div
                key={comment.id}
                className="rounded-3xl border border-white/10 bg-white/[0.04] p-4"
              >
                <div className="text-xs text-white/45">{comment.postTitle}</div>
                <div className="mt-1 text-sm font-semibold text-white">
                  {comment.author}
                </div>
                <div className="mt-2 text-sm text-white/80">{comment.text}</div>
                <button
                  onClick={() => onRestoreComment(comment.id)}
                  className="mt-3 rounded-2xl bg-[#f5f7ff] px-4 py-2 text-sm font-bold text-[#111827]"
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
  isLoggedIn,
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
  isLoggedIn: boolean
}) {
  const [text, setText] = useState('')
  const [commentSide, setCommentSide] = useState<Side>('left')
  const [sortType, setSortType] = useState<'best' | 'latest'>('best')
  const [visibleCount, setVisibleCount] = useState(INITIAL_COMMENT_BATCH)
  const inputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (open && isLoggedIn) {
      const timer = setTimeout(() => inputRef.current?.focus(), 80)
      return () => clearTimeout(timer)
    }
  }, [open, isLoggedIn])

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
  const visibleComments = baseComments.slice(0, visibleCount)
  const bestComment = sortedComments.find((c) => !c.hidden) || sortedComments[0]
  const leftComments = visibleComments.filter(
    (comment) => comment.side === 'left',
  )
  const rightComments = visibleComments.filter(
    (comment) => comment.side === 'right',
  )
  const hasMoreComments = baseComments.length > visibleCount

  const submitComment = () => {
    if (!isLoggedIn) return
    const trimmed = text.trim()
    if (!trimmed) return
    onAddComment(trimmed, commentSide)
    setText('')
  }

  return (
    <div className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm">
      <div className="mx-auto flex h-[100dvh] min-h-0 max-w-md flex-col bg-[#131722] pb-[env(safe-area-inset-bottom)] text-white">
        <div className="shrink-0 flex items-center justify-between border-b border-white/10 px-5 py-4">
          <div>
            <div className="text-lg font-bold">반응</div>
            <div className="text-sm text-white/45">
              {post.comments.length}개
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white/[0.07]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 space-y-4 [webkit-overflow-scrolling:touch]">
          <div className="flex gap-2">
            <button
              onClick={() => setSortType('best')}
              className={`rounded-full px-4 py-2 text-sm font-bold ${
                sortType === 'best'
                  ? 'bg-[#f5f7ff] text-[#111827]'
                  : 'bg-white/[0.07] text-white/80'
              }`}
            >
              베스트
            </button>
            <button
              onClick={() => setSortType('latest')}
              className={`rounded-full px-4 py-2 text-sm font-bold ${
                sortType === 'latest'
                  ? 'bg-[#f5f7ff] text-[#111827]'
                  : 'bg-white/[0.07] text-white/80'
              }`}
            >
              최신
            </button>
          </div>

          {bestComment && !bestComment.hidden && (
            <div className="rounded-[30px] border border-[#6d8dff]/25 bg-[#6d8dff]/12 p-4">
              <div className="mb-2 flex items-center gap-2 text-sm font-bold text-[#9eb1ff]">
                <Flame className="h-4 w-4" /> 베스트 반응
              </div>
              <div className="mb-2 text-sm font-semibold text-white">
                {bestComment.author}
              </div>
              <div className="text-[15px] leading-7 text-white/85">
                {bestComment.text}
              </div>
              <div className="mt-3 text-xs text-white/45">
                공감 {bestComment.likes}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-3">
              <div className="mb-3 text-sm font-bold text-white">
                {post.leftLabel}
              </div>
              <div className="space-y-3">
                {leftComments.map((comment) => (
                  <CommentCard
                    key={comment.id}
                    comment={comment}
                    onLikeComment={onLikeComment}
                    isLiked={!!likedComments[comment.id]}
                    onOpenReportComment={onOpenReportComment}
                    adminMode={adminMode}
                    onAdminRestoreComment={onAdminRestoreComment}
                    onAdminDeleteComment={onAdminDeleteComment}
                  />
                ))}
              </div>
            </div>

            <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-3">
              <div className="mb-3 text-sm font-bold text-white">
                {post.rightLabel}
              </div>
              <div className="space-y-3">
                {rightComments.map((comment) => (
                  <CommentCard
                    key={comment.id}
                    comment={comment}
                    onLikeComment={onLikeComment}
                    isLiked={!!likedComments[comment.id]}
                    onOpenReportComment={onOpenReportComment}
                    adminMode={adminMode}
                    onAdminRestoreComment={onAdminRestoreComment}
                    onAdminDeleteComment={onAdminDeleteComment}
                  />
                ))}
              </div>
            </div>
          </div>

          {hasMoreComments && (
            <button
              onClick={() =>
                setVisibleCount((prev) => prev + INITIAL_COMMENT_BATCH)
              }
              className="w-full rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-sm font-bold text-white"
            >
              반응 더보기
            </button>
          )}
        </div>

        <div className="shrink-0 border-t border-white/10 bg-[#131722] px-5 pt-3 pb-[max(12px,env(safe-area-inset-bottom))] space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setCommentSide('left')}
              className={`rounded-2xl px-4 py-3 text-sm font-bold ${
                commentSide === 'left'
                  ? 'bg-[#f5f7ff] text-[#111827]'
                  : 'bg-white/[0.07] text-white'
              }`}
            >
              {post.leftLabel}
            </button>
            <button
              onClick={() => setCommentSide('right')}
              className={`rounded-2xl px-4 py-3 text-sm font-bold ${
                commentSide === 'right'
                  ? 'bg-[#f5f7ff] text-[#111827]'
                  : 'bg-white/[0.07] text-white'
              }`}
            >
              {post.rightLabel}
            </button>
          </div>

          <div>
            <div className="flex items-center gap-2">
              <input
                ref={inputRef}
                value={text}
                maxLength={LIMITS.comment}
                disabled={!isLoggedIn}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                    e.preventDefault()
                    submitComment()
                  }
                }}
                placeholder={
                  isLoggedIn ? '익명으로 반응 남기기' : '댓글은 로그인 후 가능'
                }
                className="h-[50px] flex-1 rounded-2xl border border-white/10 bg-white/[0.05] px-4 text-white outline-none placeholder:text-white/35 disabled:cursor-not-allowed disabled:text-white/35"
              />

              <button
                onClick={submitComment}
                disabled={!isLoggedIn}
                className={`flex h-[50px] w-[50px] shrink-0 items-center justify-center rounded-2xl ${
                  isLoggedIn
                    ? 'bg-[#f5f7ff] text-[#111827]'
                    : 'bg-white/[0.08] text-white/35'
                }`}
              >
                <Send className="h-4 w-4" />
              </button>
            </div>

            <div
              className={`mt-1 text-right text-xs ${getCounterTone(
                text.length,
                LIMITS.comment,
                0.7,
                0.9,
              )}`}
            >
              {text.length}/{LIMITS.comment}
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
    <div className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm">
      <div className="mx-auto flex h-[100dvh] min-h-0 max-w-md flex-col bg-[#131722] pb-[env(safe-area-inset-bottom)] text-white">
        <div className="shrink-0 flex items-center justify-between border-b border-white/10 px-5 py-4">
          <div className="text-lg font-bold">맞냐 글쓰기</div>
          <button
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white/[0.07]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 space-y-4 [webkit-overflow-scrolling:touch]">
          <div className="grid grid-cols-2 gap-3">
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-white outline-none"
            >
              {categories.map((item) => (
                <option key={item} value={item} className="text-black">
                  {item}
                </option>
              ))}
            </select>
            <select
              value={ageGroup}
              onChange={(e) => setAgeGroup(e.target.value)}
              className="rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-white outline-none"
            >
              {ageGroups.map((item) => (
                <option key={item} value={item} className="text-black">
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
              className="w-full rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-white outline-none placeholder:text-white/35"
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
              className="w-full rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-white outline-none placeholder:text-white/35"
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
              className="w-full rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-white outline-none placeholder:text-white/35"
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
              className="w-full rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-white outline-none placeholder:text-white/35"
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

        <div className="shrink-0 border-t border-white/10 px-5 py-4">
          <button
            onClick={submit}
            className="w-full rounded-2xl bg-[#f5f7ff] px-4 py-4 font-bold text-[#111827]"
          >
            글쓰기
          </button>
        </div>
      </div>
    </div>
  )
}

export default function MatnyaApp() {
  const [posts, setPosts] = useState<PostItem[]>([])
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
  const [pendingAction, setPendingAction] = useState<'post' | 'comment' | null>(
    null,
  )

  const [myPosts, setMyPosts] = useState<MyPostItem[]>([])
  const [myComments, setMyComments] = useState<MyCommentItem[]>([])

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
    setWriteOpen(false)
    setCommentOpen(false)
    setActivityOpen(false)
    setPendingAction(null)
  }, [])

  const loadAuthState = useCallback(async () => {
    try {
      const result = await ensureProfile()
      setAuthUser(result.user)
      setProfile(result.profile)
    } catch (error) {
      console.error('auth/profile 로딩 실패', error)
    }
  }, [])

  const fetchAll = useCallback(async (key: string) => {
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
      views: Number(post.views ?? 0),
      comments: (commentsData ?? [])
        .filter((comment) => Number(comment.post_id) === Number(post.id))
        .map((comment) => ({
          id: Number(comment.id),
          author: comment.author,
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

    setLoading(false)
  }, [])

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
      setPendingAction(null)

      await signOutAuth()

      setAuthUser(null)
      setProfile(null)
      setMyPosts([])
      setMyComments([])
      setAdminMode(false)

      showToast('로그아웃 완료')
    } catch (error) {
      console.error('로그아웃 실패', error)
      showToast('로그아웃 실패')
    }
  }

  useEffect(() => {
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
  }, [fetchAll])

  useEffect(() => {
    if (authUser?.id) {
      void fetchMyActivity(authUser.id)
    } else {
      setMyPosts([])
      setMyComments([])
    }
  }, [authUser?.id, fetchMyActivity])

  useEffect(() => {
    if (!authUser) return

    setAuthOpen(false)

    if (pendingAction === 'post') {
      setWriteOpen(true)
    }

    if (pendingAction === 'comment') {
      setCommentOpen(true)
    }

    setPendingAction(null)
  }, [authUser, pendingAction])

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

  useEffect(() => {
    if (currentIndex > 0 && currentIndex >= filteredPosts.length) {
      setCurrentIndex(Math.max(filteredPosts.length - 1, 0))
    }
  }, [filteredPosts.length, currentIndex])

  const currentPost: PostItem | null =
    filteredPosts[currentIndex] ?? filteredPosts[0] ?? null

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
  }, [currentPost?.id])

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

    showToast('판단 반영 완료!')
  }

  const prev = () => setCurrentIndex((i) => Math.max(i - 1, 0))
  const next = () =>
    setCurrentIndex((i) => Math.min(i + 1, filteredPosts.length - 1))

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
      setCurrentIndex(nextIndexInFiltered)
      return
    }

    const fallbackIndex = posts.findIndex((p) => p.id === postId)
    if (fallbackIndex >= 0) {
      setTab('추천')
      setSelectedCategory('전체')
      setCurrentIndex(fallbackIndex)
    }
  }

  const openPostDirect = (postId: number) => {
    const index = posts.findIndex((p) => p.id === postId)
    if (index >= 0) {
      setTab('추천')
      setSelectedCategory('전체')
      setCurrentIndex(index)
      setActivityOpen(false)
    }
  }

  const openCommentDirect = (postId: number) => {
    const index = posts.findIndex((p) => p.id === postId)
    if (index >= 0) {
      setTab('추천')
      setSelectedCategory('전체')
      setCurrentIndex(index)
      setActivityOpen(false)
      if (!authUser) {
        setPendingAction('comment')
        setAuthOpen(true)
        return
      }
      setCommentOpen(true)
    }
  }

  const addComment = async (text: string, side: Side) => {
    if (!authUser || !profile) {
      setPendingAction('comment')
      setAuthOpen(true)
      return
    }
    if (!currentPost) return

    const { data: inserted, error } = await supabase
      .from('comments')
      .insert({
        post_id: currentPost.id,
        author: profile.anonymous_name,
        side,
        text,
        author_key: authUser.id,
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

    showToast('반응 등록 완료')
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
    if (!authUser) {
      setPendingAction('post')
      setAuthOpen(true)
      return
    }

    const { data: inserted, error } = await supabase
      .from('posts')
      .insert({
        category: data.category,
        age_group: data.ageGroup,
        title: data.title,
        content: data.content,
        left_label: data.leftLabel,
        right_label: data.rightLabel,
        author_key: authUser.id,
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
      comments: [],
      views: Number(inserted.views ?? 0),
    }

    setPosts((prev) => [newPost, ...prev])

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

    setTab('최신')
    setSelectedCategory('전체')
    setCurrentIndex(0)
    setWriteOpen(false)
    showToast('맞냐 등록 완료!')
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
    commentOpen || writeOpen || activityOpen || deletedOpen || authOpen

  if (loading) {
    return (
      <div className="min-h-[100dvh] bg-gradient-to-b from-[#121620] via-[#0f1115] to-[#0a0c12] text-white flex items-center justify-center px-6 text-center">
        <div>
          <div className="text-lg font-bold">불러오는 중...</div>
          <div className="mt-2 text-sm text-white/50">
            글 목록을 가져오는 중
          </div>
        </div>
      </div>
    )
  }

  if (!currentPost) {
    return (
      <div className="min-h-[100dvh] bg-gradient-to-b from-[#121620] via-[#0f1115] to-[#0a0c12] text-white">
        <div className="mx-auto flex min-h-[100dvh] max-w-md flex-col bg-transparent">
          <header className="sticky top-0 z-30 border-b border-white/10 bg-[#0f1115]/95 px-5 pb-3 pt-4 backdrop-blur">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-xs uppercase tracking-[0.28em] text-white/40">
                  맞냐
                </div>
                <div className="mt-1 text-[23px] font-extrabold tracking-tight">
                  이거 맞냐?
                </div>
              </div>

              <div className="flex items-center gap-2">
                {isAdmin && (
                  <button
                    onClick={() => void handleAdminToggle()}
                    className="flex h-11 w-11 items-center justify-center rounded-full bg-white/[0.07] text-white"
                  >
                    <Shield className="h-5 w-5" />
                  </button>
                )}

                {!authUser ? (
                  <button
                    onClick={() => setAuthOpen(true)}
                    className="flex h-11 min-w-[44px] items-center justify-center rounded-full bg-white/[0.07] px-3 text-white"
                  >
                    <User className="h-5 w-5" />
                  </button>
                ) : (
                  <button
                    onClick={() => setActivityOpen(true)}
                    className="flex h-11 min-w-[44px] items-center justify-center rounded-full bg-white/[0.07] px-3 text-white"
                  >
                    <span className="text-xs font-bold">
                      {profile?.anonymous_name ?? '익명'}
                    </span>
                  </button>
                )}

                <button
                  onClick={() => {
                    if (!authUser) {
                      setPendingAction('post')
                      setAuthOpen(true)
                      return
                    }
                    setWriteOpen(true)
                  }}
                  className="flex h-11 w-11 items-center justify-center rounded-full bg-[#4f7cff] text-white shadow-sm"
                >
                  <Plus className="h-5 w-5" />
                </button>
              </div>
            </div>
          </header>

          <main className="flex flex-1 items-center justify-center px-6 text-center">
            <div>
              <div className="text-lg font-bold">아직 글이 없음</div>
              <div className="mt-2 text-sm text-white/50">
                선택한 카테고리에 아직 글이 없음
              </div>
            </div>
          </main>
        </div>

        {toast ? (
          <div className="pointer-events-none fixed inset-x-0 bottom-24 z-30 flex justify-center px-4">
            <div className="rounded-full bg-[#f5f7ff] px-4 py-2 text-sm font-bold text-[#111827] shadow-lg">
              {toast}
            </div>
          </div>
        ) : null}

        <CreatePostModal
          open={writeOpen}
          onClose={() => setWriteOpen(false)}
          onCreate={(input) => void createPost(input)}
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

        <AuthRequiredModal
          open={authOpen}
          onClose={() => setAuthOpen(false)}
          onGoogleLogin={() => void handleGoogleLogin()}
        />
      </div>
    )
  }

  const p = percent(currentPost.leftVotes, currentPost.rightVotes)

  return (
    <div className="min-h-[100dvh] bg-gradient-to-b from-[#121620] via-[#0f1115] to-[#0a0c12] text-white">
      <div className="mx-auto flex min-h-[100dvh] max-w-md flex-col bg-transparent">
        <header className="sticky top-0 z-30 border-b border-white/10 bg-[#0f1115]/95 px-5 pb-3 pt-4 backdrop-blur">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-xs uppercase tracking-[0.28em] text-white/40">
                맞냐
              </div>
              <div className="mt-1 text-[23px] font-extrabold tracking-tight">
                이거 맞냐?
              </div>
            </div>

            <div className="flex items-center gap-2">
              {!authUser ? (
                <button
                  onClick={() => setAuthOpen(true)}
                  className="flex h-11 min-w-[44px] items-center justify-center rounded-full bg-white/[0.07] px-3 text-white"
                >
                  <User className="h-5 w-5" />
                </button>
              ) : (
                <button
                  onClick={() => setActivityOpen(true)}
                  className="flex h-11 min-w-[44px] items-center justify-center rounded-full bg-white/[0.07] px-3 text-white"
                >
                  <span className="text-xs font-bold">
                    {profile?.anonymous_name ?? '익명'}
                  </span>
                </button>
              )}

              {isAdmin && (
                <button
                  onClick={() => void handleAdminToggle()}
                  className={`flex h-11 w-11 items-center justify-center rounded-full ${
                    adminMode
                      ? 'bg-[#f5f7ff] text-[#111827]'
                      : 'bg-white/[0.07] text-white'
                  }`}
                >
                  <Shield className="h-5 w-5" />
                </button>
              )}

              <button
                onClick={openReportPost}
                className="flex h-11 w-11 items-center justify-center rounded-full bg-white/[0.07] text-white"
              >
                <Flag className="h-5 w-5" />
              </button>

              <button
                onClick={() => {
                  if (!authUser) {
                    setPendingAction('post')
                    setAuthOpen(true)
                    return
                  }
                  setWriteOpen(true)
                }}
                className="flex h-11 w-11 items-center justify-center rounded-full bg-[#4f7cff] text-white shadow-sm"
              >
                <Plus className="h-5 w-5" />
              </button>
            </div>
          </div>

          <div className="mt-4 flex gap-2 overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
            {(['추천', '인기', '최신'] as const).map((label) => (
              <button
                key={label}
                onClick={() => {
                  setTab(label)
                  setCurrentIndex(0)
                }}
                className={`rounded-full px-4 py-2 text-sm font-bold transition ${
                  tab === label
                    ? 'bg-[#f5f7ff] text-[#111827]'
                    : 'bg-white/[0.07] text-white/80'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="mt-3 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
            {categoryFilters.map((category) => (
              <button
                key={category}
                onClick={() => {
                  setSelectedCategory(category)
                  setCurrentIndex(0)
                }}
                className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-bold transition ${
                  selectedCategory === category
                    ? 'bg-[#4f7cff] text-white'
                    : 'bg-white/[0.05] text-white/75'
                }`}
              >
                {category}
              </button>
            ))}
          </div>
        </header>

        <div className="mx-5 border-t border-white/10" />

        <main className="px-5 pb-32 pt-3">
          <AnimatePresence mode="wait">
            <motion.div
              key={`${tab}-${selectedCategory}-${currentPost.id}`}
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -18 }}
              transition={{ duration: 0.18 }}
              className="rounded-[36px] border border-white/10 bg-white/[0.045] p-5 shadow-[0_20px_80px_rgba(0,0,0,0.26)]"
            >
              <div className="mb-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-xs text-white/45">
                  <span className="rounded-full bg-white/[0.07] px-3 py-1">
                    {currentPost.category}
                  </span>
                  <span className="rounded-full bg-white/[0.07] px-3 py-1">
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
                      className="rounded-2xl bg-[#f5f7ff] px-3 py-2 text-xs font-bold text-[#111827]"
                    >
                      복구 관리
                    </button>

                    {currentPost.hidden && (
                      <>
                        <button
                          onClick={() => void adminRestorePost()}
                          className="rounded-2xl bg-[#f5f7ff] px-3 py-2 text-xs font-bold text-[#111827]"
                        >
                          숨김 해제
                        </button>
                        <button
                          onClick={() => void adminDeletePost()}
                          className="rounded-2xl bg-red-500 px-3 py-2 text-xs font-bold text-white"
                        >
                          삭제
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>

              <div>
                <h1 className="text-[26px] font-black leading-tight tracking-tight text-white">
                  {currentPost.hidden && !adminMode
                    ? '신고 누적으로 숨겨진 글'
                    : currentPost.title}
                </h1>
                <p className="mt-5 whitespace-pre-line text-[15px] leading-8 text-white/78">
                  {currentPost.hidden && !adminMode
                    ? '관리자 확인 전까지 숨김 처리됩니다.'
                    : currentPost.content}
                </p>
              </div>

              {(!currentPost.hidden || adminMode) && (
                <div className="mt-6 space-y-4">
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
                      <button
                        onClick={handleNextWithGuard}
                        className="w-full rounded-[28px] border border-[#6d8dff]/25 bg-[#6d8dff]/10 px-4 py-4 text-left transition-all"
                      >
                        <div className="text-xs font-bold text-[#9eb1ff]">
                          다음 맞냐
                        </div>
                        <div className="mt-1 text-base font-bold text-white">
                          {filteredPosts[
                            Math.min(currentIndex + 1, filteredPosts.length - 1)
                          ]?.title || '다음 글 보기'}
                        </div>
                        <div className="mt-1 text-xs text-white/45">
                          눌러서 바로 이동
                        </div>
                      </button>

                      {controversialPosts.length > 0 && (
                        <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-4">
                          <div className="mb-3 text-sm font-bold text-white">
                            지금 뜨는 논쟁 TOP3
                          </div>
                          <div className="space-y-2">
                            {controversialPosts.map((item) => (
                              <button
                                key={item.id}
                                onClick={() => moveToPostWithGuard(item.id)}
                                className="w-full rounded-2xl bg-white/[0.05] px-4 py-3 text-left transition hover:bg-white/[0.08]"
                              >
                                <div className="text-sm font-semibold text-white">
                                  {item.title}
                                </div>
                                <div className="mt-1 text-xs text-white/45">
                                  {item.total}명 참여 · 의견 팽팽
                                </div>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : null}
                </div>
              )}

              <div className="mt-6 border-t border-white/10 pt-3">
                <div className="mb-3 flex items-center justify-between text-sm text-white/65">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1">
                      <BarChart3 className="h-4 w-4" />
                      {currentPost.leftVotes + currentPost.rightVotes}
                    </div>

                    <button
                      onClick={() => {
                        if (!authUser) {
                          setPendingAction('comment')
                          setAuthOpen(true)
                          return
                        }
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
          <div className="fixed bottom-0 left-0 right-0 z-[9999]">
            <div className="mx-auto max-w-md border-t border-white/10 bg-[#0f1115]/95 px-5 pb-[calc(12px+env(safe-area-inset-bottom))] pt-3 backdrop-blur">
              <div className="grid grid-cols-3 gap-3">
                <button
                  onClick={prev}
                  className="rounded-3xl border border-white/10 bg-white/[0.05] px-4 py-4 text-sm font-bold text-white"
                >
                  이전 글
                </button>

                <button
                  onClick={() => {
                    if (!authUser) {
                      setPendingAction('post')
                      setAuthOpen(true)
                      return
                    }
                    setWriteOpen(true)
                  }}
                  className="flex items-center justify-center gap-2 rounded-3xl border border-white/10 bg-white/[0.05] px-4 py-4 text-sm font-bold text-white"
                >
                  <Plus className="h-4 w-4" />
                  글쓰기
                </button>

                <button
                  onClick={handleNextWithGuard}
                  className="rounded-3xl bg-[#f5f7ff] px-4 py-4 text-sm font-bold text-[#111827]"
                >
                  다음 글
                </button>
              </div>
            </div>
          </div>
        )}

        {toast ? (
          <div className="pointer-events-none fixed inset-x-0 bottom-24 z-30 flex justify-center px-4">
            <div className="rounded-full bg-[#f5f7ff] px-4 py-2 text-sm font-bold text-[#111827] shadow-lg">
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
          isLoggedIn={!!authUser}
        />

        <CreatePostModal
          open={writeOpen}
          onClose={() => setWriteOpen(false)}
          onCreate={(input) => void createPost(input)}
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

        <AuthRequiredModal
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
