# Step-by-Step MySQL Implementation Guide

## 🎯 Goal
Switch from MongoDB to MySQL, starting fresh (no data migration needed).

---

## ✅ Step 1: Install MySQL Driver

**Action:** Install `mysql2` package

```bash
npm install mysql2
```

**Why:** Sequelize needs `mysql2` to connect to MySQL (you already have Sequelize installed ✅)

---

## ✅ Step 2: Setup MySQL Database Connection ✅ COMPLETED

**File:** `backend/config/database.js`

**Current:** Mongoose connection to MongoDB  
**New:** Sequelize connection to MySQL

**What we did:**
- ✅ Replaced Mongoose with Sequelize
- ✅ Configured MySQL connection with environment variables
- ✅ Updated `server.js` to use new connection structure
- ✅ Added connection pooling and error handling

**Files Updated:**
- `backend/config/database.js` - Now uses Sequelize with MySQL
- `backend/server.js` - Updated import to use new structure

---

## ✅ Step 3: Create MySQL Database

**Goal:** Create an empty database named `fund_manager` in your MySQL server.

**Do you need MySQL Workbench?** ❌ **NO** - It's optional! You can use any of these methods:

---

### **Method 1: MySQL Command Line** (Recommended - No extra software needed)

**Prerequisites:** MySQL must be installed and running on your computer.

**Steps:**

1. **Open Command Prompt (Windows) or Terminal (Mac/Linux)**

2. **Connect to MySQL:**
   ```bash
   mysql -u root -p
   ```
   - Enter your MySQL root password when prompted
   - If you don't have a password set, try: `mysql -u root` (without `-p`)

3. **Create the database:**
   ```sql
   CREATE DATABASE fund_manager;
   ```

4. **Verify it was created:**
   ```sql
   SHOW DATABASES;
   ```
   - You should see `fund_manager` in the list

5. **Exit MySQL:**
   ```sql
   EXIT;
   ```

**✅ Done!** Database is ready.

---

### **Method 2: MySQL Workbench** (If you prefer GUI)

**Prerequisites:** Download and install [MySQL Workbench](https://dev.mysql.com/downloads/workbench/)

**Steps:**

1. **Open MySQL Workbench**
   - Launch the application from your Start Menu (Windows) or Applications (Mac)

2. **Connect to your MySQL server**
   - On the home screen, you'll see "MySQL Connections"
   - Double-click on your local connection (usually named "Local instance MySQL" or "localhost")
   - Enter your MySQL root password when prompted
   - Click "OK"

3. **Open a new SQL tab**
   - Go to **File → New Query Tab**
   - OR press **`Ctrl+T`** (Windows) or **`Cmd+T`** (Mac)
   - OR click the **SQL+** icon in the toolbar

4. **Run this SQL command:**
   ```sql
   CREATE DATABASE fund_manager;
   ```

5. **Execute the command:**
   - Click the **Execute button** (⚡ lightning bolt icon) in the toolbar
   - OR press **`Ctrl+Enter`** (Windows) or **`Cmd+Enter`** (Mac)
   - You should see a success message

6. **Verify the database was created:**
   - Look at the **Schemas panel** on the left sidebar
   - Click the **refresh icon** (🔄 circular arrow) next to "Schemas"
   - You should now see **`fund_manager`** appear in the list

**✅ Done!** Database is ready.

---

### **Method 3: phpMyAdmin** (If you have XAMPP/WAMP/MAMP)

**Prerequisites:** XAMPP/WAMP/MAMP installed with phpMyAdmin

**Steps:**

1. **Start MySQL** in XAMPP/WAMP/MAMP control panel

2. **Open phpMyAdmin** (usually at `http://localhost/phpmyadmin`)

3. **Click on "New" or "Databases" tab**

4. **Enter database name:** `fund_manager`

5. **Click "Create"**

**✅ Done!** Database is ready.

---

### **Method 4: Using Node.js Script** (Alternative - We can create this)

We can create a simple script that creates the database automatically if it doesn't exist.

---

### **How to Check if MySQL is Installed:**

**Windows:**
```bash
mysql --version
```

**Mac:**
```bash
mysql --version
```

**If MySQL is NOT installed:**

- **Windows:** Download [MySQL Installer](https://dev.mysql.com/downloads/installer/)
- **Mac:** `brew install mysql` (if you have Homebrew) or download from MySQL website
- **Linux:** `sudo apt-get install mysql-server` (Ubuntu/Debian)

---

### **Common Issues:**

**Issue:** `mysql: command not found`
- **Solution:** MySQL is not installed or not in your PATH. Install MySQL first.

**Issue:** `Access denied for user 'root'`
- **Solution:** Check your password, or reset MySQL root password

**Issue:** `Can't connect to MySQL server`
- **Solution:** Make sure MySQL service is running (check Services on Windows, or `sudo service mysql start` on Linux)

---

### **What Happens After Creating the Database?**

Once the database is created:
- It will be **empty** (no tables yet)
- Tables will be created automatically when we convert models (Step 5) or sync Sequelize (Step 9)
- The database name `fund_manager` must match `DB_NAME` in your `.env` file

---

**Which method should you use?**

- ✅ **Method 1 (Command Line)** - Fastest, no extra software
- ✅ **Method 2 (MySQL Workbench)** - Good if you like visual tools
- ✅ **Method 3 (phpMyAdmin)** - Good if you already have XAMPP/WAMP
- ✅ **Method 4 (Node Script)** - Good if you want automation

**Recommendation:** Use **Method 1** (Command Line) - it's the simplest and doesn't require installing extra software!

---

## ✅ Step 4: Update Environment Variables

**File:** `.env`

**Add:**
```env
# MySQL Configuration
DB_HOST=localhost
DB_PORT=3306
DB_NAME=fund_manager
DB_USER=root
DB_PASSWORD=root
```

**Keep MongoDB URL temporarily** (until we finish migration):
```env
MONGO_URL=mongodb+srv://...  # Can remove later
```

---

## ✅ Step 5: Convert Models (One by One)

**Order:**
1. User Model (simplest)
2. OTP Model
3. ActivityLog Model
4. Project Model (most complex)
5. Activity Model (new - split from Project)
6. SubActivity Model (new - split from Project)
7. ProjectDocument Model (new - split from Project)
8. ReallocationRequest Model

**For each model:**
- Create Sequelize model file
- Define fields and data types
- Add validations
- Setup relationships (associations)

---

## ✅ Step 6: Setup Model Relationships

**File:** `backend/models/index.js` (create if doesn't exist)

**What we'll do:**
- Import all models
- Define associations (hasMany, belongsTo)
- Export models and sequelize instance

---

## ✅ Step 7: Handle Special Features

### **A. Encryption**
- Move from Mongoose hooks to Sequelize hooks
- Or create encryption service layer

### **B. TTL Indexes (Auto-delete)**
- Create cleanup jobs using `node-cron`
- Schedule daily/hourly cleanup

### **C. Pre-save Validations**
- Convert to Sequelize validators
- Use Sequelize hooks for complex validations

### **D. Auto-calculations**
- Move to Sequelize hooks
- Or calculate in service layer

---

## ✅ Step 8: Update Controllers

**For each controller:**
- Replace `find()` → `findAll()`
- Replace `findById()` → `findByPk()`
- Replace `findOne()` → `findOne({ where: {} })`
- Add `include` for relationships
- Update encryption/decryption calls
- Update validation logic

---

## ✅ Step 9: Sync Database (Create Tables)

**Options:**
1. **Manual:** Run SQL scripts to create tables
2. **Sequelize Sync:** Use `sequelize.sync()` (development only)
3. **Migrations:** Use Sequelize migrations (recommended for production)

---

## ✅ Step 10: Test Everything

- Test all CRUD operations
- Test relationships
- Test encryption/decryption
- Test validation
- Test cleanup jobs

---

## ✅ Step 11: Cleanup

- Remove Mongoose dependencies
- Remove MongoDB connection
- Update package.json keywords
- Remove unused MongoDB code

---

## 🚀 Ready to Start?

Let's begin with **Step 1** - Installing MySQL driver and setting up the connection!

