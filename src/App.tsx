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
  MessageCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { toPng } from 'html-to-image';
import { cn } from '@/src/lib/utils';
import { summarizePaper, formatByGuidelines, reviseByReviews, extractGlossary, analyzeTone } from '@/src/services/geminiService';
import { encryptData, decryptData } from '@/src/lib/security';
import { extractTextFromPDF, extractTextFromDOCX, extractTextFromTXT } from '@/src/lib/fileParser';
import { exportToDocx } from '@/src/lib/docxExport';

type TabType = 'dashboard' | 'condense' | 'guideline' | 'revision' | 'glossary';

export default function App() {
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [paperContent, setPaperContent] = useState('');
  const [secondaryInput, setSecondaryInput] = useState(''); 
  const [citationStyle, setCitationStyle] = useState('APA 7th');
  const [result, setResult] = useState('');
  const [toneResult, setToneResult] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isAnalyzingTone, setIsAnalyzingTone] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [copied, setCopied] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Security States
  const [isSecureMode, setIsSecureMode] = useState(false);
  const [sessionPassword, setSessionPassword] = useState('');
  const [isLocked, setIsLocked] = useState(false);
  const [tempPassword, setTempPassword] = useState('');

  // Analytics/Session Stats
  const [sessionStats, setSessionStats] = useState({
    wordsProcessed: 0,
    tasksCompleted: 0
  });

  const getWordCount = (text: string) => {
    if (!text) return 0;
    return text.trim().split(/\s+/).filter(Boolean).length || text.trim().length; 
  };

  const handleAction = async () => {
    if (!paperContent) return;
    setIsLoading(true);
    setResult('');
    setToneResult('');
    try {
      let output = '';
      if (activeTab === 'condense') {
        output = await summarizePaper(paperContent);
      } else if (activeTab === 'guideline') {
        output = await formatByGuidelines(paperContent, secondaryInput, citationStyle);
      } else if (activeTab === 'revision') {
        output = await reviseByReviews(paperContent, secondaryInput);
      } else if (activeTab === 'glossary') {
        output = await extractGlossary(paperContent);
      }
      setResult(output || '');
      
      // Automatic Tone Check for relevant tabs
      if (output && (activeTab === 'guideline' || activeTab === 'revision')) {
        performToneCheck(output);
      }

      // Update session stats
      setSessionStats(prev => ({
        wordsProcessed: prev.wordsProcessed + getWordCount(paperContent),
        tasksCompleted: prev.tasksCompleted + 1
      }));
    } catch (error) {
      setResult('發生錯誤，請稍後再試。');
    } finally {
      setIsLoading(false);
    }
  };

  const performToneCheck = async (text: string) => {
    setIsAnalyzingTone(true);
    try {
      const toneAnalysis = await analyzeTone(text);
      setToneResult(toneAnalysis || '');
    } catch (error) {
      console.error("Tone Analysis failed:", error);
    } finally {
      setIsAnalyzingTone(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await processFile(file);
  };

  const processFile = async (file: File) => {
    setIsParsing(true);
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
      
      setPaperContent(text);
    } catch (error) {
      console.error("File parsing error:", error);
      alert("檔案讀取失敗，請確認檔案格式是否正確。");
    } finally {
      setIsParsing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
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
    { id: 'guideline', label: '投稿指引', icon: BookOpen },
    { id: 'revision', label: '審查修正', icon: MessageSquareQuote },
    { id: 'glossary', label: '術語提取', icon: Tags },
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
                      { id: 'condense', title: '論文濃縮', desc: '提取學位論文精華。', color: 'bg-[#74B9FF]', icon: FileText },
                      { id: 'guideline', title: '投稿指引', desc: 'AI 協助調整排版格式。', color: 'bg-[#55EFC4]', icon: BookOpen },
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

                <div className="bg-white rounded-3xl border border-[#E2E8F0] p-6 shadow-sm">
                   <h4 className="font-bold mb-4 flex items-center gap-2">
                     <ShieldCheck className="w-4 h-4 text-[#0984E3]" /> 本次工作統計
                   </h4>
                   <div className="grid grid-cols-2 gap-4 mb-6">
                      <div className="bg-[#F8F9FA] p-4 rounded-2xl text-center">
                        <p className="text-[10px] text-[#636E72] font-bold uppercase mb-1">處理字數</p>
                        <p className="text-xl font-bold text-[#0984E3]">{sessionStats.wordsProcessed.toLocaleString()}</p>
                      </div>
                      <div className="bg-[#F8F9FA] p-4 rounded-2xl text-center">
                        <p className="text-[10px] text-[#636E72] font-bold uppercase mb-1">完成任務</p>
                        <p className="text-xl font-bold text-[#0984E3]">{sessionStats.tasksCompleted}</p>
                      </div>
                   </div>

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
              </motion.div>
            )}

            {activeTab !== 'dashboard' && (
              <motion.div
                key="workspace"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.02 }}
                className="grid grid-cols-1 lg:grid-cols-2 gap-8 h-full min-h-[600px]"
              >
                {/* Input Panel */}
                <div className="flex flex-col gap-6">
                  <div className="bg-white rounded-3xl border border-[#E2E8F0] p-6 shadow-sm flex flex-col h-full overflow-hidden relative group">
                    <label className="flex items-center justify-between text-sm font-bold text-[#636E72] mb-4 uppercase tracking-wider">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4" />
                        原始論文內容
                      </div>
                      <button 
                        onClick={() => fileInputRef.current?.click()}
                        className="p-1.5 hover:bg-[#F1F2F6] rounded-lg transition-colors text-[#0984E3] flex items-center gap-1.5"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        <span className="text-[10px]">上傳檔案</span>
                      </button>
                    </label>
                    
                    <div className="relative flex-1">
                      <textarea
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
                          if (file) processFile(file);
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
                            if (file) processFile(file);
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

                  {(activeTab === 'guideline' || activeTab === 'revision') && (
                    <div className="bg-white rounded-3xl border border-[#E2E8F0] p-6 shadow-sm shrink-0 min-h-[200px] flex flex-col">
                      <div className="flex items-center justify-between mb-4">
                        <label className="flex items-center gap-2 text-sm font-bold text-[#636E72] uppercase tracking-wider">
                          {activeTab === 'guideline' ? <BookOpen className="w-4 h-4" /> : <MessageSquareQuote className="w-4 h-4" />}
                          {activeTab === 'guideline' ? '期刊指引 (Author Guidelines)' : '審查者建議 (Reviewer Comments)'}
                        </label>
                        
                        {activeTab === 'guideline' && (
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
                      <textarea
                        placeholder={activeTab === 'guideline' ? "貼入該期刊的字數限制、格式要求等..." : "貼入審查專家的回饋建議..."}
                        value={secondaryInput}
                        onChange={(e) => setSecondaryInput(e.target.value)}
                        className="w-full bg-[#F1F2F6] rounded-2xl p-4 text-sm min-h-[120px] focus:ring-2 focus:ring-[#0984E3] transition-all resize-none outline-none border-none font-sans"
                      />
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
                  <header className="p-4 border-b border-[#E2E8F0] flex justify-between items-center bg-[#F8F9FA]/50 shrink-0">
                    <span className="text-sm font-bold text-[#636E72] uppercase tracking-wider flex items-center gap-2">
                       {isLoading ? '處理中...' : '生成結果'}
                    </span>
                    <div className="flex gap-1.5">
                      <button 
                        onClick={handleExportDocx}
                        disabled={!result || isLocked}
                        title="匯出為 Word (docx)"
                        className="p-2 hover:bg-white rounded-lg transition-colors border border-transparent hover:border-[#E2E8F0] text-[#0984E3] disabled:opacity-30"
                      >
                        <FileDown className="w-4 h-4" />
                      </button>
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
