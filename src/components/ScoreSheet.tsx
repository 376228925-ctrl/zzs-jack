import { useEffect, useState } from 'react';
import { ArrowLeftRight, Minus, Plus, RotateCcw, X } from 'lucide-react';
import type { Match, Player, ScoringTarget } from '../types/tournament';
import { validateMatchScore } from '../utils/scheduler';

interface ScoreSheetProps {
  match: Match | null;
  playerMap: Map<string, Player>;
  targetScore: ScoringTarget;
  winByTwo: boolean;
  onClose: () => void;
  onSaveScore: (matchId: string, scoreA: number, scoreB: number) => void;
  onClearScore: (matchId: string) => void;
}

export function ScoreSheet({
  match,
  playerMap,
  targetScore,
  winByTwo,
  onClose,
  onSaveScore,
  onClearScore,
}: ScoreSheetProps) {
  const [scoreA, setScoreA] = useState<number>(0);
  const [scoreB, setScoreB] = useState<number>(0);

  useEffect(() => {
    if (!match) return;
    setScoreA(match.scoreA ?? 0);
    setScoreB(match.scoreB ?? 0);
  }, [match]);

  useEffect(() => {
    if (!match) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [match, onClose]);

  if (!match) return null;

  const teamANames = match.teamA.map((id) => playerMap.get(id)?.name ?? '球友').join(' / ');
  const teamBNames = match.teamB.map((id) => playerMap.get(id)?.name ?? '球友').join(' / ');
  const validation = validateMatchScore(scoreA, scoreB, targetScore, winByTwo);

  const presets: Array<[number, number]> = [
    [targetScore, Math.max(0, targetScore - 2)],
    [targetScore, Math.max(0, targetScore - 4)],
    [Math.max(0, targetScore - 2), targetScore],
    [Math.max(0, targetScore - 4), targetScore],
  ];

  const handleConfirm = () => {
    if (!validation.valid) return;
    onSaveScore(match.id, scoreA, scoreB);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/75 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="score-sheet-title"
      onClick={onClose}
    >
      <div
        className="w-full md:max-w-lg bg-[#111620] text-[#F4F7FB] rounded-t-3xl md:rounded-3xl overflow-hidden shadow-2xl border border-white/[0.1] max-h-[92vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Stadium Broadcast Header */}
        <div className="bg-gradient-to-r from-[#0E2457] via-[#13337D] to-[#111620] text-white px-5 pt-3 pb-4 border-b border-white/[0.08]">
          <div className="md:hidden w-10 h-1.5 bg-white/25 rounded-full mx-auto mb-3" aria-hidden="true" />
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 id="score-sheet-title" className="text-lg font-extrabold text-white">
                第 {match.roundNumber} 轮 · {String(match.courtNumber).padStart(2, '0')}号场记分
              </h2>
              <p className="text-xs text-[#B8C4DA] mt-0.5 font-mono tabular-nums">
                {targetScore}分制 · {winByTwo ? '净胜2分校验' : '先到即胜'}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="关闭记分面板"
              className="min-h-[44px] min-w-[44px] -mr-2 -mt-2 flex items-center justify-center rounded-xl text-white/75 hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-5 sm:p-6 pb-safe overflow-y-auto space-y-5">
          {/* Broadcast Dual Score Steppers */}
          <div className="relative grid grid-cols-2 gap-3.5">
            {/* Team A */}
            <div className="rounded-2xl bg-[#171E2B] border border-white/[0.08] p-4 flex flex-col items-center text-center">
              <span className="text-[11px] font-semibold text-[#7BB1FF]">左半场 · A队</span>
              <p className="text-sm font-bold text-[#F4F7FB] mt-1 line-clamp-1">{teamANames}</p>

              <div
                className={`font-score italic text-6xl font-extrabold leading-none my-4 ${
                  validation.winner === 'A' ? 'text-[#D4FF2B]' : 'text-[#F4F7FB]'
                }`}
                data-testid="score-a-value"
              >
                {scoreA}
              </div>

              <div className="flex items-center gap-2.5 w-full">
                <button
                  type="button"
                  onClick={() => setScoreA((v) => Math.max(0, v - 1))}
                  aria-label="A队减1分"
                  className="flex-1 min-h-[48px] rounded-xl bg-[#0A0E16] border border-white/[0.1] text-[#F4F7FB] flex items-center justify-center hover:bg-white/[0.08] active:scale-95 transition-all cursor-pointer"
                >
                  <Minus className="w-5 h-5" />
                </button>
                <button
                  type="button"
                  onClick={() => setScoreA((v) => Math.min(35, v + 1))}
                  aria-label="A队加1分"
                  className="flex-1 min-h-[48px] rounded-xl bg-[#D4FF2B] text-[#080B10] flex items-center justify-center hover:bg-[#E1FF61] active:scale-95 transition-all cursor-pointer"
                >
                  <Plus className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Swap Scores Mid Button */}
            <button
              type="button"
              onClick={() => {
                const tmp = scoreA;
                setScoreA(scoreB);
                setScoreB(tmp);
              }}
              aria-label="互换双方比分"
              title="互换双方比分"
              className="absolute left-1/2 top-[48%] -translate-x-1/2 -translate-y-1/2 z-10 w-9 h-9 rounded-full bg-[#0A0E16] border border-white/20 shadow-lg text-[#D4FF2B] hover:border-[#D4FF2B] flex items-center justify-center cursor-pointer active:scale-90 transition-all"
            >
              <ArrowLeftRight className="w-4 h-4" />
            </button>

            {/* Team B */}
            <div className="rounded-2xl bg-[#171E2B] border border-white/[0.08] p-4 flex flex-col items-center text-center">
              <span className="text-[11px] font-semibold text-[#7BB1FF]">B队 · 右半场</span>
              <p className="text-sm font-bold text-[#F4F7FB] mt-1 line-clamp-1">{teamBNames}</p>

              <div
                className={`font-score italic text-6xl font-extrabold leading-none my-4 ${
                  validation.winner === 'B' ? 'text-[#D4FF2B]' : 'text-[#F4F7FB]'
                }`}
                data-testid="score-b-value"
              >
                {scoreB}
              </div>

              <div className="flex items-center gap-2.5 w-full">
                <button
                  type="button"
                  onClick={() => setScoreB((v) => Math.max(0, v - 1))}
                  aria-label="B队减1分"
                  className="flex-1 min-h-[48px] rounded-xl bg-[#0A0E16] border border-white/[0.1] text-[#F4F7FB] flex items-center justify-center hover:bg-white/[0.08] active:scale-95 transition-all cursor-pointer"
                >
                  <Minus className="w-5 h-5" />
                </button>
                <button
                  type="button"
                  onClick={() => setScoreB((v) => Math.min(35, v + 1))}
                  aria-label="B队加1分"
                  className="flex-1 min-h-[48px] rounded-xl bg-[#D4FF2B] text-[#080B10] flex items-center justify-center hover:bg-[#E1FF61] active:scale-95 transition-all cursor-pointer"
                >
                  <Plus className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>

          {/* Fast Court Presets */}
          <div>
            <p className="text-xs font-medium text-[#8E9AB2] mb-2">快捷比分（一键填入）</p>
            <div className="grid grid-cols-4 gap-2">
              {presets.map(([a, b]) => {
                const isSelected = scoreA === a && scoreB === b;
                return (
                  <button
                    key={`${a}-${b}`}
                    type="button"
                    onClick={() => {
                      setScoreA(a);
                      setScoreB(b);
                    }}
                    className={`min-h-[44px] rounded-xl border text-sm font-mono tabular-nums font-semibold active:scale-95 transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-[#D4FF2B] text-[#080B10] border-[#D4FF2B]'
                        : 'bg-[#171E2B] text-[#F4F7FB] border-white/[0.08] hover:border-[#D4FF2B]/50'
                    }`}
                  >
                    {a}:{b}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Validation Feedback */}
          {validation.error && (
            <p
              role="alert"
              className="text-xs text-[#FF9B89] bg-[#2C1414] border border-[#FF6448]/35 rounded-xl px-3.5 py-2.5"
            >
              {validation.error}
            </p>
          )}
          {validation.warning && (
            <p className="text-xs text-[#FCD34D] bg-[#2A210D] border border-[#F59E0B]/35 rounded-xl px-3.5 py-2.5">
              {validation.warning}
            </p>
          )}

          {/* Footer Actions */}
          <div className="flex items-center gap-3">
            {match.status === 'completed' && (
              <button
                type="button"
                onClick={() => {
                  onClearScore(match.id);
                  onClose();
                }}
                aria-label="清除此场比分"
                className="min-h-[48px] px-4 rounded-xl border border-white/[0.1] bg-[#171E2B] text-sm font-medium text-[#9AA5BC] hover:text-[#FF6448] hover:border-[#FF6448]/40 flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" aria-hidden="true" />
                <span>清除</span>
              </button>
            )}
            <button
              type="button"
              onClick={handleConfirm}
              disabled={!validation.valid}
              className={`flex-1 min-h-[48px] rounded-xl text-sm font-bold active:scale-[0.98] transition-colors duration-100 ${
                validation.valid
                  ? 'bg-[#D4FF2B] text-[#080B10] hover:bg-[#E1FF61] cursor-pointer'
                  : 'bg-white/[0.08] text-[#66738D] cursor-not-allowed'
              }`}
            >
              确认比分
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
