import { Router } from 'express';
import db from '../db/database.js';
import type { AuthenticatedRequest } from '../middleware/auth.js';

const router = Router();

// GET /api/stats
router.get('/', async (req: AuthenticatedRequest, res) => {
  try {
    const bid = req.user!.business_id;

    const { rows: newLeadsRow } = await db.query(`
      SELECT COUNT(*) as count FROM contacts
      WHERE business_id = $1 AND date(created_at) = CURRENT_DATE
    `, [bid]);
    const newLeadsToday = parseInt(newLeadsRow[0].count, 10);

    const { rows: appointmentsRow } = await db.query(`
      SELECT COUNT(*) as count FROM appointments
      WHERE business_id = $1
      AND date >= CURRENT_DATE
      AND date < CURRENT_DATE + INTERVAL '7 days'
    `, [bid]);
    const appointmentsThisWeek = parseInt(appointmentsRow[0].count, 10);

    const { rows: revenueRow } = await db.query(`
      SELECT COALESCE(SUM(value), 0) as total FROM pipeline_deals
      WHERE business_id = $1 AND stage = 'closed'
      AND date(created_at) >= date_trunc('month', CURRENT_DATE)
    `, [bid]);
    const revenueThisMonth = parseFloat(revenueRow[0].total);

    const { rows: openConvRow } = await db.query(`
      SELECT COUNT(*) as count FROM conversations
      WHERE business_id = $1 AND status = 'open'
    `, [bid]);
    const openConversations = parseInt(openConvRow[0].count, 10);

    const { rows: pendingTasksRow } = await db.query(`
      SELECT COUNT(*) as count FROM tasks
      WHERE business_id = $1 AND status = 'pending'
    `, [bid]);
    const pendingTasks = parseInt(pendingTasksRow[0].count, 10);

    // Real growth: contacts this month vs last month
    const { rows: growthRows } = await db.query(`
      SELECT
        COUNT(*) FILTER (WHERE created_at >= date_trunc('month', CURRENT_DATE)) AS this_month,
        COUNT(*) FILTER (
          WHERE created_at >= date_trunc('month', CURRENT_DATE - INTERVAL '1 month')
            AND created_at < date_trunc('month', CURRENT_DATE)
        ) AS last_month
      FROM contacts WHERE business_id = $1
    `, [bid]);
    const thisMonth = parseInt(growthRows[0].this_month, 10);
    const lastMonth = parseInt(growthRows[0].last_month, 10);
    const growthPercent = lastMonth === 0
      ? (thisMonth > 0 ? 100 : 0)
      : Math.round(((thisMonth - lastMonth) / lastMonth) * 100);

    // Weekly chart data (last 7 days)
    const { rows: weeklyData } = await db.query(`
      SELECT
        CASE EXTRACT(DOW FROM created_at)
          WHEN 0 THEN 'Dom'
          WHEN 1 THEN 'Lun'
          WHEN 2 THEN 'Mar'
          WHEN 3 THEN 'Mie'
          WHEN 4 THEN 'Jue'
          WHEN 5 THEN 'Vie'
          WHEN 6 THEN 'Sab'
        END as name,
        COUNT(*) as leads
      FROM contacts
      WHERE business_id = $1
      AND created_at >= CURRENT_DATE - INTERVAL '7 days'
      GROUP BY EXTRACT(DOW FROM created_at)
      ORDER BY EXTRACT(DOW FROM created_at)
    `, [bid]);

    // Appointments per day (tasks as proxy)
    const { rows: appointmentsData } = await db.query(`
      SELECT
        CASE EXTRACT(DOW FROM created_at)
          WHEN 0 THEN 'Dom'
          WHEN 1 THEN 'Lun'
          WHEN 2 THEN 'Mar'
          WHEN 3 THEN 'Mie'
          WHEN 4 THEN 'Jue'
          WHEN 5 THEN 'Vie'
          WHEN 6 THEN 'Sab'
        END as name,
        COUNT(*) as citas
      FROM tasks
      WHERE business_id = $1
      AND created_at >= CURRENT_DATE - INTERVAL '7 days'
      GROUP BY EXTRACT(DOW FROM created_at)
    `, [bid]);

    // Real closed deals per day (replaces the mocked 20% of leads)
    const { rows: salesData } = await db.query(`
      SELECT
        CASE EXTRACT(DOW FROM created_at)
          WHEN 0 THEN 'Dom'
          WHEN 1 THEN 'Lun'
          WHEN 2 THEN 'Mar'
          WHEN 3 THEN 'Mie'
          WHEN 4 THEN 'Jue'
          WHEN 5 THEN 'Vie'
          WHEN 6 THEN 'Sab'
        END as name,
        COUNT(*) as ventas
      FROM pipeline_deals
      WHERE business_id = $1
        AND stage = 'closed'
        AND created_at >= CURRENT_DATE - INTERVAL '7 days'
      GROUP BY EXTRACT(DOW FROM created_at)
    `, [bid]);

    // Merge into chart data
    const days = ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab'];

    // Pivot the current day so it's at the end of the chart
    const todayIndex = new Date().getDay();
    const displayDays: string[] = [];
    for (let i = 6; i >= 0; i--) {
      const idx = (todayIndex - i + 7) % 7;
      displayDays.push(days[idx]);
    }

    const chartData = displayDays.map((day) => {
      const leadEntry  = weeklyData.find((d: any) => d.name === day);
      const citaEntry  = appointmentsData.find((d: any) => d.name === day);
      const salesEntry = salesData.find((d: any) => d.name === day);

      return {
        name: day,
        leads:  leadEntry  ? parseInt(leadEntry.leads,  10) : 0,
        citas:  citaEntry  ? parseInt(citaEntry.citas,  10) : 0,
        ventas: salesEntry ? parseInt(salesEntry.ventas, 10) : 0, // Real closed deals
      };
    });

    res.json({
      newLeadsToday: newLeadsToday || 0,
      appointmentsThisWeek: appointmentsThisWeek || 0,
      revenueThisMonth: revenueThisMonth || 0,
      openConversations: openConversations || 0,
      pendingTasks: pendingTasks || 0,
      growthPercent,
      chartData,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'DB Error' });
  }
});

export default router;
