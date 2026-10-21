import { describe, it, expect } from 'vitest';
import {
  addDays, diffDays, daysLeft, urgencyOf, remainingText, suggestExpiry, sortByUrgency,
  groupByUrgency, summarize, bannerText, monthlyStats, isValidISODate, toISODate,
  earlierDate, openedExpiryFor, markOpened, unmarkOpened, consumePortion, defaultPortion,
} from '../src/lib/expiry.js';
import { FOODS, findFood, resolveFood, searchFoods, parseSpec, describeShelfLife, describeOpened } from '../src/data/foods.js';

const T = '2026-10-21';
const item = (name, expiryDate, extra = {}) => ({ id: name, name, expiryDate, storage: 'fridge', status: 'active', ...extra });

describe('日期计算', () => {
  it('addDays 跨月、跨年、闰年', () => {
    expect(addDays('2026-10-30', 3)).toBe('2026-11-02');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });
  it('diffDays 不受夏令时影响', () => {
    expect(diffDays('2026-03-07', '2026-03-09')).toBe(2);
    expect(diffDays('2026-10-31', '2026-11-02')).toBe(2);
  });
  it('isValidISODate', () => {
    expect(isValidISODate('2026-02-29')).toBe(false);
    expect(isValidISODate('2028-02-29')).toBe(true);
    expect(isValidISODate('2026/10/21')).toBe(false);
    expect(isValidISODate(undefined)).toBe(false);
  });
  it('toISODate 使用本地日期', () => {
    expect(toISODate(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
  });
});

describe('紧急程度', () => {
  it('daysLeft 与 urgencyOf 边界', () => {
    expect(daysLeft('2026-10-20', T)).toBe(-1);
    expect(urgencyOf(-1)).toBe('expired');
    expect(urgencyOf(0)).toBe('today');
    expect(urgencyOf(1)).toBe('soon');
    expect(urgencyOf(3)).toBe('soon');
    expect(urgencyOf(4)).toBe('normal');
  });
  it('remainingText 中文文案', () => {
    expect(remainingText(-2)).toBe('已过期 2 天');
    expect(remainingText(0)).toBe('今天到期');
    expect(remainingText(1)).toBe('明天到期');
    expect(remainingText(5)).toBe('还剩 5 天');
  });
  it('按紧急程度排序与分组', () => {
    const items = [
      item('苹果', '2026-11-10'),
      item('豆腐', '2026-10-21'),
      item('牛奶', '2026-10-19'),
      item('生菜', '2026-10-23'),
      item('鸡蛋', '2026-10-24'),
      item('酸奶', '2026-10-25'),
    ];
    expect(sortByUrgency(items, T).map((i) => i.name)).toEqual(['牛奶', '豆腐', '生菜', '鸡蛋', '酸奶', '苹果']);
    const g = groupByUrgency(items, T);
    expect(g.expired.map((i) => i.name)).toEqual(['牛奶']);
    expect(g.today.map((i) => i.name)).toEqual(['豆腐']);
    expect(g.soon.map((i) => i.name)).toEqual(['生菜', '鸡蛋']);
    expect(g.normal.map((i) => i.name)).toEqual(['酸奶', '苹果']);
  });
  it('summarize 忽略已处理物品，bannerText 生成提醒', () => {
    const items = [
      item('牛奶', '2026-10-19'),
      item('豆腐', '2026-10-21'),
      item('鸡蛋', '2026-10-21', { status: 'eaten' }),
      item('苹果', '2026-11-10'),
    ];
    const s = summarize(items, T);
    expect(s).toEqual({ expired: 1, today: 1, soon: 0, normal: 1, total: 3 });
    expect(bannerText(s)).toBe('冰箱提醒：1 件已过期，1 件今天到期');
    expect(bannerText({ expired: 0, today: 0, soon: 0 })).toBeNull();
  });
});

describe('默认到期日', () => {
  it('牛奶冷藏7天、鸡蛋冷藏30天、豆腐冷藏3天', () => {
    expect(suggestExpiry('牛奶', 'fridge', T)).toBe('2026-10-28');
    expect(suggestExpiry('鸡蛋', 'fridge', T)).toBe('2026-11-20');
    expect(suggestExpiry('豆腐', 'fridge', T)).toBe('2026-10-24');
  });
  it('区间取短的一端，别名可识别', () => {
    expect(suggestExpiry('菠菜', 'fridge', T)).toBe('2026-10-24');
    expect(suggestExpiry('番茄', 'fridge', T)).toBe('2026-10-28');
    expect(suggestExpiry('有机纯牛奶', 'fridge', T)).toBe('2026-10-28');
  });
  it('换存放位置会改变到期日；冷冻无数据时按冷藏推算', () => {
    expect(suggestExpiry('猪肉', 'freezer', T)).toBe(addDays(T, 90));
    expect(suggestExpiry('牛奶', 'freezer', T)).toBe(addDays(T, 70));
    expect(suggestExpiry('牛奶', 'pantry', T)).toBeNull();
    expect(suggestExpiry('不存在的东西', 'fridge', T)).toBeNull();
  });
  it('蛋、果蔬、饮料不按冷冻推算；未开封放冷藏沿用常温天数', () => {
    expect(suggestExpiry('鸡蛋', 'freezer', T)).toBeNull();
    expect(suggestExpiry('生菜', 'freezer', T)).toBeNull();
    expect(suggestExpiry('可乐', 'freezer', T)).toBeNull();
    expect(suggestExpiry('鸡蛋', 'pantry', T)).toBe(addDays(T, 14));
    expect(suggestExpiry('酱油', 'fridge', T)).toBe(addDays(T, 365));
    expect(suggestExpiry('香蕉', 'fridge', T)).toBe(addDays(T, 5));
  });
});

describe('已开封', () => {
  it('开封保质期：牛奶 2-3 天、酸奶 1-2 天，冷冻或无数据返回 null', () => {
    expect(describeOpened(findFood('牛奶'))).toBe('开封后2-3天');
    expect(describeShelfLife(findFood('牛奶'))).toBe('冷藏7天 · 开封后2-3天');
    expect(openedExpiryFor('牛奶', 'fridge', T)).toBe(addDays(T, 2));
    expect(openedExpiryFor('酸奶', 'fridge', T)).toBe(addDays(T, 1));
    expect(openedExpiryFor('酱油', 'pantry', T)).toBe(addDays(T, 90));
    expect(openedExpiryFor('牛奶', 'freezer', T)).toBeNull();
    expect(openedExpiryFor('苹果', 'fridge', T)).toBeNull();
    expect(openedExpiryFor('牛奶', 'fridge', 'bad')).toBeNull();
  });
  it('标记开封只会提前到期日，取消后恢复', () => {
    const milk = item('牛奶', addDays(T, 7));
    const opened = markOpened(milk, T);
    expect(opened).toMatchObject({ opened: true, openedDate: T, expiryBeforeOpen: addDays(T, 7), expiryDate: addDays(T, 2) });
    expect(markOpened(opened, T)).toBe(opened);
    expect(unmarkOpened(opened)).toEqual(milk);
    // 本来就快到期了：不会被延后
    const old = markOpened(item('牛奶', addDays(T, 1)), T);
    expect(old.expiryDate).toBe(addDays(T, 1));
    // 没有开封数据：只做标记
    expect(markOpened(item('苹果', addDays(T, 20)), T).expiryDate).toBe(addDays(T, 20));
    expect(unmarkOpened(milk)).toBe(milk);
  });
  it('earlierDate', () => {
    expect(earlierDate('2026-10-22', '2026-10-21')).toBe('2026-10-21');
    expect(earlierDate('2026-10-22', null)).toBe('2026-10-22');
    expect(earlierDate('', 'x')).toBeNull();
  });
});

describe('吃一部分', () => {
  it('减少数量，吃完时记为吃掉了', () => {
    const it2 = item('鸡蛋', addDays(T, 10), { qty: 10, unit: '个' });
    const r = consumePortion(it2, 3, T);
    expect(r).toMatchObject({ finished: false, left: 7 });
    expect(r.item).toMatchObject({ qty: 7, status: 'active' });
    const done = consumePortion(r.item, 7, T);
    expect(done.finished).toBe(true);
    expect(done.item).toMatchObject({ status: 'eaten', doneAt: T, qty: 7 });
    expect(consumePortion(r.item, 99, T).finished).toBe(true);
  });
  it('小数不产生浮点误差，非法数量报错', () => {
    expect(consumePortion(item('牛奶', T, { qty: 1 }), 0.7, T).left).toBe(0.3);
    expect(() => consumePortion(item('牛奶', T, { qty: 1 }), 0, T)).toThrow();
    expect(() => consumePortion(item('牛奶', T, { qty: 1 }), 'x', T)).toThrow();
  });
  it('默认吃多少', () => {
    expect(defaultPortion(5)).toBe(1);
    expect(defaultPortion(1)).toBe(0.5);
    expect(defaultPortion(undefined)).toBe(0.5);
  });
});

describe('月度统计', () => {
  it('只统计本月的吃掉/扔掉', () => {
    const items = [
      item('a', T, { status: 'eaten', doneAt: '2026-10-02' }),
      item('b', T, { status: 'eaten', doneAt: '2026-10-20' }),
      item('c', T, { status: 'thrown', doneAt: '2026-10-21' }),
      item('d', T, { status: 'thrown', doneAt: '2026-09-30' }),
      item('e', T),
    ];
    const s = monthlyStats(items, T);
    expect(s).toMatchObject({ month: '2026-10', eaten: 2, thrown: 1, total: 3 });
    expect(s.wasteRate).toBeCloseTo(1 / 3);
  });
});

describe('内置食材库', () => {
  it('约 150 种以上且名称唯一', () => {
    expect(FOODS.length).toBeGreaterThanOrEqual(150);
    expect(new Set(FOODS.map((f) => f.name)).size).toBe(FOODS.length);
  });
  it('解析规格', () => {
    expect(parseSpec('冷藏3-5 冷冻30')).toEqual({ order: ['fridge', 'freezer'], days: { fridge: { min: 3, max: 5 }, freezer: { min: 30, max: 30 } } });
    expect(parseSpec('冷藏7 开封2-3')).toEqual({ order: ['fridge'], days: { fridge: { min: 7, max: 7 } }, opened: { min: 2, max: 3 } });
    expect(() => parseSpec('冰箱7')).toThrow();
    expect(() => parseSpec('冷藏5-3')).toThrow();
    expect(() => parseSpec('开封3')).toThrow();
    expect(describeShelfLife(findFood('叶菜'))).toBe('冷藏3-5天');
  });
  it('别名与模糊识别', () => {
    expect(findFood('番茄').name).toBe('西红柿');
    expect(resolveFood('土鸡蛋').name).toBe('鸡蛋');
    expect(resolveFood('进口车厘子').name).toBe('樱桃');
    expect(resolveFood('')).toBeNull();
  });
  it('自动补全前缀优先', () => {
    const r = searchFoods('鸡');
    expect(r[0].name).toBe('鸡蛋');
    expect(r.map((f) => f.name)).toContain('鸡胸肉');
    expect(searchFoods('西蓝')[0].name).toBe('西兰花');
    expect(searchFoods('')).toEqual([]);
  });
});

describe('保质期数值合理性', () => {
  const all = (f) => Object.values(f.days);
  it('所有天数为正且在合理范围内', () => {
    for (const f of FOODS) {
      for (const [k, d] of Object.entries(f.days)) {
        expect(d.min, `${f.name} ${k}`).toBeGreaterThan(0);
        expect(d.max, `${f.name} ${k}`).toBeLessThanOrEqual(k === 'pantry' ? 730 : 365);
      }
    }
  });
  it('生鲜肉禽水产冷藏不超过一周', () => {
    for (const f of FOODS) {
      if (!['meat', 'poultry', 'seafood'].includes(f.category) || f.days.pantry || !f.days.fridge) continue;
      expect(f.days.fridge.min, f.name).toBeLessThanOrEqual(['poultry', 'seafood'].includes(f.category) ? 5 : 7);
    }
  });
  it('叶菜、豆芽、豆腐冷藏不超过 5 天', () => {
    for (const n of ['菠菜', '生菜', '空心菜', '韭菜', '香菜', '豆芽', '豆腐', '剩菜']) {
      expect(findFood(n).days.fridge.min, n).toBeLessThanOrEqual(5);
    }
  });
  it('至少 40 种食材有开封后天数，且不长于未开封', () => {
    const opened = FOODS.filter((f) => f.opened);
    expect(opened.length).toBeGreaterThanOrEqual(40);
    for (const f of opened) {
      expect(f.opened.min, f.name).toBeGreaterThan(0);
      expect(f.opened.max, f.name).toBeLessThanOrEqual(Math.max(...all(f).map((d) => d.max)));
    }
    for (const n of ['牛奶', '酸奶', '果汁', '番茄酱', '豆瓣酱', '蚝油', '沙拉酱']) expect(findFood(n).opened, n).toBeTruthy();
    expect(findFood('牛奶').opened).toEqual({ min: 2, max: 3 });
  });
  it('未开封就能常温放的酱料默认常温', () => {
    for (const n of ['番茄酱', '豆瓣酱', '蚝油', '沙拉酱', '芝麻酱', '腐乳']) expect(findFood(n).defaultStorage, n).toBe('pantry');
  });
});
