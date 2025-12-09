const mongoose = require("mongoose");
const { encrypt, decrypt } = require("../utils/encryption");

const subActivitySchema = new mongoose.Schema({
  name: { type: String, required: true },
  budget: { 
    type: Number, 
    required: false, 
    default: 0,
    min: [0, "Budget cannot be negative"]
  }
});

const activitySchema = new mongoose.Schema({
  activityId: { type: String, required: true },
  name: { type: String, required: true },
  description: { type: String, required: false },
  budget: { 
    type: Number, 
    required: false, 
    default: 0,
    min: [0, "Budget cannot be negative"]
  },
  subActivities: [subActivitySchema]
});

const projectSchema = new mongoose.Schema(
  {
    programPersonnel: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    projectId: { type: String, required: true, unique: true },
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
      enum: ["Education", "Welfare", "Youth"]
    },

    activities: [activitySchema]
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
  
  // Encrypt activity names, descriptions, and budgets
  if (this.activities && Array.isArray(this.activities)) {
    this.activities = this.activities.map(activity => {
      const encryptedActivity = { ...activity };
      
      // Encrypt activity name
      if (activity.name && typeof activity.name === 'string' && !activity.name.includes(':')) {
        encryptedActivity.name = encrypt(activity.name);
      }
      
      // Encrypt activity description
      if (activity.description && typeof activity.description === 'string' && activity.description !== '' && !activity.description.includes(':')) {
        encryptedActivity.description = encrypt(activity.description);
      }
      
      // Encrypt activity budget
      if (activity.budget !== undefined && activity.budget !== null) {
        const isBudgetEncrypted = typeof activity.budget === 'string' && activity.budget.includes(':');
        if (!isBudgetEncrypted) {
          const budget = typeof activity.budget === 'number' ? activity.budget : parseFloat(activity.budget);
          if (!isNaN(budget) && budget >= 0) {
            encryptedActivity.budget = encrypt(budget.toString());
          }
        }
      }
      
      // Encrypt sub-activity names and budgets
      if (activity.subActivities && Array.isArray(activity.subActivities)) {
        encryptedActivity.subActivities = activity.subActivities.map(subActivity => {
          const encryptedSubActivity = { ...subActivity };
          
          if (subActivity.name && typeof subActivity.name === 'string' && !subActivity.name.includes(':')) {
            encryptedSubActivity.name = encrypt(subActivity.name);
          }
          
          // Encrypt sub-activity budget
          if (subActivity.budget !== undefined && subActivity.budget !== null) {
            const isBudgetEncrypted = typeof subActivity.budget === 'string' && subActivity.budget.includes(':');
            if (!isBudgetEncrypted) {
              const budget = typeof subActivity.budget === 'number' ? subActivity.budget : parseFloat(subActivity.budget);
              if (!isNaN(budget) && budget >= 0) {
                encryptedSubActivity.budget = encrypt(budget.toString());
              }
            }
          }
          
          return encryptedSubActivity;
        });
      }
      
      return encryptedActivity;
    });
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
  
  // Decrypt activity names, descriptions, and budgets
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
          // Already a number
          decryptedActivity.budget = activity.budget;
        }
      }
      
      // Decrypt sub-activity names and budgets
      if (activity.subActivities && Array.isArray(activity.subActivities)) {
        decryptedActivity.subActivities = activity.subActivities.map(subActivity => {
          const decryptedSubActivity = { ...subActivity };
          
          if (subActivity.name && typeof subActivity.name === 'string' && subActivity.name.includes(':')) {
            decryptedSubActivity.name = decrypt(subActivity.name);
          }
          
          // Decrypt sub-activity budget
          if (subActivity.budget !== undefined && subActivity.budget !== null) {
            if (typeof subActivity.budget === 'string' && subActivity.budget.includes(':')) {
              const decrypted = decrypt(subActivity.budget);
              decryptedSubActivity.budget = parseFloat(decrypted) || 0;
            } else if (typeof subActivity.budget === 'number') {
              // Already a number
              decryptedSubActivity.budget = subActivity.budget;
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