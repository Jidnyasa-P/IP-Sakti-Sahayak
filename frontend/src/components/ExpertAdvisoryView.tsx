import React, { useState, useEffect } from 'react';
import {
  Scale,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Send,
  User as UserIcon,
  Building2,
  Sparkles,
  ShieldAlert,
  ShieldCheck,
  FileText,
  Search,
  Filter,
  Check,
  ChevronRight,
  ExternalLink,
  BookOpen,
  HelpCircle,
  Award,
  RefreshCw,
  Plus,
  Bell,
  X
} from 'lucide-react';
import { LowConfidenceQuery, ExpertReview, UserRole, Citation } from '../types';
import { useExpertAdvisory } from '../context/ExpertAdvisoryContext';
import { useAuth } from '../context/AuthContext';
import { authFetch } from './auth/authStorage';

interface ExpertAdvisoryViewProps {
  onOpenCitation?: (citation: Citation) => void;
}

export const ExpertAdvisoryView: React.FC<ExpertAdvisoryViewProps> = ({ onOpenCitation }) => {
  const { queries, pendingCount, resolvedCount, resolveQuery, refreshQueries } = useExpertAdvisory();
  const { currentUser } = useAuth();

  const [selectedQueryId, setSelectedQueryId] = useState<string>(() => {
    return queries[0]?.id || '';
  });

  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'resolved'>('all');
  const [filterRole, setFilterRole] = useState<'all' | UserRole>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Legal advice drafting state
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [assessment, setAssessment] = useState<ExpertReview['assessment']>('Approved with Modifications');
  const [legalOpinion, setLegalOpinion] = useState<string>('');
  const [statutoryClauses, setStatutoryClauses] = useState<string>('');
  const [actionableGuidance, setActionableGuidance] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const [expertSection, setExpertSection] = useState<'queue' | 'workspace'>('queue');
  const [workspaceTab, setWorkspaceTab] = useState<'notifications' | 'grievances'>('notifications');
  const [expertGrievances, setExpertGrievances] = useState<any[]>([]);
  const [grievanceOpen, setGrievanceOpen] = useState(false);
  const [grievanceSubmitting, setGrievanceSubmitting] = useState(false);
  const [grievanceForm, setGrievanceForm] = useState({ subject: '', description: '' });

  const selectedQuery = queries.find(q => q.id === selectedQueryId) || queries[0];

  useEffect(() => {
    const openNotifications = () => {
      setExpertSection('workspace');
      setWorkspaceTab('notifications');
    };
    const openGrievances = () => {
      setExpertSection('workspace');
      setWorkspaceTab('grievances');
    };
    window.addEventListener('ipsakti:open-expert-notifications', openNotifications);
    window.addEventListener('ipsakti:open-expert-grievances', openGrievances);
    return () => {
      window.removeEventListener('ipsakti:open-expert-notifications', openNotifications);
      window.removeEventListener('ipsakti:open-expert-grievances', openGrievances);
    };
  }, []);

  useEffect(() => {
    if (expertSection !== 'workspace') return;
    authFetch('/api/workspace/grievances')
      .then(async (res) => (res.ok ? res.json() : []))
      .then((data) => setExpertGrievances(Array.isArray(data) ? data : []))
      .catch(() => setExpertGrievances([]));
  }, [expertSection]);

  const submitExpertGrievance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!grievanceForm.subject.trim() || !grievanceForm.description.trim()) return;
    setGrievanceSubmitting(true);
    try {
      const res = await authFetch('/api/workspace/grievances', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: 'Expert dashboard',
          subject: grievanceForm.subject.trim(),
          description: grievanceForm.description.trim(),
        }),
      });
      if (!res.ok) throw new Error('Unable to submit grievance.');
      const created = await res.json();
      setExpertGrievances((prev) => [created, ...prev]);
      setGrievanceForm({ subject: '', description: '' });
      setGrievanceOpen(false);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Unable to submit grievance.');
    } finally {
      setGrievanceSubmitting(false);
    }
  };

  // Initialize draft when switching queries
  const handleSelectQuery = (q: LowConfidenceQuery) => {
    setSelectedQueryId(q.id);
    setIsEditing(false);
    if (q.expert_review) {
      setAssessment(q.expert_review.assessment);
      setLegalOpinion(q.expert_review.legal_opinion);
      setStatutoryClauses(q.expert_review.statutory_clauses.join('\n'));
      setActionableGuidance(q.expert_review.actionable_guidance.join('\n'));
    } else {
      // Clear form
      setAssessment('Approved with Modifications');
      setLegalOpinion('');
      setStatutoryClauses('');
      setActionableGuidance('');
    }
  };

  // Filter queries
  const filteredQueries = queries.filter(q => {
    if (filterStatus === 'pending' && q.status === 'resolved') return false;
    if (filterStatus === 'resolved' && q.status !== 'resolved') return false;
    if (filterRole !== 'all' && q.inquirer_role !== filterRole) return false;
    if (searchQuery.trim()) {
      const s = searchQuery.toLowerCase();
      const matchTopic = q.topic.toLowerCase().includes(s);
      const matchQuery = q.query.toLowerCase().includes(s);
      const matchInquirer = q.inquirer_name.toLowerCase().includes(s);
      return matchTopic || matchQuery || matchInquirer;
    }
    return true;
  });

  // Pre-fill standard statutory advisory templates
  const applyTemplate = (type: 'tk_3p' | 'synergy_3e' | 'nba_form3' | 'tm_generic') => {
    if (type === 'tk_3p') {
      setAssessment('Section 3(p) Barred');
      setLegalOpinion(
        'Under Section 3(p) of the Patents Act, 1970, formulations containing classical Ayurvedic herbs recorded in public domain treatises (Charaka Samhita, Sushruta Samhita, AFI) are barred from patent grant as traditional knowledge. To establish patentability, the applicant must establish unexpected non-obvious clinical or pharmacological properties that cannot be deduced by a person skilled in the Ayurvedic art, along with an inventive extraction or purification process.'
      );
      setStatutoryClauses(
        'The Patents Act, 1970 — Section 3(p) (Statutory bar on Traditional Knowledge)\n' +
        'The Patents Act, 1970 — Section 2(1)(ja) (Inventive Step Definition)\n' +
        'CSIR-TKDL Prior Art Verification Guidelines Clause 4.2'
      );
      setActionableGuidance(
        '1. Refocus patent claims exclusively on the proprietary physical-chemical extraction process rather than the composition.\n' +
        '2. Conduct comparative in-vivo pharmacological studies against classical formulations to document unexpected synergy.\n' +
        '3. Secure trademark registration under Class 5 for brand protection.'
      );
    } else if (type === 'synergy_3e') {
      setAssessment('Requires Empirical Data');
      setLegalOpinion(
        'Under Section 3(e) of the Patents Act, 1970, combining multiple Ayurvedic botanical substances is deemed a mere admixture resulting only in aggregation of individual properties unless empirical comparative biological data demonstrates unexpected synergy (Combination Index CI < 1 using the Chou-Talalay method).'
      );
      setStatutoryClauses(
        'The Patents Act, 1970 — Section 3(e) (Prohibition of Mere Admixture)\n' +
        'CGPDTM Guidelines for Examination of Patent Applications in the Field of Pharmaceuticals'
      );
      setActionableGuidance(
        '1. Generate an isobologram and calculate the Combination Index (CI) at IC50/ED50 levels.\n' +
        '2. Submit comparative in-vitro efficacy data of the combination versus individual components in the complete specification.\n' +
        '3. Ensure data is generated before filing complete specification or filing foreign equivalents.'
      );
    } else if (type === 'nba_form3') {
      setAssessment('Approved with Modifications');
      setLegalOpinion(
        'Under Section 6(1) of the Biological Diversity Act, 2002 and Rule 18 of the Biological Diversity Rules, 2004, prior approval of the National Biodiversity Authority (NBA Form III) is a mandatory statutory prerequisite before obtaining any patent based on biological resources procured from India. Failure to obtain NBA approval will lead to rejection of patent grant under Section 10(4)(d)(ii) of the Patents Act and potential penal prosecution under Section 55 of the BD Act.'
      );
      setStatutoryClauses(
        'Biological Diversity Act, 2002 — Section 6(1) & Section 6(1A)\n' +
        'Biological Diversity Rules, 2004 — Rule 18 (Application for IP Rights Form III)\n' +
        'The Patents Act, 1970 — Section 10(4)(d)(ii) (Mandatory Source Disclosure)'
      );
      setActionableGuidance(
        '1. File Form III application immediately on the NBA e-portal (absefiling.nic.in) before Controller General examination.\n' +
        '2. Preserve raw herb procurement invoices and State Biodiversity Board (SBB) intimation receipts.\n' +
        '3. Execute the Benefit Sharing Agreement upon receiving the NBA approval letter.'
      );
    } else if (type === 'tm_generic') {
      setAssessment('Alternative IP Pathway');
      setLegalOpinion(
        'Classical Ayurvedic formulation names codified in the Ayurvedic Formulary of India (AFI) or Ayurvedic Pharmacopoeia (API) are generic and cannot be registered as monopolized trademarks under Section 9(1)(b) and Section 13 of the Trade Marks Act, 1999. The applicant is advised to create a distinctive composite coined trademark and include an express disclaimer on the classical herbal words.'
      );
      setStatutoryClauses(
        'Trade Marks Act, 1999 — Section 9(1)(b) & Section 13\n' +
        'Drugs and Cosmetics Act, 1940 — Section 3(a) (Ayurvedic Drugs Definition)'
      );
      setActionableGuidance(
        '1. File Form TM-A under Class 5 using a coined brand name prefix.\n' +
        '2. Insert standard disclaimer: "No exclusive right claimed to the generic Ayurvedic term."\n' +
        '3. Protect packaging trade dress under the Designs Act, 2000.'
      );
    }
  };

  // Submit expert legal guidance
  const handleSubmitGuidance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedQuery) return;
    if (!legalOpinion.trim()) {
      alert('Please provide the official legal opinion before submitting.');
      return;
    }

    setIsSubmitting(true);

    const clauses = statutoryClauses
      .split('\n')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    const guidance = actionableGuidance
      .split('\n')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    const review: ExpertReview = {
      expert_id: currentUser?.id || 'user-expert-aarav',
      expert_name: currentUser?.name || 'Dr. Aarav Sharma',
      expert_title: 'Bio-Patent Attorney & IPR Legal Advisor (Bar Council D/1842/2012)',
      reviewed_at: new Date().toISOString(),
      assessment,
      legal_opinion: legalOpinion.trim(),
      statutory_clauses: clauses.length > 0 ? clauses : ['The Patents Act, 1970 — Section 3(p) & 3(e)'],
      actionable_guidance: guidance.length > 0 ? guidance : ['Review statutory constraints before proceeding.']
    };

    await resolveQuery(selectedQuery.id, review);
    setIsSubmitting(false);
    setIsEditing(false);
    setSuccessToast(`Official legal guidance has been dispatched for ${selectedQuery.inquirer_name}.`);
    setTimeout(() => setSuccessToast(null), 4000);
  };

  const getRoleBadge = (role: UserRole) => {
    switch (role) {
      case 'Practitioner':
        return 'bg-teal-100 text-teal-900 border-teal-200';
      case 'Researcher':
        return 'bg-blue-100 text-blue-900 border-blue-200';
      case 'Organization':
        return 'bg-amber-100 text-amber-900 border-amber-200';
      default:
        return 'bg-slate-100 text-slate-800 border-slate-200';
    }
  };

  const expertTypeName = ({ ayurveda: 'Ayurveda Expert', legal: 'Legal / IP Expert', regulatory: 'Regulatory Affairs Expert' } as Record<string, string>)[currentUser?.expert_type || ''] || 'Expert';

  return (
    <div className="w-full bg-slate-50 min-h-[calc(100vh-4rem)] p-3 sm:p-5 lg:p-6">
      <div className="max-w-7xl mx-auto space-y-4">
        <div className="bg-white border border-slate-300 rounded-2xl p-2 shadow-sm flex flex-wrap gap-2">
          <button type="button" onClick={() => setExpertSection('queue')} className={`px-4 py-2.5 rounded-xl text-xs font-semibold transition-colors ${expertSection === 'queue' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>
            Low-Confidence Queries
          </button>
          <button type="button" onClick={() => setExpertSection('workspace')} className={`px-4 py-2.5 rounded-xl text-xs font-semibold transition-colors ${expertSection === 'workspace' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>
            My Workspace
          </button>
        </div>

        {expertSection === 'workspace' ? (
          <div className="space-y-4">
            <div className="bg-white border border-slate-300 rounded-2xl p-5 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <p className="text-[10px] uppercase tracking-wider font-bold text-emerald-700">Expert Workspace</p>
                  <h1 className="text-xl font-serif font-bold text-slate-900 mt-1">My Workspace</h1>
                  <p className="text-xs text-slate-500 mt-1">Manage your notifications and grievances.</p>
                </div>
                <span className="text-xs font-semibold px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-900 border border-emerald-200">{expertTypeName}</span>
              </div>
            </div>

            <div className="flex border-b border-slate-300 gap-5 overflow-x-auto">
              <button type="button" onClick={() => setWorkspaceTab('notifications')} className={`pb-3 text-xs font-semibold border-b-2 ${workspaceTab === 'notifications' ? 'border-emerald-700 text-slate-900' : 'border-transparent text-slate-500'}`}>My Notifications ({queries.length})</button>
              <button type="button" onClick={() => setWorkspaceTab('grievances')} className={`pb-3 text-xs font-semibold border-b-2 ${workspaceTab === 'grievances' ? 'border-emerald-700 text-slate-900' : 'border-transparent text-slate-500'}`}>My Grievances ({expertGrievances.length})</button>
            </div>

            {workspaceTab === 'notifications' && (
              <div className="space-y-3">
                {queries.length === 0 ? (
                  <div className="py-14 text-center bg-white border border-slate-300 rounded-2xl">
                    <Bell className="w-8 h-8 mx-auto text-slate-300 mb-3" />
                    <p className="text-sm font-semibold text-slate-700">No notifications yet.</p>
                    <p className="text-xs text-slate-400 mt-1">Queries assigned to you will appear here.</p>
                  </div>
                ) : queries.map((q) => (
                  <button key={q.id} type="button" onClick={() => { setExpertSection('queue'); handleSelectQuery(q); }} className="w-full text-left bg-white border border-slate-300 rounded-2xl p-5 shadow-sm hover:border-emerald-400 transition-colors">
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                      <div>
                        <p className="text-[10px] uppercase tracking-wider font-bold text-emerald-700">New expert consultation</p>
                        <p className="text-sm font-semibold text-slate-900 mt-1">{q.query}</p>
                      </div>
                      <span className={`px-2 py-1 rounded-full text-[10px] font-semibold border ${q.status === 'resolved' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-amber-50 text-amber-800 border-amber-200'}`}>{q.status === 'resolved' ? 'Resolved' : 'Pending'}</span>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-3">{q.created_at ? new Date(q.created_at).toLocaleString() : ''}</p>
                  </button>
                ))}
              </div>
            )}

            {workspaceTab === 'grievances' && (
              <div className="space-y-4">
                <div className="bg-white border border-slate-300 rounded-2xl p-5 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div><h2 className="text-sm font-bold text-slate-900">My Grievances</h2><p className="text-xs text-slate-500 mt-1">View grievances you have submitted as an expert.</p></div>
                  <button type="button" onClick={() => setGrievanceOpen(true)} className="px-4 py-2.5 rounded-xl bg-emerald-800 text-white text-xs font-semibold hover:bg-emerald-900">Raise a Grievance</button>
                </div>
                {expertGrievances.length === 0 ? (
                  <div className="py-14 text-center bg-white border border-slate-300 rounded-2xl text-sm text-slate-500">No grievances have been submitted yet.</div>
                ) : expertGrievances.map((g) => (
                  <div key={g.id} className="bg-white border border-slate-300 rounded-2xl p-5 shadow-sm">
                    <div className="flex items-start justify-between gap-3"><div><p className="text-[10px] uppercase tracking-wider font-bold text-slate-500">{g.category}</p><h3 className="text-sm font-semibold text-slate-900 mt-1">{g.subject}</h3></div><span className="text-[10px] px-2 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-800 font-semibold">{g.status}</span></div>
                    <p className="text-xs text-slate-600 mt-3 whitespace-pre-wrap">{g.description}</p>
                  </div>
                ))}
                {grievanceOpen && (
                  <div className="fixed inset-0 z-[90] bg-slate-950/45 flex items-center justify-center p-4">
                    <form onSubmit={submitExpertGrievance} className="w-full max-w-lg bg-white rounded-2xl border border-slate-300 shadow-2xl p-5 space-y-4">
                      <div className="flex items-center justify-between"><h2 className="text-base font-bold text-slate-900">Raise a Grievance</h2><button type="button" onClick={() => setGrievanceOpen(false)} className="p-2 text-slate-400 hover:text-slate-700"><X className="w-5 h-5" /></button></div>
                      <input required value={grievanceForm.subject} onChange={(e) => setGrievanceForm({ ...grievanceForm, subject: e.target.value })} placeholder="Subject" className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm" />
                      <textarea required rows={5} value={grievanceForm.description} onChange={(e) => setGrievanceForm({ ...grievanceForm, description: e.target.value })} placeholder="Describe your grievance" className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm resize-y" />
                      <div className="flex justify-end gap-2"><button type="button" onClick={() => setGrievanceOpen(false)} className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-semibold">Cancel</button><button type="submit" disabled={grievanceSubmitting} className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-semibold disabled:opacity-60">{grievanceSubmitting ? 'Submitting...' : 'Submit Grievance'}</button></div>
                    </form>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <>
        {/* Success Toast Banner */}
        {successToast && (
          <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-xl text-xs font-medium text-emerald-950 flex items-center justify-between shadow-xs animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
              <span>{successToast}</span>
            </div>
            <button
              type="button"
              onClick={() => setSuccessToast(null)}
              className="text-emerald-700 hover:text-emerald-900 text-xs font-bold px-2 py-0.5"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Legal Advisor Console Header */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 shadow-2xs">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1.5 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-semibold bg-emerald-100 text-emerald-900 border border-emerald-300">
                  <Scale className="w-3.5 h-3.5 text-emerald-800" />
                  Legal Advisor Console
                </span>
                <span className="text-xs text-slate-500 font-medium">
                  Authoritative Statutory Dispute Resolution
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-serif font-bold text-slate-900">
                Low-Confidence Inquiries & Legal Advisory Queue
              </h1>
              <p className="text-xs sm:text-sm text-slate-600 max-w-3xl leading-relaxed">
                As an IPR Legal Advisor, review queries flagged with low AI confidence or statutory ambiguity submitted by AYUSH Practitioners, Researchers, and Organizations. Provide verified legal commentary, statutory clause interpretations, and actionable filing directives.
              </p>
            </div>

            {/* Quick Stats Banner */}
            <div className="flex items-center gap-3 shrink-0 self-start md:self-auto bg-slate-50 border border-slate-200 rounded-xl p-3">
              <div className="text-center px-3 border-r border-slate-200">
                <div className="text-lg font-bold text-amber-700">{pendingCount}</div>
                <div className="text-[10px] font-semibold text-slate-600 uppercase tracking-wider">Pending Review</div>
              </div>
              <div className="text-center px-3">
                <div className="text-lg font-bold text-emerald-700">{resolvedCount}</div>
                <div className="text-[10px] font-semibold text-slate-600 uppercase tracking-wider">Resolved</div>
              </div>
            </div>
          </div>
        </div>

        {/* Queue Filters & Search */}
        <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-2xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Status Tabs */}
          <div className="flex flex-wrap items-center gap-1.5 w-full md:w-auto">
            <button
              type="button"
              onClick={() => setFilterStatus('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                filterStatus === 'all'
                  ? 'bg-slate-900 text-white font-semibold'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              All Inquiries ({queries.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterStatus('pending')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 ${
                filterStatus === 'pending'
                  ? 'bg-amber-100 text-amber-950 font-bold border border-amber-300'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Clock className="w-3 h-3 text-amber-700" />
              <span>Pending Review ({pendingCount})</span>
            </button>
            <button
              type="button"
              onClick={() => setFilterStatus('resolved')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 ${
                filterStatus === 'resolved'
                  ? 'bg-emerald-100 text-emerald-950 font-bold border border-emerald-300'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <CheckCircle2 className="w-3 h-3 text-emerald-700" />
              <span>Resolved ({resolvedCount})</span>
            </button>
          </div>

          {/* Role Filter and Search */}
          <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 w-full md:w-auto">
            <div className="flex items-center gap-1 text-xs text-slate-500">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <span>Role:</span>
              <select
                value={filterRole}
                onChange={e => setFilterRole(e.target.value as any)}
                className="bg-slate-50 border border-slate-200 rounded-lg text-xs px-2 py-1 text-slate-700 font-medium focus:outline-hidden focus:border-emerald-700"
              >
                <option value="all">All Roles</option>
                <option value="Practitioner">Practitioners</option>
                <option value="Researcher">Researchers</option>
                <option value="Organization">Organizations</option>
              </select>
            </div>

            <div className="relative flex-1 md:w-56">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search queries, herbs..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 placeholder:text-slate-400 focus:outline-hidden focus:border-emerald-700"
              />
            </div>

            <button
              type="button"
              onClick={() => refreshQueries()}
              title="Refresh Queue"
              className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg border border-slate-200"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Master-Detail Split Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
          {/* Left Column: Flagged Queries List (5 cols) */}
          <div className="lg:col-span-5 space-y-2.5">
            <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-500 px-1">
              <span>Flagged Inquiries Queue ({filteredQueries.length})</span>
              <span className="text-[10px] font-semibold text-amber-700">Only Low Confidence</span>
            </div>

            {filteredQueries.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center space-y-2">
                <ShieldCheck className="w-8 h-8 text-emerald-600 mx-auto" />
                <h3 className="text-sm font-semibold text-slate-800">All Flagged Inquiries Handled</h3>
                <p className="text-xs text-slate-500">
                  No matching low-confidence queries requiring expert review with the current filters.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5 max-h-[750px] overflow-y-auto pr-1">
                {filteredQueries.map(q => {
                  const isSelected = selectedQuery?.id === q.id;
                  const isPending = q.status !== 'resolved';

                  return (
                    <div
                      key={q.id}
                      onClick={() => handleSelectQuery(q)}
                      className={`p-3.5 sm:p-4 rounded-xl border transition-all cursor-pointer text-left relative ${
                        isSelected
                          ? 'bg-emerald-50/50 border-emerald-700 ring-1 ring-emerald-700 shadow-sm'
                          : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/70'
                      }`}
                    >
                      {/* Top Inquirer & Status Header */}
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${getRoleBadge(q.inquirer_role)} shrink-0`}>
                            {q.inquirer_role}
                          </span>
                          <span className="text-xs font-semibold text-slate-900 truncate">
                            {q.inquirer_name}
                          </span>
                        </div>

                        {isPending ? (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 border border-amber-300 shrink-0 flex items-center gap-1">
                            <Clock className="w-2.5 h-2.5 text-amber-700" />
                            <span>Pending</span>
                          </span>
                        ) : (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-900 border border-emerald-300 shrink-0 flex items-center gap-1">
                            <Check className="w-2.5 h-2.5 text-emerald-700" />
                            <span>Resolved</span>
                          </span>
                        )}
                      </div>

                      {/* Organization & Date */}
                      {q.inquirer_organization && (
                        <div className="text-[11px] text-slate-500 flex items-center gap-1 mb-2 truncate">
                          <Building2 className="w-3 h-3 text-slate-400 shrink-0" />
                          <span className="truncate">{q.inquirer_organization}</span>
                        </div>
                      )}

                      {/* Topic Title */}
                      <h4 className="text-xs font-bold text-slate-900 line-clamp-1 mb-1">
                        {q.topic}
                      </h4>

                      {/* Query snippet */}
                      <p className="text-[11px] text-slate-600 line-clamp-2 leading-relaxed mb-2.5">
                        "{q.query}"
                      </p>

                      {/* Low Confidence Reason Pill */}
                      <div className="pt-2 border-t border-slate-100/80 flex items-center justify-between text-[10px]">
                        <div className="flex items-center gap-1.5 text-rose-700 font-semibold bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                          <AlertTriangle className="w-3 h-3 text-rose-600 shrink-0" />
                          <span>Confidence: Low ({q.ai_response.confidence.score})</span>
                        </div>
                        <span className="text-slate-400">
                          {new Date(q.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right Column: Case Dossier & Legal Guidance Form (7 cols) */}
          <div className="lg:col-span-7">
            {selectedQuery ? (
              <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 shadow-2xs space-y-6">
                {/* Dossier Header */}
                <div className="pb-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${getRoleBadge(selectedQuery.inquirer_role)}`}>
                        {selectedQuery.inquirer_role}
                      </span>
                      <span className="text-xs font-semibold text-slate-700">
                        {selectedQuery.inquirer_organization || 'Independent Inquiry'}
                      </span>
                      <span className="text-slate-300">•</span>
                      <span className="text-xs text-slate-500">
                        Case #{selectedQuery.id}
                      </span>
                    </div>
                    <h2 className="text-base sm:text-lg font-bold text-slate-900">
                      {selectedQuery.topic}
                    </h2>
                  </div>

                  <div className="shrink-0 flex items-center gap-2">
                    {selectedQuery.status === 'resolved' ? (
                      <span className="px-3 py-1 rounded-lg text-xs font-semibold bg-emerald-100 text-emerald-950 border border-emerald-300 flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                        <span>Guidance Provided</span>
                      </span>
                    ) : (
                      <span className="px-3 py-1 rounded-lg text-xs font-semibold bg-amber-100 text-amber-950 border border-amber-300 flex items-center gap-1.5 animate-pulse">
                        <Clock className="w-3.5 h-3.5 text-amber-700" />
                        <span>Awaiting Legal Advisor</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Block 1: Inquirer's Verbatim Query */}
                <div className="space-y-1.5">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                    <UserIcon className="w-3.5 h-3.5 text-slate-500" />
                    <span>Inquirer's Statutory Query ({selectedQuery.inquirer_name})</span>
                  </h3>
                  <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 leading-relaxed font-serif italic">
                    "{selectedQuery.query}"
                  </div>
                </div>

                {/* Block 2: AI's Preliminary Response & Why It Was Flagged Low Confidence */}
                <div className="space-y-2.5 p-4 rounded-xl bg-amber-50/40 border border-amber-200/80">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-amber-700" />
                      <span className="text-xs font-bold text-amber-950 uppercase tracking-wider">
                        Initial AI Evaluation (Flagged Low Confidence)
                      </span>
                    </div>
                    <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-900 border border-rose-300 text-[10px] font-bold flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3 text-rose-700" />
                      Confidence Score: {selectedQuery.ai_response.confidence.score}
                    </span>
                  </div>

                  <p className="text-xs text-slate-700 leading-relaxed">
                    {selectedQuery.ai_response.content}
                  </p>

                  {/* Why Flagged */}
                  <div className="pt-2 border-t border-amber-200/60">
                    <div className="text-[11px] font-semibold text-rose-900 mb-1 flex items-center gap-1">
                      <ShieldAlert className="w-3.5 h-3.5 text-rose-700" />
                      <span>Statutory Ambiguity & Reasons Flagged for Legal Advisor:</span>
                    </div>
                    <ul className="space-y-1">
                      {selectedQuery.ai_response.confidence.reasons.map((r, i) => (
                        <li key={i} className="text-xs text-rose-800 flex items-start gap-1.5">
                          <span className="text-rose-600 font-bold shrink-0">•</span>
                          <span>{r}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Preliminary Citations */}
                  {selectedQuery.ai_response.citations && selectedQuery.ai_response.citations.length > 0 && (
                    <div className="pt-2 border-t border-amber-200/60">
                      <div className="text-[11px] font-semibold text-slate-700 mb-1.5">
                        Related Statutory Provisions Identified:
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {selectedQuery.ai_response.citations.map((c, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => onOpenCitation?.(c)}
                            className="px-2.5 py-1 rounded-lg bg-white hover:bg-emerald-50 border border-slate-300 hover:border-emerald-400 text-slate-800 text-[11px] font-medium flex items-center gap-1.5 transition-colors group"
                          >
                            <FileText className="w-3 h-3 text-slate-500 group-hover:text-emerald-700" />
                            <span className="group-hover:text-emerald-950">{c.section}</span>
                            <ExternalLink className="w-2.5 h-2.5 text-slate-400 group-hover:text-emerald-700" />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Block 3: Expert Review Section (View or Edit) */}
                {selectedQuery.status === 'resolved' && !isEditing && selectedQuery.expert_review ? (
                  <div className="space-y-4 p-5 rounded-2xl bg-emerald-50/40 border border-emerald-300">
                    <div className="flex items-center justify-between pb-3 border-b border-emerald-200 flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <Award className="w-5 h-5 text-emerald-800" />
                        <div>
                          <h3 className="text-xs font-bold text-emerald-950 uppercase tracking-wider">
                            Official Legal Advisory Guidance Dispatched
                          </h3>
                          <p className="text-[11px] text-emerald-800">
                            Signed by {selectedQuery.expert_review.expert_name} ({selectedQuery.expert_review.expert_title})
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => setIsEditing(true)}
                        className="px-3 py-1 bg-white hover:bg-emerald-100 border border-emerald-300 rounded-lg text-xs font-semibold text-emerald-900 transition-colors"
                      >
                        Revise Guidance
                      </button>
                    </div>

                    {/* Legal Assessment Verdict */}
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-slate-600">Legal Assessment:</span>
                      <span className="px-2.5 py-0.5 rounded-md text-xs font-bold bg-emerald-700 text-white shadow-2xs">
                        {selectedQuery.expert_review.assessment}
                      </span>
                      <span className="text-xs text-slate-400 ml-auto">
                        {new Date(selectedQuery.expert_review.reviewed_at).toLocaleString()}
                      </span>
                    </div>

                    {/* Legal Opinion */}
                    <div className="space-y-1">
                      <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                        Official Legal Opinion & Statutory Commentary:
                      </h4>
                      <p className="text-xs text-slate-800 leading-relaxed whitespace-pre-line bg-white p-3.5 rounded-xl border border-emerald-200">
                        {selectedQuery.expert_review.legal_opinion}
                      </p>
                    </div>

                    {/* Statutory Clauses Cited */}
                    <div className="space-y-1.5">
                      <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                        Statutory Clauses & Case Law Cited:
                      </h4>
                      <div className="space-y-1">
                        {selectedQuery.expert_review.statutory_clauses.map((clause, idx) => (
                          <div
                            key={idx}
                            className="text-xs text-slate-800 flex items-start gap-2 bg-white px-3 py-1.5 rounded-lg border border-emerald-200"
                          >
                            <Scale className="w-3.5 h-3.5 text-emerald-700 shrink-0 mt-0.5" />
                            <span>{clause}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Actionable Guidance */}
                    <div className="space-y-1.5">
                      <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                        Directives & Action Steps for Inquirer:
                      </h4>
                      <div className="space-y-1">
                        {selectedQuery.expert_review.actionable_guidance.map((step, idx) => (
                          <div
                            key={idx}
                            className="text-xs text-slate-800 flex items-start gap-2 bg-white px-3 py-1.5 rounded-lg border border-emerald-200"
                          >
                            <span className="font-bold text-emerald-800 shrink-0">{idx + 1}.</span>
                            <span>{step.replace(/^\d+\.\s*/, '')}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Drafting Form for Legal Advisor */
                  <form onSubmit={handleSubmitGuidance} className="space-y-4 pt-2 border-t border-slate-200">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-100 flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <Scale className="w-4 h-4 text-emerald-800" />
                        <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                          {isEditing ? 'Revise Legal Guidance' : 'Draft Official Legal Guidance'}
                        </h3>
                      </div>
                      <span className="text-xs text-slate-500">
                        Advisor: <span className="font-semibold text-slate-900">{currentUser?.name || 'Dr. Aarav Sharma'}</span>
                      </span>
                    </div>

                    {/* Statutory Templates Quick-Select */}
                    <div className="space-y-1.5">
                      <div className="text-[11px] font-semibold text-slate-600 flex items-center gap-1">
                        <BookOpen className="w-3 h-3 text-slate-400" />
                        <span>Insert Authoritative Guidance Template:</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => applyTemplate('tk_3p')}
                          className="px-2.5 py-1 text-xs bg-slate-100 hover:bg-emerald-50 hover:text-emerald-900 border border-slate-200 rounded-lg transition-colors"
                        >
                          Section 3(p) TK Bar Precedent
                        </button>
                        <button
                          type="button"
                          onClick={() => applyTemplate('synergy_3e')}
                          className="px-2.5 py-1 text-xs bg-slate-100 hover:bg-emerald-50 hover:text-emerald-900 border border-slate-200 rounded-lg transition-colors"
                        >
                          Section 3(e) Synergistic Assay Criteria
                        </button>
                        <button
                          type="button"
                          onClick={() => applyTemplate('nba_form3')}
                          className="px-2.5 py-1 text-xs bg-slate-100 hover:bg-emerald-50 hover:text-emerald-900 border border-slate-200 rounded-lg transition-colors"
                        >
                          NBA Form III Clearance Sequencing
                        </button>
                        <button
                          type="button"
                          onClick={() => applyTemplate('tm_generic')}
                          className="px-2.5 py-1 text-xs bg-slate-100 hover:bg-emerald-50 hover:text-emerald-900 border border-slate-200 rounded-lg transition-colors"
                        >
                          Section 13 Generic Trademark Disclaimer
                        </button>
                      </div>
                    </div>

                    {/* Assessment Type */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Statutory Assessment Finding
                      </label>
                      <select
                        value={assessment}
                        onChange={e => setAssessment(e.target.value as any)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 font-medium focus:outline-hidden focus:border-emerald-700"
                      >
                        <option value="Approved with Modifications">Approved with Modifications (Proceed with Caveats)</option>
                        <option value="Section 3(p) Barred">Section 3(p) Barred (Traditional Knowledge Absolute Hurdle)</option>
                        <option value="Alternative IP Pathway">Alternative IP Pathway (Recommend Trade Mark / Trade Dress)</option>
                        <option value="Requires Empirical Data">Requires Empirical Data (Section 3(e) Assay Mandatory)</option>
                      </select>
                    </div>

                    {/* Formal Legal Opinion */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Authoritative Legal Opinion & Statutory Rationale
                      </label>
                      <textarea
                        rows={5}
                        required
                        value={legalOpinion}
                        onChange={e => setLegalOpinion(e.target.value)}
                        placeholder="Detail the legal analysis under Patents Act, Trade Marks Act, or Biological Diversity Act..."
                        className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:border-emerald-700 leading-relaxed font-sans"
                      />
                    </div>

                    {/* Statutory Clauses Cited */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Statutory Clauses & Gazette Citations (one per line)
                      </label>
                      <textarea
                        rows={2}
                        value={statutoryClauses}
                        onChange={e => setStatutoryClauses(e.target.value)}
                        placeholder="e.g. The Patents Act, 1970 — Section 3(p)&#10;Biological Diversity Act, 2002 — Section 6(1)"
                        className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:border-emerald-700 font-mono text-[11px]"
                      />
                    </div>

                    {/* Actionable Directives */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Actionable Guidance for Inquirer (one step per line)
                      </label>
                      <textarea
                        rows={3}
                        value={actionableGuidance}
                        onChange={e => setActionableGuidance(e.target.value)}
                        placeholder="1. File provisional application under Patents Form 1...&#10;2. Apply for NBA Form III prior to foreign filing...&#10;3. Conduct Chou-Talalay combination assay."
                        className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:border-emerald-700"
                      />
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                      {isEditing && (
                        <button
                          type="button"
                          onClick={() => setIsEditing(false)}
                          className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
                        >
                          Cancel
                        </button>
                      )}
                      <button
                        type="submit"
                        disabled={isSubmitting}
                        className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold shadow-xs flex items-center gap-2 transition-colors cursor-pointer"
                      >
                        {isSubmitting ? (
                          <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <>
                            <Send className="w-3.5 h-3.5" />
                            <span>Sign & Dispatch Legal Guidance</span>
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            ) : (
              <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center text-slate-400 space-y-2">
                <Scale className="w-10 h-10 mx-auto text-slate-300" />
                <p className="text-sm font-medium text-slate-600">No inquiry selected</p>
                <p className="text-xs text-slate-400">Select an inquiry from the queue on the left to inspect and draft legal guidance.</p>
              </div>
            )}
          </div>
        </div>
        </>
        )}
      </div>
    </div>
  );
};
