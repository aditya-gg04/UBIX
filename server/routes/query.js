/**
 * UBIX Query Engine API Routes
 * 
 * Structured query system with preset templates.
 */
import { Router } from 'express';
import { queryAll, queryOne } from '../db/database.js';

const router = Router();

// Preset query templates
const PRESETS = [
  {
    id: 'active_no_inspection',
    name: 'Active businesses with no inspection in 18 months',
    description: 'Find active businesses that have not been inspected recently',
    category: 'compliance',
    icon: '🔍',
  },
  {
    id: 'multi_dept_dormant',
    name: 'Multi-department businesses that are dormant',
    description: 'Businesses registered in 3+ departments but classified as dormant',
    category: 'risk',
    icon: '⚠️',
  },
  {
    id: 'top_cross_dept',
    name: 'Top businesses by cross-department activity',
    description: 'Most active businesses across multiple departments',
    category: 'analytics',
    icon: '📊',
  },
  {
    id: 'recent_closures',
    name: 'Recently closed businesses',
    description: 'Businesses classified as closed in the last 6 months',
    category: 'monitoring',
    icon: '🔴',
  },
  {
    id: 'no_gstin',
    name: 'Active businesses without GSTIN',
    description: 'Active businesses that have no GSTIN on record',
    category: 'compliance',
    icon: '📋',
  },
  {
    id: 'high_event_activity',
    name: 'Businesses with high recent activity',
    description: 'Businesses with 5+ events in the last 6 months',
    category: 'analytics',
    icon: '🔥',
  },
  {
    id: 'district_summary',
    name: 'Business status by district',
    description: 'Summary of active/dormant/closed businesses per district',
    category: 'analytics',
    icon: '🗺️',
  },
  {
    id: 'unlinked_events_dept',
    name: 'Unlinked events by department',
    description: 'Departments with the most unresolved events',
    category: 'data_quality',
    icon: '🔗',
  },
];

// GET /api/query/presets — Get available preset queries
router.get('/presets', (req, res) => {
  res.json({ success: true, data: PRESETS });
});

// POST /api/query — Execute a query
router.post('/', (req, res) => {
  const { preset_id, params: queryParams = {} } = req.body;

  try {
    let results, description;

    switch (preset_id) {
      case 'active_no_inspection': {
        const months = queryParams.months || 18;
        const cutoff = new Date();
        cutoff.setMonth(cutoff.getMonth() - months);
        const cutoffStr = cutoff.toISOString().split('T')[0];

        results = queryAll(`
          SELECT u.id, u.primary_name, u.primary_pan, u.primary_district, u.status,
            ac.confidence, ac.last_event_date, ac.event_count,
            MAX(CASE WHEN ae.event_type = 'inspection' THEN ae.event_date ELSE NULL END) as last_inspection
          FROM ubids u
          JOIN activity_classifications ac ON u.id = ac.ubid_id
          LEFT JOIN activity_events ae ON u.id = ae.ubid_id
          WHERE ac.status = 'active'
          GROUP BY u.id
          HAVING last_inspection IS NULL OR last_inspection < ?
          ORDER BY ac.event_count DESC
          LIMIT 50
        `, [cutoffStr]);
        description = `Active businesses with no inspection in the last ${months} months`;
        break;
      }

      case 'multi_dept_dormant': {
        const minDepts = queryParams.min_departments || 3;
        results = queryAll(`
          SELECT u.id, u.primary_name, u.primary_pan, u.primary_district, u.department_count,
            ac.status, ac.confidence, ac.last_event_date
          FROM ubids u
          JOIN activity_classifications ac ON u.id = ac.ubid_id
          WHERE ac.status = 'dormant' AND u.department_count >= ?
          ORDER BY u.department_count DESC
          LIMIT 50
        `, [minDepts]);
        description = `Dormant businesses registered in ${minDepts}+ departments`;
        break;
      }

      case 'top_cross_dept': {
        results = queryAll(`
          SELECT u.id, u.primary_name, u.primary_district, u.department_count, u.record_count,
            ac.status, ac.event_count, ac.last_event_date
          FROM ubids u
          LEFT JOIN activity_classifications ac ON u.id = ac.ubid_id
          ORDER BY u.department_count DESC, COALESCE(ac.event_count, 0) DESC
          LIMIT 20
        `);
        description = 'Top businesses by cross-department presence';
        break;
      }

      case 'recent_closures': {
        results = queryAll(`
          SELECT u.id, u.primary_name, u.primary_pan, u.primary_district,
            ac.confidence, ac.last_event_date, ac.evidence_json
          FROM ubids u
          JOIN activity_classifications ac ON u.id = ac.ubid_id
          WHERE ac.status = 'closed'
          ORDER BY ac.classified_at DESC
          LIMIT 50
        `);
        description = 'Recently classified as closed';
        break;
      }

      case 'no_gstin': {
        results = queryAll(`
          SELECT u.id, u.primary_name, u.primary_pan, u.primary_district, u.status,
            ac.event_count
          FROM ubids u
          LEFT JOIN activity_classifications ac ON u.id = ac.ubid_id
          WHERE u.primary_gstin IS NULL AND u.status = 'active'
          ORDER BY u.primary_name
          LIMIT 50
        `);
        description = 'Active businesses without GSTIN';
        break;
      }

      case 'high_event_activity': {
        const threshold = queryParams.min_events || 5;
        results = queryAll(`
          SELECT u.id, u.primary_name, u.primary_district, ac.status,
            ac.event_count, ac.last_event_date
          FROM ubids u
          JOIN activity_classifications ac ON u.id = ac.ubid_id
          WHERE ac.event_count >= ?
          ORDER BY ac.event_count DESC
          LIMIT 50
        `, [threshold]);
        description = `Businesses with ${threshold}+ events`;
        break;
      }

      case 'district_summary': {
        results = queryAll(`
          SELECT u.primary_district as district,
            COUNT(*) as total,
            SUM(CASE WHEN ac.status = 'active' THEN 1 ELSE 0 END) as active,
            SUM(CASE WHEN ac.status = 'dormant' THEN 1 ELSE 0 END) as dormant,
            SUM(CASE WHEN ac.status = 'closed' THEN 1 ELSE 0 END) as closed
          FROM ubids u
          LEFT JOIN activity_classifications ac ON u.id = ac.ubid_id
          WHERE u.primary_district IS NOT NULL
          GROUP BY u.primary_district
          ORDER BY total DESC
        `);
        description = 'Business status breakdown by district';
        break;
      }

      case 'unlinked_events_dept': {
        results = queryAll(`
          SELECT d.name as department, d.code, COUNT(*) as unlinked_count
          FROM unlinked_events ue
          JOIN departments d ON ue.department_id = d.id
          WHERE ue.status = 'unresolved'
          GROUP BY d.id
          ORDER BY unlinked_count DESC
        `);
        description = 'Unresolved events by department';
        break;
      }

      default:
        return res.status(400).json({ success: false, error: 'Unknown query preset' });
    }

    res.json({
      success: true,
      data: {
        query: preset_id,
        description,
        result_count: results.length,
        results,
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
