import type {
  PlayerStanding,
  ScheduleFairnessReport,
  TournamentFormat,
  TournamentState,
} from '../types/tournament';
import type { PosterCopyResult } from './aiAnalysis';

export type PosterTheme = 'night_slam' | 'roland_clay' | 'swiss_ticket';

export const NIGHT_HERO_URL = '/src/assets/images/night_court_hero_1795079945626.jpg';

const FORMAT_LABELS: Record<TournamentFormat, string> = {
  classic: '经典全员转',
  balanced: '水平均衡转',
  mixed: '混双优选转',
  mexicano: '胜者升场制',
  ai_smart: 'AI 智适应排阵',
};

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function drawCoverImage(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  dx: number,
  dy: number,
  dw: number,
  dh: number
) {
  const imgRatio = img.naturalWidth / Math.max(1, img.naturalHeight);
  const boxRatio = dw / dh;
  let sx = 0;
  let sy = 0;
  let sw = img.naturalWidth;
  let sh = img.naturalHeight;

  if (imgRatio > boxRatio) {
    sw = img.naturalHeight * boxRatio;
    sx = (img.naturalWidth - sw) / 2;
  } else {
    sh = img.naturalWidth / boxRatio;
    sy = (img.naturalHeight - sh) / 2;
  }
  ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);
}

function drawWrappedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines: number
): number {
  const chars = Array.from(text);
  let line = '';
  let lineCount = 0;
  let currentY = y;

  for (let i = 0; i < chars.length; i++) {
    const testLine = line + chars[i];
    if (ctx.measureText(testLine).width > maxWidth && line.length > 0) {
      lineCount += 1;
      if (lineCount === maxLines) {
        ctx.fillText(line.slice(0, Math.max(1, line.length - 1)) + '…', x, currentY);
        return currentY + lineHeight;
      }
      ctx.fillText(line, x, currentY);
      line = chars[i];
      currentY += lineHeight;
    } else {
      line = testLine;
    }
  }
  if (line) {
    ctx.fillText(line, x, currentY);
    currentY += lineHeight;
  }
  return currentY;
}

function formatTodayDate(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}.${m}.${day}`;
}

export function getDefaultPosterCopy(
  state: TournamentState,
  standings: PlayerStanding[]
): PosterCopyResult {
  const mvp = standings[0];
  return {
    coverTitle: state.config.title,
    coverSub: `${state.config.venue || '夜场灯光硬地'} · ${FORMAT_LABELS[state.config.format]}`,
    mvpQuote:
      mvp && mvp.played > 0
        ? `${mvp.player.name} 以 ${mvp.wins} 胜与 ${
            mvp.pointDiff >= 0 ? `+${mvp.pointDiff}` : mvp.pointDiff
          } 净胜分统治中心球场，领衔今夜高燃转转赛。`
        : '全员轮转搭档，每一拍都在书写夜场硬地的高光时刻。',
  };
}

/**
 * Generates a 2x Retina (880px-wide) art-directed Editorial Sports Magazine Poster PNG.
 * Three curated studio editions:
 * 1. night_slam: Full-bleed floodlit photography + colossal condensed Volt typography + Swiss 2-col ledger
 * 2. roland_clay: Warm cotton fine-art print + burnt terracotta architectural court frame + espresso typography
 * 3. swiss_ticket: Metallic silver Swiss International match ticket stub with royal cobalt MVP block & barcode
 */
export async function renderPosterToDataUrl(
  state: TournamentState,
  standings: PlayerStanding[],
  fairness: ScheduleFairnessReport,
  theme: PosterTheme = 'night_slam',
  aiCopy?: PosterCopyResult | null,
  heroImageUrl?: string
): Promise<string> {
  const scale = 2;
  const width = 440;
  const height = 740;
  const copy = aiCopy ?? getDefaultPosterCopy(state, standings);

  const canvas = document.createElement('canvas');
  canvas.width = width * scale;
  canvas.height = height * scale;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  ctx.scale(scale, scale);

  const visibleRows = standings.slice(0, 8);
  const mvp = standings[0] ?? null;
  const completedMatches = state.rounds.reduce(
    (sum, r) => sum + r.matches.filter((m) => m.status === 'completed').length,
    0
  );
  const totalMatches = state.rounds.reduce((sum, r) => sum + r.matches.length, 0);
  const dateLabel = formatTodayDate();

  if (theme === 'night_slam') {
    await drawNightSlamPoster(ctx, width, height, {
      state,
      visibleRows,
      mvp,
      completedMatches,
      totalMatches,
      fairness,
      copy,
      dateLabel,
      heroImageUrl: heroImageUrl || NIGHT_HERO_URL,
    });
  } else if (theme === 'roland_clay') {
    drawRolandClayPoster(ctx, width, height, {
      state,
      visibleRows,
      mvp,
      completedMatches,
      totalMatches,
      fairness,
      copy,
      dateLabel,
    });
  } else {
    drawSwissTicketPoster(ctx, width, height, {
      state,
      visibleRows,
      mvp,
      completedMatches,
      totalMatches,
      fairness,
      copy,
      dateLabel,
    });
  }

  return canvas.toDataURL('image/png');
}

interface DrawPayload {
  state: TournamentState;
  visibleRows: PlayerStanding[];
  mvp: PlayerStanding | null;
  completedMatches: number;
  totalMatches: number;
  fairness: ScheduleFairnessReport;
  copy: PosterCopyResult;
  dateLabel: string;
  heroImageUrl?: string;
}

async function drawNightSlamPoster(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  data: DrawPayload
) {
  const { visibleRows, mvp, completedMatches, totalMatches, fairness, copy, dateLabel, state, heroImageUrl } = data;

  // 1. Obsidian editorial canvas
  ctx.fillStyle = '#070A10';
  ctx.fillRect(0, 0, w, h);

  // 2. Full-bleed scenic court photography (top 315px)
  const photoH = 315;
  const heroImg = await loadImage(heroImageUrl || NIGHT_HERO_URL);
  if (heroImg) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, w, photoH);
    ctx.clip();
    drawCoverImage(ctx, heroImg, 0, 0, w, photoH);
    ctx.restore();
  } else {
    const fallbackGrad = ctx.createLinearGradient(0, 0, w, photoH);
    fallbackGrad.addColorStop(0, '#0E2E7A');
    fallbackGrad.addColorStop(1, '#070A10');
    ctx.fillStyle = fallbackGrad;
    ctx.fillRect(0, 0, w, photoH);
  }

  // Deep dramatic gradient scrim into obsidian canvas
  const scrim = ctx.createLinearGradient(0, 0, 0, photoH);
  scrim.addColorStop(0, 'rgba(7, 10, 16, 0.45)');
  scrim.addColorStop(0.5, 'rgba(7, 10, 16, 0.38)');
  scrim.addColorStop(0.86, 'rgba(7, 10, 16, 0.92)');
  scrim.addColorStop(1, '#070A10');
  ctx.fillStyle = scrim;
  ctx.fillRect(0, 0, w, photoH + 2);

  // Top Volt Signature Bar
  ctx.fillStyle = '#D4FF2B';
  ctx.fillRect(28, 22, 42, 4);

  // Magazine Masthead
  ctx.fillStyle = '#D4FF2B';
  ctx.font = '700 11px "JetBrains Mono", "Noto Sans SC", monospace';
  ctx.fillText('NIGHT COURT EDITION // 轻转匹克', 28, 44);
  ctx.textAlign = 'right';
  ctx.fillStyle = 'rgba(255,255,255,0.82)';
  ctx.fillText(`${dateLabel} · ${completedMatches}/${totalMatches} MATCHES`, w - 28, 44);
  ctx.textAlign = 'left';

  // Colossal Watermark "01" overlapping horizon
  if (mvp) {
    ctx.fillStyle = 'rgba(212, 255, 43, 0.14)';
    ctx.font = 'italic 800 132px "Barlow Condensed", sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(
      mvp.pointDiff >= 0 ? `+${mvp.pointDiff}` : `${mvp.pointDiff}`,
      w - 18,
      268
    );
    ctx.textAlign = 'left';
  }

  // Main Magazine Cover Title
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '800 28px "Outfit", "Noto Sans SC", sans-serif';
  drawWrappedText(ctx, copy.coverTitle, 28, 178, w - 56, 35, 2);

  ctx.fillStyle = '#C6D2E6';
  ctx.font = '500 12.5px "Noto Sans SC", sans-serif';
  ctx.fillText(copy.coverSub.slice(0, 32), 28, 236);

  // Horizontal Hairline Rule
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(28, 260);
  ctx.lineTo(w - 28, 260);
  ctx.stroke();

  // Sculptural MVP Hero Block (Asymmetric split)
  if (mvp && mvp.played > 0) {
    ctx.fillStyle = '#D4FF2B';
    ctx.font = '700 11px "JetBrains Mono", "Noto Sans SC", monospace';
    ctx.fillText('CHAMPION / NIGHT MVP', 28, 286);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = '800 34px "Outfit", "Noto Sans SC", sans-serif';
    ctx.fillText(mvp.player.name, 28, 326);

    ctx.fillStyle = '#9AA5BC';
    ctx.font = '600 12px "JetBrains Mono", "Noto Sans SC", monospace';
    const partnerSuffix = mvp.bestPartner ? ` · 最佳拍档 ${mvp.bestPartner.partnerName}` : '';
    ctx.fillText(
      `${mvp.wins}W-${mvp.losses}L · 胜率 ${Math.round(mvp.winRate * 100)}%${partnerSuffix}`,
      28,
      350
    );

    // Colossal Optic Volt Stat on Right
    ctx.textAlign = 'right';
    ctx.fillStyle = '#D4FF2B';
    ctx.font = 'italic 800 58px "Barlow Condensed", sans-serif';
    ctx.fillText(mvp.pointDiff >= 0 ? `+${mvp.pointDiff}` : `${mvp.pointDiff}`, w - 28, 336);
    ctx.fillStyle = '#8E9AB2';
    ctx.font = '600 10.5px "Noto Sans SC", sans-serif';
    ctx.fillText('NET DIFF · 净胜分', w - 28, 353);
    ctx.textAlign = 'left';
  }

  // Editorial AI Pull-Quote Strip
  ctx.fillStyle = '#D4FF2B';
  ctx.fillRect(28, 374, 3, 42);
  ctx.fillStyle = '#D8E1F0';
  ctx.font = '500 12.5px "Noto Sans SC", sans-serif';
  drawWrappedText(ctx, `“${copy.mvpQuote}”`, 42, 390, w - 72, 19, 2);

  // 2-Column Swiss Typographic Roster Ledger (NO Spreadsheet Boxes!)
  const ledgerTop = 442;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)';
  ctx.beginPath();
  ctx.moveTo(28, ledgerTop);
  ctx.lineTo(w - 28, ledgerTop);
  ctx.stroke();

  ctx.fillStyle = '#8E9AB2';
  ctx.font = '700 10.5px "JetBrains Mono", "Noto Sans SC", monospace';
  ctx.fillText('OFFICIAL STANDINGS // 战绩总榜', 28, ledgerTop + 20);
  ctx.textAlign = 'right';
  ctx.fillText(`${state.config.targetScore} PTS · ${FORMAT_LABELS[state.config.format]}`, w - 28, ledgerTop + 20);
  ctx.textAlign = 'left';

  const colW = (w - 56 - 20) / 2;
  const rowH = 52;
  visibleRows.forEach((row, idx) => {
    const col = idx < 4 ? 0 : 1;
    const r = idx % 4;
    const x = 28 + col * (colW + 20);
    const y = ledgerTop + 34 + r * rowH;

    // Hairline bottom divider
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.beginPath();
    ctx.moveTo(x, y + rowH - 4);
    ctx.lineTo(x + colW, y + rowH - 4);
    ctx.stroke();

    // Oversized italic index
    ctx.fillStyle = row.rank === 1 ? '#D4FF2B' : row.rank <= 3 ? '#7BB1FF' : '#58647A';
    ctx.font = 'italic 800 22px "Barlow Condensed", sans-serif';
    ctx.fillText(String(row.rank).padStart(2, '0'), x, y + 26);

    // Name + record
    ctx.fillStyle = '#F4F7FB';
    ctx.font = '700 14px "Noto Sans SC", sans-serif';
    ctx.fillText(row.player.name.slice(0, 6), x + 30, y + 21);

    ctx.fillStyle = '#8E9AB2';
    ctx.font = '500 11px "JetBrains Mono", monospace';
    ctx.fillText(`${row.wins}W-${row.losses}L · ${row.player.rating.toFixed(1)}`, x + 30, y + 38);

    // Right point diff
    ctx.textAlign = 'right';
    ctx.fillStyle = row.pointDiff > 0 ? '#22D38B' : row.pointDiff < 0 ? '#FF6448' : '#8E9AB2';
    ctx.font = 'italic 800 20px "Barlow Condensed", monospace';
    ctx.fillText(row.pointDiff > 0 ? `+${row.pointDiff}` : `${row.pointDiff}`, x + colW, y + 28);
    ctx.textAlign = 'left';
  });

  // Footer Colophon
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)';
  ctx.beginPath();
  ctx.moveTo(28, h - 54);
  ctx.lineTo(w - 28, h - 54);
  ctx.stroke();

  ctx.fillStyle = '#8E9AB2';
  ctx.font = '600 10.5px "JetBrains Mono", "Noto Sans SC", monospace';
  ctx.fillText(`搭档不重复 ${fairness.partnerUniquenessPct}%  ·  公平度 ${fairness.compositeScore}`, 28, h - 28);
  ctx.textAlign = 'right';
  ctx.fillStyle = '#D4FF2B';
  ctx.fillText('PICKLEFLOW // 轻转匹克', w - 28, h - 28);
  ctx.textAlign = 'left';
}

function drawRolandClayPoster(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  data: DrawPayload
) {
  const { visibleRows, mvp, completedMatches, totalMatches, fairness, copy, dateLabel, state } = data;

  // Fine-Art Warm Cotton Paper
  ctx.fillStyle = '#F4EDE2';
  ctx.fillRect(0, 0, w, h);

  // Double Swiss Fine-Art Frame
  ctx.strokeStyle = '#181411';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(18, 18, w - 36, h - 36);
  ctx.strokeStyle = 'rgba(24, 20, 17, 0.25)';
  ctx.lineWidth = 0.75;
  ctx.strokeRect(23, 23, w - 46, h - 46);

  // Masthead
  ctx.fillStyle = '#C94A29';
  ctx.font = '700 11px "JetBrains Mono", "Noto Sans SC", monospace';
  ctx.fillText('EDITION TERRE BATTUE // 轻转匹克画报', 36, 48);
  ctx.textAlign = 'right';
  ctx.fillStyle = '#574E46';
  ctx.fillText(dateLabel, w - 36, 48);
  ctx.textAlign = 'left';

  // Bold Editorial Title
  ctx.fillStyle = '#181411';
  ctx.font = '800 28px "Outfit", "Noto Sans SC", sans-serif';
  drawWrappedText(ctx, copy.coverTitle, 36, 88, w - 72, 34, 2);

  ctx.fillStyle = '#6B5E53';
  ctx.font = '500 12px "Noto Sans SC", sans-serif';
  ctx.fillText(copy.coverSub.slice(0, 34), 36, 138);

  // Architectural Clay Court Graphic Block (Terracotta + Chalk Lines)
  const courtX = 36;
  const courtY = 156;
  const courtW = w - 72;
  const courtH = 178;

  ctx.fillStyle = '#C94A29';
  ctx.fillRect(courtX, courtY, courtW, courtH);

  // Crisp Architectural Chalk Geometry inside Clay Court
  ctx.strokeStyle = 'rgba(244, 237, 226, 0.52)';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(courtX + 16, courtY + 14, courtW - 32, courtH - 28);
  ctx.beginPath();
  ctx.moveTo(courtX + courtW * 0.5, courtY + 14);
  ctx.lineTo(courtX + courtW * 0.5, courtY + courtH - 14);
  ctx.moveTo(courtX + courtW * 0.34, courtY + 14);
  ctx.lineTo(courtX + courtW * 0.34, courtY + courtH - 14);
  ctx.moveTo(courtX + courtW * 0.66, courtY + 14);
  ctx.lineTo(courtX + courtW * 0.66, courtY + courtH - 14);
  ctx.stroke();

  // MVP Sculptural Overlay inside Terracotta Court
  if (mvp && mvp.played > 0) {
    ctx.fillStyle = 'rgba(244, 237, 226, 0.88)';
    ctx.font = '700 11px "JetBrains Mono", "Noto Sans SC", monospace';
    ctx.fillText('NO.01 CHAMPION · 本场 MVP', courtX + 26, courtY + 42);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = '800 38px "Outfit", "Noto Sans SC", sans-serif';
    ctx.fillText(mvp.player.name, courtX + 26, courtY + 94);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.font = '600 12px "JetBrains Mono", "Noto Sans SC", monospace';
    ctx.fillText(
      `${mvp.wins}胜 ${mvp.losses}负 · 胜率 ${Math.round(mvp.winRate * 100)}%`,
      courtX + 26,
      courtY + 124
    );

    if (mvp.bestPartner) {
      ctx.fillText(`最佳搭档 · ${mvp.bestPartner.partnerName}`, courtX + 26, courtY + 146);
    }

    ctx.textAlign = 'right';
    ctx.fillStyle = '#F4EDE2';
    ctx.font = 'italic 800 72px "Barlow Condensed", sans-serif';
    ctx.fillText(
      mvp.pointDiff >= 0 ? `+${mvp.pointDiff}` : `${mvp.pointDiff}`,
      courtX + courtW - 24,
      courtY + 114
    );
    ctx.font = '600 11px "Noto Sans SC", sans-serif';
    ctx.fillText('净胜分差', courtX + courtW - 24, courtY + 142);
    ctx.textAlign = 'left';
  }

  // Editorial Quote on Paper
  ctx.fillStyle = '#181411';
  ctx.font = '600 13px "Noto Sans SC", sans-serif';
  drawWrappedText(ctx, `“${copy.mvpQuote}”`, 36, 366, w - 72, 20, 2);

  // Fine-art Hairline Rule
  ctx.strokeStyle = '#181411';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(36, 412);
  ctx.lineTo(w - 36, 412);
  ctx.stroke();

  ctx.fillStyle = '#6B5E53';
  ctx.font = '700 10.5px "JetBrains Mono", "Noto Sans SC", monospace';
  ctx.fillText('CLASSEMENT // 完整排名', 36, 434);
  ctx.textAlign = 'right';
  ctx.fillText(`${completedMatches}/${totalMatches} MATCHES · ${state.config.targetScore}分制`, w - 36, 434);
  ctx.textAlign = 'left';

  // 2-Column Editorial List
  const colW = (w - 72 - 22) / 2;
  const rowH = 52;
  visibleRows.forEach((row, idx) => {
    const col = idx < 4 ? 0 : 1;
    const r = idx % 4;
    const x = 36 + col * (colW + 22);
    const y = 448 + r * rowH;

    ctx.strokeStyle = 'rgba(24, 20, 17, 0.14)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, y + rowH - 4);
    ctx.lineTo(x + colW, y + rowH - 4);
    ctx.stroke();

    ctx.fillStyle = row.rank === 1 ? '#C94A29' : '#181411';
    ctx.font = 'italic 800 22px "Barlow Condensed", sans-serif';
    ctx.fillText(String(row.rank).padStart(2, '0'), x, y + 26);

    ctx.fillStyle = '#181411';
    ctx.font = '700 14px "Noto Sans SC", sans-serif';
    ctx.fillText(row.player.name.slice(0, 6), x + 28, y + 21);

    ctx.fillStyle = '#6B5E53';
    ctx.font = '500 11px "JetBrains Mono", monospace';
    ctx.fillText(`${row.wins}W-${row.losses}L · ${row.player.rating.toFixed(1)}`, x + 28, y + 38);

    ctx.textAlign = 'right';
    ctx.fillStyle = row.pointDiff > 0 ? '#1A7A52' : row.pointDiff < 0 ? '#C94A29' : '#6B5E53';
    ctx.font = 'italic 800 20px "Barlow Condensed", monospace';
    ctx.fillText(row.pointDiff > 0 ? `+${row.pointDiff}` : `${row.pointDiff}`, x + colW, y + 28);
    ctx.textAlign = 'left';
  });

  // Fine-Art Colophon Footer
  ctx.fillStyle = '#6B5E53';
  ctx.font = '600 10.5px "JetBrains Mono", "Noto Sans SC", monospace';
  ctx.fillText(`不重复搭档 ${fairness.partnerUniquenessPct}% · 公平 ${fairness.compositeScore}`, 36, h - 38);
  ctx.textAlign = 'right';
  ctx.fillStyle = '#C94A29';
  ctx.fillText('LE JOURNAL DU PICKLEBALL', w - 36, h - 38);
  ctx.textAlign = 'left';
}

function drawSwissTicketPoster(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  data: DrawPayload
) {
  const { visibleRows, mvp, completedMatches, totalMatches, fairness, copy, dateLabel, state } = data;

  // Metallic Silver-White Swiss Paper
  ctx.fillStyle = '#ECEFF4';
  ctx.fillRect(0, 0, w, h);

  // Jet Black Outer Grid Header Strip
  ctx.fillStyle = '#0A0D12';
  ctx.fillRect(0, 0, w, 58);

  ctx.fillStyle = '#D4FF2B';
  ctx.font = '700 11px "JetBrains Mono", monospace';
  ctx.fillText('MATCH PASS // OFFICIAL RESULT TICKET', 24, 34);
  ctx.textAlign = 'right';
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText(`NO.${dateLabel.replace(/\./g, '')}`, w - 24, 34);
  ctx.textAlign = 'left';

  // Royal Cobalt Asymmetric Hero Block
  const heroY = 76;
  const heroH = 196;
  ctx.fillStyle = '#133EE6';
  ctx.fillRect(24, heroY, w - 48, heroH);

  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.font = '600 11px "JetBrains Mono", "Noto Sans SC", monospace';
  ctx.fillText(`${FORMAT_LABELS[state.config.format]} · ${state.config.targetScore}分制`, 42, heroY + 30);

  ctx.fillStyle = '#FFFFFF';
  ctx.font = '800 26px "Outfit", "Noto Sans SC", sans-serif';
  drawWrappedText(ctx, copy.coverTitle, 42, heroY + 64, w - 84, 32, 2);

  if (mvp && mvp.played > 0) {
    ctx.strokeStyle = 'rgba(255,255,255,0.28)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(42, heroY + 114);
    ctx.lineTo(w - 42, heroY + 114);
    ctx.stroke();

    ctx.fillStyle = '#D4FF2B';
    ctx.font = '700 11px "JetBrains Mono", "Noto Sans SC", monospace';
    ctx.fillText('MVP LEADER', 42, heroY + 136);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = '800 30px "Noto Sans SC", sans-serif';
    ctx.fillText(mvp.player.name, 42, heroY + 172);

    ctx.textAlign = 'right';
    ctx.fillStyle = '#D4FF2B';
    ctx.font = 'italic 800 54px "Barlow Condensed", sans-serif';
    ctx.fillText(
      mvp.pointDiff >= 0 ? `+${mvp.pointDiff}` : `${mvp.pointDiff}`,
      w - 42,
      heroY + 176
    );
    ctx.textAlign = 'left';
  }

  // Ticket Perforation Cutout Notches + Dashed Tear Line
  const tearY = 294;
  ctx.strokeStyle = '#0A0D12';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([5, 5]);
  ctx.beginPath();
  ctx.moveTo(24, tearY);
  ctx.lineTo(w - 24, tearY);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.fillStyle = '#0A0D12';
  ctx.beginPath();
  ctx.arc(0, tearY, 12, -Math.PI / 2, Math.PI / 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(w, tearY, 12, Math.PI / 2, (Math.PI * 3) / 2);
  ctx.fill();

  // Pull Quote Box
  ctx.fillStyle = '#0A0D12';
  ctx.font = '600 12.5px "Noto Sans SC", sans-serif';
  drawWrappedText(ctx, `“${copy.mvpQuote}”`, 24, 326, w - 48, 19, 2);

  // Strict Swiss Grid Metadata Cells
  const metaY = 368;
  ctx.strokeStyle = '#0A0D12';
  ctx.lineWidth = 1.2;
  ctx.strokeRect(24, metaY, w - 48, 46);
  ctx.beginPath();
  ctx.moveTo(24 + (w - 48) / 3, metaY);
  ctx.lineTo(24 + (w - 48) / 3, metaY + 46);
  ctx.moveTo(24 + ((w - 48) * 2) / 3, metaY);
  ctx.lineTo(24 + ((w - 48) * 2) / 3, metaY + 46);
  ctx.stroke();

  const cells = [
    { label: 'MATCHES', val: `${completedMatches}/${totalMatches}` },
    { label: 'UNIQUE PAIR', val: `${fairness.partnerUniquenessPct}%` },
    { label: 'FAIRNESS', val: `${fairness.compositeScore} PTS` },
  ];
  cells.forEach((cell, i) => {
    const cx = 34 + i * ((w - 48) / 3);
    ctx.fillStyle = '#536073';
    ctx.font = '700 9.5px "JetBrains Mono", monospace';
    ctx.fillText(cell.label, cx, metaY + 17);
    ctx.fillStyle = '#0A0D12';
    ctx.font = 'italic 800 18px "Barlow Condensed", monospace';
    ctx.fillText(cell.val, cx, metaY + 38);
  });

  // 2-Column Clean Black-Ink Swiss Roster
  const colW = (w - 48 - 20) / 2;
  const rowH = 50;
  visibleRows.forEach((row, idx) => {
    const col = idx < 4 ? 0 : 1;
    const r = idx % 4;
    const x = 24 + col * (colW + 20);
    const y = 434 + r * rowH;

    ctx.strokeStyle = 'rgba(10, 13, 18, 0.16)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, y + rowH - 4);
    ctx.lineTo(x + colW, y + rowH - 4);
    ctx.stroke();

    ctx.fillStyle = row.rank === 1 ? '#133EE6' : '#0A0D12';
    ctx.font = 'italic 800 21px "Barlow Condensed", sans-serif';
    ctx.fillText(String(row.rank).padStart(2, '0'), x, y + 25);

    ctx.fillStyle = '#0A0D12';
    ctx.font = '700 13.5px "Noto Sans SC", sans-serif';
    ctx.fillText(row.player.name.slice(0, 6), x + 28, y + 20);

    ctx.fillStyle = '#536073';
    ctx.font = '500 10.5px "JetBrains Mono", monospace';
    ctx.fillText(`${row.wins}W-${row.losses}L · ${row.player.rating.toFixed(1)}`, x + 28, y + 36);

    ctx.textAlign = 'right';
    ctx.fillStyle = row.pointDiff > 0 ? '#0E8A58' : row.pointDiff < 0 ? '#D93B26' : '#536073';
    ctx.font = 'italic 800 19px "Barlow Condensed", monospace';
    ctx.fillText(row.pointDiff > 0 ? `+${row.pointDiff}` : `${row.pointDiff}`, x + colW, y + 27);
    ctx.textAlign = 'left';
  });

  // Authentic Swiss Ticket Barcode Footer
  const barY = h - 72;
  ctx.fillStyle = '#0A0D12';
  const pattern = [2, 1, 3, 1, 1, 2, 4, 1, 2, 1, 1, 3, 2, 1, 2, 2, 1, 3, 1, 2, 1, 3, 1, 2, 2, 1];
  let bx = 24;
  pattern.forEach((units, i) => {
    const bw = units * 2;
    if (i % 2 === 0) {
      ctx.fillRect(bx, barY, bw, 34);
    }
    bx += bw + 2;
  });

  ctx.textAlign = 'right';
  ctx.fillStyle = '#0A0D12';
  ctx.font = '700 11px "JetBrains Mono", "Noto Sans SC", monospace';
  ctx.fillText('轻转匹克 · ADMIT ONE', w - 24, barY + 14);
  ctx.fillStyle = '#536073';
  ctx.font = '500 10px "Noto Sans SC", sans-serif';
  ctx.fillText((state.config.venue || '夜场硬地匹克球').slice(0, 18), w - 24, barY + 32);
  ctx.textAlign = 'left';
}
