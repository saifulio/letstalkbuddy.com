// Advisor pricing v2: flat intro price covering the first 10 minutes of a
// session (shown next to the per-minute rate in profile settings).
module.exports.up = async (conn, { addColumn }) => {
  await addColumn(conn, 'advisors', 'intro_price', 'DECIMAL(8,2) NULL AFTER `rate_per_min`');
  // Backfill existing advisors: 10 minutes at their per-minute rate.
  await conn.query('UPDATE advisors SET intro_price = rate_per_min * 10 WHERE intro_price IS NULL');
};
