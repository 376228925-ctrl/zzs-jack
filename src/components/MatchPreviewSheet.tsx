import { useEffect, useState } from 'react';
import { RefreshCw, Sparkles, X } from 'lucide-react';
import type { Match, Player, PlayerStanding } from '../types/tournament';
import {
  buildMatchPreviewPayload,
  type AnalyzeApiResponse,
  type MatchPreviewResult,
} from '../utils/aiAnalysis';

interface MatchPreviewSheetProps {
  match: Match | null;
  playerMap: Map<string, Player>;
  standings: PlayerStanding[];
  targetScore: number;
  onClose: () => void;
}

export function MatchPreviewSheet({
  match,
  playerMap,
  standings,
  targetScore,
  onClose,
}: MatchPreviewSheetProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<MatchPreviewResult | null>(null);
  const [usedModel, setUsedModel] = useState<string | null>(null);

  const runPreview = async (targetMatch: Match) => {
    setLoading(true);
    setError(null);
    setData(null);
    try {
      const context = buildMatchPreviewPayload(targetMatch, playerMap, standings, targetScore);
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'match', context }),
      });
      const json = (await res.json()) as AnalyzeApiResponse<MatchPreviewResult>;
      if (!res.ok || !json.ok || !json.data) {
        throw new Error(json.error || '战术预测请求失败');
      }
      setData(json.data);
      setUsedModel(json.model ?? 'deepseek-v4.1-flash');
    } catch (err) {
      setError(err instanceof Error ? err.message : '分析请求异常');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!match) return;
    runPreview(match);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [match?.id]);

  if (!match) return null;

  const teamANames = match.teamA.map((id) => playerMap.get(id)?.name ?? '球友').join(' / ');
  const teamBNames = match.teamB.map((id) => playerMap.get(id)?.name ?? '球友').join(' / ');

  const probA = data ? Math.max(20, Math.min(80, Math.round(data.winProbA))) : 50;
  const probB = 100 - probA;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/75 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="match-preview-title"
      onClick={onClose}
    >
      <div
        className="w-full md:max-w-lg bg-[#111620] text-[#F4F7FB] rounded-t-3xl md:rounded-3xl overflow-hidden shadow-2xl border border-white/[0.1] max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-gradient-to-r from-[#0E2457] via-[#13337D] to-[#111620] text-white px-5 pt-3 pb-4 border-b border-white/[0.08]">
          <div className="md:hidden w-10 h-1.5 bg-white/25 rounded-full mx-auto mb-3" aria-hidden="true" />
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#D4FF2B]">
                <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
                <span>DeepSeek 赛前战术预测</span>
                {usedModel && <span className="text-white/70 font-mono">· {usedModel}</span>}
              </div>
              <h2 id="match-preview-title" className="text-lg font-extrabold mt-0.5">
                第 {match.roundNumber} 轮 · {String(match.courtNumber).padStart(2, '0')}号场
              </h2>
              <p className="text-xs text-[#B8C4DA] mt-0.5">
                {teamANames} vs {teamBNames}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="关闭战术预测"
              className="min-h-[44px] min-w-[44px] -mr-2 -mt-2 flex items-center justify-center rounded-xl text-white/75 hover:bg-white/10 hover:text-white cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-5 pb-safe overflow-y-auto space-y-4">
          {loading && (
            <div className="space-y-3 py-6 text-center" aria-busy="true">
              <RefreshCw className="w-6 h-6 text-[#D4FF2B] animate-spin mx-auto" aria-hidden="true" />
              <p className="text-sm font-medium text-[#D8E1F0]">
                正在推演双方 DUPR 实力差与近期手感…
              </p>
            </div>
          )}

          {!loading && error && (
            <div
              role="alert"
              className="rounded-2xl bg-[#2C1414] border border-[#FF6448]/35 text-[#FF9B89] p-4 text-xs sm:text-sm space-y-2"
            >
              <p>{error}</p>
              <button
                type="button"
                onClick={() => runPreview(match)}
                className="font-bold underline cursor-pointer text-white"
              >
                重新分析
              </button>
            </div>
          )}

          {!loading && data && (
            <div className="space-y-4">
              {/* Win Probability Bar */}
              <div className="rounded-2xl bg-[#171E2B] border border-white/[0.07] p-4 space-y-2.5">
                <div className="flex items-baseline justify-between gap-2 text-xs font-bold">
                  <span className="text-[#D4FF2B] truncate">
                    A队 {teamANames} · <span className="font-score italic text-xl">{probA}%</span>
                  </span>
                  <span className="text-[#7BB1FF] truncate text-right">
                    <span className="font-score italic text-xl">{probB}%</span> · B队 {teamBNames}
                  </span>
                </div>
                <div className="h-2.5 w-full rounded-full overflow-hidden flex bg-[#0A0E16]">
                  <div
                    className="h-full bg-[#D4FF2B] transition-all duration-300"
                    style={{ width: `${probA}%` }}
                  />
                  <div
                    className="h-full bg-[#3B82F6] transition-all duration-300"
                    style={{ width: `${probB}%` }}
                  />
                </div>
              </div>

              {/* Key Matchup */}
              <div className="space-y-1">
                <h3 className="text-xs font-bold text-[#8E9AB2]">本场核心胜负手</h3>
                <p className="text-sm text-[#F4F7FB] leading-relaxed">{data.keyMatchup}</p>
              </div>

              {/* Team A & Team B Tips */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="rounded-2xl bg-[#171E2B] border border-[#D4FF2B]/25 p-3.5 space-y-1">
                  <div className="text-xs font-bold text-[#D4FF2B]">A队战术锦囊</div>
                  <p className="text-xs text-[#D8E1F0] leading-relaxed">{data.teamATip}</p>
                </div>
                <div className="rounded-2xl bg-[#171E2B] border border-[#5C93FF]/25 p-3.5 space-y-1">
                  <div className="text-xs font-bold text-[#7BB1FF]">B队战术锦囊</div>
                  <p className="text-xs text-[#D8E1F0] leading-relaxed">{data.teamBTip}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
