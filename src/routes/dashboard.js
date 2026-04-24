const express = require('express');
const router = express.Router();
const { sql } = require('../../db');

/**
 * Get aggregated dashboard statistics efficiently
 */
router.get('/dashboard-stats', async (req, res) => {
  try {
    // 1. Get counts using parallel SQL queries for speed
    const [
      websitesResult,
      subscriptionsResult,
      notificationsResult
    ] = await Promise.all([
      sql`SELECT COUNT(*)::int as count FROM websites`,
      sql`SELECT COUNT(*)::int as count FROM subscriptions`,
      sql`SELECT 
            COUNT(*)::int as sent,
            COALESCE(SUM("deliveredCount"), 0)::int as delivered,
            COALESCE(SUM("clickCount"), 0)::int as clicks
          FROM notifications`
    ]);

    const totalWebsites = websitesResult[0].count;
    const totalSubscriptions = subscriptionsResult[0].count;
    const totalNotifications = notificationsResult[0].sent;
    const totalDelivered = notificationsResult[0].delivered;
    const totalClicks = notificationsResult[0].clicks;
    
    const clickRate = totalDelivered > 0 ? (totalClicks / totalDelivered) * 100 : 0;

    // 2. Get recent activity (last 7 days counts by day)
    // Using a series generator for consistent days even if zero
    const activityResult = await sql`
      WITH RECURSIVE days AS (
        SELECT CURRENT_DATE - INTERVAL '6 days' as day
        UNION ALL
        SELECT day + INTERVAL '1 day' FROM days WHERE day < CURRENT_DATE
      )
      SELECT 
        TO_CHAR(d.day, 'Dy') as name,
        (SELECT COUNT(*)::int FROM subscriptions s WHERE s."createdAt"::date = d.day) as subscriptions,
        (SELECT COUNT(*)::int FROM notifications n WHERE n."timestamp"::date = d.day) as notifications,
        (SELECT COALESCE(SUM("deliveredCount"), 0)::int FROM notifications n WHERE n."timestamp"::date = d.day) as deliveries,
        (SELECT COALESCE(SUM("clickCount"), 0)::int FROM notifications n WHERE n."timestamp"::date = d.day) as clicks
      FROM days d
      ORDER BY d.day ASC
    `;

    // 3. Get Browser distribution
    const browserResult = await sql`
      SELECT 
        COALESCE(browser, 'Unknown') as name, 
        COUNT(*)::int as value 
      FROM subscriptions 
      GROUP BY browser 
      HAVING COUNT(*) > 0
      ORDER BY value DESC
      LIMIT 10
    `;

    // 4. Recent notification performance
    const performanceResult = await sql`
      SELECT 
        title,
        "sentCount" as sent,
        "deliveredCount" as delivered,
        "clickCount" as clicks,
        CASE WHEN "deliveredCount" > 0 THEN ("clickCount"::float / "deliveredCount"::float) * 100 ELSE 0 END as "clickRate"
      FROM notifications
      ORDER BY timestamp DESC
      LIMIT 5
    `;

    res.json({
      totalWebsites,
      totalSubscriptions,
      totalNotifications,
      totalClicks,
      clickRate,
      recentActivity: activityResult,
      browserDistribution: browserResult,
      notificationPerformance: performanceResult
    });
  } catch (error) {
    console.error('Error in dashboard-stats endpoint:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Get detailed analytics data for the full analytics page
 */
router.get('/analytics-data', async (req, res) => {
  try {
    const { websiteId, range = '30d' } = req.query;
    
    let days = 30;
    if (range === '7d') days = 7;
    if (range === '90d') days = 90;

    const whereWebsite = websiteId && websiteId !== 'all' ? sql`AND "websiteId" = ${websiteId}` : sql``;

    // Daily stats
    const dailyStats = await sql`
      WITH RECURSIVE days AS (
        SELECT CURRENT_DATE - (${days - 1} || ' days')::interval as day
        UNION ALL
        SELECT day + INTERVAL '1 day' FROM days WHERE day < CURRENT_DATE
      )
      SELECT 
        TO_CHAR(d.day, 'YYYY-MM-DD') as date,
        (SELECT COUNT(*)::int FROM subscriptions s WHERE s."createdAt"::date = d.day ${whereWebsite}) as subscriptions,
        (SELECT COUNT(*)::int FROM notifications n WHERE n."timestamp"::date = d.day ${whereWebsite}) as notifications,
        (SELECT COALESCE(SUM("clickCount"), 0)::int FROM notifications n WHERE n."timestamp"::date = d.day ${whereWebsite}) as clicks
      FROM days d
      ORDER BY d.day ASC
    `;

    // Browser distribution
    const browserStats = await sql`
      SELECT 
        COALESCE(browser, 'Unknown') as name, 
        COUNT(*)::int as value 
      FROM subscriptions 
      WHERE 1=1 ${whereWebsite}
      GROUP BY browser 
      ORDER BY value DESC
      LIMIT 10
    `;

    // OS distribution
    const osStats = await sql`
      SELECT 
        COALESCE(os, 'Unknown') as name, 
        COUNT(*)::int as value 
      FROM subscriptions 
      WHERE 1=1 ${whereWebsite}
      GROUP BY os 
      ORDER BY value DESC
      LIMIT 10
    `;

    // Device distribution
    const deviceStats = await sql`
      SELECT 
        CASE WHEN "isMobile" THEN 'Mobile' ELSE 'Desktop' END as name, 
        COUNT(*)::int as value 
      FROM subscriptions 
      WHERE 1=1 ${whereWebsite}
      GROUP BY "isMobile"
    `;

    // Geo distribution
    const geoStats = await sql`
      SELECT 
        COALESCE(country, 'Unknown') as name, 
        COUNT(*)::int as value 
      FROM subscriptions 
      WHERE 1=1 ${whereWebsite}
      GROUP BY country 
      ORDER BY value DESC
      LIMIT 15
    `;

    // BUG-19 FIX: Query actual prompt metrics instead of hardcoding heuristics
    const conversionRates = await sql`
      SELECT 
        w.id as "websiteId",
        w.domain,
        COALESCE(w.prompt_impressions, 0)::int as "promptShown",
        COALESCE(w.prompt_allowed, 0)::int as "promptAllowed",
        (SELECT COUNT(*)::int FROM subscriptions s WHERE s."websiteId" = w.id) as subscribed
      FROM websites w
      ORDER BY subscribed DESC
    `;

    res.json({
      dailyStats,
      browserStats,
      osStats,
      deviceStats,
      geoStats,
      conversionRates: conversionRates.map(w => ({
        ...w,
        promptShown: w.promptShown || 0,
        rate: w.promptShown > 0 ? parseFloat(((w.promptAllowed / w.promptShown) * 100).toFixed(1)) : 0
      }))
    });
  } catch (error) {
    console.error('Error in analytics-data endpoint:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Bulk delete notifications
 */
router.post('/notifications/bulk-delete', async (req, res) => {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids)) return res.status(400).json({ error: 'IDs array required' });
    
    await sql`DELETE FROM notifications WHERE id IN ${sql(ids)}`;
    res.json({ success: true, deleted: ids.length });
  } catch (error) {
    console.error('Error in bulk-delete-notifications:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Bulk delete subscriptions
 */
router.post('/subscriptions/bulk-delete', async (req, res) => {
  try {
    const { endpoints } = req.body;
    if (!endpoints || !Array.isArray(endpoints)) return res.status(400).json({ error: 'Endpoints array required' });
    
    await sql`DELETE FROM subscriptions WHERE endpoint IN ${sql(endpoints)}`;
    res.json({ success: true, deleted: endpoints.length });
  } catch (error) {
    console.error('Error in bulk-delete-subscriptions:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
