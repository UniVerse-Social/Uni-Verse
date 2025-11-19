import { MAX_TEXTAREA_NEWLINES } from '../constants/profileLimits';

export function applyTextLimits(value, charLimit, newlineLimit = MAX_TEXTAREA_NEWLINES) {
  const raw =
    typeof value === 'string'
      ? value
      : value == null
      ? ''
      : String(value);
  const normalized = raw.replace(/\r/g, '');
  const hasCharLimit = Number.isFinite(charLimit) && charLimit > 0;
  const safeCharLimit = hasCharLimit ? Math.floor(charLimit) : null;
  const hasNewlineLimit =
    typeof newlineLimit === 'number' && newlineLimit >= 0;
  const safeNewlineLimit = hasNewlineLimit ? Math.floor(newlineLimit) : null;

  if (!safeCharLimit && safeNewlineLimit == null) {
    return normalized;
  }

  if (safeNewlineLimit == null) {
    return safeCharLimit ? normalized.slice(0, safeCharLimit) : normalized;
  }

  let newlineCount = 0;
  let result = '';
  for (const char of normalized) {
    if (char === '\n') {
      newlineCount += 1;
      if (newlineCount > safeNewlineLimit) {
        continue;
      }
    }
    result += char;
    if (safeCharLimit && result.length >= safeCharLimit) {
      result = result.slice(0, safeCharLimit);
      break;
    }
  }

  if (safeCharLimit && result.length > safeCharLimit) {
    return result.slice(0, safeCharLimit);
  }
  return result;
}
