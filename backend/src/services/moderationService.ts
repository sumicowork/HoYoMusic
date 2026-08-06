// 评论内容审核服务（规则层；内部使用，无备案负担）
// 合规：《互联网跟帖评论服务管理规定》第4条⑤ 审核管理/防范处置
// 策略：硬敏感词 → rejected（记录不展示）；可疑特征（链接/刷屏）→ pending（人工复核）；其余 → approved

const HARD_WORDS: string[] = [
  // 涉政/违法类（占位，可按需维护；命中即拒绝）
  '法轮', '天安门事件', '六四', '台独', '藏独', '疆独', '港独',
  // 涉黄/暴力/诈骗/赌博
  '裸聊', '援交', '一夜情', '约炮', '卖淫', '嫖娼', '毒品', '冰毒', '海洛因', '摇头丸',
  '枪支', '炸药', '杀人', '自杀方法', '赌场', '博彩', '时时彩',
  // 辱骂/人身攻击（常见）
  '傻逼', '傻b', '煞笔', '草泥马', '他妈', '你妈', '去死', '贱人', '婊子', '狗东西', '废物点心',
  '滚你', '吃屎', '脑残', '智障', '白痴',
  // 广告/引流
  '加微信', '加vx', '加qq群', '代练', '刷单', '兼职日结', '彩票预测',
];

const SUSPICIOUS_PATTERNS: RegExp[] = [
  /(https?:\/\/|www\.)[^\s]{5,}/i, // 外链
  /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/, // 邮箱
  /\d{6,}/, // 长数字（QQ/手机/卡号）
  /(\S+\s+){3,}\1{2,}/, // 重复刷屏
];

export interface ModerationResult {
  status: 'approved' | 'pending' | 'rejected';
  reason?: string;
}

export function moderateComment(content: string): ModerationResult {
  const text = content.trim();
  if (!text || text.length < 1) return { status: 'rejected', reason: '内容为空' };
  if (text.length > 2000) return { status: 'rejected', reason: '内容超长' };

  // 硬敏感词（命中即拒绝，不发布）
  for (const w of HARD_WORDS) {
    if (text.includes(w)) {
      return { status: 'rejected', reason: `命中敏感词: ${w}` };
    }
  }

  // 可疑特征（进人工审核队列）
  for (const p of SUSPICIOUS_PATTERNS) {
    if (p.test(text)) {
      return { status: 'pending', reason: '含链接/疑似广告' };
    }
  }

  return { status: 'approved' };
}
