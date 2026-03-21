import React from "react";

const s = {
  wrap: { padding: "4rem 1rem", maxWidth: 800, margin: "0 auto", fontFamily: "'DM Sans', sans-serif" },
  title: { fontSize: 32, fontWeight: 700, color: "#f0f0f0", marginBottom: "1rem" },
  date: { fontSize: 14, color: "#666", marginBottom: "3rem" },
  section: { marginBottom: "3rem" },
  h2: { fontSize: 20, fontWeight: 600, color: "#f0f0f0", marginBottom: "1rem", borderBottom: "0.5px solid #2a2a2a", paddingBottom: "0.5rem" },
  p: { fontSize: 16, color: "#aaa", lineHeight: 1.6, marginBottom: "1rem" },
  list: { paddingLeft: "1.5rem", marginBottom: "1rem" },
  li: { fontSize: 16, color: "#aaa", lineHeight: 1.6, marginBottom: "0.5rem" },
  backBtn: { background: "none", border: "1px solid #2a2a2a", color: "#888", padding: "8px 16px", borderRadius: 8, cursor: "pointer", marginBottom: "2rem", fontSize: 14, display: "flex", alignItems: "center", gap: 8 }
};

export default function PrivacyPolicy({ onBack }) {
  return (
    <div style={s.wrap}>
      {onBack && (
        <button style={s.backBtn} onClick={onBack}>
          ← Back
        </button>
      )}
      <h1 style={s.title}>Privacy Policy</h1>
      <p style={s.date}>Last updated: March 21, 2026</p>

      <section style={s.section}>
        <h2 style={s.h2}>1. Introduction</h2>
        <p style={s.p}>
          Welcome to MailFlow ("we," "our," or "us"). We are committed to protecting your privacy. This Privacy Policy explains how we collect, use, and safeguard your information when you use our website and services.
        </p>
      </section>

      <section style={s.section}>
        <h2 style={s.h2}>2. Information We Collect</h2>
        <p style={s.p}>
          In order to provide our email automation services, we collect limited personal and system information:
        </p>
        <ul style={s.list}>
          <li style={s.li}><strong>Account Information:</strong> Your name, email address, and profile picture provided via Google OAuth or Firebase Authentication.</li>
          <li style={s.li}><strong>Google User Data:</strong> With your explicit consent, we access your Gmail account to send emails and read Google Sheets to fetch campaign data.</li>
          <li style={s.li}><strong>Usage Data:</strong> Information about how you interact with our platform (e.g., campaign logs, feature usage).</li>
        </ul>
      </section>

      <section style={s.section}>
        <h2 style={s.h2}>3. Use of Google Scopes</h2>
        <p style={s.p}>
          MailFlow's use and transfer to any other app of information received from Google APIs will adhere to <a href="https://developers.google.com/terms/api-services-user-data-policy#additional_requirements_for_specific_api_scopes" target="_blank" style={{color: "#f0f0f0"}}>Google API Services User Data Policy</a>, including the Limited Use requirements.
        </p>
        <p style={s.p}>
          We use your data strictly for:
        </p>
        <ul style={s.list}>
          <li style={s.li}>Sending emails on your behalf via the Gmail API.</li>
          <li style={s.li}>Reading recipient data from your Google Sheets.</li>
          <li style={s.li}>Providing a dashboard to track your email campaigns.</li>
        </ul>
      </section>

      <section style={s.section}>
        <h2 style={s.h2}>4. Data Security</h2>
        <p style={s.p}>
          We implement industry-standard security measures to protect your data. All communication between your browser and our servers is encrypted using SSL/TLS. We do not store your Google account password; all authentication is handled via OAuth tokens.
        </p>
      </section>

      <section style={s.section}>
        <h2 style={s.h2}>5. Data Retention</h2>
        <p style={s.p}>
          We retain your information as long as your account is active or as needed to provide you services. You may request the deletion of your account and associated data at any time through our settings page.
        </p>
      </section>

      <section style={s.section}>
        <h2 style={s.h2}>6. Third-Party Services</h2>
        <p style={s.p}>
          We use Firebase (Google Cloud) for authentication and data hosting. These services have their own privacy policies which we recommend you review.
        </p>
      </section>

      <section style={s.section}>
        <h2 style={s.h2}>7. Contact Us</h2>
        <p style={s.p}>
          If you have any questions about this Privacy Policy, please contact us at support@mailflow.app.
        </p>
      </section>
    </div>
  );
}
