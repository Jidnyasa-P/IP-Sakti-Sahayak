import React, { useState } from 'react';
import {
  Sparkles,
  FlaskConical,
  Compass,
  BookOpen,
  ArrowRight,
  ShieldCheck,
  LogIn,
  UserPlus,
  CheckCircle2,
  HelpCircle,
  Users,
  Scale,
  Globe2,
  Send,
  Mail,
  FileText,
  AlertTriangle,
  ChevronDown,
} from 'lucide-react';
import { ActiveTab } from './Header';
import { DisclaimerBanner } from './DisclaimerBanner';
import { useTranslation } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { authFetch } from './auth/authStorage';
import { OfficialPartnersCarousel } from './OfficialPartnersCarousel';

interface LandingViewProps {
  setActiveTab: (tab: ActiveTab) => void;
  onOpenWalkthrough?: () => void;
  onRaiseGrievance?: () => void;
}

export const LandingView: React.FC<LandingViewProps> = ({
  setActiveTab,
  onOpenWalkthrough,
  onRaiseGrievance,
}) => {
  const { t } = useTranslation();
  const { currentUser, isLoggedIn } = useAuth();

  const [contactSent, setContactSent] = useState(false);
  const [contactError, setContactError] = useState<string | null>(null);
  const [contactSending, setContactSending] = useState(false);
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);

  const handleActionClick = (targetTab: ActiveTab) => {
    if (isLoggedIn) {
      setActiveTab(targetTab);
    } else {
      setActiveTab('login');
    }
  };

  const capabilities = [
    {
      id: 'chat' as ActiveTab,
      title: t('landing.cap_ask_title', 'Ask'),
      description: t('landing.cap_ask_desc', 'Ask questions about IPR, AYUSH and regulatory topics.'),
      icon: Sparkles,
      tag: t('landing.tag_grounded', 'Grounded Assistant'),
    },
    {
      id: 'product' as ActiveTab,
      title: t('landing.cap_prod_title', 'Analyze'),
      description: t('landing.cap_prod_desc', 'Understand product classification and relevant considerations.'),
      icon: FlaskConical,
      tag: t('landing.tag_ayurvedic', 'Ayurvedic Classification'),
    },
    {
      id: 'ipr' as ActiveTab,
      title: t('landing.cap_ipr_title', 'Navigate'),
      description: t('landing.cap_ipr_desc', 'Explore possible intellectual-property protection pathways.'),
      icon: Compass,
      tag: t('landing.tag_strategy', 'IP Strategy'),
    },
    {
      id: 'research' as ActiveTab,
      title: t('landing.cap_res_title', 'Research'),
      description: t('landing.cap_res_desc', 'Find relevant information from authoritative sources.'),
      icon: BookOpen,
      tag: t('landing.tag_library', 'Statutory Library'),
    },
  ];

  const handleContactSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setContactError(null);
    setContactSent(false);
    setContactSending(true);
    const form = event.currentTarget;
    const data = new FormData(form);
    try {
      const res = await authFetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: data.get('name'), email: data.get('email'), subject: data.get('subject'), message: data.get('message')
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || 'We could not send your message. Please try again.');
      }
      setContactSent(true);
      form.reset();
    } catch (err) {
      setContactError(err instanceof Error ? err.message : 'We could not send your message.');
    } finally {
      setContactSending(false);
    }
  };

  return (
    <div className="w-full overflow-hidden">
      {/* Hero */}
      <section className="landing-screen-section relative isolate overflow-hidden px-4 sm:px-6 lg:px-8 py-8 sm:py-10 lg:py-12 flex items-center snap-start">
        <div
          className="absolute inset-0 -z-20 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: "url('/landing-section-1-knowledge.png')" }}
          aria-hidden="true"
        />
        <div className="absolute inset-0 -z-10 bg-white/58 dark:bg-slate-950/62" />
        
        <div className="max-w-6xl mx-auto w-full">
          <div className="text-center lg:text-left lg:pl-2">
            <div className="inline-flex items-center gap-2 px-3.5 py-2 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-semibold tracking-wide shadow-sm dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-200">
              <ShieldCheck className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
              <span>{t('landing.badge', 'Authoritative AYUSH & Intellectual Property Decision Support')}</span>
            </div>

            <h1 className="mt-8 sm:mt-10 text-4xl sm:text-5xl lg:text-6xl font-serif font-semibold tracking-tight leading-[1.05] text-slate-950 dark:text-white">
              IP-SAKTI <span className="text-emerald-700 dark:text-emerald-400">Sahayak</span>
            </h1>

            <p className="mt-5 max-w-[35rem] mx-auto lg:mx-0 text-base sm:text-lg text-slate-700 dark:text-slate-200 leading-relaxed">
              {t(
                'landing.hero_subtitle',
                'AI-powered assistance for AYUSH, intellectual property, traditional knowledge and regulatory research.'
              )}
            </p>

            <p className="mt-4 max-w-[28rem] mx-auto lg:mx-0 text-sm text-slate-700 dark:text-slate-200 leading-relaxed">
              One place to explore regulations, understand product pathways, research intellectual property and work with authoritative knowledge sources.
            </p>

            <div className="mt-7 flex flex-col sm:flex-row items-center lg:justify-start justify-center gap-3">
              {isLoggedIn ? (
                <>
                  <button
                    type="button"
                    onClick={() => handleActionClick('chat')}
                    className="w-full sm:w-auto px-6 py-3 rounded-xl bg-slate-950 hover:bg-emerald-900 text-white font-semibold text-sm transition-all shadow-lg shadow-slate-900/10 flex items-center justify-center gap-2 group"
                  >
                    <Sparkles className="w-4 h-4 text-emerald-300" />
                    <span>Open Sahayak</span>
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleActionClick('product')}
                    className="w-full sm:w-auto px-6 py-3 rounded-xl bg-white/90 dark:bg-slate-900 hover:bg-emerald-50 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-300 dark:border-slate-700 font-semibold text-sm transition-all flex items-center justify-center gap-2"
                  >
                    <FlaskConical className="w-4 h-4 text-emerald-700" />
                    Analyze a Product
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => setActiveTab('login')}
                    className="w-full sm:w-auto px-6 py-3 rounded-xl bg-slate-950 hover:bg-emerald-900 text-white font-semibold text-sm transition-all shadow-lg shadow-slate-900/10 flex items-center justify-center gap-2 group"
                  >
                    <LogIn className="w-4 h-4 text-amber-300" />
                    Sign In
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('register')}
                    className="w-full sm:w-auto px-6 py-3 rounded-xl bg-white/90 dark:bg-slate-900 hover:bg-emerald-50 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-300 dark:border-slate-700 font-semibold text-sm transition-all flex items-center justify-center gap-2"
                  >
                    <UserPlus className="w-4 h-4 text-emerald-700" />
                    Create Account
                  </button>
                </>
              )}

              {onOpenWalkthrough && (
                <button
                  type="button"
                  onClick={onOpenWalkthrough}
                  className="w-full sm:w-auto px-5 py-3 rounded-xl bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/50 text-emerald-900 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800 font-semibold text-sm transition-all flex items-center justify-center gap-2"
                >
                  <HelpCircle className="w-4 h-4" />
                  How to Use
                </button>
              )}
            </div>

            {isLoggedIn && currentUser ? (
              <div className="mt-5 inline-flex items-center gap-2 text-xs text-emerald-800 dark:text-emerald-300">
                <CheckCircle2 className="w-4 h-4" />
                Welcome back, <strong>{currentUser.name}</strong>. Your portal is ready.
              </div>
            ) : (
              <div className="mt-5 inline-flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                <Scale className="w-4 h-4 text-emerald-700" />
                Decision support grounded in legal and regulatory knowledge sources.
              </div>
            )}
          </div>

        </div>
      </section>

      {/* Capabilities */}
      <section className="landing-screen-section relative isolate overflow-hidden px-4 sm:px-6 lg:px-8 py-8 sm:py-10 flex items-center border-y border-slate-300 dark:border-slate-700 snap-start">
        <div
          className="absolute inset-0 -z-20 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: "url('/landing-section-2-science.png')" }}
          aria-hidden="true"
        />
        <div className="absolute inset-0 -z-10 bg-white/58 dark:bg-slate-950/64" />
        <div className="max-w-6xl mx-auto">
          <div className="max-w-2xl mb-8">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700 dark:text-emerald-400">Explore the platform</p>
            <h2 className="mt-2 text-2xl sm:text-3xl font-serif font-semibold text-slate-950 dark:text-white">Everything you need to move from question to informed action.</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {capabilities.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.title}
                  type="button"
                  onClick={() => handleActionClick(item.id)}
                  className="group text-left p-5 rounded-2xl bg-white/94 dark:bg-slate-900/94 border border-emerald-200 dark:border-emerald-900/70 hover:border-emerald-400 dark:hover:border-emerald-600 hover:-translate-y-1 transition-all shadow-sm hover:shadow-lg"
                >
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-4 bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 group-hover:bg-emerald-100 dark:group-hover:bg-emerald-900/50">
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="text-[11px] font-bold text-emerald-800 dark:text-emerald-400 tracking-wider uppercase mb-1">{item.tag}</div>
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{item.title}</h3>
                  <p className="mt-1.5 text-sm text-slate-800 dark:text-slate-100 leading-relaxed">{item.description}</p>
                  <span className="mt-5 inline-flex items-center text-xs font-semibold text-emerald-800 dark:text-emerald-400">
                    {isLoggedIn ? 'Open module' : 'Sign in to explore'}
                    <ArrowRight className="w-3.5 h-3.5 ml-1.5 group-hover:translate-x-1 transition-transform" />
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* FAQs */}
      <section id="faqs" className="landing-screen-section relative isolate overflow-hidden px-4 sm:px-6 lg:px-8 py-8 sm:py-10 flex items-center border-y border-slate-300 dark:border-slate-700 snap-start">
        <div
          className="absolute inset-0 -z-20 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: "url('/landing-section-3-ip.png')" }}
          aria-hidden="true"
        />
        <div className="absolute inset-0 -z-10 bg-white/58 dark:bg-slate-950/64" />
        <div className="max-w-4xl mx-auto">
          <div className="max-w-2xl mb-8">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700 dark:text-emerald-400">Frequently Asked Questions</p>
            <h2 className="mt-2 text-3xl sm:text-4xl font-serif font-semibold text-slate-950 dark:text-white">Common questions about IP-SAKTI Sahayak</h2>
            <p className="mt-3 text-sm sm:text-base text-slate-800 dark:text-slate-100 leading-relaxed">Find quick answers about the assistant, jurisdiction modes, expert consultation and the information you provide.</p>
          </div>

          <div className="space-y-3">
            {[
              {
                question: "What can I ask IP-SAKTI Sahayak?",
                answer: "You can ask about intellectual property, AYUSH regulations, traditional knowledge, biodiversity and related regulatory research. The assistant uses the selected jurisdiction and available authoritative sources to support its response.",
              },
              {
                question: "What is the difference between Indian and International jurisdiction?",
                answer: "Indian jurisdiction focuses on Indian statutes, authorities and requirements. International jurisdiction focuses on relevant global frameworks, treaties and foreign intellectual-property or regulatory contexts. Select the mode that matches your question.",
              },
              {
                question: "Can I upload a document or image with my question?",
                answer: "Yes. Supported documents can be read for relevant text, while supported images can be analyzed for readable text and other material details. The extracted attachment context can then be considered with your question.",
              },
              {
                question: "What happens when an answer has low confidence?",
                answer: "The chat can offer expert consultation for low-confidence cases. You can choose an Ayurveda Expert, Legal / IP Expert or Regulatory Affairs Expert so the request is routed according to the selected expert type.",
              },
              {
                question: "Is the answer a legal opinion or a substitute for professional advice?",
                answer: "No. IP-SAKTI Sahayak is a decision-support and research tool. Its responses should be checked against the cited sources and, where appropriate, reviewed by a qualified legal, regulatory or domain professional.",
              },
              {
                question: "Does the platform support multiple languages?",
                answer: "Yes. The interface and supported language workflow are designed for multilingual access, with the available language options shown in the application.",
              },
            ].map((faq, index) => {
              const isOpen = openFaqIndex === index;
              return (
                <div key={faq.question} className="rounded-xl border border-slate-300 bg-white dark:bg-slate-900 dark:border-slate-700 shadow-sm overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setOpenFaqIndex(isOpen ? null : index)}
                    className="w-full flex items-center justify-between gap-4 px-4 sm:px-5 py-4 text-left"
                    aria-expanded={isOpen}
                  >
                    <span className="flex items-center gap-3 text-sm font-semibold text-slate-900 dark:text-white">
                      <HelpCircle className="w-4 h-4 shrink-0 text-emerald-700 dark:text-emerald-400" />
                      {faq.question}
                    </span>
                    <ChevronDown className={`w-4 h-4 shrink-0 text-slate-500 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                  </button>
                  {isOpen && (
                    <div className="border-t border-slate-200 dark:border-slate-700 px-4 sm:px-5 py-4 text-sm leading-relaxed text-slate-800 dark:text-slate-100">
                      {faq.answer}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* About Us */}
      <section id="about-us" className="landing-screen-section relative isolate overflow-hidden px-4 sm:px-6 lg:px-8 py-8 sm:py-10 flex items-center snap-start">
        <div
          className="absolute inset-0 -z-20 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: "url('/landing-section-4-global.png')" }}
          aria-hidden="true"
        />
        <div className="absolute inset-0 -z-10 bg-white/58 dark:bg-slate-950/64" />
        <div className="max-w-6xl mx-auto grid lg:grid-cols-[0.8fr_1.2fr] gap-8 lg:gap-14 items-start">
          <div>
            <div className="w-12 h-12 rounded-2xl bg-emerald-100 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-300 flex items-center justify-center">
              <Users className="w-6 h-6" />
            </div>
            <p className="mt-5 text-xs font-bold uppercase tracking-[0.18em] text-emerald-700 dark:text-emerald-400">About Us</p>
            <h2 className="mt-2 text-3xl sm:text-4xl font-serif font-semibold text-slate-950 dark:text-white">Making complex IP & AYUSH information easier to navigate.</h2>
          </div>

          <div className="space-y-5 text-sm sm:text-base text-slate-900 dark:text-slate-100 leading-relaxed">
            <p className="font-bold text-emerald-900 dark:text-emerald-300">
              IP-SAKTI Sahayak is a decision-support platform designed for AYUSH innovators, researchers, practitioners, startups and institutions working with intellectual property and regulatory questions.
            </p>
            <p className="font-bold text-emerald-900 dark:text-emerald-300">
              The platform brings together AI-assisted question answering, product analysis, IPR navigation, traditional-knowledge research and statutory information in one workspace. Its goal is to reduce the friction between discovering relevant information and understanding how that information applies to a real-world idea or product.
            </p>
            <div className="grid sm:grid-cols-3 gap-3 pt-2">
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                <Scale className="w-5 h-5 text-emerald-700 mb-2" />
                <p className="text-sm font-semibold text-slate-900 dark:text-white">Source-aware</p>
                <p className="mt-1 text-xs text-slate-700 dark:text-slate-200">Designed around authoritative knowledge.</p>
              </div>
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                <Globe2 className="w-5 h-5 text-emerald-700 mb-2" />
                <p className="text-sm font-semibold text-slate-900 dark:text-white">Multilingual</p>
                <p className="mt-1 text-xs text-slate-700 dark:text-slate-200">Built for accessible research across languages.</p>
              </div>
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                <FileText className="w-5 h-5 text-emerald-700 mb-2" />
                <p className="text-sm font-semibold text-slate-900 dark:text-white">Decision support</p>
                <p className="mt-1 text-xs text-slate-700 dark:text-slate-200">Helps users investigate before they act.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Contact */}
      <section id="contact-us" className="px-4 sm:px-6 lg:px-8 py-14 sm:py-20 bg-slate-950 dark:bg-black text-white">
        <div className="max-w-6xl mx-auto grid lg:grid-cols-[0.8fr_1.2fr] gap-10 lg:gap-16">
          <div>
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 border border-emerald-400/30 text-emerald-300 flex items-center justify-center">
              <Mail className="w-6 h-6" />
            </div>
            <p className="mt-5 text-xs font-bold uppercase tracking-[0.18em] text-emerald-300">Contact Us</p>
            <h2 className="mt-2 text-3xl sm:text-4xl font-serif font-semibold">Have a question or want to work with us?</h2>
            <p className="mt-4 text-sm sm:text-base text-slate-300 leading-relaxed max-w-md">
              Share your query, feedback or collaboration idea. We will use your message to understand what you need from IP-SAKTI Sahayak.
            </p>
          </div>

          <form onSubmit={handleContactSubmit} className="rounded-2xl bg-white dark:bg-slate-900 p-5 sm:p-7 text-slate-900 dark:text-white shadow-2xl border border-slate-300 dark:border-slate-700">
            <div className="grid sm:grid-cols-2 gap-4">
              <label className="text-sm font-medium">
                Name
                <input required name="name" type="text" placeholder="Your name" className="mt-1.5 w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-3 text-sm outline-none focus:border-emerald-500" />
              </label>
              <label className="text-sm font-medium">
                Email
                <input required name="email" type="email" placeholder="you@example.com" className="mt-1.5 w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-3 text-sm outline-none focus:border-emerald-500" />
              </label>
            </div>

            <label className="block mt-4 text-sm font-medium">
              Subject
              <input required name="subject" type="text" placeholder="How can we help?" className="mt-1.5 w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-3 text-sm outline-none focus:border-emerald-500" />
            </label>

            <label className="block mt-4 text-sm font-medium">
              Message
              <textarea required name="message" rows={5} placeholder="Tell us a little about your question..." className="mt-1.5 w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-3 text-sm outline-none focus:border-emerald-500 resize-y" />
            </label>

            <div className="mt-5 flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                <button type="submit" disabled={contactSending} className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white px-5 py-3 text-sm font-semibold transition-colors disabled:opacity-60">
                  <Send className="w-4 h-4" />
                  {contactSending ? 'Sending...' : 'Send Message'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (isLoggedIn) onRaiseGrievance?.();
                    else setActiveTab('login');
                  }}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-300 bg-emerald-50 px-5 py-3 text-sm font-semibold text-emerald-900 transition hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200 dark:hover:bg-emerald-900/50"
                >
                  <AlertTriangle className="w-4 h-4" />
                  Raise a Grievance
                </button>
              </div>
              {contactError && (
                <span className="text-sm text-rose-300 font-medium">{contactError}</span>
              )}
              {contactSent && (
                <span className="text-sm text-emerald-700 dark:text-emerald-400 font-medium">
                  Thanks! Your message has been recorded for this session.
                </span>
              )}
            </div>
          </form>
        </div>
      </section>

      <div className="px-4 sm:px-6 lg:px-8 py-8">
        <div className="max-w-6xl mx-auto">
          <DisclaimerBanner />
        </div>
      </div>

      <OfficialPartnersCarousel links={[]} />
    </div>
  );
};
