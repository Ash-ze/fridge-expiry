import { describe, it, expect } from 'vitest';
import { parseBatchText, parseNumber, draftsFromText, draftFromEntry } from '../src/lib/batch.js';
import { addDays } from '../src/lib/expiry.js';

const T = '2026-10-21';
const simple = (text) => parseBatchText(text).map((e) => [e.name, e.qty, e.unit]);

describe('购物清单模式：解析文字', () => {
  it('逗号分隔、数量写在后面', () => {
    expect(simple('牛奶 2, 鸡蛋 10, 西红柿 3')).toEqual([
      ['牛奶', 2, ''],
      ['鸡蛋', 10, ''],
      ['西红柿', 3, ''],
    ]);
  });
  it('中文标点、换行、单位、乘号', () => {
    expect(simple('牛奶2盒，鸡蛋10个、西红柿×3；猪肉 500克\n豆腐 x2')).toEqual([
      ['牛奶', 2, '盒'],
      ['鸡蛋', 10, '个'],
      ['西红柿', 3, ''],
      ['猪肉', 500, '克'],
      ['豆腐', 2, ''],
    ]);
  });
  it('数量写在前面、中文数字', () => {
    expect(simple('两盒豆腐, 一条鱼, 半个西瓜, 十二个鸡蛋, 牛奶两盒, 500g猪肉')).toEqual([
      ['豆腐', 2, '盒'],
      ['鱼', 1, '条'],
      ['西瓜', 0.5, '个'],
      ['鸡蛋', 12, '个'],
      ['牛奶', 2, '盒'],
      ['猪肉', 500, 'g'],
    ]);
  });
  it('只用空格分隔，单位单独写', () => {
    expect(simple('牛奶 2 盒 鸡蛋 10 菠菜')).toEqual([
      ['牛奶', 2, '盒'],
      ['鸡蛋', 10, ''],
      ['菠菜', 1, ''],
    ]);
  });
  it('名称里本来就有数字字的食材不被拆开', () => {
    expect(simple('三文鱼, 五花肉 1, 四季豆')).toEqual([
      ['三文鱼', 1, ''],
      ['五花肉', 1, ''],
      ['四季豆', 1, ''],
    ]);
  });
  it('空输入与多余分隔符', () => {
    expect(parseBatchText('')).toEqual([]);
    expect(parseBatchText(' ,，、\n ')).toEqual([]);
  });
  it('parseNumber', () => {
    expect(parseNumber('3')).toBe(3);
    expect(parseNumber('2.5')).toBe(2.5);
    expect(parseNumber('两')).toBe(2);
    expect(parseNumber('十')).toBe(10);
    expect(parseNumber('二十三')).toBe(23);
    expect(parseNumber('半')).toBe(0.5);
    expect(parseNumber('很多')).toBeNaN();
  });
});

describe('购物清单模式：默认值', () => {
  it('按食材库补上存放位置、图标和到期日', () => {
    const [milk, potato, unknown] = draftsFromText('牛奶 2, 土豆 3, 神秘食材', T);
    expect(milk).toMatchObject({ name: '牛奶', qty: 2, storage: 'fridge', emoji: '🥛', known: true, expiryDate: addDays(T, 7) });
    expect(potato).toMatchObject({ storage: 'pantry', expiryDate: addDays(T, 30) });
    expect(unknown).toMatchObject({ name: '神秘食材', known: false, storage: 'fridge', expiryDate: '' });
  });
  it('别名同样能识别', () => {
    expect(draftFromEntry({ name: '番茄', qty: 1 }, T)).toMatchObject({ category: 'veg', expiryDate: addDays(T, 7) });
  });
});
