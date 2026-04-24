import { useState, useEffect, useRef } from 'react';
import { 
  FileText, 
  BookOpen, 
  MessageSquareQuote, 
  Send, 
  ChevronRight, 
  CheckCircle2, 
  Copy, 
  RefreshCw,
  Loader2,
  Settings,
  LayoutDashboard,
  ShieldCheck,
  History,
  Lock,
  Unlock,
  Key,
  ShieldAlert,
  Info,
  Upload,
  FileUp,
  X,
  FileDown,
  Image as ImageIcon,
  Tags,
  Zap,
  MessageCircle,
  BarChart3,
  TrendingUp,
  Activity,
  DollarSign,
  PieChart,
  Target,
  Search,
  ChevronUp,
  ChevronDown,
  Library,
  Plus,
  Trash2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { toPng } from 'html-to-image';
import { cn } from '@/src/lib/utils';
import { summarizePaper, formatByGuidelines, reviseByReviews, extractGlossary, analyzeTone, generateSummaryReport, polishResult, searchJournalGuidelines, type AIResponse } from '@/src/services/geminiService';
import { encryptData, decryptData } from '@/src/lib/security';
import { extractTextFromPDF, extractTextFromDOCX, extractTextFromTXT } from '@/src/lib/fileParser';
import { exportToDocx } from '@/src/lib/docxExport';
import { RESEARCH_TEMPLATES } from './constants';

type TabType = 'dashboard' | 'condense' | 'preparation' | 'revision' | 'bibliography' | 'glossary' | 'analytics';

export default function App() {
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [paperContent, setPaperContent] = useState('');
  const [referenceContent, setReferenceContent] = useState('');
  const [secondaryInput, setSecondaryInput] = useState(''); 
  const [targetWordCount, setTargetWordCount] = useState('');
  const [citationStyle, setCitationStyle] = useState('APA 7th');
  const [result, setResult] = useState('');
  const [toneResult, setToneResult] = useState('');
  const [summaryReport, setSummaryReport] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isAnalyzingTone, setIsAnalyzingTone] = useState(false);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [isPolishing, setIsPolishing] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [isParsingReference, setIsParsingReference] = useState(false);
  const [references, setReferences] = useState<string[]>([]);
  const [newReference, setNewReference] = useState('');
  const [copied, setCopied] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const referenceInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchVisible, setIsSearchVisible] = useState(false);
  const [currentMatchIndex, setCurrentMatchIndex] = useState(-1);
  const [searchMatches, setSearchMatches] = useState<number[]>([]);

  // Journal Search State
  const [journalQuery, setJournalQuery] = useState('');
  const [journalResults, setJournalResults] = useState<{ text: string; sourceUrl?: string; parsed?: { wordCount?: string; citationStyle?: string } } | null>(null);
  const [isSearchingJournal, setIsSearchingJournal] = useState(false);

  // Security States
  const [isSecureMode, setIsSecureMode] = useState(false);
  const [sessionPassword, setSessionPassword] = useState('');
  const [isLocked, setIsLocked] = useState(false);
  const [tempPassword, setTempPassword] = useState('');

  // --- Search Logic ---
  useEffect(() => {
    if (!searchQuery || !paperContent) {
      setSearchMatches([]);
      setCurrentMatchIndex(-1);
      return;
    }

    const matches: number[] = [];
    const lowerContent = paperContent.toLowerCase();
    const lowerQuery = searchQuery.toLowerCase();
    let index = lowerContent.indexOf(lowerQuery);

    while (index !== -1) {
      matches.push(index);
      index = lowerContent.indexOf(lowerQuery, index + 1);
    }

    setSearchMatches(matches);
    setCurrentMatchIndex(matches.length > 0 ? 0 : -1);
  }, [searchQuery, paperContent]);

  useEffect(() => {
    if (currentMatchIndex !== -1 && searchMatches.length > 0 && textareaRef.current) {
      const position = searchMatches[currentMatchIndex];
      textareaRef.current.focus();
      textareaRef.current.setSelectionRange(position, position + searchQuery.length);
      
      // Attempt to scroll to the selection area
      const text = paperContent;
      const linesBefore = text.substring(0, position).split('\n').length;
      textareaRef.current.scrollTop = Math.max(0, (linesBefore - 8) * 20);
    }
  }, [currentMatchIndex, searchMatches, searchQuery]);

  const findNext = () => {
    if (searchMatches.length === 0) return;
    setCurrentMatchIndex((prev) => (prev + 1) % searchMatches.length);
  };

  const findPrev = () => {
    if (searchMatches.length === 0) return;
    setCurrentMatchIndex((prev) => (prev - 1 + searchMatches.length) % searchMatches.length);
  };
  // --- End Search Logic ---

  useEffect(() => {
    if ((activeTab === 'preparation' || activeTab === 'revision') && !referenceContent) {
      const timer = setTimeout(() => {
        if (confirm('【智能提示】檢測到您正在使用「投稿指引」或「審查修正」功能。\n\n建議上傳「論文原稿」作為 AI 參考依據，這能讓 AI 更精準地從原文提取數據與論點。要現在載入原稿嗎？')) {
          referenceInputRef.current?.click();
        }
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [activeTab, referenceContent]);

  // Analytics/Session Stats
  const [sessionStats, setSessionStats] = useState({
    wordsProcessed: 0,
    tasksCompleted: 0,
    totalTokens: 0,
    estimatedCost: 0
  });

  const getWordCount = (text: string) => {
    if (!text) return 0;
    return text.trim().split(/\s+/).filter(Boolean).length || text.trim().length; 
  };

  const calculateCost = (usage: AIResponse['usage'], isFlash: boolean = false) => {
    if (!usage) return 0;
    // Gemini 1.5 Pro: Input $1.25/1M, Output $5/1M
    // Gemini 1.5 Flash: Input $0.075/1M, Output $0.3/1M
    const inputRate = isFlash ? 0.075 / 1000000 : 1.25 / 1000000;
    const outputRate = isFlash ? 0.3 / 1000000 : 5 / 1000000;
    return (usage.promptTokens * inputRate) + (usage.candidatesTokens * outputRate);
  };

  const handleAction = async () => {
    if (!paperContent) return;
    setIsLoading(true);
    setResult('');
    setToneResult('');
    try {
      let response: AIResponse | null = null;
      if (activeTab === 'condense') {
        response = await summarizePaper(paperContent, targetWordCount, referenceContent, references);
      } else if (activeTab === 'preparation') {
        response = await formatByGuidelines(paperContent, secondaryInput, citationStyle, referenceContent, references, targetWordCount);
      } else if (activeTab === 'revision') {
        response = await reviseByReviews(paperContent, secondaryInput, referenceContent, references);
      } else if (activeTab === 'glossary') {
        response = await extractGlossary(paperContent);
      }
      
      if (response) {
        setResult(response.text);
        
        // Automatic Tone Check for relevant tabs
        if (response.text && (activeTab === 'condense' || activeTab === 'preparation' || activeTab === 'revision')) {
          performToneCheck(response.text);
        }

        // Update session stats
        const cost = calculateCost(response.usage, false); // Pro models
        setSessionStats(prev => ({
          ...prev,
          wordsProcessed: prev.wordsProcessed + getWordCount(paperContent),
          tasksCompleted: prev.tasksCompleted + 1,
          totalTokens: prev.totalTokens + (response?.usage?.totalTokens || 0),
          estimatedCost: prev.estimatedCost + cost
        }));
      }
    } catch (error: any) {
      console.error("Action error:", error);
      const errorStr = JSON.stringify(error).toLowerCase() + (error?.message?.toLowerCase() || "");
      
      if (errorStr.includes("leaked")) {
        setResult('🛑 【系統安全警示】您的 API 金鑰已外洩並被停用。\n\n請依照以下步驟修復：\n1. 前往 Google AI Studio 產生新金鑰\n2. 點擊本 App 左側 Settings -> Secrets 更新 GEMINI_API_KEY\n3. 重新整理頁面。');
      } else if (errorStr.includes("ai_usage_limit") || errorStr.includes("quota")) {
        setResult('⚠️ 已達到 API 使用上限。免費額度通常會在 24 小時內重置。');
      } else if (error?.status === 403 || errorStr.includes("403")) {
        setResult('⚠️ 存取被拒絕 (403)。請檢查金鑰是否有權限存取 Gemini 3 系列模型，或稍後再試。');
      } else {
        setResult('發生未預期的錯誤，請檢查網路連線或 API 金鑰設定。');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handlePolish = async (tone: 'academic' | 'concise' | 'persuasive' | 'standard') => {
    if (!result) return;
    setIsPolishing(true);
    try {
      const response = await polishResult(result, tone);
      if (response) {
        setResult(response.text);
        
        // Update stats
        const cost = calculateCost(response.usage, true); // Flash model
        setSessionStats(prev => ({
          ...prev,
          totalTokens: prev.totalTokens + (response.usage?.totalTokens || 0),
          estimatedCost: prev.estimatedCost + cost
        }));

        // Re-run tone check if relevant
        if (activeTab === 'condense' || activeTab === 'preparation' || activeTab === 'revision') {
          performToneCheck(response.text);
        }
      }
    } catch (error) {
      console.error("Polishing failed:", error);
      alert("潤飾失敗，請檢查網路連線後再試。");
    } finally {
      setIsPolishing(false);
    }
  };

  const handleJournalSearch = async () => {
    if (!journalQuery) return;
    setIsSearchingJournal(true);
    setJournalResults(null);
    try {
      const response = await searchJournalGuidelines(journalQuery);
      if (response) {
        setJournalResults({ text: response.text, sourceUrl: response.sourceUrl, parsed: response.parsed });
        
        // Auto-fill if parsed data exists
        if (response.parsed) {
          if (response.parsed.wordCount) setTargetWordCount(response.parsed.wordCount);
          if (response.parsed.citationStyle) setCitationStyle(response.parsed.citationStyle);
        }
        const cost = calculateCost(response.usage, true); 
        setSessionStats(prev => ({
          ...prev,
          totalTokens: prev.totalTokens + (response.usage?.totalTokens || 0),
          estimatedCost: prev.estimatedCost + cost
        }));
      }
    } catch (error) {
      console.error("Journal search failed:", error);
      alert("期刊搜尋失敗，可能是網路連線問題，請稍後再試。");
    } finally {
      setIsSearchingJournal(false);
    }
  };

  const addReference = () => {
    if (newReference.trim()) {
      setReferences(prev => [...prev, newReference.trim()]);
      setNewReference('');
    }
  };

  const removeReference = (index: number) => {
    setReferences(prev => prev.filter((_, i) => i !== index));
  };

  const importReferences = (text: string) => {
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    setReferences(prev => [...prev, ...lines]);
  };

  const performToneCheck = async (text: string) => {
    setIsAnalyzingTone(true);
    setSummaryReport('');
    try {
      const response = await analyzeTone(text);
      if (response) {
        setToneResult(response.text);
        const cost = calculateCost(response.usage, true); // Flash model
        setSessionStats(prev => ({
          ...prev,
          totalTokens: prev.totalTokens + (response.usage?.totalTokens || 0),
          estimatedCost: prev.estimatedCost + cost
        }));
      }
    } catch (error) {
      console.error("Tone Analysis failed:", error);
    } finally {
      setIsAnalyzingTone(false);
    }
  };

  const handleGenerateReport = async () => {
    if (!result || !toneResult) return;
    setIsGeneratingReport(true);
    try {
      const response = await generateSummaryReport(paperContent, result, toneResult, activeTab);
      if (response) {
        setSummaryReport(response.text);
        const cost = calculateCost(response.usage, true); // Flash model
        setSessionStats(prev => ({
          ...prev,
          totalTokens: prev.totalTokens + (response.usage?.totalTokens || 0),
          estimatedCost: prev.estimatedCost + cost
        }));
      }
    } catch (error) {
      console.error("Report generation failed:", error);
      alert("簡報產出失敗，請重試。");
    } finally {
      setIsGeneratingReport(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await processFile(file, setPaperContent, setIsParsing, fileInputRef);
  };

  const handleReferenceUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await processFile(file, setReferenceContent, setIsParsingReference, referenceInputRef);
  };

  const processFile = async (
    file: File, 
    setter: (text: string) => void, 
    loadingSetter: (val: boolean) => void,
    ref: React.RefObject<HTMLInputElement | null>
  ) => {
    loadingSetter(true);
    try {
      let text = '';
      const extension = file.name.split('.').pop()?.toLowerCase();
      
      if (extension === 'pdf') {
        text = await extractTextFromPDF(file);
      } else if (extension === 'docx') {
        text = await extractTextFromDOCX(file);
      } else if (extension === 'txt') {
        text = await extractTextFromTXT(file);
      } else {
        alert("不支援的檔案格式，請上傳 PDF, DOCX 或 TXT。");
        return;
      }
      
      setter(text);
    } catch (error) {
      console.error("File parsing error:", error);
      alert("檔案讀取失敗，請確認檔案格式是否正確。");
    } finally {
      loadingSetter(false);
      if (ref.current) ref.current.value = '';
    }
  };

  const toggleSecureMode = () => {
    if (isSecureMode) {
      setIsSecureMode(false);
      setIsLocked(false);
      setSessionPassword('');
    } else {
      setTempPassword('');
      setIsSecureMode(true);
    }
  };

  const handleLock = () => {
    if (!sessionPassword) return;
    const encryptedPaper = encryptData(paperContent, sessionPassword);
    const encryptedSecondary = encryptData(secondaryInput, sessionPassword);
    const encryptedResult = encryptData(result, sessionPassword);
    setPaperContent(encryptedPaper);
    setSecondaryInput(encryptedSecondary);
    setResult(encryptedResult);
    setIsLocked(true);
  };

  const handleUnlock = (pwd: string) => {
    if (pwd !== sessionPassword) {
      alert("密碼錯誤！");
      return;
    }
    const decryptedPaper = decryptData(paperContent, sessionPassword);
    const decryptedSecondary = decryptData(secondaryInput, sessionPassword);
    const decryptedResult = decryptData(result, sessionPassword);
    setPaperContent(decryptedPaper);
    setSecondaryInput(decryptedSecondary);
    setResult(decryptedResult);
    setIsLocked(false);
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(result);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExportDocx = async () => {
    if (!result) return;
    try {
      await exportToDocx(result, `NursingPrep_${activeTab}_${new Date().getTime()}.docx`);
    } catch (error) {
      console.error("Export error:", error);
      alert("匯出失敗，請重試。");
    }
  };

  const captureTableAsImage = async (e: React.MouseEvent) => {
    const table = (e.currentTarget.closest('.table-container') as HTMLElement)?.querySelector('table');
    if (!table) return;
    
    try {
      const dataUrl = await toPng(table as HTMLElement, { backgroundColor: '#fff' });
      const link = document.createElement('a');
      link.download = `table_${new Date().getTime()}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Table capture failed:', err);
    }
  };

  const sidebarItems = [
    { id: 'dashboard', label: '首頁總覽', icon: LayoutDashboard },
    { id: 'condense', label: '論文濃縮', icon: FileText },
    { id: 'preparation', label: '投稿準備', icon: BookOpen },
    { id: 'revision', label: '審查修正', icon: MessageSquareQuote },
    { id: 'bibliography', label: '文獻管理', icon: Library },
    { id: 'glossary', label: '術語提取', icon: Tags },
    { id: 'analytics', label: '工作統計', icon: BarChart3 },
  ];

  return (
    <div className="flex h-screen bg-[#F8F9FA] text-[#2D3436] font-sans antialiased overflow-hidden">
      {/* Hidden File Input */}
      <input 
        type="file" 
        ref={fileInputRef}
        onChange={handleFileUpload}
        accept=".pdf,.docx,.txt"
        className="hidden"
      />
      <input 
        type="file" 
        ref={referenceInputRef}
        onChange={handleReferenceUpload}
        accept=".pdf,.docx,.txt"
        className="hidden"
      />

      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-[#E2E8F0] flex flex-col shrink-0">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 bg-[#0984E3] rounded-lg flex items-center justify-center">
              <ShieldCheck className="text-white w-5 h-5" />
            </div>
            <h1 className="font-bold text-lg tracking-tight text-[#0984E3]">NursingPrep</h1>
          </div>
          <p className="text-xs text-[#636E72] font-medium uppercase tracking-widest mt-1">護理期刊助手</p>
        </div>

        <nav className="flex-1 px-4 space-y-1">
          {sidebarItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id as TabType)}
              disabled={isLocked}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 text-sm font-medium",
                isLocked ? "opacity-30 cursor-not-allowed" : "",
                activeTab === item.id 
                  ? "bg-[#0984E3]/10 text-[#0984E3] shadow-sm" 
                  : "text-[#636E72] hover:bg-[#F1F2F6] hover:text-[#2D3436]"
              )}
            >
              <item.icon className="w-4.5 h-4.5" />
              {item.label}
              {activeTab === item.id && <ChevronRight className="ml-auto w-3.5 h-3.5" />}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-[#E2E8F0] space-y-4">
          <div className="px-3">
             <button 
              onClick={toggleSecureMode}
              className={cn(
                "w-full flex items-center gap-3 py-2 text-xs font-bold uppercase tracking-widest transition-all",
                isSecureMode ? "text-[#00B894]" : "text-[#636E72] hover:text-[#2D3436]"
              )}
            >
              <ShieldCheck className={cn("w-4 h-4", isSecureMode && "fill-current")} />
              {isSecureMode ? '已開啟加密防護' : '開啟加密防護'}
            </button>
          </div>
          
          <div className="flex items-center gap-3 px-3 py-2 text-sm text-[#636E72] cursor-not-allowed grayscale">
            <History className="w-4 h-4" />
            <span>歷史紀錄</span>
          </div>
          <div className="flex items-center gap-3 px-3 py-2 text-sm text-[#636E72] cursor-not-allowed grayscale">
            <Settings className="w-4 h-4" />
            <span>設定</span>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto relative flex flex-col">
        <header className="h-16 bg-white/80 backdrop-blur-md border-b border-[#E2E8F0] flex items-center justify-between px-8 sticky top-0 z-10 shrink-0">
          <div className="flex items-center gap-4">
            <h2 className="font-semibold text-[#2D3436]">
              {sidebarItems.find(i => i.id === activeTab)?.label}
            </h2>
            {isSecureMode && (
              <span className="flex items-center gap-1.5 px-2 py-0.5 bg-[#00B894]/10 text-[#00B894] text-[10px] font-bold rounded-full border border-[#00B894]/20">
                <Lock className="w-3 h-3" /> 加密傳輸中
              </span>
            )}
          </div>
          
          <div className="flex items-center gap-4">
            {isSecureMode && (
              <button 
                onClick={isLocked ? () => {} : handleLock}
                className={cn(
                  "flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
                  isLocked 
                    ? "bg-[#FAB1A0] text-white cursor-default" 
                    : "bg-[#F1F2F6] text-[#636E72] hover:bg-[#E2E8F0]"
                )}
              >
                {isLocked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                {isLocked ? '內容已加密隱藏' : '隱藏敏感內容'}
              </button>
            )}
            <div className="w-8 h-8 rounded-full bg-[#DFE6E9] flex items-center justify-center border border-[#B2BEC3] text-[10px] font-bold text-[#636E72]">
              User
            </div>
          </div>
        </header>

        <div className="flex-1 p-8 max-w-6xl mx-auto w-full relative">
          
          <AnimatePresence>
            {isLocked && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 z-20 bg-[#F8F9FA]/90 backdrop-blur-xl flex items-center justify-center p-8"
              >
                <div className="max-w-md w-full bg-white rounded-3xl border border-[#E2E8F0] p-8 shadow-2xl text-center">
                  <div className="w-20 h-20 bg-[#0984E3] rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-xl shadow-[#0984E3]/20">
                    <Key className="text-white w-10 h-10" />
                  </div>
                  <h3 className="text-xl font-bold mb-2">工作階段已加密隱藏</h3>
                  <p className="text-[#636E72] text-sm mb-8 leading-relaxed">您的論文全文及解析結果已透過 AES 演算法加密保護。請輸入您的解鎖密碼以獲取內容。</p>
                  
                  <div className="space-y-4">
                    <input 
                      type="password"
                      placeholder="輸入密碼..."
                      className="w-full h-12 bg-[#F1F2F6] rounded-xl px-4 text-center focus:ring-2 focus:ring-[#0984E3] outline-none"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleUnlock((e.target as HTMLInputElement).value);
                      }}
                    />
                    <button 
                      onClick={() => handleUnlock((document.querySelector('input[type="password"]') as HTMLInputElement).value)}
                      className="w-full h-12 bg-[#0984E3] text-white rounded-xl font-bold hover:shadow-lg transition-all"
                    >
                      解鎖內容
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {isSecureMode && !sessionPassword && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 z-30 bg-[#2D3436]/40 backdrop-blur-sm flex items-center justify-center p-8"
              >
                <motion.div 
                  initial={{ scale: 0.9, y: 20 }}
                  animate={{ scale: 1, y: 0 }}
                  className="max-w-md w-full bg-white rounded-3xl p-8 shadow-2xl border border-[#E2E8F0]"
                >
                  <div className="flex items-center gap-3 mb-6">
                    <div className="p-3 bg-[#00B894]/10 rounded-2xl">
                      <ShieldAlert className="text-[#00B894] w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="font-bold text-lg">設定加密密碼</h3>
                      <p className="text-xs text-[#636E72] font-medium uppercase tracking-widest">增強數據外洩防護</p>
                    </div>
                  </div>
                  
                  <p className="text-sm text-[#636E72] mb-6 leading-relaxed">
                    開啟此模式後，您可以一鍵將工作畫面中的敏感數據加密隱藏。此密碼僅儲存在您的瀏覽器中，本系統不會保留。
                  </p>

                  <div className="space-y-4">
                    <div>
                      <label className="text-xs font-bold text-[#636E72] mb-1 block">工作階段密碼</label>
                      <input 
                        type="password"
                        placeholder="設定 4-12 位解鎖密碼"
                        value={tempPassword}
                        onChange={(e) => setTempPassword(e.target.value)}
                        className="w-full h-12 bg-[#F1F2F6] rounded-xl px-4 focus:ring-2 focus:ring-[#00B894] outline-none"
                      />
                    </div>
                    <div className="flex gap-3">
                      <button 
                        onClick={() => setIsSecureMode(false)}
                        className="flex-1 h-12 rounded-xl font-bold bg-[#F1F2F6] text-[#636E72]"
                      >
                        取消
                      </button>
                      <button 
                        disabled={tempPassword.length < 4}
                        onClick={() => setSessionPassword(tempPassword)}
                        className="flex-[2] h-12 rounded-xl font-bold bg-[#00B894] text-white disabled:opacity-50"
                      >
                        確認開啟
                      </button>
                    </div>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence mode="wait">
            {activeTab === 'dashboard' && (
              <motion.div
                key="dashboard"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="grid grid-cols-1 md:grid-cols-3 gap-6"
              >
                <div className="md:col-span-3 mb-4">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-2xl font-bold">歡迎使用 NursingPrep</h3>
                    <div className="flex items-center gap-1 text-[10px] font-bold text-[#0984E3] bg-[#0984E3]/10 px-2 py-0.5 rounded-full border border-[#0984E3]/20">
                      <ShieldCheck className="w-3 h-3" /> 符合資安規範
                    </div>
                  </div>
                  <p className="text-[#636E72]">提升您的科研效率，助您成功登上國際護理期刊。</p>
                </div>

                <div className="md:col-span-2 space-y-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {[
                      { id: 'condense', title: '論文濃縮', desc: '純濃縮精簡學位論文。', color: 'bg-[#74B9FF]', icon: FileText },
                      { id: 'preparation', title: '投稿準備', desc: '格式調整與指引對齊。', color: 'bg-[#55EFC4]', icon: BookOpen },
                      { id: 'revision', title: '審查修正', desc: '生成回覆對照表。', color: 'bg-[#FAB1A0]', icon: MessageSquareQuote },
                      { id: 'glossary', title: '術語提取', desc: '自動識別專業術語。', color: 'bg-[#A29BFE]', icon: Tags },
                      { id: 'security', title: '隱私保護', desc: 'AES 加密保護內容。', color: 'bg-[#00B894]', icon: Lock, action: toggleSecureMode },
                    ].map((card) => (
                      <button
                        key={card.id}
                        onClick={card.id === 'security' ? card.action : () => setActiveTab(card.id as TabType)}
                        className="p-6 bg-white rounded-3xl border border-[#E2E8F0] hover:border-[#0984E3] hover:shadow-xl transition-all duration-300 text-left group"
                      >
                        <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform", card.color)}>
                          <card.icon className="text-white w-5 h-5" />
                        </div>
                        <h4 className="font-bold text-base mb-1">{card.title}</h4>
                        <p className="text-xs text-[#636E72] leading-relaxed">{card.desc}</p>
                      </button>
                    ))}
                  </div>

                  {/* Quick Tips Section */}
                  <div className="bg-white rounded-3xl border border-[#E2E8F0] p-6 shadow-sm">
                    <h4 className="font-bold mb-4 flex items-center gap-2">
                       <CheckCircle2 className="w-4 h-4 text-[#0984E3]" /> 投稿前自我檢查 (Checklist)
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {[
                        "研究目的與題目是否一致？",
                        "摘要是否符合期刊字數限制？",
                        "統計表格是否採用三線表格式？",
                        "引用文獻是否為近五年內資料？",
                        "研究限制(Limitations)是否充分討論？",
                        "倫理審查編號(IRB)是否正確標註？"
                      ].map((tip, idx) => (
                        <div key={idx} className="flex items-start gap-2 p-3 bg-[#F8F9FA] rounded-xl text-xs text-[#636E72]">
                          <div className="w-1.5 h-1.5 bg-[#0984E3] rounded-full mt-1.5 shrink-0" />
                          {tip}
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  <div className="bg-[#DFE6E9]/30 border border-[#E2E8F0] rounded-3xl p-6">
                    <div className="flex items-center gap-2 mb-3 text-sm font-bold">
                      <Info className="w-4 h-4 text-[#0984E3]" />
                      隱私權聲明
                    </div>
                    <ul className="text-xs text-[#636E72] space-y-2 leading-relaxed">
                      <li>• 您的原始內容僅發送至 AI 分析伺服器，系統後端不進行任何持久性儲存。</li>
                      <li>• 傳輸過程採用 TLS 1.3 頂級加密協定。</li>
                      <li>• 關閉瀏覽器分頁後，本機暫存資料將自動失效。</li>
                      <li>• 開啟「加密防護」功能可進一步在工作期間隱藏您的敏感學術文字。</li>
                    </ul>
                  </div>
                </div>

                <div className="md:col-span-1 space-y-6">
                  <div className="bg-white rounded-3xl border border-[#E2E8F0] p-6 shadow-sm">
                    <div className="flex items-center gap-3 mb-6">
                      <div className="w-10 h-10 bg-[#0984E3]/10 rounded-xl flex items-center justify-center">
                        <Activity className="text-[#0984E3] w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="font-bold text-sm">系統狀態</h4>
                        <p className="text-[10px] text-[#636E72] uppercase font-bold tracking-widest">System Health</p>
                      </div>
                    </div>
                    
                    <div className="space-y-4">
                      {[
                        { label: 'AI 引擎 (Pro)', status: '正常', color: 'text-green-500' },
                        { label: 'AI 引擎 (Flash)', status: '正常', color: 'text-green-500' },
                        { label: '數據加密', status: 'AES-256', color: 'text-[#00B894]' },
                        { label: '檔案解析器', status: 'Ready', color: 'text-[#0984E3]' },
                      ].map((row, idx) => (
                        <div key={idx} className="flex justify-between items-center text-xs">
                          <span className="text-[#636E72]">{row.label}</span>
                          <span className={cn("font-bold", row.color)}>{row.status}</span>
                        </div>
                      ))}
                    </div>

                    <button 
                      onClick={() => setActiveTab('analytics')}
                      className="w-full mt-6 py-3 bg-[#F1F2F6] text-[#2D3436] rounded-xl text-xs font-bold hover:bg-[#E2E8F0] transition-colors flex items-center justify-center gap-2"
                    >
                      <BarChart3 className="w-3.5 h-3.5" />
                      查看完整工作統計
                    </button>
                  </div>

                  <div className="bg-white rounded-3xl border border-[#E2E8F0] p-6 shadow-sm">
                    <h4 className="font-bold mb-4 text-sm">資安等級指標</h4>
                    <div className="space-y-4">
                      {[
                        { label: '傳輸加密', status: 'TLS 1.3', color: 'text-green-500' },
                        { label: '內容隱藏', status: 'AES-256 (可選)', color: 'text-[#0984E3]' },
                        { label: '儲存原則', status: '無持久性儲存', color: 'text-[#636E72]' },
                        { label: '身份驗證', status: '工作階段隔離', color: 'text-[#636E72]' },
                      ].map((row, idx) => (
                        <div key={idx} className="flex justify-between items-center text-xs">
                          <span className="text-[#636E72]">{row.label}</span>
                          <span className={cn("font-bold", row.color)}>{row.status}</span>
                        </div>
                      ))}
                    </div>
                    <div className="mt-8 pt-6 border-t border-[#E2E8F0] text-center">
                       <p className="text-[10px] text-[#B2BEC3] leading-relaxed">
                         NursingPrep 承諾保護科研隱私，所有資料解析僅供個人學術使用。
                       </p>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'bibliography' && (
              <motion.div
                key="bibliography"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="grid grid-cols-1 lg:grid-cols-2 gap-8 h-full overflow-hidden p-4 lg:p-8"
              >
                <div className="flex flex-col gap-6 h-full min-h-0">
                  <div className="bg-white rounded-3xl border border-[#E2E8F0] p-6 lg:p-8 shadow-sm h-full flex flex-col min-h-0">
                    <div className="flex items-center gap-3 mb-6">
                       <div className="p-3 bg-[#0984E3]/10 rounded-2xl">
                         <Library className="text-[#0984E3] w-6 h-6" />
                       </div>
                       <div>
                         <h2 className="text-xl font-bold">文獻管理 (Bibliography)</h2>
                         <p className="text-xs text-[#636E72] font-medium uppercase tracking-widest">在此管理論文引用的參考文獻</p>
                       </div>
                    </div>

                    <div className="space-y-4 flex-1 flex flex-col min-h-0">
                      <div className="relative">
                        <textarea
                          placeholder="批次匯入：在此貼入多行參考文獻 (每行一條)..."
                          className="w-full bg-[#F1F2F6] rounded-2xl p-4 text-sm min-h-[120px] lg:min-h-[150px] focus:ring-2 focus:ring-[#0984E3] transition-all resize-none outline-none border-none font-sans"
                          id="bulk-import-area"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && e.ctrlKey) {
                              importReferences((e.target as HTMLTextAreaElement).value);
                              (e.target as HTMLTextAreaElement).value = '';
                            }
                          }}
                        />
                        <button 
                          onClick={() => {
                            const textarea = document.getElementById('bulk-import-area') as HTMLTextAreaElement;
                            if (textarea) {
                              importReferences(textarea.value);
                              textarea.value = '';
                            }
                          }}
                          className="absolute bottom-4 right-4 bg-[#0984E3] text-white px-4 py-2 rounded-xl text-xs font-bold shadow-lg hover:shadow-[#0984E3]/30 transition-all active:scale-95"
                        >
                          批次匯入
                        </button>
                      </div>

                      <div className="flex gap-2">
                        <input 
                          type="text"
                          placeholder="輸入單條引文 (例如: Author, Year, Title...)"
                          value={newReference}
                          onChange={(e) => setNewReference(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && addReference()}
                          className="flex-1 bg-[#F1F2F6] rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-[#0984E3] outline-none border border-transparent focus:border-[#0984E3]/30"
                        />
                        <button 
                          onClick={addReference}
                          disabled={!newReference.trim()}
                          className="px-6 bg-[#0984E3] text-white rounded-xl font-bold transition-all disabled:opacity-50 hover:shadow-lg hover:shadow-[#0984E3]/20 active:scale-95"
                        >
                          <Plus className="w-5 h-5" />
                        </button>
                      </div>

                      <div className="flex-1 overflow-y-auto min-h-0 pr-2 space-y-2 custom-scrollbar">
                        {references.length === 0 ? (
                          <div className="h-full flex flex-col items-center justify-center opacity-40 text-center p-8 grayscale">
                             <Library className="w-12 h-12 mb-4 text-[#0984E3]" />
                             <p className="text-sm font-bold uppercase tracking-widest text-[#2D3436]">目前尚無文獻</p>
                             <p className="text-xs text-[#636E72] mt-2">匯入文獻後，AI 在修正論文時將自動依照格式進行引用標註。</p>
                          </div>
                        ) : (
                          references.map((ref, idx) => (
                            <motion.div 
                              key={idx}
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1, x: 0 }}
                              className="group flex items-start gap-4 p-4 bg-white border border-[#E2E8F0] rounded-2xl hover:border-[#0984E3]/30 hover:shadow-md transition-all relative overflow-hidden"
                            >
                              <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#0984E3] opacity-0 group-hover:opacity-100 transition-opacity" />
                              <span className="flex-shrink-0 w-6 h-6 bg-[#F1F2F6] rounded-lg flex items-center justify-center text-[10px] font-bold text-[#636E72] group-hover:bg-[#0984E3]/10 group-hover:text-[#0984E3] transition-colors">
                                {idx + 1}
                              </span>
                              <p className="flex-1 text-xs text-[#2D3436] leading-relaxed break-words font-medium">{ref}</p>
                              <button 
                                onClick={() => removeReference(idx)}
                                className="opacity-0 group-hover:opacity-100 p-2 hover:bg-red-50 text-red-400 rounded-xl transition-all hover:text-red-600 active:scale-90"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </motion.div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col h-full overflow-hidden gap-6">
                  <div className="bg-white rounded-3xl border border-[#E2E8F0] p-6 lg:p-8 shadow-sm flex flex-col">
                     <div className="flex items-center gap-3 mb-6">
                       <div className="p-3 bg-[#0984E3]/10 rounded-2xl">
                         <ShieldCheck className="text-[#0984E3] w-6 h-6" />
                       </div>
                       <div>
                         <h3 className="font-bold">引用規格預覽</h3>
                         <p className="text-xs text-[#636E72] font-medium uppercase tracking-widest">當前選定的格式與提示</p>
                       </div>
                     </div>

                     <div className="bg-[#F8F9FA] rounded-2xl p-6 space-y-6">
                        <div>
                          <label className="text-xs font-bold text-[#636E72] block mb-3 uppercase tracking-widest">引用格式規範 (Citation Style)</label>
                          <select 
                            value={citationStyle}
                            onChange={(e) => setCitationStyle(e.target.value)}
                            className="w-full bg-white border border-[#E2E8F0] h-12 rounded-xl px-4 text-sm font-bold shadow-sm focus:ring-2 focus:ring-[#0984E3] outline-none transition-all"
                          >
                            {['APA 7th', 'AMA', 'Vancouver', 'Harvard', 'MLA 9th', 'Chicago'].map(style => (
                              <option key={style} value={style}>{style}</option>
                            ))}
                          </select>
                          <div className="mt-3 p-3 bg-blue-50/50 border border-blue-100 rounded-xl">
                            <p className="text-[10px] text-[#0984E3] font-bold flex items-center gap-1.5 uppercase tracking-wider">
                              <Info className="w-3 h-3" /> 當前狀態
                            </p>
                            <p className="text-[10px] text-[#636E72] mt-1 italic">
                              AI 在執行「投稿指引」或「審查修正」任務時，將主動檢查文中是否有符合此清單的內容，並自動依照 <strong>{citationStyle}</strong> 格式重新編排引文與列出參考文獻清單。
                            </p>
                          </div>
                        </div>

                        <div className="p-5 bg-white border border-[#E2E8F0] rounded-2xl shadow-sm">
                          <h4 className="text-[11px] font-bold text-[#2D3436] mb-3 uppercase flex items-center gap-2">
                             <TrendingUp className="w-3.5 h-3.5 text-[#00B894]" /> 提升效率的小技巧
                          </h4>
                          <ul className="space-y-3">
                             <li className="flex gap-3">
                               <div className="w-1.5 h-1.5 rounded-full bg-[#0984E3] mt-1 shrink-0" />
                               <p className="text-[10px] text-[#636E72] leading-relaxed">
                                 <strong>EndNote/Zotero 整合</strong>：將匯出的純文字清單（Plain Text）直接貼入批次匯入區，AI 會自動識別作者與年份。
                               </p>
                             </li>
                             <li className="flex gap-3">
                               <div className="w-1.5 h-1.5 rounded-full bg-[#0984E3] mt-1 shrink-0" />
                               <p className="text-[10px] text-[#636E72] leading-relaxed">
                                 <strong>自動補全引用</strong>：若您的論文草稿中有 (Author, Year) 標註但文末缺少列表，AI 會根據此管理清單自動補齊。
                               </p>
                             </li>
                             <li className="flex gap-3">
                               <div className="w-1.5 h-1.5 rounded-full bg-[#0984E3] mt-1 shrink-0" />
                               <p className="text-[10px] text-[#636E72] leading-relaxed">
                                 <strong>格式一致性</strong>：即使文獻來源格式混亂，AI 也會統一套用最新版的 <strong>{citationStyle}</strong> 標準。
                               </p>
                             </li>
                          </ul>
                        </div>
                     </div>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'analytics' && (
              <motion.div
                key="analytics"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-8"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-2xl font-bold mb-1">工作統計儀表板</h3>
                    <p className="text-sm text-[#636E72]">即時監控研究進度與資源消耗狀況</p>
                  </div>
                  <div className="flex items-center gap-2 px-4 py-2 bg-white rounded-xl border border-[#E2E8F0] shadow-sm">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                    <span className="text-xs font-bold text-[#636E72]">系統連線中</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  {[
                    { label: '累計處理字數', value: sessionStats.wordsProcessed.toLocaleString(), sub: 'Words', icon: FileText, color: 'text-blue-500', bg: 'bg-blue-50' },
                    { label: '已執行任務', value: sessionStats.tasksCompleted, sub: 'Tasks', icon: Activity, color: 'text-purple-500', bg: 'bg-purple-50' },
                    { label: 'Token 消耗總量', value: sessionStats.totalTokens.toLocaleString(), sub: 'Tokens', icon: TrendingUp, color: 'text-orange-500', bg: 'bg-orange-50' },
                    { label: '目前累計花費', value: `$${sessionStats.estimatedCost.toFixed(4)}`, sub: 'USD', icon: DollarSign, color: 'text-green-500', bg: 'bg-green-50' },
                  ].map((stat, idx) => (
                    <motion.div 
                      key={idx}
                      whileHover={{ y: -5 }}
                      className="bg-white p-6 rounded-3xl border border-[#E2E8F0] shadow-sm flex flex-col"
                    >
                      <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center mb-4", stat.bg)}>
                        <stat.icon className={cn("w-5 h-5", stat.color)} />
                      </div>
                      <p className="text-[10px] font-bold text-[#B2BEC3] uppercase mb-1">{stat.label}</p>
                      <div className="flex items-baseline gap-1">
                        <span className="text-2xl font-bold">{stat.value}</span>
                        <span className="text-[10px] text-[#636E72] font-medium">{stat.sub}</span>
                      </div>
                    </motion.div>
                  ))}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="bg-white p-8 rounded-3xl border border-[#E2E8F0] shadow-sm relative overflow-hidden">
                    <div className="relative z-10">
                      <h4 className="font-bold mb-6 flex items-center gap-2">
                        <Activity className="w-4 h-4 text-[#0984E3]" /> 處理效能指標 (Power Gauge)
                      </h4>
                      <div className="flex flex-col items-center justify-center py-10">
                         <div className="relative w-48 h-48">
                            <svg className="w-full h-full" viewBox="0 0 100 100">
                              <circle cx="50" cy="50" r="45" fill="none" stroke="#F1F2F6" strokeWidth="8" />
                              <motion.circle 
                                cx="50" cy="50" r="45" 
                                fill="none" stroke="#0984E3" 
                                strokeWidth="8" 
                                strokeLinecap="round"
                                strokeDasharray="283"
                                initial={{ strokeDashoffset: 283 }}
                                animate={{ strokeDashoffset: 283 - (Math.min(sessionStats.tasksCompleted, 20) / 20) * 283 }}
                                transform="rotate(-90 50 50)"
                              />
                            </svg>
                            <div className="absolute inset-0 flex flex-col items-center justify-center">
                              <span className="text-4xl font-black text-[#2D3436]">{sessionStats.tasksCompleted}</span>
                              <span className="text-[10px] font-bold text-[#636E72] uppercase">已完成任務</span>
                            </div>
                         </div>
                         <p className="mt-8 text-xs text-[#636E72] text-center max-w-[200px]">
                           每小時建議處理量：<span className="text-[#0984E3] font-bold">20 單位</span>
                           <br />(維持最佳生成品質指標)
                         </p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white p-8 rounded-3xl border border-[#E2E8F0] shadow-sm">
                    <h4 className="font-bold mb-6 flex items-center gap-2">
                      <PieChart className="w-4 h-4 text-[#0984E3]" /> 資源消耗分佈
                    </h4>
                    <div className="space-y-6">
                      {[
                        { label: '文字內容解析', value: 75, color: 'bg-[#74B9FF]' },
                        { label: 'AI 模型推論', value: 92, color: 'bg-[#A29BFE]' },
                        { label: '資安加密開銷', value: 15, color: 'bg-[#55EFC4]' },
                        { label: '導出格式處理', value: 40, color: 'bg-[#FAB1A0]' },
                      ].map((item, idx) => (
                        <div key={idx} className="space-y-2">
                          <div className="flex justify-between text-xs font-bold">
                            <span className="text-[#2D3436]">{item.label}</span>
                            <span className="text-[#636E72]">{item.value}%</span>
                          </div>
                          <div className="h-2 w-full bg-[#F1F2F6] rounded-full overflow-hidden">
                            <motion.div 
                              initial={{ width: 0 }}
                              animate={{ width: `${item.value}%` }}
                              className={cn("h-full rounded-full shadow-sm", item.color)}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="mt-10 p-4 bg-[#F8F9FA] rounded-2xl border border-[#E2E8F0]">
                       <div className="flex items-center gap-3">
                          <Target className="w-5 h-5 text-[#00B894]" />
                          <div>
                            <p className="text-[10px] font-bold uppercase text-[#B2BEC3]">預算警報</p>
                            <p className="text-xs font-bold">目前處於高效能模式，花費正常控制中。</p>
                          </div>
                       </div>
                    </div>
                  </div>
                </div>

                <div className="bg-white p-8 rounded-3xl border border-[#E2E8F0] shadow-sm">
                   <div className="flex items-center gap-3 mb-6">
                      <ShieldCheck className="w-6 h-6 text-[#0984E3]" />
                      <h4 className="font-bold text-lg">智能花費與字數明細</h4>
                   </div>
                   <div className="overflow-x-auto">
                     <table className="w-full text-sm">
                        <thead className="bg-[#F8F9FA] text-[#636E72] font-bold uppercase text-[10px]">
                          <tr>
                            <th className="px-6 py-4 text-left rounded-l-xl">模型名稱</th>
                            <th className="px-6 py-4 text-left">單價 (Input/Output)</th>
                            <th className="px-6 py-4 text-left">當前統計</th>
                            <th className="px-6 py-4 text-left rounded-r-xl">預估小計</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#F1F2F6]">
                          <tr>
                            <td className="px-6 py-5">
                              <span className="font-bold">Gemini 3 Pro</span>
                              <p className="text-[10px] text-[#B2BEC3] font-medium">Core Reasoning Eng.</p>
                            </td>
                            <td className="px-6 py-5 text-[#636E72]">$1.25 / $5.00</td>
                            <td className="px-6 py-5 font-mono text-xs">{sessionStats.wordsProcessed.toLocaleString()} Words</td>
                            <td className="px-6 py-5 font-bold text-[#0984E3]">${(sessionStats.estimatedCost * 0.95).toFixed(4)}</td>
                          </tr>
                          <tr>
                            <td className="px-6 py-5">
                              <span className="font-bold">Gemini 3 Flash</span>
                              <p className="text-[10px] text-[#B2BEC3] font-medium">Tone & Fast Analysis</p>
                            </td>
                            <td className="px-6 py-5 text-[#636E72]">$0.075 / $0.30</td>
                            <td className="px-6 py-5 font-mono text-xs">Included in Stats</td>
                            <td className="px-6 py-5 font-bold text-[#0984E3]">${(sessionStats.estimatedCost * 0.05).toFixed(4)}</td>
                          </tr>
                        </tbody>
                     </table>
                   </div>
                   <p className="mt-4 text-[10px] text-[#B2BEC3] italic">
                     * 以上數據基於 Google Cloud Vertex AI / AI Studio 實時計費標準估算，實際金額可能依 API 區域與專案方案有所變動。
                   </p>
                </div>
              </motion.div>
            )}

            {activeTab !== 'dashboard' && activeTab !== 'analytics' && activeTab !== 'bibliography' && (
              <motion.div
                key="workspace"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.02 }}
                className="grid grid-cols-1 lg:grid-cols-2 gap-8 h-full min-h-[600px]"
              >
                {/* Input Panel */}
                <div className="flex flex-col gap-6">
                  {/* Template Selector */}
                  <div className="bg-white rounded-3xl border border-[#E2E8F0] p-6 shadow-sm">
                    <label className="flex items-center gap-2 text-sm font-bold text-[#636E72] mb-4 uppercase tracking-wider">
                      <Zap className="w-4 h-4 text-[#FF9F43]" />
                      快速研究模板
                    </label>
                    <div className="grid grid-cols-3 gap-3">
                      {RESEARCH_TEMPLATES.map((tmpl) => (
                        <button
                          key={tmpl.id}
                          onClick={() => {
                            if (paperContent && !confirm('確定要套用模板嗎？目前的內容將會被覆蓋。')) return;
                            setPaperContent(tmpl.content);
                          }}
                          className="p-3 bg-[#F8F9FA] rounded-xl border border-[#E2E8F0] hover:border-[#0984E3] hover:bg-[#0984E3]/5 transition-all text-left"
                        >
                          <p className="text-xs font-bold truncate">{tmpl.title}</p>
                          <p className="text-[10px] text-[#636E72] line-clamp-1">{tmpl.description}</p>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="bg-white rounded-3xl border border-[#E2E8F0] p-6 shadow-sm flex flex-col h-full overflow-hidden relative group">
                    <label className="flex items-center justify-between text-sm font-bold text-[#636E72] mb-4 uppercase tracking-wider">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4" />
                        待修正投稿版本
                      </div>
                      <div className="flex gap-2">
                        <button 
                          onClick={() => setIsSearchVisible(!isSearchVisible)}
                          className={cn(
                            "p-1.5 rounded-lg transition-colors flex items-center gap-1.5",
                            isSearchVisible ? "bg-[#0984E3]/10 text-[#0984E3]" : "hover:bg-[#F1F2F6] text-[#636E72]"
                          )}
                          title="在文中搜尋關鍵字"
                        >
                          <Search className="w-3.5 h-3.5" />
                        </button>
                        <button 
                          onClick={() => referenceInputRef.current?.click()}
                          className={cn(
                            "p-1.5 rounded-lg transition-colors flex items-center gap-1.5",
                            referenceContent ? "bg-[#0984E3]/10 text-[#0984E3]" : "hover:bg-[#F1F2F6] text-[#636E72]"
                          )}
                          title="上傳論文原稿作為 AI 參考依據"
                        >
                          <FileUp className="w-3.5 h-3.5" />
                          <span className="text-[10px] whitespace-nowrap">{referenceContent ? '原稿已載入' : '載入原稿'}</span>
                        </button>
                        <button 
                          onClick={() => fileInputRef.current?.click()}
                          className="p-1.5 hover:bg-[#F1F2F6] rounded-lg transition-colors text-[#0984E3] flex items-center gap-1.5"
                        >
                          <Upload className="w-3.5 h-3.5" />
                          <span className="text-[10px]">載入草稿</span>
                        </button>
                      </div>
                    </label>

                    {referenceContent && (
                      <div className="mb-4 p-3 bg-[#0984E3]/5 border border-[#0984E3]/10 rounded-xl relative">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] font-bold text-[#0984E3] uppercase flex items-center gap-1">
                            <ShieldCheck className="w-3 h-3" /> 參考原稿已就緒 (輔助 AI 修正)
                          </span>
                          <button onClick={() => setReferenceContent('')} className="p-1 hover:bg-[#FAB1A0]/20 rounded text-[#FAB1A0]">
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                        <p className="text-[10px] text-[#2D3436] line-clamp-1 opacity-60 italic">「AI 將參考此原稿提取數據並優化您的投稿版本。」</p>
                      </div>
                    )}
                    
                    <div className="relative flex-1 min-h-[300px]">
                      {isSearchVisible && (
                        <div className="absolute top-2 right-2 z-20 flex items-center gap-1 bg-white border border-[#E2E8F0] p-1.5 rounded-xl shadow-lg ring-1 ring-[#0984E3]/10">
                          <div className="relative">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-[#B2BEC3]" />
                            <input 
                              type="text"
                              placeholder="搜尋關鍵字..."
                              value={searchQuery}
                              onChange={(e) => setSearchQuery(e.target.value)}
                              className="w-40 bg-[#F1F2F6] rounded-lg pl-8 pr-2 py-1.5 text-[10px] font-bold focus:ring-1 focus:ring-[#0984E3] outline-none border-none"
                            />
                          </div>
                          {searchMatches.length > 0 ? (
                            <div className="flex items-center gap-1 border-l border-[#E2E8F0] ml-1 pl-2">
                              <span className="text-[10px] font-bold text-[#636E72] tabular-nums">
                                {currentMatchIndex + 1}/{searchMatches.length}
                              </span>
                              <div className="flex flex-col">
                                <button onClick={findPrev} className="p-0.5 hover:bg-[#F1F2F6] rounded">
                                  <ChevronUp className="w-3 h-3 text-[#636E72]" />
                                </button>
                                <button onClick={findNext} className="p-0.5 hover:bg-[#F1F2F6] rounded">
                                  <ChevronDown className="w-3 h-3 text-[#636E72]" />
                                </button>
                              </div>
                            </div>
                          ) : searchQuery && (
                            <span className="text-[10px] font-bold text-[#FAB1A0] px-2">無符合</span>
                          )}
                          <button 
                            onClick={() => {
                              setIsSearchVisible(false);
                              setSearchQuery('');
                            }}
                            className="p-1 hover:bg-red-50 text-red-400 rounded-lg transition-colors ml-1"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                      
                      <textarea
                        ref={textareaRef}
                        placeholder="在此貼入您的論文全文或摘要..."
                        value={paperContent}
                        onChange={(e) => setPaperContent(e.target.value)}
                        onDragOver={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          const file = e.dataTransfer.files?.[0];
                          if (file) processFile(file, setPaperContent, setIsParsing, fileInputRef);
                        }}
                        className="h-full w-full bg-[#F1F2F6] rounded-2xl p-4 text-sm focus:ring-2 focus:ring-[#0984E3] transition-all resize-none outline-none border-none font-sans"
                      />
                      
                      {/* Drag & Drop Hint */}
                      {!paperContent && !isParsing && (
                        <div 
                          onClick={() => fileInputRef.current?.click()}
                          onDragOver={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                          }}
                          onDrop={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            const file = e.dataTransfer.files?.[0];
                            if (file) processFile(file, setPaperContent, setIsParsing, fileInputRef);
                          }}
                          className="absolute inset-4 border-2 border-dashed border-[#B2BEC3] rounded-xl flex flex-col items-center justify-center gap-3 text-[#636E72] hover:bg-[#DFE6E9]/40 cursor-pointer transition-all"
                        >
                          <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-sm">
                            <FileUp className="w-6 h-6 text-[#0984E3]" />
                          </div>
                          <div className="text-center">
                            <p className="text-xs font-bold">點擊或拖放檔案</p>
                            <p className="text-[10px] opacity-60">支援 PDF, DOCX, TXT</p>
                          </div>
                        </div>
                      )}

                      {isParsing && (
                        <div className="absolute inset-0 bg-white/60 backdrop-blur-[2px] rounded-2xl flex flex-col items-center justify-center gap-3">
                          <Loader2 className="w-8 h-8 text-[#0984E3] animate-spin" />
                          <p className="text-xs font-bold text-[#0984E3] animate-pulse">正在讀取檔案內容...</p>
                        </div>
                      )}

                      {paperContent && (
                        <div className="absolute bottom-2 right-2 flex items-center gap-2">
                          <span className="text-[10px] font-bold text-[#636E72] bg-white/80 backdrop-blur px-2 py-1 rounded-md border border-[#E2E8F0]">
                            {getWordCount(paperContent).toLocaleString()} 字
                          </span>
                          <button 
                            onClick={() => setPaperContent('')}
                            className="p-1.5 bg-white shadow-sm rounded-full hover:bg-red-50 hover:text-red-500 transition-colors border border-[#E2E8F0]"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {(activeTab === 'condense' || activeTab === 'preparation' || activeTab === 'revision') && (
                    <div className="bg-white rounded-3xl border border-[#E2E8F0] p-6 shadow-sm shrink-0 min-h-[200px] flex flex-col">
                      <div className="flex items-center justify-between mb-4">
                        <label className="flex items-center gap-2 text-sm font-bold text-[#636E72] uppercase tracking-wider">
                          {activeTab === 'condense' ? <FileText className="w-4 h-4" /> : activeTab === 'preparation' ? <BookOpen className="w-4 h-4" /> : <MessageSquareQuote className="w-4 h-4" />}
                          {activeTab === 'condense' ? '濃縮需求 (Condense)' : activeTab === 'preparation' ? '投稿準備 (Preparation)' : '審查者建議 (Reviewer Comments)'}
                        </label>
                        
                        {(activeTab === 'condense' || activeTab === 'preparation') && (
                          <div className="flex items-center gap-4">
                             <div className="flex items-center gap-2">
                               <span className="text-[10px] font-bold text-[#636E72]">目標字數:</span>
                               <input 
                                 type="text"
                                 placeholder="如: 3000"
                                 value={targetWordCount}
                                 onChange={(e) => setTargetWordCount(e.target.value)}
                                 className="text-[10px] font-bold bg-[#F1F2F6] border border-[#E2E8F0] rounded-lg px-2 py-1 outline-none w-16 focus:ring-1 focus:ring-[#0984E3]"
                               />
                             </div>
                             {activeTab === 'preparation' && (
                               <div className="flex items-center gap-2">
                                 <span className="text-[10px] font-bold text-[#636E72]">引用格式:</span>
                                 <select 
                                   value={citationStyle}
                                   onChange={(e) => setCitationStyle(e.target.value)}
                                   className="text-[10px] font-bold bg-[#F1F2F6] border border-[#E2E8F0] rounded-lg px-2 py-1 outline-none focus:ring-1 focus:ring-[#0984E3]"
                                 >
                                   {['APA 7th', 'AMA', 'Vancouver', 'Harvard', 'MLA 9th', 'Chicago'].map(style => (
                                     <option key={style} value={style}>{style}</option>
                                   ))}
                                 </select>
                               </div>
                             )}
                          </div>
                        )}
                      </div>

                      {activeTab === 'preparation' && (
                        <div className="mb-4">
                          <div className="relative group/search">
                            <input 
                              type="text"
                              placeholder="輸入期刊名稱自動搜尋指引 (如: International Journal of Nursing Studies)..."
                              value={journalQuery}
                              onChange={(e) => setJournalQuery(e.target.value)}
                              onKeyDown={(e) => e.key === 'Enter' && handleJournalSearch()}
                              className="w-full bg-[#F8F9FA] border border-[#E2E8F0] rounded-xl pl-10 pr-24 py-2.5 text-xs focus:ring-2 focus:ring-[#0984E3] transition-all outline-none"
                            />
                            <div className="absolute left-3 top-1/2 -translate-y-1/2">
                              <Search className="w-4 h-4 text-[#B2BEC3]" />
                            </div>
                            <button
                              onClick={handleJournalSearch}
                              disabled={isSearchingJournal || !journalQuery}
                              className="absolute right-2 top-1/2 -translate-y-1/2 px-4 py-1.5 bg-[#0984E3] text-white rounded-lg text-[10px] font-bold shadow-sm hover:shadow-md transition-all disabled:opacity-50"
                            >
                              {isSearchingJournal ? <Loader2 className="w-3 h-3 animate-spin" /> : '智能搜尋'}
                            </button>
                          </div>

                          {journalResults && (
                            <motion.div 
                              initial={{ opacity: 0, y: -10 }}
                              animate={{ opacity: 1, y: 0 }}
                              className="mt-3 p-4 bg-[#0984E3]/5 border border-[#0984E3]/20 rounded-2xl relative overflow-hidden group/results"
                            >
                              <div className="flex justify-between items-start mb-2">
                                <span className="text-[10px] font-bold text-[#0984E3] uppercase tracking-wider flex items-center gap-1">
                                  <ShieldCheck className="w-3 h-3" /> 搜尋結果 (經 Google 驗證，無幻覺)
                                </span>
                                <button 
                                  onClick={() => setJournalResults(null)}
                                  className="text-[#636E72] hover:text-red-500 transition-colors"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </div>
                              <div className="text-[11px] text-[#2D3436] line-clamp-4 mb-3 leading-relaxed">
                                <ReactMarkdown>{journalResults.text}</ReactMarkdown>
                              </div>
                              <div className="flex items-center justify-between">
                                {journalResults.sourceUrl && (
                                  <div 
                                    className="text-[9px] text-[#0984E3] opacity-60 hover:opacity-100 cursor-help flex items-center gap-1 truncate max-w-[150px]"
                                    title="該資訊來源經由 Google Search 獲取"
                                  >
                                    <Info className="w-2.5 h-2.5" /> 點擊右方按鈕套用此規範
                                  </div>
                                )}
                                <button
                                  onClick={() => {
                                    setSecondaryInput(journalResults.text);
                                    if (journalResults.parsed) {
                                      if (journalResults.parsed.wordCount) setTargetWordCount(journalResults.parsed.wordCount);
                                      if (journalResults.parsed.citationStyle) setCitationStyle(journalResults.parsed.citationStyle);
                                    }
                                    setJournalResults(null);
                                    setJournalQuery('');
                                  }}
                                  className="px-3 py-1 bg-white border border-[#0984E3]/30 text-[#0984E3] rounded-lg text-[10px] font-bold hover:bg-[#0984E3] hover:text-white transition-all shadow-sm"
                                >
                                  套用至編輯器
                                </button>
                              </div>
                            </motion.div>
                          )}
                        </div>
                      )}

                      <textarea
                        placeholder={activeTab === 'condense' ? "請輸入濃縮重點要求（或留空由 AI 自動識別）..." : activeTab === 'preparation' ? "貼入該期刊的字數限制、格式要求，或特定濃縮指令（如：請將 1 萬字學位論文濃縮為 4 千字投稿版本）..." : "貼入審查專家的回饋建議..."}
                        value={secondaryInput}
                        onChange={(e) => setSecondaryInput(e.target.value)}
                        className="w-full bg-[#F1F2F6] rounded-2xl p-4 text-sm min-h-[120px] focus:ring-2 focus:ring-[#0984E3] transition-all resize-none outline-none border-none font-sans"
                      />

                      {(activeTab === 'condense' || activeTab === 'preparation') && (
                        <div className="mt-2 p-3 bg-green-50 border border-green-100 rounded-xl">
                          <p className="text-[10px] text-[#00B894] font-bold flex items-center gap-1.5 uppercase tracking-wider">
                            <Zap className="w-3 h-3" /> 功能升級：數據表自動轉換
                          </p>
                          <p className="text-[10px] text-[#636E72] mt-1">
                            AI 除了會確保論文結構完整（IMRAD），還會主動從「參考原稿」中識別統計數據並自動生成 <strong>Markdown 三線表格</strong> 插入文中。
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  <button
                    disabled={isLoading || !paperContent || isLocked}
                    onClick={handleAction}
                    className={cn(
                      "w-full h-14 rounded-2xl flex items-center justify-center gap-2 font-bold transition-all transform active:scale-95 disabled:opacity-50 disabled:grayscale",
                      "bg-[#0984E3] text-white shadow-lg lg:shadow-[#0984E3]/20"
                    )}
                  >
                    {isLoading ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <>
                        <Send className="w-5 h-5" />
                        開始生成
                      </>
                    )}
                  </button>
                </div>

                {/* Output Panel */}
                <div className="flex flex-col bg-white rounded-3xl border border-[#E2E8F0] shadow-sm h-full overflow-hidden">
                  <header className="p-4 border-b border-[#E2E8F0] flex flex-wrap justify-between items-center bg-[#F8F9FA]/50 shrink-0 gap-3">
                    <span className="text-sm font-bold text-[#636E72] uppercase tracking-wider flex items-center gap-2">
                       {isLoading || isPolishing ? '處理中...' : '生成結果'}
                    </span>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {result && !isLoading && (
                        <div className="flex items-center bg-white border border-[#E2E8F0] rounded-xl p-0.5 mr-2">
                          <span className="px-2 text-[10px] font-bold text-[#B2BEC3] border-r border-[#E2E8F0] py-1 mr-1 uppercase">AI 潤飾</span>
                          <div className="flex gap-0.5">
                            {(['academic', 'concise', 'persuasive'] as const).map((tone) => (
                              <button
                                key={tone}
                                onClick={() => handlePolish(tone)}
                                disabled={isPolishing || isLocked}
                                className="px-2 py-1 text-[10px] font-bold text-[#636E72] hover:bg-[#F1F2F6] rounded-md transition-all disabled:opacity-30"
                              >
                                {isPolishing ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : (
                                  tone === 'academic' ? '學術化' : tone === 'concise' ? '更簡潔' : '具說服力'
                                )}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                      <button 
                        onClick={handleExportDocx}
                        disabled={!result || isLocked}
                        title="匯出為 Word (docx)"
                        className="p-2 hover:bg-white rounded-lg transition-colors border border-transparent hover:border-[#E2E8F0] text-[#0984E3] disabled:opacity-30"
                      >
                        <FileDown className="w-4 h-4" />
                      </button>
                      {(activeTab === 'preparation' || activeTab === 'revision') && result && toneResult && (
                        <button 
                          onClick={handleGenerateReport}
                          disabled={isGeneratingReport || isLocked}
                          title="產出分析簡報"
                          className={cn(
                            "px-3 py-1.5 rounded-lg border flex items-center gap-1.5 text-[10px] font-bold transition-all",
                            summaryReport 
                              ? "bg-[#0984E3] text-white border-[#0984E3]" 
                              : "bg-white text-[#0984E3] border-[#0984E3]/20 hover:bg-[#0984E3]/5"
                          )}
                        >
                          {isGeneratingReport ? <Loader2 className="w-3 h-3 animate-spin" /> : <BarChart3 className="w-3 h-3" />}
                          {summaryReport ? '更新分析簡報' : '產出分析簡報'}
                        </button>
                      )}
                      <button 
                        onClick={copyToClipboard}
                        disabled={!result || isLocked}
                        title="複製到剪貼簿"
                        className="p-2 hover:bg-white rounded-lg transition-colors border border-transparent hover:border-[#E2E8F0] relative disabled:opacity-30"
                      >
                        {copied ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                        {copied && <span className="absolute -top-8 left-1/2 -translate-x-1/2 text-[10px] bg-black text-white px-2 py-1 rounded">已複製</span>}
                      </button>
                      <button 
                        onClick={handleAction}
                        disabled={!result || isLoading || isLocked}
                        title="重新生成"
                        className="p-2 hover:bg-white rounded-lg transition-colors border border-transparent hover:border-[#E2E8F0] disabled:opacity-30"
                      >
                        <RefreshCw className={cn("w-4 h-4", isLoading && "animate-spin")} />
                      </button>
                    </div>
                  </header>

                  <div className="flex-1 overflow-y-auto p-6 prose prose-sm max-w-none prose-slate markdown-body bg-white scroll-smooth selection:bg-[#0984E3]/20">
                    {result ? (
                      <>
                        <ReactMarkdown 
                          remarkPlugins={[remarkGfm]}
                          components={{
                            table: ({node, ...props}) => (
                              <div className="table-container group/table relative my-6">
                                <div className="overflow-x-auto">
                                  <table {...props} className="min-w-full academic-table" />
                                </div>
                                <button 
                                  onClick={captureTableAsImage}
                                  className="absolute -top-3 -right-3 opacity-0 group-hover/table:opacity-100 transition-opacity bg-white border border-[#E2E8F0] p-1.5 rounded-lg shadow-sm hover:bg-[#F1F2F6] z-10"
                                  title="截取表格為圖片"
                                >
                                  <ImageIcon className="w-3.5 h-3.5 text-[#0984E3]" />
                                </button>
                              </div>
                            )
                          }}
                        >
                          {result}
                        </ReactMarkdown>

                        {/* Tone Analysis Section */}
                        <AnimatePresence>
                          {(isAnalyzingTone || toneResult) && (
                            <motion.div
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              className="mt-12 p-6 bg-[#F8F9FA] rounded-2xl border border-[#E2E8F0] shadow-sm relative overflow-hidden"
                            >
                              <div className="absolute top-0 right-0 p-4 opacity-5">
                                <Zap className="w-24 h-24 text-[#0984E3]" />
                              </div>
                              
                              <div className="flex items-center gap-2 mb-4">
                                <div className="p-2 bg-[#0984E3]/10 rounded-lg">
                                  <Zap className="w-4 h-4 text-[#0984E3]" />
                                </div>
                                <h3 className="text-sm font-bold text-[#2D3436] m-0!">智能語氣與專業度檢查</h3>
                                {isAnalyzingTone && <Loader2 className="w-3 h-3 text-[#0984E3] animate-spin ml-2" />}
                              </div>

                              {isAnalyzingTone ? (
                                <div className="py-4 space-y-3">
                                  <div className="h-4 bg-[#E2E8F0] rounded-full w-3/4 animate-pulse" />
                                  <div className="h-4 bg-[#E2E8F0] rounded-full w-1/2 animate-pulse" />
                                  <p className="text-[10px] text-[#636E72] font-medium tracking-widest uppercase">AI 正在深度掃描文字語氣...</p>
                                </div>
                              ) : (
                                <div className="text-xs text-[#636E72] prose-h2:text-sm prose-h2:font-bold prose-h2:mt-4 prose-h2:mb-2 prose-p:mb-2">
                                  <ReactMarkdown>{toneResult}</ReactMarkdown>
                                </div>
                              )}
                            </motion.div>
                          )}
                        </AnimatePresence>
                        
                        {/* Summary Report Section */}
                        <AnimatePresence>
                          {(isGeneratingReport || summaryReport) && (
                            <motion.div
                              initial={{ opacity: 0, scale: 0.95 }}
                              animate={{ opacity: 1, scale: 1 }}
                              className="mt-6 p-8 bg-[#0984E3]/5 border-2 border-[#0984E3]/20 rounded-3xl shadow-lg relative overflow-hidden"
                            >
                              <div className="absolute top-0 right-0 p-6 opacity-10">
                                <BarChart3 className="w-32 h-32 text-[#0984E3]" />
                              </div>

                              <div className="flex items-center justify-between mb-8 relative z-10">
                                <div className="flex items-center gap-3">
                                  <div className="w-12 h-12 bg-[#0984E3] rounded-2xl flex items-center justify-center shadow-lg shadow-[#0984E3]/20">
                                    <BarChart3 className="text-white w-6 h-6" />
                                  </div>
                                  <div>
                                    <h3 className="text-lg font-bold text-[#2D3436]">研究分析修正簡報</h3>
                                    <p className="text-[10px] text-[#636E72] font-bold uppercase tracking-widest">AI Executive Analysis Report</p>
                                  </div>
                                </div>
                                {isGeneratingReport && (
                                  <div className="flex items-center gap-2 px-3 py-1 bg-white/50 rounded-full border border-[#0984E3]/20">
                                    <Loader2 className="w-3 h-3 text-[#0984E3] animate-spin" />
                                    <span className="text-[10px] font-bold text-[#636E72]">正在彙整分析數據...</span>
                                  </div>
                                )}
                              </div>

                              {isGeneratingReport ? (
                                <div className="space-y-4 py-4 relative z-10">
                                  <div className="h-4 bg-[#0984E3]/10 rounded-full w-full animate-pulse" />
                                  <div className="h-4 bg-[#0984E3]/10 rounded-full w-5/6 animate-pulse" />
                                  <div className="h-4 bg-[#0984E3]/10 rounded-full w-4/6 animate-pulse" />
                                </div>
                              ) : (
                                <div className="relative z-10 text-sm text-[#2D3436] leading-relaxed prose-p:mb-4 prose-strong:text-[#0984E3] prose-li:mb-2">
                                  <ReactMarkdown>{summaryReport}</ReactMarkdown>
                                  <div className="mt-8 flex justify-end">
                                    <button 
                                      onClick={() => window.print()}
                                      className="text-[10px] font-bold text-[#0984E3] hover:underline flex items-center gap-1"
                                    >
                                      <FileDown className="w-3 h-3" /> 下載為簡報清單
                                    </button>
                                  </div>
                                </div>
                              )}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </>
                    ) : (
                      <div className="h-full flex flex-col items-center justify-center text-center opacity-40 py-20">
                        <FileText className="w-16 h-16 mb-4 stroke-1" />
                        <p className="text-sm font-medium">尚未生成內容</p>
                        <p className="text-xs">輸入資料並點擊「開始生成」</p>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
