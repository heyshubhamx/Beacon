/**
 * Campaign & Notification List Routes
 * 
 * Handles getting campaigns and their details.
 * NOTE: The old /notifications routes were removed as they were
 * identical to /campaigns (both queried the same notifications table).
 */

const express = require('express');
const router = express.Router();
const { db, sql } = require('../../db');

// Get all campaigns (paginated)
router.get('/campaigns', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    // Use raw SQL to handle grouping by groupId
    // If groupId is present, sum up the stats across all sites in that group
    // If groupId is NULL, treat as a standalone campaign (group by id)
    const data = await sql`
      WITH grouped_campaigns AS (
        SELECT 
          COALESCE("groupId", id) as group_key,
          MAX(id) as last_id,
          SUM(COALESCE("sentCount", 0))::int as total_sent,
          SUM(COALESCE("deliveredCount", 0))::int as total_delivered,
          SUM(COALESCE("clickCount", 0))::int as total_clicks,
          SUM(COALESCE("failedCount", 0))::int as total_failed,
          COUNT(*)::int as site_count,
          MAX(timestamp) as last_timestamp
        FROM notifications
        GROUP BY COALESCE("groupId", id)
      )
      SELECT 
        n.*,
        g.total_sent as "sentCount",
        g.total_delivered as "deliveredCount",
        g.total_clicks as "clickCount",
        g.total_failed as "failedCount",
        g.site_count as "siteCount",
        (SELECT domain FROM websites WHERE id = n."websiteId") as domain
      FROM notifications n
      JOIN grouped_campaigns g ON n.id = g.last_id
      ORDER BY g.last_timestamp DESC
      LIMIT ${limit} OFFSET ${offset}
    `;

    const countResult = await sql`
      SELECT COUNT(*) FROM (
        SELECT COALESCE("groupId", id) 
        FROM notifications 
        GROUP BY COALESCE("groupId", id)
      ) as groups
    `;
    const totalCount = parseInt(countResult[0].count);

    res.json({
      data: data || [],
      pagination: { total: totalCount, page, limit, pages: Math.ceil(totalCount / limit) },
    });
  } catch (error) {
    console.error('Error in get-campaigns:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get campaign details
router.get('/campaign/:id', async (req, res) => {
  const campaignId = req.params.id;

  try {
    const { data: campaign, error } = await db
      .from('notifications')
      .select('*')
      .eq('id', campaignId)
      .single();

    if (error) {
      console.error('Error fetching campaign:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }

    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    const { data: website, error: websiteError } = await db
      .from('websites')
      .select('domain')
      .eq('id', campaign.websiteId)
      .single();

    if (!websiteError && website) {
      campaign.domain = website.domain;
    }

    res.json(campaign);
  } catch (error) {
    console.error('Error in get-campaign:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete a campaign
// Delete a campaign (or a group of campaigns)
router.delete('/campaign/:id', async (req, res) => {
  const campaignId = req.params.id;

  try {
    // Check if this notification belongs to a group
    const { data: campaign } = await db
      .from('notifications')
      .select('groupId')
      .eq('id', campaignId)
      .single();

    if (campaign && campaign.groupId) {
      // Delete the entire group
      const { error } = await db
        .from('notifications')
        .delete()
        .eq('groupId', campaign.groupId);

      if (error) throw error;
    } else {
      // Delete single notification
      const { error } = await db
        .from('notifications')
        .delete()
        .eq('id', campaignId);

      if (error) throw error;
    }

    res.json({ success: true, message: 'Campaign(s) deleted successfully' });
  } catch (error) {
    console.error('Error deleting campaign:', error);
    res.status(500).json({ error: 'Internal server error while deleting' });
  }
});

module.exports = router;
