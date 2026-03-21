import { Link } from 'react-router-dom';
import { Shield, ArrowLeft } from 'lucide-react';

export default function PrivacyPage() {
  const lastUpdated = 'March 20, 2026';

  return (
    <div className="min-h-screen bg-slate-950 text-slate-300">
      {/* Header */}
      <div className="border-b border-slate-800 bg-slate-900/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center gap-4">
          <Link to="/" className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm">
            <ArrowLeft className="w-4 h-4" />
            Volver
          </Link>
          <div className="h-4 w-px bg-slate-700" />
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-blue-600 rounded-md flex items-center justify-center">
              <Shield className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-semibold text-white text-sm">ClienteLoop</span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-6 py-16">
        <div className="mb-12">
          <h1 className="text-4xl font-bold text-white mb-4">Privacy Policy</h1>
          <p className="text-slate-400">Last updated: {lastUpdated}</p>
        </div>

        <div className="space-y-10 text-slate-300 leading-relaxed">

          <section>
            <h2 className="text-xl font-semibold text-white mb-4">1. Introduction</h2>
            <p>
              ClienteLoop ("we," "our," or "us") is committed to protecting your personal information and your right to privacy.
              This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our
              CRM platform, including connections to WhatsApp Business API, Google OAuth, and other integrated services.
            </p>
            <p className="mt-3">
              By using ClienteLoop, you agree to the collection and use of information in accordance with this policy.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-4">2. Information We Collect</h2>
            <h3 className="text-base font-medium text-slate-200 mb-2">2.1 Account Information</h3>
            <ul className="list-disc list-inside space-y-1 text-slate-400 ml-2">
              <li>Name, email address, and password (encrypted)</li>
              <li>Business name, phone number, and industry/niche</li>
              <li>Profile information provided during onboarding</li>
            </ul>

            <h3 className="text-base font-medium text-slate-200 mb-2 mt-4">2.2 WhatsApp Business Data</h3>
            <ul className="list-disc list-inside space-y-1 text-slate-400 ml-2">
              <li>WhatsApp Business Account ID and Phone Number ID</li>
              <li>Message content sent and received through the WhatsApp Business API</li>
              <li>Contact information of people who message your business</li>
              <li>Media files (images, audio, documents) exchanged in conversations</li>
            </ul>

            <h3 className="text-base font-medium text-slate-200 mb-2 mt-4">2.3 Usage Data</h3>
            <ul className="list-disc list-inside space-y-1 text-slate-400 ml-2">
              <li>Log data including IP address, browser type, pages visited, and timestamps</li>
              <li>Feature usage patterns (anonymized) to improve the product</li>
              <li>Error reports for debugging purposes</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-4">3. How We Use Your Information</h2>
            <p>We use the information we collect to:</p>
            <ul className="list-disc list-inside space-y-2 text-slate-400 ml-2 mt-3">
              <li>Provide, operate, and maintain the ClienteLoop platform</li>
              <li>Process and manage your WhatsApp Business conversations</li>
              <li>Generate AI-powered insights and automated responses on your behalf</li>
              <li>Send transactional emails (subscription confirmations, receipts)</li>
              <li>Improve and personalize your experience</li>
              <li>Monitor and analyze usage patterns to improve performance</li>
              <li>Comply with legal obligations</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-4">4. WhatsApp Data & Meta Platform Policy</h2>
            <p>
              ClienteLoop connects to the <strong className="text-white">WhatsApp Business API</strong> provided by Meta Platforms, Inc.
              When you connect your WhatsApp Business Account to ClienteLoop:
            </p>
            <ul className="list-disc list-inside space-y-2 text-slate-400 ml-2 mt-3">
              <li>We access your WhatsApp messages solely to display them in your CRM inbox and trigger automated responses you configure</li>
              <li>We do not sell, share, or use WhatsApp message content for advertising purposes</li>
              <li>Message data is stored securely in your dedicated database instance</li>
              <li>You retain full ownership of your business data and conversations</li>
              <li>You can disconnect your WhatsApp account at any time from Settings › Channels</li>
            </ul>
            <p className="mt-3">
              Our use of WhatsApp data complies with{' '}
              <a href="https://www.whatsapp.com/legal/business-policy/" target="_blank" rel="noopener noreferrer"
                className="text-blue-400 hover:text-blue-300 underline">
                Meta's WhatsApp Business Policy
              </a>{' '}
              and the{' '}
              <a href="https://developers.facebook.com/policy/" target="_blank" rel="noopener noreferrer"
                className="text-blue-400 hover:text-blue-300 underline">
                Meta Platform Terms
              </a>.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-4">5. Data Sharing & Third Parties</h2>
            <p>We do not sell your personal data. We share data only with:</p>
            <ul className="list-disc list-inside space-y-2 text-slate-400 ml-2 mt-3">
              <li><strong className="text-white">Supabase</strong> — Database hosting and authentication</li>
              <li><strong className="text-white">Meta / WhatsApp</strong> — To deliver and receive messages via the Business API</li>
              <li><strong className="text-white">Stripe</strong> — Payment processing for subscriptions</li>
              <li><strong className="text-white">Anthropic (Claude)</strong> — AI processing for insights and auto-replies (no data is used to train models)</li>
              <li><strong className="text-white">Sentry</strong> — Error monitoring (anonymized stack traces only)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-4">6. Data Retention</h2>
            <p>
              We retain your data for as long as your account is active. You may request deletion of your account and
              associated data at any time by contacting us at{' '}
              <a href="mailto:privacidad@clienteloop.app" className="text-blue-400 hover:text-blue-300 underline">
                privacidad@clienteloop.app
              </a>.
              Upon account deletion, we will remove your personal data within 30 days, except where retention is
              required by law.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-4">7. Security</h2>
            <p>
              We implement industry-standard security measures including TLS encryption in transit, AES-256
              encryption at rest, JWT-based authentication, and role-based access control. However, no method of
              transmission over the internet is 100% secure.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-4">8. Your Rights</h2>
            <p>Depending on your location, you may have the right to:</p>
            <ul className="list-disc list-inside space-y-2 text-slate-400 ml-2 mt-3">
              <li>Access the personal data we hold about you</li>
              <li>Request correction of inaccurate data</li>
              <li>Request deletion of your data ("right to be forgotten")</li>
              <li>Object to or restrict certain processing</li>
              <li>Data portability (export your data in a machine-readable format)</li>
            </ul>
            <p className="mt-3">
              To exercise any of these rights, contact us at{' '}
              <a href="mailto:privacidad@clienteloop.app" className="text-blue-400 hover:text-blue-300 underline">
                privacidad@clienteloop.app
              </a>.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-4">9. Children's Privacy</h2>
            <p>
              ClienteLoop is not directed to individuals under the age of 18. We do not knowingly collect personal
              information from minors. If you believe a minor has provided us with personal data, please contact us immediately.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-4">10. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. We will notify you of significant changes by
              email or via an in-app notification. Continued use of ClienteLoop after changes constitutes acceptance
              of the new policy.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-4">11. Contact Us</h2>
            <p>If you have questions about this Privacy Policy, contact us at:</p>
            <div className="mt-4 p-4 bg-slate-800/50 rounded-xl border border-slate-700 space-y-1 text-slate-400">
              <p className="font-medium text-white">ClienteLoop</p>
              <p>Email: <a href="mailto:privacidad@clienteloop.app" className="text-blue-400 hover:text-blue-300">privacidad@clienteloop.app</a></p>
              <p>Website: <a href="https://clienteloop-8flu.vercel.app" className="text-blue-400 hover:text-blue-300">clienteloop-8flu.vercel.app</a></p>
            </div>
          </section>

        </div>

        {/* Footer */}
        <div className="mt-16 pt-8 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-slate-500">
          <p>© 2026 ClienteLoop. All rights reserved.</p>
          <div className="flex gap-6">
            <Link to="/privacy" className="hover:text-slate-300 transition-colors">Privacy Policy</Link>
            <Link to="/terms" className="hover:text-slate-300 transition-colors">Terms of Service</Link>
            <Link to="/" className="hover:text-slate-300 transition-colors">Home</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
