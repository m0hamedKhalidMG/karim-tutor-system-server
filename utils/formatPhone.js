// Egyptian numbers: 01XXXXXXXXX → 201XXXXXXXXX
function formatEgyptianPhone(phone) {
  if (!phone) return null;
  const cleaned = String(phone).replace(/[\s\-\+]/g, '');
  if (cleaned.startsWith('0')) return '2' + cleaned;
  if (cleaned.startsWith('20')) return cleaned;
  if (cleaned.startsWith('2')) return cleaned;
  return '20' + cleaned;
}

module.exports = { formatEgyptianPhone };
