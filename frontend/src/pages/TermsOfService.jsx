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

export default function TermsOfService({ onBack }) {
  return (
    <div style={s.wrap}>
      {onBack && (
        <button style={s.backBtn} onClick={onBack}>
          ← Back
        </button>
      )}
      <h1 style={s.title}>Terms of Service</h1>
      <p style={s.date}>Effective Date: March 21, 2026</p>

      <section style={s.section}>
        <h2 style={s.h2}>1. Acceptance of Terms</h2>
        <p style={s.p}>
          By accessing or using the MailFlow website ("Service"), you agree to be bound by these Terms of Service. If you do not agree, you must not use our Service.
        </p>
      </section>

      <section style={s.section}>
        <h2 style={s.h2}>2. Eligibility</h2>
        <p style={s.p}>
          You must be at least 18 years old to use the Service. By using MailFlow, you represent and warrant that you are eligible and have the legal capacity to enter into these Terms.
        </p>
      </section>

      <section style={s.section}>
        <h2 style={s.h2}>3. User Accounts & Responsibilities</h2>
        <p style={s.p}>
          You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account. You agree to:
        </p>
        <ul style={s.list}>
          <li style={s.li}>Provide accurate, current, and complete information during registration.</li>
          <li style={s.li}>Notify us immediately of any unauthorized use of your account.</li>
          <li style={s.li}>Ensure your use of our Service complies with all applicable laws and regulations.</li>
        </ul>
      </section>

      <section style={s.section}>
        <h2 style={s.h2}>4. Prohibited Conduct</h2>
        <p style={s.p}>
          You agree not to use the Service to:
        </p>
        <ul style={s.list}>
          <li style={s.li}>Send spam, unsolicited commercial emails, or any form of harassment.</li>
          <li style={s.li}>Violate the CAN-SPAM Act or other anti-spam regulations in your jurisdiction.</li>
          <li style={s.li}>Interfere with or disrupt the security of the Service or servers.</li>
          <li style={s.li}>Access data not intended for you or log into accounts you are not authorized to use.</li>
        </ul>
      </section>

      <section style={s.section}>
        <h2 style={s.h2}>5. Intellectual Property</h2>
        <p style={s.p}>
          All content, features, and functionality of the MailFlow Service are the exclusive property of MailFlow and are protected by international copyright, trademark, and other intellectual property laws.
        </p>
      </section>

      <section style={s.section}>
        <h2 style={s.h2}>6. Limitation of Liability</h2>
        <p style={s.p}>
          In no event shall MailFlow, its affiliates, or its licensors be liable for any indirect, incidental, special, or consequential damages arising out of your use of the Service. The Service is provided "as is" and "as available."
        </p>
      </section>

      <section style={s.section}>
        <h2 style={s.h2}>7. Termination</h2>
        <p style={s.p}>
          We reserve the right to suspend or terminate your access to the Service at our sole discretion, without notice, for any violation of these Terms.
        </p>
      </section>

      <section style={s.section}>
        <h2 style={s.h2}>8. Governing Law</h2>
        <p style={s.p}>
          These Terms shall be governed by and construed in accordance with the laws of the jurisdiction in which we operate, without regard to its conflict of law principles.
        </p>
      </section>

      <section style={s.section}>
        <h2 style={s.h2}>9. Changes to Terms</h2>
        <p style={s.p}>
          We reserve the right to modify these Terms at any time. We will provide notice of significant changes by posting the new Terms on our website. Your continued use of the Service after changes are posted constitutes your acceptance of the new Terms.
        </p>
      </section>

      <section style={s.section}>
        <h2 style={s.h2}>10. Contact Us</h2>
        <p style={s.p}>
          If you have any questions about these Terms of Service, please contact us at support@mailflow.app.
        </p>
      </section>
    </div>
  );
}
