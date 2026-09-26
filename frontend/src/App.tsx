import React, { useState } from "react";
import { Header, ActiveTab } from "./components/Header";
import { LandingView } from "./components/LandingView";
import { ChatView } from "./components/ChatView";
import { ProductAnalyzerView } from "./components/ProductAnalyzerView";
import { IPRNavigatorView } from "./components/IPRNavigatorView";
import { TraditionalKnowledgeView } from "./components/TraditionalKnowledgeView";
import { ResearchView } from "./components/ResearchView";
import { WorkspaceView } from "./components/WorkspaceView";
import { HelpDeskView } from "./components/HelpDeskView";
import { AdminView } from "./components/AdminView";
import { LoginView } from "./components/LoginView";
import { RegisterView } from "./components/RegisterView";
import { ProfileView } from "./components/ProfileView";
import { ExpertAdvisoryView } from "./components/ExpertAdvisoryView";
import { CitationModal } from "./components/CitationModal";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { GuidedTour } from "./components/GuidedTour";
import { Citation, normalizeRole } from "./types";
import { LegalPolicyModal, LegalDocument } from "./components/LegalPolicyModal";
import { LanguageProvider, useTranslation } from "./context/LanguageContext";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { NotificationProvider } from "./context/NotificationContext";
import { ExpertAdvisoryProvider } from "./context/ExpertAdvisoryContext";
import { ThemeProvider } from "./context/ThemeContext";

const TOUR_STORAGE_KEY = "ipsakti_guided_tour_status";

function AppContent() {
  const [activeTab, setActiveTab] = useState<ActiveTab>("landing");
  const [isTourActive, setIsTourActive] = useState(false);
  const { currentLanguage, setLanguage, t } = useTranslation();
  const [activeCitation, setActiveCitation] = useState<Citation | null>(null);
  const [legalDocument, setLegalDocument] = useState<LegalDocument | null>(null);
  const [pendingGrievance, setPendingGrievance] = useState<{
    conversationId?: string;
    messageId?: string;
    query?: string;
    response?: string;
  } | null>(null);

  const handleRaiseGrievance = (context: {
    conversationId?: string;
    messageId?: string;
    query?: string;
    response?: string;
  }) => {
    setPendingGrievance(context);
    setActiveTab("workspace");
  };
  const { isLoggedIn, currentUser } = useAuth();
  const isExpert =
    isLoggedIn && currentUser && normalizeRole(currentUser.role) === "Expert";

  // Helper to render current active view
  const renderCurrentView = () => {
    // Public views always accessible when logged out, unless guided tour is active
    if (!isLoggedIn && !isTourActive) {
      if (activeTab === "login") {
        return (
          <LoginView setActiveTab={setActiveTab} targetTabAfterLogin="chat" />
        );
      }
      if (activeTab === "register") {
        return <RegisterView setActiveTab={setActiveTab} />;
      }
      return (
        <LandingView
          setActiveTab={setActiveTab}
          onOpenWalkthrough={handleStartTour}
        />
      );
    }

    // Role-specific enforcement: Legal Expert only sees flagged low-confidence queries
    if (isExpert && !isTourActive) {
      if (activeTab === "landing") {
        return (
          <LandingView
            setActiveTab={setActiveTab}
            onOpenWalkthrough={handleStartTour}
            onRaiseGrievance={() => handleRaiseGrievance({})}
          />
        );
      }
      if (activeTab === "helpdesk") {
        return <HelpDeskView setActiveTab={setActiveTab} onRaiseGrievance={() => { setActiveTab("expert"); window.setTimeout(() => window.dispatchEvent(new CustomEvent("ipsakti:open-expert-grievances")), 0); }} onOpenLegal={(doc) => setLegalDocument(doc)} />;
      }
      if (activeTab === "profile") {
        return <ProfileView setActiveTab={setActiveTab} />;
      }
      return (
        <ExpertAdvisoryView
          onOpenCitation={(cite) => setActiveCitation(cite)}
        />
      );
    }

    // Standard views for Practitioners, Researchers, Organizations & Admins
    switch (activeTab) {
      case "landing":
        return (
          <LandingView
            setActiveTab={setActiveTab}
            onOpenWalkthrough={handleStartTour}
            onRaiseGrievance={() => handleRaiseGrievance({})}
          />
        );
      case "chat":
        return (
          <ChatView
            language={currentLanguage}
            onOpenCitation={(cite) => setActiveCitation(cite)}
            onRaiseGrievance={handleRaiseGrievance}
          />
        );
      case "product":
        return (
          <ProductAnalyzerView
            onOpenCitation={(cite) => setActiveCitation(cite)}
          />
        );
      case "ipr":
        return (
          <IPRNavigatorView
            onOpenCitation={(cite) => setActiveCitation(cite)}
          />
        );
      case "tk":
        return (
          <TraditionalKnowledgeView
            onOpenCitation={(cite) => setActiveCitation(cite)}
          />
        );
      case "research":
        return (
          <ResearchView onOpenCitation={(cite) => setActiveCitation(cite)} />
        );
      case "helpdesk":
        return <HelpDeskView setActiveTab={setActiveTab} onRaiseGrievance={() => handleRaiseGrievance({})} onOpenLegal={(doc) => setLegalDocument(doc)} />;
      case "workspace":
        return (
          <WorkspaceView
            setActiveTab={setActiveTab}
            openGrievanceOnLoad={pendingGrievance}
            onGrievanceOpened={() => setPendingGrievance(null)}
          />
        );
      case "admin":
        return <AdminView />;
      case "profile":
        return <ProfileView setActiveTab={setActiveTab} />;
      case "expert":
        return (
          <ExpertAdvisoryView
            onOpenCitation={(cite) => setActiveCitation(cite)}
          />
        );
      default:
        return <LandingView setActiveTab={setActiveTab} />;
    }
  };

  function handleStartTour(): void {
    setIsTourActive(true);
  }

  function handleCompleteTour(): void {
    setIsTourActive(false);
    window.localStorage.setItem(TOUR_STORAGE_KEY, "completed");
  }

  function handleSkipTour(): void {
    setIsTourActive(false);
    window.localStorage.setItem(TOUR_STORAGE_KEY, "skipped");
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans antialiased selection:bg-emerald-100 dark:selection:bg-emerald-900 selection:text-emerald-900 dark:selection:text-emerald-100 w-full overflow-x-hidden transition-colors">
      {/* Primary Application Header */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        language={currentLanguage}
        setLanguage={setLanguage}
        onOpenWalkthrough={handleStartTour}
        isTourActive={isTourActive}
      />

      {/* Main Viewport Container */}
      <div className={`flex-1 w-full min-w-0 ${activeTab === "landing" ? "pt-0" : "pt-14 xl:pt-24"} pb-20 xl:pb-0`}>
        <ErrorBoundary key={activeTab} onReset={() => setActiveTab("landing")}>
          <main className="w-full max-w-[1800px] mx-auto min-w-0">
            {renderCurrentView()}
          </main>
        </ErrorBoundary>
      </div>

      {/* Citation Inspector Modal */}
      <CitationModal
        citation={activeCitation}
        onClose={() => setActiveCitation(null)}
      />

      {/* Interactive In-Product Guided Tour */}
      <GuidedTour
        isOpen={isTourActive}
        activeTab={activeTab}
        onNavigateTab={(tab) => setActiveTab(tab)}
        onComplete={handleCompleteTour}
        onSkip={handleSkipTour}
      />

      <LegalPolicyModal document={legalDocument} onClose={() => setLegalDocument(null)} />

      {/* Government-style footer: structured, compact and responsive. */}
      <footer className="w-full bg-slate-950 text-slate-200 border-t border-slate-800 mt-auto mb-14 lg:mb-0">
        <div className="w-full max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-9">
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-[1.25fr_1fr_1fr_1.15fr] gap-7 lg:gap-9">
            <div className="min-w-0">
              <div className="flex items-start gap-3">
                <div className="w-11 h-11 flex items-center justify-center rounded-lg bg-white p-1.5 shrink-0">
                  <img src="/ip-sakti-logo.png" alt="IP-SAKTI logo" className="w-full h-full object-contain" />
                </div>
                <div className="min-w-0">
                  <h2 className="font-serif font-bold text-white text-lg">IP-SAKTI Sahayak</h2>
                  <p className="text-xs sm:text-sm text-slate-300 mt-1">AYUSH & Traditional Knowledge IPR Research Platform</p>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-slate-400">
                <span>AI-assisted research</span>
                <span>•</span>
                <span>Source-aware decision support</span>
                <span>•</span>
                <span>Verify current official sources</span>
              </div>
            </div>

            <div>
              <h3 className="text-xs font-bold uppercase tracking-[0.14em] text-white mb-3">Useful Links</h3>
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                {[
                  ["Home", "landing"],
                  ["Sahayak AI", "chat"],
                  ["Product Analyzer", "product"],
                  ["IPR Navigator", "ipr"],
                  ["TK & ABS", "tk"],
                  ["Research", "research"],
                  ["HelpDesk", "helpdesk"],
                  ...(isLoggedIn ? [["My Workspace", "workspace"]] : []),
                ].map(([label, tab]) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setActiveTab(tab as ActiveTab)}
                    className="text-left text-slate-300 hover:text-white hover:underline transition-colors"
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-xs font-bold uppercase tracking-[0.14em] text-white mb-3">Policies & Support</h3>
              <div className="flex flex-col gap-2 text-sm">
                <button type="button" onClick={() => setLegalDocument("terms")} className="text-left text-slate-300 hover:text-white hover:underline">Terms & Conditions</button>
                <button type="button" onClick={() => setLegalDocument("privacy")} className="text-left text-slate-300 hover:text-white hover:underline">Privacy Policy</button>
                <button type="button" onClick={() => setActiveTab("helpdesk")} className="text-left text-slate-300 hover:text-white hover:underline">Feedback & Contact</button>
                <button type="button" onClick={() => setActiveTab("helpdesk")} className="text-left text-slate-300 hover:text-white hover:underline">Help / FAQs</button>
              </div>
            </div>

            <div className="min-w-0">
              <h3 className="text-xs font-bold uppercase tracking-[0.14em] text-white mb-3">Platform</h3>
              <div className="flex flex-wrap gap-x-3 gap-y-1.5 text-xs text-slate-300">
                <span>India-aware research</span>
                <span>•</span>
                <span>International coverage</span>
                <span>•</span>
                <span>Multilingual assistance</span>
                <span>•</span>
                <span>Evidence-grounded workflows</span>
              </div>
            </div>
          </div>

          <div className="mt-7 pt-4 border-t border-slate-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-[11px] text-slate-400">
            <span>© {new Date().getFullYear()} IP-SAKTI Sahayak</span>
            <span>For information and decision support; verify current official sources before action.</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <LanguageProvider>
        <AuthProvider>
          <NotificationProvider>
            <ExpertAdvisoryProvider>
              <AppContent />
            </ExpertAdvisoryProvider>
          </NotificationProvider>
        </AuthProvider>
      </LanguageProvider>
    </ThemeProvider>
  );
}
