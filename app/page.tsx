'use client'

import React, { useMemo, useState } from 'react'
import {
  ChevronRight,
  Flame,
  MessageCircle,
  Bookmark,
  FileText,
} from 'lucide-react'

type Side = 'left' | 'right'

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
  comments: number
  hasOutcome: boolean
}

const postsSeed: PostItem[] = [
  {
    id: 1,
    category: '연애',
    ageGroup: '20대',
    title: '남친이 여사친이랑 단둘이 1박 여행 간다는데 내가 예민한 거냐?',
    content:
      '계속 그냥 친구라고 하는데 굳이 둘이만 가는 게 맞나 싶음. 내가 뭐라고 하면 내가 이상한 사람 되는 분위기임.',
    leftLabel: '내가 예민한 거 아님',
    rightLabel: '내가 예민한 거 맞음',
    leftVotes: 82,
    rightVotes: 18,
    comments: 48,
    hasOutcome: true,
  },
  {
    id: 2,
    category: '직장',
    ageGroup: '30대',
    title: '팀장이 내 아이디어 자기 것처럼 발표했는데 지금 말하는 게 맞냐?',
    content:
      '회의에서 내가 먼저 낸 아이디어인데 오늘 임원 회의에서 팀장이 본인 기획처럼 말함. 지금 바로 얘기해야 하나 고민 중.',
    leftLabel: '지금 바로 말해야 함',
    rightLabel: '조용히 증거부터 모아야 함',
    leftVotes: 51,
    rightVotes: 49,
    comments: 72,
    hasOutcome: false,
  },
  {
    id: 3,
    category: '돈',
    ageGroup: '20대',
    title: '친구가 돈 빌려달라는데 갚을 사람 같지 않아도 빌려줘야 하냐?',
    content:
      '예전에도 한 번 늦게 갚았고 이번엔 급하다고 함. 거절하면 정 없다고 할까 봐 애매함.',
    leftLabel: '절대 빌려주면 안 됨',
    rightLabel: '소액이면 한 번은 가능',
    leftVotes: 77,
    rightVotes: 23,
    comments: 34,
    hasOutcome: false,
  },
  {
    id: 4,
    category: '인간관계',
    ageGroup: '20대',
    title: '친구가 내 비밀을 다른 사람한테 말했는데 그냥 넘어가도 되냐?',
    content:
      '사과는 했는데 진짜 미안해서 한 건지, 걸려서 한 건지 모르겠음. 계속 친구로 지내도 되는지 고민됨.',
    leftLabel: '거리 둬야 함',
    rightLabel: '한 번은 넘어갈 수 있음',
    leftVotes: 64,
    rightVotes: 36,
    comments: 29,
    hasOutcome: true,
  },
]

function percent(left: number, right: number) {
  const safeLeft = Math.max(0, Number(left ?? 0))
  const safeRight = Math.max(0, Number(right ?? 0))
  const total = safeLeft + safeRight
  if (total <= 0) return { left: 50, right: 50 }
  return {
    left: Math.round((safeLeft / total) * 100),
    right: Math.round((safeRight / total) * 100),
  }
}

function getEmotionLabel(choice: Side | null, post: PostItem) {
  if (!choice) return null

  const total = post.leftVotes + post.rightVotes
  const myVotes = choice === 'left' ? post.leftVotes : post.rightVotes
  const myRatio = myVotes / Math.max(total, 1)
  const diffRatio =
    Math.abs(post.leftVotes - post.rightVotes) / Math.max(total, 1)

  if (myRatio <= 0.2) {
    return {
      title: '😳 너만 틀림',
      helper: '생각보다 완전 반대로 가는 중',
      toneClass: 'border-rose-200 bg-rose-50 text-rose-700',
    }
  }

  if (diffRatio <= 0.12) {
    return {
      title: '🔥 지금 완전 개싸움',
      helper: '거의 반반이라 다음 반응이 중요함',
      toneClass: 'border-amber-200 bg-amber-50 text-amber-700',
    }
  }

  if (diffRatio <= 0.25) {
    return {
      title: '👀 생각보다 엄청 갈리는 중',
      helper: '한두 표만 더 들어와도 분위기 바뀔 수 있음',
      toneClass: 'border-sky-200 bg-sky-50 text-sky-700',
    }
  }

  return {
    title: '⚡ 한쪽이 확실히 앞서는 중',
    helper: '지금은 흐름이 꽤 보이는 판',
    toneClass: 'border-violet-200 bg-violet-50 text-violet-700',
  }
}

function getSavedVotes() {
  if (typeof window === 'undefined') return {} as Record<number, Side>
  try {
    const raw = window.localStorage.getItem('matnya_simple_votes_v1')
    if (!raw) return {}
    return JSON.parse(raw) as Record<number, Side>
  } catch {
    return {}
  }
}

function saveVotes(votes: Record<number, Side>) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem('matnya_simple_votes_v1', JSON.stringify(votes))
}

export default function Page() {
  const [posts] = useState<PostItem[]>(postsSeed)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [votes, setVotes] = useState<Record<number, Side>>(() =>
    getSavedVotes(),
  )
  const [showComments, setShowComments] = useState(false)
  const [savedPostIds, setSavedPostIds] = useState<number[]>([])
  const [toast, setToast] = useState('')

  const currentPost = posts[currentIndex]
  const currentChoice = votes[currentPost.id] ?? null
  const result = useMemo(
    () => percent(currentPost.leftVotes, currentPost.rightVotes),
    [currentPost.leftVotes, currentPost.rightVotes],
  )
  const emotion = getEmotionLabel(currentChoice, currentPost)

  const showToast = (message: string) => {
    setToast(message)
    window.clearTimeout((window as any).__matnyaToastTimer)
    ;(window as any).__matnyaToastTimer = window.setTimeout(() => {
      setToast('')
    }, 1500)
  }

  const handleVote = (side: Side) => {
    const prev = votes[currentPost.id]
    if (prev === side) {
      showToast('이미 이쪽으로 선택함')
      return
    }

    const nextVotes = {
      ...votes,
      [currentPost.id]: side,
    }
    setVotes(nextVotes)
    saveVotes(nextVotes)
    setShowComments(false)
  }

  const handleNext = () => {
    setShowComments(false)
    setCurrentIndex((prev) => (prev + 1) % posts.length)
  }

  const handlePrev = () => {
    setShowComments(false)
    setCurrentIndex((prev) => (prev - 1 + posts.length) % posts.length)
  }

  const handleToggleSave = () => {
    setSavedPostIds((prev) => {
      if (prev.includes(currentPost.id)) {
        showToast('결말궁금 해제됨')
        return prev.filter((id) => id !== currentPost.id)
      }
      showToast('결말궁금 저장됨')
      return [...prev, currentPost.id]
    })
  }

  const isSaved = savedPostIds.includes(currentPost.id)

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#f8fbff_0%,#f5f7fb_100%)] text-slate-900">
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col">
        <header className="sticky top-0 z-20 border-b border-slate-200/70 bg-white/90 px-5 py-4 backdrop-blur">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[22px] font-black tracking-[-0.03em]">
                맞냐
              </div>
              <div className="text-xs text-slate-500">생각할 틈 없이 판단</div>
            </div>
            <div className="rounded-full bg-[#eef3ff] px-3 py-1 text-xs font-bold text-[#4f7cff]">
              {currentIndex + 1} / {posts.length}
            </div>
          </div>
        </header>

        <section className="flex-1 px-4 py-4">
          <div className="rounded-[30px] border border-slate-200/80 bg-white p-5 shadow-[0_14px_32px_rgba(15,23,42,0.06)]">
            <div className="mb-3 flex items-center gap-2">
              <span className="rounded-full bg-[#eef3ff] px-3 py-1 text-xs font-bold text-[#4f7cff]">
                {currentPost.category}
              </span>
              <span className="text-xs text-slate-400">
                {currentPost.ageGroup}
              </span>
            </div>

            <h1 className="text-[24px] font-extrabold leading-[1.2] tracking-[-0.03em]">
              {currentPost.title}
            </h1>

            <p className="mt-4 text-[15px] leading-7 text-slate-600">
              {currentPost.content}
            </p>

            <div className="mt-6 space-y-3">
              <button
                onClick={() => handleVote('left')}
                className={`w-full rounded-[24px] border px-4 py-4 text-left transition ${
                  currentChoice === 'left'
                    ? 'border-[#cfe0ff] bg-[linear-gradient(180deg,#f7faff_0%,#eaf1ff_100%)] shadow-[0_14px_26px_rgba(79,124,255,0.14)]'
                    : 'border-slate-200 bg-white hover:bg-slate-50'
                }`}
              >
                <div className="text-xs font-bold text-slate-500">왼쪽</div>
                <div className="mt-1 text-lg font-extrabold">
                  {currentPost.leftLabel}
                </div>
              </button>

              <button
                onClick={() => handleVote('right')}
                className={`w-full rounded-[24px] border px-4 py-4 text-left transition ${
                  currentChoice === 'right'
                    ? 'border-[#cfe0ff] bg-[linear-gradient(180deg,#f7faff_0%,#eaf1ff_100%)] shadow-[0_14px_26px_rgba(79,124,255,0.14)]'
                    : 'border-slate-200 bg-white hover:bg-slate-50'
                }`}
              >
                <div className="text-xs font-bold text-slate-500">오른쪽</div>
                <div className="mt-1 text-lg font-extrabold">
                  {currentPost.rightLabel}
                </div>
              </button>
            </div>
          </div>

          {currentChoice ? (
            <>
              <div
                className={`mt-4 rounded-[24px] border p-4 ${emotion?.toneClass ?? 'border-slate-200 bg-slate-50 text-slate-700'}`}
              >
                <div className="text-sm font-black">
                  {emotion?.title ?? '결과 보는 중'}
                </div>
                <div className="mt-1 text-sm opacity-90">
                  {emotion?.helper ?? '지금 반응이 계속 쌓이는 중'}
                </div>
              </div>

              <button
                onClick={handleNext}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-[24px] bg-[#4f7cff] px-5 py-4 text-base font-black text-white shadow-[0_14px_30px_rgba(79,124,255,0.22)]"
              >
                <span>다음 글 보기</span>
                <ChevronRight className="h-5 w-5" />
              </button>

              <div className="mt-4 grid grid-cols-3 gap-2">
                <button
                  onClick={() => setShowComments((prev) => !prev)}
                  className="rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm font-semibold text-slate-700"
                >
                  <span className="flex items-center justify-center gap-1.5">
                    <MessageCircle className="h-4 w-4" />
                    댓글
                  </span>
                </button>
                <button
                  onClick={handleToggleSave}
                  className={`rounded-2xl border px-3 py-3 text-sm font-semibold ${
                    isSaved
                      ? 'border-indigo-200 bg-indigo-50 text-indigo-700'
                      : 'border-slate-200 bg-white text-slate-700'
                  }`}
                >
                  <span className="flex items-center justify-center gap-1.5">
                    <Bookmark className="h-4 w-4" />
                    결말궁금
                  </span>
                </button>
                <div className="rounded-2xl border border-slate-200 bg-white px-3 py-3 text-center text-sm font-semibold text-slate-700">
                  <span className="flex items-center justify-center gap-1.5">
                    <Flame className="h-4 w-4" />
                    {result.left}%:{result.right}%
                  </span>
                </div>
              </div>

              {showComments ? (
                <div className="mt-4 rounded-[24px] border border-slate-200 bg-white p-4 shadow-[0_8px_20px_rgba(15,23,42,0.04)]">
                  <div className="mb-3 text-sm font-black text-slate-900">
                    댓글 분위기
                  </div>
                  <div className="space-y-2.5">
                    <div className="rounded-2xl bg-slate-50 px-3 py-3 text-sm text-slate-700">
                      이건 누가 봐도 왼쪽이지. 여행은 선 넘었다.
                    </div>
                    <div className="rounded-2xl bg-slate-50 px-3 py-3 text-sm text-slate-700">
                      상황 설명 더 들어봐야 함. 무조건 확정은 이름.
                    </div>
                    <div className="rounded-2xl bg-slate-50 px-3 py-3 text-sm text-slate-700">
                      이런 글이 제일 중독됨. 댓글 읽을수록 더 갈림.
                    </div>
                  </div>
                  {currentPost.hasOutcome ? (
                    <div className="mt-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm text-emerald-700">
                      <span className="font-bold">후기 있음</span> · 나중에 결말
                      확인 가능
                    </div>
                  ) : null}
                </div>
              ) : null}
            </>
          ) : null}
        </section>

        <footer className="sticky bottom-0 border-t border-slate-200/70 bg-white/95 px-4 py-3 backdrop-blur">
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={handlePrev}
              className="rounded-2xl bg-slate-100 px-4 py-3 text-sm font-bold text-slate-700"
            >
              이전 글
            </button>
            <button
              onClick={handleNext}
              className="rounded-2xl bg-slate-100 px-4 py-3 text-sm font-bold text-slate-700"
            >
              다음 글
            </button>
            <button className="rounded-2xl bg-slate-100 px-4 py-3 text-sm font-bold text-slate-700">
              <span className="flex items-center justify-center gap-1.5">
                <FileText className="h-4 w-4" />내 글
              </span>
            </button>
          </div>
        </footer>

        {toast ? (
          <div className="pointer-events-none fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-lg">
            {toast}
          </div>
        ) : null}
      </div>
    </main>
  )
}
