import { ArrowLeftRight, CheckCircle2, Edit3, Sparkles } from 'lucide-react';
import type { Match, Player } from '../types/tournament';
import { calculateMatchBalance } from '../utils/scheduler';

interface MatchCardProps {
  match: Match;
  playerMap: Map<string, Player>;
  swapMode: boolean;
  selectedSwapPlayerId: string | null;
  focusedPlayerId: string | null;
  onOpenScore: (match: Match) => void;
  onOpenAiPreview: (match: Match) => void;
  onSelectSwapPlayer: (playerId: string) => void;
}

function genderText(gender: Player['gender']): string {
  if (gender === 'M') return '男';
  if (gender === 'F') return '女';
  return '';
}

export function MatchCard({
  match,
  playerMap,
  swapMode,
  selectedSwapPlayerId,
  focusedPlayerId,
  onOpenScore,
  onOpenAiPreview,
  onSelectSwapPlayer,
}: MatchCardProps) {
  const isCompleted =
    match.status === 'completed' && match.scoreA !== null && match.scoreB !== null;
  const winnerA = isCompleted && (match.scoreA ?? 0) > (match.scoreB ?? 0);
  const winnerB = isCompleted && (match.scoreB ?? 0) > (match.scoreA ?? 0);
  const balance = calculateMatchBalance(match, playerMap);

  const focusedInA = focusedPlayerId ? match.teamA.includes(focusedPlayerId) : false;
  const focusedInB = focusedPlayerId ? match.teamB.includes(focusedPlayerId) : false;
  const isMatchFocused = focusedInA || focusedInB;
  const dimmedByFocus = Boolean(focusedPlayerId) && !isMatchFocused;

  const getRelationTag = (playerId: string, side: 'A' | 'B'): string | null => {
    if (!focusedPlayerId || !isMatchFocused) return null;
    if (playerId === focusedPlayerId) return '我';
    const sameSide = (side === 'A' && focusedInA) || (side === 'B' && focusedInB);
    return sameSide ? '搭档' : '对手';
  };

  const renderCourtPlayerSlot = (playerId: string, side: 'A' | 'B') => {
    const player = playerMap.get(playerId);
    const name = player?.name ?? '未知球友';
    const rating = player ? player.rating.toFixed(1) : '3.5';
    const g = player ? genderText(player.gender) : '';
    const relation = getRelationTag(playerId, side);
    const isMe = relation === '我';
    const isPartner = relation === '搭档';
    const isSelectedForSwap = swapMode && selectedSwapPlayerId === playerId;
    const isRight = side === 'B';

    const content = (
      <div
        className={`flex items-center gap-1.5 sm:gap-2 min-w-0 ${
          isRight ? 'flex-row-reverse text-right' : 'flex-row text-left'
        }`}
      >
        <div
          className={`w-6 h-6 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-[11px] sm:text-xs font-extrabold shrink-0 ${
            isMe || isSelectedForSwap
              ? 'bg-[#D4FF2B] text-[#080B10]'
              : player?.gender === 'F'
              ? 'bg-[#3A1E1B] text-[#FF907A] border border-[#FF6448]/30'
              : 'bg-[#173068] text-[#9AC0FF] border border-[#5C93FF]/30'
          }`}
          aria-hidden="true"
        >
          {name.slice(0, 1)}
        </div>
        <div className="min-w-0 flex-1 overflow-hidden">
          <div
            className={`font-semibold text-[13px] sm:text-sm truncate ${
              isSelectedForSwap
                ? 'text-[#080B10]'
                : isMe
                ? 'text-[#D4FF2B]'
                : 'text-[#F4F7FB]'
            }`}
          >
            {name}
          </div>
          <div
            className={`flex items-center gap-0.5 sm:gap-1 text-[10.5px] sm:text-[11px] font-mono tabular-nums leading-tight mt-0.5 truncate ${
              isRight ? 'justify-end' : 'justify-start'
            }`}
          >
            {relation && (
              <span
                className={`font-sans font-bold shrink-0 ${
                  isSelectedForSwap
                    ? 'text-[#080B10]'
                    : isMe
                    ? 'text-[#D4FF2B]'
                    : isPartner
                    ? 'text-[#7BB1FF]'
                    : 'text-[#9AA5BC]'
                }`}
              >
                {relation}·
              </span>
            )}
            <span
              className={`whitespace-nowrap ${
                isSelectedForSwap ? 'text-[#080B10]/80' : 'text-[#9AA5BC]'
              }`}
            >
              {g}
              {rating}
            </span>
          </div>
        </div>
      </div>
    );

    if (swapMode && !isCompleted) {
      return (
        <button
          key={playerId}
          type="button"
          onClick={() => onSelectSwapPlayer(playerId)}
          aria-label={`选择 ${name} 交换位置`}
          aria-pressed={isSelectedForSwap}
          className={`w-full min-h-[48px] px-2 sm:px-2.5 py-1.5 sm:py-2 rounded-xl border transition-all cursor-pointer ${
            isSelectedForSwap
              ? 'bg-[#D4FF2B] border-[#D4FF2B] scale-[1.02]'
              : 'bg-[#080C14]/88 backdrop-blur-md border-white/15 hover:border-[#D4FF2B]/60'
          }`}
        >
          {content}
        </button>
      );
    }

    return (
      <div
        key={playerId}
        className={`w-full px-2 sm:px-2.5 py-1.5 sm:py-2 rounded-xl border backdrop-blur-md transition-all ${
          isMe
            ? 'bg-[#0B111C]/94 border-[#D4FF2B]/80'
            : isPartner
            ? 'bg-[#090E18]/90 border-[#6EA8FF]/55'
            : 'bg-[#080C14]/86 border-white/[0.13]'
        }`}
      >
        {content}
      </div>
    );
  };

  return (
    <article
      className={`theme-glass rounded-3xl border overflow-hidden transition-all duration-200 ${
        isMatchFocused
          ? 'border-[var(--theme-accent)] shadow-lg'
          : 'border-white/[0.14]'
      } ${dimmedByFocus ? 'opacity-45' : 'opacity-100'}`}
      aria-label={`第${match.roundNumber}轮 ${match.courtNumber}号场`}
    >
      {/* Top Broadcast Telemetry Strip */}
      <div className="px-4 sm:px-5 py-3 flex items-center justify-between gap-2 border-b border-white/[0.06]">
        <div className="flex items-center gap-2 min-w-0 text-xs text-[#8E9AB2]">
          <span className="font-score italic text-xl font-extrabold tracking-wide text-[#F4F7FB] leading-none">
            {String(match.courtNumber).padStart(2, '0')}号场
          </span>
          <span aria-hidden="true" className="text-white/25">
            /
          </span>
          <span className="font-mono tabular-nums whitespace-nowrap text-[#B8C4DA]">
            均势 {balance.balancePct}%
          </span>
          <span aria-hidden="true" className="hidden sm:inline text-white/25">
            ·
          </span>
          <span className="hidden sm:inline font-mono tabular-nums whitespace-nowrap">
            {balance.avgA.toFixed(1)} vs {balance.avgB.toFixed(1)}
          </span>
        </div>

        <div className="flex items-center gap-1.5 text-xs font-semibold shrink-0">
          {isCompleted ? (
            <span className="inline-flex items-center gap-1 text-[#22D38B]">
              <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
              <span>已完赛</span>
            </span>
          ) : swapMode ? (
            <span className="inline-flex items-center gap-1 text-[#D4FF2B]">
              <ArrowLeftRight className="w-3.5 h-3.5" aria-hidden="true" />
              <span>点选换位</span>
            </span>
          ) : (
            <span className="text-[#8E9AB2]">待开赛</span>
          )}
        </div>
      </div>

      {/* Illuminated Scenic Hard-Court Arena */}
      <div className="p-2.5 sm:p-3 bg-black/25">
        <div
          className="relative rounded-2xl overflow-hidden p-2.5 sm:p-3 border border-white/[0.16]"
          style={{
            background:
              'radial-gradient(ellipse at 50% 0%, var(--theme-court-glow) 0%, var(--theme-court-outer) 100%)',
          }}
        >
          {/* Authentic Pro Hard-Court Geometry SVG */}
          <svg
            aria-hidden="true"
            viewBox="0 0 400 180"
            preserveAspectRatio="none"
            className="pointer-events-none absolute inset-0 w-full h-full"
          >
            {/* Outer Apron Border */}
            <rect x="0" y="0" width="400" height="180" fill="var(--theme-court-outer)" fillOpacity="0.45" />
            {/* Inner Playable Court */}
            <rect x="12" y="10" width="376" height="160" rx="3" fill="var(--theme-court-inner)" fillOpacity="0.82" />
            {/* Non-Volley Kitchen Zone (NVZ) */}
            <rect x="142" y="10" width="116" height="160" fill="var(--theme-court-kitchen)" fillOpacity="0.72" />
            {/* Crisp Chalk Court Lines */}
            <rect
              x="12"
              y="10"
              width="376"
              height="160"
              rx="3"
              fill="none"
              stroke="rgba(255,255,255,0.68)"
              strokeWidth="1.6"
            />
            <line x1="142" y1="10" x2="142" y2="170" stroke="rgba(255,255,255,0.58)" strokeWidth="1.5" />
            <line x1="258" y1="10" x2="258" y2="170" stroke="rgba(255,255,255,0.58)" strokeWidth="1.5" />
            <line x1="12" y1="90" x2="142" y2="90" stroke="rgba(255,255,255,0.36)" strokeWidth="1.2" />
            <line x1="258" y1="90" x2="388" y2="90" stroke="rgba(255,255,255,0.36)" strokeWidth="1.2" />
            {/* Center Illuminated Net Line */}
            <line
              x1="200"
              y1="5"
              x2="200"
              y2="175"
              stroke="#FFFFFF"
              strokeOpacity="0.92"
              strokeWidth="2.2"
              strokeDasharray="4 3"
            />
          </svg>

          <div className="relative z-10 grid grid-cols-[1fr_auto_1fr] items-center gap-1.5 sm:gap-2.5">
            {/* Team A (Left Half-Court) */}
            <div className="space-y-2 min-w-0">
              <div className="flex items-center justify-between px-1 text-[11px] font-semibold">
                <span className="text-white/85">左半场 · A队</span>
                {winnerA && <span className="text-[#D4FF2B] font-bold">WIN</span>}
              </div>
              {match.teamA.map((pid) => renderCourtPlayerSlot(pid, 'A'))}
            </div>

            {/* Center Net Broadcast Scoreboard */}
            <div className="flex flex-col items-center justify-center">
              {isCompleted ? (
                <button
                  type="button"
                  onClick={() => !swapMode && onOpenScore(match)}
                  disabled={swapMode}
                  aria-label={`修改 第${match.roundNumber}轮 ${match.courtNumber}号场 比分 ${match.scoreA}比${match.scoreB}`}
                  className="min-h-[50px] min-w-[62px] sm:min-w-[78px] px-2 sm:px-2.5 py-1.5 rounded-2xl bg-[#070A10] border border-white/25 shadow-lg flex items-center justify-center gap-1 cursor-pointer hover:border-[#D4FF2B]/70 active:scale-95 transition-all"
                >
                  <span
                    className={`font-score italic text-2xl sm:text-3xl font-extrabold leading-none ${
                      winnerA ? 'text-[#D4FF2B]' : 'text-white/65'
                    }`}
                  >
                    {match.scoreA}
                  </span>
                  <span className="text-white/35 font-score text-lg leading-none">:</span>
                  <span
                    className={`font-score italic text-2xl sm:text-3xl font-extrabold leading-none ${
                      winnerB ? 'text-[#D4FF2B]' : 'text-white/65'
                    }`}
                  >
                    {match.scoreB}
                  </span>
                </button>
              ) : (
                <div className="w-8 h-8 sm:w-11 sm:h-11 rounded-full bg-[#070A10]/95 border border-white/25 shadow-lg flex items-center justify-center">
                  <span className="font-score italic text-xs sm:text-base font-extrabold tracking-wider text-[#D4FF2B]">
                    VS
                  </span>
                </div>
              )}
            </div>

            {/* Team B (Right Half-Court) */}
            <div className="space-y-2 min-w-0">
              <div className="flex items-center justify-between px-1 text-[11px] font-semibold">
                {winnerB ? <span className="text-[#D4FF2B] font-bold">WIN</span> : <span />}
                <span className="text-white/85">B队 · 右半场</span>
              </div>
              {match.teamB.map((pid) => renderCourtPlayerSlot(pid, 'B'))}
            </div>
          </div>
        </div>
      </div>

      {/* Optional DeepSeek Matchmaking Storyline */}
      {match.aiReason && (
        <div className="px-4 sm:px-5 py-2 bg-black/25 border-t border-white/[0.08] flex items-center gap-2 text-xs text-white/85">
          <Sparkles className="w-3.5 h-3.5 theme-accent-text shrink-0" aria-hidden="true" />
          <span className="truncate">{match.aiReason}</span>
        </div>
      )}

      {/* Bottom Action Strip */}
      {!swapMode && (
        <div className="px-4 sm:px-5 py-3 flex items-center justify-between gap-2 bg-black/15">
          <button
            type="button"
            onClick={() => onOpenAiPreview(match)}
            aria-label={`查看 第${match.roundNumber}轮 ${match.courtNumber}号场 AI 战术预测`}
            className="min-h-[42px] px-3.5 rounded-xl bg-white/[0.1] text-white/90 hover:bg-white/[0.18] hover:text-white text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5 theme-accent-text" aria-hidden="true" />
            <span>AI 战术</span>
          </button>

          <button
            type="button"
            onClick={() => onOpenScore(match)}
            aria-label={`${isCompleted ? '修改' : '录入'} 第${match.roundNumber}轮 ${match.courtNumber}号场 比分`}
            className={`min-h-[42px] px-4 rounded-xl text-sm font-bold transition-all flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer active:scale-[0.98] ${
              isCompleted
                ? 'bg-white/[0.12] text-white hover:bg-white/[0.2]'
                : 'theme-accent-bg'
            }`}
          >
            <Edit3 className="w-3.5 h-3.5" aria-hidden="true" />
            <span>{isCompleted ? '改分' : '录入比分'}</span>
          </button>
        </div>
      )}
    </article>
  );
}
