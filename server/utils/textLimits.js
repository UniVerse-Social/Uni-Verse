const TEXT_MODULE_CHAR_LIMIT = 100;
const BIO_CHAR_LIMIT = 400;
const POST_CHAR_LIMIT = 400;
const CLUB_POST_CHAR_LIMIT = 400;
const COMMENT_CHAR_LIMIT = 400;
const MAX_TEXTAREA_NEWLINES = 5;

function enforceTextLimits(value, charLimit = POST_CHAR_LIMIT, newlineLimit = MAX_TEXTAREA_NEWLINES) {
  if (value == null) return '';
  const normalized = String(value).replace(/\r/g, '');
  if (!charLimit && (newlineLimit == null || newlineLimit < 0)) {
    return normalized;
  }
  let newlineCount = 0;
  let result = '';
  for (const char of normalized) {
    if (char === '\n') {
      newlineCount += 1;
      if (newlineLimit != null && newlineLimit >= 0 && newlineCount > newlineLimit) {
        continue;
      }
    }
    result += char;
    if (charLimit && result.length >= charLimit) {
      result = result.slice(0, charLimit);
      break;
    }
  }
  if (charLimit && result.length > charLimit) {
    return result.slice(0, charLimit);
  }
  return result;
}

module.exports = {
  enforceTextLimits,
  TEXT_MODULE_CHAR_LIMIT,
  BIO_CHAR_LIMIT,
  POST_CHAR_LIMIT,
  CLUB_POST_CHAR_LIMIT,
  COMMENT_CHAR_LIMIT,
  MAX_TEXTAREA_NEWLINES,
};
