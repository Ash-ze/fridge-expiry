import { describe, it, expect } from 'vitest';
import { suggestRecipes, scoreRecipe, urgencyWeight, findItemFor, recipeKinds, filterRecipes, isMeatDish } from '../src/lib/recipes.js';
import { RECIPES } from '../src/data/recipes.js';
import { foodKeys, resolveFood } from '../src/data/foods.js';
import { addDays } from '../src/lib/expiry.js';

const T = '2026-10-21';
const item = (name, days, extra = {}) => ({ id: name, name, expiryDate: addDays(T, days), storage: 'fridge', status: 'active', ...extra });

describe('菜谱数据', () => {
  it('约 60 道且每个主料都能被食材库识别', () => {
    expect(RECIPES.length).toBeGreaterThanOrEqual(60);
    expect(new Set(RECIPES.map((r) => r.name)).size).toBe(RECIPES.length);
    for (const r of RECIPES) {
      for (const ing of [...r.main, ...r.extra]) {
        expect(resolveFood(ing), `${r.name} 的 ${ing}`).not.toBeNull();
      }
    }
  });
});

describe('菜谱做法与分类', () => {
  it('每道菜有 3-5 步做法和用时', () => {
    for (const r of RECIPES) {
      expect(r.steps.length, r.name).toBeGreaterThanOrEqual(3);
      expect(r.steps.length, r.name).toBeLessThanOrEqual(5);
      expect(r.steps.every((s) => typeof s === 'string' && s.length > 2 && s.length <= 30), r.name).toBe(true);
      expect(r.time, r.name).toBeGreaterThan(0);
    }
  });
  it('荤素按主料判断，紫菜海带算素', () => {
    const by = (n) => RECIPES.find((r) => r.name === n);
    expect(isMeatDish(by('麻婆豆腐'))).toBe(true);
    expect(isMeatDish(by('清蒸鲈鱼'))).toBe(true);
    expect(isMeatDish(by('西红柿炒鸡蛋'))).toBe(false);
    expect(isMeatDish(by('紫菜蛋花汤'))).toBe(false);
    expect(isMeatDish(by('红烧茄子'))).toBe(false); // 肉末只是可选配料
    expect([...recipeKinds(by('紫菜蛋花汤'))].sort()).toEqual(['quick', 'soup', 'veg']);
    expect(recipeKinds(by('红烧肉')).has('quick')).toBe(false);
  });
  it('每个分类都有菜，筛选结果正确', () => {
    for (const k of ['quick', 'meat', 'veg', 'soup']) expect(filterRecipes(RECIPES, k).length, k).toBeGreaterThanOrEqual(8);
    expect(filterRecipes(RECIPES, 'all')).toBe(RECIPES);
    expect(filterRecipes(RECIPES, 'soup').every((r) => r.name.includes('汤'))).toBe(true);
    const meat = filterRecipes(RECIPES, 'meat').length;
    expect(meat + filterRecipes(RECIPES, 'veg').length).toBe(RECIPES.length);
  });
  it('suggestRecipes 支持按分类筛选', () => {
    const items = [item('鸡蛋', 1), item('西红柿', 1), item('猪肉', 2)];
    const soups = suggestRecipes(items, { today: T, kind: 'soup' });
    expect(soups.length).toBeGreaterThan(0);
    expect(soups.every((r) => r.recipe.name.includes('汤'))).toBe(true);
    const meat = suggestRecipes(items, { today: T, kind: 'meat' });
    expect(meat.every((r) => isMeatDish(r.recipe))).toBe(true);
  });
});

describe('食材匹配', () => {
  it('标签让具体食材匹配通用食材', () => {
    expect(foodKeys('五花肉').has('猪肉')).toBe(true);
    expect(foodKeys('鸡腿').has('鸡肉')).toBe(true);
    expect(foodKeys('菠菜').has('青菜')).toBe(true);
    expect(foodKeys('番茄').has('西红柿')).toBe(true);
    expect(foodKeys('虾仁').has('虾')).toBe(true);
    expect(foodKeys('西红柿').has('猪肉')).toBe(false);
  });
  it('findItemFor 选最快到期的那件', () => {
    const pool = [item('里脊', 5), item('肉末', 1)].map((it) => ({ item: it, days: Number(it.id === '肉末' ? 1 : 5), keys: foodKeys(it.name) }));
    expect(findItemFor('猪肉', pool).item.name).toBe('肉末');
  });
  it('urgencyWeight 越急越高，过期为 0', () => {
    expect(urgencyWeight(-1)).toBe(0);
    expect(urgencyWeight(0)).toBeGreaterThan(urgencyWeight(2));
    expect(urgencyWeight(2)).toBeGreaterThan(urgencyWeight(10));
  });
});

describe('今天吃什么', () => {
  it('优先推荐用到今天到期食材的菜', () => {
    const items = [item('番茄', 0), item('鸡蛋', 20), item('土豆', 25)];
    const res = suggestRecipes(items, { today: T });
    expect(res[0].recipe.name).toMatch(/西红柿/);
    expect(res[0].missing).toEqual([]);
    expect(res[0].have.find((h) => h.ingredient === '西红柿').item.name).toBe('番茄');
  });
  it('临期食材的菜排在只用新鲜食材的菜前面', () => {
    const items = [item('豆腐', 1), item('肉末', 1), item('鸡蛋', 25), item('韭菜', 20)];
    const res = suggestRecipes(items, { today: T });
    expect(res[0].recipe.name).toBe('麻婆豆腐');
    const idxMapo = res.findIndex((r) => r.recipe.name === '麻婆豆腐');
    const idxLeek = res.findIndex((r) => r.recipe.name === '韭菜炒鸡蛋');
    expect(idxMapo).toBeLessThan(idxLeek);
  });
  it('已过期、已吃掉的食材不参与推荐', () => {
    const items = [item('虾', -1), item('鲈鱼', 1, { status: 'eaten' })];
    expect(suggestRecipes(items, { today: T })).toEqual([]);
  });
  it('列出缺少的主料和已有配料', () => {
    const recipe = RECIPES.find((r) => r.name === '鱼香肉丝');
    const pool = [item('里脊', 2), item('大蒜', 30)].map((it) => ({ item: it, days: it.name === '里脊' ? 2 : 30, keys: foodKeys(it.name) }));
    const r = scoreRecipe(recipe, pool);
    expect(r.have.map((h) => h.ingredient)).toEqual(['猪肉']);
    expect(r.missing).toEqual(['胡萝卜', '木耳']);
    expect(r.extrasHave.map((h) => h.ingredient)).toEqual(['大蒜']);
    expect(r.urgent).toBe(1);
  });
  it('空冰箱返回空列表，limit 生效', () => {
    expect(suggestRecipes([], { today: T })).toEqual([]);
    const many = [item('鸡蛋', 2), item('西红柿', 2), item('猪肉', 2), item('土豆', 2), item('青椒', 2)];
    expect(suggestRecipes(many, { today: T, limit: 3 })).toHaveLength(3);
  });
});
