import { useState } from 'react';
import { Cloud, Lock, RefreshCw, RotateCcw, ShieldCheck, Shuffle, Sparkles } from 'lucide-react';
import type {
  ScheduleFairnessReport,
  ScoringTarget,
  TournamentConfig,
  TournamentFormat,
  TournamentState,
  UserAccount,
} from '../types/tournament';
import { canPublishTournament } from '../utils/authStore';
import { getRecommendedRounds } from '../utils/scheduler';
import { getThemeConfig, type ScenicThemeId } from '../utils/themes';

interface SetupViewProps {
  state: TournamentState;
  activeTheme: ScenicThemeId;
  currentUser: UserAccount | null;
  fairness: ScheduleFairnessReport;
  roomCode: string | null;
  onApplyConfigAndGenerate: (config: TournamentConfig) => void;
  onShuffleSchedule: () => void;
  onOpenCloudSync: () => void;
  onPromptLogin: () => void;
  onResetDemo: () => void;
}

const FORMAT_OPTIONS: Array<{
  id: TournamentFormat;
  title: string;
  desc: string;
}> = [
  {
    id: 'ai_smart',
    title: 'AI 智适应排阵（DeepSeek）',
    desc: '自动记住球友跨场历史战绩与动态等效分，支持按「均势/带飞/复仇/混双」风格逐轮智排。',
  },
  {
    id: 'classic',
    title: '经典全员转',
    desc: '优先最大化不重复搭档（8人2场7轮可达100%全搭档）并均分轮空次数。',
  },
  {
    id: 'balanced',
    title: '水平均衡转',
    desc: '按 DUPR 评分动态平衡每场双方均分，减少悬殊局，同时避免搭档重复。',
  },
  {
    id: 'mixed',
    title: '混双优选转',
    desc: '自动识别男女球员，优先匹配混双搭档并平衡对手实力。',
  },
  {
    id: 'mexicano',
    title: '胜者升场制',
    desc: '每轮结束后根据实时积分榜动态生成下轮对阵，前四自动会师1号王座场。',
  },
];

export function SetupView({
  state,
  activeTheme,
  currentUser,
  fairness,
  roomCode,
  onApplyConfigAndGenerate,
  onShuffleSchedule,
  onOpenCloudSync,
  onPromptLogin,
  onResetDemo,
}: SetupViewProps) {
  const [title, setTitle] = useState(state.config.title);
  const [venue, setVenue] = useState(state.config.venue);
  const [format, setFormat] = useState<TournamentFormat>(state.config.format);
  const [courtCount, setCourtCount] = useState<number>(state.config.courtCount);
  const [totalRounds, setTotalRounds] = useState<number>(state.config.totalRounds);
  const [targetScore, setTargetScore] = useState<ScoringTarget>(state.config.targetScore);
  const [winByTwo, setWinByTwo] = useState<boolean>(state.config.winByTwo);
  const [roundMinutes, setRoundMinutes] = useState<number>(state.config.roundMinutes);
  const [imgFailed, setImgFailed] = useState(false);

  const themeCfg = getThemeConfig(activeTheme);
  const canPublish = canPublishTournament(currentUser);
  const activePlayers = state.players.filter((p) => p.active).length;
  const maxCourts = Math.max(1, Math.min(6, Math.floor(activePlayers / 4) || 1));
  const recommendedRounds = getRecommendedRounds(activePlayers, courtCount);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canPublish) {
      onPromptLogin();
      return;
    }
    onApplyConfigAndGenerate({
      title: title.trim() || '匹克球智能转转赛',
      venue: venue.trim(),
      format,
      courtCount: Math.min(courtCount, maxCourts),
      totalRounds: Math.max(1, Math.min(15, totalRounds)),
      targetScore,
      winByTwo,
      roundMinutes,
    });
  };

  return (
    <div className="space-y-6">
      {/* Scenic Setup Hero */}
      <section className="relative rounded-3xl overflow-hidden border border-white/[0.16] min-h-[185px] sm:min-h-[205px] flex items-end shadow-xl">
        {!imgFailed ? (
          <img
            src={themeCfg.bgImage}
            alt={`${themeCfg.name} 匹克球场`}
            referrerPolicy="no-referrer"
            onError={() => setImgFailed(true)}
            className="absolute inset-0 w-full h-full object-cover object-center"
          />
        ) : (
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-gradient-to-br from-[#1B2A4A] to-[#0B0F18]"
          />
        )}
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-t from-black/82 via-black/52 to-black/20"
        />

        <div className="relative z-10 w-full p-5 sm:p-7 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div className="space-y-1">
            <p className="text-xs font-bold theme-accent-text flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" />
              <span>
                {canPublish
                  ? `管理员模式（${currentUser?.displayName}）· 可发布正式赛制`
                  : '赛制浏览模式 · 发布需管理员权限'}
              </span>
            </p>
            <h1 className="text-xl sm:text-2xl font-extrabold text-white">自定义转转赛规则与发布</h1>
            <p className="text-xs sm:text-sm text-white/80">
              当前 {activePlayers} 位活跃球员 · 最多可同时开 {maxCourts} 片场地
            </p>
          </div>

          <button
            type="button"
            onClick={canPublish ? onShuffleSchedule : onPromptLogin}
            className="min-h-[44px] px-4 rounded-xl bg-white/[0.14] backdrop-blur-md border border-white/[0.18] text-white text-xs sm:text-sm font-semibold hover:bg-white/[0.24] transition-colors inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer self-start sm:self-auto"
          >
            <Shuffle className="w-4 h-4 theme-accent-text" aria-hidden="true" />
            <span>{canPublish ? '换一套排阵' : '登录管理员'}</span>
          </button>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <form
          onSubmit={handleSubmit}
          className="lg:col-span-8 bg-[#111620] rounded-3xl border border-white/[0.08] p-5 sm:p-6 space-y-6"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="setup-title" className="block text-xs font-bold text-[#8E9AB2] mb-1.5">
                赛事名称
              </label>
              <input
                id="setup-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full min-h-[44px] rounded-xl border border-white/[0.1] bg-[#0A0E16] px-3.5 text-sm text-[#F4F7FB] focus:outline-none focus:border-[#D4FF2B]"
              />
            </div>
            <div>
              <label htmlFor="setup-venue" className="block text-xs font-bold text-[#8E9AB2] mb-1.5">
                球馆与场地说明
              </label>
              <input
                id="setup-venue"
                type="text"
                value={venue}
                onChange={(e) => setVenue(e.target.value)}
                placeholder="例如：滨江匹克球公园 1-2号场"
                className="w-full min-h-[44px] rounded-xl border border-white/[0.1] bg-[#0A0E16] px-3.5 text-sm text-[#F4F7FB] placeholder:text-[#5B677E] focus:outline-none focus:border-[#D4FF2B]"
              />
            </div>
          </div>

          <div className="space-y-2.5">
            <span className="block text-xs font-bold text-[#8E9AB2]">智能排阵赛制</span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {FORMAT_OPTIONS.map((opt) => {
                const selected = format === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setFormat(opt.id)}
                    aria-pressed={selected}
                    className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
                      selected
                        ? 'bg-[#172238] border-[#D4FF2B] text-white'
                        : 'bg-[#171E2B] border-white/[0.06] text-[#D8E1F0] hover:border-white/25'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold">{opt.title}</span>
                      {selected && (
                        <span className="text-[11px] font-bold text-[#D4FF2B]">已选择</span>
                      )}
                    </div>
                    <p
                      className={`text-xs mt-1.5 leading-relaxed ${
                        selected ? 'text-[#B8C4DA]' : 'text-[#8E9AB2]'
                      }`}
                    >
                      {opt.desc}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-white/[0.06]">
            <div>
              <span className="block text-xs font-bold text-[#8E9AB2] mb-1.5">
                开场数量（最多 {maxCourts} 片）
              </span>
              <div className="grid grid-cols-3 gap-1.5">
                {(maxCourts <= 3 ? [1, 2, 3] : [1, 2, 3, 4, 5, 6].slice(0, maxCourts)).map((n) => {
                  const disabled = n > maxCourts;
                  return (
                    <button
                      key={n}
                      type="button"
                      disabled={disabled}
                      onClick={() => setCourtCount(n)}
                      className={`min-h-[44px] rounded-xl font-mono tabular-nums text-sm font-bold border transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed ${
                        courtCount === n
                          ? 'bg-[#D4FF2B] text-[#080B10] border-[#D4FF2B]'
                          : 'bg-[#171E2B] text-[#F4F7FB] border-white/[0.08]'
                      }`}
                    >
                      {n}片
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="setup-rounds" className="text-xs font-bold text-[#8E9AB2]">
                  总轮次数
                </label>
                <button
                  type="button"
                  onClick={() => setTotalRounds(recommendedRounds)}
                  className="text-[11px] font-semibold text-[#D4FF2B] hover:underline cursor-pointer"
                >
                  推荐 {recommendedRounds} 轮
                </button>
              </div>
              <input
                id="setup-rounds"
                type="number"
                min={1}
                max={15}
                value={totalRounds}
                onChange={(e) =>
                  setTotalRounds(Math.max(1, Math.min(15, Number(e.target.value) || 1)))
                }
                className="w-full min-h-[44px] rounded-xl border border-white/[0.1] bg-[#0A0E16] px-3.5 text-sm font-mono tabular-nums text-[#F4F7FB] focus:outline-none focus:border-[#D4FF2B]"
              />
            </div>

            <div>
              <span className="block text-xs font-bold text-[#8E9AB2] mb-1.5">单局分制</span>
              <div className="grid grid-cols-3 gap-1.5">
                {([11, 15, 21] as ScoringTarget[]).map((pts) => (
                  <button
                    key={pts}
                    type="button"
                    onClick={() => setTargetScore(pts)}
                    className={`min-h-[44px] rounded-xl font-mono tabular-nums text-sm font-bold border transition-colors cursor-pointer ${
                      targetScore === pts
                        ? 'bg-[#D4FF2B] text-[#080B10] border-[#D4FF2B]'
                        : 'bg-[#171E2B] text-[#F4F7FB] border-white/[0.08]'
                    }`}
                  >
                    {pts}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-white/[0.06]">
            <label className="flex items-center justify-between gap-3 p-3.5 rounded-xl bg-[#171E2B] border border-white/[0.06] cursor-pointer">
              <div>
                <div className="text-sm font-bold text-[#F4F7FB]">净胜 2 分校验</div>
                <div className="text-xs text-[#8E9AB2]">达到目标分时提醒需净胜 2 分</div>
              </div>
              <input
                type="checkbox"
                checked={winByTwo}
                onChange={(e) => setWinByTwo(e.target.checked)}
                className="w-5 h-5 accent-[#D4FF2B] cursor-pointer"
              />
            </label>

            <div className="flex items-center justify-between gap-3 p-3.5 rounded-xl bg-[#171E2B] border border-white/[0.06]">
              <div>
                <label htmlFor="setup-minutes" className="text-sm font-bold text-[#F4F7FB]">
                  单轮计时提醒
                </label>
                <div className="text-xs text-[#8E9AB2]">场上倒计时默认时长（分钟）</div>
              </div>
              <select
                id="setup-minutes"
                value={roundMinutes}
                onChange={(e) => setRoundMinutes(Number(e.target.value))}
                className="min-h-[40px] rounded-lg border border-white/[0.1] bg-[#0A0E16] px-2.5 text-sm font-mono tabular-nums text-[#F4F7FB]"
              >
                {[8, 10, 12, 15, 20].map((m) => (
                  <option key={m} value={m} className="bg-[#111620]">
                    {m} 分钟
                  </option>
                ))}
              </select>
            </div>
          </div>

          {!canPublish && (
            <div className="rounded-2xl bg-black/35 border border-[var(--theme-accent)]/40 p-3.5 flex items-center justify-between gap-3 text-xs">
              <span className="text-white/85">
                当前未以管理员身份登录。请前往「我的」使用管理员或超管账号（如 Jack）登录后发布赛制。
              </span>
              <button
                type="button"
                onClick={onPromptLogin}
                className="px-3 py-1.5 rounded-lg theme-accent-bg font-bold whitespace-nowrap shrink-0 cursor-pointer"
              >
                去登录
              </button>
            </div>
          )}

          <button
            type="submit"
            className="w-full min-h-[48px] rounded-xl theme-accent-bg text-sm font-bold active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            {canPublish ? (
              <>
                <RefreshCw className="w-4 h-4" aria-hidden="true" />
                <span>发布赛制并生成智能赛程</span>
              </>
            ) : (
              <>
                <Lock className="w-4 h-4" aria-hidden="true" />
                <span>登录管理员账号后发布赛制</span>
              </>
            )}
          </button>
        </form>

        <aside className="lg:col-span-4 space-y-4">
          <section className="bg-[#111620] rounded-3xl border border-white/[0.08] p-5 space-y-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-[#D4FF2B]" aria-hidden="true" />
                <h2 className="text-sm font-bold text-[#F4F7FB]">当前排阵公平报告</h2>
              </div>
              <span className="font-score italic text-2xl font-extrabold text-[#D4FF2B]">
                {fairness.compositeScore} / 100
              </span>
            </div>

            <div className="divide-y divide-white/[0.06] text-sm">
              <div className="py-2.5 flex items-center justify-between">
                <span className="text-[#8E9AB2]">搭档不重复率</span>
                <span className="font-mono tabular-nums font-bold text-[#F4F7FB]">
                  {fairness.partnerUniquenessPct}%（重复 {fairness.repeatPartnerCount} 次）
                </span>
              </div>
              <div className="py-2.5 flex items-center justify-between">
                <span className="text-[#8E9AB2]">出场次数范围</span>
                <span className="font-mono tabular-nums font-bold text-[#F4F7FB]">
                  {fairness.playCountMin}–{fairness.playCountMax} 场
                </span>
              </div>
              <div className="py-2.5 flex items-center justify-between">
                <span className="text-[#8E9AB2]">平均对局 DUPR 差</span>
                <span className="font-mono tabular-nums font-bold text-[#F4F7FB]">
                  {fairness.avgSkillGap.toFixed(2)}
                </span>
              </div>
              <div className="py-2.5 flex items-center justify-between">
                <span className="text-[#8E9AB2]">混双组合占比</span>
                <span className="font-mono tabular-nums font-bold text-[#F4F7FB]">
                  {fairness.mixedTeamPct}%
                </span>
              </div>
            </div>
          </section>

          <section className="bg-[#111620] rounded-3xl border border-white/[0.08] p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-[#F4F7FB]">数据存储与云端同步</h2>
              {roomCode && (
                <span className="font-mono text-xs font-bold text-[#D4FF2B]">#{roomCode}</span>
              )}
            </div>
            <p className="text-xs text-[#8E9AB2] leading-relaxed">
              默认实时缓存在本机 <code className="font-mono text-[#D4FF2B]">localStorage</code>，支持一键推送至
              Cloudflare KV 云端房间，让同场球友扫码同步查看比分。
            </p>
            <div className="grid grid-cols-2 gap-2.5 pt-1">
              <button
                type="button"
                onClick={onOpenCloudSync}
                className="min-h-[44px] px-3 rounded-xl bg-[#D4FF2B] text-[#080B10] text-xs font-bold hover:bg-[#E1FF61] flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Cloud className="w-3.5 h-3.5" aria-hidden="true" />
                <span>云同步 / 备份</span>
              </button>
              <button
                type="button"
                onClick={onResetDemo}
                className="min-h-[44px] px-3 rounded-xl border border-white/[0.08] bg-[#171E2B] text-xs font-semibold text-[#9AA5BC] hover:text-[#FF6448] hover:border-[#FF6448]/40 flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                <span>重置示例</span>
              </button>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
