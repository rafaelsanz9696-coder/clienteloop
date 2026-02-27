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
      SELECT COUNT(*) as count FROM tasks
      WHERE business_id = $1 AND status = 'pending'
      AND created_at >= CURRENT_DATE - INTERVAL '7 days'
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

    const growthPercent = 15; // TODO: calculate from historical data

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
      const leadEntry = weeklyData.find((d: any) => d.name === day);
      const citaEntry = appointmentsData.find((d: any) => d.name === day);

      const leadsCount = leadEntry ? parseInt(leadEntry.leads) : 0;
      const citasCount = citaEntry ? parseInt(citaEntry.citas) : 0;

      return {
        name: day,
        leads: leadsCount,
        citas: citasCount,
        ventas: Math.floor(leadsCount * 0.2), // Mock sales as 20% of leads for the visual
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
