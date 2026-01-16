export function replyNeedSpecFirst() {
  return '请先生成一个图表或上传一个图表数据（例如 1.json）再进行转换/修改。';
}

export function replyUnsupported(featureText = '') {
  const tail = featureText ? `（${featureText}）` : '';
  return `抱歉，目前暂不支持${tail}。我可以帮你：修改数据、切换图表类型、调整标签、修改标题等。`;
}

export function replyCleared() {
  return '已清空当前图表。请告诉我想做什么新图表？';
}

export function replyGenerated(typeLabel = '') {
  return typeLabel ? `已生成图表（${typeLabel}）。你还可以继续让我切换图表类型或修改数据/标签。` : '已生成图表。你还可以继续让我切换图表类型或修改数据/标签。';
}

export function replyConverted(typeLabel = '') {
  return typeLabel ? `已转换为${typeLabel}。还需要其他调整吗？` : '已完成转换。还需要其他调整吗？';
}

export function replyModified(desc = '') {
  return desc ? `已${desc}。还需要其他调整吗？` : '已完成修改。还需要其他调整吗？';
}

