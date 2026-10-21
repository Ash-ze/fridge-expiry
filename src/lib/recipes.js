// "今天吃什么"：根据冰箱里快到期的食材给菜谱打分。

import { foodKeys, resolveFood } from '../data/foods.js';
import { RECIPES } from '../data/recipes.js';
import { activeItems, daysLeft, toISODate } from './expiry.js';

// 「今天吃什么」的筛选
export const RECIPE_FILTERS = [
  { key: 'all', label: '全部' },
  { key: 'quick', label: '⚡ 快手' },
  { key: 'meat', label: '🥩 荤' },
  { key: 'veg', label: '🥬 素' },
  { key: 'soup', label: '🍲 汤' },
];
export const QUICK_MINUTES = 15;
const MEAT_CATEGORIES = new Set(['meat', 'poultry', 'seafood']);
const PLANT_SEAFOOD = new Set(['紫菜', '海带']); // 归在水产，但算素

/** 主料里有肉禽水产即为荤菜（可选配料不算） */
export function isMeatDish(recipe) {
  return recipe.main.some((ing) => {
    if (PLANT_SEAFOOD.has(ing)) return false;
    const f = resolveFood(ing);
    return !!f && MEAT_CATEGORIES.has(f.category);
  });
}

/** 菜谱的分类标签：quick / meat / veg / soup */
export function recipeKinds(recipe) {
  const kinds = new Set();
  if (recipe.time && recipe.time <= QUICK_MINUTES) kinds.add('quick');
  kinds.add(isMeatDish(recipe) ? 'meat' : 'veg');
  if (recipe.soup || recipe.name.includes('汤')) kinds.add('soup');
  return kinds;
}

export function filterRecipes(recipes, kind = 'all') {
  if (!kind || kind === 'all') return recipes;
  return recipes.filter((r) => recipeKinds(r).has(kind));
}

/** 越快到期权重越高；已过期的食材不参与推荐 */
export function urgencyWeight(days) {
  if (days < 0) return 0;
  if (days === 0) return 5;
  if (days <= 3) return 3;
  if (days <= 7) return 1.5;
  return 1;
}

/** 在库物品里找到能当作该食材的、最快到期（但未过期）的一件 */
export function findItemFor(ingredient, pool) {
  let best = null;
  for (const entry of pool) {
    if (!entry.keys.has(ingredient)) continue;
    if (!best || entry.days < best.days) best = entry;
  }
  return best;
}

function buildPool(items, today) {
  return activeItems(items)
    .map((item) => ({ item, days: daysLeft(item.expiryDate, today), keys: foodKeys(item.name) }))
    .filter((e) => e.days >= 0);
}

/** 给单个菜谱打分 */
export function scoreRecipe(recipe, pool) {
  const have = [];
  const missing = [];
  let score = 0;
  let urgent = 0;
  for (const ing of recipe.main) {
    const hit = findItemFor(ing, pool);
    if (hit) {
      have.push({ ingredient: ing, item: hit.item, days: hit.days });
      score += urgencyWeight(hit.days);
      if (hit.days <= 3) urgent++;
    } else {
      missing.push(ing);
    }
  }
  const extrasHave = [];
  for (const ing of recipe.extra || []) {
    const hit = findItemFor(ing, pool);
    if (hit) {
      extrasHave.push({ ingredient: ing, item: hit.item, days: hit.days });
      score += urgencyWeight(hit.days) * 0.3;
      if (hit.days <= 3) urgent++;
    }
  }
  const coverage = recipe.main.length ? have.length / recipe.main.length : 0;
  score += coverage * 2; // 主料越齐越好
  if (missing.length === 0) score += 1;
  return { recipe, have, missing, extrasHave, coverage, urgent, score: Math.round(score * 100) / 100 };
}

/**
 * 推荐菜谱：至少要有一样主料在库，按得分从高到低。kind 可按 快手/荤/素/汤 筛选。
 * @returns {Array<{recipe, have, missing, extrasHave, coverage, urgent, score}>}
 */
export function suggestRecipes(items, { today = toISODate(), limit = 8, recipes = RECIPES, kind = 'all' } = {}) {
  const pool = buildPool(items, today);
  if (!pool.length) return [];
  return filterRecipes(recipes, kind)
    .map((r) => scoreRecipe(r, pool))
    .filter((r) => r.have.length > 0)
    .sort((a, b) => b.score - a.score || b.coverage - a.coverage || a.missing.length - b.missing.length)
    .slice(0, limit);
}
