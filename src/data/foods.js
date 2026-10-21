// 内置常见食材及默认保质期（天）。
// 规格字符串写法："冷藏7 冷冻30 常温1"，第一个即默认存放位置；"冷藏3-5" 表示区间，自动填写时取较短的一端。
// "开封2-3" 表示开封后（冷藏）建议在几天内吃完，标记「已开封」时会据此提前到期日。
// 这些数字只是家庭存放的经验参考值，请以包装标注和实际状况为准。

export const CATEGORIES = {
  dairy: { label: '乳制品', emoji: '🥛' },
  egg: { label: '蛋类', emoji: '🥚' },
  meat: { label: '肉类', emoji: '🥩' },
  poultry: { label: '禽肉', emoji: '🍗' },
  seafood: { label: '水产', emoji: '🐟' },
  veg: { label: '蔬菜', emoji: '🥬' },
  mushroom: { label: '菌菇', emoji: '🍄' },
  tofu: { label: '豆制品', emoji: '🫘' },
  fruit: { label: '水果', emoji: '🍎' },
  staple: { label: '主食', emoji: '🍚' },
  frozen: { label: '速冻', emoji: '🥟' },
  deli: { label: '熟食', emoji: '🍱' },
  condiment: { label: '调味', emoji: '🧂' },
  drink: { label: '饮品', emoji: '🧃' },
  snack: { label: '零食', emoji: '🍪' },
  other: { label: '其他', emoji: '📦' },
};

export const STORAGES = {
  fridge: { label: '冷藏', emoji: '❄️' },
  freezer: { label: '冷冻', emoji: '🧊' },
  pantry: { label: '常温', emoji: '🏠' },
};

const STORAGE_BY_LABEL = { 冷藏: 'fridge', 冷冻: 'freezer', 常温: 'pantry' };

// [名称, 分类, 规格, 选项{e: emoji, a: 别名, t: 标签}]
const RAW = [
  // 乳制品
  ['牛奶', 'dairy', '冷藏7 开封2-3', { a: ['鲜牛奶', '纯牛奶', '鲜奶'] }],
  ['常温奶', 'dairy', '常温180 开封2-3', { a: ['盒装牛奶', '常温牛奶'], t: ['牛奶'] }],
  ['酸奶', 'dairy', '冷藏14-21 开封1-2'],
  ['奶酪', 'dairy', '冷藏30 冷冻180 开封7-14', { e: '🧀', a: ['芝士', '奶酪片'] }],
  ['黄油', 'dairy', '冷藏60 冷冻180 开封30', { e: '🧈' }],
  ['淡奶油', 'dairy', '冷藏60 开封3-5', { a: ['奶油', '稀奶油'] }],
  ['奶粉', 'dairy', '常温365 开封30', { a: ['全脂奶粉'] }],
  ['炼乳', 'dairy', '常温365 开封30'],
  // 蛋类
  ['鸡蛋', 'egg', '冷藏30 常温14', { a: ['蛋', '土鸡蛋'] }],
  ['鸭蛋', 'egg', '冷藏30 常温14'],
  ['鹌鹑蛋', 'egg', '冷藏20'],
  ['咸鸭蛋', 'egg', '冷藏30 常温30', { a: ['咸蛋'] }],
  ['皮蛋', 'egg', '常温60', { a: ['松花蛋'] }],
  // 肉类
  ['猪肉', 'meat', '冷藏2-3 冷冻90', { a: ['鲜猪肉', '肉丝', '肉片'] }],
  ['五花肉', 'meat', '冷藏2-3 冷冻90', { t: ['猪肉'] }],
  ['排骨', 'meat', '冷藏2 冷冻90', { a: ['猪排骨', '肋排'], t: ['猪肉'] }],
  ['里脊', 'meat', '冷藏2-3 冷冻90', { a: ['猪里脊', '里脊肉'], t: ['猪肉'] }],
  ['肉末', 'meat', '冷藏1 冷冻60', { a: ['猪肉末', '肉馅', '绞肉'], t: ['猪肉'] }],
  ['牛肉', 'meat', '冷藏3-5 冷冻180', { a: ['牛腩', '牛腱'] }],
  ['牛排', 'meat', '冷藏3-5 冷冻180', { t: ['牛肉'] }],
  ['肥牛卷', 'meat', '冷冻90 冷藏2', { a: ['肥牛', '肥牛片'], t: ['牛肉'] }],
  ['羊肉', 'meat', '冷藏3-5 冷冻180', { a: ['羊肉片', '羊肉卷', '羊排'] }],
  ['培根', 'meat', '冷藏7 冷冻60 开封5-7', { e: '🥓' }],
  ['火腿肠', 'meat', '常温90 冷藏30 开封2-3', { e: '🌭', a: ['火腿'] }],
  ['腊肠', 'meat', '冷藏90 常温30 开封30', { a: ['香肠', '广式香肠'] }],
  ['腊肉', 'meat', '冷藏90 常温60 开封30'],
  ['午餐肉', 'meat', '常温365 开封2-3', { a: ['午餐肉罐头'] }],
  // 禽肉
  ['鸡肉', 'poultry', '冷藏2 冷冻90', { a: ['整鸡', '鸡块'] }],
  ['鸡胸肉', 'poultry', '冷藏2 冷冻90', { a: ['鸡胸'], t: ['鸡肉'] }],
  ['鸡腿', 'poultry', '冷藏2 冷冻90', { a: ['琵琶腿', '鸡腿肉'], t: ['鸡肉'] }],
  ['鸡翅', 'poultry', '冷藏2 冷冻90', { a: ['鸡翅中', '鸡中翅'], t: ['鸡肉'] }],
  ['鸭肉', 'poultry', '冷藏2 冷冻90', { e: '🦆' }],
  // 水产
  ['鱼', 'seafood', '冷藏2 冷冻90', { a: ['鲜鱼'] }],
  ['鲈鱼', 'seafood', '冷藏2 冷冻90', { t: ['鱼'] }],
  ['草鱼', 'seafood', '冷藏2 冷冻90', { t: ['鱼'] }],
  ['鲫鱼', 'seafood', '冷藏2 冷冻90', { t: ['鱼'] }],
  ['三文鱼', 'seafood', '冷藏2 冷冻90', { e: '🍣', t: ['鱼'] }],
  ['带鱼', 'seafood', '冷冻90 冷藏2', { t: ['鱼'] }],
  ['虾', 'seafood', '冷藏2 冷冻90', { e: '🦐', a: ['鲜虾', '大虾', '基围虾'] }],
  ['虾仁', 'seafood', '冷冻90 冷藏1', { e: '🦐', t: ['虾'] }],
  ['螃蟹', 'seafood', '冷藏1 冷冻60', { e: '🦀', a: ['蟹', '大闸蟹'] }],
  ['鱿鱼', 'seafood', '冷藏2 冷冻90', { e: '🦑' }],
  ['蛤蜊', 'seafood', '冷藏1', { e: '🦪', a: ['花甲', '蛤'] }],
  ['扇贝', 'seafood', '冷藏1 冷冻60', { e: '🦪' }],
  ['海带', 'seafood', '冷藏5', { e: '🌿', a: ['海带丝', '海带结'] }],
  ['紫菜', 'seafood', '常温365 开封30', { e: '🌿' }],
  ['金枪鱼罐头', 'seafood', '常温730 开封2', { e: '🥫', a: ['吞拿鱼罐头', '金枪鱼'] }],
  ['虾皮', 'seafood', '冷藏90 常温30', { e: '🦐' }],
  // 蔬菜
  ['小白菜', 'veg', '冷藏3-5', { t: ['叶菜', '青菜'] }],
  ['上海青', 'veg', '冷藏3-5', { a: ['油菜', '青菜'], t: ['叶菜', '青菜'] }],
  ['菠菜', 'veg', '冷藏3-5', { t: ['叶菜', '青菜'] }],
  ['生菜', 'veg', '冷藏3-5', { t: ['叶菜'] }],
  ['油麦菜', 'veg', '冷藏3-5', { t: ['叶菜', '青菜'] }],
  ['空心菜', 'veg', '冷藏2-3', { t: ['叶菜', '青菜'] }],
  ['菜心', 'veg', '冷藏3-5', { t: ['叶菜', '青菜'] }],
  ['叶菜', 'veg', '冷藏3-5', { a: ['绿叶菜', '时蔬'], t: ['青菜'] }],
  ['韭菜', 'veg', '冷藏3'],
  ['芹菜', 'veg', '冷藏7'],
  ['大白菜', 'veg', '冷藏14 常温7', { a: ['白菜'] }],
  ['卷心菜', 'veg', '冷藏14', { a: ['包菜', '圆白菜', '甘蓝'] }],
  ['西兰花', 'veg', '冷藏5', { e: '🥦', a: ['西蓝花'] }],
  ['花菜', 'veg', '冷藏5', { e: '🥦', a: ['菜花', '花椰菜'] }],
  ['西红柿', 'veg', '冷藏7 常温5', { e: '🍅', a: ['番茄', '圣女果'] }],
  ['黄瓜', 'veg', '冷藏5', { e: '🥒', a: ['青瓜'] }],
  ['茄子', 'veg', '冷藏5 常温3', { e: '🍆' }],
  ['青椒', 'veg', '冷藏7', { e: '🫑', a: ['菜椒'] }],
  ['彩椒', 'veg', '冷藏7', { e: '🫑', a: ['甜椒', '红椒', '黄椒'], t: ['青椒'] }],
  ['辣椒', 'veg', '冷藏7', { e: '🌶️', a: ['小米辣', '尖椒', '线椒'] }],
  ['土豆', 'veg', '常温30', { e: '🥔', a: ['马铃薯', '洋芋'] }],
  ['红薯', 'veg', '常温30', { e: '🍠', a: ['地瓜', '番薯'] }],
  ['山药', 'veg', '常温14'],
  ['胡萝卜', 'veg', '冷藏14', { e: '🥕' }],
  ['白萝卜', 'veg', '冷藏14', { a: ['萝卜'] }],
  ['洋葱', 'veg', '常温30 冷藏14', { e: '🧅' }],
  ['大蒜', 'veg', '常温60', { e: '🧄', a: ['蒜', '蒜头'] }],
  ['生姜', 'veg', '常温14 冷藏21', { e: '🫚', a: ['姜'] }],
  ['葱', 'veg', '冷藏7', { a: ['小葱', '大葱', '香葱'] }],
  ['香菜', 'veg', '冷藏3', { e: '🌿', a: ['芫荽'] }],
  ['玉米', 'veg', '冷藏3 冷冻180', { e: '🌽', a: ['甜玉米'] }],
  ['南瓜', 'veg', '常温30', { e: '🎃' }],
  ['冬瓜', 'veg', '常温14 冷藏5'],
  ['丝瓜', 'veg', '冷藏3'],
  ['苦瓜', 'veg', '冷藏5'],
  ['豆角', 'veg', '冷藏5', { a: ['四季豆', '扁豆', '长豆角'] }],
  ['荷兰豆', 'veg', '冷藏4', { e: '🫛' }],
  ['豌豆', 'veg', '冷藏3 冷冻180', { e: '🫛' }],
  ['毛豆', 'veg', '冷藏3 冷冻180', { e: '🫛' }],
  ['莲藕', 'veg', '冷藏7', { a: ['藕'] }],
  ['莴笋', 'veg', '冷藏7'],
  ['秋葵', 'veg', '冷藏3'],
  ['豆芽', 'veg', '冷藏2', { a: ['绿豆芽', '黄豆芽'] }],
  ['蒜苔', 'veg', '冷藏7', { a: ['蒜薹'] }],
  ['竹笋', 'veg', '冷藏3', { a: ['笋', '春笋', '冬笋'] }],
  // 菌菇
  ['香菇', 'mushroom', '冷藏5 冷冻60', { a: ['鲜香菇', '冬菇'] }],
  ['金针菇', 'mushroom', '冷藏5'],
  ['平菇', 'mushroom', '冷藏3'],
  ['杏鲍菇', 'mushroom', '冷藏7'],
  ['口蘑', 'mushroom', '冷藏5', { a: ['蘑菇', '白蘑菇'] }],
  ['木耳', 'mushroom', '常温365', { a: ['黑木耳', '干木耳'] }],
  // 豆制品
  ['豆腐', 'tofu', '冷藏3', { a: ['嫩豆腐', '老豆腐', '北豆腐', '南豆腐'] }],
  ['内酯豆腐', 'tofu', '冷藏7 开封1', { t: ['豆腐'] }],
  ['豆腐干', 'tofu', '冷藏5', { a: ['豆干', '香干'] }],
  ['千张', 'tofu', '冷藏3', { a: ['百叶', '豆腐皮'] }],
  ['油豆腐', 'tofu', '冷藏5 冷冻60', { a: ['豆泡'] }],
  ['腐竹', 'tofu', '常温180'],
  ['豆浆', 'tofu', '冷藏2'],
  // 水果
  ['苹果', 'fruit', '冷藏30 常温7', { e: '🍎' }],
  ['香蕉', 'fruit', '常温5', { e: '🍌' }],
  ['橙子', 'fruit', '常温14 冷藏30', { e: '🍊', a: ['脐橙'] }],
  ['橘子', 'fruit', '常温10 冷藏21', { e: '🍊', a: ['桔子', '砂糖橘'] }],
  ['柠檬', 'fruit', '冷藏30 常温14', { e: '🍋' }],
  ['葡萄', 'fruit', '冷藏5', { e: '🍇', a: ['提子'] }],
  ['草莓', 'fruit', '冷藏2', { e: '🍓' }],
  ['蓝莓', 'fruit', '冷藏7', { e: '🫐' }],
  ['西瓜', 'fruit', '常温7 冷藏3', { e: '🍉' }],
  ['梨', 'fruit', '冷藏30 常温7', { e: '🍐', a: ['雪梨', '香梨'] }],
  ['桃子', 'fruit', '冷藏5 常温3', { e: '🍑', a: ['桃', '水蜜桃'] }],
  ['芒果', 'fruit', '常温5 冷藏5', { e: '🥭' }],
  ['猕猴桃', 'fruit', '常温7 冷藏21', { e: '🥝', a: ['奇异果'] }],
  ['樱桃', 'fruit', '冷藏5', { e: '🍒', a: ['车厘子'] }],
  ['菠萝', 'fruit', '常温3 冷藏3', { e: '🍍', a: ['凤梨'] }],
  ['火龙果', 'fruit', '冷藏7 常温5'],
  ['牛油果', 'fruit', '常温4 冷藏7', { e: '🥑', a: ['鳄梨'] }],
  ['哈密瓜', 'fruit', '常温7', { e: '🍈' }],
  ['荔枝', 'fruit', '冷藏3'],
  ['柚子', 'fruit', '常温30', { a: ['柚'] }],
  // 主食
  ['米饭', 'staple', '冷藏2 冷冻30', { e: '🍚', a: ['剩饭', '白饭'] }],
  ['面条', 'staple', '冷藏3', { e: '🍜', a: ['鲜面条', '湿面'] }],
  ['挂面', 'staple', '常温365', { e: '🍜', t: ['面条'] }],
  ['馒头', 'staple', '冷藏3 冷冻60 常温1'],
  ['包子', 'staple', '冷冻60 冷藏2', { e: '🥟' }],
  ['面包', 'staple', '常温3 冷冻30', { e: '🍞', a: ['吐司'] }],
  ['大米', 'staple', '常温365', { e: '🍚', a: ['米'] }],
  ['年糕', 'staple', '冷藏30 冷冻180 开封3-5', { e: '🍡' }],
  ['方便面', 'staple', '常温180', { e: '🍜', a: ['泡面'] }],
  ['燕麦片', 'staple', '常温365 开封60', { e: '🥣', a: ['燕麦', '麦片'] }],
  ['意大利面', 'staple', '常温365', { e: '🍝', a: ['意面'] }],
  // 速冻
  ['饺子', 'frozen', '冷冻90', { a: ['速冻饺子', '水饺'] }],
  ['馄饨', 'frozen', '冷冻90', { a: ['云吞', '抄手'] }],
  ['汤圆', 'frozen', '冷冻180', { e: '🍡', a: ['元宵'] }],
  ['鱼丸', 'frozen', '冷冻90 冷藏3', { e: '🍢', a: ['丸子'] }],
  ['牛肉丸', 'frozen', '冷冻90 冷藏3', { e: '🍢' }],
  ['手抓饼', 'frozen', '冷冻90', { e: '🫓' }],
  ['冰淇淋', 'frozen', '冷冻180', { e: '🍦', a: ['雪糕'] }],
  // 熟食
  ['剩菜', 'deli', '冷藏2', { a: ['隔夜菜'] }],
  ['卤味', 'deli', '冷藏2', { a: ['卤肉', '卤菜'] }],
  ['烤鸭', 'deli', '冷藏2', { e: '🦆' }],
  ['凉菜', 'deli', '冷藏1', { e: '🥗' }],
  // 调味
  ['酱油', 'condiment', '常温365 开封90-180', { a: ['生抽', '老抽'] }],
  ['醋', 'condiment', '常温365 开封180', { a: ['陈醋', '香醋'] }],
  ['蚝油', 'condiment', '常温365 开封60-90'],
  ['番茄酱', 'condiment', '常温365 开封30-60', { e: '🥫' }],
  ['豆瓣酱', 'condiment', '常温365 开封90', { a: ['郫县豆瓣'] }],
  ['辣椒酱', 'condiment', '常温180 开封30-60', { e: '🌶️', a: ['剁椒'] }],
  ['沙拉酱', 'condiment', '常温180 开封30', { a: ['蛋黄酱'] }],
  ['芝麻酱', 'condiment', '常温180 开封60', { a: ['麻酱'] }],
  ['腐乳', 'condiment', '常温180 开封30-60', { a: ['豆腐乳'] }],
  ['料酒', 'condiment', '常温365 开封180', { e: '🍶', a: ['黄酒', '绍兴酒'] }],
  ['花生酱', 'condiment', '常温365 开封60', { e: '🥜' }],
  ['果酱', 'condiment', '常温365 开封30', { e: '🍓', a: ['草莓酱', '蓝莓酱'] }],
  ['榨菜', 'condiment', '常温180 开封7', { e: '🥬', a: ['咸菜'] }],
  ['酸菜', 'condiment', '常温180 开封3', { e: '🥬', a: ['老坛酸菜', '东北酸菜'] }],
  // 饮品
  ['果汁', 'drink', '冷藏14 常温180 开封2-3', { a: ['橙汁', '盒装果汁', 'NFC果汁'] }],
  ['鲜榨果汁', 'drink', '冷藏1', { a: ['现榨果汁'] }],
  ['可乐', 'drink', '常温270 开封2', { e: '🥤', a: ['汽水', '雪碧'] }],
  ['啤酒', 'drink', '常温180 开封1', { e: '🍺' }],
  ['茶饮料', 'drink', '常温270 开封1-2', { e: '🍵', a: ['冰红茶', '绿茶饮料'] }],
  // 零食
  ['巧克力', 'snack', '常温180', { e: '🍫' }],
  ['饼干', 'snack', '常温180 开封7', { e: '🍪' }],
  ['薯片', 'snack', '常温180 开封2', { e: '🥔' }],
  ['坚果', 'snack', '常温180 冷藏365 开封30', { e: '🥜', a: ['花生', '核桃', '腰果'] }],
  ['蛋糕', 'snack', '冷藏3', { e: '🍰' }],
  ['月饼', 'snack', '常温30', { e: '🥮' }],
  ['黄桃罐头', 'snack', '常温365 开封2', { e: '🍑', a: ['水果罐头'] }],
  ['果冻', 'snack', '常温180', { e: '🍮' }],
];

/** 解析 "冷藏7 冷冻30 常温3-5 开封2" → { order: ['fridge',...], days: { fridge: {min,max} }, opened?: {min,max} } */
export function parseSpec(spec) {
  const days = {};
  const order = [];
  let opened;
  for (const part of spec.trim().split(/\s+/)) {
    const m = part.match(/^(冷藏|冷冻|常温|开封)(\d+)(?:-(\d+))?$/);
    if (!m) throw new Error(`无法解析保质期规格: ${part}`);
    const min = Number(m[2]);
    const max = m[3] ? Number(m[3]) : min;
    if (max < min) throw new Error(`保质期区间写反了: ${part}`);
    if (m[1] === '开封') {
      opened = { min, max };
      continue;
    }
    const key = STORAGE_BY_LABEL[m[1]];
    days[key] = { min, max };
    order.push(key);
  }
  if (!order.length) throw new Error(`缺少存放方式: ${spec}`);
  const out = { order, days };
  if (opened) out.opened = opened;
  return out;
}

export const FOODS = RAW.map(([name, category, spec, opt = {}]) => {
  const { order, days, opened } = parseSpec(spec);
  return {
    name,
    category,
    emoji: opt.e || CATEGORIES[category].emoji,
    aliases: opt.a || [],
    tags: opt.t || [],
    defaultStorage: order[0],
    days,
    opened: opened || null,
  };
});

const BY_NAME = new Map();
for (const f of FOODS) {
  BY_NAME.set(f.name, f);
}
for (const f of FOODS) {
  for (const a of f.aliases) if (!BY_NAME.has(a)) BY_NAME.set(a, f);
}

/** 精确匹配名称或别名 */
export function findFood(name) {
  return BY_NAME.get(String(name || '').trim()) || null;
}

/** 模糊识别：先精确匹配，再找输入中包含的最长食材名（如"有机牛奶" → 牛奶） */
export function resolveFood(name) {
  const n = String(name || '').trim();
  if (!n) return null;
  const exact = findFood(n);
  if (exact) return exact;
  let best = null;
  let bestLen = 0;
  for (const [key, food] of BY_NAME) {
    if (key.length >= 1 && key.length > bestLen && n.includes(key)) {
      // 单字别名（如"蛋""米""姜"）只在输入很短时才用，避免误判
      if (key.length === 1 && n.length > 2) continue;
      best = food;
      bestLen = key.length;
    }
  }
  return best;
}

/** 自动补全：名称/别名包含关键字，名称前缀匹配优先 */
export function searchFoods(query, limit = 8) {
  const q = String(query || '').trim();
  if (!q) return [];
  const scored = [];
  for (const f of FOODS) {
    let score = -1;
    if (f.name === q) score = 100;
    else if (f.name.startsWith(q)) score = 80;
    else if (f.aliases.some((a) => a === q)) score = 70;
    else if (f.name.includes(q)) score = 60;
    else if (f.aliases.some((a) => a.startsWith(q))) score = 50;
    else if (f.aliases.some((a) => a.includes(q))) score = 40;
    if (score >= 0) scored.push({ f, score });
  }
  scored.sort((a, b) => b.score - a.score || a.f.name.length - b.f.name.length);
  return scored.slice(0, limit).map((s) => s.f);
}

/** 用于菜谱匹配的关键词集合：名称、别名、标签 */
export function foodKeys(name) {
  const n = String(name || '').trim();
  const keys = new Set(n ? [n] : []);
  const food = resolveFood(n);
  if (food) {
    keys.add(food.name);
    food.aliases.forEach((a) => keys.add(a));
    food.tags.forEach((t) => keys.add(t));
  }
  return keys;
}

const range = (d) => (d.min === d.max ? `${d.min}` : `${d.min}-${d.max}`);

/** 格式化保质期描述，如 "冷藏3-5天"、"冷藏7天 · 开封后2-3天" */
export function describeShelfLife(food) {
  const parts = Object.entries(food.days).map(([k, d]) => `${STORAGES[k].label}${range(d)}天`);
  if (food.opened) parts.push(`开封后${range(food.opened)}天`);
  return parts.join(' · ');
}

/** 开封后的描述，如 "开封后2-3天"；没有数据返回空字符串 */
export function describeOpened(food) {
  return food && food.opened ? `开封后${range(food.opened)}天` : '';
}
