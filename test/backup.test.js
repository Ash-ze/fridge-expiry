import { describe, it, expect } from 'vitest';
import { makeBackup, parseBackup, sanitizeItem } from '../src/lib/backup.js';

describe('备份', () => {
  it('导出后可以原样导入', () => {
    const items = [{ id: 'a', name: '牛奶', emoji: '🥛', category: 'dairy', qty: 2, unit: '盒', storage: 'fridge', purchaseDate: '2026-10-21', expiryDate: '2026-10-28', status: 'active', doneAt: null, createdAt: '2026-10-21T00:00:00.000Z' }];
    const { items: back, skipped } = parseBackup(JSON.stringify(makeBackup(items)));
    expect(skipped).toBe(0);
    expect(back).toEqual(items);
  });
  it('跳过无效记录并修正字段', () => {
    const { items, skipped } = parseBackup(JSON.stringify([{ name: '', expiryDate: '2026-10-01' }, { name: '豆腐', expiryDate: 'x' }, { name: '豆腐', expiryDate: '2026-10-22', storage: '冰箱', qty: -1 }]));
    expect(skipped).toBe(2);
    expect(items[0]).toMatchObject({ name: '豆腐', storage: 'fridge', qty: 1, status: 'active' });
    expect(items[0].id).toBeTruthy();
  });
  it('格式错误给出中文提示', () => {
    expect(() => parseBackup('not json')).toThrow('不是有效的 JSON');
    expect(() => parseBackup('{"foo":1}')).toThrow('没有找到物品列表');
    expect(sanitizeItem(null)).toBeNull();
  });
  it('保留开封信息和购物清单', () => {
    const items = [{ id: 'm', name: '牛奶', qty: 1, unit: '盒', storage: 'fridge', purchaseDate: '2026-10-20', expiryDate: '2026-10-23', status: 'active', doneAt: null, createdAt: 'x', emoji: '', category: 'dairy', opened: true, openedDate: '2026-10-21', expiryBeforeOpen: '2026-10-27' }];
    const shopping = [{ id: 's', name: '鸡蛋', qty: 1, unit: '', from: '', done: false, createdAt: 'y' }];
    const back = parseBackup(JSON.stringify(makeBackup(items, new Date(), shopping)));
    expect(back.items).toEqual(items);
    expect(back.shopping).toEqual(shopping);
    expect(parseBackup('[]').shopping).toBeNull();
    expect(sanitizeItem({ name: '牛奶', expiryDate: '2026-10-23', opened: false })).not.toHaveProperty('opened');
  });
});
