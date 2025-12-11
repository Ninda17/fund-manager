const mongoose = require("mongoose");
const { encrypt, decrypt } = require("../utils/encryption");

const subActivitySchema = new mongoose.Schema({
  subactivityId: { type: String, required: true },
  name: { type: String, required: true },
  budget: { 
    type: Number, 
    required: true, 
    default: 0,
    min: [0, "Budget cannot be negative"]
  },
  expense: { 
    type: Number, 
    default: 0,
    min: [0, "Expense cannot be negative"]
  }
});

const activitySchema = new mongoose.Schema({
  activityId: { type: String, required: true },
  name: { type: String, required: true },
  description: { type: String, required: false },
  budget: { 
    type: Number, 
    required: true, 
    default: 0,
    min: [0, "Budget cannot be negative"]
  },
  expense: { 
    type: Number, 
    default: 0,
    min: [0, "Expense cannot be negative"]
  },
  projectStatus: {
    type: String,
    required: false,
    default: "Not Started",
    enum: ["Not Started", "In Progress", "Completed"]
  },
  subActivities: {
    type: [subActivitySchema],
    validate: {
      validator: function (value) {
        return value.length > 0; // ❌ reject if empty
      },
      message: "Every activity must have at least one sub-activity."
    }
  }
});

const projectSchema = new mongoose.Schema(
  {
    programPersonnel: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    projectId: { type: String, required: true },
    title: { type: String, required: true },
    description: { 
      type: String, 
      required: false 
    },

    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    financePersonnel: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    
    donorName: { 
      type: String, 
      required: true 
    },
    amountDonated: { 
      type: Number, 
      required: true,
      min: [0, "Amount donated cannot be negative"]
    },
    currency: {
      type: String,
      required: true,
      default: "USD",
      enum: ["USD", "EUR", "BTN"]
    },
    projectType: {
      type: String,
      required: true,
      default: "Education",
      enum: ["Education", "Welfare", "Youth", "other"]
    },
    totalExpense: { 
      type: Number, 
      default: 0, 
      min: [0, "Total expense cannot be negative"]
    },
    projectStatus: {
      type: String,
      required: false,
      default: "Not Started",
      enum: ["Not Started", "In Progress", "Completed"]
    },
    activities: {
      type: [activitySchema],
      validate: {
        validator: function (value) {
          return value.length > 0; // ❌ reject if empty
        },
        message: "Project must have at least one activity."
      }
    }
  },
  { timestamps: true }
);

// Validate that financialPersonnel is a user with role "finance", email verified, and approved
projectSchema.pre("save", async function (next) {
  if (this.financePersonnel) {
    const User = mongoose.model("User");
    const user = await User.findById(this.financePersonnel);
    
    if (!user) {
      return next(new Error("Financial personnel user not found"));
    }
    
    if (user.role !== "finance") {
      return next(new Error("Financial personnel must be a user with role 'finance'"));
    }
    
    if (!user.isEmailVerified) {
      return next(new Error("Financial personnel must have a verified email address"));
    }
    
    if (user.isApproved !== "approved") {
      return next(new Error("Financial personnel must be approved"));
    }
  }
  next();
});

// Validate that programPersonnel is a user with role "program"
projectSchema.pre("save", async function (next) {
  if (this.programPersonnel) {
    const User = mongoose.model("User");
    const user = await User.findById(this.programPersonnel);
    
    if (!user) {
      return next(new Error("Program personnel user not found"));
    }
    
    if (user.role !== "program") {
      return next(new Error("Program personnel must be a user with role 'program'"));
    }
  }
  next();
});

// Validate that endDate is after startDate
projectSchema.pre("save", function (next) {
  if (this.startDate && this.endDate && this.endDate < this.startDate) {
    return next(new Error("End date must be after start date"));
  }
  next();
});


// It calculates activity expenses from sub-activities and total expense from activities
projectSchema.pre("save", function (next) {
  if (this.activities && Array.isArray(this.activities)) {
    this.activities.forEach(activity => {
      // Calculate activity expense = sum of all sub-activity expenses
      if (activity.subActivities && Array.isArray(activity.subActivities)) {
        activity.expense = activity.subActivities.reduce(
          (sum, sa) => sum + (sa.expense || 0),
          0
        );
      } else {
        activity.expense = 0;
      }
    });

    // Calculate total expense = sum of all activity expenses
    this.totalExpense = this.activities.reduce(
      (sum, act) => sum + (act.expense || 0),
      0
    );
  } else {
    this.totalExpense = 0;
  }
  next();
});

// Encrypt sensitive fields before saving
projectSchema.pre("save", function (next) {
  // Encrypt donorName
  if (this.donorName !== undefined && this.donorName !== null && this.donorName !== '') {
    // Check if already encrypted (contains ':')
    if (!this.donorName.includes(':')) {
      this.donorName = encrypt(this.donorName);
    }
  }
  
  // Encrypt description
  if (this.description !== undefined && this.description !== null && this.description !== '') {
    // Check if already encrypted
    if (!this.description.includes(':')) {
      this.description = encrypt(this.description);
    }
  }
  
  // Encrypt amountDonated
  // Convert Number to String for encryption
  if (this.amountDonated !== undefined && this.amountDonated !== null) {
    // Check if already encrypted (if it's a string with ':')
    const isEncrypted = typeof this.amountDonated === 'string' && this.amountDonated.includes(':');
    
    if (!isEncrypted) {
      // Validate it's a number (should already be validated by schema)
      const amount = typeof this.amountDonated === 'number' ? this.amountDonated : parseFloat(this.amountDonated);
      if (isNaN(amount) || amount < 0) {
        return next(new Error("Amount donated must be a non-negative number"));
      }
      // Convert number to string and encrypt
      // Directly set in _doc to bypass Mongoose type casting
      const encryptedValue = encrypt(amount.toString());
      this._doc.amountDonated = encryptedValue;
      this.markModified('amountDonated');
    }
  }
  
  // Encrypt startDate
  if (this.startDate !== undefined && this.startDate !== null) {
    const isEncrypted = typeof this.startDate === 'string' && this.startDate.includes(':');
    if (!isEncrypted) {
      // Convert Date to ISO string and encrypt
      const dateString = this.startDate instanceof Date ? this.startDate.toISOString() : new Date(this.startDate).toISOString();
      const encryptedValue = encrypt(dateString);
      this._doc.startDate = encryptedValue;
      this.markModified('startDate');
    }
  }
  
  // Encrypt endDate
  if (this.endDate !== undefined && this.endDate !== null) {
    const isEncrypted = typeof this.endDate === 'string' && this.endDate.includes(':');
    if (!isEncrypted) {
      // Convert Date to ISO string and encrypt
      const dateString = this.endDate instanceof Date ? this.endDate.toISOString() : new Date(this.endDate).toISOString();
      const encryptedValue = encrypt(dateString);
      this._doc.endDate = encryptedValue;
      this.markModified('endDate');
    }
  }
  
  // Encrypt currency
  if (this.currency !== undefined && this.currency !== null && this.currency !== '') {
    // Check if already encrypted
    if (!this.currency.includes(':')) {
      this.currency = encrypt(this.currency);
    }
  }
  
  // Encrypt projectType
  if (this.projectType !== undefined && this.projectType !== null && this.projectType !== '') {
    // Check if already encrypted
    if (!this.projectType.includes(':')) {
      this.projectType = encrypt(this.projectType);
    }
  }
  
  // Encrypt totalExpense
  if (this.totalExpense !== undefined && this.totalExpense !== null) {
    const isEncrypted = typeof this.totalExpense === 'string' && this.totalExpense.includes(':');
    
    if (!isEncrypted) {
      const expense = typeof this.totalExpense === 'number' ? this.totalExpense : parseFloat(this.totalExpense);
      if (isNaN(expense) || expense < 0) {
        return next(new Error("Total expense must be a non-negative number"));
      }
      const encryptedValue = encrypt(expense.toString());
      this._doc.totalExpense = encryptedValue;
      this.markModified('totalExpense');
    }
  }
  
  // Encrypt activity names, descriptions, budgets, and expenses
  if (this.activities && Array.isArray(this.activities)) {
    // Ensure _doc.activities exists
    if (!this._doc) {
      this._doc = {};
    }
    if (!this._doc.activities) {
      this._doc.activities = [];
    }
    
    // Convert to plain objects to avoid Mongoose type casting
    const activitiesArray = this.activities.map((activity, index) => {
      const encryptedActivity = activity.toObject ? activity.toObject() : { ...activity };
      
      // Encrypt activity name
      if (encryptedActivity.name && typeof encryptedActivity.name === 'string' && !encryptedActivity.name.includes(':')) {
        encryptedActivity.name = encrypt(encryptedActivity.name);
      }
      
      // Encrypt activity description
      if (encryptedActivity.description && typeof encryptedActivity.description === 'string' && encryptedActivity.description !== '' && !encryptedActivity.description.includes(':')) {
        encryptedActivity.description = encrypt(encryptedActivity.description);
      }
      
      // Encrypt activity budget
      if (encryptedActivity.budget !== undefined && encryptedActivity.budget !== null) {
        const isEncrypted = typeof encryptedActivity.budget === 'string' && encryptedActivity.budget.includes(':');
        if (!isEncrypted) {
          const budget = typeof encryptedActivity.budget === 'number' ? encryptedActivity.budget : parseFloat(encryptedActivity.budget);
          if (isNaN(budget) || budget < 0) {
            return next(new Error("Activity budget must be a non-negative number"));
          }
          const encryptedBudget = encrypt(budget.toString());
          encryptedActivity.budget = encryptedBudget;
          // Set in _doc to bypass Mongoose casting
          if (!this._doc.activities[index]) {
            this._doc.activities[index] = {};
          }
          this._doc.activities[index].budget = encryptedBudget;
        }
      }
      
      // Encrypt activity expense
      if (encryptedActivity.expense !== undefined && encryptedActivity.expense !== null) {
        const isEncrypted = typeof encryptedActivity.expense === 'string' && encryptedActivity.expense.includes(':');
        if (!isEncrypted) {
          const expense = typeof encryptedActivity.expense === 'number' ? encryptedActivity.expense : parseFloat(encryptedActivity.expense);
          if (isNaN(expense) || expense < 0) {
            return next(new Error("Activity expense must be a non-negative number"));
          }
          const encryptedExpense = encrypt(expense.toString());
          encryptedActivity.expense = encryptedExpense;
          // Set in _doc to bypass Mongoose casting
          if (!this._doc.activities[index]) {
            this._doc.activities[index] = {};
          }
          this._doc.activities[index].expense = encryptedExpense;
        }
      }
      
      // Encrypt sub-activity names, budgets, and expenses
      if (encryptedActivity.subActivities && Array.isArray(encryptedActivity.subActivities)) {
        if (!this._doc.activities[index]) {
          this._doc.activities[index] = {};
        }
        if (!this._doc.activities[index].subActivities) {
          this._doc.activities[index].subActivities = [];
        }
        
        encryptedActivity.subActivities = encryptedActivity.subActivities.map((subActivity, subIndex) => {
          const encryptedSubActivity = subActivity.toObject ? subActivity.toObject() : { ...subActivity };
          
          // Encrypt sub activity name
          if (encryptedSubActivity.name && typeof encryptedSubActivity.name === 'string' && !encryptedSubActivity.name.includes(':')) {
            encryptedSubActivity.name = encrypt(encryptedSubActivity.name);
          }
          
          // Encrypt sub activity budget
          if (encryptedSubActivity.budget !== undefined && encryptedSubActivity.budget !== null) {
            const isEncrypted = typeof encryptedSubActivity.budget === 'string' && encryptedSubActivity.budget.includes(':');
            if (!isEncrypted) {
              const budget = typeof encryptedSubActivity.budget === 'number' ? encryptedSubActivity.budget : parseFloat(encryptedSubActivity.budget);
              if (isNaN(budget) || budget < 0) {
                return next(new Error("Sub-activity budget must be a non-negative number"));
              }
              const encryptedBudget = encrypt(budget.toString());
              encryptedSubActivity.budget = encryptedBudget;
              // Set in _doc to bypass Mongoose casting
              if (!this._doc.activities[index].subActivities[subIndex]) {
                this._doc.activities[index].subActivities[subIndex] = {};
              }
              this._doc.activities[index].subActivities[subIndex].budget = encryptedBudget;
            }
          }
          
          // Encrypt sub activity expense
          if (encryptedSubActivity.expense !== undefined && encryptedSubActivity.expense !== null) {
            const isEncrypted = typeof encryptedSubActivity.expense === 'string' && encryptedSubActivity.expense.includes(':');
            if (!isEncrypted) {
              const expense = typeof encryptedSubActivity.expense === 'number' ? encryptedSubActivity.expense : parseFloat(encryptedSubActivity.expense);
              if (isNaN(expense) || expense < 0) {
                return next(new Error("Sub-activity expense must be a non-negative number"));
              }
              const encryptedExpense = encrypt(expense.toString());
              encryptedSubActivity.expense = encryptedExpense;
              // Set in _doc to bypass Mongoose casting
              if (!this._doc.activities[index].subActivities[subIndex]) {
                this._doc.activities[index].subActivities[subIndex] = {};
              }
              this._doc.activities[index].subActivities[subIndex].expense = encryptedExpense;
            }
          }
          
          return encryptedSubActivity;
        });
      }
      
      return encryptedActivity;
    });
    
    // Set the encrypted activities array and mark as modified
    this.activities = activitiesArray;
    // Also set in _doc to ensure Mongoose uses the encrypted values
    this._doc.activities = activitiesArray;
    this.markModified('activities');
  }
  
  next();
});

// Decrypt sensitive fields after retrieving
const decryptProject = function(doc, plainDoc = null) {
  if (!doc) return doc;
  
  // Use plainDoc if provided (from toObject), otherwise try to get raw values
  const rawDoc = plainDoc || doc._doc || doc;
  
  // Decrypt donorName
  if (doc.donorName && typeof doc.donorName === 'string' && doc.donorName.includes(':')) {
    doc.donorName = decrypt(doc.donorName);
  }
  
  // Decrypt description
  if (doc.description && typeof doc.description === 'string' && doc.description !== '' && doc.description.includes(':')) {
    doc.description = decrypt(doc.description);
  }
  
  // Decrypt amountDonated (decrypt string, convert back to number)
  // Check raw document value first, as Mongoose may have tried to cast it
  const rawAmountDonated = rawDoc.amountDonated;
  if (rawAmountDonated !== undefined && rawAmountDonated !== null) {
    if (typeof rawAmountDonated === 'string' && rawAmountDonated.includes(':')) {
      // Decrypt the encrypted string
      const decrypted = decrypt(rawAmountDonated);
      // Convert back to Number
      doc.amountDonated = parseFloat(decrypted) || 0;
    } else if (typeof doc.amountDonated === 'number') {
      // If doc.amountDonated is a number but raw is encrypted string, decrypt it
      if (typeof rawAmountDonated === 'string' && rawAmountDonated.includes(':')) {
        const decrypted = decrypt(rawAmountDonated);
        doc.amountDonated = parseFloat(decrypted) || 0;
      }
      // Otherwise keep the number (shouldn't happen if encrypted, but handle it)
    }
  }
  
  // Decrypt startDate
  // Check raw document value first, as Mongoose may have tried to cast it to Date
  const rawStartDate = rawDoc.startDate;
  if (rawStartDate !== undefined && rawStartDate !== null) {
    if (typeof rawStartDate === 'string' && rawStartDate.includes(':')) {
      const decrypted = decrypt(rawStartDate);
      doc.startDate = new Date(decrypted);
    } else if (doc.startDate instanceof Date) {
      // If doc.startDate is a Date but raw is encrypted string, decrypt it
      if (typeof rawStartDate === 'string' && rawStartDate.includes(':')) {
        const decrypted = decrypt(rawStartDate);
        doc.startDate = new Date(decrypted);
      } else if (isNaN(doc.startDate.getTime())) {
        // Invalid date - might be because casting failed, try raw value
        if (typeof rawStartDate === 'string' && rawStartDate.includes(':')) {
          const decrypted = decrypt(rawStartDate);
          doc.startDate = new Date(decrypted);
        }
      }
      // Otherwise keep the date (shouldn't happen if encrypted, but handle it)
    }
  }
  
  // Decrypt endDate
  // Check raw document value first, as Mongoose may have tried to cast it to Date
  const rawEndDate = rawDoc.endDate;
  if (rawEndDate !== undefined && rawEndDate !== null) {
    if (typeof rawEndDate === 'string' && rawEndDate.includes(':')) {
      const decrypted = decrypt(rawEndDate);
      doc.endDate = new Date(decrypted);
    } else if (doc.endDate instanceof Date) {
      // If doc.endDate is a Date but raw is encrypted string, decrypt it
      if (typeof rawEndDate === 'string' && rawEndDate.includes(':')) {
        const decrypted = decrypt(rawEndDate);
        doc.endDate = new Date(decrypted);
      } else if (isNaN(doc.endDate.getTime())) {
        // Invalid date - might be because casting failed, try raw value
        if (typeof rawEndDate === 'string' && rawEndDate.includes(':')) {
          const decrypted = decrypt(rawEndDate);
          doc.endDate = new Date(decrypted);
        }
      }
      // Otherwise keep the date (shouldn't happen if encrypted, but handle it)
    }
  }
  
  // Decrypt currency
  if (doc.currency && typeof doc.currency === 'string' && doc.currency.includes(':')) {
    doc.currency = decrypt(doc.currency);
  }
  
  // Decrypt projectType
  if (doc.projectType && typeof doc.projectType === 'string' && doc.projectType.includes(':')) {
    doc.projectType = decrypt(doc.projectType);
  }
  
  // Decrypt totalExpense
  const rawTotalExpense = rawDoc.totalExpense;
  if (rawTotalExpense !== undefined && rawTotalExpense !== null) {
    if (typeof rawTotalExpense === 'string' && rawTotalExpense.includes(':')) {
      const decrypted = decrypt(rawTotalExpense);
      doc.totalExpense = parseFloat(decrypted) || 0;
    } else if (typeof doc.totalExpense === 'number') {
      if (typeof rawTotalExpense === 'string' && rawTotalExpense.includes(':')) {
        const decrypted = decrypt(rawTotalExpense);
        doc.totalExpense = parseFloat(decrypted) || 0;
      }
    }
  }
  
  // Decrypt activity names, descriptions, budgets, and expenses
  if (doc.activities && Array.isArray(doc.activities)) {
    doc.activities = doc.activities.map(activity => {
      const decryptedActivity = { ...activity };
      
      // Decrypt activity name
      if (activity.name && typeof activity.name === 'string' && activity.name.includes(':')) {
        decryptedActivity.name = decrypt(activity.name);
      }
      
      // Decrypt activity description
      if (activity.description && typeof activity.description === 'string' && activity.description !== '' && activity.description.includes(':')) {
        decryptedActivity.description = decrypt(activity.description);
      }
      
      // Decrypt activity budget
      if (activity.budget !== undefined && activity.budget !== null) {
        if (typeof activity.budget === 'string' && activity.budget.includes(':')) {
          const decrypted = decrypt(activity.budget);
          decryptedActivity.budget = parseFloat(decrypted) || 0;
        } else if (typeof activity.budget === 'number') {
          // Keep the number if not encrypted
          decryptedActivity.budget = activity.budget;
        }
      }
      
      // Decrypt activity expense
      if (activity.expense !== undefined && activity.expense !== null) {
        if (typeof activity.expense === 'string' && activity.expense.includes(':')) {
          const decrypted = decrypt(activity.expense);
          decryptedActivity.expense = parseFloat(decrypted) || 0;
        } else if (typeof activity.expense === 'number') {
          // Keep the number if not encrypted
          decryptedActivity.expense = activity.expense;
        }
      }
      
      // Decrypt sub-activity names, budgets, and expenses
      if (activity.subActivities && Array.isArray(activity.subActivities)) {
        decryptedActivity.subActivities = activity.subActivities.map(subActivity => {
          const decryptedSubActivity = { ...subActivity };
          
          // Decrypt sub activity name
          if (subActivity.name && typeof subActivity.name === 'string' && subActivity.name.includes(':')) {
            decryptedSubActivity.name = decrypt(subActivity.name);
          }
          
          // Decrypt sub activity budget
          if (subActivity.budget !== undefined && subActivity.budget !== null) {
            if (typeof subActivity.budget === 'string' && subActivity.budget.includes(':')) {
              const decrypted = decrypt(subActivity.budget);
              decryptedSubActivity.budget = parseFloat(decrypted) || 0;
            } else if (typeof subActivity.budget === 'number') {
              // Keep the number if not encrypted
              decryptedSubActivity.budget = subActivity.budget;
            }
          }
          
          // Decrypt sub activity expense
          if (subActivity.expense !== undefined && subActivity.expense !== null) {
            if (typeof subActivity.expense === 'string' && subActivity.expense.includes(':')) {
              const decrypted = decrypt(subActivity.expense);
              decryptedSubActivity.expense = parseFloat(decrypted) || 0;
            } else if (typeof subActivity.expense === 'number') {
              // Keep the number if not encrypted
              decryptedSubActivity.expense = subActivity.expense;
            }
          }
          
          return decryptedSubActivity;
        });
      }
      
      return decryptedActivity;
    });
  }
  
  return doc;
};

// Apply decryption to various query methods
projectSchema.post(['find', 'findOne', 'findOneAndUpdate', 'findOneAndDelete'], function(docs) {
  if (!docs) return;
  
  if (Array.isArray(docs)) {
    docs.forEach(doc => {
      // Convert to plain object to access raw values, then decrypt
      const plainDoc = doc.toObject ? doc.toObject({ getters: false }) : doc;
      decryptProject(doc, plainDoc);
    });
  } else {
    const plainDoc = docs.toObject ? docs.toObject({ getters: false }) : docs;
    decryptProject(docs, plainDoc);
  }
});

projectSchema.post('save', function(doc) {
  const plainDoc = doc.toObject ? doc.toObject({ getters: false }) : doc;
  decryptProject(doc, plainDoc);
});

module.exports = mongoose.model("Project", projectSchema);