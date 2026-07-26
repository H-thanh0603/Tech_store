export function getRateLimitIdentity(requestHeaders: Pick<Headers, 'get'>, sessionHash: string) {
  // The edge proxy must overwrite x-real-ip or append the real client as the last XFF hop.
  const edgeAddress =
    requestHeaders.get('x-real-ip')?.trim() ||
    requestHeaders.get('x-forwarded-for')?.split(',').at(-1)?.trim() ||
    'unknown'

  return `${sessionHash}:${edgeAddress}`
}
