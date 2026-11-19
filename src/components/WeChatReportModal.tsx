import { useState } from 'react';
import {
  Check,
  Copy,
  Download,
  FileText,
  Image as ImageIcon,
  Loader2,
  Sparkles,
  X,
} from 'lucide-react';
import type {
  PlayerStanding,
  ScheduleFairnessReport,
  TournamentFormat,
  TournamentState,
} from '../types/tournament';
import {
  buildPosterCopyPayload,
  type AnalyzeApiResponse,
  type PosterCopyResult,
} from '../utils/aiAnalysis';
import {
  getDefaultPosterCopy,
  NIGHT_HERO_URL,
  renderPosterToDataUrl,
  type PosterTheme,
} from '../utils/posterCanvas';
import { formatWeChatReport } from '../utils/scheduler';

interface WeChatReportModalProps {
  open: boolean;
  state: TournamentState;
  standings: PlayerStanding[];
  fairness: ScheduleFairnessReport;
  heroImageUrl?: string;
  onClose: () => void;
}

const FORMAT_LABELS: Record<TournamentFormat, string> = {
  classic: '经典全员转',
  balanced: '水平均衡转',
  mixed: '混双优选转',
  mexicano: '胜者升场制',
  ai_smart: 'AI 智适应排阵',
};

const POSTER_THEMES: Array<{
  id: PosterTheme;
  label: string;
  swatch: string;
}> = [
  { id: 'night_slam', label: '夜场大满贯', swatch: 'bg-[#0C1D48] border-[#D4FF2B]' },
  { id: 'roland_clay', label: '红土画报', swatch: 'bg-[#C94A29] border-[#F4EDE2]' },
  { id: 'swiss_ticket', label: '瑞士票根', swatch: 'bg-[#ECEFF4] border-[#133EE6]' },
];

export function WeChatReportModal({
  open,
  state,
  standings,
  fairness,
  heroImageUrl,
  onClose,
}: WeChatReportModalProps) {
  const resolvedHeroUrl = heroImageUrl || NIGHT_HERO_URL;
  const [mode, setMode] = useState<'poster' | 'text'>('poster');
  const [theme, setTheme] = useState<PosterTheme>('night_slam');
  const [aiCopy, setAiCopy] = useState<PosterCopyResult | null>(null);
  const [copyLoading, setCopyLoading] = useState(false);
  const [copyError, setCopyError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);

  if (!open) return null;

  const reportText = formatWeChatReport(state, standings);
  const completedMatches = state.rounds.reduce(
    (sum, r) => sum + r.matches.filter((m) => m.status === 'completed').length,
    0
  );
  const totalMatches = state.rounds.reduce((sum, r) => sum + r.matches.length, 0);
  const mvp = standings[0] ?? null;
  const activeCopy = aiCopy ?? getDefaultPosterCopy(state, standings);
  const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, '.');

  const handleGenerateAiCopy = async () => {
    setCopyLoading(true);
    setCopyError(null);
    try {
      const payload = buildPosterCopyPayload(state, standings, fairness);
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'poster_copy',
          context: payload,
        }),
      });
      const json = (await res.json()) as AnalyzeApiResponse<PosterCopyResult>;
      if (!res.ok || !json.ok || !json.data) {
        setCopyError(json.error || 'AI 文案生成失败，请稍后重试');
        return;
      }
      setAiCopy(json.data);
    } catch {
      setCopyError('网络异常，无法连接 DeepSeek');
    } finally {
      setCopyLoading(false);
    }
  };

  const handleCopyText = async () => {
    try {
      await navigator.clipboard.writeText(reportText);
    } catch {
      const el = document.createElement('textarea');
      el.value = reportText;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2200);
  };

  const handleDownloadPoster = async () => {
    setDownloading(true);
    try {
      const dataUrl = await renderPosterToDataUrl(
        state,
        standings,
        fairness,
        theme,
        activeCopy,
        resolvedHeroUrl
      );
      if (!dataUrl) return;
      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = `${state.config.title.replace(/\s+/g, '_')}_${theme}.png`;
      link.click();
      setDownloaded(true);
      setTimeout(() => setDownloaded(false), 2200);
    } finally {
      setDownloading(false);
    }
  };

  const visibleRows = standings.slice(0, 8);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/82 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="report-modal-title"
      onClick={onClose}
    >
      <div
        className="w-full md:max-w-lg bg-[#111620] text-[#F4F7FB] rounded-t-3xl md:rounded-3xl p-4 sm:p-5 pb-safe shadow-2xl border border-white/[0.1] max-h-[94vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="md:hidden w-10 h-1.5 bg-white/20 rounded-full mx-auto mb-3"
          aria-hidden="true"
        />

        {/* Header */}
        <div className="flex items-center justify-between gap-3 pb-3">
          <div>
            <h2 id="report-modal-title" className="text-base sm:text-lg font-extrabold text-white">
              杂志级战报画报工坊
            </h2>
            <p className="text-xs text-[#8E9AB2]">
              3 套艺术版式 · DeepSeek 封面金句 · 2× Retina 无损导出
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭战报窗口"
            className="min-h-[44px] min-w-[44px] -mr-2 flex items-center justify-center rounded-xl text-[#8E9AB2] hover:bg-white/[0.08] hover:text-white cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode Switcher */}
        <div className="grid grid-cols-2 gap-1 p-1 bg-[#0A0E16] border border-white/[0.08] rounded-xl mb-3">
          <button
            type="button"
            onClick={() => setMode('poster')}
            className={`min-h-[38px] rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              mode === 'poster'
                ? 'bg-[#D4FF2B] text-[#080B10] font-bold'
                : 'text-[#8E9AB2] hover:text-white'
            }`}
          >
            <ImageIcon className="w-3.5 h-3.5" aria-hidden="true" />
            <span>杂志画报</span>
          </button>
          <button
            type="button"
            onClick={() => setMode('text')}
            className={`min-h-[38px] rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              mode === 'text'
                ? 'bg-[#D4FF2B] text-[#080B10] font-bold'
                : 'text-[#8E9AB2] hover:text-white'
            }`}
          >
            <FileText className="w-3.5 h-3.5" aria-hidden="true" />
            <span>微信群文字</span>
          </button>
        </div>

        {/* Theme Bar + DeepSeek Cover Copy Button (Poster Mode) */}
        {mode === 'poster' && (
          <div className="flex items-center justify-between gap-1.5 mb-3 overflow-x-auto no-scrollbar">
            <div className="flex items-center gap-1.5 shrink-0">
              {POSTER_THEMES.map((t) => {
                const active = theme === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTheme(t.id)}
                    aria-pressed={active}
                    className={`min-h-[36px] px-2.5 rounded-xl text-xs font-semibold border flex items-center gap-1.5 whitespace-nowrap transition-all cursor-pointer ${
                      active
                        ? 'bg-white/[0.12] border-[#D4FF2B] text-white font-bold'
                        : 'bg-[#0A0E16] border-white/[0.08] text-[#8E9AB2] hover:text-white'
                    }`}
                  >
                    <span
                      aria-hidden="true"
                      className={`w-2.5 h-2.5 rounded-full border shrink-0 ${t.swatch}`}
                    />
                    <span>{t.label}</span>
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={handleGenerateAiCopy}
              disabled={copyLoading}
              className="min-h-[36px] px-2.5 rounded-xl bg-[#162238] border border-[#D4FF2B]/45 text-[#D4FF2B] text-xs font-bold hover:bg-[#1D2D4A] inline-flex items-center gap-1 whitespace-nowrap shrink-0 transition-colors cursor-pointer disabled:opacity-50"
            >
              {copyLoading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
              ) : (
                <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
              )}
              <span>{copyLoading ? '撰写中' : aiCopy ? '换金句' : 'AI 金句'}</span>
            </button>
          </div>
        )}

        {copyError && (
          <p role="alert" className="text-xs text-[#FF8B73] mb-2">
            {copyError}
          </p>
        )}

        {/* Scrollable Editorial Poster Preview OR WeChat Text */}
        <div className="overflow-y-auto flex-1 pr-0.5">
          {mode === 'poster' ? (
            <>
              {/* THEME 1: NIGHT SLAM EDITION */}
              {theme === 'night_slam' && (
                <div className="rounded-2xl overflow-hidden bg-[#070A10] border border-white/[0.14] shadow-2xl">
                  {/* Full-bleed Floodlit Court Photo Hero */}
                  <div className="relative min-h-[215px] flex flex-col justify-between p-5 overflow-hidden">
                    {!imgFailed ? (
                      <img
                        src={resolvedHeroUrl}
                        alt="实景匹克球场战报头图"
                        referrerPolicy="no-referrer"
                        onError={() => setImgFailed(true)}
                        className="absolute inset-0 w-full h-full object-cover"
                      />
                    ) : (
                      <div className="absolute inset-0 bg-gradient-to-br from-[#0E2E7A] to-[#070A10]" />
                    )}
                    <div
                      aria-hidden="true"
                      className="absolute inset-0 bg-gradient-to-t from-[#070A10] via-[#070A10]/60 to-[#070A10]/40"
                    />

                    {/* Masthead */}
                    <div className="relative z-10 flex items-center justify-between text-[10px] font-mono tracking-wider">
                      <span className="text-[#D4FF2B] font-bold">NIGHT COURT // 轻转匹克</span>
                      <span className="text-white/80">
                        {todayStr} · {completedMatches}/{totalMatches}
                      </span>
                    </div>

                    {/* Watermark + Cover Title */}
                    <div className="relative z-10 pt-8">
                      <h3 className="text-2xl font-extrabold tracking-tight text-white leading-snug">
                        {activeCopy.coverTitle}
                      </h3>
                      <p className="text-xs text-[#C6D2E6] mt-1">{activeCopy.coverSub}</p>
                    </div>
                  </div>

                  {/* Sculptural MVP Hero */}
                  {mvp && mvp.played > 0 && (
                    <div className="px-5 py-4 border-t border-white/[0.12] flex items-end justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-[10px] font-mono font-bold tracking-widest text-[#D4FF2B]">
                          CHAMPION / NIGHT MVP
                        </div>
                        <div className="text-3xl font-extrabold text-white tracking-tight mt-0.5 truncate">
                          {mvp.player.name}
                        </div>
                        <div className="text-[11px] font-mono text-[#9AA5BC] mt-1 truncate">
                          {mvp.wins}W-{mvp.losses}L · 胜率 {Math.round(mvp.winRate * 100)}%
                          {mvp.bestPartner ? ` · 拍档 ${mvp.bestPartner.partnerName}` : ''}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="font-score italic text-5xl font-extrabold text-[#D4FF2B] leading-none">
                          {mvp.pointDiff >= 0 ? `+${mvp.pointDiff}` : mvp.pointDiff}
                        </div>
                        <div className="text-[10px] font-mono text-[#8E9AB2] mt-0.5">
                          NET DIFF
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Editorial Pull-Quote */}
                  <div className="mx-5 my-2 pl-3 border-l-2 border-[#D4FF2B] text-xs text-[#D8E1F0] leading-relaxed">
                    “{activeCopy.mvpQuote}”
                  </div>

                  {/* 2-Column Swiss Typographic Ledger */}
                  <div className="p-5 pt-3 space-y-2.5">
                    <div className="flex items-center justify-between text-[10px] font-mono text-[#8E9AB2] pt-2 border-t border-white/[0.12]">
                      <span>OFFICIAL STANDINGS // 战绩总榜</span>
                      <span>{FORMAT_LABELS[state.config.format]}</span>
                    </div>

                    <div className="grid grid-cols-2 gap-x-5 gap-y-2">
                      {visibleRows.map((row) => (
                        <div
                          key={row.player.id}
                          className="pb-2 border-b border-white/[0.08] flex items-center justify-between gap-2"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span
                              className={`font-score italic text-lg font-extrabold leading-none ${
                                row.rank === 1
                                  ? 'text-[#D4FF2B]'
                                  : row.rank <= 3
                                  ? 'text-[#7BB1FF]'
                                  : 'text-[#58647A]'
                              }`}
                            >
                              {String(row.rank).padStart(2, '0')}
                            </span>
                            <div className="min-w-0">
                              <div className="text-xs font-bold text-[#F4F7FB] truncate">
                                {row.player.name}
                              </div>
                              <div className="text-[10px] font-mono text-[#8E9AB2]">
                                {row.wins}W-{row.losses}L
                              </div>
                            </div>
                          </div>
                          <span
                            className={`font-score italic text-base font-extrabold shrink-0 ${
                              row.pointDiff > 0
                                ? 'text-[#22D38B]'
                                : row.pointDiff < 0
                                ? 'text-[#FF6448]'
                                : 'text-[#8E9AB2]'
                            }`}
                          >
                            {row.pointDiff > 0 ? `+${row.pointDiff}` : row.pointDiff}
                          </span>
                        </div>
                      ))}
                    </div>

                    <div className="pt-2 flex items-center justify-between text-[10px] font-mono text-[#8E9AB2]">
                      <span>
                        不重复搭档 {fairness.partnerUniquenessPct}% · 公平 {fairness.compositeScore}
                      </span>
                      <span className="text-[#D4FF2B]">PICKLEFLOW</span>
                    </div>
                  </div>
                </div>
              )}

              {/* THEME 2: ROLAND CLAY FINE-ART PRINT */}
              {theme === 'roland_clay' && (
                <div className="rounded-2xl p-3 bg-[#F4EDE2] text-[#181411] shadow-2xl">
                  <div className="border border-[#181411] p-4 space-y-4">
                    <div className="flex items-center justify-between text-[10px] font-mono tracking-wider">
                      <span className="font-bold text-[#C94A29]">
                        EDITION TERRE BATTUE // 轻转匹克画报
                      </span>
                      <span className="text-[#6B5E53]">{todayStr}</span>
                    </div>

                    <div>
                      <h3 className="text-2xl font-extrabold tracking-tight text-[#181411] leading-snug">
                        {activeCopy.coverTitle}
                      </h3>
                      <p className="text-xs text-[#6B5E53] mt-1">{activeCopy.coverSub}</p>
                    </div>

                    {/* Terracotta Architectural Court Frame */}
                    {mvp && mvp.played > 0 && (
                      <div className="relative bg-[#C94A29] text-white p-4 overflow-hidden">
                        <div
                          aria-hidden="true"
                          className="pointer-events-none absolute inset-2.5 border border-[#F4EDE2]/45"
                        />
                        <div className="relative z-10 flex items-end justify-between gap-3 py-1 px-1">
                          <div className="min-w-0">
                            <div className="text-[10px] font-mono tracking-widest text-[#F4EDE2]/90">
                              NO.01 CHAMPION · 本场 MVP
                            </div>
                            <div className="text-3xl font-extrabold mt-1 truncate">
                              {mvp.player.name}
                            </div>
                            <div className="text-[11px] font-mono text-white/90 mt-1">
                              {mvp.wins}胜 {mvp.losses}负 · 胜率 {Math.round(mvp.winRate * 100)}%
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <div className="font-score italic text-5xl font-extrabold text-[#F4EDE2] leading-none">
                              {mvp.pointDiff >= 0 ? `+${mvp.pointDiff}` : mvp.pointDiff}
                            </div>
                            <div className="text-[10px] text-[#F4EDE2]/85 mt-0.5">净胜分差</div>
                          </div>
                        </div>
                      </div>
                    )}

                    <p className="text-xs font-semibold text-[#181411] leading-relaxed">
                      “{activeCopy.mvpQuote}”
                    </p>

                    <div className="pt-2 border-t border-[#181411] space-y-2.5">
                      <div className="flex items-center justify-between text-[10px] font-mono text-[#6B5E53]">
                        <span>CLASSEMENT // 完整排名</span>
                        <span>
                          {completedMatches}/{totalMatches} · {state.config.targetScore}分制
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                        {visibleRows.map((row) => (
                          <div
                            key={row.player.id}
                            className="pb-1.5 border-b border-[#181411]/15 flex items-center justify-between gap-1.5"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span
                                className={`font-score italic text-lg font-extrabold leading-none ${
                                  row.rank === 1 ? 'text-[#C94A29]' : 'text-[#181411]'
                                }`}
                              >
                                {String(row.rank).padStart(2, '0')}
                              </span>
                              <div className="min-w-0">
                                <div className="text-xs font-bold text-[#181411] truncate">
                                  {row.player.name}
                                </div>
                                <div className="text-[10px] font-mono text-[#6B5E53]">
                                  {row.wins}W-{row.losses}L
                                </div>
                              </div>
                            </div>
                            <span
                              className={`font-score italic text-base font-extrabold shrink-0 ${
                                row.pointDiff > 0
                                  ? 'text-[#1A7A52]'
                                  : row.pointDiff < 0
                                  ? 'text-[#C94A29]'
                                  : 'text-[#6B5E53]'
                              }`}
                            >
                              {row.pointDiff > 0 ? `+${row.pointDiff}` : row.pointDiff}
                            </span>
                          </div>
                        ))}
                      </div>

                      <div className="pt-1 flex items-center justify-between text-[10px] font-mono text-[#6B5E53]">
                        <span>
                          不重复搭档 {fairness.partnerUniquenessPct}% · 公平 {fairness.compositeScore}
                        </span>
                        <span className="font-bold text-[#C94A29]">LE JOURNAL</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* THEME 3: SWISS INTERNATIONAL MATCH TICKET */}
              {theme === 'swiss_ticket' && (
                <div className="rounded-2xl overflow-hidden bg-[#ECEFF4] text-[#0A0D12] shadow-2xl">
                  <div className="bg-[#0A0D12] px-4 py-3 flex items-center justify-between text-[10px] font-mono">
                    <span className="text-[#D4FF2B] font-bold">
                      MATCH PASS // OFFICIAL TICKET
                    </span>
                    <span className="text-white">NO.{todayStr.replace(/\./g, '')}</span>
                  </div>

                  <div className="p-4 space-y-4">
                    {/* Royal Cobalt Hero Block */}
                    <div className="bg-[#133EE6] text-white p-4 space-y-3">
                      <div className="text-[10px] font-mono text-white/80">
                        {FORMAT_LABELS[state.config.format]} · {state.config.targetScore}分制
                      </div>
                      <h3 className="text-xl font-extrabold leading-snug">
                        {activeCopy.coverTitle}
                      </h3>
                      {mvp && mvp.played > 0 && (
                        <div className="pt-3 border-t border-white/25 flex items-end justify-between gap-2">
                          <div className="min-w-0">
                            <div className="text-[10px] font-mono text-[#D4FF2B] font-bold">
                              MVP LEADER
                            </div>
                            <div className="text-2xl font-extrabold truncate">
                              {mvp.player.name}
                            </div>
                          </div>
                          <div className="font-score italic text-4xl font-extrabold text-[#D4FF2B] leading-none">
                            {mvp.pointDiff >= 0 ? `+${mvp.pointDiff}` : mvp.pointDiff}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Dashed Ticket Perforation Line */}
                    <div className="border-t-2 border-dashed border-[#0A0D12]/60" />

                    <p className="text-xs font-semibold text-[#0A0D12] leading-relaxed">
                      “{activeCopy.mvpQuote}”
                    </p>

                    {/* Strict Swiss Grid Metadata Cells */}
                    <div className="grid grid-cols-3 border border-[#0A0D12] divide-x divide-[#0A0D12]">
                      <div className="p-2">
                        <div className="text-[9px] font-mono font-bold text-[#536073]">MATCHES</div>
                        <div className="font-score italic text-lg font-extrabold leading-tight">
                          {completedMatches}/{totalMatches}
                        </div>
                      </div>
                      <div className="p-2">
                        <div className="text-[9px] font-mono font-bold text-[#536073]">
                          UNIQUE PAIR
                        </div>
                        <div className="font-score italic text-lg font-extrabold leading-tight">
                          {fairness.partnerUniquenessPct}%
                        </div>
                      </div>
                      <div className="p-2">
                        <div className="text-[9px] font-mono font-bold text-[#536073]">
                          FAIRNESS
                        </div>
                        <div className="font-score italic text-lg font-extrabold leading-tight">
                          {fairness.compositeScore} PTS
                        </div>
                      </div>
                    </div>

                    {/* 2-Column Clean Ink Ledger */}
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                      {visibleRows.map((row) => (
                        <div
                          key={row.player.id}
                          className="pb-1.5 border-b border-[#0A0D12]/15 flex items-center justify-between gap-1.5"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span
                              className={`font-score italic text-lg font-extrabold leading-none ${
                                row.rank === 1 ? 'text-[#133EE6]' : 'text-[#0A0D12]'
                              }`}
                            >
                              {String(row.rank).padStart(2, '0')}
                            </span>
                            <div className="min-w-0">
                              <div className="text-xs font-bold text-[#0A0D12] truncate">
                                {row.player.name}
                              </div>
                              <div className="text-[10px] font-mono text-[#536073]">
                                {row.wins}W-{row.losses}L
                              </div>
                            </div>
                          </div>
                          <span
                            className={`font-score italic text-base font-extrabold shrink-0 ${
                              row.pointDiff > 0
                                ? 'text-[#0E8A58]'
                                : row.pointDiff < 0
                                ? 'text-[#D93B26]'
                                : 'text-[#536073]'
                            }`}
                          >
                            {row.pointDiff > 0 ? `+${row.pointDiff}` : row.pointDiff}
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* Ticket Barcode Footer */}
                    <div className="pt-2 flex items-center justify-between gap-3">
                      <div className="flex items-stretch gap-[2px] h-7" aria-hidden="true">
                        {[2, 1, 3, 1, 2, 1, 4, 1, 2, 1, 3, 2, 1, 2, 3, 1, 2].map((w, idx) => (
                          <span
                            key={idx}
                            className="bg-[#0A0D12] h-full"
                            style={{ width: `${w * 2}px` }}
                          />
                        ))}
                      </div>
                      <div className="text-right">
                        <div className="text-[10px] font-mono font-bold text-[#0A0D12]">
                          轻转匹克 · ADMIT ONE
                        </div>
                        <div className="text-[10px] text-[#536073] truncate max-w-[140px]">
                          {state.config.venue || '夜场硬地匹克球'}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : (
            <pre className="p-4 rounded-2xl bg-[#0A0E16] border border-white/[0.08] text-xs sm:text-sm font-mono leading-relaxed text-[#E2E8F5] whitespace-pre-wrap select-all">
              {reportText}
            </pre>
          )}
        </div>

        {/* Bottom Primary CTA Row */}
        <div className="pt-4 grid grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={handleDownloadPoster}
            disabled={downloading}
            className="min-h-[48px] px-3 rounded-xl bg-[#D4FF2B] text-[#080B10] text-sm font-bold hover:bg-[#E1FF61] active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60"
          >
            {downloading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                <span>渲染高清图中…</span>
              </>
            ) : downloaded ? (
              <>
                <Check className="w-4 h-4" aria-hidden="true" />
                <span>已保存高清画报</span>
              </>
            ) : (
              <>
                <Download className="w-4 h-4" aria-hidden="true" />
                <span>保存 2× 高清画报</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleCopyText}
            className="min-h-[48px] px-3 rounded-xl bg-white/[0.08] border border-white/[0.1] text-[#F4F7FB] text-sm font-semibold hover:bg-white/[0.14] active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 cursor-pointer"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4 text-[#22D38B]" aria-hidden="true" />
                <span>已复制文字</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" aria-hidden="true" />
                <span>复制文字战报</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
