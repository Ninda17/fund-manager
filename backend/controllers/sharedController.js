const ExcelJS = require('exceljs');
const Project = require('../models/projectModel');
const { decrypt } = require('../utils/encryption');

/**
 * Download Project Report
 * Generates an Excel file with all project details including activities and subactivities
 */
const downloadProjectReport = async (req, res) => {
  try {
    const { projectId } = req.params;

    // Validate projectId format
    if (!projectId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid project ID format',
      });
    }

    // Get project with populated fields
    const project = await Project.findById(projectId)
      .populate('programPersonnel', 'name email')
      .populate('financePersonnel', 'name email')
      .lean();

    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found',
      });
    }

    // Decrypt all encrypted fields
    const decrypted = { ...project };

    // Decrypt project fields
    if (decrypted.donorName && typeof decrypted.donorName === 'string' && decrypted.donorName.includes(':')) {
      decrypted.donorName = decrypt(decrypted.donorName);
    }
    if (decrypted.description && typeof decrypted.description === 'string' && decrypted.description !== '' && decrypted.description.includes(':')) {
      decrypted.description = decrypt(decrypted.description);
    }
    if (decrypted.amountDonated && typeof decrypted.amountDonated === 'string' && decrypted.amountDonated.includes(':')) {
      decrypted.amountDonated = parseFloat(decrypt(decrypted.amountDonated)) || 0;
    }
    if (decrypted.startDate && typeof decrypted.startDate === 'string' && decrypted.startDate.includes(':')) {
      decrypted.startDate = new Date(decrypt(decrypted.startDate));
    }
    if (decrypted.endDate && typeof decrypted.endDate === 'string' && decrypted.endDate.includes(':')) {
      decrypted.endDate = new Date(decrypt(decrypted.endDate));
    }
    if (decrypted.currency && typeof decrypted.currency === 'string' && decrypted.currency.includes(':')) {
      decrypted.currency = decrypt(decrypted.currency);
    }
    if (decrypted.projectType && typeof decrypted.projectType === 'string' && decrypted.projectType.includes(':')) {
      decrypted.projectType = decrypt(decrypted.projectType);
    }
    if (decrypted.totalExpense && typeof decrypted.totalExpense === 'string' && decrypted.totalExpense.includes(':')) {
      decrypted.totalExpense = parseFloat(decrypt(decrypted.totalExpense)) || 0;
    }

    // Decrypt activities and subactivities
    if (decrypted.activities && Array.isArray(decrypted.activities)) {
      decrypted.activities = decrypted.activities.map(activity => {
        const decryptedActivity = { ...activity };
        
        if (decryptedActivity.name && typeof decryptedActivity.name === 'string' && decryptedActivity.name.includes(':')) {
          decryptedActivity.name = decrypt(decryptedActivity.name);
        }
        if (decryptedActivity.description && typeof decryptedActivity.description === 'string' && decryptedActivity.description !== '' && decryptedActivity.description.includes(':')) {
          decryptedActivity.description = decrypt(decryptedActivity.description);
        }
        if (decryptedActivity.budget && typeof decryptedActivity.budget === 'string' && decryptedActivity.budget.includes(':')) {
          decryptedActivity.budget = parseFloat(decrypt(decryptedActivity.budget)) || 0;
        }
        if (decryptedActivity.expense && typeof decryptedActivity.expense === 'string' && decryptedActivity.expense.includes(':')) {
          decryptedActivity.expense = parseFloat(decrypt(decryptedActivity.expense)) || 0;
        }
        
        // Decrypt subActivities
        if (decryptedActivity.subActivities && Array.isArray(decryptedActivity.subActivities)) {
          decryptedActivity.subActivities = decryptedActivity.subActivities.map(subActivity => {
            const decryptedSubActivity = { ...subActivity };
            
            if (decryptedSubActivity.name && typeof decryptedSubActivity.name === 'string' && decryptedSubActivity.name.includes(':')) {
              decryptedSubActivity.name = decrypt(decryptedSubActivity.name);
            }
            if (decryptedSubActivity.budget && typeof decryptedSubActivity.budget === 'string' && decryptedSubActivity.budget.includes(':')) {
              decryptedSubActivity.budget = parseFloat(decrypt(decryptedSubActivity.budget)) || 0;
            }
            if (decryptedSubActivity.expense && typeof decryptedSubActivity.expense === 'string' && decryptedSubActivity.expense.includes(':')) {
              decryptedSubActivity.expense = parseFloat(decrypt(decryptedSubActivity.expense)) || 0;
            }
            
            return decryptedSubActivity;
          });
        }
        
        return decryptedActivity;
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

    // Validate projectId format
    if (!projectId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid project ID format',
      });
    }

    // Get project
    const project = await Project.findById(projectId)
      .populate('programPersonnel', 'name email')
      .populate('financePersonnel', 'name email')
      .lean();

    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found',
      });
    }

    // Decrypt project currency
    let projectCurrency = project.currency;
    if (projectCurrency && typeof projectCurrency === 'string' && projectCurrency.includes(':')) {
      projectCurrency = decrypt(projectCurrency);
    }

    // Find activity
    let activity = null;
    if (project.activities && Array.isArray(project.activities)) {
      activity = project.activities.find(
        (act) => act._id?.toString() === activityId || act.activityId === activityId
      );
    }

    if (!activity) {
      return res.status(404).json({
        success: false,
        message: 'Activity not found',
      });
    }

    // Decrypt activity fields
    const decryptedActivity = { ...activity };
    
    if (decryptedActivity.name && typeof decryptedActivity.name === 'string' && decryptedActivity.name.includes(':')) {
      decryptedActivity.name = decrypt(decryptedActivity.name);
    }
    if (decryptedActivity.description && typeof decryptedActivity.description === 'string' && decryptedActivity.description !== '' && decryptedActivity.description.includes(':')) {
      decryptedActivity.description = decrypt(decryptedActivity.description);
    }
    if (decryptedActivity.budget && typeof decryptedActivity.budget === 'string' && decryptedActivity.budget.includes(':')) {
      decryptedActivity.budget = parseFloat(decrypt(decryptedActivity.budget)) || 0;
    }
    if (decryptedActivity.expense && typeof decryptedActivity.expense === 'string' && decryptedActivity.expense.includes(':')) {
      decryptedActivity.expense = parseFloat(decrypt(decryptedActivity.expense)) || 0;
    }

    // Decrypt subActivities
    if (decryptedActivity.subActivities && Array.isArray(decryptedActivity.subActivities)) {
      decryptedActivity.subActivities = decryptedActivity.subActivities.map(subActivity => {
        const decryptedSubActivity = { ...subActivity };
        
        if (decryptedSubActivity.name && typeof decryptedSubActivity.name === 'string' && decryptedSubActivity.name.includes(':')) {
          decryptedSubActivity.name = decrypt(decryptedSubActivity.name);
        }
        if (decryptedSubActivity.budget && typeof decryptedSubActivity.budget === 'string' && decryptedSubActivity.budget.includes(':')) {
          decryptedSubActivity.budget = parseFloat(decrypt(decryptedSubActivity.budget)) || 0;
        }
        if (decryptedSubActivity.expense && typeof decryptedSubActivity.expense === 'string' && decryptedSubActivity.expense.includes(':')) {
          decryptedSubActivity.expense = parseFloat(decrypt(decryptedSubActivity.expense)) || 0;
        }
        
        return decryptedSubActivity;
      });
    }

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
      ['  Project ID', project.projectId || 'N/A'],
      ['  Project Title', project.title || 'N/A'],
      ['  Currency', projectCurrency || 'N/A'],
      ['', ''],
      ['Budget', `${projectCurrency || ''} ${(decryptedActivity.budget || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`],
      ['Expense', `${projectCurrency || ''} ${(decryptedActivity.expense || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`],
      ['Utilization', `${utilization.toFixed(2)}%`],
      ['Remaining Budget', `${projectCurrency || ''} ${Math.max((decryptedActivity.budget || 0) - (decryptedActivity.expense || 0), 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`],
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
          `${projectCurrency || ''} ${(subActivity.budget || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
          `${projectCurrency || ''} ${(subActivity.expense || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
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

    // Validate IDs
    if (!projectId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid project ID format',
      });
    }

    // Get project
    const project = await Project.findById(projectId)
      .populate('programPersonnel', 'name email')
      .populate('financePersonnel', 'name email')
      .lean();

    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found',
      });
    }

    // Decrypt project currency
    let projectCurrency = project.currency;
    if (projectCurrency && typeof projectCurrency === 'string' && projectCurrency.includes(':')) {
      projectCurrency = decrypt(projectCurrency);
    }

    // Find activity
    let activity = null;
    if (project.activities && Array.isArray(project.activities)) {
      activity = project.activities.find(
        (act) => act._id?.toString() === activityId || act.activityId === activityId
      );
    }

    if (!activity) {
      return res.status(404).json({
        success: false,
        message: 'Activity not found',
      });
    }

    // Decrypt activity name for context
    let activityName = activity.name;
    if (activityName && typeof activityName === 'string' && activityName.includes(':')) {
      activityName = decrypt(activityName);
    }

    // Find subactivity
    let subactivity = null;
    if (activity.subActivities && Array.isArray(activity.subActivities)) {
      subactivity = activity.subActivities.find(
        (subAct) => subAct._id?.toString() === subactivityId || subAct.subactivityId === subactivityId
      );
    }

    if (!subactivity) {
      return res.status(404).json({
        success: false,
        message: 'Subactivity not found',
      });
    }

    // Decrypt subactivity fields
    const decryptedSubactivity = { ...subactivity };
    
    if (decryptedSubactivity.name && typeof decryptedSubactivity.name === 'string' && decryptedSubactivity.name.includes(':')) {
      decryptedSubactivity.name = decrypt(decryptedSubactivity.name);
    }
    if (decryptedSubactivity.budget && typeof decryptedSubactivity.budget === 'string' && decryptedSubactivity.budget.includes(':')) {
      decryptedSubactivity.budget = parseFloat(decrypt(decryptedSubactivity.budget)) || 0;
    }
    if (decryptedSubactivity.expense && typeof decryptedSubactivity.expense === 'string' && decryptedSubactivity.expense.includes(':')) {
      decryptedSubactivity.expense = parseFloat(decrypt(decryptedSubactivity.expense)) || 0;
    }

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
      ['  Project ID', project.projectId || 'N/A'],
      ['  Project Title', project.title || 'N/A'],
      ['  Currency', projectCurrency || 'N/A'],
      ['', ''],
      ['Activity Information', ''],
      ['  Activity ID', activity.activityId || 'N/A'],
      ['  Activity Name', activityName || 'N/A'],
      ['', ''],
      ['Budget', `${projectCurrency || ''} ${(decryptedSubactivity.budget || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`],
      ['Expense', `${projectCurrency || ''} ${(decryptedSubactivity.expense || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`],
      ['Utilization', `${utilization.toFixed(2)}%`],
      ['Remaining Budget', `${projectCurrency || ''} ${Math.max((decryptedSubactivity.budget || 0) - (decryptedSubactivity.expense || 0), 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`],
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

