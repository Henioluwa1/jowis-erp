import { query } from '../config/db.js';
import { automationService } from '../services/automationService.js';
import { recordAuditLog } from '../middleware/audit.js';

/**
 * Automation Controller (Phase 9)
 * Handles automation rule configuration, manual execution triggers,
 * execution history inspection, retries, and operational system alerts.
 */

// ---------------------------------------------------------------------------
// 1. Get All Automation Rules
// ---------------------------------------------------------------------------
export const getRules = async (req, res) => {
  try {
    const rules = await query(`
      SELECT ar.*,
             u.first_name as creator_first, u.last_name as creator_last,
             (
               SELECT status FROM automation_executions 
               WHERE rule_id = ar.id 
               ORDER BY id DESC LIMIT 1
             ) as last_execution_status,
             (
               SELECT COUNT(*) FROM automation_executions 
               WHERE rule_id = ar.id AND status = 'completed'
             ) as total_completed_runs,
             (
               SELECT COUNT(*) FROM automation_executions 
               WHERE rule_id = ar.id AND status = 'failed'
             ) as total_failed_runs
      FROM automation_rules ar
      LEFT JOIN users u ON ar.created_by = u.id
      ORDER BY ar.category ASC, ar.id ASC
    `);

    // Parse config JSON safely
    const formatted = rules.map(r => ({
      ...r,
      config: typeof r.config === 'string' ? JSON.parse(r.config) : (r.config || {})
    }));

    res.json({ success: true, data: formatted });
  } catch (error) {
    console.error('getRules error:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve automation rules.' });
  }
};

// ---------------------------------------------------------------------------
// 2. Get Single Automation Rule
// ---------------------------------------------------------------------------
export const getRuleById = async (req, res) => {
  try {
    const ruleId = parseInt(req.params.id, 10);
    const [rule] = await query(`SELECT * FROM automation_rules WHERE id = ?`, [ruleId]);

    if (!rule) {
      return res.status(404).json({ success: false, message: 'Automation rule not found.' });
    }

    rule.config = typeof rule.config === 'string' ? JSON.parse(rule.config) : (rule.config || {});

    // Recent 10 executions for this rule
    const recentExecutions = await query(`
      SELECT ae.*, u.first_name, u.last_name
      FROM automation_executions ae
      LEFT JOIN users u ON ae.executed_by = u.id
      WHERE ae.rule_id = ?
      ORDER BY ae.id DESC
      LIMIT 10
    `, [ruleId]);

    res.json({
      success: true,
      data: {
        ...rule,
        recentExecutions
      }
    });
  } catch (error) {
    console.error('getRuleById error:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve rule details.' });
  }
};

// ---------------------------------------------------------------------------
// 3. Update Automation Rule Configuration
// ---------------------------------------------------------------------------
export const updateRule = async (req, res) => {
  try {
    const ruleId = parseInt(req.params.id, 10);
    const { name, description, schedule_interval, config, is_enabled } = req.body;

    const [existing] = await query(`SELECT * FROM automation_rules WHERE id = ?`, [ruleId]);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Automation rule not found.' });
    }

    const updatedConfig = config ? (typeof config === 'object' ? JSON.stringify(config) : config) : existing.config;
    const updatedEnabled = is_enabled !== undefined ? (is_enabled ? 1 : 0) : existing.is_enabled;
    const updatedInterval = schedule_interval || existing.schedule_interval;
    const updatedName = name || existing.name;
    const updatedDesc = description !== undefined ? description : existing.description;

    await query(`
      UPDATE automation_rules
      SET name = ?, description = ?, schedule_interval = ?, config = ?, is_enabled = ?
      WHERE id = ?
    `, [updatedName, updatedDesc, updatedInterval, updatedConfig, updatedEnabled, ruleId]);

    await recordAuditLog(
      req.user.id,
      'UPDATE_AUTOMATION_RULE',
      'automation_rules',
      ruleId,
      { is_enabled: existing.is_enabled, schedule_interval: existing.schedule_interval },
      { is_enabled: updatedEnabled, schedule_interval: updatedInterval },
      req
    );

    res.json({
      success: true,
      message: `Automation rule '${existing.rule_code}' successfully updated.`
    });
  } catch (error) {
    console.error('updateRule error:', error);
    res.status(500).json({ success: false, message: 'Failed to update automation rule.' });
  }
};

// ---------------------------------------------------------------------------
// 4. Toggle Automation Rule Status (Enable/Disable)
// ---------------------------------------------------------------------------
export const toggleRuleStatus = async (req, res) => {
  try {
    const ruleId = parseInt(req.params.id, 10);
    const [rule] = await query(`SELECT id, rule_code, is_enabled FROM automation_rules WHERE id = ?`, [ruleId]);

    if (!rule) {
      return res.status(404).json({ success: false, message: 'Automation rule not found.' });
    }

    const newStatus = rule.is_enabled ? 0 : 1;
    await query(`UPDATE automation_rules SET is_enabled = ? WHERE id = ?`, [newStatus, ruleId]);

    await recordAuditLog(
      req.user.id,
      newStatus ? 'ENABLE_AUTOMATION_RULE' : 'DISABLE_AUTOMATION_RULE',
      'automation_rules',
      ruleId,
      { is_enabled: rule.is_enabled },
      { is_enabled: newStatus },
      req
    );

    res.json({
      success: true,
      message: `Automation rule '${rule.rule_code}' is now ${newStatus ? 'ENABLED' : 'DISABLED'}.`,
      data: { id: ruleId, is_enabled: newStatus }
    });
  } catch (error) {
    console.error('toggleRuleStatus error:', error);
    res.status(500).json({ success: false, message: 'Failed to toggle rule state.' });
  }
};

// ---------------------------------------------------------------------------
// 5. Trigger Automation Rule Manually ("Run Now")
// ---------------------------------------------------------------------------
export const triggerRuleManual = async (req, res) => {
  try {
    const ruleCode = req.params.code;
    const { force = false, targetDate = null } = req.body || {};

    const result = await automationService.executeRule(ruleCode, {
      triggerType: 'manual',
      executedBy: req.user.id,
      targetDate,
      force,
      req
    });

    res.json({
      success: result.success,
      message: result.status === 'skipped'
        ? (result.message || 'Execution skipped by idempotency protection.')
        : `Automation '${ruleCode}' execution ${result.status}. ${result.affectedCount || 0} record(s) processed.`,
      data: result
    });
  } catch (error) {
    console.error(`triggerRuleManual [${req.params.code}] error:`, error);
    res.status(500).json({ success: false, message: error.message || 'Failed to trigger automation rule.' });
  }
};

// ---------------------------------------------------------------------------
// 6. Get Automation Execution History (Paginated & Filterable)
// ---------------------------------------------------------------------------
export const getExecutions = async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 15;
    const offset = (page - 1) * limit;

    const { ruleCode, status, dateFrom, dateTo } = req.query;

    let whereClause = 'WHERE 1=1';
    const params = [];

    if (ruleCode && ruleCode !== 'all') {
      whereClause += ' AND ae.rule_code = ?';
      params.push(ruleCode);
    }

    if (status && status !== 'all') {
      whereClause += ' AND ae.status = ?';
      params.push(status);
    }

    if (dateFrom) {
      whereClause += ' AND ae.start_time >= ?';
      params.push(`${dateFrom} 00:00:00`);
    }

    if (dateTo) {
      whereClause += ' AND ae.start_time <= ?';
      params.push(`${dateTo} 23:59:59`);
    }

    const [countRow] = await query(`
      SELECT COUNT(*) as total 
      FROM automation_executions ae 
      ${whereClause}
    `, params);
    const total = countRow?.total || 0;

    const executions = await query(`
      SELECT ae.*, ar.name as rule_name, ar.category as rule_category,
             u.first_name as executor_first, u.last_name as executor_last
      FROM automation_executions ae
      JOIN automation_rules ar ON ae.rule_id = ar.id
      LEFT JOIN users u ON ae.executed_by = u.id
      ${whereClause}
      ORDER BY ae.id DESC
      LIMIT ? OFFSET ?
    `, [...params, limit, offset]);

    // Format details JSON
    const formatted = executions.map(e => ({
      ...e,
      details: typeof e.details === 'string' ? JSON.parse(e.details) : (e.details || {})
    }));

    res.json({
      success: true,
      data: formatted,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('getExecutions error:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve execution records.' });
  }
};

// ---------------------------------------------------------------------------
// 7. Get Single Execution Details
// ---------------------------------------------------------------------------
export const getExecutionById = async (req, res) => {
  try {
    const executionId = parseInt(req.params.id, 10);
    const [exec] = await query(`
      SELECT ae.*, ar.name as rule_name, ar.category as rule_category,
             u.first_name as executor_first, u.last_name as executor_last
      FROM automation_executions ae
      JOIN automation_rules ar ON ae.rule_id = ar.id
      LEFT JOIN users u ON ae.executed_by = u.id
      WHERE ae.id = ?
    `, [executionId]);

    if (!exec) {
      return res.status(404).json({ success: false, message: 'Execution record not found.' });
    }

    exec.details = typeof exec.details === 'string' ? JSON.parse(exec.details) : (exec.details || {});

    res.json({ success: true, data: exec });
  } catch (error) {
    console.error('getExecutionById error:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve execution details.' });
  }
};

// ---------------------------------------------------------------------------
// 8. Retry Failed Execution (Gate 16)
// ---------------------------------------------------------------------------
export const retryExecution = async (req, res) => {
  try {
    const executionId = parseInt(req.params.id, 10);
    const result = await automationService.retryExecution(executionId, req.user.id, req);

    res.json({
      success: result.success,
      message: `Execution #${executionId} retry completed with status '${result.status}'.`,
      data: result
    });
  } catch (error) {
    console.error('retryExecution error:', error);
    res.status(400).json({ success: false, message: error.message || 'Failed to retry execution.' });
  }
};

// ---------------------------------------------------------------------------
// 9. Get Operational System Alerts (Gate 14)
// ---------------------------------------------------------------------------
export const getSystemAlerts = async (req, res) => {
  try {
    const userRole = req.user.role;
    const userId = req.user.id;

    const alerts = await automationService.getOperationalAlerts(userRole, userId);
    res.json({ success: true, data: alerts });
  } catch (error) {
    console.error('getSystemAlerts error:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve system alerts.' });
  }
};
