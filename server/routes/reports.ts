import { Router } from 'express';
import db from '../db/database.js';
import type { AuthenticatedRequest } from '../middleware/auth.js';

const router = Router();

// GET /api/reports?from=2024-01-01&to=2024-12-31
router.get('/', async (req: AuthenticatedRequest, res) => {
  try {
    const bid = req.user!.business_id;

    const to = req.query.to ? new Date(req.query.to as string) : new Date();
    const from = req.query.from
      ? new Date(req.query.from as string)
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const fromStr = from.toISOString();
    const toStr = to.toISOString();

    const [totalLeads, pipelineFunnel, revenueResult, topContacts, chartResult, channelResult, responseTimeResult] =
      await Promise.all([
        db.query(
          'SELECT COUNT(*) as count FROM contacts WHERE business_id = $1 AND created_at BETWEEN $2 AND $3',
          [bid, fromStr, toStr],
        ),
        db.query(
          'SELECT stage, COUNT(*) as count FROM pipeline_deals WHERE business_id = $1 GROUP BY stage',
          [bid],
        ),
        db.query(
          `SELECT COALESCE(SUM(value), 0) as total
           FROM pipeline_deals
           WHERE business_id = $1 AND stage = 'closed' AND created_at BETWEEN $2 AND $3`,
          [bid, fromStr, toStr],
        ),
        db.query(
          `SELECT c.id, c.name, c.channel,
                  COALESCE(SUM(pd.value), 0) as total_value,
                  COUNT(pd.id) as deal_count
           FROM contacts c
           LEFT JOIN pipeline_deals pd ON pd.contact_id = c.id AND pd.stage = 'closed'
           WHERE c.business_id = $1
           GROUP BY c.id, c.name, c.channel
           ORDER BY total_value DESC
           LIMIT 5`,
          [bid],
        ),
        db.query(
          `SELECT DATE(created_at) as day, COUNT(*) as leads
           FROM contacts
           WHERE business_id = $1 AND created_at BETWEEN $2 AND $3
           GROUP BY DATE(created_at)
           ORDER BY day ASC`,
          [bid, fromStr, toStr],
        ),
        // Channel breakdown: leads per channel in period
        db.query(
          `SELECT channel, COUNT(*) as count
           FROM contacts
           WHERE business_id = $1 AND created_at BETWEEN $2 AND $3
           GROUP BY channel
           ORDER BY count DESC`,
          [bid, fromStr, toStr],
        ),
        // Average first-response time (minutes) per conversation in period
        db.query(
          `SELECT AVG(
             EXTRACT(EPOCH FROM (m_reply.created_at - m_first.created_at)) / 60
           ) as avg_minutes
           FROM (
             SELECT c.id as conv_id, MIN(m.created_at) as created_at
             FROM messages m
             JOIN conversations c ON c.id = m.conversation_id
             WHERE c.business_id = $1
               AND m.sender = 'client'
               AND m.created_at BETWEEN $2 AND $3
             GROUP BY c.id
           ) m_first
           JOIN LATERAL (
             SELECT created_at FROM messages
             WHERE conversation_id = m_first.conv_id
               AND sender IN ('agent', 'ai')
               AND created_at > m_first.created_at
             ORDER BY created_at ASC LIMIT 1
           ) m_reply ON true`,
          [bid, fromStr, toStr],
        ),
      ]);

    const funnel: Record<string, number> = { new: 0, in_progress: 0, closed: 0 };
    let totalDeals = 0;
    for (const row of pipelineFunnel.rows) {
      funnel[row.stage] = Number(row.count);
      totalDeals += Number(row.count);
    }

    const conversionRate =
      totalDeals > 0 ? Math.round((funnel.closed / totalDeals) * 100) : 0;

    const avgMin = responseTimeResult.rows[0]?.avg_minutes;

    res.json({
      totalLeads: Number(totalLeads.rows[0].count),
      revenue: Number(revenueResult.rows[0].total),
      conversionRate,
      activeDeals: funnel.new + funnel.in_progress,
      funnel,
      topContacts: topContacts.rows,
      chartData: chartResult.rows.map((r: any) => ({
        day: new Date(r.day).toLocaleDateString('es-MX', { month: 'short', day: 'numeric' }),
        leads: Number(r.leads),
      })),
      channelBreakdown: channelResult.rows.map((r: any) => ({
        channel: r.channel as string,
        count: Number(r.count),
      })),
      avgResponseMinutes: avgMin != null ? Math.round(Number(avgMin)) : null,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'DB Error' });
  }
});

export default router;
