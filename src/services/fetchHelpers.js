export async function safeJson(res) {
  // Attempt to parse JSON, but handle empty or invalid bodies gracefully.
  if (!res) return { error: 'no response' }
  const ct = res.headers.get('content-type') || ''
  if (res.status === 204) return { }
  try {
    // Prefer text then JSON.parse to capture empty-body cases
    const txt = await res.text()
    if (!txt) return { }
    // If content-type is JSON, parse; otherwise try to parse but fallback
    if (ct.includes('application/json')) return JSON.parse(txt)
    try {
      return JSON.parse(txt)
    } catch (e) {
      // Not JSON — return raw text under 'text' key
      return { text: txt }
    }
  } catch (err) {
    return { error: err.message || 'failed to read response' }
  }
}
