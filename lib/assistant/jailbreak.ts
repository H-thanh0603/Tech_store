/**
 * Jailbreak / prompt-injection detector for user messages. Runs BEFORE any
 * model call: a hit blocks the turn (no budget burned) and is logged to
 * security_events for the abuse ladder.
 *
 * Pattern-based and conservative: every pattern targets an explicit override
 * or exfiltration attempt, in English and Vietnamese. Normal shopping text
 * (even angry complaints) must not match — covered by unit tests.
 */

export type JailbreakKind = 'prompt-injection' | 'fence-forgery' | 'system-exfil'

interface Finding {
  blocked: true
  kind: JailbreakKind
}

const INJECTION_PATTERNS: RegExp[] = [
  // "ignore/forget previous instructions" (EN + VI)
  /ignor\w*\s+(all\s+)?(previous|prior|your|above)\s+(instructions?|prompts?|rules?|guidelines?)/i,
  /bỏ\s+qua\s+(mọi|tất cả|các)?\s*(chỉ dẫn|hướng dẫn|chỉ thị|quy tắc|luật)/i,
  /quên\s+(hết|mọi|tất cả)?\s*(chỉ dẫn|hướng dẫn|lệnh)/i,
  /phớt\s+lờ\s+(chỉ dẫn|hướng dẫn|hệ thống)/i,
  // role override / jailbreak personas
  /\bDAN\b(\s+mode)?/i,
  /\bdeveloper\s+mode\b/i,
  /jailbreak/i,
  /đóng\s+vai\s+.*(không\s+giới\s+hạn|vượt\s+ngục|không\s+bị\s+kiểm\s+duyệt)/i,
  /hãy\s+hành\s+xử\s+như\s+thể\s+(bạn\s+)?không\s+(bị|có)\s+(giới\s+hạn|ràng\s+buộc)/i,
  // "you are now ..." system overrides
  /you\s+are\s+now\s+(?!.*(shopping|store|assistant))/i,
  /từ\s+giờ\s+(bạn\s+)?là\s+(?!.*(trợ lý|techstore))/i,
  // tool/loop hijack attempts
  /gọi\s+tool\s+\w+\s+với\s+.*(mọi|tất cả|hết)/i,
  /apply\s+(all|every)\s+(staged\s+)?changes?/i,
  /áp\s+dụng\s+(hết|tất cả)\s+change/i,
]

const EXFIL_PATTERNS: RegExp[] = [
  // system prompt / internals exfiltration
  /(reveal|show|print|output|dump|tiết\s+lộ|hiện|in\s+ra|cho\s+xem)\s+.*(system\s+prompt|system\s+instructions?|chỉ\s+dẫn\s+hệ\s+thống|prompt\s+hệ\s+thống)/i,
  /(system\s+prompt|chỉ\s+dẫn\s+hệ\s+thống)\s+(của\s+bạn\s+)?(là\s+gì|gồm\s+những\s+gì|nói\s+gì)/i,
  /(api[_\s-]?key|secret|service_role|mật\s+khẩu\s+hệ\s+thống)\s+(của\s+(bạn|hệ\s+thống|server))?/i,
  /liệt\s+kê\s+(mọi|tất cả)\s+(tool|công\s+cụ)\s+(nội\s+bộ|ẩn)/i,
]

const FENCE_FORGERY_PATTERNS: RegExp[] = [
  // Forged tool-output fences: the model is told fenced content is store
  // data, so user-pasted fences are an injection primitive — block, the
  // model path strips nothing.
  /<\/?storefront_data>/i,
  /<\/?tool_result>/i,
  /\[tool_result[\s:\]]/i,
]

// H4: indirect / third-party injection — instructions that arrive via pasted
// page content, links or "the tool said" hearsay. The model must treat tool
// output as data; a user message that smuggles a new instruction *through* a
// quoted source is the same primitive as a direct override.
const INDIRECT_PATTERNS: RegExp[] = [
  // "the page says to ..." / pasted instructions to follow
  /(trang|page|web|bài viết|bai viet|email|tài liệu|tai lieu).{0,40}(bảo|nói|ghi|yêu cầu|hướng dẫn).{0,40}(làm theo|thực hiện|gọi tool|apply|gửi)/i,
  /(làm theo|thực hiện|follow).{0,40}(hướng dẫn|chỉ dẫn|instruction).{0,40}(trong|từ|from).{0,40}(trang|page|link|tool|kết quả|ket qua)/i,
  // instruction + URL in one breath (fetch-and-follow, send-to-webhook)
  /(mở|mo|truy cập|truy cap|tải|tai|fetch|open|visit|curl|wget).{0,30}https?:\/\/\S+/i,
  /(gửi|gui|send|post|forward|chuyển).{0,30}(đến|den|tới|toi|to).{0,30}https?:\/\/\S+/i,
  /(copy|dán|paste).{0,40}(vào|vao|từ|tu|from).{0,40}(tool|kết quả|ket qua|trang|page)/i,
  // fake tool/system voice inside user text
  /\[?(system|tool|assistant)\s*[:\]]\s*(bảo|nói|yêu cầu|instruction|ignore|reveal)/i,
  /(kết quả tool|ket qua tool|tool (đã |da )?trả).{0,40}(bảo|nói|yêu cầu).{0,40}(gọi|gửi|tiết lộ|reveal|gửi tiền|thanh toán)/i,
]

export type TranscriptMessage = { role: string; content: string }

export function detectJailbreak(text: string): Finding | null {
  for (const re of FENCE_FORGERY_PATTERNS) {
    if (re.test(text)) return { blocked: true, kind: 'fence-forgery' }
  }
  for (const re of EXFIL_PATTERNS) {
    if (re.test(text)) return { blocked: true, kind: 'system-exfil' }
  }
  for (const re of INJECTION_PATTERNS) {
    if (re.test(text)) return { blocked: true, kind: 'prompt-injection' }
  }
  for (const re of INDIRECT_PATTERNS) {
    if (re.test(text)) return { blocked: true, kind: 'prompt-injection' }
  }
  return null
}

/**
 * H4: scan the FULL user transcript (not just the last message) plus any
 * injected tool-output text. A jailbreak split across turns ("ignore that" …
 * three turns later "…and do X") or laundered through a pasted tool result
 * must still block the turn without burning model budget.
 */
export function scanTranscript(messages: TranscriptMessage[]): Finding | null {
  for (const m of messages) {
    if (m.role !== 'user') continue
    const hit = detectJailbreak(m.content ?? '')
    if (hit) return hit
  }
  return null
}

export const JAILBREAK_REFUSAL =
  'Mình chỉ hỗ trợ mua sắm trong TechStore nên không thể làm theo yêu cầu này. Bạn cần tìm máy gì, ngân sách bao nhiêu?'

export const MERCHANT_JAILBREAK_REFUSAL =
  'Mình chỉ hỗ trợ vận hành TechStore nên không thể làm theo yêu cầu này.'
