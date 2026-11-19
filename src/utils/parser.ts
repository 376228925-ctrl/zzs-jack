import type { Gender, ParsedPlayerInput } from '../types/tournament';

const HEADER_SKIP_PATTERN =
  /^(#?接龙|(?:时间|地点|场地|费用|备注|规则|活动|主题)\s*[:：]|.*(?:转转赛|接龙|报名表|球局|活动通知)$)/;

/**
 * Intelligently parses Chinese WeChat group signup chains ("接龙") into player objects.
 * Supports formats like:
 * - "1. 林叙 男 3.5"
 * - "2、陈知夏 女 3.2"
 * - "③ 周越 (4.0)"
 * - "🔥 1. 顾北辰 男 4.1"
 * - "苏婉 F 3.4"
 */
export function parseWeChatRoster(rawText: string): ParsedPlayerInput[] {
  const lines = rawText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const results: ParsedPlayerInput[] = [];
  const seenNames = new Set<string>();

  for (const originalLine of lines) {
    if (HEADER_SKIP_PATTERN.test(originalLine)) {
      continue;
    }

    // Strip leading emojis / decorative symbols first, then numbering, then any leftover bullets
    let cleaned = originalLine
      .replace(/^[\p{Extended_Pictographic}\uFE0F\-•·*★☆✅☑️👉\s]+/u, '')
      .replace(/^(?:[\(（]?\d+[\)）]?[\.、\s\):：-]+|[①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳]\s*)/, '')
      .replace(/^[\p{Extended_Pictographic}\uFE0F\-•·*★☆✅☑️👉\s]+/u, '')
      .trim();

    if (!cleaned) continue;

    // Extract optional DUPR rating (2.0 - 6.0)
    let rating = 3.5;
    const ratingMatch = cleaned.match(
      /(?:DUPR\s*)?([2-5](?:\.\d{1,2})?|6(?:\.0)?)\s*(?:分|级|星)?(?=\s|$|[\)）])/i
    );
    if (ratingMatch) {
      const parsedRating = Number.parseFloat(ratingMatch[1]);
      if (parsedRating >= 2.0 && parsedRating <= 6.0) {
        rating = Number(parsedRating.toFixed(1));
        cleaned = cleaned.replace(ratingMatch[0], ' ').trim();
      }
    }

    // Extract optional gender (男/女/M/F/男生/女生) with optional wrapping parentheses
    let gender: Gender = 'U';
    const maleMatch = cleaned.match(/(?:^|\s)[\(（/]?(男生?|男|male|M)[\)）/]?(?=$|\s)/i);
    const femaleMatch = cleaned.match(/(?:^|\s)[\(（/]?(女生?|女|female|F)[\)）/]?(?=$|\s)/i);

    if (maleMatch) {
      gender = 'M';
      cleaned = cleaned.replace(maleMatch[0], ' ').trim();
    } else if (femaleMatch) {
      gender = 'F';
      cleaned = cleaned.replace(femaleMatch[0], ' ').trim();
    }

    // Strip leftover empty or unmatched parentheses, trailing punctuation, and collapse whitespace
    const name = cleaned
      .replace(/[\(（]\s*[\)）]/g, '')
      .replace(/^[@\s\(（]+/, '')
      .replace(/[\s/\)）]+$/, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (!name || name.length > 20) continue;

    const dedupeKey = name.toLowerCase();
    if (seenNames.has(dedupeKey)) continue;
    seenNames.add(dedupeKey);

    results.push({ name, gender, rating });
  }

  return results;
}
