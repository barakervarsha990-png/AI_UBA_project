require('dotenv').config();

if (process.argv.includes('--ethereal')) {
  process.env.SMTP_SERVICE = 'ethereal';
}

const { sendTestEmail, getSmtpStatus } = require('./services/emailService');

const recipientArg = process.argv.slice(2).find((arg) => !arg.startsWith('--'));
const targetRecipient = recipientArg || process.env.ALERT_EMAIL_TO;

console.log('===============================================================');
console.log('   SENTINEL EMAIL NOTIFICATION DIAGNOSTICS & VERIFIER          ');
console.log('===============================================================\n');

const status = getSmtpStatus();
console.log('Current SMTP Configuration Status:');
console.log(`  - Configured:       ${status.configured ? 'YES' : 'NO'}`);
console.log(`  - Service Mode:     ${status.isEthereal ? 'Ethereal Test Mailbox' : 'Standard SMTP'}`);
console.log(`  - SMTP Server:      ${status.host}:${status.port} (secure=${status.secure})`);
console.log(`  - Sender Account:   ${status.user || 'None'}`);
console.log(`  - Recipient:        ${targetRecipient || 'None'}`);
console.log(`  - Password Length:  ${status.passLength} chars ${status.isGmailAppPassFormat !== null ? (status.isGmailAppPassFormat ? '(16-char App Password)' : '(WARNING: Gmail requires exactly 16 characters)') : ''}`);
console.log(`  - Self-Signed TLS:  ${status.allowSelfSigned ? 'Allowed (antivirus bypass enabled)' : 'Strict'}\n`);

console.log(`Attempting test email delivery to: ${targetRecipient}...`);

sendTestEmail(targetRecipient)
  .then((res) => {
    if (res.success) {
      console.log('\n✅ EMAIL ACCEPTED SUCCESSFULLY BY SMTP SERVER!');
      console.log(`  - Message ID: ${res.messageId}`);
      console.log(`  - Recipient:  ${res.recipient}`);
      if (res.previewUrl) {
        console.log(`  - Online Preview Link: ${res.previewUrl}`);
      }
      process.exit(0);
    } else {
      console.error('\n❌ EMAIL DELIVERY FAILED:');
      console.error(`  - Error Code: ${res.code || 'UNKNOWN'}`);
      console.error(`  - Message:    ${res.error}`);
      if (res.hint) {
        console.error(`\n💡 TROUBLESHOOTING HINT:\n    ${res.hint}\n`);
      }
      process.exit(1);
    }
  })
  .catch((err) => {
    console.error('\n❌ UNEXPECTED ERROR:', err);
    process.exit(1);
  });