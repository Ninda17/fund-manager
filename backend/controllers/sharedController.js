const ExcelJS = require('exceljs');
const { Project, Activity, SubActivity, User } = require('../models');
const { decrypt } = require('../utils/encryption');

// Helper function to decrypt nested activities and subactivities
const decryptActivityData = (activity) => {
  if (!activity) return activity;
  
  const decryptField = (encryptedValue, returnType = 'string') => {
    if (!encryptedValue || typeof encryptedValue !== 'string') {
      return encryptedValue;
    }
    
    // Check if encrypted (contains ':')
    if (!encryptedValue.includes(':')) {
      return encryptedValue;
    }
    
    try {
      const decrypted = decrypt(encryptedValue);
      
      if (returnType === 'number') {
        return parseFloat(decrypted) || 0;
      }
      
      return decrypted;
    } catch (error) {
      console.error('Decryption error:', error);
      return encryptedValue; // Return as-is if decryption fails
    }
  };
  
  // Decrypt activity fields
  if (activity.name !== null && activity.name !== undefined) {
    activity.name = decryptField(activity.name);
  }
  if (activity.description !== null && activity.description !== undefined) {
    activity.description = decryptField(activity.description);
  }
  if (activity.budget !== null && activity.budget !== undefined) {
    activity.budget = decryptField(activity.budget, 'number');
  }
  if (activity.expense !== null && activity.expense !== undefined) {
    activity.expense = decryptField(activity.expense, 'number');
  }
  
  // Decrypt subactivities if present
  if (activity.subActivities && Array.isArray(activity.subActivities)) {
    activity.subActivities.forEach(subActivity => {
      if (subActivity.name !== null && subActivity.name !== undefined) {
        subActivity.name = decryptField(subActivity.name);
      }
      if (subActivity.budget !== null && subActivity.budget !== undefined) {
        subActivity.budget = decryptField(subActivity.budget, 'number');
      }
      if (subActivity.expense !== null && subActivity.expense !== undefined) {
        subActivity.expense = decryptField(subActivity.expense, 'number');
      }
    });
  }
  
  return activity;
};

/**
 * Download Project Report
 * Generates an Excel file with all project details including activities and subactivities
 */
const downloadProjectReport = async (req, res) => {
  try {
    const { projectId } = req.params;

    // Validate projectId format - can be integer ID or projectId string
    let project = null;
    
    // Try to find by integer ID first
    const projectIdInt = parseInt(projectId);
    if (!isNaN(projectIdInt) && projectIdInt > 0) {
      project = await Project.findByPk(projectIdInt, {
        include: [
          {
            model: User,
            as: 'programPersonnel',
            attributes: ['name', 'email'],
          },
          {
            model: User,
            as: 'financePersonnel',
            attributes: ['name', 'email'],
          },
          {
            model: Activity,
            as: 'activities',
            include: [
              {
                model: SubActivity,
                as: 'subActivities',
              },
            ],
          },
        ],
      });
    }

    // If not found by integer ID, try to find by projectId string
    if (!project) {
      project = await Project.findOne({
        where: { projectId: projectId },
        include: [
          {
            model: User,
            as: 'programPersonnel',
            attributes: ['name', 'email'],
          },
          {
            model: User,
            as: 'financePersonnel',
            attributes: ['name', 'email'],
          },
          {
            model: Activity,
            as: 'activities',
            include: [
              {
                model: SubActivity,
                as: 'subActivities',
              },
            ],
          },
        ],
      });
    }

    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found',
      });
    }

    // Convert to plain object (fields are already decrypted by model hooks)
    const decrypted = project.toJSON();

    // Manually decrypt nested activities and subactivities (hooks may not run for nested includes)
    if (decrypted.activities && Array.isArray(decrypted.activities)) {
      decrypted.activities.forEach(activity => {
        decryptActivityData(activity);
      });
    }

    // Calculate utilization percentage
    const utilization = decrypted.amountDonated > 0 
      ? Math.min((decrypted.totalExpense / decrypted.amountDonated) * 100, 100) 
      : 0;

    // Create workbook
    const workbook = new ExcelJS.Workbook();
    
    // ========== Sheet 1: Project Summary ==========
    const projectSheet = workbook.addWorksheet('Project Summary');
    
    // Set column widths
    projectSheet.columns = [
      { width: 25 },
      { width: 50 }
    ];

    // Add project details
    const projectRows = [
      ['Project ID', decrypted.projectId || 'N/A'],
      ['Title', decrypted.title || 'N/A'],
      ['Description', decrypted.description || 'N/A'],
      ['Start Date', decrypted.startDate ? new Date(decrypted.startDate).toLocaleDateString() : 'N/A'],
      ['End Date', decrypted.endDate ? new Date(decrypted.endDate).toLocaleDateString() : 'N/A'],
      ['Project Type', decrypted.projectType || 'N/A'],
      ['Project Status', decrypted.projectStatus || 'N/A'],
      ['', ''],
      ['Program Personnel', ''],
      ['  Name', decrypted.programPersonnel?.name || 'N/A'],
      ['  Email', decrypted.programPersonnel?.email || 'N/A'],
      ['', ''],
      ['Finance Personnel', ''],
      ['  Name', decrypted.financePersonnel?.name || 'N/A'],
      ['  Email', decrypted.financePersonnel?.email || 'N/A'],
      ['', ''],
      ['Donor Name', decrypted.donorName || 'N/A'],
      ['Amount Donated', `${decrypted.currency || ''} ${decrypted.amountDonated?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}`],
      ['Total Expense', `${decrypted.currency || ''} ${decrypted.totalExpense?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}`],
      ['Utilization', `${utilization.toFixed(2)}%`],
      ['Remaining Budget', `${decrypted.currency || ''} ${Math.max((decrypted.amountDonated || 0) - (decrypted.totalExpense || 0), 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`],
      ['Currency', decrypted.currency || 'N/A'],
    ];

    projectSheet.addRows(projectRows);

    // Style header row
    projectSheet.getRow(1).font = { bold: true };
    projectSheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' }
    };

    // ========== Sheet 2: Activities ==========
    const activitiesSheet = workbook.addWorksheet('Activities');
    
    activitiesSheet.columns = [
      { width: 15 }, // Activity ID
      { width: 30 }, // Name
      { width: 40 }, // Description
      { width: 18 }, // Budget
      { width: 18 }, // Expense
      { width: 15 }, // Utilization
      { width: 15 }, // Status
      { width: 15 }, // Subactivities Count
    ];

    // Add headers
    activitiesSheet.addRow([
      'Activity ID',
      'Name',
      'Description',
      'Budget',
      'Expense',
      'Utilization %',
      'Status',
      'Subactivities'
    ]);

    // Style header row
    const headerRow = activitiesSheet.getRow(1);
    headerRow.font = { bold: true };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' }
    };

    // Add activity data
    if (decrypted.activities && Array.isArray(decrypted.activities)) {
      decrypted.activities.forEach(activity => {
        const activityUtilization = activity.budget > 0 
          ? Math.min((activity.expense / activity.budget) * 100, 100) 
          : 0;
        
        activitiesSheet.addRow([
          activity.activityId || 'N/A',
          activity.name || 'N/A',
          activity.description || 'N/A',
          `${decrypted.currency || ''} ${(activity.budget || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
          `${decrypted.currency || ''} ${(activity.expense || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
          `${activityUtilization.toFixed(2)}%`,
          activity.projectStatus || 'N/A',
          activity.subActivities?.length || 0
        ]);
      });
    }

    // ========== Sheet 3: Subactivities ==========
    const subactivitiesSheet = workbook.addWorksheet('Subactivities');
    
    subactivitiesSheet.columns = [
      { width: 15 }, // Subactivity ID
      { width: 30 }, // Name
      { width: 20 }, // Activity ID
      { width: 30 }, // Activity Name
      { width: 18 }, // Budget
      { width: 18 }, // Expense
      { width: 15 }, // Utilization
    ];

    // Add headers
    subactivitiesSheet.addRow([
      'Subactivity ID',
      'Name',
      'Activity ID',
      'Activity Name',
      'Budget',
      'Expense',
      'Utilization %'
    ]);

    // Style header row
    const subHeaderRow = subactivitiesSheet.getRow(1);
    subHeaderRow.font = { bold: true };
    subHeaderRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' }
    };

    // Add subactivity data
    if (decrypted.activities && Array.isArray(decrypted.activities)) {
      decrypted.activities.forEach(activity => {
        if (activity.subActivities && Array.isArray(activity.subActivities)) {
          activity.subActivities.forEach(subActivity => {
            const subUtilization = subActivity.budget > 0 
              ? Math.min((subActivity.expense / subActivity.budget) * 100, 100) 
              : 0;
            
            subactivitiesSheet.addRow([
              subActivity.subactivityId || 'N/A',
              subActivity.name || 'N/A',
              activity.activityId || 'N/A',
              activity.name || 'N/A',
              `${decrypted.currency || ''} ${(subActivity.budget || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
              `${decrypted.currency || ''} ${(subActivity.expense || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
              `${subUtilization.toFixed(2)}%`
            ]);
          });
        }
      });
    }

    // Set response headers
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=project_${decrypted.projectId}_${Date.now()}.xlsx`);

    // Write workbook to response
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('Download project report error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error. Please try again later.',
    });
  }
};

/**
 * Download Activity Report
 * Generates an Excel file with activity details and all subactivities
 */
const downloadActivityReport = async (req, res) => {
  try {
    const { projectId, activityId } = req.params;

    // Find project - can be by integer ID or projectId string
    let project = null;
    
    const projectIdInt = parseInt(projectId);
    if (!isNaN(projectIdInt) && projectIdInt > 0) {
      project = await Project.findByPk(projectIdInt, {
        include: [
          {
            model: User,
            as: 'programPersonnel',
            attributes: ['name', 'email'],
          },
          {
            model: User,
            as: 'financePersonnel',
            attributes: ['name', 'email'],
          },
          {
            model: Activity,
            as: 'activities',
            include: [
              {
                model: SubActivity,
                as: 'subActivities',
              },
            ],
          },
        ],
      });
    }

    if (!project) {
      project = await Project.findOne({
        where: { projectId: projectId },
        include: [
          {
            model: User,
            as: 'programPersonnel',
            attributes: ['name', 'email'],
          },
          {
            model: User,
            as: 'financePersonnel',
            attributes: ['name', 'email'],
          },
          {
            model: Activity,
            as: 'activities',
            include: [
              {
                model: SubActivity,
                as: 'subActivities',
              },
            ],
          },
        ],
      });
    }

    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found',
      });
    }

    const projectData = project.toJSON();

    // Manually decrypt nested activities and subactivities
    if (projectData.activities && Array.isArray(projectData.activities)) {
      projectData.activities.forEach(activity => {
        decryptActivityData(activity);
      });
    }

    // Find activity - can be by integer ID or activityId string
    let activity = null;
    if (projectData.activities && Array.isArray(projectData.activities)) {
      const activityIdInt = parseInt(activityId);
      if (!isNaN(activityIdInt) && activityIdInt > 0) {
        activity = projectData.activities.find(
          (act) => act.id === activityIdInt || act.activityId === activityId
        );
      } else {
        activity = projectData.activities.find(
          (act) => act.activityId === activityId
      );
      }
    }

    if (!activity) {
      return res.status(404).json({
        success: false,
        message: 'Activity not found',
      });
    }

    // Activity is already decrypted by decryptActivityData above
    const decryptedActivity = activity;

    // Calculate utilization
    const utilization = decryptedActivity.budget > 0 
      ? Math.min((decryptedActivity.expense / decryptedActivity.budget) * 100, 100) 
      : 0;

    // Create workbook
    const workbook = new ExcelJS.Workbook();
    
    // ========== Sheet 1: Activity Summary ==========
    const activitySheet = workbook.addWorksheet('Activity Summary');
    
    activitySheet.columns = [
      { width: 25 },
      { width: 50 }
    ];

    const activityRows = [
      ['Activity ID', decryptedActivity.activityId || 'N/A'],
      ['Name', decryptedActivity.name || 'N/A'],
      ['Description', decryptedActivity.description || 'N/A'],
      ['Status', decryptedActivity.projectStatus || 'N/A'],
      ['', ''],
      ['Project Information', ''],
      ['  Project ID', projectData.projectId || 'N/A'],
      ['  Project Title', projectData.title || 'N/A'],
      ['  Currency', projectData.currency || 'N/A'],
      ['', ''],
      ['Budget', `${projectData.currency || ''} ${(decryptedActivity.budget || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`],
      ['Expense', `${projectData.currency || ''} ${(decryptedActivity.expense || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`],
      ['Utilization', `${utilization.toFixed(2)}%`],
      ['Remaining Budget', `${projectData.currency || ''} ${Math.max((decryptedActivity.budget || 0) - (decryptedActivity.expense || 0), 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`],
      ['Subactivities Count', decryptedActivity.subActivities?.length || 0],
    ];

    activitySheet.addRows(activityRows);

    // Style header row
    activitySheet.getRow(1).font = { bold: true };
    activitySheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' }
    };

    // ========== Sheet 2: Subactivities ==========
    const subactivitiesSheet = workbook.addWorksheet('Subactivities');
    
    subactivitiesSheet.columns = [
      { width: 15 }, // Subactivity ID
      { width: 30 }, // Name
      { width: 18 }, // Budget
      { width: 18 }, // Expense
      { width: 15 }, // Utilization
    ];

    // Add headers
    subactivitiesSheet.addRow([
      'Subactivity ID',
      'Name',
      'Budget',
      'Expense',
      'Utilization %'
    ]);

    // Style header row
    const headerRow = subactivitiesSheet.getRow(1);
    headerRow.font = { bold: true };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' }
    };

    // Add subactivity data
    if (decryptedActivity.subActivities && Array.isArray(decryptedActivity.subActivities)) {
      decryptedActivity.subActivities.forEach(subActivity => {
        const subUtilization = subActivity.budget > 0 
          ? Math.min((subActivity.expense / subActivity.budget) * 100, 100) 
          : 0;
        
        subactivitiesSheet.addRow([
          subActivity.subactivityId || 'N/A',
          subActivity.name || 'N/A',
          `${projectData.currency || ''} ${(subActivity.budget || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
          `${projectData.currency || ''} ${(subActivity.expense || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
          `${subUtilization.toFixed(2)}%`
        ]);
      });
    }

    // Set response headers
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=activity_${decryptedActivity.activityId}_${Date.now()}.xlsx`);

    // Write workbook to response
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('Download activity report error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error. Please try again later.',
    });
  }
};

/**
 * Download Subactivity Report
 * Generates an Excel file with subactivity details
 */
const downloadSubactivityReport = async (req, res) => {
  try {
    const { projectId, activityId, subactivityId } = req.params;

    // Find project - can be by integer ID or projectId string
    let project = null;
    
    const projectIdInt = parseInt(projectId);
    if (!isNaN(projectIdInt) && projectIdInt > 0) {
      project = await Project.findByPk(projectIdInt, {
        include: [
          {
            model: User,
            as: 'programPersonnel',
            attributes: ['name', 'email'],
          },
          {
            model: User,
            as: 'financePersonnel',
            attributes: ['name', 'email'],
          },
          {
            model: Activity,
            as: 'activities',
            include: [
              {
                model: SubActivity,
                as: 'subActivities',
              },
            ],
          },
        ],
      });
    }

    if (!project) {
      project = await Project.findOne({
        where: { projectId: projectId },
        include: [
          {
            model: User,
            as: 'programPersonnel',
            attributes: ['name', 'email'],
          },
          {
            model: User,
            as: 'financePersonnel',
            attributes: ['name', 'email'],
          },
          {
            model: Activity,
            as: 'activities',
            include: [
              {
                model: SubActivity,
                as: 'subActivities',
              },
            ],
          },
        ],
      });
    }

    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found',
      });
    }

    const projectData = project.toJSON();

    // Manually decrypt nested activities and subactivities
    if (projectData.activities && Array.isArray(projectData.activities)) {
      projectData.activities.forEach(activity => {
        decryptActivityData(activity);
      });
    }

    // Find activity - can be by integer ID or activityId string
    let activity = null;
    if (projectData.activities && Array.isArray(projectData.activities)) {
      const activityIdInt = parseInt(activityId);
      if (!isNaN(activityIdInt) && activityIdInt > 0) {
        activity = projectData.activities.find(
          (act) => act.id === activityIdInt || act.activityId === activityId
        );
      } else {
        activity = projectData.activities.find(
          (act) => act.activityId === activityId
      );
      }
    }

    if (!activity) {
      return res.status(404).json({
        success: false,
        message: 'Activity not found',
      });
    }

    // Activity is already decrypted by decryptActivityData above
    const activityName = activity.name;

    // Find subactivity - can be by integer ID or subactivityId string
    let subactivity = null;
    if (activity.subActivities && Array.isArray(activity.subActivities)) {
      const subactivityIdInt = parseInt(subactivityId);
      if (!isNaN(subactivityIdInt) && subactivityIdInt > 0) {
        subactivity = activity.subActivities.find(
          (subAct) => subAct.id === subactivityIdInt || subAct.subactivityId === subactivityId
        );
      } else {
      subactivity = activity.subActivities.find(
          (subAct) => subAct.subactivityId === subactivityId
      );
      }
    }

    if (!subactivity) {
      return res.status(404).json({
        success: false,
        message: 'Subactivity not found',
      });
    }

    // Subactivity is already decrypted by decryptActivityData above
    const decryptedSubactivity = subactivity;

    // Calculate utilization
    const utilization = decryptedSubactivity.budget > 0 
      ? Math.min((decryptedSubactivity.expense / decryptedSubactivity.budget) * 100, 100) 
      : 0;

    // Create workbook
    const workbook = new ExcelJS.Workbook();
    
    // ========== Sheet 1: Subactivity Details ==========
    const subactivitySheet = workbook.addWorksheet('Subactivity Details');
    
    subactivitySheet.columns = [
      { width: 25 },
      { width: 50 }
    ];

    const subactivityRows = [
      ['Subactivity ID', decryptedSubactivity.subactivityId || 'N/A'],
      ['Name', decryptedSubactivity.name || 'N/A'],
      ['', ''],
      ['Project Information', ''],
      ['  Project ID', projectData.projectId || 'N/A'],
      ['  Project Title', projectData.title || 'N/A'],
      ['  Currency', projectData.currency || 'N/A'],
      ['', ''],
      ['Activity Information', ''],
      ['  Activity ID', activity.activityId || 'N/A'],
      ['  Activity Name', activityName || 'N/A'],
      ['', ''],
      ['Budget', `${projectData.currency || ''} ${(decryptedSubactivity.budget || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`],
      ['Expense', `${projectData.currency || ''} ${(decryptedSubactivity.expense || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`],
      ['Utilization', `${utilization.toFixed(2)}%`],
      ['Remaining Budget', `${projectData.currency || ''} ${Math.max((decryptedSubactivity.budget || 0) - (decryptedSubactivity.expense || 0), 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`],
    ];

    subactivitySheet.addRows(subactivityRows);

    // Style header row
    subactivitySheet.getRow(1).font = { bold: true };
    subactivitySheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' }
    };

    // Set response headers
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=subactivity_${decryptedSubactivity.subactivityId}_${Date.now()}.xlsx`);

    // Write workbook to response
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('Download subactivity report error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error. Please try again later.',
    });
  }
};

module.exports = {
  downloadProjectReport,
  downloadActivityReport,
  downloadSubactivityReport,
};
