const INTENTS = ['GENERATE', 'CONVERT', 'MODIFY', 'CLEAR', 'UNSUPPORTED', 'CHITCHAT'];

export function detectIntent(message) {
  const text = String(message ?? '').trim().toLowerCase();
  if (!text) return { intent: 'CHITCHAT' };

  if (/(清空|重来|重新开始|reset|clear)/i.test(text)) return { intent: 'CLEAR' };
  if (/(动画|导出|pdf|ppt|gif|video)/i.test(text)) return { intent: 'UNSUPPORTED', feature: '动画/导出' };

  if (/(换成|转换|改成)/i.test(text)) {
    if (/(热力图|折线|面积|雷达|柱状图|条形图|柱状|条形|堆叠)/i.test(text)) return { intent: 'CONVERT' };
    return { intent: 'MODIFY' };
  }

  if (/(改成|改为|修改|删除|增加|添加|乘以|除以|转置)/i.test(text)) return { intent: 'MODIFY' };

  if (/(生成|做一个|画一个|来一个|帮我做)/i.test(text)) return { intent: 'GENERATE' };

  return { intent: 'CHITCHAT' };
}

export { INTENTS };
