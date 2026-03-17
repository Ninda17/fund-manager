const nodemailer = require("nodemailer");

// Create transporter
const createTransporter = () => {
  const port = Number.parseInt(process.env.SMTP_PORT, 10) || 587;
  const secureEnv = (process.env.SMTP_SECURE || "").toString().toLowerCase();
  const secure =
    secureEnv === "true" || secureEnv === "1" || (secureEnv === "" && port === 465);

  const rejectUnauthorizedEnv = (process.env.SMTP_TLS_REJECT_UNAUTHORIZED || "true")
    .toString()
    .toLowerCase();
  const rejectUnauthorized = !(
    rejectUnauthorizedEnv === "false" || rejectUnauthorizedEnv === "0"
  );

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port,
    secure, // true for 465, false for other ports
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    tls: {
      rejectUnauthorized,
    },
  });
};

const getFromAddress = () =>
  process.env.MAIL_FROM || process.env.SMTP_FROM || process.env.SMTP_USER;

// Send OTP email
const sendOTPEmail = async (email, otp) => {
  try {
    const transporter = createTransporter();

    const mailOptions = {
      from: getFromAddress(),
      to: email,
      subject: "Password Reset OTP - Tarayana Fund Tracker",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Password Reset Request</h2>
          <p>You have requested to reset your password. Please use the following OTP to proceed:</p>
          <div style="background-color: #f4f4f4; padding: 20px; text-align: center; margin: 20px 0;">
            <h1 style="color: #007bff; font-size: 32px; margin: 0; letter-spacing: 5px;">${otp}</h1>
          </div>
          <p>This OTP will expire in 10 minutes.</p>
          <p style="color: #666; font-size: 12px;">If you did not request this password reset, please ignore this email.</p>
        </div>
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    // console.log("OTP email sent:", info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error("Error sending OTP email:", error);
    throw new Error("Failed to send OTP email");
  }
};

// Send utilization warning email (90% threshold)
const sendUtilizationWarningEmail = async (email, programName, itemType, itemName, itemId, utilization, budget, expense, currency) => {
  try {
    const transporter = createTransporter();

    const currencySymbols = {
      USD: '$',
      EUR: '€',
      BTN: 'Nu.',
    };
    const symbol = currencySymbols[currency] || currency;
    const formattedBudget = `${symbol}${budget.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const formattedExpense = `${symbol}${expense.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    const mailOptions = {
      from: getFromAddress(),
      to: email,
      subject: `⚠️ Utilization Warning: ${itemType} "${itemName}" Reached ${utilization.toFixed(1)}% - Tarayana Fund Tracker`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #f59e0b;">Utilization Warning</h2>
          <p>Dear ${programName},</p>
          <p>This is to inform you that your ${itemType.toLowerCase()} has reached <strong>${utilization.toFixed(1)}%</strong> utilization.</p>
          
          <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #92400e;">${itemType} Details:</h3>
            <p><strong>Name:</strong> ${itemName}</p>
            <p><strong>ID:</strong> ${itemId}</p>
            <p><strong>Budget:</strong> ${formattedBudget}</p>
            <p><strong>Expense:</strong> ${formattedExpense}</p>
            <p><strong>Utilization:</strong> ${utilization.toFixed(1)}%</p>
          </div>
          
          <p style="color: #92400e;"><strong>Please review your expenses and budget allocation.</strong></p>
          <p style="color: #666; font-size: 12px; margin-top: 20px;">This is an automated notification from Tarayana Fund Tracker.</p>
        </div>
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error("Error sending utilization warning email:", error);
    throw new Error("Failed to send utilization warning email");
  }
};

// Send utilization exceeded email (100%+ threshold)
const sendUtilizationExceededEmail = async (email, programName, itemType, itemName, itemId, utilization, budget, expense, currency) => {
  try {
    const transporter = createTransporter();

    const currencySymbols = {
      USD: '$',
      EUR: '€',
      BTN: 'Nu.',
    };
    const symbol = currencySymbols[currency] || currency;
    const formattedBudget = `${symbol}${budget.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const formattedExpense = `${symbol}${expense.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const overage = expense - budget;
    const formattedOverage = `${symbol}${overage.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    const mailOptions = {
      from: getFromAddress(),
      to: email,
      subject: `🚨 URGENT: Budget Exceeded - ${itemType} "${itemName}" - Tarayana Fund Tracker`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #dc2626;">Budget Exceeded - Immediate Action Required</h2>
          <p>Dear ${programName},</p>
          <p><strong style="color: #dc2626;">URGENT:</strong> Your ${itemType.toLowerCase()} has exceeded its budget allocation.</p>
          
          <div style="background-color: #fee2e2; border-left: 4px solid #dc2626; padding: 15px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #991b1b;">${itemType} Details:</h3>
            <p><strong>Name:</strong> ${itemName}</p>
            <p><strong>ID:</strong> ${itemId}</p>
            <p><strong>Budget:</strong> ${formattedBudget}</p>
            <p><strong>Expense:</strong> ${formattedExpense}</p>
            <p><strong>Overage:</strong> <span style="color: #dc2626; font-weight: bold;">${formattedOverage}</span></p>
            <p><strong>Utilization:</strong> <span style="color: #dc2626; font-weight: bold;">${utilization.toFixed(1)}%</span></p>
          </div>
          
          <p style="color: #991b1b;"><strong>Immediate action is required. Please review your expenses and take necessary corrective measures.</strong></p>
          <p style="color: #666; font-size: 12px; margin-top: 20px;">This is an automated notification from Tarayana Fund Tracker.</p>
        </div>
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error("Error sending utilization exceeded email:", error);
    throw new Error("Failed to send utilization exceeded email");
  }
};

module.exports = {
  sendOTPEmail,
  sendUtilizationWarningEmail,
  sendUtilizationExceededEmail,
};

