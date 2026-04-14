'use client'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  BarChart3,
  Flag,
  Flame,
  MessageCircle,
  Plus,
  Send,
  Shield,
  User,
  X,
} from 'lucide-react'

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
const STORAGE_KEYS = {
  posts: 'matnya_my_posts',
  comments: 'matnya_my_comments',
}
type Side = 'left' | 'right'

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
const seedPosts: PostItem[] = [
  {
    id: 1,
    category: '연애',
    ageGroup: '20대',
    title: '소개팅 밥값 내가 다 냈는데 다음 약속이 없음',
    content:
      '소개팅에서 분위기는 괜찮았는데 계산할 때 상대가 가만히 있길래 그냥 내가 다 냈어. 집 가서 잘 들어갔냐고까지 했는데 그 뒤로 텀이 길고 다음 약속 얘기도 없음. 내가 호구였던 건지 궁금함.',
    leftLabel: '내가 손해봄',
    rightLabel: '원래 그럴 수 있음',
    leftVotes: 182,
    rightVotes: 61,
    reportCount: 0,
    hidden: false,
    comments: [
      {
        id: 101,
        author: '익명20',
        side: 'left',
        text: '다음 약속 얘기 없으면 관심 낮은 편 같음.',
        likes: 18,
        reportCount: 0,
        hidden: false,
      },
      {
        id: 102,
        author: '연애냉정파',
        side: 'left',
        text: '한 번 정도는 가능하지만 반복되면 손절임.',
        likes: 11,
        reportCount: 0,
        hidden: false,
      },
      {
        id: 103,
        author: '현실주의자',
        side: 'right',
        text: '첫 만남에서 한 번 내는 건 흔한 일이라 과하게 해석할 수도 있음.',
        likes: 6,
        reportCount: 0,
        hidden: false,
      },
    ],
    views: 2431,
  },
  {
    id: 2,
    category: '직장',
    ageGroup: '30대',
    title: '퇴근 10분 전에 일 던지는 상사 정상임?',
    content:
      '매번 퇴근 10분 전에 급한 척 업무를 던짐. 진짜 급한 건 아닌데 본인은 퇴근하고 나는 남아서 정리함. 이번 주만 세 번째인데 내가 예민한 건지 모르겠음.',
    leftLabel: '상사가 이상함',
    rightLabel: '직장은 원래 그럼',
    leftVotes: 391,
    rightVotes: 44,
    reportCount: 0,
    hidden: false,
    comments: [
      {
        id: 201,
        author: '칼퇴수호자',
        side: 'left',
        text: '한두 번이면 몰라도 반복이면 습관임.',
        likes: 27,
        reportCount: 0,
        hidden: false,
      },
      {
        id: 202,
        author: '현실직장인',
        side: 'left',
        text: '선 넘으면 말해야 됨.',
        likes: 9,
        reportCount: 0,
        hidden: false,
      },
      {
        id: 203,
        author: '버텨보자',
        side: 'right',
        text: '바쁜 시즌이면 어느 정도는 감수해야 할 때도 있음.',
        likes: 4,
        reportCount: 0,
        hidden: false,
      },
    ],
    views: 5022,
  },
  {
    id: 3,
    category: '돈',
    ageGroup: '40대',
    title: '월 350인데 차 바꾸는 거 무리인가',
    content:
      '지금 타는 차는 9년 됐고 수리비가 슬슬 많이 나와. 월 실수령 350 정도고 대출은 없는데 아이 교육비가 부담됨. 그래도 바꾸는 게 맞는지 고민됨.',
    leftLabel: '바꿔도 됨',
    rightLabel: '더 타는 게 맞음',
    leftVotes: 118,
    rightVotes: 209,
    reportCount: 0,
    hidden: false,
    comments: [
      {
        id: 301,
        author: '가계부장인',
        side: 'right',
        text: '고장 잦지 않으면 버티는 게 이득.',
        likes: 14,
        reportCount: 0,
        hidden: false,
      },
      {
        id: 302,
        author: '차덕후',
        side: 'left',
        text: '수리비 누적되면 바꾸는 것도 합리적임.',
        likes: 8,
        reportCount: 0,
        hidden: false,
      },
    ],
    views: 1670,
  },
]

function loadStoredList<T>(key: string): T[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(key)
    const parsed: unknown = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? (parsed as T[]) : []
  } catch {
    return []
  }
}

function saveStoredList<T>(key: string, value: T[]): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(key, JSON.stringify(value))
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
          className={`inline-flex rounded-xl px-2 py-1 text-[13px] font-bold ${active ? 'bg-[#4f7cff] text-white' : 'bg-white/10 text-white/90'}`}
        >
          {label}
        </span>
        <span className="text-[22px] font-extrabold text-white">{value}%</span>
      </div>
      <div className="h-2.5 w-full  rounded-full bg-white/10">
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
              className={`w-full rounded-2xl border px-4 py-3 text-left text-sm font-bold ${reason === item ? 'border-[#6d8dff]/45 bg-[#4f7cff] text-white' : 'border-white/10 bg-white/[0.05] text-white'}`}
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

const CommentCard = React.memo(function CommentCard({
  comment,
  onLikeComment,
  isLiked,
  onOpenReportComment,
  adminMode,
  onAdminRestoreComment,
  onAdminDeleteComment,
}: {
  comment: {
    id: number
    author: string
    side: 'left' | 'right'
    text: string
    likes: number
    reportCount: number
    hidden: boolean
  }
  onLikeComment: (commentId: number) => void
  isLiked: boolean
  onOpenReportComment: (commentId: number) => void
  adminMode: boolean
  onAdminRestoreComment: (commentId: number) => void
  onAdminDeleteComment: (commentId: number) => void
}) {
  if (comment.hidden && !adminMode) return null

  return (
    <div
      className={`rounded-3xl border p-3 ${comment.hidden ? 'border-red-400/20 bg-red-400/10' : 'border-white/10 bg-white/[0.04]'}`}
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
            className={`rounded-full px-3 py-1 text-xs font-bold ${isLiked ? 'bg-[#f5f7ff] text-[#111827]' : 'bg-white/[0.07] text-white/85'}`}
          >
            {isLiked ? '♥ 공감' : '♡ 공감'}
          </button>
        )}
        {!comment.hidden && (
          <button
            onClick={() => onOpenReportComment(comment.id)}
            className="inline-flex items-center gap-1 rounded-full bg-white/[0.07] px-3 py-1 text-xs font-bold text-white/80"
          >
            <Flag className="h-3 w-3" /> 신고
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
}: {
  open: boolean
  onClose: () => void
  myPosts: Array<{
    id: number
    postId: number
    title: string
    category: string
    ageGroup: string
  }>
  myComments: Array<{
    id: number
    commentId: number
    postId: number
    postTitle: string
    text: string
  }>
  onOpenPost: (postId: number) => void
  onOpenComment: (postId: number) => void
}) {
  const [tab, setTab] = useState('posts')

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

        <div className="px-5 pt-4">
          <div className="flex gap-2">
            <button
              onClick={() => setTab('posts')}
              className={`rounded-full px-4 py-2 text-sm font-bold ${tab === 'posts' ? 'bg-[#f5f7ff] text-[#111827]' : 'bg-white/[0.07] text-white/80'}`}
            >
              내가 올린 글
            </button>
            <button
              onClick={() => setTab('comments')}
              className={`rounded-full px-4 py-2 text-sm font-bold ${tab === 'comments' ? 'bg-[#f5f7ff] text-[#111827]' : 'bg-white/[0.07] text-white/80'}`}
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
}: {
  post: {
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
    comments: Array<{
      id: number
      author: string
      side: 'left' | 'right'
      text: string
      likes: number
      reportCount: number
      hidden: boolean
    }>
    views: number
  } | null
  open: boolean
  onClose: () => void
  onAddComment: (text: string, side: 'left' | 'right') => void
  onLikeComment: (commentId: number) => void
  likedComments: Record<number, boolean>
  onOpenReportComment: (commentId: number) => void
  adminMode: boolean
  onAdminRestoreComment: (commentId: number) => void
  onAdminDeleteComment: (commentId: number) => void
}) {
  const [text, setText] = useState('')
  const [commentSide, setCommentSide] = useState<'left' | 'right'>('left')
  const [sortType, setSortType] = useState<'best' | 'latest'>('best')
  const [visibleCount, setVisibleCount] = useState(INITIAL_COMMENT_BATCH)
  const inputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (open) {
      const timer = setTimeout(() => inputRef.current?.focus(), 80)
      return () => clearTimeout(timer)
    }
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
              className={`rounded-full px-4 py-2 text-sm font-bold ${sortType === 'best' ? 'bg-[#f5f7ff] text-[#111827]' : 'bg-white/[0.07] text-white/80'}`}
            >
              베스트
            </button>
            <button
              onClick={() => setSortType('latest')}
              className={`rounded-full px-4 py-2 text-sm font-bold ${sortType === 'latest' ? 'bg-[#f5f7ff] text-[#111827]' : 'bg-white/[0.07] text-white/80'}`}
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
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                    e.preventDefault()
                    submitComment()
                  }
                }}
                placeholder="익명으로 반응 남기기"
                className="h-[50px] flex-1 rounded-2xl border border-white/10 bg-white/[0.05] px-4 text-white outline-none placeholder:text-white/35"
              />

              <button
                onClick={submitComment}
                className="flex h-[50px] w-[50px] shrink-0 items-center justify-center rounded-2xl bg-[#f5f7ff] text-[#111827]"
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
          <div className="text-lg font-bold">맞냐 올리기</div>
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
              className={`mt-1 text-right text-xs ${getCounterTone(title.length, LIMITS.title, 0.56, 0.84)}`}
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
              className={`mt-1 flex items-center justify-between text-xs ${getCounterTone(content.length, LIMITS.content, 0.64, 0.82)}`}
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
              className={`mt-1 text-right text-xs ${getCounterTone(leftLabel.length, LIMITS.option, 0.75, 0.92)}`}
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
              className={`mt-1 text-right text-xs ${getCounterTone(rightLabel.length, LIMITS.option, 0.75, 0.92)}`}
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
            올리기
          </button>
        </div>
      </div>
    </div>
  )
}

export default function MatnyaApp() {
  const [posts, setPosts] = useState<PostItem[]>(seedPosts)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [tab, setTab] = useState<'추천' | '인기' | '최신'>('추천')
  const [selectedCategory, setSelectedCategory] = useState<string>('전체')
  const [votes, setVotes] = useState<Record<number, 'left' | 'right'>>({})
  const [likedComments, setLikedComments] = useState<Record<number, boolean>>(
    {},
  )
  const [reportedPosts, setReportedPosts] = useState<Record<number, boolean>>(
    {},
  )
  const [reportedComments, setReportedComments] = useState<
    Record<number, boolean>
  >({})
  const [myPostRefs, setMyPostRefs] = useState<Array<{ postId: number }>>([])
  const [myCommentRefs, setMyCommentRefs] = useState<
    Array<{ postId: number; commentId: number }>
  >([])

  const [toast, setToast] = useState('')
  const [commentOpen, setCommentOpen] = useState(false)
  const [writeOpen, setWriteOpen] = useState(false)
  const [activityOpen, setActivityOpen] = useState(false)
  const [adminMode, setAdminMode] = useState(false)
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

  useEffect(() => {
    saveStoredList(STORAGE_KEYS.posts, myPostRefs)
  }, [myPostRefs])

  useEffect(() => {
    saveStoredList(STORAGE_KEYS.comments, myCommentRefs)
  }, [myCommentRefs])

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

  const currentPost: PostItem = filteredPosts[currentIndex] || filteredPosts[0]

  const controversialPosts = useMemo(() => {
    return [...posts]
      .filter((post) => post.id !== currentPost?.id)
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
  }, [posts, currentPost?.id])

  const myPosts = useMemo(() => {
    return myPostRefs
      .map((ref) => posts.find((post) => post.id === ref.postId))
      .filter(
        (
          post,
        ): post is {
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
          comments: Array<{
            id: number
            author: string
            side: 'left' | 'right'
            text: string
            likes: number
            reportCount: number
            hidden: boolean
          }>
          views: number
        } => Boolean(post),
      )
      .map((post) => ({
        id: post.id,
        postId: post.id,
        title: post.title,
        category: post.category,
        ageGroup: post.ageGroup,
      }))
  }, [myPostRefs, posts])

  const myComments = useMemo(() => {
    return myCommentRefs
      .map((ref) => {
        const post = posts.find((item) => item.id === ref.postId)
        if (!post) return null
        const comment = post.comments.find((item) => item.id === ref.commentId)
        if (!comment) return null
        return {
          id: ref.commentId,
          commentId: ref.commentId,
          postId: post.id,
          postTitle: post.title,
          text: comment.text,
        }
      })
      .filter(
        (
          item,
        ): item is {
          id: number
          commentId: number
          postId: number
          postTitle: string
          text: string
        } => Boolean(item),
      )
  }, [myCommentRefs, posts])

  const showToast = useCallback((msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(''), 1400)
  }, [])

  const randomNickname = useCallback((): string => {
    const prefixes = [
      '익명',
      '판단',
      '냉정',
      '현실',
      '썰쟁이',
      '한마디',
      '직설',
      '공감',
    ]
    const suffix = Math.floor(100 + Math.random() * 900)
    return `${prefixes[Math.floor(Math.random() * prefixes.length)]}${suffix}`
  }, [])

  if (!currentPost) {
    return (
      <div className="min-h-[100dvh] bg-gradient-to-b from-[#121620] via-[#0f1115] to-[#0a0c12] text-white flex items-center justify-center px-6 text-center">
        <div>
          <div className="text-lg font-bold">아직 글이 없음</div>
          <div className="mt-2 text-sm text-white/50">
            선택한 카테고리에 아직 글이 없음
          </div>
        </div>
      </div>
    )
  }

  const p = percent(currentPost.leftVotes, currentPost.rightVotes)

  const handleVote = (choice: 'left' | 'right') => {
    const prevChoice = votes[currentPost.id]
    if (prevChoice === choice) return

    setPosts((prev) =>
      prev.map((post) => {
        if (post.id !== currentPost.id) return post
        let { leftVotes, rightVotes } = post
        if (prevChoice === 'left') leftVotes -= 1
        if (prevChoice === 'right') rightVotes -= 1
        if (choice === 'left') leftVotes += 1
        if (choice === 'right') rightVotes += 1
        return { ...post, leftVotes, rightVotes }
      }),
    )

    setVotes((prev) => ({ ...prev, [currentPost.id]: choice }))
    showToast('판단 반영 완료!')
  }

  const prev = () => setCurrentIndex((i) => Math.max(i - 1, 0))
  const next = () =>
    setCurrentIndex((i) => Math.min(i + 1, filteredPosts.length - 1))

  const handleNextWithGuard = () => {
    if (!votes[currentPost.id]) {
      showToast('먼저 선택하고 넘어가야 함')
      return
    }
    next()
  }

  const moveToPostWithGuard = (postId: number) => {
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
      setCommentOpen(true)
    }
  }

  const addComment = (text: string, side: 'left' | 'right') => {
    const commentId = Date.now()
    setPosts((prev) =>
      prev.map((post) =>
        post.id === currentPost.id
          ? {
              ...post,
              comments: [
                {
                  id: commentId,
                  author: randomNickname(),
                  side,
                  text,
                  likes: 0,
                  reportCount: 0,
                  hidden: false,
                },
                ...post.comments,
              ],
            }
          : post,
      ),
    )
    setMyCommentRefs((prev) => [
      { commentId, postId: currentPost.id },
      ...prev.filter((item) => item.commentId !== commentId),
    ])
    showToast('반응 등록 완료!')
  }

  const likeComment = (commentId: number) => {
    const already = likedComments[commentId]
    setLikedComments((prev) => {
      const nextLiked = { ...prev }
      if (already) delete nextLiked[commentId]
      else nextLiked[commentId] = true
      return nextLiked
    })

    setPosts((prev) =>
      prev.map((post) =>
        post.id === currentPost.id
          ? {
              ...post,
              comments: post.comments.map((comment) =>
                comment.id === commentId
                  ? {
                      ...comment,
                      likes: already
                        ? Math.max(0, comment.likes - 1)
                        : comment.likes + 1,
                    }
                  : comment,
              ),
            }
          : post,
      ),
    )
  }

  const openReportPost = () => {
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

  const submitReport = (reason: string) => {
    const reportId = reportModal.id
    if (reportId == null) return

    if (reportModal.type === 'post') {
      setReportedPosts((prev) => ({ ...prev, [reportId]: true }))
      setPosts((prev) =>
        prev.map((p) =>
          p.id === reportId
            ? {
                ...p,
                reportCount: p.reportCount + 1,
                hidden: p.reportCount + 1 >= 3,
              }
            : p,
        ),
      )
    }

    if (reportModal.type === 'comment') {
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
                        reportCount: c.reportCount + 1,
                        hidden: c.reportCount + 1 >= 3,
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

    showToast(`${reason} 신고 접수`)
  }

  const createPost = (data: {
    category: string
    ageGroup: string
    title: string
    content: string
    leftLabel: string
    rightLabel: string
  }) => {
    const postId = Date.now()
    const newPost = {
      id: postId,
      ...data,
      leftVotes: 0,
      rightVotes: 0,
      reportCount: 0,
      hidden: false,
      comments: [],
      views: 1,
    }
    setPosts((prev) => [newPost, ...prev])
    setMyPostRefs((prev) => [
      { postId },
      ...prev.filter((item) => item.postId !== postId),
    ])
    setTab('최신')
    setSelectedCategory('전체')
    setCurrentIndex(0)
    setWriteOpen(false)
    showToast('맞냐 등록 완료!')
  }

  const adminRestorePost = () => {
    setPosts((prev) =>
      prev.map((p) =>
        p.id === currentPost.id ? { ...p, hidden: false, reportCount: 0 } : p,
      ),
    )
    showToast('글 숨김 해제 완료')
  }

  const adminDeletePost = () => {
    const nextPosts = posts.filter((p) => p.id !== currentPost.id)
    setPosts(nextPosts)
    setCurrentIndex(0)
    showToast('글 삭제 완료')
  }

  const adminRestoreComment = (commentId: number) => {
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

  const adminDeleteComment = (commentId: number) => {
    setPosts((prev) =>
      prev.map((p) =>
        p.id === currentPost.id
          ? { ...p, comments: p.comments.filter((c) => c.id !== commentId) }
          : p,
      ),
    )
    showToast('댓글 삭제 완료')
  }
  const isModalOpen = commentOpen || writeOpen

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
              <button
                onClick={() => setActivityOpen(true)}
                className="flex h-11 w-11 items-center justify-center rounded-full bg-white/[0.07] text-white"
              >
                <User className="h-5 w-5" />
              </button>
              <button
                onClick={() => setAdminMode((v) => !v)}
                className={`flex h-11 w-11 items-center justify-center rounded-full ${adminMode ? 'bg-[#f5f7ff] text-[#111827]' : 'bg-white/[0.07] text-white'}`}
              >
                <Shield className="h-5 w-5" />
              </button>
              <button
                onClick={openReportPost}
                className="flex h-11 w-11 items-center justify-center rounded-full bg-white/[0.07] text-white"
              >
                <Flag className="h-5 w-5" />
              </button>
              <button
                onClick={() => setWriteOpen(true)}
                className="flex h-11 w-11 items-center justify-center rounded-full bg-[#4f7cff] text-white shadow-sm"
              >
                <Plus className="h-5 w-5" />
              </button>
            </div>
          </div>

          <div className="mt-4 flex gap-2 overflow-x-auto">
            {(['추천', '인기', '최신'] as const).map((label) => (
              <button
                key={label}
                onClick={() => {
                  setTab(label)
                  setCurrentIndex(0)
                }}
                className={`rounded-full px-4 py-2 text-sm font-bold transition ${tab === label ? 'bg-[#f5f7ff] text-[#111827]' : 'bg-white/[0.07] text-white/80'}`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
            {categoryFilters.map((category) => (
              <button
                key={category}
                onClick={() => {
                  setSelectedCategory(category)
                  setCurrentIndex(0)
                }}
                className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-bold transition ${selectedCategory === category ? 'bg-[#4f7cff] text-white' : 'bg-white/[0.05] text-white/75'}`}
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
              transition={{ duration: 0.15 }}
              className="flex flex-col"
            >
              <div>
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-[#f5f7ff] px-3 py-1 text-[13px] font-bold text-[#111827]">
                      {currentPost.category}
                    </span>
                    <span className="rounded-full bg-white/[0.07] px-3 py-1 text-[13px] font-bold text-white">
                      {currentPost.ageGroup}
                    </span>
                    {currentPost.hidden && (
                      <span className="rounded-full bg-red-500/20 px-3 py-1 text-[13px] font-bold text-red-300">
                        숨김됨
                      </span>
                    )}
                  </div>
                  <div className="text-[13px] text-white/45">
                    익명으로 판단중
                  </div>
                </div>

                <div className="rounded-[34px] border border-white/10 bg-gradient-to-b from-white/[0.07] to-white/[0.03] px-5 py-6 backdrop-blur-xl shadow-[0_16px_50px_rgba(0,0,0,0.38)]">
                  <div className="mb-3 text-sm font-bold text-[#8b9bff]">
                    🔥 지금{' '}
                    {Math.max(
                      60,
                      Math.floor(
                        (currentPost.leftVotes + currentPost.rightVotes) / 4,
                      ),
                    )}
                    명 보는 중
                  </div>
                  <h1 className="text-[26px] font-extrabold leading-[1.15] tracking-tight text-white">
                    {currentPost.hidden && !adminMode
                      ? '신고 누적으로 숨겨진 글'
                      : currentPost.title}
                  </h1>
                  <p className="mt-5 whitespace-pre-line text-[15px] leading-8 text-white/78">
                    {currentPost.hidden && !adminMode
                      ? '관리자 확인 전까지 숨김 처리됩니다.'
                      : currentPost.content}
                  </p>
                  {adminMode && currentPost.hidden && (
                    <div className="mt-4 flex gap-2">
                      <button
                        onClick={adminRestorePost}
                        className="rounded-2xl bg-[#f5f7ff] px-4 py-2 text-sm font-bold text-[#111827]"
                      >
                        숨김 해제
                      </button>
                      <button
                        onClick={adminDeletePost}
                        className="rounded-2xl bg-red-500 px-4 py-2 text-sm font-bold text-white"
                      >
                        삭제
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {(!currentPost.hidden || adminMode) && (
                <div className="mt-6 space-y-4">
                  <VoteOption
                    active={votes[currentPost.id] === 'left'}
                    label={currentPost.leftLabel}
                    value={p.left}
                    onClick={() => handleVote('left')}
                  />
                  <VoteOption
                    active={votes[currentPost.id] === 'right'}
                    label={currentPost.rightLabel}
                    value={p.right}
                    onClick={() => handleVote('right')}
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
                      onClick={() => setCommentOpen(true)}
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
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={prev}
                  className="rounded-3xl border border-white/10 bg-white/[0.05] px-4 py-4 text-sm font-bold text-white"
                >
                  이전 글
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
          onAddComment={addComment}
          onLikeComment={likeComment}
          likedComments={likedComments}
          onOpenReportComment={openReportComment}
          adminMode={adminMode}
          onAdminRestoreComment={adminRestoreComment}
          onAdminDeleteComment={adminDeleteComment}
        />

        <CreatePostModal
          open={writeOpen}
          onClose={() => setWriteOpen(false)}
          onCreate={createPost}
        />
        <MyActivityModal
          open={activityOpen}
          onClose={() => setActivityOpen(false)}
          myPosts={myPosts}
          myComments={myComments}
          onOpenPost={openPostDirect}
          onOpenComment={openCommentDirect}
        />
        <ReportModal
          open={reportModal.open}
          onClose={() =>
            setReportModal({ open: false, type: null, id: null, label: '' })
          }
          onSubmit={submitReport}
          targetLabel={reportModal.label}
        />
      </div>
    </div>
  )
}
