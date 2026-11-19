import { useState } from 'react';
import { Check, Copy, RefreshCw, Sparkles } from 'lucide-react';
import type {
  PlayerStanding,
  ScheduleFairnessReport,
  TournamentState,
} from '../types/tournament';
import {
  buildTournamentAnalysisPayload,
  type AnalyzeApiResponse,
  type TournamentAnalysisResult,
} from '../utils/aiAnalysis';

interface AiAnalysisPanelProps {
  state: TournamentState;
  standings: PlayerStanding[];
  fairness: ScheduleFairnessReport;
}

export function AiAnalysisPanel({ state, standings, fairness }: AiAnalysisPanelProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<TournamentAnalysisResult | null>(null);
  const [usedModel, setUsedModel] = useState<string | null>(null);
  const [copiedSummary, setCopiedSummary] = useState(false);

  const handleAnalyze = async () => {
    setLoading(true);
    setError(null);
    try {
      const context = buildTournamentAnalysisPayload(state, standings, fairness);
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'tournament', context }),
      });

      const json = (await res.json()) as AnalyzeApiResponse<TournamentAnalysisResult>;
      if (!res.ok || !json.ok || !json.data) {
        throw new Error(json.error || '分析请求失败，请稍后重试');
      }

      setResult(json.data);
      setUsedModel(json.model ?? 'deepseek-v4.1-flash');
    } catch (err) {
      setError(err instanceof Error ? err.message : '分析请求异常，请检查网络');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyGroupSummary = async () => {
    if (!result?.groupSummary) return;
    try {
      await navigator.clipboard.writeText(result.groupSummary);
    } catch {
      const el = document.createElement('textarea');
      el.value = result.groupSummary;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
    }
    setCopiedSummary(true);
    setTimeout(() => setCopiedSummary(false), 2000);
  };

  return (
    <section
      aria-label="DeepSeek 智能赛况复盘"
      className="bg-[#111620] rounded-3xl border border-white/[0.08] overflow-hidden"
    >
      {/* Header Strip */}
      <div className="px-5 py-4 bg-gradient-to-r from-[#161F31] to-[#111620] border-b border-white/[0.07] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#D4FF2B]" aria-hidden="true" />
            <h2 className="text-base font-bold text-[#F4F7FB]">DeepSeek 赛况智析</h2>
            {usedModel && (
              <span className="text-[11px] font-mono text-[#8E9AB2]">· {usedModel}</span>
            )}
          </div>
          <p className="text-xs text-[#8E9AB2]">
            结合实打比分、DUPR 实力差与搭档化学反应，生成专业赛事复盘与技战术建议
          </p>
        </div>

        <button
          type="button"
          onClick={handleAnalyze}
          disabled={loading}
          className="min-h-[44px] px-4 rounded-xl bg-[#D4FF2B] text-[#080B10] text-sm font-bold hover:bg-[#E1FF61] disabled:opacity-55 active:scale-[0.98] transition-all inline-flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
        >
          <RefreshCw
            className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`}
            aria-hidden="true"
          />
          <span>{loading ? '正在深度复盘…' : result ? '刷新智析' : '生成智能复盘'}</span>
        </button>
      </div>

      {/* Body */}
      <div className="p-5">
        {loading && (
          <div className="space-y-3 py-2" aria-busy="true">
            <div className="h-5 w-2/3 rounded-lg bg-white/[0.08] animate-pulse" />
            <div className="h-4 w-full rounded-lg bg-white/[0.05] animate-pulse" />
            <div className="h-4 w-5/6 rounded-lg bg-white/[0.05] animate-pulse" />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
              <div className="h-20 rounded-2xl bg-white/[0.05] animate-pulse" />
              <div className="h-20 rounded-2xl bg-white/[0.05] animate-pulse" />
              <div className="h-20 rounded-2xl bg-white/[0.05] animate-pulse" />
            </div>
          </div>
        )}

        {!loading && error && (
          <div
            role="alert"
            className="rounded-2xl bg-[#2C1414] border border-[#FF6448]/35 text-[#FF9B89] px-4 py-3 text-xs sm:text-sm flex items-center justify-between gap-3"
          >
            <span>{error}</span>
            <button
              type="button"
              onClick={handleAnalyze}
              className="font-semibold underline whitespace-nowrap shrink-0 cursor-pointer text-white"
            >
              重试
            </button>
          </div>
        )}

        {!loading && !error && !result && (
          <div className="text-xs sm:text-sm text-[#8E9AB2]">
            点击「生成智能复盘」，即可获取 MVP 球评、黑马洞察、最佳拍档分析与群聊战报点评。
          </div>
        )}

        {!loading && result && (
          <div className="space-y-5">
            {/* Editorial Headline */}
            <div className="pb-4 border-b border-white/[0.07]">
              <p className="text-xs font-bold text-[#D4FF2B] mb-1">本场核心结论</p>
              <h3 className="text-lg sm:text-xl font-extrabold text-[#F4F7FB]">
                {result.headline}
              </h3>
            </div>

            {/* Three Structured Insights */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
              <div className="rounded-2xl bg-[#171E2B] border border-white/[0.06] p-4 space-y-1.5">
                <div className="text-xs font-bold text-[#D4FF2B]">MVP 表现球评</div>
                <p className="text-xs sm:text-sm text-[#D8E1F0] leading-relaxed">
                  {result.mvpComment}
                </p>
              </div>
              <div className="rounded-2xl bg-[#171E2B] border border-white/[0.06] p-4 space-y-1.5">
                <div className="text-xs font-bold text-[#22D38B]">黑马与实力突破</div>
                <p className="text-xs sm:text-sm text-[#D8E1F0] leading-relaxed">
                  {result.darkHorse}
                </p>
              </div>
              <div className="rounded-2xl bg-[#171E2B] border border-white/[0.06] p-4 space-y-1.5">
                <div className="text-xs font-bold text-[#7BB1FF]">搭档化学反应</div>
                <p className="text-xs sm:text-sm text-[#D8E1F0] leading-relaxed">
                  {result.chemistryHighlight}
                </p>
              </div>
            </div>

            {/* Tactical Tips */}
            {Array.isArray(result.tacticalTips) && result.tacticalTips.length > 0 && (
              <div className="space-y-2.5 pt-1">
                <h4 className="text-xs font-bold text-[#8E9AB2]">匹克球技战术建议</h4>
                <ol className="space-y-2">
                  {result.tacticalTips.map((tip, idx) => (
                    <li
                      key={idx}
                      className="flex items-start gap-2.5 text-xs sm:text-sm text-[#E5ECF7]"
                    >
                      <span className="font-score italic text-lg font-extrabold text-[#D4FF2B] leading-tight shrink-0">
                        0{idx + 1}.
                      </span>
                      <span className="leading-relaxed">{tip}</span>
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {/* WeChat Group Commentary Snippet */}
            {result.groupSummary && (
              <div className="rounded-2xl bg-[#0B1733] border border-[#3B71E8]/35 text-white p-4 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-[#D4FF2B]">
                    微信球友群趣味战报点评
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyGroupSummary}
                    className="min-h-[34px] px-3 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-semibold text-white inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    {copiedSummary ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-[#D4FF2B]" aria-hidden="true" />
                        <span>已复制</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-[#D4FF2B]" aria-hidden="true" />
                        <span>复制点评</span>
                      </>
                    )}
                  </button>
                </div>
                <p className="text-xs sm:text-sm text-[#D8E1F0] leading-relaxed">
                  {result.groupSummary}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
