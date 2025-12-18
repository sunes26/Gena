/**
 * 개인정보 보호 관련 유틸리티 함수
 * @module utils/privacy
 */

/**
 * userId를 마스킹 처리합니다 (GDPR 준수)
 * @param {string} userId - 마스킹할 사용자 ID
 * @returns {string} 마스킹된 사용자 ID
 *
 * @example
 * maskUserId('abc123def456ghi789')  // 'abc***i789'
 * maskUserId('short')               // 's***t'
 * maskUserId('')                    // '[EMPTY]'
 * maskUserId(null)                  // '[NULL]'
 * maskUserId(undefined)             // '[UNDEFINED]'
 */
function maskUserId(userId) {
  // null, undefined 처리
  if (userId === null) return '[NULL]';
  if (userId === undefined) return '[UNDEFINED]';

  // 문자열로 변환
  const userIdStr = String(userId);

  // 빈 문자열 처리
  if (!userIdStr || userIdStr.length === 0) return '[EMPTY]';

  // 길이에 따라 다르게 마스킹
  const len = userIdStr.length;

  if (len <= 3) {
    // 3자 이하: 첫 글자만 표시
    return userIdStr[0] + '***';
  } else if (len <= 8) {
    // 4-8자: 앞 1자 + *** + 뒤 1자
    return userIdStr[0] + '***' + userIdStr[len - 1];
  } else {
    // 9자 이상: 앞 3자 + *** + 뒤 4자
    return userIdStr.slice(0, 3) + '***' + userIdStr.slice(-4);
  }
}

/**
 * 이메일 주소를 마스킹 처리합니다
 * @param {string} email - 마스킹할 이메일 주소
 * @returns {string} 마스킹된 이메일 주소
 *
 * @example
 * maskEmail('user@example.com')     // 'u***r@example.com'
 * maskEmail('admin@test.org')       // 'a***n@test.org'
 * maskEmail('a@b.com')              // 'a***@b.com'
 */
function maskEmail(email) {
  if (!email || typeof email !== 'string') return '[INVALID_EMAIL]';

  const [localPart, domain] = email.split('@');

  if (!localPart || !domain) return '[INVALID_EMAIL]';

  if (localPart.length <= 2) {
    return localPart[0] + '***@' + domain;
  } else {
    return localPart[0] + '***' + localPart[localPart.length - 1] + '@' + domain;
  }
}

/**
 * IP 주소를 마스킹 처리합니다
 * @param {string} ip - 마스킹할 IP 주소
 * @returns {string} 마스킹된 IP 주소
 *
 * @example
 * maskIP('192.168.1.100')           // '192.168.***.***'
 * maskIP('2001:0db8:85a3::8a2e')    // '2001:0db8:***:***'
 */
function maskIP(ip) {
  if (!ip || typeof ip !== 'string') return '[INVALID_IP]';

  // IPv4
  if (ip.includes('.')) {
    const parts = ip.split('.');
    if (parts.length !== 4) return '[INVALID_IP]';
    return `${parts[0]}.${parts[1]}.***.***`;
  }

  // IPv6
  if (ip.includes(':')) {
    const parts = ip.split(':');
    if (parts.length < 3) return '[INVALID_IP]';
    return `${parts[0]}:${parts[1]}:***:***`;
  }

  return '[INVALID_IP]';
}

module.exports = {
  maskUserId,
  maskEmail,
  maskIP
};
