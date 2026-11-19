import { useEffect, useState } from 'react';
import { RefreshCw, Sparkles, X } from 'lucide-react';
import type { Player, PlayerStanding, TournamentState } from '../types/tournament';
import {
  buildPlayerScoutPayload,
  type AnalyzeApiResponse,
  type PlayerScoutResult,
} from '../utils/aiAnalysis';
import { getPlayerScheduleTimeline } from '../utils/scheduler';

interface PlayerDetailContentProps {
  standing: PlayerStanding;
  state: TournamentState;
  playerMap: Map<string, Player>;
}

export function PlayerDetailContent({
  standing,
  state,
  playerMap,
}: PlayerDetailContentProps) {
  const [scoutLoading, setScoutLoading] = useState(false);
  const [scoutError, setScoutError] = useState<string | null>(null);
  const [scoutData, setScoutData] = useState<PlayerScoutResult | null>(null);

  useEffect(() => {
    setScoutData(null);
    setScoutError(null);
    setScoutLoading(false);
  }, [standing.player.id]);

  const timeline = getPlayerScheduleTimeline(standing.player.id, state.rounds, playerMap);

  const handleGenerateScout = async () => {
    setScoutLoading(true);
    setScoutError(null);
    try {
      const context = buildPlayerScoutPayload(standing, state);
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'player', context }),
      });
      const json = (await res.json()) as AnalyzeApiResponse<PlayerScoutResult>;
      if (!res.ok || !json.ok || !json.data) {
        throw new Error(json.error || '球探报告生成失败');
      }
      setScoutData(json.data);
    } catch (err) {
      setScoutError(err instanceof Error ? err.message : '分析请求异常');
    } finally {
      setScoutLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-11 h-11 rounded-2xl bg-[#D4FF2B] text-[#080B10] font-extrabold text-lg flex items-center justify-center shrink-0">
            {standing.player.name.slice(0, 1)}
          </div>
          <div className="min-w-0">
            <h3 className="text-lg font-extrabold text-[#F4F7FB] truncate">{standing.player.name}</h3>
            <p className="text-xs text-[#8E9AB2] mt-0.5 font-mono tabular-nums">
              第 {standing.rank} 名 · DUPR {standing.player.rating.toFixed(1)}
              {!standing.player.active ? ' · 已暂离' : ''}
            </p>
          </div>
        </div>
        <div className="text-right shrink-0">
          <span className="font-score italic text-3xl font-extrabold text-[#D4FF2B] leading-none">
            {standing.played > 0 ? `${Math.round(standing.winRate * 100)}%` : '--'}
          </span>
          <div className="text-[11px] text-[#8E9AB2]">胜率</div>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-3 gap-2.5">
        <div className="bg-[#171E2B] border border-white/[0.06] rounded-2xl p-3 text-center">
          <div className="text-[11px] text-[#8E9AB2]">胜 / 负</div>
          <div className="font-score italic text-2xl font-extrabold text-[#F4F7FB] mt-0.5 leading-tight">
            {standing.wins}-{standing.losses}
          </div>
        </div>
        <div className="bg-[#171E2B] border border-white/[0.06] rounded-2xl p-3 text-center">
          <div className="text-[11px] text-[#8E9AB2]">净胜分</div>
          <div
            className={`font-score italic text-2xl font-extrabold mt-0.5 leading-tight ${
              standing.pointDiff > 0
                ? 'text-[#22D38B]'
                : standing.pointDiff < 0
                ? 'text-[#FF6448]'
                : 'text-[#F4F7FB]'
            }`}
          >
            {standing.pointDiff > 0 ? `+${standing.pointDiff}` : standing.pointDiff}
          </div>
        </div>
        <div className="bg-[#171E2B] border border-white/[0.06] rounded-2xl p-3 text-center">
          <div className="text-[11px] text-[#8E9AB2]">场均得分</div>
          <div className="font-score italic text-2xl font-extrabold text-[#F4F7FB] mt-0.5 leading-tight">
            {standing.played > 0 ? standing.avgPointsFor.toFixed(1) : '0.0'}
          </div>
        </div>
      </div>

      {/* DeepSeek Personal Scout Report */}
      <div className="rounded-2xl bg-[#161F31] border border-[#D4FF2B]/25 p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-xs font-bold text-[#F4F7FB]">
            <Sparkles className="w-3.5 h-3.5 text-[#D4FF2B]" aria-hidden="true" />
            <span>AI 个人球探报告</span>
          </div>
          <button
            type="button"
            onClick={handleGenerateScout}
            disabled={scoutLoading}
            className="min-h-[34px] px-3 rounded-lg bg-[#D4FF2B] text-[#080B10] text-xs font-bold hover:bg-[#E1FF61] disabled:opacity-50 inline-flex items-center gap-1 cursor-pointer"
          >
            <RefreshCw className={`w-3 h-3 ${scoutLoading ? 'animate-spin' : ''}`} aria-hidden="true" />
            <span>{scoutLoading ? '生成中…' : scoutData ? '重新诊断' : '生成诊断'}</span>
          </button>
        </div>

        {scoutError && <p className="text-xs text-[#FF8B73]">{scoutError}</p>}

        {!scoutLoading && !scoutData && !scoutError && (
          <p className="text-xs text-[#9AA5BC]">
            基于 {standing.player.name} 的实打比分与搭档数据，输出专属技战术诊断与下轮建议。
          </p>
        )}

        {scoutData && (
          <div className="space-y-2 text-xs leading-relaxed text-[#D8E1F0]">
            <p className="font-semibold text-white">{scoutData.summary}</p>
            <p>
              <strong className="text-[#22D38B]">核心优势：</strong>
              {scoutData.strength}
            </p>
            <p>
              <strong className="text-[#D4FF2B]">下轮提分：</strong>
              {scoutData.improvement}
            </p>
            <p>
              <strong className="text-[#7BB1FF]">搭档建议：</strong>
              {scoutData.bestPartnerAdvice}
            </p>
          </div>
        )}
      </div>

      {/* Match-by-Match Log */}
      <div>
        <h4 className="text-xs font-bold text-[#8E9AB2] mb-2">逐轮对阵与战绩</h4>
        <div className="divide-y divide-white/[0.06] border-t border-b border-white/[0.06]">
          {timeline.map((item) => (
            <div
              key={item.roundNumber}
              className="py-2.5 flex items-center justify-between gap-2 text-xs"
            >
              <div className="min-w-0">
                <span className="font-mono tabular-nums font-bold text-[#D4FF2B] mr-2">
                  R{item.roundNumber}
                </span>
                {item.status === 'resting' ? (
                  <span className="text-[#8E9AB2]">本轮轮空休息</span>
                ) : (
                  <span className="text-[#E2E8F5]">
                    搭档 <strong className="font-semibold text-white">{item.partnerName}</strong>
                    <span className="text-[#8E9AB2]">
                      {' '}
                      vs {item.opponentNames?.[0]}/{item.opponentNames?.[1]}
                    </span>
                  </span>
                )}
              </div>

              <div className="font-mono tabular-nums font-bold shrink-0">
                {item.status === 'win' ? (
                  <span className="text-[#22D38B]">
                    胜 {item.myScore}:{item.oppScore}
                  </span>
                ) : item.status === 'loss' ? (
                  <span className="text-[#FF6448]">
                    负 {item.myScore}:{item.oppScore}
                  </span>
                ) : item.status === 'pending' ? (
                  <span className="text-[#7BB1FF]">{item.courtNumber}号场</span>
                ) : (
                  <span className="text-[#66738D]">--</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Partner Chemistry */}
      {standing.partnerRecords.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-bold text-[#8E9AB2]">搭档默契榜</h4>
            {standing.bestPartner && (
              <span className="text-xs font-semibold text-[#D4FF2B]">
                最佳拍档：{standing.bestPartner.partnerName}
              </span>
            )}
          </div>
          <div className="divide-y divide-white/[0.06] border-t border-b border-white/[0.06]">
            {standing.partnerRecords.map((rec) => (
              <div
                key={rec.partnerId}
                className="py-2 flex items-center justify-between text-xs"
              >
                <span className="font-semibold text-[#F4F7FB]">{rec.partnerName}</span>
                <div className="flex items-center gap-3 font-mono tabular-nums">
                  <span className="text-[#8E9AB2]">
                    {rec.wins}胜 / {rec.games}场
                  </span>
                  <span
                    className={`font-bold w-8 text-right ${
                      rec.pointDiff >= 0 ? 'text-[#22D38B]' : 'text-[#FF6448]'
                    }`}
                  >
                    {rec.pointDiff > 0 ? `+${rec.pointDiff}` : rec.pointDiff}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

interface PlayerDetailSheetProps {
  standing: PlayerStanding | null;
  state: TournamentState;
  playerMap: Map<string, Player>;
  onClose: () => void;
}

export function PlayerDetailSheet({
  standing,
  state,
  playerMap,
  onClose,
}: PlayerDetailSheetProps) {
  if (!standing) return null;

  return (
    <div
      className="lg:hidden fixed inset-0 z-50 flex items-end justify-center bg-black/75 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={`${standing.player.name} 战绩详情`}
      onClick={onClose}
    >
      <div
        className="w-full bg-[#111620] text-[#F4F7FB] rounded-t-3xl p-5 pb-safe shadow-2xl border-t border-white/[0.1] max-h-[88vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-10 h-1.5 bg-white/20 rounded-full mx-auto mb-3" aria-hidden="true" />
        <div className="flex justify-end -mb-2">
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭球员战绩"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-[#8E9AB2] hover:bg-white/[0.08] hover:text-white cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <PlayerDetailContent standing={standing} state={state} playerMap={playerMap} />
      </div>
    </div>
  );
}
