import { useRef, useState } from 'react';
import {
  Check,
  Cloud,
  CloudDownload,
  CloudUpload,
  Copy,
  Download,
  Upload,
  X,
} from 'lucide-react';
import type { TournamentState } from '../types/tournament';
import {
  generateRoomCode,
  isValidRoomCode,
  normalizeRoomCode,
  pullRoomState,
  pushRoomState,
  validateTournamentStatePayload,
} from '../utils/roomSync';

interface CloudSyncSheetProps {
  open: boolean;
  state: TournamentState;
  roomCode: string | null;
  onClose: () => void;
  onRoomCodeChange: (code: string) => void;
  onApplyImportedState: (nextState: TournamentState, sourceLabel: string) => void;
}

export function CloudSyncSheet({
  open,
  state,
  roomCode,
  onClose,
  onRoomCodeChange,
  onApplyImportedState,
}: CloudSyncSheetProps) {
  const [inputCode, setInputCode] = useState<string>(roomCode ?? '');
  const [busy, setBusy] = useState<'push' | 'pull' | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!open) return null;

  const activeCode = normalizeRoomCode(inputCode || roomCode || '');

  const handlePush = async () => {
    const targetCode = isValidRoomCode(activeCode) ? activeCode : generateRoomCode();
    setInputCode(targetCode);
    setBusy('push');
    setFeedback(null);
    try {
      const res = await pushRoomState(targetCode, state);
      if (!res.ok) {
        setFeedback({ type: 'err', text: res.error || '云端同步失败' });
        return;
      }
      onRoomCodeChange(targetCode);
      const url = new URL(window.location.href);
      url.searchParams.set('room', targetCode);
      window.history.replaceState({}, '', url.toString());
      setFeedback({
        type: 'ok',
        text: `已同步至云端房间 ${targetCode}（${
          res.storageMode === 'cloudflare_kv' ? 'Cloudflare 边缘 KV' : '服务端房间存储'
        }）`,
      });
    } catch {
      setFeedback({ type: 'err', text: '网络异常，请检查连接后重试' });
    } finally {
      setBusy(null);
    }
  };

  const handlePull = async () => {
    if (!isValidRoomCode(activeCode)) {
      setFeedback({ type: 'err', text: '请输入 4–8 位赛事房间码后再拉取' });
      return;
    }
    setBusy('pull');
    setFeedback(null);
    try {
      const res = await pullRoomState(activeCode);
      if (!res.ok || !res.state) {
        setFeedback({ type: 'err', text: res.error || '拉取云端房间失败' });
        return;
      }
      const validated = validateTournamentStatePayload(res.state);
      if (!validated) {
        setFeedback({ type: 'err', text: '云端房间数据格式异常' });
        return;
      }
      onRoomCodeChange(activeCode);
      onApplyImportedState(validated, `已拉取云端房间 ${activeCode} 最新赛况`);
      setFeedback({ type: 'ok', text: `已成功同步房间 ${activeCode} 的最新比分与排阵` });
    } catch {
      setFeedback({ type: 'err', text: '拉取失败，请检查网络连接' });
    } finally {
      setBusy(null);
    }
  };

  const handleCopyShareLink = async () => {
    if (!isValidRoomCode(activeCode)) return;
    const url = new URL(window.location.href);
    url.searchParams.set('room', activeCode);
    const shareUrl = url.toString();
    try {
      await navigator.clipboard.writeText(shareUrl);
    } catch {
      const el = document.createElement('textarea');
      el.value = shareUrl;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
    }
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleExportFile = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${state.config.title.replace(/\s+/g, '_')}_存档.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        const validated = validateTournamentStatePayload(parsed);
        if (!validated) {
          setFeedback({ type: 'err', text: '所选 JSON 文件不是有效的赛事存档' });
          return;
        }
        onApplyImportedState(validated, '已从本地存档恢复赛事数据');
        onClose();
      } catch {
        setFeedback({ type: 'err', text: 'JSON 文件解析失败，请确认文件完整' });
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/75 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cloud-sync-title"
      onClick={onClose}
    >
      <div
        className="w-full md:max-w-lg bg-[#111620] text-[#F4F7FB] rounded-t-3xl md:rounded-3xl p-5 sm:p-6 pb-safe shadow-2xl border border-white/[0.1] max-h-[90vh] overflow-y-auto space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="md:hidden w-10 h-1.5 bg-white/20 rounded-full mx-auto -mt-1 mb-1" aria-hidden="true" />

        <div className="flex items-start justify-between gap-3 pb-3 border-b border-white/[0.08]">
          <div>
            <div className="flex items-center gap-1.5 text-xs font-bold text-[#D4FF2B]">
              <Cloud className="w-3.5 h-3.5" aria-hidden="true" />
              <span>数据存储与多端同步</span>
            </div>
            <h2 id="cloud-sync-title" className="text-lg font-bold text-white mt-0.5">
              本机自动保存 · 云端房间共享
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭同步窗口"
            className="min-h-[44px] min-w-[44px] -mr-2 -mt-2 flex items-center justify-center rounded-xl text-[#8E9AB2] hover:bg-white/[0.08] hover:text-white cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Storage Architecture Clarity */}
        <div className="rounded-2xl bg-[#171E2B] border border-white/[0.06] p-4 space-y-1.5 text-xs text-[#B8C4DA] leading-relaxed">
          <p className="font-semibold text-[#F4F7FB]">当前数据存放在哪？</p>
          <p>
            1. <strong className="text-white">默认本机存储</strong>：所有排阵与比分实时写入浏览器{' '}
            <code className="font-mono text-[#D4FF2B]">localStorage</code>，球场断网也可秒开使用。
          </p>
          <p>
            2. <strong className="text-white">Cloudflare KV 云端房间</strong>：点击下方「推送到云端房间」生成
            6 位房间码，球友打开专属链接即可在各自手机同步查看实时对阵与榜单。
          </p>
        </div>

        {/* Room Code Controls */}
        <div className="space-y-3">
          <label htmlFor="room-code-input" className="block text-xs font-bold text-[#B8C4DA]">
            赛事房间码（留空推送将自动生成）
          </label>
          <div className="flex items-center gap-2">
            <input
              id="room-code-input"
              type="text"
              value={inputCode}
              onChange={(e) => setInputCode(normalizeRoomCode(e.target.value))}
              placeholder="例如：PB8426"
              maxLength={8}
              className="flex-1 min-h-[46px] rounded-xl bg-[#0A0E16] border border-white/[0.12] px-3.5 text-base font-mono tracking-widest uppercase text-[#D4FF2B] placeholder:text-[#5B677E] focus:outline-none focus:border-[#D4FF2B]"
            />
            {isValidRoomCode(activeCode) && (
              <button
                type="button"
                onClick={handleCopyShareLink}
                className="min-h-[46px] px-3.5 rounded-xl bg-white/[0.08] hover:bg-white/[0.14] text-xs font-semibold text-white inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
              >
                {copiedLink ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-[#D4FF2B]" aria-hidden="true" />
                    <span>已复制</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>复制链接</span>
                  </>
                )}
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={handlePush}
              disabled={busy !== null}
              className="min-h-[46px] px-3 rounded-xl bg-[#D4FF2B] text-[#080B10] text-xs sm:text-sm font-bold hover:bg-[#E1FF61] disabled:opacity-50 inline-flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <CloudUpload className="w-4 h-4" aria-hidden="true" />
              <span>{busy === 'push' ? '正在推送…' : '推送到云端房间'}</span>
            </button>
            <button
              type="button"
              onClick={handlePull}
              disabled={busy !== null}
              className="min-h-[46px] px-3 rounded-xl bg-white/[0.08] border border-white/[0.1] text-white text-xs sm:text-sm font-semibold hover:bg-white/[0.14] disabled:opacity-50 inline-flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <CloudDownload className="w-4 h-4 text-[#D4FF2B]" aria-hidden="true" />
              <span>{busy === 'pull' ? '正在拉取…' : '拉取最新赛况'}</span>
            </button>
          </div>
        </div>

        {feedback && (
          <div
            role={feedback.type === 'err' ? 'alert' : 'status'}
            className={`rounded-xl px-3.5 py-2.5 text-xs leading-relaxed ${
              feedback.type === 'ok'
                ? 'bg-[#10261D] border border-[#22D38B]/35 text-[#7AEBC0]'
                : 'bg-[#2C1414] border border-[#FF6448]/35 text-[#FF9B89]'
            }`}
          >
            {feedback.text}
          </div>
        )}

        {/* Local JSON Archive Backup / Restore */}
        <div className="pt-3 border-t border-white/[0.08] space-y-2.5">
          <div className="text-xs font-bold text-[#8E9AB2]">本地 JSON 文件备份与恢复</div>
          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={handleExportFile}
              className="min-h-[44px] px-3 rounded-xl bg-[#171E2B] border border-white/[0.08] text-xs font-semibold text-[#D8E1F0] hover:border-white/25 inline-flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" aria-hidden="true" />
              <span>导出存档文件</span>
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="min-h-[44px] px-3 rounded-xl bg-[#171E2B] border border-white/[0.08] text-xs font-semibold text-[#D8E1F0] hover:border-white/25 inline-flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" aria-hidden="true" />
              <span>导入存档恢复</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json"
              onChange={handleImportFile}
              className="hidden"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
