import nodemailer from 'nodemailer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import logger from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class EmailService {
  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });
  }
  
  // Load email template
  loadTemplate(templateName, data) {
    try {
      const templatePath = path.join(__dirname, '../templates/email', `${templateName}.html`);
      let template = fs.readFileSync(templatePath, 'utf8');
      
      // Replace placeholders with actual data
      Object.keys(data).forEach(key => {
        const regex = new RegExp(`{{${key}}}`, 'g');
        template = template.replace(regex, data[key]);
      });
      
      return template;
    } catch (error) {
      logger.error('Email template loading failed:', error);
      return this.getDefaultTemplate(data);
    }
  }
  
  // Default email template
  getDefaultTemplate(data) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>E-commerce Platform</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #2c3e50;">Hello ${data.name || 'User'},</h2>
          <p>${data.message || 'Thank you for using our platform.'}</p>
          <p>Best regards,<br>The E-commerce Team</p>
        </div>
      </body>
      </html>
    `;
  }
  
  // Send email
  async sendEmail({ to, subject, template, data, html, text }) {
    try {
      const emailOptions = {
        from: `${process.env.EMAIL_FROM_NAME} <${process.env.EMAIL_FROM}>`,
        to,
        subject
      };
      
      if (template) {
        emailOptions.html = this.loadTemplate(template, data);
      } else if (html) {
        emailOptions.html = html;
      } else if (text) {
        emailOptions.text = text;
      } else {
        emailOptions.html = this.getDefaultTemplate(data);
      }
      
      const info = await this.transporter.sendMail(emailOptions);
      logger.info(`Email sent: ${info.messageId}`);
      return info;
    } catch (error) {
      logger.error('Email sending failed:', error);
      throw error;
    }
  }
  
  // Send welcome email
  async sendWelcomeEmail(user, loginMethod = 'email') {
    return this.sendEmail({
      to: user.email,
      subject: 'Welcome to Our E-commerce Platform!',
      template: 'welcome',
      data: {
        name: user.firstName,
        email: user.email,
        loginMethod
      }
    });
  }
  
  // Send order confirmation email
  async sendOrderConfirmation(order, user) {
    return this.sendEmail({
      to: user.email,
      subject: `Order Confirmation - ${order.orderNumber}`,
      template: 'order-confirmation',
      data: {
        name: user.firstName,
        orderNumber: order.orderNumber,
        total: order.pricing.total,
        items: order.items,
        shippingAddress: order.shippingAddress
      }
    });
  }
  
  // Send order status update email
  async sendOrderStatusUpdate(order, user) {
    return this.sendEmail({
      to: user.email,
      subject: `Order Update - ${order.orderNumber}`,
      template: 'order-status-update',
      data: {
        name: user.firstName,
        orderNumber: order.orderNumber,
        status: order.status,
        trackingNumber: order.shipping.trackingNumber
      }
    });
  }
}

export default new EmailService();
export const sendEmail = (options) => new EmailService().sendEmail(options);




// import nodemailer from 'nodemailer';
// import path from 'path';
// import fs from 'fs';
// import { fileURLToPath } from 'url';
// import logger from '../utils/logger.js';

// const __filename = fileURLToPath(import.meta.url);
// const __dirname = path.dirname(__filename);

// class EmailService {
//   constructor() {
//     this.transporter = nodemailer.createTransport({
//       host: process.env.SMTP_HOST,
//       port: process.env.SMTP_PORT,
//       secure: process.env.SMTP_SECURE === 'true',
//       auth: {
//         user: process.env.SMTP_USER,
//         pass: process.env.SMTP_PASS
//       }
//     });
//   }
  
//   // Load email template
//   loadTemplate(templateName, data) {
//     try {
//       const templatePath = path.join(__dirname, '../templates/email', `${templateName}.html`);
//       let template = fs.readFileSync(templatePath, 'utf8');
      
//       // Replace placeholders with actual data
//       Object.keys(data).forEach(key => {
//         const regex = new RegExp(`{{${key}}}`, 'g');
//         template = template.replace(regex, data[key]);
//       });
      
//       return template;
//     } catch (error) {
//       logger.error('Email template loading failed:', error);
//       return this.getDefaultTemplate(data);
//     }
//   }
  
//   // Default email template
//   getDefaultTemplate(data) {
//     return `
//       <!DOCTYPE html>
//       <html>
//       <head>
//         <meta charset="utf-8">
//         <title>E-commerce Platform</title>
//       </head>
//       <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
//         <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
//           <h2 style="color: #2c3e50;">Hello ${data.name || 'User'},</h2>
//           <p>${data.message || 'Thank you for using our platform.'}</p>
//           <p>Best regards,<br>The E-commerce Team</p>
//         </div>
//       </body>
//       </html>
//     `;
//   }
  
//   // Send email
//   async sendEmail({ to, subject, template, data, html, text }) {
//     try {
//       const emailOptions = {
//         from: `${process.env.EMAIL_FROM_NAME} <${process.env.EMAIL_FROM}>`,
//         to,
//         subject
//       };
      
//       if (template) {
//         emailOptions.html = this.loadTemplate(template, data);
//       } else if (html) {
//         emailOptions.html = html;
//       } else if (text) {
//         emailOptions.text = text;
//       } else {
//         emailOptions.html = this.getDefaultTemplate(data);
//       }
      
//       const info = await this.transporter.sendMail(emailOptions);
//       logger.info(`Email sent: ${info.messageId}`);
//       return info;
//     } catch (error) {
//       logger.error('Email sending failed:', error);
//       throw error;
//     }
//   }
  
//   // Send welcome email
//   async sendWelcomeEmail(user) {
//     return this.sendEmail({
//       to: user.email,
//       subject: 'Welcome to Our E-commerce Platform!',
//       template: 'welcome',
//       data: {
//         name: user.firstName,
//         email: user.email
//       }
//     });
//   }
  
//   // Send order confirmation email
//   async sendOrderConfirmation(order, user) {
//     return this.sendEmail({
//       to: user.email,
//       subject: `Order Confirmation - ${order.orderNumber}`,
//       template: 'order-confirmation',
//       data: {
//         name: user.firstName,
//         orderNumber: order.orderNumber,
//         total: order.pricing.total,
//         items: order.items,
//         shippingAddress: order.shippingAddress
//       }
//     });
//   }
  
//   // Send order status update email
//   async sendOrderStatusUpdate(order, user) {
//     return this.sendEmail({
//       to: user.email,
//       subject: `Order Update - ${order.orderNumber}`,
//       template: 'order-status-update',
//       data: {
//         name: user.firstName,
//         orderNumber: order.orderNumber,
//         status: order.status,
//         trackingNumber: order.shipping.trackingNumber
//       }
//     });
//   }
// }

// export default new EmailService();
// export const sendEmail = (options) => new EmailService().sendEmail(options);