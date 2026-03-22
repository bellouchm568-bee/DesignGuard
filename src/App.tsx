import React, { useState, useEffect } from 'react';
import { Shield, Search, Image as ImageIcon, History, LayoutDashboard, LogOut, LogIn, AlertTriangle, CheckCircle, Info, Trash2, ExternalLink } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useDropzone } from 'react-dropzone';
import ReactMarkdown from 'react-markdown';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

import { auth, signIn, signOut, subscribeToAnalyses, saveAnalysis, deleteAnalysis, type AnalysisRecord } from './lib/firebase';
import { analyzeText, analyzeImage, type TextAnalysisResult, type ImageAnalysisResult } from './lib/gemini';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Components ---

const RiskBadge = ({ level }: { level: 'low' | 'medium' | 'high' }) => {
  const styles = {
    low: 'risk-low',
    medium: 'risk-medium',
    high: 'risk-high'
  };
  return (
    <span className={cn("px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border", styles[level])}>
      {level} risk
    </span>
  );
};

const Card = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <div className={cn("bg-white brutal-border p-6", className)}>
    {children}
  </div>
);

// --- Main App ---

export default function App() {
  const [user, setUser] = useState(auth.currentUser);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'text' | 'image' | 'history'>('dashboard');
  const [analyses, setAnalyses] = useState<AnalysisRecord[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((u) => {
      setUser(u);
      if (u) {
        const sub = subscribeToAnalyses(u.uid, setAnalyses);
        return () => sub();
      } else {
        setAnalyses([]);
      }
    });
    return () => unsubscribe();
  }, []);

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg p-4">
        <Card className="max-w-md w-full text-center space-y-8">
          <div className="flex justify-center">
            <div className="w-20 h-20 bg-accent rounded-full flex items-center justify-center brutal-border">
              <Shield className="w-10 h-10 text-white" />
            </div>
          </div>
          <div>
            <h1 className="text-5xl font-display uppercase tracking-tighter mb-2">DesignGuard AI</h1>
            <p className="text-ink/60">Protect your POD business from copyright and trademark strikes.</p>
          </div>
          <button onClick={() => window.location.reload()} className="brutal-button w-full flex items-center justify-center gap-2">
            <LogIn className="w-5 h-5" />
            Enter as Guest
          </button>
          <p className="text-[10px] uppercase tracking-widest text-ink/40">
            Note: Using Local Storage for data persistence.
            <br />
            Legal Disclaimer: This tool provides risk analysis, not legal advice.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg flex flex-col md:flex-row">
      {/* Sidebar */}
      <aside className="w-full md:w-64 bg-white border-b-2 md:border-b-0 md:border-r-2 border-ink p-6 flex flex-col gap-8">
        <div className="flex items-center gap-3">
          <Shield className="w-8 h-8 text-accent" />
          <span className="font-display text-2xl uppercase tracking-tighter">DesignGuard</span>
        </div>

        <nav className="flex flex-col gap-2 flex-grow">
          <NavItem active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} icon={<LayoutDashboard />} label="Dashboard" />
          <NavItem active={activeTab === 'text'} onClick={() => setActiveTab('text')} icon={<Search />} label="Text Analysis" />
          <NavItem active={activeTab === 'image'} onClick={() => setActiveTab('image')} icon={<ImageIcon />} label="Image Analysis" />
          <NavItem active={activeTab === 'history'} onClick={() => setActiveTab('history')} icon={<History />} label="History" />
        </nav>

        <div className="pt-6 border-t-2 border-ink/10">
          <div className="flex items-center gap-3 mb-4">
            <img src={user.photoURL || ''} alt="" className="w-10 h-10 rounded-full border-2 border-ink" />
            <div className="overflow-hidden">
              <p className="font-bold truncate text-sm">{user.displayName}</p>
              <p className="text-xs text-ink/50 truncate">{user.email}</p>
            </div>
          </div>
          <button onClick={signOut} className="text-xs uppercase font-bold tracking-widest flex items-center gap-2 text-danger hover:opacity-70">
            <LogOut className="w-4 h-4" /> Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-grow p-4 md:p-10 overflow-y-auto">
        <AnimatePresence mode="wait">
          {activeTab === 'dashboard' && <Dashboard key="dash" analyses={analyses} onNavigate={setActiveTab} />}
          {activeTab === 'text' && <TextAnalyzer key="text" userId={user.uid} />}
          {activeTab === 'image' && <ImageAnalyzer key="img" userId={user.uid} />}
          {activeTab === 'history' && <HistoryView key="hist" analyses={analyses} />}
        </AnimatePresence>
      </main>
    </div>
  );
}

function NavItem({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 px-4 py-3 font-bold uppercase tracking-wider text-sm transition-all",
        active ? "bg-ink text-white" : "hover:bg-ink/5"
      )}
    >
      {React.cloneElement(icon as React.ReactElement<any>, { className: "w-5 h-5" })}
      {label}
    </button>
  );
}

// --- Dashboard ---

function Dashboard({ analyses, onNavigate }: { analyses: AnalysisRecord[]; onNavigate: (tab: any) => void }) {
  const recent = analyses.slice(0, 5);
  const stats = {
    total: analyses.length,
    highRisk: analyses.filter(a => a.riskLevel === 'high').length,
    mediumRisk: analyses.filter(a => a.riskLevel === 'medium').length,
    lowRisk: analyses.filter(a => a.riskLevel === 'low').length,
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-8">
      <header>
        <h2 className="text-6xl font-display uppercase tracking-tighter">Overview</h2>
        <p className="text-ink/60">Your design safety at a glance.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <StatCard label="Total Checks" value={stats.total} />
        <StatCard label="High Risk" value={stats.highRisk} color="text-danger" />
        <StatCard label="Medium Risk" value={stats.mediumRisk} color="text-warning" />
        <StatCard label="Safe Checks" value={stats.lowRisk} color="text-safe" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card className="space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="font-display text-2xl uppercase">Recent Activity</h3>
            <button onClick={() => onNavigate('history')} className="text-xs font-bold uppercase tracking-widest text-accent">View All</button>
          </div>
          <div className="space-y-4">
            {recent.length === 0 ? (
              <p className="text-ink/40 text-center py-8 italic">No analyses yet.</p>
            ) : (
              recent.map((a) => (
                <div key={a.id} className="flex items-center justify-between p-4 bg-bg border-2 border-ink/5">
                  <div className="flex items-center gap-3">
                    {a.type === 'text' ? <Search className="w-5 h-5" /> : <ImageIcon className="w-5 h-5" />}
                    <div>
                      <p className="font-bold text-sm truncate max-w-[150px]">{a.input}</p>
                      <p className="text-[10px] uppercase tracking-widest text-ink/40">{new Date(a.createdAt?.toDate()).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <RiskBadge level={a.riskLevel} />
                </div>
              ))
            )}
          </div>
        </Card>

        <Card className="bg-accent text-white space-y-6">
          <h3 className="font-display text-2xl uppercase">Quick Start</h3>
          <p className="text-white/80">Ready to check a new design? Choose an analysis type to begin.</p>
          <div className="flex flex-col gap-3">
            <button onClick={() => onNavigate('text')} className="bg-white text-ink px-6 py-4 font-display uppercase tracking-wider flex items-center justify-between hover:bg-white/90">
              Check Text <Search className="w-5 h-5" />
            </button>
            <button onClick={() => onNavigate('image')} className="bg-white text-ink px-6 py-4 font-display uppercase tracking-wider flex items-center justify-between hover:bg-white/90">
              Check Image <ImageIcon className="w-5 h-5" />
            </button>
          </div>
        </Card>
      </div>
    </motion.div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <Card className="flex flex-col justify-center items-center text-center py-8">
      <p className="text-[10px] uppercase font-bold tracking-[0.2em] text-ink/40 mb-1">{label}</p>
      <p className={cn("text-5xl font-display", color || "text-ink")}>{value}</p>
    </Card>
  );
}

// --- Text Analyzer ---

function TextAnalyzer({ userId }: { userId: string }) {
  const [input, setInput] = useState('');
  const [result, setResult] = useState<TextAnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);

  const handleAnalyze = async () => {
    if (!input.trim()) return;
    setLoading(true);
    try {
      const res = await analyzeText(input);
      setResult(res);
      await saveAnalysis({
        userId,
        type: 'text',
        input,
        result: res,
        riskLevel: res.riskLevel
      });
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-8 max-w-4xl">
      <header>
        <h2 className="text-6xl font-display uppercase tracking-tighter">Text Analysis</h2>
        <p className="text-ink/60">Scan titles, slogans, and keywords for trademarks.</p>
      </header>

      <Card className="space-y-4">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Enter your design title or slogan (e.g., 'Just Do It' or 'Star Wars Fan Art')"
          className="w-full h-32 p-4 brutal-border focus:outline-none focus:ring-2 focus:ring-accent/20 resize-none font-medium"
        />
        <button
          onClick={handleAnalyze}
          disabled={loading || !input.trim()}
          className="brutal-button w-full disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {loading ? "Analyzing..." : "Run Trademark Check"}
          {!loading && <Search className="w-5 h-5" />}
        </button>
      </Card>

      {result && (
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="space-y-6">
          <Card className={cn("border-l-8", result.riskLevel === 'high' ? 'border-l-danger' : result.riskLevel === 'medium' ? 'border-l-warning' : 'border-l-safe')}>
            <div className="flex justify-between items-start mb-6">
              <div>
                <h3 className="font-display text-3xl uppercase mb-1">Analysis Result</h3>
                <p className="text-sm text-ink/60">Confidence Score: High</p>
              </div>
              <div className="flex items-center gap-3">
                <button onClick={() => window.print()} className="text-xs font-bold uppercase tracking-widest text-accent flex items-center gap-1 hover:underline">
                  <ExternalLink className="w-3 h-3" /> Export Report
                </button>
                <RiskBadge level={result.riskLevel} />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-6">
                <div className="space-y-4">
                  <h4 className="font-bold uppercase text-xs tracking-widest text-ink/40">Risk Explanation</h4>
                  <div className="prose prose-sm max-w-none">
                    <ReactMarkdown>{result.explanation}</ReactMarkdown>
                  </div>
                </div>

                {result.similarity && (
                  <div className="p-4 bg-ink text-white brutal-border">
                    <h4 className="font-display text-xl uppercase mb-2">Similarity Check</h4>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs uppercase tracking-widest opacity-60">IP Match Score</span>
                      <span className={cn("font-display text-2xl", result.similarity.score > 70 ? "text-danger" : result.similarity.score > 30 ? "text-warning" : "text-safe")}>
                        {result.similarity.score}%
                      </span>
                    </div>
                    {result.similarity.match && (
                      <p className="text-xs opacity-80 italic">Closest Match: {result.similarity.match}</p>
                    )}
                  </div>
                )}
              </div>

              <div className="space-y-6">
                {result.problematicWords.length > 0 && (
                  <div className="space-y-3">
                    <h4 className="font-bold uppercase text-xs tracking-widest text-ink/40">Flagged Elements</h4>
                    <div className="flex flex-wrap gap-2">
                      {result.problematicWords.map((pw, i) => (
                        <div key={i} className="group relative">
                          <span className="px-3 py-1 bg-danger/10 text-danger border border-danger/20 rounded font-bold text-sm cursor-help">
                            {pw.word}
                          </span>
                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-ink text-white text-[10px] rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                            {pw.reason}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="space-y-3">
                  <h4 className="font-bold uppercase text-xs tracking-widest text-ink/40">Safe Alternatives & SEO Titles</h4>
                  <div className="space-y-2">
                    {result.safeAlternatives.map((alt, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm font-medium">
                        <CheckCircle className="w-4 h-4 text-safe" />
                        {alt}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </motion.div>
      )}
    </motion.div>
  );
}

// --- Image Analyzer ---

function ImageAnalyzer({ userId }: { userId: string }) {
  const [image, setImage] = useState<string | null>(null);
  const [result, setResult] = useState<ImageAnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);

  const onDrop = (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    const reader = new FileReader();
    reader.onload = () => {
      setImage(reader.result as string);
      setResult(null);
    };
    reader.readAsDataURL(file);
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': [] },
    multiple: false
  });

  const handleAnalyze = async () => {
    if (!image) return;
    setLoading(true);
    try {
      const base64 = image.split(',')[1];
      const mimeType = image.split(';')[0].split(':')[1];
      const res = await analyzeImage(base64, mimeType);
      setResult(res);
      await saveAnalysis({
        userId,
        type: 'image',
        input: 'Image Analysis',
        result: res,
        riskLevel: res.riskLevel
      });
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-8 max-w-4xl">
      <header>
        <h2 className="text-6xl font-display uppercase tracking-tighter">Image Analysis</h2>
        <p className="text-ink/60">Detect logos, characters, and copyrighted elements in your designs.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="space-y-4">
          <div
            {...getRootProps()}
            className={cn(
              "brutal-border bg-white h-64 flex flex-col items-center justify-center p-6 text-center cursor-pointer transition-colors",
              isDragActive ? "bg-accent/5 border-accent" : "hover:bg-bg"
            )}
          >
            <input {...getInputProps()} />
            {image ? (
              <img src={image} alt="Preview" className="h-full object-contain" />
            ) : (
              <>
                <ImageIcon className="w-12 h-12 text-ink/20 mb-4" />
                <p className="font-bold uppercase tracking-wider text-sm">Drag & Drop or Click to Upload</p>
                <p className="text-xs text-ink/40 mt-2">PNG, JPG up to 10MB</p>
              </>
            )}
          </div>
          <button
            onClick={handleAnalyze}
            disabled={loading || !image}
            className="brutal-button w-full disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? "Scanning Image..." : "Run Visual Check"}
            {!loading && <Shield className="w-5 h-5" />}
          </button>
        </div>

        <div className="space-y-6">
          {result ? (
            <Card className={cn("h-full border-l-8", result.riskLevel === 'high' ? 'border-l-danger' : result.riskLevel === 'medium' ? 'border-l-warning' : 'border-l-safe')}>
              <div className="flex justify-between items-center mb-6">
                <h3 className="font-display text-2xl uppercase">Visual Risk</h3>
                <RiskBadge level={result.riskLevel} />
              </div>
              
              <div className="space-y-6">
                <div className="space-y-2">
                  <h4 className="font-bold uppercase text-[10px] tracking-widest text-ink/40">Findings</h4>
                  <div className="space-y-3">
                    {result.detections.map((d, i) => (
                      <div key={i} className="p-3 bg-bg border-2 border-ink/5 rounded">
                        <p className="font-bold text-sm flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4 text-warning" />
                          {d.element}
                        </p>
                        <p className="text-xs text-ink/60 mt-1">{d.reason}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <h4 className="font-bold uppercase text-[10px] tracking-widest text-ink/40">Summary</h4>
                  <p className="text-sm leading-relaxed">{result.explanation}</p>
                </div>
              </div>
            </Card>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center p-12 brutal-border bg-white/50 border-dashed border-ink/20">
              <Info className="w-8 h-8 text-ink/20 mb-4" />
              <p className="text-sm text-ink/40 italic">Upload an image and run the scan to see results here.</p>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// --- History View ---

function HistoryView({ analyses }: { analyses: AnalysisRecord[] }) {
  const handleDelete = async (id: string) => {
    if (confirm("Are you sure you want to delete this record?")) {
      await deleteAnalysis(id);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-8">
      <header>
        <h2 className="text-6xl font-display uppercase tracking-tighter">History</h2>
        <p className="text-ink/60">Review your past design safety checks.</p>
      </header>

      <div className="space-y-4">
        {analyses.length === 0 ? (
          <Card className="text-center py-20">
            <History className="w-12 h-12 text-ink/10 mx-auto mb-4" />
            <p className="text-ink/40 italic">No history found. Start by checking a design!</p>
          </Card>
        ) : (
          analyses.map((a) => (
            <Card key={a.id} className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className={cn("w-12 h-12 rounded flex items-center justify-center", a.type === 'text' ? 'bg-accent/10 text-accent' : 'bg-ink/5 text-ink')}>
                  {a.type === 'text' ? <Search className="w-6 h-6" /> : <ImageIcon className="w-6 h-6" />}
                </div>
                <div>
                  <h4 className="font-bold text-lg truncate max-w-[200px] md:max-w-md">{a.input}</h4>
                  <p className="text-xs text-ink/40 uppercase tracking-widest">
                    {a.type} analysis • {new Date(a.createdAt?.toDate()).toLocaleString()}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-end">
                <RiskBadge level={a.riskLevel} />
                <button onClick={() => handleDelete(a.id!)} className="p-2 text-danger hover:bg-danger/10 rounded transition-colors">
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            </Card>
          ))
        )}
      </div>
    </motion.div>
  );
}
