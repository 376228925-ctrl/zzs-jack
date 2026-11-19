import test from 'node:test';
import assert from 'node:assert/strict';
import { parseWeChatRoster } from './parser';

test('parseWeChatRoster parses numbered Chinese WeChat signup chain with gender and DUPR', () => {
  const input = `
#接龙
周六晚匹克球转转赛
时间：19:00-21:00
1. 林叙 男 4.0
2、陈知夏 女 3.6
③ 周越 3.8
4) 苏婉 F 3.4
5. 阿杰
  `;

  const parsed = parseWeChatRoster(input);
  assert.equal(parsed.length, 5);

  assert.deepEqual(parsed[0], { name: '林叙', gender: 'M', rating: 4.0 });
  assert.deepEqual(parsed[1], { name: '陈知夏', gender: 'F', rating: 3.6 });
  assert.deepEqual(parsed[2], { name: '周越', gender: 'U', rating: 3.8 });
  assert.deepEqual(parsed[3], { name: '苏婉', gender: 'F', rating: 3.4 });
  assert.deepEqual(parsed[4], { name: '阿杰', gender: 'U', rating: 3.5 });
});

test('parseWeChatRoster deduplicates repeated names and strips emojis', () => {
  const input = `
🔥 1. 顾北辰 男 4.1
2. 顾北辰 男 4.1
✅ 3. 许清宁 (女) DUPR 3.5
  `;

  const parsed = parseWeChatRoster(input);
  assert.equal(parsed.length, 2);
  assert.equal(parsed[0].name, '顾北辰');
  assert.equal(parsed[1].name, '许清宁');
  assert.equal(parsed[1].gender, 'F');
  assert.equal(parsed[1].rating, 3.5);
});
