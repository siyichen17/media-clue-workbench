import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import type { EChartsCoreOption } from 'echarts'
import { EXPLAIN_PROMPT_VERSION, HOT_PROMPT_VERSION, type ExplainResult, type PitchCandidate, type ProgressResult } from '../../shared/aiTypes.ts'
import { EChart } from '../components/overview/EChart.tsx'
import { NewsDrawer } from '../components/news/NewsDrawer.tsx'
import { CATEGORIES, categoryById, topicById } from '../data/demo/catalog.ts'
import { EVENT_META } from '../data/demo/news.ts'
import { MEDIA } from '../data/demo/index.ts'
import { HOT_SNAPSHOTS } from '../data/demo/hotSnapshots.ts'
import { DEMO_COVERAGE } from '../data/demo/hotBatch.ts'
import './hot.css'
import { AnalysisTree, type TreeController } from '../components/hot/AnalysisTree.tsx'
import { analysisKey, loadDraft, loadPitchCache, saveDraft, savePitchCache } from '../lib/analysisDraft.ts'
import { AiRequestError, fetchAiStatus, requestExplain, requestPitches, requestProgress } from '../lib/aiClient.ts'
import { DATA_AS_OF_LABEL, DATA_END, DATA_START, dateRangeOf, formatStamp, presetLabel } from '../lib/dates.ts'
import {
  allTopics,
  boardTimes,
  buildExplain,
  dailyBoardCounts,
  dailyNewsCounts,
  drillEvents,
  eventCatalog,
  eventsForTopic,
  followDelta,
  hotNews,
  latestBoard,
  newsForEvent,
  rankDelta,
  rankFacts,
  rankSeries,
  resolveEventId,
  rowsAt,
  snapshotsOnDay,
  topicName,
  topicNews,
  topicOfEvent,
} from '../lib/hotSelectors.ts'
import {
  demoBatchLoaded,
  loadEventFollows,
  loadEventWatches,
  markEventSeen,
  loadExplainCache,
  loadKeywords,
  loadProgressCache,
  loadTopicFollows,
  loadViewState,
  markDemoBatchLoaded,
  saveKeywords,
  saveManualLink,
  saveTopicFollows,
  watchEvent,
  saveViewState,
  upsertExplainCache,
  upsertProgressCache,
  type EventFollow,
  type TopicFollow,
} from '../lib/hotStorage.ts'
import { adoptPitch, createDirection, currentActor, findLeadByEvent, followEvent, restoreLead, type Lead } from '../lib/leads.ts'
import { materialLevel, materialNature } from '../lib/material.ts'
import { loadFollows, saveFollows } from '../lib/storage.ts'
import type { DatePreset, HotPlatform, HotSnapshot, NewsItem } from '../types/domain.ts'

function materialOf(item: NewsItem) {
  return {
    articleId: item.id,
    eventId: item.eventId,
    mediaId: item.mediaId,
    mediaName: item.mediaName,
    publishedAt: item.publishedAt,
    completeness: materialLevel(item),
    nature: materialNature(item),
    title: item.title,
    summary: item.summary,
    body: item.body,
  }
}

function progressKey(eventId: string, start: string, end: string, ids: string[], scope: 'later' | 'asof') {
  const base = `${HOT_PROMPT_VERSION}:${eventId}:${start}:${end}:${ids.join(',')}`
  return scope === 'asof' ? `${base}:asof` : base
}

function explainKey(topicId: string, start: string, mode: string, ids: string[]) {
  return `${EXPLAIN_PROMPT_VERSION}:${topicId}:${start}:${mode}:${ids.join(',')}`
}

function displayTitle(title: string) {
  return title.replace(/（[^）]*）$/, '')
}

function shortDay(day: string) {
  if (day.length < 10) return day
  return `${Number(day.slice(5, 7))}月${Number(day.slice(8, 10))}日`
}

function regionOf(place: string) {
  if (place.includes('成都')) return '成都'
  if (place.includes('雅安')) return '雅安'
  if (place.includes('都江堰')) return '都江堰'
  return place ? '四川' : ''
}

function heatText(value: number) {
  if (value >= 10000) return `${(value / 10000).toFixed(value >= 100000 ? 0 : 1)}万`
  return value.toLocaleString('zh-CN')
}

export function HotPage() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const saved = useRef(loadViewState()).current
  const queryEvent = params.get('event')
  const [homeTab, setHomeTab] = useState<'discover' | 'track'>(saved?.homeTab ?? 'discover')
  const [trackTopic, setTrackTopic] = useState<string | null>(null)
  const [feed, setFeed] = useState<'news' | HotPlatform>(saved?.source ?? 'news')
  const [query, setQuery] = useState(saved?.query ?? '')
  const [region, setRegion] = useState(saved?.region ?? '')
  const [domain, setDomain] = useState(saved?.domain ?? '')
  const [clueSort, setClueSort] = useState<'published' | 'ingested'>(saved?.clueSort ?? 'published')
  const [watches, setWatches] = useState(() => loadEventWatches())
  const [statsOpen, setStatsOpen] = useState(false)
  const [forceNew, setForceNew] = useState(false)
  const [platform, setPlatform] = useState<HotPlatform>(saved?.platform ?? '微博')
  const [snapshotId, setSnapshotId] = useState<string | null>(saved?.snapshotId ?? null)
  const [itemId, setItemId] = useState<string | null>(saved?.itemId ?? null)
  const [eventId, setEventId] = useState<string | null>(queryEvent)
  const [pendingHot, setPendingHot] = useState<HotSnapshot | null>(null)
  const [pendingAction, setPendingAction] = useState<{ run: () => void } | null>(null)
  const treeApi = useRef<TreeController | null>(null)
  const [topicLocked, setTopicLocked] = useState(Boolean(params.get('topic')) || Boolean(saved?.topicLocked))
  const [topicId, setTopicId] = useState<string | null>(params.get('topic') || saved?.topicId || null)
  const [preset, setPreset] = useState<DatePreset>(params.get('start') ? 'custom' : (saved?.preset ?? '7d'))
  const [customStart, setCustomStart] = useState(params.get('start') || saved?.customStart || DATA_START)
  const [customEnd, setCustomEnd] = useState(params.get('end') || saved?.customEnd || DATA_END)
  const [metric, setMetric] = useState<'news' | 'board'>(saved?.metric ?? 'news')
  const [selectedDay, setSelectedDay] = useState<string | null>(saved?.selectedDay ?? null)
  const [mediaId, setMediaId] = useState(saved?.mediaId ?? 'all')
  const [news, setNews] = useState(() => hotNews())
  const [follows, setFollows] = useState<TopicFollow[]>(() => loadTopicFollows())
  const [leads, setLeads] = useState<EventFollow[]>(() => loadEventFollows())
  const [keywords, setKeywords] = useState<string[]>(() => loadKeywords())
  const [keywordOpen, setKeywordOpen] = useState(false)
  const [followOpen, setFollowOpen] = useState(false)
  const [leadOpen, setLeadOpen] = useState(false)
  const [followNotice, setFollowNotice] = useState<{ id: string; text: string } | null>(null)
  const [archivedAsk, setArchivedAsk] = useState<Lead | null>(null)
  const [keywordDraft, setKeywordDraft] = useState('')
  const [linkQuery, setLinkQuery] = useState('')
  const [progressMode, setProgressMode] = useState<'summary' | 'reports'>('summary')
  const [progress, setProgress] = useState<ProgressResult | null>(null)
  const [pitches, setPitches] = useState<PitchCandidate[] | null>(null)
  const [pitchError, setPitchError] = useState('')
  const [progressStale, setProgressStale] = useState(0)
  const [progressError, setProgressError] = useState('')
  const [progressBusy, setProgressBusy] = useState(false)
  const [explain, setExplain] = useState<ExplainResult | null>(null)
  const [explainError, setExplainError] = useState('')
  const [explainBusy, setExplainBusy] = useState(false)
  const [aiReady, setAiReady] = useState<boolean | null>(null)
  const [drawerItems, setDrawerItems] = useState<NewsItem[] | null>(null)
  const [articleFollows, setArticleFollows] = useState(() => loadFollows())
  const [compareHint, setCompareHint] = useState('')
  const [openNodes, setOpenNodes] = useState<string[]>(saved?.openNodes ?? [])
  const [rankOpen, setRankOpen] = useState(false)
  const [materialMode, setMaterialMode] = useState<'later' | 'asof'>(saved?.materialMode ?? 'later')
  const [reportSort, setReportSort] = useState<'latest' | 'earliest'>(saved?.reportSort ?? 'latest')
  const [progressNote, setProgressNote] = useState('')
  const [followDialog, setFollowDialog] = useState(false)
  const [followDraft, setFollowDraft] = useState('')
  const [planDraft, setPlanDraft] = useState('')
  const [eventLimit, setEventLimit] = useState(6)
  const listRef = useRef<HTMLDivElement>(null)
  const requestRef = useRef(0)
  const explainRef = useRef(0)

  const times = boardTimes(platform)
  const activeTime = snapshotId && times.includes(snapshotId) ? snapshotId : latestBoard(platform)
  const rows = activeTime ? rowsAt(platform, activeTime) : []
  const range = dateRangeOf({ preset, customStart, customEnd })
  const events = eventCatalog(news)
  const currentEvent = events.find((item) => item.id === eventId) ?? null
  const hotParam = params.get('hot')
  const platParam = params.get('plat')
  const snapParam = params.get('snap')
  const clickedSource = hotParam && platParam && snapParam
    ? HOT_SNAPSHOTS.find((item) => item.itemId === hotParam && item.platform === platParam && item.observedAt === snapParam) ?? null
    : null
  const source = eventId && clickedSource && (resolveEventId(clickedSource) === eventId || resolveEventId(clickedSource) == null)
    ? clickedSource
    : null
  const eventNews = eventId
    ? newsForEvent(eventId, news).filter((item) => {
        const day = item.publishedAt.slice(0, 10)
        if (day < range.start || day > range.end) return false
        if (materialMode === 'asof' && source && item.publishedAt > source.observedAt) return false
        return true
      })
    : []
  const materialIds = eventNews.map((item) => item.id).sort()
  const activeTopic = topicId
  const counts = activeTopic ? dailyNewsCounts(activeTopic, range.start, range.end, mediaId) : []
  const boardCounts = activeTopic ? dailyBoardCounts(activeTopic, range.start, range.end) : []
  const drillStart = selectedDay ?? range.start
  const drillEnd = selectedDay ?? range.end
  const drilled = activeTopic ? drillEvents(activeTopic, drillStart, drillEnd, news) : []
  const explainWindow = selectedDay ? { start: selectedDay, end: selectedDay } : preset === 'custom' ? range : null
  const explainStats = activeTopic && explainWindow ? buildExplain(activeTopic, explainWindow.start, explainWindow.end, news) : null
  const rank = source ? rankFacts(source.platform, source.itemId) : null
  useEffect(() => {
    if (!eventId) return
    void fetchAiStatus().then((status) => setAiReady(status.configured))
  }, [eventId])

  const routeEvent = params.get('event')
  const detailSearch = useRef(params.toString())
  if (routeEvent) detailSearch.current = params.toString()
  const restoring = useRef(false)

  useEffect(() => {
    if (!routeEvent) return
    const next = new URLSearchParams(params)
    if (topicId) next.set('topic', topicId)
    else next.delete('topic')
    next.set('start', range.start)
    next.set('end', range.end)
    if (next.toString() !== params.toString()) setParams(next, { replace: true })
  }, [routeEvent, topicId, range.start, range.end, params, setParams])

  useEffect(() => {
    if (routeEvent === eventId) {
      restoring.current = false
      return
    }
    if (eventId && !routeEvent && treeApi.current?.isDirty()) {
      if (restoring.current) return
      restoring.current = true
      setPendingAction({
        run: () => {
          navigate('/hot', { replace: true })
        },
      })
      navigate({ pathname: '/hot', search: `?${detailSearch.current}` })
      return
    }
    restoring.current = false
    setEventId(routeEvent)
  }, [routeEvent, eventId, navigate])

  useEffect(() => {
    if (!keywordOpen && !followOpen && !leadOpen && !followDialog && !pendingHot) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setKeywordOpen(false)
      setFollowOpen(false)
      setLeadOpen(false)
      setFollowDialog(false)
      setPendingHot(null)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [keywordOpen, followOpen, leadOpen, followDialog, pendingHot])

  useEffect(() => {
    if (routeEvent) return
    const y = loadViewState()?.scroll ?? 0
    const frame = requestAnimationFrame(() => window.scrollTo(0, y))
    return () => cancelAnimationFrame(frame)
  }, [routeEvent])

  useEffect(() => {
    const onBoard = !routeEvent
    const prev = loadViewState()
    saveViewState({
      platform,
      snapshotId: activeTime,
      itemId,
      eventId: null,
      topicLocked,
      topicId,
      preset,
      customStart,
      customEnd,
      metric,
      selectedDay,
      mediaId,
      scroll: onBoard ? window.scrollY : (prev?.scroll ?? 0),
      materialMode,
      openNodes,
      reportSort,
      homeTab,
      source: feed,
      query,
      region,
      domain,
      clueSort,
    })
  }, [platform, activeTime, itemId, routeEvent, topicLocked, topicId, preset, customStart, customEnd, metric, selectedDay, mediaId, materialMode, openNodes, reportSort, homeTab, feed, query, region, domain, clueSort])

  useEffect(() => {
    if (routeEvent) return
    const onScroll = () => {
      const current = loadViewState()
      if (!current) return
      saveViewState({
        platform,
        snapshotId: activeTime,
        itemId,
        eventId: null,
        topicLocked,
        topicId,
        preset,
        customStart,
        customEnd,
        metric,
        selectedDay,
        mediaId,
        scroll: window.scrollY,
        materialMode,
        openNodes,
        reportSort,
        homeTab,
        source: feed,
        query,
        region,
        domain,
        clueSort,
      })
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [routeEvent, platform, activeTime, itemId, topicLocked, topicId, preset, customStart, customEnd, metric, selectedDay, mediaId, materialMode, openNodes, reportSort, homeTab, feed, query, region, domain, clueSort])

  useEffect(() => {
    if (!eventId) {
      setProgress(null)
      setPitches(null)
      setPitchError('')
      setProgressStale(0)
      setProgressNote('')
      return
    }
    const key = progressKey(eventId, range.start, range.end, materialIds, materialMode)
    const cached = loadProgressCache().find((item) => item.key === key)
    const pitch = loadPitchCache(key)
    setPitches(pitch?.pitches ?? null)
    if (!cached) {
      setProgress(null)
      setProgressStale(0)
      setProgressNote('')
      return
    }
    const missing = materialIds.filter((id) => !cached.materialIds.includes(id)).length
    setProgress(cached.result as ProgressResult)
    setProgressStale(missing)
    setProgressNote(missing > 0 ? `新增${missing}篇报道，当前概括尚未包含。` : '')
  }, [eventId, range.start, range.end, materialMode, materialIds.join('|')])

  const explainIds = explainStats
    ? [...explainStats.events]
        .filter((item) => item.eventId !== 'pending')
        .sort((a, b) => b.current - a.current)
        .flatMap((item) => item.articleIds)
        .slice(0, 24)
    : []
  const explainMaterials = activeTopic && explainStats
    ? topicNews(activeTopic, explainStats.currentRange.start, explainStats.currentRange.end, 'all', news).filter((item) => explainIds.includes(item.id))
    : []
  const currentExplainKey = activeTopic && explainStats ? explainKey(activeTopic, explainStats.currentRange.start, explainStats.mode, explainMaterials.map((item) => item.id)) : ''

  useEffect(() => {
    if (!currentExplainKey) {
      setExplain(null)
      return
    }
    const hit = loadExplainCache().find((item) => item.key === currentExplainKey)
    setExplain(hit ? (hit.result as ExplainResult) : null)
    setExplainError('')
  }, [currentExplainKey])

  function runGuarded(action: () => void) {
    if (treeApi.current?.isDirty()) {
      setPendingAction({ run: action })
      return
    }
    action()
  }

  function openDetail(next: string, row: HotSnapshot | null, from: string) {
    requestRef.current += 1
    explainRef.current += 1
    const nextTopic = topicOfEvent(next, news) ?? row?.topicId ?? null
    const nextParams = new URLSearchParams()
    nextParams.set('event', next)
    if (nextTopic) nextParams.set('topic', nextTopic)
    nextParams.set('start', range.start)
    nextParams.set('end', range.end)
    if (row && (resolveEventId(row) === next || resolveEventId(row) == null)) {
      nextParams.set('hot', row.itemId)
      nextParams.set('plat', row.platform)
      nextParams.set('snap', row.observedAt)
      setItemId(row.itemId)
    }
    nextParams.set('from', from)
    setTopicId(nextTopic)
    setEventId(next)
    setFollowNotice(null)
    setProgress(null)
    setPitches(null)
    setPitchError('')
    setProgressStale(0)
    setProgressError('')
    setProgressNote('')
    setOpenNodes([])
    setCompareHint('')
    setPendingHot(null)
    setProgressMode('summary')
    setParams(nextParams)
  }

  function leaveToBoard() {
    runGuarded(() => {
      if (params.get('from') === 'overview') navigate('/')
      else navigate('/hot')
    })
  }

  function pickHot(row: HotSnapshot) {
    setItemId(row.itemId)
    const linked = resolveEventId(row)
    if (linked) {
      runGuarded(() => openDetail(linked, row, 'board'))
      return
    }
    setPendingHot(row)
  }

  function chooseEvent(next: string, row?: HotSnapshot | null) {
    const carried = row === undefined
      ? (source && resolveEventId(source) === next ? source : null)
      : row
    runGuarded(() => openDetail(next, carried, params.get('from') || 'board'))
  }

  async function generateProgress() {
    if (!eventId || !eventNews.length) return
    const token = ++requestRef.current
    const ids = eventNews.map((item) => item.id).sort()
    const key = progressKey(eventId, range.start, range.end, ids, materialMode)
    setProgressBusy(true)
    setProgressError('')
    try {
      const result = await requestProgress(eventNews.map(materialOf))
      if (token !== requestRef.current) return
      upsertProgressCache({ key, eventId, materialIds: ids, result, createdAt: DATA_AS_OF_LABEL, scope: materialMode })
      setProgress(result)
      setProgressStale(0)
      setProgressNote('')
      setProgressMode('summary')
      try {
        const pitch = await requestPitches(eventNews.map(materialOf))
        if (token !== requestRef.current) return
        savePitchCache({ key, eventId, pitches: pitch.pitches, savedAt: DATA_AS_OF_LABEL })
        setPitches(pitch.pitches)
        setPitchError('')
      } catch (error) {
        if (token !== requestRef.current) return
        setPitchError(error instanceof AiRequestError ? error.message : '推荐拟题失败，进展树已保留')
      }
    } catch (error) {
      if (token !== requestRef.current) return
      if (error instanceof DOMException && error.name === 'AbortError') return
      setProgressError(error instanceof AiRequestError ? error.message : '进展生成失败')
      if (progress) setProgressNote('更新失败，仍显示上次概括。')
    } finally {
      if (token === requestRef.current) setProgressBusy(false)
    }
  }

  async function generateExplain() {
    if (!activeTopic || !explainStats) return
    const token = ++explainRef.current
    const eventIds = [...new Set(explainMaterials.map((item) => item.eventId))].filter((id) => id !== 'pending')
    if (!eventIds.length) {
      setExplainError('本期没有可归因到单一事件的报道，统计数字仍保留在上方。')
      return
    }
    const materials = explainMaterials.map(materialOf)
    const key = currentExplainKey
    setExplainBusy(true)
    setExplainError('')
    try {
      const result = await requestExplain({
        mode: explainStats.mode,
        stats: explainStats,
        materials,
        eventIds,
      })
      if (token !== explainRef.current) return
      upsertExplainCache({ key, eventId: activeTopic, materialIds: materials.map((item) => item.articleId), result, createdAt: DATA_AS_OF_LABEL })
      setExplain(result)
    } catch (error) {
      if (token !== explainRef.current) return
      setExplainError(error instanceof AiRequestError ? error.message : '解释生成失败')
    } finally {
      if (token === explainRef.current) setExplainBusy(false)
    }
  }

  function followTopic(nextTopic: string) {
    const watermark = news.filter((item) => item.topicId === nextTopic).map((item) => item.ingestedAt || item.publishedAt).sort().at(-1) ?? DATA_AS_OF_LABEL
    const rowsNow = loadTopicFollows()
    const existing = rowsNow.find((item) => item.topicId === nextTopic)
    const next = existing
      ? rowsNow.map((item) => (item.topicId === nextTopic ? { ...item, active: true } : item))
      : [{ topicId: nextTopic, followedAt: DATA_AS_OF_LABEL, seenWatermark: watermark, active: true }, ...rowsNow]
    saveTopicFollows(next)
    setFollows(next)
  }

  function unfollowTopic(nextTopic: string) {
    const next = loadTopicFollows().map((item) => (item.topicId === nextTopic ? { ...item, active: false } : item))
    saveTopicFollows(next)
    setFollows(next)
  }

  function markSeen(nextTopic: string) {
    const loaded = news.filter((item) => item.topicId === nextTopic).map((item) => item.ingestedAt || item.publishedAt).sort()
    const watermark = loaded.at(-1)
    if (!watermark) return
    const next = loadTopicFollows().map((item) => (item.topicId === nextTopic ? { ...item, seenWatermark: watermark } : item))
    saveTopicFollows(next)
    setFollows(next)
  }

  function saveFollow() {
    if (!currentEvent) return
    const existing = findLeadByEvent(currentEvent.id)
    if (existing?.status === 'archived') {
      setFollowDialog(false)
      setForceNew(false)
      setArchivedAsk(existing)
      return
    }
    if (existing && !forceNew) {
      setFollowNotice({ id: existing.id, text: `已有跟进「${existing.title}」。没有再新建一条。` })
      setFollowDialog(false)
      return
    }
    const articleIds = eventNews.map((item) => item.id)
    const headline = planDraft.split('\n')[0]?.trim() || `${currentEvent.name} · 选题方向`
    const result = forceNew
      ? createDirection({ eventId: currentEvent.id, eventName: currentEvent.name, articleIds, title: headline, nextPlan: planDraft, note: followDraft })
      : planDraft.trim()
        ? adoptPitch({
          eventId: currentEvent.id,
          eventName: currentEvent.name,
          articleIds,
          title: headline,
          angle: followDraft,
          outline: planDraft.split('\n').slice(1).map((line) => line.replace(/^待核实：/, '')),
          articleIdsPitch: articleIds,
          mode: 'replace',
        })
        : followEvent({
          eventId: currentEvent.id,
          eventName: currentEvent.name,
          articleIds,
          entry: 'hot',
          note: followDraft,
          nextPlan: planDraft,
          analysisKey: progress ? progressKey(currentEvent.id, range.start, range.end, articleIds, materialMode) : null,
        })
    if (result.kind === 'archived') {
      setArchivedAsk(result.lead)
      setFollowDialog(false)
      return
    }
    setLeads(loadEventFollows())
    setFollowDialog(false)
    setForceNew(false)
    setFollowNotice({ id: result.lead.id, text: result.kind === 'created' ? '已保存跟进。' : '已写回原来的跟进。' })
  }

  function confirmLink(nextEventId: string) {
    if (!pendingHot) return
    saveManualLink(`${pendingHot.platform}:${pendingHot.itemId}`, nextEventId)
    setLinkQuery('')
    openDetail(nextEventId, pendingHot, 'board')
  }

  function loadBatch() {
    if (!demoBatchLoaded()) markDemoBatchLoaded()
    setNews(hotNews())
  }

  const newsOption = useMemo<EChartsCoreOption>(() => ({
    tooltip: { trigger: 'axis', confine: true, valueFormatter: (value: unknown) => `${value ?? 0} 篇` },
    grid: { left: 46, right: 16, top: 28, bottom: 28 },
    xAxis: {
      type: 'category',
      data: counts.map((item, index) => (index === 0 || item.day.slice(0, 7) !== counts[index - 1].day.slice(0, 7) ? shortDay(item.day) : String(Number(item.day.slice(8))))),
    },
    yAxis: { type: 'value', name: '篇', minInterval: 1 },
    series: [{
      type: 'line',
      data: counts.map((item) => ({ value: item.count, itemStyle: item.day === selectedDay ? { color: '#1d4ed8', borderColor: '#fff', borderWidth: 2 } : undefined })),
      smooth: false,
      showSymbol: true,
      symbolSize: 8,
      itemStyle: { color: '#2563eb' },
      lineStyle: { width: 2, color: '#2563eb' },
      areaStyle: { color: 'rgba(37, 99, 235, 0.12)' },
    }],
  }), [counts, selectedDay])

  const boardOption = useMemo<EChartsCoreOption>(() => ({
    tooltip: { trigger: 'axis', confine: true, valueFormatter: (value: unknown) => `${value ?? 0} 条` },
    legend: { data: ['微博', '百度'], top: 0, right: 0, itemWidth: 10, itemHeight: 10 },
    grid: { left: 46, right: 12, top: 36, bottom: 28 },
    xAxis: {
      type: 'category',
      data: boardCounts.map((item, index) => (index === 0 || item.day.slice(0, 7) !== boardCounts[index - 1].day.slice(0, 7) ? shortDay(item.day) : String(Number(item.day.slice(8))))),
    },
    yAxis: { type: 'value', name: '条', minInterval: 1 },
    series: [
      { name: '微博', type: 'bar', barMaxWidth: 16, data: boardCounts.map((item) => item.weibo), itemStyle: { color: '#2563eb' } },
      { name: '百度', type: 'bar', barMaxWidth: 16, data: boardCounts.map((item) => item.baidu), itemStyle: { color: '#0f8c82' } },
    ],
  }), [boardCounts])

  const rankOption = useMemo<EChartsCoreOption>(() => {
    if (!source) return {}
    const points = rankSeries(source.platform, source.itemId)
    return {
      tooltip: {
        trigger: 'axis',
        formatter: (params: unknown) => {
          const row = Array.isArray(params) ? params[0] as { dataIndex?: number } : null
          const point = points[row?.dataIndex ?? -1]
          if (!point) return ''
          if (point.missing) return `${point.time.slice(0, 10)} 采集缺失`
          if (point.rank == null) return `${formatStamp(point.time)} 榜单存在，该条目未上榜`
          return `${formatStamp(point.time)} 第 ${point.rank} 位`
        },
      },
      grid: { left: 48, right: 16, top: 16, bottom: 48 },
      xAxis: { type: 'category', data: points.map((item) => item.missing ? item.time.slice(5, 10) : formatStamp(item.time).slice(5)), axisLabel: { rotate: 40 } },
      yAxis: { type: 'value', name: '排名', inverse: true, min: 1 },
      series: [{ type: 'line', connectNulls: false, data: points.map((item) => item.rank), itemStyle: { color: '#2563eb' } }],
    }
  }, [source])

  const topicEvents = pendingHot?.topicId ? eventsForTopic(pendingHot.topicId, news) : []
  const actorId = currentActor()
  const clueRows = events.flatMap((event) => {
    const items = news.filter((item) => item.eventId === event.id)
    if (!items.length) return []
    const meta = EVENT_META[event.id]
    if (region && regionOf(meta?.place ?? '') !== region) return []
    if (domain && topicById[event.topicId]?.categoryId !== domain) return []
    const excerpt = [...items].sort((left, right) => right.publishedAt.localeCompare(left.publishedAt))[0]
    const blurb = meta?.summary || excerpt?.summary || ''
    if (query.trim() && !event.name.includes(query.trim()) && !blurb.includes(query.trim())) return []
    return [{
      id: event.id,
      name: event.name,
      blurb: blurb || '没有可用摘录',
      blurbLabel: meta?.summary ? '概括' : '报道摘录',
      latestPub: items.map((item) => item.publishedAt).sort().at(-1) ?? '',
      latestIn: items.map((item) => item.ingestedAt || item.publishedAt).sort().at(-1) ?? '',
      count: items.length,
      media: new Set(items.map((item) => item.mediaId)).size,
    }]
  }).sort((left, right) => (clueSort === 'published' ? right.latestPub.localeCompare(left.latestPub) : right.latestIn.localeCompare(left.latestIn)))
  const filteredBoard = rows.filter((row) => {
    if (query.trim() && !row.title.includes(query.trim())) return false
    if (domain && topicById[row.topicId ?? '']?.categoryId !== domain) return false
    if (region) {
      const linked = resolveEventId(row)
      if (regionOf(linked ? EVENT_META[linked]?.place ?? '' : '') !== region) return false
    }
    return true
  })
  const eventTracks = watches.filter((item) => item.active && item.userId === actorId).map((watch) => {
    const items = news.filter((item) => item.eventId === watch.eventId)
    const fresh = watch.seenIds === null ? null : items.filter((item) => !watch.seenIds?.includes(item.id))
    return {
      key: `event-${watch.eventId}`,
      kind: 'event' as const,
      title: items[0]?.eventName ?? watch.eventId,
      note: fresh === null ? '尚未查看' : fresh.length ? `新增 ${fresh.length} 篇报道` : '没有新入库材料',
      priority: fresh === null || fresh.length > 0 ? 0 : 1,
      time: items.map((item) => item.ingestedAt || item.publishedAt).sort().at(-1) ?? watch.watchedAt,
      open: () => chooseEvent(watch.eventId, null),
      mark: () => setWatches(markEventSeen(watch.eventId, actorId, items.map((item) => item.id))),
    }
  })
  const topicTracks = follows.filter((item) => item.active).map((item) => {
    const delta = followDelta(item, news)
    return {
      key: `topic-${item.topicId}`,
      kind: 'topic' as const,
      title: topicName(item.topicId),
      note: delta.reports ? `新增 ${delta.reports} 篇报道，涉及 ${delta.events} 个事件` : '没有新入库材料',
      priority: delta.reports ? 0 : 1,
      time: delta.latest,
      open: () => setTrackTopic(item.topicId),
      mark: () => markSeen(item.topicId),
    }
  })
  const trackRows = [...eventTracks, ...topicTracks].sort((left, right) => left.priority - right.priority || right.time.localeCompare(left.time))
  const linkChoices = events.filter((item) => !linkQuery || item.name.includes(linkQuery.trim()))
  const activeFollow = follows.find((item) => item.topicId === activeTopic && item.active)

  const sortedNews = [...eventNews].sort((a, b) => (reportSort === 'latest' ? b.publishedAt.localeCompare(a.publishedAt) : a.publishedAt.localeCompare(b.publishedAt)))
  const reportGroups = sortedNews.reduce<Record<string, NewsItem[]>>((groups, item) => {
    const day = item.publishedAt.slice(0, 10)
    groups[day] = [...(groups[day] ?? []), item]
    return groups
  }, {})
  const topic = activeTopic ? topicById[activeTopic] : undefined
  const eventTopic = currentEvent ? topicById[currentEvent.topicId] : undefined
  const shownEvents = drilled.slice(0, eventLimit)
  const dayItems = selectedDay && activeTopic && metric === 'board' ? snapshotsOnDay(activeTopic, selectedDay) : []
  async function retryPitches(notes: string) {
    if (!eventId || !eventNews.length) return
    const token = ++requestRef.current
    const ids = eventNews.map((item) => item.id).sort()
    const key = progressKey(eventId, range.start, range.end, ids, materialMode)
    setProgressBusy(true)
    setPitchError('')
    try {
      const pitch = await requestPitches(eventNews.map(materialOf), notes)
      if (token !== requestRef.current) return
      savePitchCache({ key, eventId, pitches: pitch.pitches, savedAt: DATA_AS_OF_LABEL })
      setPitches(pitch.pitches)
    } catch (error) {
      if (token !== requestRef.current) return
      setPitchError(error instanceof AiRequestError ? error.message : '推荐拟题失败，进展树已保留')
    } finally {
      if (token === requestRef.current) setProgressBusy(false)
    }
  }

  const treeKey = eventId ? analysisKey(eventId, range.start, range.end, materialMode) : ''

  return (
    <div className="page hot-page">
      <header className="hot-top">
        <div>
          <h1>热点</h1>
          <p>从热搜和已收录报道里发现事件，关注后回来接着看</p>
        </div>
        <div className="hot-actions">
          <button type="button" className="btn-quiet" onClick={() => setKeywordOpen(true)}>关键词管理</button>
          <button type="button" className="btn-quiet" onClick={() => setFollowOpen(true)}>我的关注</button>
          <button type="button" className="btn-text" onClick={() => setLeadOpen(true)}>跟进记录</button>
          <details className="hot-menu">
            <summary>演示工具</summary>
            <div className="hot-menu-pop">
              <button type="button" onClick={loadBatch}>{demoBatchLoaded() ? '下一批演示更新已载入' : '载入下一批演示更新'}</button>
            </div>
          </details>
        </div>
      </header>
      <div className="hot-status">
        <span className="hot-pill">模拟演示</span>
        <span>数据截止 {DATA_AS_OF_LABEL}</span>
        <span>{demoBatchLoaded() ? '已载入下一批演示更新' : '基础演示样本'}</span>
        <details className="hot-tip">
          <summary>覆盖说明</summary>
          <p>{DEMO_COVERAGE.statement}</p>
        </details>
      </div>

      {!eventId && (
        <section className="hot-card hot-board-page">
          <div className="seg" role="tablist" aria-label="热点首页">
            <button type="button" role="tab" aria-selected={homeTab === 'discover'} onClick={() => setHomeTab('discover')}>发现热点</button>
            <button type="button" role="tab" aria-selected={homeTab === 'track'} onClick={() => setHomeTab('track')}>我的追踪</button>
          </div>
          {homeTab === 'discover' && (
            <>
              <div className="hot-board-tools">
                <input className="hot-input" type="search" value={query} aria-label="搜索" placeholder="搜索事件或热搜原词" onChange={(event) => setQuery(event.target.value)} />
                <label>地区
                  <select className="hot-select" value={region} onChange={(event) => setRegion(event.target.value)}>
                    <option value="">全部</option>
                    {['成都', '雅安', '都江堰', '四川'].map((item) => <option key={item} value={item}>{item}</option>)}
                  </select>
                </label>
                <label>领域
                  <select className="hot-select" value={domain} onChange={(event) => setDomain(event.target.value)}>
                    <option value="">全部</option>
                    {CATEGORIES.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                  </select>
                </label>
                {(query || region || domain) && <button type="button" className="btn-text" onClick={() => { setQuery(''); setRegion(''); setDomain('') }}>清除筛选</button>}
              </div>
              <div className="seg" role="group" aria-label="来源">
                <button type="button" aria-pressed={feed === 'news'} onClick={() => setFeed('news')}>报道线索</button>
                {(['微博', '百度'] as HotPlatform[]).map((item) => (
                  <button key={item} type="button" aria-pressed={feed === item} onClick={() => { setFeed(item); setPlatform(item); setSnapshotId(latestBoard(item)) }}>{item}</button>
                ))}
              </div>
              {feed === 'news' && (
                <>
                  <div className="hot-rowline">
                    <p className="hot-sub">按事件聚合已收录报道。最近报道时间是发布时间，最新收录是入库时间，两者不是同一口径。</p>
                    <div className="seg">
                      <button type="button" aria-pressed={clueSort === 'published'} onClick={() => setClueSort('published')}>最近报道</button>
                      <button type="button" aria-pressed={clueSort === 'ingested'} onClick={() => setClueSort('ingested')}>最新收录</button>
                    </div>
                  </div>
                  <div className="hot-list" ref={listRef}>
                    {clueRows.length === 0 && <div className="hot-empty">当前筛选没有报道线索。<button type="button" className="btn-text" onClick={() => { setQuery(''); setRegion(''); setDomain('') }}>清除筛选</button></div>}
                    {clueRows.map((row) => {
                      const watching = watches.some((item) => item.eventId === row.id && item.userId === currentActor() && item.active)
                      return (
                        <article key={row.id} className="hot-hit">
                          <button type="button" className="hot-clue-main" onClick={() => chooseEvent(row.id, null)}>
                            <strong>{row.name}</strong>
                            <small>{row.blurbLabel}：{row.blurb}</small>
                            <em>{formatStamp(clueSort === 'published' ? row.latestPub : row.latestIn)} · {row.count} 篇报道 · {row.media} 家媒体</em>
                          </button>
                          <button type="button" className="btn-quiet" onClick={() => setWatches(watchEvent(row.id, currentActor()))}>{watching ? '已关注' : '关注'}</button>
                        </article>
                      )
                    })}
                  </div>
                </>
              )}
              {feed !== 'news' && (
                <>
                  <div className="hot-board-tools">
                    <p className="hot-sub">{platform} · {activeTime ? formatStamp(activeTime) : '暂无快照'} · 按原始榜位排列，不按事件重排</p>
                    <label>快照
                      <select className="hot-select" value={activeTime ?? ''} onChange={(event) => setSnapshotId(event.target.value)}>
                        {times.map((time) => <option key={time} value={time}>{formatStamp(time)}</option>)}
                      </select>
                    </label>
                  </div>
                  <div className="hot-list" ref={listRef}>
                    {filteredBoard.length === 0 && <div className="hot-empty">{rows.length === 0 ? '这个时点没有可用快照。' : '当前筛选没有热搜。'}{(query || region || domain) && <button type="button" className="btn-text" onClick={() => { setQuery(''); setRegion(''); setDomain('') }}>清除筛选</button>}</div>}
                    {filteredBoard.map((row) => {
                      const delta = rankDelta(row)
                      const linked = resolveEventId(row)
                      return (
                        <button key={row.id} type="button" className={row.rank <= 3 ? 'hot-hit top' : 'hot-hit'} title={row.title} onClick={() => pickHot(row)}>
                          <span className="hot-rank">{row.rank}</span>
                          <span>
                            <strong>{row.title}</strong>
                            <small>{heatText(row.heat)} · {linked ? '已关联事件' : row.topicId ? '需选择事件' : '未关联'}</small>
                          </span>
                          <span className={`hot-delta ${delta.kind}`}>{delta.label}</span>
                        </button>
                      )
                    })}
                  </div>
                </>
              )}
            </>
          )}
          {homeTab === 'track' && (
            <div className="hot-list">
              {trackRows.length === 0 && <div className="hot-empty">还没有关注。先到发现热点里关注一个事件或主题。<button type="button" className="btn-text" onClick={() => setHomeTab('discover')}>去发现热点</button></div>}
              {trackRows.map((row) => (
                <article key={row.key} className="hot-hit">
                  <button type="button" className="hot-clue-main" onClick={row.open}>
                    <strong>{row.title}</strong>
                    <small>{row.kind === 'event' ? '事件' : '主题'} · {row.note}</small>
                  </button>
                  {row.mark && <button type="button" className="btn-text" onClick={row.mark}>标记已看</button>}
                </article>
              ))}
              {trackTopic && (
                <div className="hot-events">
                  <div className="hot-rowline"><h3>{topicName(trackTopic)} 的相关事件</h3><button type="button" className="btn-text" onClick={() => setStatsOpen(true)}>主题统计</button></div>
                  {eventsForTopic(trackTopic, news).map((item) => (
                    <article key={item.id} className="hot-event">
                      <div><h4>{item.name}</h4></div>
                      <button type="button" className="btn-text" onClick={() => chooseEvent(item.id, null)}>查看</button>
                    </article>
                  ))}
                </div>
              )}
            </div>
          )}
        </section>
      )}
      {eventId && (
      <section className="hot-card hot-work">
        <div className="hot-work-head">
          <div className="hot-work-title">
            {eventTopic && <p className="hot-crumb"><button type="button" onClick={() => { setTopicId(eventTopic.id); setTopicLocked(true) }}>{categoryById[eventTopic.categoryId].name}</button> · {eventTopic.name}</p>}
            <h2>{currentEvent ? currentEvent.name : '没有找到这个事件'}</h2>
            <span className="hot-title-ops">
              {params.get('from') === 'overview' && <button type="button" className="btn-quiet" onClick={() => runGuarded(() => navigate('/'))}>返回总览</button>}
              <button type="button" className="btn-primary" onClick={leaveToBoard}>返回热搜榜</button>
            </span>
          </div>
          <div className="hot-work-meta">
            <span>{range.start} 至 {range.end}</span>
            <span>{currentEvent ? `${eventNews.length} 篇报道` : '未选事件'}</span>
            <span>{currentEvent ? `${new Set(eventNews.map((item) => item.mediaId)).size} 家媒体` : ''}</span>
            <details className="hot-tip">
              <summary>范围说明</summary>
              <p>{params.get('from') ? '日期由上一个页面带入。改日期后按新范围重新计算，不会沿用上一个事件的分析。' : '改日期或材料模式后，按新范围读取报道和分析草稿。'}</p>
            </details>
            {source ? (
              <details className="hot-source">
                <summary>来源热搜 {source.title}</summary>
                <p>{source.platform} 第 {source.rank} 位 · 快照 {formatStamp(source.observedAt)} · {materialMode === 'asof' ? '只看发布时间不晚于该快照的收录' : '含此快照之后的后续报道'}</p>
                <button type="button" className="btn-text" onClick={() => setRankOpen((value) => !value)} aria-expanded={rankOpen}>{rankOpen ? '收起榜位走势' : '榜位走势'}</button>
                {rankOpen && rank && (
                  <div className="hot-rankpanel">
                    <EChart option={rankOption} />
                    <p>首次 {formatStamp(rank.first.observedAt)} · 最近 {formatStamp(rank.latest.observedAt)} · 最佳第 {rank.best.rank} 位。{rank.spanLabel}</p>
                  </div>
                )}
              </details>
            ) : <span>{currentEvent ? '没有来自热搜榜的来源' : ''}</span>}
            <div className="seg" role="group" aria-label="材料时间">
              <button type="button" aria-pressed={materialMode === 'later'} onClick={() => runGuarded(() => setMaterialMode('later'))}>后续报道</button>
              <button type="button" aria-pressed={materialMode === 'asof'} onClick={() => runGuarded(() => setMaterialMode('asof'))}>当时已发布</button>
            </div>
          </div>
        </div>
        {!currentEvent && (
          <div className="hot-empty">没有找到这个事件，也不会沿用上一次的分析。</div>
        )}
        {currentEvent && (
          <>
            {eventNews.length === 0 && <p className="hot-banner">当前范围内没有可分析的报道，材料不足，不会生成分析。</p>}
            <div className="hot-ops">
                <button type="button" className="btn-quiet" onClick={() => currentEvent && setWatches(watchEvent(currentEvent.id, currentActor()))}>{watches.some((item) => item.eventId === currentEvent.id && item.userId === currentActor() && item.active) ? '已关注更新' : '关注更新'}</button>
                <button type="button" className="btn-primary" onClick={() => {
                  const existing = findLeadByEvent(currentEvent.id)
                  if (existing?.status === 'archived') { setArchivedAsk(existing); return }
                  setForceNew(false)
                  setFollowDraft(existing?.notes ?? '')
                  setPlanDraft(existing?.nextPlan ?? '')
                  setFollowDialog(true)
                }}>加入跟进</button>
                <details className="hot-menu">
                  <summary>分析工具</summary>
                  <div className="hot-menu-pop">
                    <button type="button" onClick={() => {
                      const mediaCount = new Set(eventNews.map((item) => item.mediaId)).size
                      if (mediaCount < 2) { setCompareHint('当前范围内不足两家媒体，不能编造对照材料。'); return }
                      const linked = findLeadByEvent(currentEvent.id)
                      navigate('/compete', { state: { wizard: { type: 'event', eventId: currentEvent.id, start: range.start, end: range.end, leadId: linked?.id } } })
                    }}>对比报道</button>
                    <button type="button" onClick={() => {
                      if (!eventNews.length) return
                      const linked = findLeadByEvent(currentEvent.id)
                      navigate('/reports', { state: { compose: { type: 'topic', eventId: currentEvent.id, start: range.start, end: range.end, articleIds: eventNews.map((item) => item.id), leadIds: linked ? [linked.id] : [], referenceNote: progress ? '已有进展概括只作参考，生成时仍以原始报道为准。' : '' } } })
                    }}>整理报告</button>
                  </div>
                </details>
                {aiReady === false && <span className="hot-faint">AI 未配置，报道和跟进记录仍可使用</span>}
              </div>
              {compareHint && <p className="hot-banner">{compareHint}</p>}
              {followNotice && <p className="hot-banner">{followNotice.text} <button type="button" className="btn-text" onClick={() => navigate(`/leads?lead=${followNotice.id}`)}>查看线索</button></p>}
              <div className="hot-tabs" role="tablist">
                <button type="button" role="tab" aria-selected={progressMode === 'summary'} onClick={() => setProgressMode('summary')}>分析树</button>
                <button type="button" role="tab" aria-selected={progressMode === 'reports'} onClick={() => setProgressMode('reports')}>全部报道</button>
              </div>
              {progressMode === 'summary' && (
                <div role="tabpanel">
                  {progressNote && !progressStale && <p className="hot-banner">{progressNote}</p>}
                  {progressStale > 0 && (
                    <p className="hot-banner">新增{progressStale}篇报道，当前分析尚未包含这些材料。
                      <button type="button" className="btn-text" onClick={() => setProgressMode('reports')}>查看新增</button>
                      <button type="button" className="btn-text" onClick={() => void generateProgress()}>更新分析</button>
                    </p>
                  )}
                  {progressBusy && <><p className="hot-sub">正在读取当前事件的报道并整理进展。</p><div className="hot-skeleton" /><div className="hot-skeleton" /></>}
                  {progressError && <p className="hot-banner">{progressError} <button type="button" className="btn-text" onClick={() => void generateProgress()}>重试</button><button type="button" className="btn-text" onClick={() => setProgressMode('reports')}>查看全部报道</button></p>}
                  <AnalysisTree
                    key={treeKey}
                    eventTitle={currentEvent.name}
                    news={eventNews}
                    progress={progress}
                    pitches={pitches}
                    pitchError={pitchError}
                    busy={progressBusy}
                    staleCount={progressStale}
                    draft={treeKey ? loadDraft(treeKey) : null}
                    savedAt={treeKey}
                    bindRef={treeApi}
                    onGenerate={() => void generateProgress()}
                    onRetryPitches={(notes) => void retryPitches(notes)}
                    onSave={(branches, rootTitle, meta) => {
                      if (!treeKey || !eventId) return '没有可保存的事件'
                      const result = saveDraft({ key: treeKey, eventId, userId: currentActor(), rootTitle, branches, materialIds: eventNews.map((item) => item.id), savedAt: new Date().toISOString(), deletedIds: meta.deletedIds, previous: meta.previous })
                      return result.ok ? '' : result.error
                    }}
                    onAdopt={(branch) => {
                      const questions = branch.outline.filter(Boolean)
                      setForceNew(false)
                      setFollowDraft(branch.angle)
                      setPlanDraft([branch.title, questions.length ? `待核实：${questions.join('；')}` : ''].filter(Boolean).join('\n'))
                      setFollowDialog(true)
                    }}
                    onOpenNews={(item) => setDrawerItems([item])}
                    onReport={(branch) => {
                      if (!currentEvent) return
                      const linked = findLeadByEvent(currentEvent.id)
                      navigate('/reports', { state: { compose: { type: 'topic', eventId: currentEvent.id, start: range.start, end: range.end, articleIds: branch.articleIds.length ? branch.articleIds : eventNews.map((item) => item.id), leadIds: linked ? [linked.id] : [], referenceNote: `建议选题（不是已发生事实）：${branch.title}。角度：${branch.angle}。提纲：${branch.outline.join('；')}。请放在后续工作，不要写进事实梳理。` } } })
                    }}
                  />
                </div>
              )}
              {progressMode === 'reports' && (
                <div role="tabpanel">
                  <div className="hot-rowline">
                    <div className="seg">
                      <button type="button" aria-pressed={reportSort === 'latest'} onClick={() => setReportSort('latest')}>最新优先</button>
                      <button type="button" aria-pressed={reportSort === 'earliest'} onClick={() => setReportSort('earliest')}>最早优先</button>
                    </div>
                  </div>
                  <div className="hot-report-list">
                    {Object.entries(reportGroups).map(([day, items]) => (
                      <section key={day}>
                        <div className="hot-day">{shortDay(day)}</div>
                        {items.map((item) => (
                          <article key={item.id} className="hot-report">
                            <h5>{displayTitle(item.title)}</h5>
                            <div className="hot-faint">{item.mediaName} · {formatStamp(item.publishedAt)} · {item.nature === 'real' ? '真实' : '模拟'}</div>
                            <p>{item.summary}</p>
                            <button type="button" className="btn-text" onClick={() => setDrawerItems([item])}>查看全文</button>
                          </article>
                        ))}
                      </section>
                    ))}
                    {sortedNews.length === 0 && <div className="hot-empty">当前范围内没有可分析的报道，材料不足，不会生成分析。</div>}
                  </div>
                </div>
              )}
            </>
          )}
      </section>
      )}

      {statsOpen && <section className="hot-card hot-trend">
        <div className="hot-card-head">
          <div>
            <h2>关键词趋势</h2>
            <p className="hot-sub">{topic ? `${topic.name} · ${topicLocked ? '已锁定' : '关联自当前热点'}` : '当前热点没有主题，请选择一个主题。'}</p>
          </div>
          <div className="hot-ops">
            {activeTopic && <button type="button" className="btn-quiet" onClick={() => (activeFollow ? unfollowTopic(activeTopic) : followTopic(activeTopic))}>{activeFollow ? '取消关注' : '关注主题'}</button>}
            <button type="button" className="btn-text" onClick={() => setTopicLocked((value) => !value)}>{topicLocked ? '解锁主题' : '锁定主题'}</button>
          </div>
        </div>
        <div className="hot-control">
          <label>主题
            <select className="hot-select" value={activeTopic ?? ''} onChange={(event) => { setTopicId(event.target.value || null); setTopicLocked(true) }}>
              <option value="">选择主题</option>
              {allTopics().map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </label>
          <div className="seg" role="group" aria-label="指标">
            <button type="button" aria-pressed={metric === 'news'} onClick={() => setMetric('news')}>相关新闻数</button>
            <button type="button" aria-pressed={metric === 'board'} onClick={() => setMetric('board')}>热榜表现</button>
          </div>
          <div className="seg" role="group" aria-label="时间范围">
            {(['7d', '14d', 'custom'] as DatePreset[]).map((item) => (
              <button key={item} type="button" aria-pressed={preset === item} onClick={() => runGuarded(() => { setPreset(item); setSelectedDay(null) })}>{presetLabel(item)}</button>
            ))}
          </div>
          {preset === 'custom' && (
            <>
              <input className="hot-input" type="date" aria-label="开始日期" min={DATA_START} max={DATA_END} value={customStart} onChange={(event) => { const value = event.target.value; runGuarded(() => { setCustomStart(value); setSelectedDay(null) }) }} />
              <input className="hot-input" type="date" aria-label="结束日期" min={DATA_START} max={DATA_END} value={customEnd} onChange={(event) => { const value = event.target.value; runGuarded(() => { setCustomEnd(value); setSelectedDay(null) }) }} />
            </>
          )}
          {metric === 'news' && (
            <label>媒体
              <select className="hot-select" value={mediaId} onChange={(event) => setMediaId(event.target.value)}>
                <option value="all">全部媒体</option>
                {MEDIA.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </label>
          )}
        </div>
        {activeTopic && metric === 'news' && <div className="hot-chart"><EChart option={newsOption} onClick={(params) => { const day = counts[params.dataIndex ?? -1]?.day; if (day) setSelectedDay(day) }} /></div>}
        {activeTopic && metric === 'board' && <div className="hot-chart"><EChart option={boardOption} onClick={(params) => { const day = boardCounts[params.dataIndex ?? -1]?.day; if (day) setSelectedDay(day) }} /></div>}
        {activeTopic && <p className="hot-note">{metric === 'news' ? '按已收录报道统计，单位为篇。' : '按平台每日去重热搜条目统计，单位为条。'} <details className="hot-tip"><summary>统计口径</summary><p>{DEMO_COVERAGE.statement} 同一报道只计一次。微博和百度热度不相加。</p></details></p>}
        {explainWindow && (
          <div className="hot-selectbar">
            <div>
              <strong>已选 {explainWindow.start === explainWindow.end ? shortDay(explainWindow.start) : `${shortDay(explainWindow.start)}—${shortDay(explainWindow.end)}`}</strong>
              <div className="hot-faint">{metric === 'board' ? '热榜条目按当天去重' : '报道按发布日期计入'}</div>
            </div>
            <div className="hot-ops">
              {selectedDay && <button type="button" className="btn-text" onClick={() => setSelectedDay(null)}>清除选择</button>}
              {metric === 'news' && <button type="button" className="btn-primary" disabled={!explainStats || explainBusy} onClick={() => void generateExplain()}>{explainBusy ? '解释中' : explainStats?.mode === 'composition' ? '解释本期报道构成' : '解释这一波变化'}</button>}
            </div>
          </div>
        )}
        {metric === 'news' && explainStats && (
          <div className="hot-explain">
            <h3>{explainStats.mode === 'composition' ? '本期报道构成' : '这一阶段发生了什么变化'}</h3>
            <div className="hot-stats">
              <span className="hot-stat">本期 {explainStats.current.count} 篇</span>
              {explainStats.previousCovered ? <span className="hot-stat">对照 {explainStats.previous?.count ?? 0} 篇</span> : <span className="hot-stat">对照期超出覆盖</span>}
              {explainStats.previousCovered && <span className="hot-stat">{explainStats.previous?.count === 0 ? `净增 ${explainStats.delta} 篇` : `增减 ${explainStats.delta} 篇`}</span>}
            </div>
            {explainError && <p className="hot-banner">{explainError} <button type="button" className="btn-text" onClick={() => void generateExplain()}>重试</button></p>}
            {explain && (
              <>
                <p>{explain.overview}</p>
                {explain.eventFindings.map((item) => (
                  <article key={item.eventId} className="hot-finding">
                    <p>{item.text}</p>
                    <div className="hot-ops">{item.articleIds.map((id, index) => <button key={id} type="button" className="hot-tag" onClick={() => { const found = news.find((row) => row.id === id); if (found) setDrawerItems([found]) }}>{index + 1}</button>)}</div>
                  </article>
                ))}
                {explain.limitations.length > 0 && <details className="hot-tip"><summary>材料限制</summary><p>{explain.limitations.join(' ')}</p></details>}
              </>
            )}
          </div>
        )}
        {dayItems.length > 0 && (
          <div className="hot-events">
            <h3>当天热搜条目</h3>
            {dayItems.map((item) => <article key={item.id} className="hot-event"><div><h4>{item.title}</h4><p className="hot-faint">{item.platform} · 第 {item.rank} 位 · {formatStamp(item.observedAt)}</p></div></article>)}
          </div>
        )}
        <div className="hot-events">
          <div className="hot-rowline"><h3>相关事件</h3><span className="hot-faint">{drilled.length} 个事件</span></div>
          {shownEvents.map((group) => (
            <article key={group.eventId} className="hot-event">
              <div>
                <h4>{group.name}</h4>
                <p className="hot-faint">{group.count} 篇 · {group.media} 家媒体 · {group.latest ? formatStamp(group.latest) : '无时间'}</p>
              </div>
              <div className="ops">
                <button type="button" className="btn-quiet" onClick={() => setDrawerItems(group.items)}>查看报道</button>
                {group.eventId !== 'pending' && <button type="button" className="btn-text" onClick={() => chooseEvent(group.eventId)}>查看进展</button>}
              </div>
            </article>
          ))}
          {drilled.length > eventLimit && <button type="button" className="btn-text" onClick={() => setEventLimit((value) => value + 6)}>展开更多</button>}
          {drilled.length === 0 && <p className="hot-faint">这个范围内没有关联报道。</p>}
        </div>
      </section>}

      {pendingHot && pendingHot.topicId && (
        <div className="hot-dialog-mask" onClick={() => setPendingHot(null)}>
          <section className="hot-dialog wide" role="dialog" aria-modal="true" aria-labelledby="pick-title" onClick={(event) => event.stopPropagation()}>
            <h2 id="pick-title">选择具体事件</h2>
            <p>「{pendingHot.title}」关联主题「{topicName(pendingHot.topicId)}」。选定一个事件后再进入详情，不会把不同事件合成一棵树。</p>
            <div className="hot-follow">
              {topicEvents.map((item) => {
                const related = news.filter((row) => row.eventId === item.id)
                const latest = related.map((row) => row.publishedAt).sort().at(-1)
                return (
                  <article key={item.id}>
                    <strong>{item.name}</strong>
                    <p className="hot-faint">{related.length} 篇报道 · {latest ? `最近 ${formatStamp(latest)}` : '没有报道时间'}</p>
                    <button type="button" className="btn-primary" onClick={() => chooseEvent(item.id, pendingHot)}>进入该事件</button>
                  </article>
                )
              })}
              {topicEvents.length === 0 && <p>这个主题下没有可分析的事件。材料不足，不会生成分析。</p>}
            </div>
            <div className="ops"><button type="button" className="btn-quiet" onClick={() => setPendingHot(null)}>取消</button></div>
          </section>
        </div>
      )}
      {pendingHot && !pendingHot.topicId && (
        <div className="hot-dialog-mask" onClick={() => setPendingHot(null)}>
          <section className="hot-dialog" role="dialog" aria-modal="true" aria-labelledby="link-title" onClick={(event) => event.stopPropagation()}>
            <h2 id="link-title">这条热搜尚未关联</h2>
            <p>「{pendingHot.title}」· {pendingHot.platform} 第 {pendingHot.rank} 位 · 快照 {formatStamp(pendingHot.observedAt)}。当前没有可分析的报道，材料不足，不会生成分析，也不会显示上一个事件。</p>
            <input className="hot-input" value={linkQuery} onChange={(event) => setLinkQuery(event.target.value)} placeholder="搜索已有事件并关联" aria-label="搜索已有事件并关联" />
            <div className="hot-ops">{linkChoices.slice(0, 8).map((item) => {
              const related = news.filter((row) => row.eventId === item.id)
              const latest = related.map((row) => row.publishedAt).sort().at(-1)
              return <button key={item.id} type="button" className="btn-quiet" onClick={() => confirmLink(item.id)}>{item.name} · {related.length} 篇{latest ? ` · ${formatStamp(latest)}` : ''}</button>
            })}</div>
            {linkChoices.length === 0 && <p>没有可关联的已有事件。</p>}
            <div className="ops"><button type="button" className="btn-quiet" onClick={() => setPendingHot(null)}>关闭</button></div>
          </section>
        </div>
      )}
      {pendingAction && (
        <div className="hot-dialog-mask">
          <section className="hot-dialog" role="dialog" aria-modal="true" aria-labelledby="unsaved-title">
            <h2 id="unsaved-title">分析树还有未保存的修改</h2>
            <p>可以保存并离开、放弃修改，或留在当前事件继续编辑。</p>
            <div className="ops">
              <button type="button" className="btn-primary" onClick={() => {
                const message = treeApi.current?.save() ?? ''
                if (message) return
                const action = pendingAction.run
                setPendingAction(null)
                action()
              }}>保存并离开</button>
              <button type="button" className="btn-quiet" onClick={() => {
                treeApi.current?.discard()
                const action = pendingAction.run
                setPendingAction(null)
                action()
              }}>放弃修改</button>
              <button type="button" className="btn-text" onClick={() => setPendingAction(null)}>继续编辑</button>
            </div>
          </section>
        </div>
      )}
      {keywordOpen && (
        <div className="hot-dialog-mask" onClick={() => setKeywordOpen(false)}>
          <section className="hot-dialog" role="dialog" aria-modal="true" aria-labelledby="kw-title" onClick={(event) => event.stopPropagation()}>
            <h2 id="kw-title">关键词管理</h2>
            <div className="hot-ops">{keywords.map((word) => <span key={word} className="hot-tag">{word} <button type="button" className="btn-text" onClick={() => { const next = keywords.filter((item) => item !== word); saveKeywords(next); setKeywords(next) }}>移除</button></span>)}</div>
            <input className="hot-input" value={keywordDraft} onChange={(event) => setKeywordDraft(event.target.value)} placeholder="新增关键词" aria-label="新增关键词" />
            <div className="ops"><button type="button" className="btn-primary" onClick={() => { const word = keywordDraft.trim(); if (!word || keywords.includes(word)) return; const next = [...keywords, word]; saveKeywords(next); setKeywords(next); setKeywordDraft('') }}>添加</button><button type="button" className="btn-quiet" onClick={() => setKeywordOpen(false)}>关闭</button></div>
          </section>
        </div>
      )}
      {followOpen && (
        <div className="hot-dialog-mask" onClick={() => setFollowOpen(false)}>
          <section className="hot-dialog wide" role="dialog" aria-modal="true" aria-labelledby="follow-title" onClick={(event) => event.stopPropagation()}>
            <h2 id="follow-title">我的关注</h2>
            <div className="hot-follow">
              {follows.filter((item) => item.active).map((item) => {
                const delta = followDelta(item, news)
                return (
                  <article key={item.topicId}>
                    <strong>{topicName(item.topicId)}</strong>
                    <p className="hot-faint">新增事件 {delta.events} · 新增报道 {delta.reports} · {delta.latest.slice(0, 16).replace('T', ' ')}</p>
                    <div className="hot-ops">
                      <button type="button" className="btn-text" onClick={() => { setTopicId(item.topicId); setTopicLocked(true); setFollowOpen(false) }}>查看趋势</button>
                      <button type="button" className="btn-text" onClick={() => markSeen(item.topicId)}>标记已看</button>
                      <button type="button" className="btn-text" onClick={() => unfollowTopic(item.topicId)}>取消关注</button>
                    </div>
                  </article>
                )
              })}
              {!follows.some((item) => item.active) && <p>还没有关注主题。</p>}
            </div>
            <div className="ops"><button type="button" className="btn-quiet" onClick={() => setFollowOpen(false)}>关闭</button></div>
          </section>
        </div>
      )}
      {leadOpen && (
        <div className="hot-dialog-mask" onClick={() => setLeadOpen(false)}>
          <section className="hot-dialog wide" role="dialog" aria-modal="true" aria-labelledby="lead-title" onClick={(event) => event.stopPropagation()}>
            <h2 id="lead-title">跟进记录</h2>
            <div className="hot-follow">
              {leads.map((item) => {
                const linked = findLeadByEvent(item.eventId)
                return (
                <article key={item.eventId}>
                  <strong>{linked?.title ?? item.eventName}</strong>
                  <p className="hot-faint">材料 {item.materialIds.length} 篇 · {linked ? (linked.status === 'pending' ? '待处理' : linked.status === 'active' ? '跟进中' : '已结束') : '早期记录'}</p>
                  <button type="button" className="btn-text" onClick={() => navigate(`/leads?lead=${linked?.id ?? ''}`)}>在我的跟进中打开</button>
                  <button type="button" className="btn-text" onClick={() => { chooseEvent(item.eventId); setLeadOpen(false) }}>查看进展</button>
                </article>
                )
              })}
              {!leads.length && <p>还没有跟进事件。总览、竞品和热搜写入同一条记录。</p>}
            </div>
            <div className="ops"><button type="button" className="btn-quiet" onClick={() => setLeadOpen(false)}>关闭</button></div>
          </section>
        </div>
      )}
      {followDialog && currentEvent && (
        <div className="hot-dialog-mask" onClick={() => { setFollowDialog(false); setForceNew(false) }}>
          <section className="hot-dialog" role="dialog" aria-modal="true" aria-labelledby="track-title" onClick={(event) => event.stopPropagation()}>
            <h2 id="track-title">{findLeadByEvent(currentEvent.id) && !forceNew ? '已有跟进' : '加入跟进'}</h2>
            <p>{currentEvent.name}。保存后才写入，不会自动生成报告。</p>
            {findLeadByEvent(currentEvent.id) && !forceNew && findLeadByEvent(currentEvent.id)?.status !== 'archived' && (
              <p>已有事项「{findLeadByEvent(currentEvent.id)?.title}」。可以打开，或明确再开一个选题方向。</p>
            )}
            <textarea value={followDraft} aria-label="跟进备注" onChange={(event) => setFollowDraft(event.target.value)} placeholder="切入点和备注" />
            <textarea value={planDraft} aria-label="下一步计划" onChange={(event) => setPlanDraft(event.target.value)} placeholder="拟题和下一步" />
            <div className="ops">
              <button type="button" className="btn-quiet" onClick={() => { setFollowDialog(false); setForceNew(false) }}>取消</button>
              {findLeadByEvent(currentEvent.id) && !forceNew && <button type="button" className="btn-primary" onClick={() => navigate(`/leads?lead=${findLeadByEvent(currentEvent.id)?.id}`)}>打开已有事项</button>}
              {findLeadByEvent(currentEvent.id) && !forceNew && <button type="button" className="btn-quiet" onClick={() => setForceNew(true)}>新增一个选题方向</button>}
              {(!findLeadByEvent(currentEvent.id) || forceNew) && <button type="button" className="btn-primary" onClick={saveFollow}>保存跟进</button>}
            </div>
          </section>
        </div>
      )}
      {archivedAsk && (
        <div className="hot-dialog-mask" onClick={() => setArchivedAsk(null)}>
          <section className="hot-dialog" role="dialog" aria-modal="true" aria-labelledby="archived-title" onClick={(event) => event.stopPropagation()}>
            <h2 id="archived-title">这条线索已结束</h2>
            <p>不会自动恢复。可以查看原记录，或由你确认后再恢复为待处理。</p>
            <div className="ops">
              <button type="button" className="btn-primary" onClick={() => navigate(`/leads?lead=${archivedAsk.id}`)}>查看线索</button>
              <button type="button" className="btn-quiet" onClick={() => { restoreLead(archivedAsk.id); setLeads(loadEventFollows()); setArchivedAsk(null); setFollowNotice({ id: archivedAsk.id, text: '已恢复为待处理。' }) }}>恢复跟进</button>
              <button type="button" className="btn-text" onClick={() => setArchivedAsk(null)}>取消</button>
            </div>
          </section>
        </div>
      )}
      <NewsDrawer
        entry="hot"
        model={drawerItems ? { kind: 'news', tags: [{ id: 'hot', label: '热搜追踪' }], items: drawerItems, note: '模拟来源在站内阅读全文。' } : null}
        followedIds={articleFollows}
        onClose={() => setDrawerItems(null)}
        onToggleFollow={(id) => {
          const next = new Set(articleFollows)
          if (next.has(id)) next.delete(id)
          else next.add(id)
          saveFollows(next)
          setArticleFollows(next)
        }}
      />
    </div>
  )
}
