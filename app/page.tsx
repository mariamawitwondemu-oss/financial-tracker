"use client";

import React, { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { User } from "@supabase/supabase-js";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import {
  LayoutDashboard,
  Target,
  ShieldCheck,
  PlusCircle,
  UploadCloud,
  Settings as SettingsIcon,
  Sun,
  Moon,
  Pencil,
  Trash2,
  Repeat,
  PieChart as PieChartIcon,
  BarChart3,
  Save,
  LogOut,
  TrendingUp,
  TrendingDown,
  Scale,
  Sparkles,
  Wallet,
} from "lucide-react";

export interface Transaction {
  id: string;
  user_id: string;
  date: string;
  type: "income" | "expense" | "loan";
  amount_etb: number;
  original_currency: "ETB" | "USD";
  original_amount: number;
  category: string;
  description: string;
  is_recurring?: boolean;
}

export interface SavingsGoal {
  id: string;
  user_id: string;
  title: string;
  target_amount: number;
  current_amount: number;
}

const DEFAULT_CATEGORY_COLORS: Record<string, string> = {
  Food: "#F59E0B",            // Amber
  "Transport / Fuel": "#0EA5E9", // Light Blue
  "Car Expenses": "#64748B",     // Slate
  "Loans & Ekub": "#8B5CF6",     // Purple
  "Personal & Date": "#EC4899",  // Pink
  "Income Stream": "#10B981",    // Emerald
  General: "#94A3B8",            // Gray
};

function FontImports() {
  return null; // Handled globally via globals.css
}

export default function UltimatePlannerApp() {
  // Theme & Auth State - Lazy loaded to avoid linter setState-in-effect issues
  const [theme, setTheme] = useState<"dark" | "light">((() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("fp_theme");
      return (saved === "light" || saved === "dark") ? saved : "light";
    }
    return "light";
  }));
  const [user, setUser] = useState<User | null>(null);
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [authName, setAuthName] = useState("");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authMessage, setAuthMessage] = useState("");

  // App Settings
  const [usdRate, setUsdRate] = useState<number>((() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("fp_usd_rate");
      return saved ? parseFloat(saved) : 180;
    }
    return 180;
  }));
  const [activeTab, setActiveTab] = useState<"dashboard" | "add" | "budgets" | "goals" | "csv" | "settings">("dashboard");
  const [loading, setLoading] = useState<boolean>(false);

  // Core Data State
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  const [budgets, setBudgets] = useState<Record<string, number>>((() => {
    const defaultBudgets = {
      Food: 8000,
      "Transport / Fuel": 5000,
      "Car Expenses": 10000,
      "Personal & Date": 4000,
      General: 3000,
    };
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("fp_budgets");
      if (saved) {
        try { return JSON.parse(saved); } catch { return defaultBudgets; }
      }
    }
    return defaultBudgets;
  }));
  const [tempBudgets, setTempBudgets] = useState<Record<string, number>>({ ...budgets });
  const [budgetSaveMessage, setBudgetSaveMessage] = useState("");
  const [goals, setGoals] = useState<SavingsGoal[]>((() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("fp_goals");
      if (saved) {
        try { return JSON.parse(saved); } catch { return []; }
      }
    }
    return [];
  }));

  // Editing State
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);

  // Timeframe Filters
  const [timeframe, setTimeframe] = useState<"monthly" | "yearly" | "all">("monthly");
  const [selectedYear, setSelectedYear] = useState<string>("2026");
  const [selectedMonth, setSelectedMonth] = useState<string>("08");

  // Manual Form State
  const [formDate, setFormDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [formType, setFormType] = useState<"income" | "expense" | "loan">("expense");
  const [formAmount, setFormAmount] = useState<string>("");
  const [formCurrency, setFormCurrency] = useState<"ETB" | "USD">("ETB");
  const [formCategory, setFormCategory] = useState<string>("Food");
  const [formDescription, setFormDescription] = useState<string>("");
  const [formIsRecurring, setFormIsRecurring] = useState<boolean>(false);

  // Savings Goal Form States
  const [goalTitle, setGoalTitle] = useState("");
  const [goalTarget, setGoalTarget] = useState("");
  const [goalDeposit, setGoalDeposit] = useState<{ id: string; amount: string } | null>(null);

  // CSV Data State
  const [csvContent, setCsvContent] = useState<string>("");

  // Hoisted Cloud Sync Fetcher
  const fetchCloudTransactions = async (userId: string) => {
    setLoading(true);
    const { data, error } = await supabase
      .from("transactions")
      .select("*")
      .eq("user_id", userId)
      .order("date", { ascending: false });

    if (error) {
      console.error("Error fetching transactions:", error.message);
    } else if (data) {
      setAllTransactions(data as Transaction[]);
    }
    setLoading(false);
  };

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    localStorage.setItem("fp_theme", next);
  };

  // Auth Status listener
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Fetch transactions asynchronously in effect
  useEffect(() => {
    if (user) {
      const timer = setTimeout(() => {
        fetchCloudTransactions(user.id);
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [user]);

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthMessage("");

    if (authMode === "signup") {
      setAuthMessage("Creating secure account...");
      const { error } = await supabase.auth.signUp({
        email: authEmail,
        password: authPassword,
        options: {
          data: { display_name: authName || authEmail.split("@")[0] },
        },
      });

      if (error) setAuthMessage("Error: " + error.message);
      else setAuthMessage("Verification email sent! Check your inbox or log in.");
    } else {
      setAuthMessage("Securing portal connection...");
      const { error } = await supabase.auth.signInWithPassword({
        email: authEmail,
        password: authPassword,
      });

      if (error) setAuthMessage("Error: " + error.message);
      else setAuthMessage("");
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setAllTransactions([]);
  };

  // TRANSACTIONS MANAGEMENT
  const handleAddManual = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formAmount || !user) return;

    const rawAmt = parseFloat(formAmount);
    const amountETB = formCurrency === "USD" ? rawAmt * usdRate : rawAmt;

    const newTx = {
      id: "tx-" + Date.now() + "-" + Math.random().toString(36).substring(2, 6),
      user_id: user.id,
      date: formDate,
      type: formType,
      amount_etb: amountETB,
      original_currency: formCurrency,
      original_amount: rawAmt,
      category: formCategory,
      description: formDescription || formCategory,
      is_recurring: formIsRecurring,
    };

    const { error } = await supabase.from("transactions").insert([newTx]);

    if (error) {
      alert("Error saving: " + error.message);
    } else {
      await fetchCloudTransactions(user.id);
      setFormAmount("");
      setFormDescription("");
      setFormIsRecurring(false);
      setActiveTab("dashboard");
    }
  };

  const handleUpdateTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTx || !user) return;

    const rawAmt = Number(editingTx.original_amount);
    const amountETB = editingTx.original_currency === "USD" ? rawAmt * usdRate : rawAmt;

    const { error } = await supabase
      .from("transactions")
      .update({
        date: editingTx.date,
        type: editingTx.type,
        amount_etb: amountETB,
        original_currency: editingTx.original_currency,
        original_amount: rawAmt,
        category: editingTx.category,
        description: editingTx.description,
        is_recurring: editingTx.is_recurring,
      })
      .eq("id", editingTx.id)
      .eq("user_id", user.id);

    if (error) {
      alert("Failed to update: " + error.message);
    } else {
      await fetchCloudTransactions(user.id);
      setEditingTx(null);
    }
  };

  const handleDeleteTransaction = async (id: string) => {
    if (!user || !confirm("Delete this transaction entry?")) return;
    const { error } = await supabase.from("transactions").delete().eq("id", id).eq("user_id", user.id);
    if (error) alert("Failed to delete: " + error.message);
    else await fetchCloudTransactions(user.id);
  };

  const handleClearAllData = async () => {
    if (!user) return;
    const confirmation = prompt('Type "DELETE" to permanently wipe all your transaction records:');
    if (confirmation !== "DELETE") return;

    setLoading(true);
    const { error } = await supabase.from("transactions").delete().eq("user_id", user.id);

    if (error) alert("Error clearing data: " + error.message);
    else {
      alert("All records cleared successfully.");
      await fetchCloudTransactions(user.id);
    }
    setLoading(false);
  };

  // BUDGET SAVING
  const handleSaveAllBudgets = () => {
    setBudgets(tempBudgets);
    localStorage.setItem("fp_budgets", JSON.stringify(tempBudgets));
    setBudgetSaveMessage("Budgets updated successfully!");
    setTimeout(() => setBudgetSaveMessage(""), 3000);
  };

  // SAVINGS GOALS
  const handleAddGoal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!goalTitle || !goalTarget || !user) return;

    const newGoal: SavingsGoal = {
      id: "goal-" + Date.now(),
      user_id: user.id,
      title: goalTitle,
      target_amount: parseFloat(goalTarget),
      current_amount: 0,
    };

    const updated = [...goals, newGoal];
    setGoals(updated);
    localStorage.setItem("fp_goals", JSON.stringify(updated));
    setGoalTitle("");
    setGoalTarget("");
  };

  const handleDepositGoal = (id: string, amountStr: string) => {
    const deposit = parseFloat(amountStr);
    if (isNaN(deposit) || deposit <= 0) return;

    const updated = goals.map((g) => (g.id === id ? { ...g, current_amount: g.current_amount + deposit } : g));
    setGoals(updated);
    localStorage.setItem("fp_goals", JSON.stringify(updated));
    setGoalDeposit(null);
  };

  // CSV FILE IMPORT
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      if (text) setCsvContent(text);
    };
    reader.readAsText(file);
  };

  const handleCustomCsvImport = async () => {
    if (!csvContent.trim() || !user) return;

    const lines = csvContent.split("\n").map((l) => l.trim()).filter(Boolean);
    const parsedData: Transaction[] = [];
    const startIndex = lines[0].toLowerCase().includes("date") ? 1 : 0;

    for (let i = startIndex; i < lines.length; i++) {
      const parts = lines[i].split(",").map((p) => p.replace(/^"|"$/g, "").trim());
      if (parts.length < 3) continue;

      const date = parts[0] || new Date().toISOString().split("T")[0];
      const typeStr = (parts[1] || "expense").toLowerCase();
      const type = typeStr.includes("inc") ? "income" : typeStr.includes("loan") ? "loan" : "expense";
      const rawAmt = parseFloat(parts[2]) || 0;
      const currency = (parts[3] || "ETB").toUpperCase() === "USD" ? "USD" : "ETB";
      const category = parts[4] || "General";
      const description = parts[5] || category;
      const amountETB = currency === "USD" ? rawAmt * usdRate : rawAmt;

      parsedData.push({
        id: `csv-${i}-${Math.random().toString(36).substring(2, 7)}`,
        user_id: user.id,
        date,
        type,
        amount_etb: amountETB,
        original_currency: currency,
        original_amount: rawAmt,
        category,
        description,
      });
    }

    const { error } = await supabase.from("transactions").insert(parsedData);

    if (error) alert("Error importing CSV: " + error.message);
    else {
      await fetchCloudTransactions(user.id);
      setCsvContent("");
      setActiveTab("dashboard");
    }
  };

  // =========================================================================
  // REACT COMPILER-SAFE CALCULATIONS (No manual useMemo to prevent warnings)
  // =========================================================================
  
  const filteredTransactions = allTransactions.filter((t) => {
    if (timeframe === "all") return true;
    const d = new Date(t.date);
    if (isNaN(d.getTime())) return true;

    const y = d.getFullYear().toString();
    const m = String(d.getMonth() + 1).padStart(2, "0");

    if (timeframe === "yearly") return y === selectedYear;
    if (timeframe === "monthly") return y === selectedYear && m === selectedMonth;
    return true;
  });

  const categoryTotals = (() => {
    const expenses = filteredTransactions.filter((t) => t.type === "expense");
    const map: Record<string, number> = {};
    expenses.forEach((t) => {
      map[t.category] = (map[t.category] || 0) + Number(t.amount_etb);
    });
    return map;
  })();

  const recurringBills = allTransactions.filter((t) => t.type === "expense" && t.is_recurring);

  const totalIncome = filteredTransactions.filter((t) => t.type === "income").reduce((acc, curr) => acc + Number(curr.amount_etb), 0);
  const totalExpense = filteredTransactions.filter((t) => t.type === "expense").reduce((acc, curr) => acc + Number(curr.amount_etb), 0);

  const categoryChartData = Object.keys(categoryTotals).map((cat) => ({
    name: cat,
    value: categoryTotals[cat],
    color: DEFAULT_CATEGORY_COLORS[cat] || DEFAULT_CATEGORY_COLORS.General,
  }));

  const barChartData = (() => {
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return months.map((m, idx) => {
      const monthNum = String(idx + 1).padStart(2, "0");
      const monthTx = allTransactions.filter((t) => {
        const d = new Date(t.date);
        if (isNaN(d.getTime())) return false;
        return d.getFullYear().toString() === selectedYear && String(d.getMonth() + 1).padStart(2, "0") === monthNum;
      });

      const income = monthTx.filter((t) => t.type === "income").reduce((acc, curr) => acc + Number(curr.amount_etb), 0);
      const expense = monthTx.filter((t) => t.type === "expense").reduce((acc, curr) => acc + Number(curr.amount_etb), 0);

      return { month: m, Income: income, Expense: expense };
    });
  })();

  // STYLING TOKENS — a modern fintech palette: high contrast light mode / slate dark mode,
  // mint green for gains, and crimson alert for outflows.
  const isDark = theme === "dark";
  const bgClass = isDark ? "bg-[#0B0F19] text-[#F8FAFC]" : "bg-[#FAFAFA] text-[#0F172A]";
  const cardClass = isDark
    ? "bg-[#1E293B]/95 border-x border-b border-slate-700/50 border-t-[3px] border-t-[#38BDF8] shadow-[0_25px_60px_-25px_rgba(0,0,0,0.65)] backdrop-blur-xl"
    : "bg-white/95 border-x border-b border-slate-200/60 border-t-[3px] border-t-[#0284C7] shadow-[0_25px_60px_-30px_rgba(15,23,42,0.06)] backdrop-blur-xl";
  const inputClass = isDark
    ? "bg-slate-800 border-slate-700 text-white placeholder-slate-500 focus:border-[#38BDF8] focus:ring-1 focus:ring-[#38BDF8]"
    : "bg-white border-slate-200 text-slate-900 placeholder-slate-400 focus:border-[#0284C7] focus:ring-1 focus:ring-[#0284C7]";
  const subtleText = isDark ? "text-slate-400" : "text-slate-500";
  const hairline = isDark ? "border-slate-850" : "border-slate-200/60";
  const brassPill = isDark 
    ? "bg-[#38BDF8] text-slate-950 font-bold shadow-sm rounded-full transition-all duration-200"
    : "bg-[#0284C7] text-white font-bold shadow-sm rounded-full transition-all duration-200";
  const inactivePill = isDark 
    ? "text-slate-450 hover:text-white hover:bg-slate-800/60" 
    : "text-slate-500 hover:text-slate-900 hover:bg-slate-100";

  const NAV_ITEMS: { key: typeof activeTab; label: string; icon: React.ElementType }[] = [
    { key: "dashboard", label: "Overview", icon: LayoutDashboard },
    { key: "budgets", label: "Budgets", icon: Target },
    { key: "goals", label: "Vaults", icon: ShieldCheck },
    { key: "add", label: "New Entry", icon: PlusCircle },
    { key: "csv", label: "Import", icon: UploadCloud },
    { key: "settings", label: "Settings", icon: SettingsIcon },
  ];

  // AUTH LOGGED OUT SCREEN
  if (!user) {
    return (
      <div className={`min-h-screen ${bgClass} font-body flex items-center justify-center p-4 transition-colors duration-300 relative overflow-hidden`}>
        <FontImports />
        {/* ambient blue/green glow */}
        <div className="pointer-events-none absolute -top-40 -right-40 w-[32rem] h-[32rem] rounded-full bg-[#0284C7]/5 blur-[120px]" />
        <div className="pointer-events-none absolute -bottom-40 -left-40 w-[32rem] h-[32rem] rounded-full bg-[#10B981]/5 blur-[120px]" />

        <div className={`${cardClass} border rounded-[28px] max-w-md w-full relative z-10`}>
          <div className="p-8 space-y-7">
            <div className="flex justify-between items-start">
              <div>
                <p className="eyebrow text-[10px] font-semibold text-[#0284C7] mb-2">Neo-Bank Portal</p>
                <h1 className="font-display text-3xl font-semibold tracking-tight">
                  Money Planner
                </h1>
                <p className={`text-xs mt-1.5 ${subtleText}`}>Your income, spending and vaults — kept in one place.</p>
              </div>
              <button
                onClick={toggleTheme}
                aria-label="Toggle theme"
                className={`p-2.5 rounded-full border transition ${isDark ? "bg-slate-800 border-slate-700 text-[#38BDF8]" : "bg-slate-100 border-slate-200 text-[#0284C7]"}`}
              >
                {isDark ? <Sun size={16} /> : <Moon size={16} />}
              </button>
            </div>

            <div className={`p-1 rounded-2xl border flex gap-1 ${isDark ? "bg-slate-800/50 border-slate-700" : "bg-slate-100 border-slate-200"}`}>
              <button
                onClick={() => { setAuthMode("login"); setAuthMessage(""); }}
                className={`flex-1 py-2.5 rounded-xl text-xs font-semibold tracking-wide transition ${authMode === "login" ? brassPill : inactivePill}`}
              >
                Log In
              </button>
              <button
                onClick={() => { setAuthMode("signup"); setAuthMessage(""); }}
                className={`flex-1 py-2.5 rounded-xl text-xs font-semibold tracking-wide transition ${authMode === "signup" ? brassPill : inactivePill}`}
              >
                Sign Up
              </button>
            </div>

            <form onSubmit={handleAuthSubmit} className="space-y-4">
              {authMode === "signup" && (
                <div>
                  <label className="eyebrow block text-[10px] font-semibold mb-1.5 text-slate-400">Full Name</label>
                  <input type="text" placeholder="Full name" value={authName} onChange={(e) => setAuthName(e.target.value)} className={`w-full border rounded-xl p-3.5 text-sm focus:outline-none transition ${inputClass}`} required />
                </div>
              )}
              <div>
                <label className="eyebrow block text-[10px] font-semibold mb-1.5 text-slate-400">Email Address</label>
                <input type="email" placeholder="name@domain.com" value={authEmail} onChange={(e) => setAuthEmail(e.target.value)} className={`w-full border rounded-xl p-3.5 text-sm focus:outline-none transition ${inputClass}`} required />
              </div>
              <div>
                <label className="eyebrow block text-[10px] font-semibold mb-1.5 text-slate-400">Password</label>
                <input type="password" placeholder="••••••••" value={authPassword} onChange={(e) => setAuthPassword(e.target.value)} className={`w-full border rounded-xl p-3.5 text-sm focus:outline-none transition ${inputClass}`} required minLength={6} />
              </div>

              {authMessage && (
                <p className={`text-xs font-medium p-3 rounded-xl text-center border ${authMessage.includes("Error") ? "bg-[#DC2626]/10 border-[#DC2626]/30 text-[#DC2626]" : "bg-[#16A34A]/10 border-[#16A34A]/30 text-[#16A34A]"}`}>
                  {authMessage}
                </p>
              )}

              <button type="submit" className={`w-full ${brassPill} font-semibold text-sm py-3.5 rounded-xl transition hover:brightness-105 active:brightness-95 tracking-wide`}>
                {authMode === "login" ? "Log In" : "Create Account"}
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // MAIN APP INTERFACE
  return (
    <div className={`min-h-screen ${bgClass} font-body p-3 sm:p-6 md:p-8 max-w-6xl mx-auto space-y-6 transition-colors duration-300`}>
      <FontImports />

      {/* HEADER / LETTERHEAD */}
      <header className={`${cardClass} border rounded-[28px] p-6`}>
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-5">
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${brassPill}`}>
              <Wallet size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="font-display text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">Money Planner</h1>
                <span className={`font-ledger text-[10px] border px-2.5 py-1 rounded-full font-semibold ${isDark ? "bg-slate-800 border-slate-700 text-[#38BDF8]" : "bg-slate-100 border-slate-200 text-[#0284C7]"}`}>
                  $1 = {usdRate} ETB
                </span>
              </div>
              <p className={`text-xs mt-1 ${subtleText}`}>
                Account holder — <strong className={isDark ? "text-white" : "text-slate-900"}>{user.user_metadata?.display_name || user.email}</strong>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={toggleTheme}
              aria-label="Toggle theme"
              className={`p-2.5 rounded-full border transition ${isDark ? "bg-slate-800 border-slate-700 text-[#38BDF8]" : "bg-slate-100 border-slate-200 text-[#0284C7]"}`}
            >
              {isDark ? <Sun size={16} /> : <Moon size={16} />}
            </button>
            <button onClick={handleSignOut} className={`flex items-center gap-1.5 px-3.5 py-2.5 border text-xs font-semibold rounded-full transition ${isDark ? "bg-slate-850 hover:bg-slate-800 border-red-900/30 text-red-400" : "bg-red-50 hover:bg-red-100 border-red-200/60 text-red-600"}`}>
              <LogOut size={13} /> Sign Out
            </button>
          </div>
        </div>

        {/* NAV — an index of the ledger */}
        <nav className={`flex flex-wrap items-center gap-1.5 mt-6 pt-5 border-t ${hairline}`}>
          {NAV_ITEMS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`flex items-center gap-1.5 px-4 py-2.5 rounded-full font-semibold text-xs tracking-wide transition ${activeTab === key ? brassPill : inactivePill}`}
            >
              <Icon size={14} />
              {label}
            </button>
          ))}
        </nav>
      </header>

      {/* DASHBOARD TAB */}
      {activeTab === "dashboard" && (
        <main className="space-y-6">
          {/* TIMEFRAME FILTER BAR */}
          <div className={`${cardClass} border rounded-[24px] p-4 flex flex-wrap justify-between items-center gap-4`}>
            <div className={`flex items-center p-1 rounded-2xl border ${isDark ? "bg-slate-800/50 border-slate-700" : "bg-slate-100 border-slate-200"}`}>
              <button onClick={() => setTimeframe("monthly")} className={`px-4 py-2 rounded-xl text-xs font-semibold transition ${timeframe === "monthly" ? brassPill : inactivePill}`}>Monthly</button>
              <button onClick={() => setTimeframe("yearly")} className={`px-4 py-2 rounded-xl text-xs font-semibold transition ${timeframe === "yearly" ? brassPill : inactivePill}`}>Yearly</button>
              <button onClick={() => setTimeframe("all")} className={`px-4 py-2 rounded-xl text-xs font-semibold transition ${timeframe === "all" ? brassPill : inactivePill}`}>All Time</button>
            </div>

            {timeframe !== "all" && (
              <div className="flex items-center gap-2">
                {timeframe === "monthly" && (
                  <select value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} className={`border text-xs p-3 rounded-xl font-semibold focus:outline-none ${inputClass}`}>
                    <option value="01">January</option><option value="02">February</option><option value="03">March</option><option value="04">April</option><option value="05">May</option><option value="06">June</option><option value="07">July</option><option value="08">August</option><option value="09">September</option><option value="10">October</option><option value="11">November</option><option value="12">December</option>
                  </select>
                )}
                <select value={selectedYear} onChange={(e) => setSelectedYear(e.target.value)} className={`border text-xs p-3 rounded-xl font-semibold focus:outline-none ${inputClass}`}>
                  <option value="2025">2025</option><option value="2026">2026</option>
                </select>
              </div>
            )}
          </div>

          {/* SUMMARY STATS */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className={`${cardClass} border rounded-[24px] p-6`}>
              <div className="flex items-center justify-between">
                <span className="eyebrow text-[10px] font-semibold text-[#0284C7]">Total Income</span>
                <TrendingUp size={15} className="text-[#16A34A]" />
              </div>
              <p className="font-ledger text-3xl font-semibold mt-3 text-[#16A34A]">
                {totalIncome.toLocaleString()} <span className={`text-xs font-medium ${subtleText}`}>ETB</span>
              </p>
            </div>
            <div className={`${cardClass} border rounded-[24px] p-6`}>
              <div className="flex items-center justify-between">
                <span className="eyebrow text-[10px] font-semibold text-[#0284C7]">Total Expense</span>
                <TrendingDown size={15} className="text-[#DC2626]" />
              </div>
              <p className="font-ledger text-3xl font-semibold mt-3 text-[#DC2626]">
                {totalExpense.toLocaleString()} <span className={`text-xs font-medium ${subtleText}`}>ETB</span>
              </p>
            </div>
            <div className={`${cardClass} border rounded-[24px] p-6`}>
              <div className="flex items-center justify-between">
                <span className="eyebrow text-[10px] font-semibold text-[#0284C7]">Net Balance</span>
                <Scale size={15} className="text-[#0284C7]" />
              </div>
              <p className={`font-ledger text-3xl font-semibold mt-3 ${totalIncome - totalExpense >= 0 ? "text-[#16A34A]" : "text-[#DC2626]"}`}>
                {(totalIncome - totalExpense).toLocaleString()} <span className={`text-xs font-medium ${subtleText}`}>ETB</span>
              </p>
            </div>
          </div>

          {/* VISUAL CHARTS */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* CATEGORY DONUT CHART */}
            <div className={`${cardClass} border rounded-[24px] p-6 flex flex-col justify-between`}>
              <h2 className="font-display text-base font-semibold mb-4 flex items-center gap-2 text-slate-900 dark:text-white">
                <PieChartIcon size={16} className="text-[#0284C7]" /> Expense Breakdown
              </h2>
              {categoryChartData.length === 0 ? (
                <div className={`h-64 flex items-center justify-center text-xs ${subtleText}`}>No expense records found.</div>
              ) : (
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={categoryChartData} cx="50%" cy="50%" innerRadius={60} outerRadius={85} paddingAngle={4} dataKey="value">
                        {categoryChartData.map((entry, idx) => (
                          <Cell key={`cell-${idx}`} fill={entry.color} stroke="none" />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ backgroundColor: isDark ? "#1E293B" : "#ffffff", borderColor: "#0284C7", borderRadius: "14px", fontFamily: "Inter" }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {/* MONTHLY COMPARISON BAR CHART */}
            <div className={`${cardClass} border rounded-[24px] p-6 flex flex-col justify-between`}>
              <h2 className="font-display text-base font-semibold mb-4 flex items-center gap-2 text-slate-900 dark:text-white">
                <BarChart3 size={16} className="text-[#0284C7]" /> {selectedYear} Income vs Expenses
              </h2>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={barChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke={isDark ? "#334155" : "#E2E8F0"} vertical={false} />
                    <XAxis dataKey="month" stroke={isDark ? "#94A3B8" : "#64748B"} fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis stroke={isDark ? "#94A3B8" : "#64748B"} fontSize={11} tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={{ backgroundColor: isDark ? "#1E293B" : "#ffffff", borderColor: "#0284C7", borderRadius: "14px", fontFamily: "Inter" }} cursor={{ fill: isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)" }} />
                    <Bar dataKey="Income" fill="#16A34A" radius={[6, 6, 0, 0]} />
                    <Bar dataKey="Expense" fill="#DC2626" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* BUDGET PROGRESS TRACKERS */}
          <div className={`${cardClass} border rounded-[24px] p-6 space-y-4`}>
            <div className="flex justify-between items-center">
              <h2 className="font-display text-base font-semibold flex items-center gap-2 text-slate-900 dark:text-white">
                <Target size={16} className="text-[#0284C7]" /> Category Budget Progress
              </h2>
              <button onClick={() => setActiveTab("budgets")} className="text-xs text-[#0284C7] font-semibold hover:underline">Edit Limits &rarr;</button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Object.keys(budgets).map((cat) => {
                const limit = budgets[cat] || 0;
                const spent = categoryTotals[cat] || 0;
                const percentage = limit > 0 ? Math.min(Math.round((spent / limit) * 100), 100) : 0;
                const barColor = percentage >= 100 ? "bg-[#DC2626]" : percentage >= 80 ? "bg-[#F59E0B]" : "bg-[#16A34A]";

                return (
                  <div key={cat} className={`p-4 border rounded-2xl space-y-2.5 ${isDark ? "bg-slate-800/30 border-slate-700" : "bg-slate-50/50 border-slate-200/50"}`}>
                    <div className="flex justify-between items-center text-xs font-semibold">
                      <span>{cat}</span>
                      <span className={`font-ledger ${spent > limit ? "text-[#DC2626] font-bold" : subtleText}`}>
                        {spent.toLocaleString()} / {limit.toLocaleString()} ETB ({percentage}%)
                      </span>
                    </div>
                    <div className={`w-full rounded-full h-2 overflow-hidden ${isDark ? "bg-slate-800" : "bg-slate-100"}`}>
                      <div className={`h-full ${barColor} transition-all duration-500 rounded-full`} style={{ width: `${percentage}%` }}></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* RECURRING BILLS */}
          {recurringBills.length > 0 && (
            <div className={`${cardClass} border rounded-[24px] p-6 space-y-3`}>
              <h2 className="font-display text-base font-semibold flex items-center gap-2 text-[#0284C7]">
                <Repeat size={16} /> Recurring Bills &amp; Subscriptions
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {recurringBills.map((bill) => (
                  <div key={bill.id} className="p-3.5 border rounded-2xl flex justify-between items-center border-[#0284C7]/20 bg-[#0284C7]/[0.04]">
                    <div>
                      <p className="text-xs font-semibold">{bill.description}</p>
                      <span className="text-[10px] text-[#0284C7] font-medium">{bill.category}</span>
                    </div>
                    <p className="font-ledger font-semibold text-sm">{Number(bill.amount_etb).toLocaleString()} ETB</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* LEDGER WITH EDIT / DELETE */}
          <div className={`${cardClass} border rounded-[24px] overflow-hidden`}>
            <div className={`p-5 border-b ${hairline} flex justify-between items-center`}>
              <h2 className="font-display text-base font-semibold text-slate-900 dark:text-white">Cloud Transaction Ledger <span className={`font-body font-normal text-sm ${subtleText}`}>({filteredTransactions.length})</span></h2>
              {loading && <span className="text-xs text-[#0284C7] font-semibold animate-pulse flex items-center gap-1.5"><Sparkles size={12} /> Syncing...</span>}
            </div>

            {filteredTransactions.length === 0 ? (
              <div className={`p-10 text-center text-xs ${subtleText}`}>No entries for this period yet. Add one from New Entry.</div>
            ) : (
              <div className={`divide-y ${isDark ? "divide-slate-800" : "divide-slate-100"} max-h-96 overflow-y-auto`}>
                {filteredTransactions.map((tx) => (
                  <div key={tx.id} className="p-4 pl-5 border-l-2 border-transparent hover:border-l-[#0284C7] transition flex justify-between items-center gap-4 group hover:bg-slate-500/5">
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-[10px] uppercase font-bold px-2.5 py-0.5 rounded-full border ${
                          tx.type === "income" 
                            ? "bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/30" 
                            : "bg-red-50 text-red-600 border-red-100 dark:bg-red-950/20 dark:text-red-400 dark:border-red-900/30"
                        }`}>
                          {tx.type}
                        </span>
                        {tx.is_recurring && <span className="text-[10px] bg-[#0284C7]/10 text-[#0284C7] border border-[#0284C7]/20 px-2 py-0.5 rounded-full font-semibold flex items-center gap-1"><Repeat size={9} /> Recurring</span>}
                        <span className={`text-xs ${subtleText}`}>{tx.date}</span>
                        <span className="text-xs px-2.5 py-0.5 rounded-full font-medium bg-slate-100 dark:bg-slate-800 text-slate-650 dark:text-slate-350">{tx.category}</span>
                      </div>
                      <p className="text-sm font-semibold truncate text-slate-900 dark:text-white">{tx.description}</p>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <p className={`font-ledger font-semibold ${tx.type === "income" ? "text-[#16A34A]" : "text-slate-900 dark:text-white"}`}>
                        {tx.type === "expense" ? "−" : "+"}{Number(tx.amount_etb).toLocaleString()} ETB
                      </p>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                        <button onClick={() => setEditingTx(tx)} aria-label="Edit entry" className={`p-2 rounded-xl transition ${isDark ? "hover:bg-slate-800 text-slate-400 hover:text-[#0284C7]" : "hover:bg-slate-100 text-slate-500 hover:text-[#0284C7]"}`}><Pencil size={13} /></button>
                        <button onClick={() => handleDeleteTransaction(tx.id)} aria-label="Delete entry" className={`p-2 rounded-xl transition ${isDark ? "hover:bg-slate-800 text-slate-400 hover:text-[#DC2626]" : "hover:bg-slate-100 text-slate-500 hover:text-[#DC2626]"}`}><Trash2 size={13} /></button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* EDIT TRANSACTION MODAL */}
          {editingTx && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50" onClick={() => setEditingTx(null)}>
              <div className={`${cardClass} border rounded-[24px] max-w-md w-full p-6 space-y-4`} onClick={(e) => e.stopPropagation()}>
                <h2 className="font-display text-lg font-semibold text-slate-900 dark:text-white">Edit Entry</h2>
                <form onSubmit={handleUpdateTransaction} className="space-y-3.5">
                  <div>
                    <label className="eyebrow block text-[10px] font-semibold mb-1 text-[#0284C7]">Date</label>
                    <input type="date" value={editingTx.date} onChange={(e) => setEditingTx({ ...editingTx, date: e.target.value })} className={`w-full border rounded-xl p-3 text-sm focus:outline-none ${inputClass}`} required />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="eyebrow block text-[10px] font-semibold mb-1 text-[#0284C7]">Type</label>
                      <select value={editingTx.type} onChange={(e) => setEditingTx({ ...editingTx, type: e.target.value as "income" | "expense" | "loan" })} className={`w-full border rounded-xl p-3 text-sm ${inputClass}`}>
                        <option value="expense">Expense</option>
                        <option value="income">Income</option>
                        <option value="loan">Loan Payment</option>
                      </select>
                    </div>
                    <div>
                      <label className="eyebrow block text-[10px] font-semibold mb-1 text-[#0284C7]">Currency</label>
                      <select value={editingTx.original_currency} onChange={(e) => setEditingTx({ ...editingTx, original_currency: e.target.value as "ETB" | "USD" })} className={`w-full border rounded-xl p-3 text-sm ${inputClass}`}>
                        <option value="ETB">ETB</option>
                        <option value="USD">USD ($)</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="eyebrow block text-[10px] font-semibold mb-1 text-[#0284C7]">Amount</label>
                    <input type="number" step="any" value={editingTx.original_amount} onChange={(e) => setEditingTx({ ...editingTx, original_amount: parseFloat(e.target.value) || 0 })} className={`w-full border rounded-xl p-3 text-sm font-ledger ${inputClass}`} required />
                  </div>
                  <div>
                    <label className="eyebrow block text-[10px] font-semibold mb-1 text-[#0284C7]">Category</label>
                    <select value={editingTx.category} onChange={(e) => setEditingTx({ ...editingTx, category: e.target.value })} className={`w-full border rounded-xl p-3 text-sm ${inputClass}`}>
                      <option value="Food">Food &amp; Grocery</option>
                      <option value="Transport / Fuel">Transport / Fuel</option>
                      <option value="Car Expenses">Car Maintenance</option>
                      <option value="Loans & Ekub">Loans &amp; Ekub</option>
                      <option value="Personal & Date">Personal &amp; Dates</option>
                      <option value="Income Stream">Income Stream</option>
                      <option value="General">General</option>
                    </select>
                  </div>
                  <div>
                    <label className="eyebrow block text-[10px] font-semibold mb-1 text-[#0284C7]">Description</label>
                    <input type="text" value={editingTx.description} onChange={(e) => setEditingTx({ ...editingTx, description: e.target.value })} className={`w-full border rounded-xl p-3 text-sm ${inputClass}`} />
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer pt-1 select-none text-xs font-bold text-slate-700 dark:text-slate-350">
                    <input type="checkbox" checked={editingTx.is_recurring || false} onChange={(e) => setEditingTx({ ...editingTx, is_recurring: e.target.checked })} className="rounded text-[#0284C7] focus:ring-0 w-4 h-4" />
                    <span>Make this a recurring monthly bill</span>
                  </label>
                  <div className="flex gap-2 pt-1">
                    <button type="button" onClick={() => setEditingTx(null)} className="flex-1 py-3 rounded-xl text-xs font-semibold border border-slate-200 dark:border-slate-700">Cancel</button>
                    <button type="submit" className={`flex-1 ${brassPill} font-semibold text-xs py-3 rounded-xl transition hover:brightness-105`}>Save Changes</button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </main>
      )}

      {/* CATEGORY BUDGETS TAB */}
      {activeTab === "budgets" && (
        <main className={`${cardClass} border rounded-[28px] max-w-2xl mx-auto p-6 space-y-6`}>
          <div>
            <h2 className="font-display text-lg font-semibold flex items-center gap-2 text-slate-900 dark:text-white"><Target size={17} className="text-[#0284C7]" /> Category Budget Limits</h2>
            <p className={`text-xs mt-1 ${subtleText}`}>Set monthly maximum spending thresholds per category.</p>
          </div>

          <div className="space-y-3">
            {["Food", "Transport / Fuel", "Car Expenses", "Personal & Date", "General"].map((cat) => (
              <div key={cat} className={`p-4 border rounded-2xl flex justify-between items-center gap-4 ${isDark ? "bg-slate-800/30 border-slate-700" : "bg-slate-50/50 border-slate-200/50"}`}>
                <span className="text-sm font-semibold text-slate-900 dark:text-white">{cat}</span>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={tempBudgets[cat] ?? 0}
                    onChange={(e) => setTempBudgets({ ...tempBudgets, [cat]: parseFloat(e.target.value) || 0 })}
                    className={`w-36 border rounded-xl p-2.5 text-xs font-ledger text-right focus:outline-none ${inputClass}`}
                  />
                  <span className={`text-xs font-semibold ${subtleText}`}>ETB</span>
                </div>
              </div>
            ))}
          </div>

          {budgetSaveMessage && (
            <p className="text-xs text-center font-semibold text-[#16A34A] bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30 p-3 rounded-2xl">
              {budgetSaveMessage}
            </p>
          )}

          <button onClick={handleSaveAllBudgets} className={`w-full ${brassPill} font-semibold text-sm py-3.5 rounded-xl transition hover:brightness-105 flex items-center justify-center gap-2`}>
            <Save size={15} /> Save All Budgets
          </button>
        </main>
      )}

      {/* SAVINGS VAULTS / GOALS TAB */}
      {activeTab === "goals" && (
        <main className="space-y-6 max-w-4xl mx-auto">
          <div className={`${cardClass} border rounded-[28px] p-6 space-y-4`}>
            <h2 className="font-display text-lg font-semibold flex items-center gap-2 text-slate-900 dark:text-white"><ShieldCheck size={17} className="text-[#0284C7]" /> Create Savings Vault</h2>
            <form onSubmit={handleAddGoal} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <input type="text" placeholder="Vault title (e.g. New PC)" value={goalTitle} onChange={(e) => setGoalTitle(e.target.value)} className={`border rounded-xl p-3 text-xs font-semibold ${inputClass}`} required />
              <input type="number" placeholder="Target amount (ETB)" value={goalTarget} onChange={(e) => setGoalTarget(e.target.value)} className={`border rounded-xl p-3 text-xs font-semibold font-ledger ${inputClass}`} required />
              <button type="submit" className={`${brassPill} font-semibold rounded-xl text-xs py-3 transition hover:brightness-105`}>Create Vault</button>
            </form>
          </div>

          {goals.length === 0 ? (
            <div className={`${cardClass} border rounded-[28px] p-10 text-center text-xs ${subtleText}`}>No vaults yet — create one above to start setting money aside.</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {goals.map((goal) => {
                const progress = Math.min(Math.round((goal.current_amount / goal.target_amount) * 100), 100);
                const isCompleted = progress >= 100;
                
                return (
                  <div key={goal.id} className={`${cardClass} border rounded-[24px] p-6 space-y-4`}>
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-display text-base font-semibold text-slate-900 dark:text-white">{goal.title}</h3>
                        <p className={`font-ledger text-xs mt-0.5 ${subtleText}`}>{goal.current_amount.toLocaleString()} / {goal.target_amount.toLocaleString()} ETB</p>
                      </div>
                      <span className={`font-ledger text-xs font-bold ${isCompleted ? "text-[#16A34A] bg-emerald-50 dark:bg-emerald-950/20" : "text-[#0284C7] bg-[#0284C7]/10"} border border-slate-200 dark:border-slate-700 px-2.5 py-1 rounded-full`}>{progress}%</span>
                    </div>

                    <div className={`w-full rounded-full h-2 overflow-hidden ${isDark ? "bg-slate-800" : "bg-slate-100"}`}>
                      <div className={`h-full ${isCompleted ? "bg-[#16A34A]" : "bg-[#0284C7]"} transition-all duration-500 rounded-full`} style={{ width: `${progress}%` }}></div>
                    </div>

                    {goalDeposit?.id === goal.id ? (
                      <div className="flex gap-2">
                        <input type="number" placeholder="Deposit amount" value={goalDeposit.amount} onChange={(e) => setGoalDeposit({ id: goal.id, amount: e.target.value })} className={`flex-1 border rounded-xl p-2.5 text-xs font-ledger ${inputClass}`} autoFocus />
                        <button onClick={() => handleDepositGoal(goal.id, goalDeposit.amount)} className="px-4 rounded-xl text-xs font-bold text-white bg-[#16A34A] hover:bg-[#16A34A]/90 transition">Save</button>
                        <button onClick={() => setGoalDeposit(null)} className="px-2 text-slate-400">✕</button>
                      </div>
                    ) : (
                      <button 
                        onClick={() => setGoalDeposit({ id: goal.id, amount: "" })}
                        disabled={isCompleted}
                        className={`w-full border text-xs font-semibold py-2.5 rounded-xl transition ${
                          isCompleted 
                            ? "bg-emerald-50/50 border-emerald-100 text-[#16A34A] cursor-default" 
                            : "border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-900 dark:text-white"
                        }`}
                      >
                        {isCompleted ? "🎖 Vault Milestone Completed" : "+ Add Funds"}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </main>
      )}

      {/* ADD ENTRY TAB */}
      {activeTab === "add" && (
        <main className={`${cardClass} border rounded-[28px] max-w-lg mx-auto p-6 space-y-5`}>
          <h2 className="font-display text-lg font-semibold flex items-center gap-2 text-slate-900 dark:text-white"><PlusCircle size={17} className="text-[#0284C7]" /> New Transaction Entry</h2>
          <form onSubmit={handleAddManual} className="space-y-4">
            <div>
              <label className="eyebrow block text-[10px] font-semibold mb-1.5 text-slate-400">Date</label>
              <input type="date" value={formDate} onChange={(e) => setFormDate(e.target.value)} className={`w-full border rounded-2xl p-3.5 text-sm ${inputClass}`} required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="eyebrow block text-[10px] font-semibold mb-1.5 text-slate-400">Type</label>
                <select value={formType} onChange={(e) => setFormType(e.target.value as "income" | "expense" | "loan")} className={`w-full border rounded-2xl p-3.5 text-sm ${inputClass}`}>
                  <option value="expense">Expense</option>
                  <option value="income">Income</option>
                  <option value="loan">Loan Payment</option>
                </select>
              </div>
              <div>
                <label className="eyebrow block text-[10px] font-semibold mb-1.5 text-slate-400">Currency</label>
                <select value={formCurrency} onChange={(e) => setFormCurrency(e.target.value as "ETB" | "USD")} className={`w-full border rounded-2xl p-3.5 text-sm ${inputClass}`}>
                  <option value="ETB">ETB</option>
                  <option value="USD">USD ($)</option>
                </select>
              </div>
            </div>
            <div>
              <label className="eyebrow block text-[10px] font-semibold mb-1.5 text-slate-400">Amount</label>
              <input type="number" step="any" value={formAmount} onChange={(e) => setFormAmount(e.target.value)} placeholder="0.00" className={`w-full border rounded-2xl p-3.5 text-sm font-ledger ${inputClass}`} required />
            </div>
            <div>
              <label className="eyebrow block text-[10px] font-semibold mb-1.5 text-slate-400">Category</label>
              <select value={formCategory} onChange={(e) => setFormCategory(e.target.value)} className={`w-full border rounded-2xl p-3.5 text-sm ${inputClass}`}>
                <option value="Food">Food &amp; Grocery</option>
                <option value="Transport / Fuel">Transport / Fuel</option>
                <option value="Car Expenses">Car Maintenance</option>
                <option value="Loans & Ekub">Loans &amp; Ekub</option>
                <option value="Personal & Date">Personal &amp; Dates</option>
                <option value="Income Stream">Income Stream</option>
                <option value="General">General</option>
              </select>
            </div>
            <div>
              <label className="eyebrow block text-[10px] font-semibold mb-1.5 text-slate-400">Description</label>
              <input type="text" value={formDescription} onChange={(e) => setFormDescription(e.target.value)} placeholder="Description" className={`w-full border rounded-2xl p-3.5 text-sm ${inputClass}`} />
            </div>

            <label htmlFor="recurring" className={`flex items-center gap-2.5 pt-1 cursor-pointer select-none p-3 rounded-xl border ${isDark ? "border-slate-700 bg-slate-800/40" : "border-slate-200/50 bg-slate-50/50"} transition`}>
              <input type="checkbox" id="recurring" checked={formIsRecurring} onChange={(e) => setFormIsRecurring(e.target.checked)} className="rounded accent-[#0284C7] w-4 h-4" />
              <span className="text-xs font-semibold flex items-center gap-1.5"><Repeat size={12} className="text-[#0284C7]" /> Make this a recurring monthly bill</span>
            </label>

            <button type="submit" className={`w-full ${brassPill} font-semibold py-4 rounded-2xl transition hover:brightness-105`}>
              Save Entry
            </button>
          </form>
        </main>
      )}

      {/* CSV BULK IMPORT TAB */}
      {activeTab === "csv" && (
        <main className={`${cardClass} border rounded-[28px] max-w-2xl mx-auto p-6 space-y-6`}>
          <div>
            <h2 className="font-display text-lg font-semibold flex items-center gap-2 text-slate-900 dark:text-white"><UploadCloud size={17} className="text-[#0284C7]" /> Bulk CSV Import</h2>
            <p className={`text-xs mt-1 ${subtleText}`}>Pick a <code className="font-ledger">.csv</code> file directly from your device or paste raw CSV lines.</p>
          </div>

          <div className={`p-8 border border-dashed rounded-[24px] flex flex-col items-center justify-center text-center gap-3 ${isDark ? "bg-slate-800/30 border-slate-750" : "bg-slate-50/50 border-slate-200"}`}>
            <UploadCloud size={22} className="text-[#0284C7]" />
            <p className={`text-xs font-semibold ${subtleText}`}>Select a <code className="font-ledger">.csv</code> file from your device</p>
            <input type="file" accept=".csv" onChange={handleFileUpload} className={`text-xs file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:cursor-pointer file:bg-[#0284C7] file:text-white hover:file:bg-[#0369a1] cursor-pointer ${subtleText}`} />
          </div>

          <div className="space-y-1.5">
            <label className={`eyebrow block text-[10px] font-semibold ${subtleText}`}>CSV Text Preview / Raw Input</label>
            <textarea value={csvContent} onChange={(e) => setCsvContent(e.target.value)} placeholder={`Date,Type,Amount,Currency,Category,Description\n2026-07-01,income,15000,ETB,Income Stream,Salary Payment`} className={`w-full h-48 border rounded-2xl p-4 text-xs font-ledger focus:outline-none ${inputClass}`}></textarea>
          </div>

          <button onClick={handleCustomCsvImport} className={`w-full ${brassPill} font-semibold py-4 rounded-2xl transition hover:brightness-105`}>
            Process CSV Import
          </button>
        </main>
      )}

      {/* SETTINGS TAB */}
      {activeTab === "settings" && (
        <main className={`${cardClass} border rounded-[28px] max-w-2xl mx-auto p-6 space-y-6`}>
          <h2 className="font-display text-lg font-semibold flex items-center gap-2 text-slate-900 dark:text-white"><SettingsIcon size={17} /> Advanced Settings</h2>

          <div className={`space-y-4 divide-y ${isDark ? "divide-slate-800" : "divide-slate-100"}`}>
            <div className="pt-2 flex justify-between items-center gap-4">
              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-white">User Account</p>
                <p className={`text-xs ${subtleText}`}>{user.email}</p>
              </div>
              <span className="text-xs bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 border border-emerald-100 dark:border-emerald-900/30 px-3 py-1 rounded-full font-semibold shrink-0">Active</span>
            </div>

            <div className="pt-4 flex justify-between items-center gap-4">
              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-white">USD Exchange Rate (ETB)</p>
                <p className={`text-xs ${subtleText}`}>Adjust custom exchange conversion rate</p>
              </div>
              <input
                type="number"
                value={usdRate}
                onChange={(e) => {
                  const val = parseFloat(e.target.value) || 180;
                  setUsdRate(val);
                  localStorage.setItem("fp_usd_rate", val.toString());
                }}
                className={`w-28 border rounded-xl p-2.5 text-xs font-ledger text-right ${inputClass}`}
              />
            </div>

            <div className="pt-4 space-y-3">
              <div>
                <p className="text-sm font-semibold text-[#DC2626]">Clear All Transaction Data</p>
                <p className={`text-xs ${subtleText}`}>Permanently delete all transaction entries linked to your cloud account.</p>
              </div>
              <button onClick={handleClearAllData} className="w-full bg-[#DC2626]/5 hover:bg-[#DC2626]/10 border border-[#DC2626]/20 text-[#DC2626] font-semibold py-3 rounded-2xl transition flex items-center justify-center gap-2">
                <Trash2 size={14} /> Clear All Cloud Data
              </button>
            </div>
          </div>
        </main>
      )}
    </div>
  );
}
