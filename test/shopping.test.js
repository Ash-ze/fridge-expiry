import { describe, it, expect } from 'vitest';
import { addToShopping, toggleShopping, removeShopping, sortShopping, pendingCount, sanitizeShopping } from '../src/lib/shopping.js';

describe('购物清单', () => {
  it('添加、去重（含别名），记录来自哪道菜', () => {
    let { list, added, skipped } = addToShopping([], ['肉末', '西红柿'], { from: '麻婆豆腐' });
    expect(added).toEqual(['肉末', '西红柿']);
    expect(list[0]).toMatchObject({ name: '肉末', qty: 1, from: '麻婆豆腐', done: false });
    ({ list, added, skipped } = addToShopping(list, ['番茄', { name: '牛奶', qty: 2, unit: '盒' }, '  ']));
    expect(skipped).toEqual(['番茄']);
    expect(added).toEqual(['牛奶']);
    expect(list).toHaveLength(3);
    expect(list[2]).toMatchObject({ qty: 2, unit: '盒' });
  });
  it('已买到的同名项不挡住再次添加', () => {
    let { list } = addToShopping([], ['鸡蛋']);
    list = toggleShopping(list, list[0].id);
    const res = addToShopping(list, ['鸡蛋']);
    expect(res.added).toEqual(['鸡蛋']);
    expect(pendingCount(res.list)).toBe(1);
  });
  it('勾选、排序、删除', () => {
    let { list } = addToShopping([], ['a', 'b', 'c']);
    list = toggleShopping(list, list[0].id);
    expect(sortShopping(list).map((s) => s.name)).toEqual(['b', 'c', 'a']);
    expect(pendingCount(list)).toBe(2);
    list = toggleShopping(list, list[0].id);
    expect(pendingCount(list)).toBe(3);
    list = removeShopping(list, [list[1].id, list[2].id]);
    expect(list.map((s) => s.name)).toEqual(['a']);
  });
  it('清洗导入数据', () => {
    const out = sanitizeShopping([{ name: ' 牛奶 ', qty: -1, done: 1 }, { name: '' }, null, 'x']);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ name: '牛奶', qty: 1, done: true, unit: '', from: '' });
    expect(out[0].id).toBeTruthy();
    expect(sanitizeShopping('nope')).toEqual([]);
  });
});
