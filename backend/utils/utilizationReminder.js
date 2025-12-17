const { sendUtilizationWarningEmail, sendUtilizationExceededEmail } = require("./emailService");
const User = require("../models/userModel");

// Track notifications to avoid spam (in-memory cache)
// In production, consider using Redis or database
const notificationCache = new Map();
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

// Generate cache key
const getCacheKey = (itemType, itemId, threshold) => {
  return `${itemType}_${itemId}_${threshold}`;
};

// Check if notification was sent recently
const wasNotifiedRecently = (itemType, itemId, threshold) => {
  const key = getCacheKey(itemType, itemId, threshold);
  const cached = notificationCache.get(key);
  if (!cached) return false;
  
  // Check if cache expired
  if (Date.now() - cached.timestamp > CACHE_DURATION) {
    notificationCache.delete(key);
    return false;
  }
  
  return true;
};

// Mark notification as sent
const markAsNotified = (itemType, itemId, threshold) => {
  const key = getCacheKey(itemType, itemId, threshold);
  notificationCache.set(key, { timestamp: Date.now() });
};

// Calculate utilization percentage
const calculateUtilization = (expense, budget) => {
  if (!budget || budget === 0) return 0;
  return (expense / budget) * 100;
};

// Decrypt numeric value
const decryptNumeric = (value, decryptFn) => {
  if (!value) return 0;
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && value.includes(':')) {
    return parseFloat(decryptFn(value)) || 0;
  }
  return parseFloat(value) || 0;
};

// Check and send notifications for a single item
const checkAndNotifyItem = async (itemType, itemName, itemId, budget, expense, currency, programPersonnelId) => {
  try {
    const { decrypt } = require("./encryption");
    const budgetValue = decryptNumeric(budget, decrypt);
    const expenseValue = decryptNumeric(expense, decrypt);
    
    if (budgetValue === 0) return; // Skip if no budget
    
    const utilization = calculateUtilization(expenseValue, budgetValue);
    
    // Get program personnel user
    const programUser = await User.findById(programPersonnelId);
    if (!programUser || !programUser.email) {
      console.error(`Program user not found or has no email: ${programPersonnelId}`);
      return;
    }
    
    // Check for exceeded threshold (100%+)
    if (utilization > 100 && !wasNotifiedRecently(itemType, itemId, 'exceeded')) {
      try {
        await sendUtilizationExceededEmail(
          programUser.email,
          programUser.name,
          itemType,
          itemName,
          itemId,
          utilization,
          budgetValue,
          expenseValue,
          currency
        );
        markAsNotified(itemType, itemId, 'exceeded');
      } catch (error) {
        console.error(`Error sending exceeded email for ${itemType} ${itemId}:`, error);
      }
    }
    // Check for warning threshold (90%+)
    else if (utilization >= 90 && utilization <= 100 && !wasNotifiedRecently(itemType, itemId, 'warning')) {
      try {
        await sendUtilizationWarningEmail(
          programUser.email,
          programUser.name,
          itemType,
          itemName,
          itemId,
          utilization,
          budgetValue,
          expenseValue,
          currency
        );
        markAsNotified(itemType, itemId, 'warning');
      } catch (error) {
        console.error(`Error sending warning email for ${itemType} ${itemId}:`, error);
      }
    }
  } catch (error) {
    console.error(`Error checking utilization for ${itemType} ${itemId}:`, error);
  }
};

// Check project utilization
const checkProjectUtilization = async (project) => {
  try {
    const { decrypt } = require("./encryption");
    
    // Decrypt project fields
    let amountDonated = decryptNumeric(project.amountDonated, decrypt);
    let totalExpense = decryptNumeric(project.totalExpense, decrypt);
    let currency = project.currency;
    let title = project.title;
    let projectId = project.projectId;
    
    // Decrypt currency and title if encrypted
    if (currency && typeof currency === 'string' && currency.includes(':')) {
      currency = decrypt(currency);
    }
    if (title && typeof title === 'string' && title.includes(':')) {
      title = decrypt(title);
    }
    
    if (amountDonated === 0) return; // Skip if no budget
    
    const utilization = calculateUtilization(totalExpense, amountDonated);
    
    // Get program personnel user
    const programUser = await User.findById(project.programPersonnel);
    if (!programUser || !programUser.email) {
      console.error(`Program user not found or has no email: ${project.programPersonnel}`);
      return;
    }
    
    // Check for exceeded threshold (100%+)
    if (utilization > 100 && !wasNotifiedRecently('Project', project._id.toString(), 'exceeded')) {
      try {
        await sendUtilizationExceededEmail(
          programUser.email,
          programUser.name,
          'Project',
          title,
          projectId,
          utilization,
          amountDonated,
          totalExpense,
          currency
        );
        markAsNotified('Project', project._id.toString(), 'exceeded');
      } catch (error) {
        console.error(`Error sending exceeded email for Project ${projectId}:`, error);
      }
    }
    // Check for warning threshold (90%+)
    else if (utilization >= 90 && utilization <= 100 && !wasNotifiedRecently('Project', project._id.toString(), 'warning')) {
      try {
        await sendUtilizationWarningEmail(
          programUser.email,
          programUser.name,
          'Project',
          title,
          projectId,
          utilization,
          amountDonated,
          totalExpense,
          currency
        );
        markAsNotified('Project', project._id.toString(), 'warning');
      } catch (error) {
        console.error(`Error sending warning email for Project ${projectId}:`, error);
      }
    }
  } catch (error) {
    console.error(`Error checking project utilization:`, error);
  }
};

// Check activity utilization
const checkActivityUtilization = async (activity, project) => {
  try {
    const { decrypt } = require("./encryption");
    
    const budget = decryptNumeric(activity.budget, decrypt);
    const expense = decryptNumeric(activity.expense, decrypt);
    
    if (budget === 0) return; // Skip if no budget
    
    // Decrypt currency and activity name
    let currency = project.currency;
    let activityName = activity.name;
    
    if (currency && typeof currency === 'string' && currency.includes(':')) {
      currency = decrypt(currency);
    }
    if (activityName && typeof activityName === 'string' && activityName.includes(':')) {
      activityName = decrypt(activityName);
    }
    
    await checkAndNotifyItem(
      'Activity',
      activityName || `Activity ${activity.activityId}`,
      activity.activityId || activity._id.toString(),
      budget,
      expense,
      currency,
      project.programPersonnel
    );
    
    // Check subactivities
    if (activity.subActivities && Array.isArray(activity.subActivities)) {
      for (const subActivity of activity.subActivities) {
        const subBudget = decryptNumeric(subActivity.budget, decrypt);
        const subExpense = decryptNumeric(subActivity.expense, decrypt);
        
        if (subBudget === 0) continue; // Skip if no budget
        
        let subActivityName = subActivity.name;
        if (subActivityName && typeof subActivityName === 'string' && subActivityName.includes(':')) {
          subActivityName = decrypt(subActivityName);
        }
        
        await checkAndNotifyItem(
          'Subactivity',
          subActivityName || `Subactivity ${subActivity.subactivityId}`,
          subActivity.subactivityId || subActivity._id.toString(),
          subBudget,
          subExpense,
          currency,
          project.programPersonnel
        );
      }
    }
  } catch (error) {
    console.error(`Error checking activity utilization:`, error);
  }
};

// Check all project items (project, activities, subactivities)
const checkProjectItemsUtilization = async (project) => {
  try {
    // Check project utilization
    await checkProjectUtilization(project);
    
    // Check activities and subactivities
    if (project.activities && Array.isArray(project.activities)) {
      for (const activity of project.activities) {
        await checkActivityUtilization(activity, project);
      }
    }
  } catch (error) {
    console.error(`Error checking project items utilization:`, error);
  }
};

module.exports = {
  checkProjectUtilization,
  checkActivityUtilization,
  checkProjectItemsUtilization,
  checkAndNotifyItem,
};

