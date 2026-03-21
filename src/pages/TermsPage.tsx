import { Link } from 'react-router-dom';
import { FileText, ArrowLeft } from 'lucide-react';

export default function TermsPage() {
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
              <FileText className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-semibold text-white text-sm">ClienteLoop</span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-6 py-16">
        <div className="mb-12">
          <h1 className="text-4xl font-bold text-white mb-4">Terms of Service</h1>
          <p className="text-slate-400">Last updated: {lastUpdated}</p>
        </div>

        <div className="space-y-10 text-slate-300 leading-relaxed">

          <section>
            <h2 className="text-xl font-semibold text-white mb-4">1. Acceptance of Terms</h2>
            <p>
              By accessing or using ClienteLoop ("the Service"), you agree to be bound by these Terms of Service.
              If you disagree with any part of these terms, you may not access the Service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-4">2. Description of Service</h2>
            <p>
              ClienteLoop is a customer relationship management (CRM) platform that enables businesses to manage
              customer communications, automate responses via WhatsApp Business API, track sales pipelines,
              and generate AI-powered business insights.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-4">3. Accounts and Registration</h2>
            <ul className="list-disc list-inside space-y-2 text-slate-400 ml-2">
              <li>You must provide accurate and complete information when creating an account</li>
              <li>You are responsible for maintaining the security of your account credentials</li>
              <li>You must be at least 18 years old to use this Service</li>
              <li>One account per user; you may not share accounts</li>
              <li>You are responsible for all activities that occur under your account</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-4">4. Subscription Plans and Billing</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border border-slate-700 rounded-xl overflow-hidden">
                <thead>
                  <tr className="bg-slate-800 text-slate-200">
                    <th className="text-left p-3">Plan</th>
                    <th className="text-left p-3">Price</th>
                    <th className="text-left p-3">Businesses</th>
                    <th className="text-left p-3">Users</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/50">
                  <tr className="bg-slate-900/30">
                    <td className="p-3 text-white font-medium">Starter</td>
                    <td className="p-3">$99/month</td>
                    <td className="p-3">1 business</td>
                    <td className="p-3">3 users</td>
                  </tr>
                  <tr className="bg-slate-900/30">
                    <td className="p-3 text-white font-medium">Pro</td>
                    <td className="p-3">$149/month</td>
                    <td className="p-3">3 businesses</td>
                    <td className="p-3">5 users</td>
                  </tr>
                  <tr className="bg-slate-900/30">
                    <td className="p-3 text-white font-medium">Agency</td>
                    <td className="p-3">$249/month</td>
                    <td className="p-3">Unlimited</td>
                    <td className="p-3">10 users</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <ul className="list-disc list-inside space-y-2 text-slate-400 ml-2 mt-4">
              <li>Subscriptions are billed monthly and renew automatically</li>
              <li>Payments are processed securely via Stripe</li>
              <li>You may cancel your subscription at any time from Settings › Billing</li>
              <li>Cancellations take effect at the end of the current billing period</li>
              <li>No refunds are issued for partial billing periods</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-4">5. Acceptable Use</h2>
            <p>You agree NOT to use ClienteLoop to:</p>
            <ul className="list-disc list-inside space-y-2 text-slate-400 ml-2 mt-3">
              <li>Send spam, unsolicited messages, or bulk marketing without user consent</li>
              <li>Violate WhatsApp's Business Policy or Meta's Platform Terms</li>
              <li>Transmit illegal, harassing, or fraudulent content</li>
              <li>Attempt to reverse-engineer, hack, or disrupt the platform</li>
              <li>Sell, resell, or sublicense access to the Service without authorization</li>
              <li>Violate any applicable local, national, or international laws</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-4">6. WhatsApp Business API Usage</h2>
            <p>
              Use of WhatsApp features within ClienteLoop is subject to{' '}
              <a href="https://www.whatsapp.com/legal/business-policy/" target="_blank" rel="noopener noreferrer"
                className="text-blue-400 hover:text-blue-300 underline">
                Meta's WhatsApp Business Policy
              </a>.
              You are responsible for ensuring that your use of WhatsApp messaging complies with all applicable
              regulations, including obtaining proper consent from recipients before sending marketing messages.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-4">7. Intellectual Property</h2>
            <p>
              The ClienteLoop platform, including its design, code, and branding, is the exclusive property of
              ClienteLoop. You retain ownership of all content and data you input into the platform.
              By using the Service, you grant us a limited license to process your data solely to provide the Service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-4">8. Limitation of Liability</h2>
            <p>
              ClienteLoop is provided "as is" without warranties of any kind. To the fullest extent permitted by law,
              we shall not be liable for any indirect, incidental, special, consequential, or punitive damages,
              including loss of profits, data, or business opportunities arising from your use of the Service.
            </p>
            <p className="mt-3">
              Our total liability to you for any claims arising from these Terms shall not exceed the amount you
              paid us in the three months preceding the claim.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-4">9. Termination</h2>
            <p>
              We reserve the right to suspend or terminate your account at any time if you violate these Terms.
              You may terminate your account at any time from Settings. Upon termination, your data will be
              retained for 30 days before permanent deletion, unless deletion is requested immediately.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-4">10. Changes to Terms</h2>
            <p>
              We may modify these Terms at any time. We will provide at least 14 days notice before material changes
              take effect. Continued use of the Service after changes constitutes acceptance of the new Terms.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-4">11. Governing Law</h2>
            <p>
              These Terms shall be governed by the laws of the applicable jurisdiction. Any disputes shall first
              be attempted to be resolved through good-faith negotiation before any formal proceedings.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-4">12. Contact</h2>
            <p>For questions about these Terms, contact us at:</p>
            <div className="mt-4 p-4 bg-slate-800/50 rounded-xl border border-slate-700 space-y-1 text-slate-400">
              <p className="font-medium text-white">ClienteLoop</p>
              <p>Email: <a href="mailto:legal@clienteloop.app" className="text-blue-400 hover:text-blue-300">legal@clienteloop.app</a></p>
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
