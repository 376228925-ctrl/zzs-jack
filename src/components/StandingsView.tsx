import { useState } from 'react';
import { Award, ChevronRight, Sparkles } from 'lucide-react';
import type {
  Player,
  PlayerStanding,
  ScheduleFairnessReport,
  TournamentState,
} from '../types/tournament';
import { AiAnalysisPanel } from './AiAnalysisPanel';
import { PlayerDetailContent, PlayerDetailSheet } from './PlayerDetailSheet';

interface StandingsViewProps {
  state: TournamentState;
  standings: PlayerStanding[];
  fairness: ScheduleFairnessReport;
  playerMap: Map<string, Player>;
  completedMatches: number;
  totalMatches: number;
  onOpenReport: () => void;
}

export function StandingsView({
  state,
  standings,
  fairness,
  playerMap,
  completedMatches,
  totalMatches,
  onOpenReport,
}: StandingsViewProps) {
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(
    standings[0]?.player.id ?? null
  );
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);

  const selectedStanding =
    standings.find((s) => s.player.id === selectedPlayerId) ?? standings[0] ?? null;

  const topThree = standings.slice(0, 3);

  return (
    <div className="space-y-6">
      {/* Header Row */}
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-[#F4F7FB]">实时积分榜</h1>
          <p className="text-xs sm:text-sm text-[#8E9AB2] mt-1">
            胜场 · 胜率 · 净胜分 · 总得分 · 已完赛{' '}
            <span className="font-mono tabular-nums text-[#D4FF2B]">
              {completedMatches}/{totalMatches}
            </span>{' '}
            场
          </p>
        </div>
        <button
          type="button"
          onClick={onOpenReport}
          className="hidden sm:inline-flex min-h-[44px] px-4 rounded-xl bg-[#D4FF2B] text-[#080B10] text-sm font-bold hover:bg-[#E1FF61] active:scale-[0.98] transition-all items-center justify-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Sparkles className="w-4 h-4" aria-hidden="true" />
          <span>生成战报海报</span>
        </button>
      </div>

      {/* Grand Slam Championship Podium */}
      {topThree.length > 0 && (
        <section aria-label="前三名领奖台" className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
          {topThree.map((item, idx) => {
            const isFirst = idx === 0;
            const rankLabels = ['NO.01 · 本场 MVP 领跑', 'NO.02 · 榜眼', 'NO.03 · 探花'];
            return (
              <button
                key={item.player.id}
                type="button"
                onClick={() => {
                  setSelectedPlayerId(item.player.id);
                  setMobileSheetOpen(true);
                }}
                className={`relative rounded-3xl p-5 text-left overflow-hidden transition-all cursor-pointer active:scale-[0.99] border ${
                  isFirst
                    ? 'bg-gradient-to-br from-[#12368A] via-[#0E2457] to-[#111620] border-[#D4FF2B]/60 text-white'
                    : 'bg-[#111620] border-white/[0.08] text-[#F4F7FB] hover:border-white/25'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={`text-xs font-bold font-mono ${
                      isFirst ? 'text-[#D4FF2B]' : 'text-[#8E9AB2]'
                    }`}
                  >
                    {rankLabels[idx]}
                  </span>
                  {isFirst && <Award className="w-4 h-4 text-[#D4FF2B]" aria-hidden="true" />}
                </div>
                <div className="mt-3 flex items-baseline justify-between gap-2">
                  <span className="text-xl font-extrabold truncate">{item.player.name}</span>
                  <span
                    className={`font-score italic text-4xl font-extrabold leading-none ${
                      isFirst
                        ? 'text-[#D4FF2B]'
                        : item.pointDiff >= 0
                        ? 'text-[#22D38B]'
                        : 'text-[#FF6448]'
                    }`}
                  >
                    {item.pointDiff > 0 ? `+${item.pointDiff}` : item.pointDiff}
                  </span>
                </div>
                <div
                  className={`mt-2.5 text-xs font-mono tabular-nums flex items-center gap-2 ${
                    isFirst ? 'text-white/80' : 'text-[#8E9AB2]'
                  }`}
                >
                  <span>
                    {item.wins}胜 {item.losses}负
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>
                    胜率 {item.played > 0 ? `${Math.round(item.winRate * 100)}%` : '--'}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>DUPR {item.player.rating.toFixed(1)}</span>
                </div>
              </button>
            );
          })}
        </section>
      )}

      {/* DeepSeek AI Tournament Intelligence Panel */}
      <AiAnalysisPanel state={state} standings={standings} fairness={fairness} />

      {/* Main Split: Left Standings Table + Right Desktop Player Detail */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <section className="lg:col-span-8 bg-[#111620] rounded-3xl border border-white/[0.08] overflow-hidden">
          <div className="grid grid-cols-[32px_minmax(96px,1fr)_52px_54px_48px_18px] sm:grid-cols-[56px_1fr_92px_88px_88px_32px] items-center gap-1 sm:gap-2 px-3 sm:px-5 py-3 bg-[#161D2A] border-b border-white/[0.06] text-xs font-semibold text-[#8E9AB2]">
            <span className="text-center">#</span>
            <span>球员</span>
            <span className="text-right">胜负</span>
            <span className="text-right">净胜</span>
            <span className="text-right">胜率</span>
            <span aria-hidden="true" />
          </div>

          <div className="divide-y divide-white/[0.06]">
            {standings.map((row) => {
              const isSelected = selectedStanding?.player.id === row.player.id;
              return (
                <button
                  key={row.player.id}
                  type="button"
                  onClick={() => {
                    setSelectedPlayerId(row.player.id);
                    setMobileSheetOpen(true);
                  }}
                  aria-label={`查看 ${row.player.name} 详细战绩，第${row.rank}名`}
                  className={`w-full min-h-[64px] grid grid-cols-[32px_minmax(96px,1fr)_52px_54px_48px_18px] sm:grid-cols-[56px_1fr_92px_88px_88px_32px] items-center gap-1 sm:gap-2 px-3 sm:px-5 py-3 text-left transition-colors cursor-pointer ${
                    isSelected ? 'bg-[#192338]' : 'hover:bg-white/[0.03]'
                  }`}
                >
                  <span
                    className={`font-score italic text-xl font-extrabold text-center ${
                      row.rank === 1
                        ? 'text-[#D4FF2B]'
                        : row.rank <= 3
                        ? 'text-[#7BB1FF]'
                        : 'text-[#66738D]'
                    }`}
                  >
                    {String(row.rank).padStart(2, '0')}
                  </span>

                  <div className="min-w-0 pr-1">
                    <div className="font-semibold text-sm text-[#F4F7FB] truncate">
                      {row.player.name}
                      {!row.player.active && (
                        <span className="ml-1 text-xs font-normal text-[#8E9AB2]">(暂离)</span>
                      )}
                    </div>
                    <div className="text-[11px] sm:text-xs text-[#8E9AB2] font-mono tabular-nums whitespace-nowrap">
                      DUPR {row.player.rating.toFixed(1)}
                      <span className="hidden sm:inline"> · 得{row.pointsFor}分</span>
                    </div>
                  </div>

                  <span className="font-mono tabular-nums text-sm font-semibold text-[#F4F7FB] text-right whitespace-nowrap">
                    {row.wins}-{row.losses}
                  </span>

                  <span
                    className={`font-score italic text-2xl font-extrabold text-right whitespace-nowrap ${
                      row.pointDiff > 0
                        ? 'text-[#22D38B]'
                        : row.pointDiff < 0
                        ? 'text-[#FF6448]'
                        : 'text-[#8E9AB2]'
                    }`}
                  >
                    {row.pointDiff > 0 ? `+${row.pointDiff}` : row.pointDiff}
                  </span>

                  <span className="font-mono tabular-nums text-xs sm:text-sm text-[#8E9AB2] text-right whitespace-nowrap">
                    {row.played > 0 ? `${Math.round(row.winRate * 100)}%` : '--'}
                  </span>

                  <ChevronRight className="w-4 h-4 text-[#66738D] justify-self-end" aria-hidden="true" />
                </button>
              );
            })}
          </div>
        </section>

        {/* Desktop Side Panel for Selected Player */}
        <aside className="hidden lg:block lg:col-span-4 bg-[#111620] rounded-3xl border border-white/[0.08] p-5 sticky top-24">
          {selectedStanding ? (
            <PlayerDetailContent
              standing={selectedStanding}
              state={state}
              playerMap={playerMap}
            />
          ) : (
            <p className="text-sm text-[#8E9AB2]">选择左侧任意球员查看详细战绩</p>
          )}
        </aside>
      </div>

      {/* Mobile Player Detail Bottom Sheet */}
      {mobileSheetOpen && (
        <PlayerDetailSheet
          standing={selectedStanding}
          state={state}
          playerMap={playerMap}
          onClose={() => setMobileSheetOpen(false)}
        />
      )}
    </div>
  );
}
