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
  AreaChart,
  Area,
  Legend
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
  Building,
  CreditCard,
  Search,
  Download,
  MessageSquare,
  X,
  Send,
  Info,
  AlertTriangle,
  CheckCircle,
  LineChart as LineChartIcon
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
  target_date?: string;
}

export interface BankAccount {
  id: string;
  name: string;
  type: "checking" | "savings" | "credit" | "investment" | "crypto";
  institution: string;
  balance: number;
  currency: "USD" | "ETB";
  mask: string;
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

const INITIAL_ACCOUNTS: BankAccount[] = [
  { id: "acc-1", name: "Chime checking", type: "checking", institution: "Chime", balance: 5420.50, currency: "USD", mask: "4821" },
  { id: "acc-2", name: "Chase Sapphire card", type: "credit", institution: "Chase", balance: -1250.00, currency: "USD", mask: "9012" },
  { id: "acc-3", name: "Wise balance", type: "checking", institution: "Wise", balance: 45000, currency: "ETB", mask: "3381" },
  { id: "acc-4", name: "Coinbase portfolio", type: "crypto", institution: "Coinbase", balance: 2150.75, currency: "USD", mask: "BTC" },
];

export default function UltimatePlannerApp() {
  // Theme & Auth State initialized lazily from LocalStorage to avoid set-state-in-effect warnings
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
  const [activeTab, setActiveTab] = useState<"dashboard" | "accounts" | "transactions" | "budgets" | "goals" | "insights" | "settings">("dashboard");
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
  
  const [accounts, setAccounts] = useState<BankAccount[]>((() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("fp_accounts");
      if (saved) {
        try { return JSON.parse(saved); } catch { return INITIAL_ACCOUNTS; }
      }
    }
    return INITIAL_ACCOUNTS;
  }));

  // Editing State
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);

  // Filters & Search State
  const [timeframe, setTimeframe] = useState<"monthly" | "yearly" | "all">("monthly");
  const [selectedYear, setSelectedYear] = useState<string>("2026");
  const [selectedMonth, setSelectedMonth] = useState<string>("08");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<"all" | "income" | "expense" | "loan">("all");
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterBank, setFilterBank] = useState("all");

  // Manual Form State
  const [formDate, setFormDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [formType, setFormType] = useState<"income" | "expense" | "loan">("expense");
  const [formAmount, setFormAmount] = useState<string>("");
  const [formCurrency, setFormCurrency] = useState<"ETB" | "USD">("ETB");
  const [formCategory, setFormCategory] = useState<string>("Food");
  const [formDescription, setFormDescription] = useState<string>("");
  const [formIsRecurring, setFormIsRecurring] = useState<boolean>(false);
  const [showAddForm, setShowAddForm] = useState(false);

  // Savings Goal Form States
  const [goalTitle, setGoalTitle] = useState("");
  const [goalTarget, setGoalTarget] = useState("");
  const [goalDate, setGoalDate] = useState("");
  const [goalDeposit, setGoalDeposit] = useState<{ id: string; amount: string } | null>(null);

  // CSV Data State
  const [csvContent, setCsvContent] = useState<string>("");

  // Plaid Simulator State
  const [plaidStep, setPlaidStep] = useState<"select" | "auth" | "loading" | "success" | null>(null);
  const [selectedInstitution, setSelectedInstitution] = useState<string | null>(null);
  const [plaidUser, setPlaidUser] = useState("");
  const [plaidPass, setPlaidPass] = useState("");

  // Confetti Animation State
  const [showConfetti, setShowConfetti] = useState(false);
  const [confettiParticles, setConfettiParticles] = useState<{ id: number; color: string; left: number; delay: number }[]>([]);

  // Chatbot Drawer State
  const [chatOpen, setChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<{ sender: "user" | "coach"; text: string }[]>(() => [
    { sender: "coach", text: "Welcome to your personal wealth center! 👋 I am your Neo AI Coach. Ask me anything about your budgets, savings vaults, or net worth balances!" }
  ]);

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

  // Trigger Confetti Victory Effect
  const triggerConfetti = () => {
    const colors = ["#0284C7", "#16A34A", "#F59E0B", "#EC4899", "#8B5CF6", "#10B981"];
    const particles = Array.from({ length: 80 }).map((_, i) => ({
      id: i,
      color: colors[Math.floor(Math.random() * colors.length)],
      left: Math.random() * 100,
      delay: Math.random() * 2
    }));
    setConfettiParticles(particles);
    setShowConfetti(true);
    setTimeout(() => {
      setShowConfetti(false);
      setConfettiParticles([]);
    }, 5000);
  };

  // Chatbot Auto-Response
  const handleSendChatMessage = (text: string) => {
    if (!text.trim()) return;
    const newMsg = { sender: "user" as const, text };
    setChatMessages((prev) => [...prev, newMsg]);
    setChatInput("");

    setTimeout(() => {
      let reply = "";
      const lower = text.toLowerCase();

      if (lower.includes("budget") || lower.includes("limit") || lower.includes("spend")) {
        const overBudgets = Object.keys(budgets).filter(cat => (categoryTotals[cat] || 0) > budgets[cat]);
        if (overBudgets.length > 0) {
          reply = `Alert 🚨: You are currently exceeding your budget limits in these categories: ${overBudgets.map(cat => `${cat} (Over by ${(categoryTotals[cat] - budgets[cat]).toLocaleString()} ETB)`).join(", ")}. Consider cutting back on these fields.`;
        } else {
          reply = `Excellent financial discipline! 🎉 None of your category budget limits have been breached. Keep tracking!`;
        }
      } else if (lower.includes("net worth") || lower.includes("balance") || lower.includes("wealth") || lower.includes("portfolio")) {
        reply = `Your computed Net Worth is ${netWorth.toLocaleString('en-US', {maximumFractionDigits: 2})} ETB (approx. $${(netWorth / usdRate).toLocaleString('en-US', {maximumFractionDigits: 2})} USD) across ${accounts.length} linked accounts & assets.`;
      } else if (lower.includes("saving") || lower.includes("goal") || lower.includes("vault")) {
        if (goals.length > 0) {
          const summaries = goals.map(g => `${g.title} (${Math.round(g.current_amount / g.target_amount * 100)}% saved)`).join(", ");
          reply = `You have ${goals.length} active savings vaults: ${summaries}. Keep funding them to secure your financial future!`;
        } else {
          reply = `I notice you haven't created any savings vaults yet. I recommend creating a vault (like a 'Rainy Day Fund') under the Vaults tab to track progress.`;
        }
      } else if (lower.includes("tip") || lower.includes("advice") || lower.includes("help")) {
        reply = `💡 Neo-Bank Pro Tip: Automating your savings is the easiest way to grow wealth. Set up a savings goal for 10% of your incoming streams, and review transactions daily to prevent subscription leaks!`;
      } else {
        reply = `Hello! I'm your Neo AI Financial Coach. Ask me about your 'budgets', 'net worth', or 'savings goals' and I'll analyze your live ledger to help you.`;
      }

      setChatMessages((prev) => [...prev, { sender: "coach" as const, text: reply }]);
    }, 750);
  };



  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    localStorage.setItem("fp_theme", next);
  };

  // Supabase Auth listener
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Fetch transactions when user changes
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

  // Transaction Actions
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
      setShowAddForm(false);
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
    if (!user || !confirm("Delete this transaction entry permanently?")) return;
    const { error } = await supabase.from("transactions").delete().eq("id", id).eq("user_id", user.id);
    if (error) alert("Failed to delete: " + error.message);
    else await fetchCloudTransactions(user.id);
  };

  const handleClearAllData = async () => {
    if (!user) return;
    const confirmation = prompt('Type "DELETE" to permanently wipe all ledger records:');
    if (confirmation !== "DELETE") return;

    setLoading(true);
    const { error } = await supabase.from("transactions").delete().eq("user_id", user.id);

    if (error) alert("Error clearing data: " + error.message);
    else {
      alert("All records successfully deleted.");
      await fetchCloudTransactions(user.id);
    }
    setLoading(false);
  };

  // Budget Actions
  const handleSaveAllBudgets = () => {
    setBudgets(tempBudgets);
    localStorage.setItem("fp_budgets", JSON.stringify(tempBudgets));
    setBudgetSaveMessage("Budgets successfully updated!");
    setTimeout(() => setBudgetSaveMessage(""), 3000);
  };

  // Savings Goal Actions
  const handleAddGoal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!goalTitle || !goalTarget || !user) return;

    const newGoal: SavingsGoal = {
      id: "goal-" + Date.now(),
      user_id: user.id,
      title: goalTitle,
      target_amount: parseFloat(goalTarget),
      current_amount: 0,
      target_date: goalDate || undefined
    };

    const updated = [...goals, newGoal];
    setGoals(updated);
    localStorage.setItem("fp_goals", JSON.stringify(updated));
    setGoalTitle("");
    setGoalTarget("");
    setGoalDate("");
  };

  const handleDepositGoal = (id: string, amountStr: string) => {
    const deposit = parseFloat(amountStr);
    if (isNaN(deposit) || deposit <= 0) return;

    const updated = goals.map((g) => {
      if (g.id === id) {
        const nextAmt = g.current_amount + deposit;
        if (nextAmt >= g.target_amount && g.current_amount < g.target_amount) {
          triggerConfetti();
        }
        return { ...g, current_amount: Math.min(nextAmt, g.target_amount) };
      }
      return g;
    });

    setGoals(updated);
    localStorage.setItem("fp_goals", JSON.stringify(updated));
    setGoalDeposit(null);
  };

  // Simulated Plaid Connection
  const handlePlaidSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInstitution) return;
    setPlaidStep("loading");

    setTimeout(() => {
      setPlaidStep("success");
      setTimeout(async () => {
        const instLabel = selectedInstitution.charAt(0).toUpperCase() + selectedInstitution.slice(1);
        const suffix = Math.floor(1000 + Math.random() * 9000).toString();
        
        const newAccounts: BankAccount[] = [
          {
            id: `acc-${selectedInstitution}-chk`,
            name: `${instLabel} checking`,
            type: "checking",
            institution: instLabel,
            balance: Math.floor(1500 + Math.random() * 8500),
            currency: "USD",
            mask: suffix
          },
          {
            id: `acc-${selectedInstitution}-sav`,
            name: `${instLabel} savings`,
            type: "savings",
            institution: instLabel,
            balance: Math.floor(12000 + Math.random() * 25000),
            currency: "USD",
            mask: String(Number(suffix) + 1)
          }
        ];

        const updatedAccounts = [...accounts, ...newAccounts];
        setAccounts(updatedAccounts);
        localStorage.setItem("fp_accounts", JSON.stringify(updatedAccounts));

        if (user) {
          const importedTransactions = [
            {
              id: `tx-mock-${Date.now()}-1`,
              user_id: user.id,
              date: new Date().toISOString().split("T")[0],
              type: "income" as const,
              amount_etb: 1450 * usdRate,
              original_currency: "USD" as const,
              original_amount: 1450,
              category: "Income Stream",
              description: `${instLabel} Direct Deposit Payroll`,
              is_recurring: true
            },
            {
              id: `tx-mock-${Date.now()}-2`,
              user_id: user.id,
              date: new Date(Date.now() - 86400000).toISOString().split("T")[0],
              type: "expense" as const,
              amount_etb: 80 * usdRate,
              original_currency: "USD" as const,
              original_amount: 80,
              category: "Food",
              description: `Whole Foods Market (${instLabel} checking)`,
              is_recurring: false
            }
          ];

          const { error } = await supabase.from("transactions").insert(importedTransactions);
          if (!error) {
            await fetchCloudTransactions(user.id);
          }
        }

        triggerConfetti();
        setPlaidStep(null);
        setSelectedInstitution(null);
        setPlaidUser("");
        setPlaidPass("");
      }, 1500);
    }, 2000);
  };

  // CSV Import
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
      triggerConfetti();
    }
  };

  // CSV Export
  const handleExportCSV = () => {
    if (allTransactions.length === 0) return;
    const headers = ["Date", "Type", "Amount (ETB)", "Original Currency", "Original Amount", "Category", "Description"];
    const rows = allTransactions.map(t => [
      t.date,
      t.type,
      t.amount_etb,
      t.original_currency,
      t.original_amount,
      `"${t.category}"`,
      `"${t.description.replace(/"/g, '""')}"`
    ]);

    const csvData = [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const blob = new Blob([csvData], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `neo_bank_ledger_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // =========================================================================
  // READ-COMPILER SAFE PLAIN ASSIGNMENTS (Avoiding preserve-manual-memoization)
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

  const fullyFilteredTransactions = filteredTransactions.filter((t) => {
    const matchesSearch = searchQuery
      ? t.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.category.toLowerCase().includes(searchQuery.toLowerCase())
      : true;
    const matchesType = filterType === "all" ? true : t.type === filterType;
    const matchesCategory = filterCategory === "all" ? true : t.category === filterCategory;
    const matchesBank = filterBank === "all" ? true :
      filterBank === "USD" ? t.original_currency === "USD" :
      filterBank === "ETB" ? t.original_currency === "ETB" : true;

    return matchesSearch && matchesType && matchesCategory && matchesBank;
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

  const netWorth = accounts.reduce((acc, b) => {
    const balanceETB = b.currency === "USD" ? b.balance * usdRate : b.balance;
    return acc + balanceETB;
  }, 0);

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

  const areaChartData = (() => {
    const sorted = [...allTransactions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    let cumulative = netWorth > 0 ? netWorth - 50000 : 150000;
    const points: { date: string; NetWorth: number }[] = [];

    const dateMap: Record<string, number> = {};
    sorted.forEach((t) => {
      const val = t.type === "income" ? Number(t.amount_etb) : t.type === "expense" ? -Number(t.amount_etb) : 0;
      dateMap[t.date] = (dateMap[t.date] || 0) + val;
    });

    const uniqueDates = Object.keys(dateMap).sort();
    uniqueDates.forEach((d) => {
      cumulative += dateMap[d];
      points.push({
        date: d,
        NetWorth: Math.round(cumulative)
      });
    });

    if (points.length === 0) {
      return [
        { date: "2026-05-01", NetWorth: 120000 },
        { date: "2026-06-01", NetWorth: 128000 },
        { date: "2026-07-01", NetWorth: 135000 },
        { date: "2026-08-01", NetWorth: 150000 },
      ];
    }
    return points;
  })();

  // Theme styling resolutions
  const isDark = theme === "dark";
  const bgClass = isDark ? "bg-[#0B0F19] text-[#F8FAFC]" : "bg-[#FAFAFA] text-[#0F172A]";
  const cardClass = isDark
    ? "bg-[#1E293B] border border-slate-700/50 shadow-xl rounded-2xl p-6 transition-all duration-300"
    : "bg-white border border-slate-200/60 shadow-sm rounded-2xl p-6 transition-all duration-300";
  const inputClass = isDark
    ? "bg-slate-800 border-slate-700 text-white placeholder-slate-500 focus:border-[#38BDF8] focus:ring-1 focus:ring-[#38BDF8]"
    : "bg-white border-slate-200 text-slate-900 placeholder-slate-400 focus:border-[#0284C7] focus:ring-1 focus:ring-[#0284C7]";
  const subtleText = isDark ? "text-slate-400" : "text-slate-500";
  const hairline = isDark ? "border-slate-800" : "border-slate-100";
  const selectThemePill = isDark ? "bg-[#38BDF8] text-slate-900" : "bg-[#0284C7] text-white";
  const actionButton = "bg-[#0284C7] hover:bg-[#0369a1] text-white px-4 py-2.5 rounded-xl font-semibold transition text-xs flex items-center gap-1.5 shadow-sm";

  const NAV_ITEMS = [
    { key: "dashboard" as const, label: "Overview", icon: LayoutDashboard },
    { key: "accounts" as const, label: "Accounts", icon: Building },
    { key: "transactions" as const, label: "Ledger", icon: CreditCard },
    { key: "budgets" as const, label: "Budgets", icon: Target },
    { key: "goals" as const, label: "Vaults", icon: ShieldCheck },
    { key: "insights" as const, label: "Insights", icon: BarChart3 },
    { key: "settings" as const, label: "Settings", icon: SettingsIcon },
  ];

  // LOGGED OUT SIGNIN FORM SCREEN
  if (!user) {
    return (
      <div className={`min-h-screen ${bgClass} font-body flex items-center justify-center p-4 transition-colors duration-300 relative overflow-hidden`}>
        <div className="pointer-events-none absolute -top-40 -right-40 w-96 h-96 rounded-full bg-[#0284C7]/10 blur-[100px]" />
        <div className="pointer-events-none absolute -bottom-40 -left-40 w-96 h-96 rounded-full bg-[#16A34A]/10 blur-[100px]" />

        <div className={`${cardClass} max-w-md w-full relative z-10 p-8`}>
          <div className="space-y-6">
            <div className="flex justify-between items-start">
              <div>
                <span className="text-[10px] tracking-widest uppercase font-bold text-[#0284C7]">Neo-Bank Personal Portal</span>
                <h1 className="font-display text-3xl font-bold tracking-tight text-slate-900 dark:text-white mt-1">
                  Money Planner
                </h1>
                <p className={`text-xs mt-1 ${subtleText}`}>Approachable, stress-free personal wealth tracking.</p>
              </div>
              <button
                onClick={toggleTheme}
                aria-label="Toggle theme"
                className={`p-2.5 rounded-full border transition ${isDark ? "bg-slate-800 border-slate-700 text-[#38BDF8]" : "bg-slate-100 border-slate-200 text-slate-700"}`}
              >
                {isDark ? <Sun size={15} /> : <Moon size={15} />}
              </button>
            </div>

            <div className={`p-1 rounded-xl border flex gap-1 ${isDark ? "bg-slate-800/50 border-slate-700" : "bg-slate-100 border-slate-200"}`}>
              <button
                onClick={() => { setAuthMode("login"); setAuthMessage(""); }}
                className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all duration-200 ${authMode === "login" ? selectThemePill : "text-slate-500 hover:text-slate-900"}`}
              >
                Log In
              </button>
              <button
                onClick={() => { setAuthMode("signup"); setAuthMessage(""); }}
                className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all duration-200 ${authMode === "signup" ? selectThemePill : "text-slate-500 hover:text-slate-900"}`}
              >
                Sign Up
              </button>
            </div>

            <form onSubmit={handleAuthSubmit} className="space-y-4">
              {authMode === "signup" && (
                <div>
                  <label className="block text-[10px] uppercase font-bold mb-1.5 text-slate-400">Full Name</label>
                  <input type="text" placeholder="Your name" value={authName} onChange={(e) => setAuthName(e.target.value)} className={`w-full border rounded-xl p-3 text-sm focus:outline-none transition ${inputClass}`} required />
                </div>
              )}
              <div>
                <label className="block text-[10px] uppercase font-bold mb-1.5 text-slate-400">Email Address</label>
                <input type="email" placeholder="name@fintech.com" value={authEmail} onChange={(e) => setAuthEmail(e.target.value)} className={`w-full border rounded-xl p-3 text-sm focus:outline-none transition ${inputClass}`} required />
              </div>
              <div>
                <label className="block text-[10px] uppercase font-bold mb-1.5 text-slate-400">Password</label>
                <input type="password" placeholder="••••••••" value={authPassword} onChange={(e) => setAuthPassword(e.target.value)} className={`w-full border rounded-xl p-3 text-sm focus:outline-none transition ${inputClass}`} required minLength={6} />
              </div>

              {authMessage && (
                <div className={`p-3 rounded-xl border flex gap-2 items-center text-xs ${authMessage.includes("Error") ? "bg-[#DC2626]/10 border-[#DC2626]/20 text-[#DC2626]" : "bg-[#16A34A]/10 border-[#16A34A]/20 text-[#16A34A]"}`}>
                  {authMessage.includes("Error") ? <AlertTriangle size={14} className="shrink-0" /> : <Info size={14} className="shrink-0" />}
                  <p>{authMessage}</p>
                </div>
              )}

              <button type="submit" className={`w-full py-3.5 rounded-xl font-bold text-xs tracking-wider uppercase text-white transition ${isDark ? "bg-[#38BDF8] hover:bg-[#38BDF8]/90" : "bg-[#0284C7] hover:bg-[#0284C7]/90"} shadow-md`}>
                {authMode === "login" ? "Secure Login" : "Create Vault Account"}
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${bgClass} font-body pb-16 transition-colors duration-300 relative`}>
      {/* Confetti Rain Component */}
      {showConfetti && (
        <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
          {confettiParticles.map((p) => (
            <div
              key={p.id}
              className="confetti-particle"
              style={{
                backgroundColor: p.color,
                left: `${p.left}%`,
                animationDelay: `${p.delay}s`
              }}
            />
          ))}
        </div>
      )}

      {/* HEADER / NAVIGATION BAR */}
      <header className="sticky top-0 z-30 bg-white/80 dark:bg-[#0B0F19]/80 backdrop-blur-md border-b border-slate-200/50 dark:border-slate-800/60">
        <div className="max-w-6xl mx-auto px-4 py-4 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#0284C7] text-white flex items-center justify-center shadow-md">
              <Wallet size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-display text-xl font-bold tracking-tight text-slate-900 dark:text-white">Money Planner</span>
                <span className={`text-[9px] font-bold border border-slate-200 dark:border-slate-800 px-2 py-0.5 rounded-full ${subtleText}`}>
                  $1 = {usdRate} ETB
                </span>
              </div>
              <p className={`text-[10px] font-semibold ${subtleText}`}>
                Secured portal — <strong className="text-slate-950 dark:text-white">{user.user_metadata?.display_name || user.email}</strong>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={toggleTheme}
              aria-label="Toggle theme"
              className={`p-2.5 rounded-xl border transition ${isDark ? "bg-slate-800 border-slate-700 text-[#38BDF8] hover:bg-slate-700" : "bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200"}`}
            >
              {isDark ? <Sun size={14} /> : <Moon size={14} />}
            </button>
            <button onClick={handleSignOut} className="flex items-center gap-1.5 px-3 py-2.5 border border-[#DC2626]/20 bg-[#DC2626]/5 hover:bg-[#DC2626]/10 text-[#DC2626] text-xs font-bold rounded-xl transition">
              <LogOut size={13} /> Log Out
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 mt-6">
        {/* TAB BAR NAVIGATION */}
        <nav className={`p-1.5 rounded-xl border border-slate-200/50 dark:border-slate-800/60 bg-white dark:bg-[#1E293B] flex flex-wrap gap-1 mb-6`}>
          {NAV_ITEMS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`flex-1 min-w-[90px] flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-bold transition-all duration-200 ${activeTab === key ? selectThemePill + " shadow-sm" : "text-slate-500 hover:text-slate-900 dark:hover:text-white"}`}
            >
              <Icon size={14} />
              <span className="hidden sm:inline">{label}</span>
            </button>
          ))}
        </nav>

        {/* ================================== OVERVIEW TAB ================================== */}
        {activeTab === "dashboard" && (
          <div className="space-y-6">
            {/* NET WORTH HERO DISPLAY */}
            <div className={`${cardClass} border-l-[6px] border-l-[#0284C7]`}>
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                  <span className="text-[10px] uppercase tracking-wider font-bold text-[#0284C7]">Unified Net Worth</span>
                  <h2 className="font-ledger text-4xl font-bold tracking-tight mt-1 text-slate-950 dark:text-white">
                    {netWorth.toLocaleString()} <span className="text-sm font-semibold text-slate-400">ETB</span>
                  </h2>
                  <p className={`text-xs mt-1 ${subtleText}`}>
                    Calculated value: ~ ${(netWorth / usdRate).toLocaleString('en-US', {maximumFractionDigits: 2})} USD (at custom index)
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => setPlaidStep("select")} className={actionButton}>
                    <Building size={14} /> Link Bank via Plaid
                  </button>
                  <button onClick={() => setShowAddForm(true)} className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white px-4 py-2.5 rounded-xl font-semibold transition text-xs flex items-center gap-1.5 shadow-sm">
                    <PlusCircle size={14} /> New Log Entry
                  </button>
                </div>
              </div>
            </div>

            {/* TIMEFRAME FILTERS */}
            <div className={`${cardClass} py-4 flex flex-wrap justify-between items-center gap-4`}>
              <div className="flex items-center p-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                <button onClick={() => setTimeframe("monthly")} className={`px-4 py-2 rounded-lg text-xs font-bold transition ${timeframe === "monthly" ? selectThemePill : "text-slate-500 hover:text-slate-900"}`}>Monthly</button>
                <button onClick={() => setTimeframe("yearly")} className={`px-4 py-2 rounded-lg text-xs font-bold transition ${timeframe === "yearly" ? selectThemePill : "text-slate-500 hover:text-slate-900"}`}>Yearly</button>
                <button onClick={() => setTimeframe("all")} className={`px-4 py-2 rounded-lg text-xs font-bold transition ${timeframe === "all" ? selectThemePill : "text-slate-500 hover:text-slate-900"}`}>All Time</button>
              </div>

              {timeframe !== "all" && (
                <div className="flex items-center gap-2">
                  {timeframe === "monthly" && (
                    <select value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} className={`border text-xs p-2.5 rounded-xl font-bold focus:outline-none ${inputClass}`}>
                      <option value="01">January</option><option value="02">February</option><option value="03">March</option><option value="04">April</option><option value="05">May</option><option value="06">June</option><option value="07">July</option><option value="08">August</option><option value="09">September</option><option value="10">October</option><option value="11">November</option><option value="12">December</option>
                    </select>
                  )}
                  <select value={selectedYear} onChange={(e) => setSelectedYear(e.target.value)} className={`border text-xs p-2.5 rounded-xl font-bold focus:outline-none ${inputClass}`}>
                    <option value="2025">2025</option><option value="2026">2026</option>
                  </select>
                </div>
              )}
            </div>

            {/* HIGH-LEVEL TRANSACTION METRICS */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className={`${cardClass} border-t-4 border-t-[#16A34A]`}>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase font-bold text-slate-400">Total Income</span>
                  <TrendingUp size={15} className="text-[#16A34A]" />
                </div>
                <h3 className="font-ledger text-2xl font-bold mt-2 text-[#16A34A]">
                  +{totalIncome.toLocaleString()} <span className="text-xs font-medium">ETB</span>
                </h3>
              </div>

              <div className={`${cardClass} border-t-4 border-t-[#DC2626]`}>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase font-bold text-slate-400">Total Outflow</span>
                  <TrendingDown size={15} className="text-[#DC2626]" />
                </div>
                <h3 className="font-ledger text-2xl font-bold mt-2 text-[#DC2626]">
                  -{totalExpense.toLocaleString()} <span className="text-xs font-medium">ETB</span>
                </h3>
              </div>

              <div className={`${cardClass} border-t-4 border-t-[#0284C7]`}>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase font-bold text-slate-400">Net Surplus</span>
                  <Scale size={15} className="text-[#0284C7]" />
                </div>
                <h3 className={`font-ledger text-2xl font-bold mt-2 ${totalIncome - totalExpense >= 0 ? "text-[#16A34A]" : "text-[#DC2626]"}`}>
                  {(totalIncome - totalExpense).toLocaleString()} <span className="text-xs font-medium">ETB</span>
                </h3>
              </div>
            </div>

            {/* DASHBOARD GRAPH PREVIEWS */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className={cardClass}>
                <h3 className="font-display text-sm font-bold mb-4 text-slate-900 dark:text-white flex items-center gap-1.5">
                  <PieChartIcon size={14} className="text-[#0284C7]" /> Category Distribution
                </h3>
                {categoryChartData.length === 0 ? (
                  <div className={`h-64 flex items-center justify-center text-xs ${subtleText}`}>No transactions logged in this timeframe.</div>
                ) : (
                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={categoryChartData} cx="50%" cy="50%" innerRadius={60} outerRadius={85} paddingAngle={4} dataKey="value">
                          {categoryChartData.map((entry, idx) => (
                            <Cell key={`cell-${idx}`} fill={entry.color} stroke="none" />
                          ))}
                        </Pie>
                        <Tooltip contentStyle={{ backgroundColor: isDark ? "#1E293B" : "#ffffff", borderColor: "#cbd5e1", borderRadius: "8px", fontSize: "11px", fontFamily: "Inter" }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>

              {/* BUDGET LIMIT PREVIEWS */}
              <div className={cardClass}>
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-display text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <Target size={14} className="text-[#0284C7]" /> Budget Thresholds
                  </h3>
                  <button onClick={() => setActiveTab("budgets")} className="text-xs font-bold text-[#0284C7] hover:underline">Adjust Limits &rarr;</button>
                </div>
                <div className="space-y-4">
                  {Object.keys(budgets).map((cat) => {
                    const limit = budgets[cat] || 0;
                    const spent = categoryTotals[cat] || 0;
                    const percentage = limit > 0 ? Math.min(Math.round((spent / limit) * 100), 100) : 0;
                    const barColor = percentage >= 100 ? "bg-[#DC2626]" : percentage >= 80 ? "bg-[#F59E0B]" : "bg-[#16A34A]";

                    return (
                      <div key={cat} className="space-y-1.5">
                        <div className="flex justify-between text-xs">
                          <span className="font-bold text-slate-800 dark:text-slate-200">{cat}</span>
                          <span className={`font-ledger ${spent > limit ? "text-[#DC2626] font-bold" : subtleText}`}>
                            {spent.toLocaleString()} / {limit.toLocaleString()} ETB ({percentage}%)
                          </span>
                        </div>
                        <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2.5 overflow-hidden">
                          <div className={`h-full ${barColor} rounded-full transition-all duration-500`} style={{ width: `${percentage}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* RECURRING BILLS TIMELINE */}
            {recurringBills.length > 0 && (
              <div className={cardClass}>
                <h3 className="font-display text-sm font-bold mb-4 text-[#0284C7] flex items-center gap-1.5">
                  <Repeat size={14} /> Active Subscriptions &amp; Bills
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {recurringBills.map((bill) => (
                    <div key={bill.id} className="p-4 border border-slate-200/50 dark:border-slate-800/50 rounded-xl bg-slate-50/50 dark:bg-slate-800/30 flex justify-between items-center">
                      <div>
                        <p className="text-xs font-bold text-slate-900 dark:text-white">{bill.description}</p>
                        <span className={`text-[10px] font-bold ${subtleText}`}>{bill.category}</span>
                      </div>
                      <p className="font-ledger text-sm text-slate-950 dark:text-white font-bold">{Number(bill.amount_etb).toLocaleString()} ETB</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ================================== ACCOUNTS TAB ================================== */}
        {activeTab === "accounts" && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="font-display text-lg font-bold text-slate-950 dark:text-white">Financial Aggregation</h2>
                <p className={`text-xs ${subtleText}`}>Securely consolidate bank accounts, cards, and investments via Plaid API integration.</p>
              </div>
              <button onClick={() => setPlaidStep("select")} className={actionButton}>
                <Building size={14} /> Link Account
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {accounts.map((acc) => {
                const balanceStr = acc.currency === "USD" 
                  ? `$${acc.balance.toLocaleString('en-US', {minimumFractionDigits: 2})}`
                  : `${acc.balance.toLocaleString()} ETB`;
                
                return (
                  <div key={acc.id} className={`${cardClass} hover:border-[#0284C7] cursor-default flex flex-col justify-between h-44`}>
                    <div className="flex justify-between items-start">
                      <div className="space-y-0.5">
                        <span className={`text-[9px] uppercase tracking-wide font-bold ${subtleText}`}>{acc.institution}</span>
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white">{acc.name}</h4>
                      </div>
                      <span className={`text-[9px] border px-2 py-0.5 rounded-full font-bold uppercase ${
                        acc.type === "checking" ? "bg-blue-50 text-blue-600 border-blue-100" :
                        acc.type === "credit" ? "bg-red-50 text-red-600 border-red-100" :
                        "bg-green-50 text-green-600 border-green-100"
                      }`}>
                        {acc.type}
                      </span>
                    </div>

                    <div className="mt-4">
                      <p className="font-ledger text-2xl font-bold text-slate-950 dark:text-white">{balanceStr}</p>
                      {acc.currency === "USD" && (
                        <p className={`text-[10px] mt-0.5 ${subtleText}`}>
                          ~ {(acc.balance * usdRate).toLocaleString()} ETB
                        </p>
                      )}
                    </div>

                    <div className={`mt-2 pt-2 border-t ${hairline} flex justify-between items-center text-[10px] text-slate-400 font-bold`}>
                      <span>Ending in •••• {acc.mask}</span>
                      <span className="flex items-center gap-1 text-[#16A34A]"><CheckCircle size={10} /> Active</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ================================== LEDGER TAB ================================== */}
        {activeTab === "transactions" && (
          <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <h2 className="font-display text-lg font-bold text-slate-950 dark:text-white">Transaction Ledger</h2>
                <p className={`text-xs ${subtleText}`}>Browse, search, filter, and audit all transaction flows synced with your profile.</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setShowAddForm(!showAddForm)} className={actionButton}>
                  <PlusCircle size={14} /> New Log Entry
                </button>
                <button onClick={handleExportCSV} className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white px-3 py-2.5 rounded-xl font-bold transition text-xs flex items-center gap-1.5">
                  <Download size={14} /> Export CSV
                </button>
              </div>
            </div>

            {/* MANUAL ENTRY DROPDOWN ACCORDION */}
            {showAddForm && (
              <div className={`${cardClass} max-w-lg border-2 border-[#0284C7] space-y-4`}>
                <h3 className="font-display text-sm font-bold text-slate-950 dark:text-white">Log Transaction Form</h3>
                <form onSubmit={handleAddManual} className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[9px] uppercase font-bold mb-1 text-slate-400">Date</label>
                      <input type="date" value={formDate} onChange={(e) => setFormDate(e.target.value)} className={`w-full border rounded-xl p-2.5 text-xs focus:outline-none transition ${inputClass}`} required />
                    </div>
                    <div>
                      <label className="block text-[9px] uppercase font-bold mb-1 text-slate-400">Category</label>
                      <select value={formCategory} onChange={(e) => setFormCategory(e.target.value)} className={`w-full border rounded-xl p-2.5 text-xs focus:outline-none transition ${inputClass}`}>
                        <option value="Food">Food &amp; Grocery</option>
                        <option value="Transport / Fuel">Transport / Fuel</option>
                        <option value="Car Expenses">Car Maintenance</option>
                        <option value="Loans & Ekub">Loans &amp; Ekub</option>
                        <option value="Personal & Date">Personal &amp; Dates</option>
                        <option value="Income Stream">Income Stream</option>
                        <option value="General">General</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[9px] uppercase font-bold mb-1 text-slate-400">Type</label>
                      <select value={formType} onChange={(e) => setFormType(e.target.value as "income" | "expense" | "loan")} className={`w-full border rounded-xl p-2.5 text-xs focus:outline-none transition ${inputClass}`}>
                        <option value="expense">Expense</option>
                        <option value="income">Income</option>
                        <option value="loan">Loan Payment</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[9px] uppercase font-bold mb-1 text-slate-400">Currency</label>
                      <select value={formCurrency} onChange={(e) => setFormCurrency(e.target.value as "ETB" | "USD")} className={`w-full border rounded-xl p-2.5 text-xs focus:outline-none transition ${inputClass}`}>
                        <option value="ETB">ETB</option>
                        <option value="USD">USD ($)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[9px] uppercase font-bold mb-1 text-slate-400">Amount</label>
                      <input type="number" step="any" placeholder="0.00" value={formAmount} onChange={(e) => setFormAmount(e.target.value)} className={`w-full border rounded-xl p-2.5 text-xs font-ledger focus:outline-none transition ${inputClass}`} required />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[9px] uppercase font-bold mb-1 text-slate-400">Description</label>
                    <input type="text" placeholder="Starbucks, salary, utilities..." value={formDescription} onChange={(e) => setFormDescription(e.target.value)} className={`w-full border rounded-xl p-3 text-xs focus:outline-none transition ${inputClass}`} />
                  </div>

                  <label className="flex items-center gap-2.5 cursor-pointer p-3 border rounded-xl border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20 select-none text-xs font-bold text-slate-700 dark:text-slate-300">
                    <input type="checkbox" checked={formIsRecurring} onChange={(e) => setFormIsRecurring(e.target.checked)} className="rounded text-[#0284C7] focus:ring-0 w-4 h-4" />
                    <span>Make this a recurring monthly bill</span>
                  </label>

                  <div className="flex gap-2">
                    <button type="button" onClick={() => setShowAddForm(false)} className="flex-1 py-3 text-xs border border-slate-200 dark:border-slate-700 rounded-xl font-bold">Cancel</button>
                    <button type="submit" className={`flex-1 py-3 text-xs font-bold text-white rounded-xl ${isDark ? "bg-[#38BDF8]" : "bg-[#0284C7]"}`}>Save Transaction</button>
                  </div>
                </form>
              </div>
            )}

            {/* DYNAMIC SEARCH & MULTI-FILTER BAR */}
            <div className={`${cardClass} p-4 space-y-4`}>
              <div className="flex flex-col md:flex-row gap-3">
                <div className="flex-1 relative">
                  <Search size={14} className="absolute left-3.5 top-3.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search merchant or category..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className={`w-full border rounded-xl py-2.5 pl-10 pr-4 text-xs focus:outline-none ${inputClass}`}
                  />
                </div>
                <div className="grid grid-cols-3 gap-2 shrink-0">
                  <select value={filterType} onChange={(e) => setFilterType(e.target.value as "all" | "income" | "expense" | "loan")} className={`border text-xs p-2 rounded-xl focus:outline-none ${inputClass}`}>
                    <option value="all">All Types</option>
                    <option value="income">Incomes</option>
                    <option value="expense">Expenses</option>
                    <option value="loan">Loans</option>
                  </select>

                  <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} className={`border text-xs p-2 rounded-xl focus:outline-none ${inputClass}`}>
                    <option value="all">All Categories</option>
                    <option value="Food">Food</option>
                    <option value="Transport / Fuel">Transport</option>
                    <option value="Car Expenses">Car Maintenance</option>
                    <option value="Loans & Ekub">Loans</option>
                    <option value="Personal & Date">Personal</option>
                    <option value="Income Stream">Incomes</option>
                    <option value="General">General</option>
                  </select>

                  <select value={filterBank} onChange={(e) => setFilterBank(e.target.value)} className={`border text-xs p-2 rounded-xl focus:outline-none ${inputClass}`}>
                    <option value="all">All Accounts</option>
                    <option value="USD">USD Accounts</option>
                    <option value="ETB">ETB Accounts</option>
                  </select>
                </div>
              </div>
            </div>

            {/* LEDGER DISPLAY TABLE */}
            <div className={`${cardClass} overflow-hidden p-0`}>
              <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
                <h3 className="font-display text-sm font-bold text-slate-900 dark:text-white">
                  Audited Entries <span className="font-body text-xs font-normal text-slate-400">({fullyFilteredTransactions.length})</span>
                </h3>
                {loading && <span className="text-xs text-[#0284C7] font-bold animate-pulse flex items-center gap-1"><Sparkles size={11} /> Cloud syncing...</span>}
              </div>

              {fullyFilteredTransactions.length === 0 ? (
                <div className={`p-16 text-center text-xs ${subtleText}`}>No transactions match your search filter criteria.</div>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-[500px] overflow-y-auto">
                  {fullyFilteredTransactions.map((tx) => (
                    <div key={tx.id} className="p-4 pl-5 border-l-4 border-transparent hover:border-l-[#0284C7] transition flex justify-between items-center gap-4 group hover:bg-slate-50/40 dark:hover:bg-slate-800/10">
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-[9px] uppercase font-extrabold px-2 py-0.5 rounded-full border ${
                            tx.type === "income" 
                              ? "bg-emerald-50 text-emerald-600 border-emerald-100" 
                              : "bg-red-50 text-red-600 border-red-100"
                          }`}>
                            {tx.type}
                          </span>
                          {tx.is_recurring && <span className="text-[9px] bg-sky-50 text-sky-600 border border-sky-100 px-2 py-0.5 rounded-full font-bold flex items-center gap-0.5"><Repeat size={9} /> Auto</span>}
                          <span className={`text-[10px] font-bold ${subtleText}`}>{tx.date}</span>
                          <span className="text-[10px] bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full font-bold text-slate-600 dark:text-slate-400">{tx.category}</span>
                        </div>
                        <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{tx.description}</p>
                      </div>

                      <div className="flex items-center gap-4 shrink-0">
                        <div className="text-right">
                          <p className={`font-ledger text-sm ${tx.type === "income" ? "text-[#16A34A]" : "text-slate-900 dark:text-white"}`}>
                            {tx.type === "expense" ? "−" : "+"}{Number(tx.amount_etb).toLocaleString()} ETB
                          </p>
                          {tx.original_currency === "USD" && (
                            <p className={`text-[9px] font-semibold ${subtleText}`}>
                              {tx.type === "expense" ? "−" : "+"}${tx.original_amount.toLocaleString()} USD
                            </p>
                          )}
                        </div>
                        <div className="flex items-center opacity-0 group-hover:opacity-100 transition">
                          <button onClick={() => setEditingTx(tx)} aria-label="Edit entry" className={`p-2 rounded-lg transition ${isDark ? "hover:bg-slate-700 text-slate-400 hover:text-white" : "hover:bg-slate-100 text-slate-500 hover:text-slate-900"}`}><Pencil size={12} /></button>
                          <button onClick={() => handleDeleteTransaction(tx.id)} aria-label="Delete entry" className={`p-2 rounded-lg transition ${isDark ? "hover:bg-slate-700 text-slate-400 hover:text-white" : "hover:bg-slate-100 text-slate-500 hover:text-slate-900"}`}><Trash2 size={12} /></button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ================================== BUDGETS TAB ================================== */}
        {activeTab === "budgets" && (
          <div className={`${cardClass} max-w-xl mx-auto space-y-6`}>
            <div>
              <h2 className="font-display text-lg font-bold text-slate-950 dark:text-white">Category Budget Limits</h2>
              <p className={`text-xs ${subtleText}`}>Establish monthly target thresholds per category to track spending triggers.</p>
            </div>

            <div className="space-y-3.5">
              {Object.keys(tempBudgets).map((cat) => (
                <div key={cat} className={`p-4 border rounded-xl flex justify-between items-center gap-4 ${isDark ? "bg-slate-800/40 border-slate-700" : "bg-slate-50/50 border-slate-200/50"}`}>
                  <span className="text-xs font-bold text-slate-900 dark:text-white">{cat}</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={tempBudgets[cat] ?? 0}
                      onChange={(e) => setTempBudgets({ ...tempBudgets, [cat]: parseFloat(e.target.value) || 0 })}
                      className={`w-32 border rounded-xl p-2 text-xs font-ledger text-right focus:outline-none ${inputClass}`}
                    />
                    <span className={`text-xs font-bold ${subtleText}`}>ETB</span>
                  </div>
                </div>
              ))}
            </div>

            {budgetSaveMessage && (
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-600 text-xs font-bold text-center">
                {budgetSaveMessage}
              </div>
            )}

            <button onClick={handleSaveAllBudgets} className={`w-full py-3.5 rounded-xl text-xs font-bold text-white uppercase tracking-wide flex items-center justify-center gap-1.5 ${isDark ? "bg-[#38BDF8]" : "bg-[#0284C7]"}`}>
              <Save size={14} /> Commit Changes
            </button>
          </div>
        )}

        {/* ================================== VAULTS (SAVINGS) TAB ================================== */}
        {activeTab === "goals" && (
          <div className="space-y-6 max-w-4xl mx-auto">
            <div className={`${cardClass} space-y-4`}>
              <h2 className="font-display text-lg font-bold text-slate-950 dark:text-white">Savings Vault Architect</h2>
              <p className={`text-xs ${subtleText}`}>Stash funds, target dates, and map goals with automated milestone tracking.</p>
              <form onSubmit={handleAddGoal} className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <input type="text" placeholder="Vault Title (e.g. Vacation)" value={goalTitle} onChange={(e) => setGoalTitle(e.target.value)} className={`border rounded-xl p-2.5 text-xs font-bold ${inputClass}`} required />
                <input type="number" placeholder="Target (ETB)" value={goalTarget} onChange={(e) => setGoalTarget(e.target.value)} className={`border rounded-xl p-2.5 text-xs font-ledger ${inputClass}`} required />
                <input type="date" value={goalDate} onChange={(e) => setGoalDate(e.target.value)} className={`border rounded-xl p-2.5 text-xs ${inputClass}`} />
                <button type="submit" className={`py-2.5 rounded-xl text-xs font-bold text-white ${isDark ? "bg-[#38BDF8]" : "bg-[#0284C7]"}`}>Create Vault</button>
              </form>
            </div>

            {goals.length === 0 ? (
              <div className={`${cardClass} text-center py-16 text-xs ${subtleText}`}>No active vaults found. Define one above to prioritize your assets.</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {goals.map((goal) => {
                  const progress = Math.min(Math.round((goal.current_amount / goal.target_amount) * 100), 100);
                  const isCompleted = progress >= 100;
                  
                  return (
                    <div key={goal.id} className={`${cardClass} border-t-4 ${isCompleted ? "border-t-[#16A34A]" : "border-t-[#0284C7]"} flex flex-col justify-between h-56`}>
                      <div className="space-y-2">
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 className="font-display text-sm font-bold text-slate-950 dark:text-white">{goal.title}</h4>
                            {goal.target_date && <span className={`text-[10px] font-semibold ${subtleText}`}>Target by: {goal.target_date}</span>}
                          </div>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${isCompleted ? "bg-emerald-50 text-emerald-600" : "bg-sky-50 text-sky-600"}`}>
                            {progress}%
                          </span>
                        </div>

                        <div className="space-y-1">
                          <p className="font-ledger text-lg font-bold text-slate-900 dark:text-white">
                            {goal.current_amount.toLocaleString()} / {goal.target_amount.toLocaleString()} ETB
                          </p>
                          <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
                            <div className={`h-full ${isCompleted ? "bg-[#16A34A]" : "bg-[#0284C7]"} rounded-full transition-all duration-500`} style={{ width: `${progress}%` }} />
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800">
                        {goalDeposit?.id === goal.id ? (
                          <div className="flex gap-2">
                            <input
                              type="number"
                              placeholder="Deposit amount"
                              value={goalDeposit.amount}
                              onChange={(e) => setGoalDeposit({ id: goal.id, amount: e.target.value })}
                              className={`flex-1 border rounded-xl p-2 text-xs font-ledger focus:outline-none ${inputClass}`}
                              autoFocus
                            />
                            <button onClick={() => handleDepositGoal(goal.id, goalDeposit.amount)} className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-[#16A34A] hover:bg-[#16A34A]/90 transition">Save</button>
                            <button onClick={() => setGoalDeposit(null)} className="px-2 py-2 text-slate-400 hover:text-slate-600">✕</button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setGoalDeposit({ id: goal.id, amount: "" })}
                            disabled={isCompleted}
                            className={`w-full py-2 border rounded-xl text-xs font-bold text-center transition ${
                              isCompleted 
                                ? "bg-emerald-50/50 text-[#16A34A] border-emerald-100" 
                                : "border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white hover:bg-slate-50 dark:hover:bg-slate-800"
                            }`}
                          >
                            {isCompleted ? "🎖 Vault Milestone Achieved" : "+ Inject Savings"}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ================================== VISUAL INSIGHTS TAB ================================== */}
        {activeTab === "insights" && (
          <div className="space-y-6">
            <div>
              <h2 className="font-display text-lg font-bold text-slate-950 dark:text-white">Multi-Dimensional Analytics</h2>
              <p className={`text-xs ${subtleText}`}>Explore high-fidelity visual diagrams detailing monthly cash flow, category breakdowns, and net worth progress.</p>
            </div>

            {/* NET WORTH TREND OVER TIME */}
            <div className={cardClass}>
              <h3 className="font-display text-sm font-bold mb-4 text-slate-950 dark:text-white flex items-center gap-1.5">
                <LineChartIcon size={14} className="text-[#0284C7]" /> Net Worth Growth Trend (ETB)
              </h3>
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={areaChartData}>
                    <defs>
                      <linearGradient id="colorNetWorth" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#0284C7" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#0284C7" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={isDark ? "#334155" : "#f1f5f9"} vertical={false} />
                    <XAxis dataKey="date" stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} />
                    <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={{ backgroundColor: isDark ? "#1E293B" : "#ffffff", borderColor: "#cbd5e1", borderRadius: "8px", fontSize: "11px", fontFamily: "Inter" }} />
                    <Area type="monotone" dataKey="NetWorth" stroke="#0284C7" strokeWidth={2.5} fillOpacity={1} fill="url(#colorNetWorth)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* CATEGORY BREAKDOWN DOUGHNUT */}
              <div className={cardClass}>
                <h3 className="font-display text-sm font-bold mb-4 text-slate-950 dark:text-white flex items-center gap-1.5">
                  <PieChartIcon size={14} className="text-[#0284C7]" /> Spending Distribution by Category
                </h3>
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
                        <Tooltip contentStyle={{ backgroundColor: isDark ? "#1E293B" : "#ffffff", borderColor: "#cbd5e1", borderRadius: "8px", fontSize: "11px", fontFamily: "Inter" }} />
                        <Legend iconSize={8} iconType="circle" wrapperStyle={{ fontSize: "10px", marginTop: "10px" }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>

              {/* MONTHLY INCOME VS EXPENSE COMPARISON */}
              <div className={cardClass}>
                <h3 className="font-display text-sm font-bold mb-4 text-slate-950 dark:text-white flex items-center gap-1.5">
                  <BarChart3 size={14} className="text-[#0284C7]" /> Income vs. Outflows Monthly Ledger ({selectedYear})
                </h3>
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={barChartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke={isDark ? "#334155" : "#f1f5f9"} vertical={false} />
                      <XAxis dataKey="month" stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} />
                      <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} />
                      <Tooltip contentStyle={{ backgroundColor: isDark ? "#1E293B" : "#ffffff", borderColor: "#cbd5e1", borderRadius: "8px", fontSize: "11px", fontFamily: "Inter" }} cursor={{ fill: "rgba(0,0,0,0.02)" }} />
                      <Legend iconSize={8} iconType="circle" wrapperStyle={{ fontSize: "10px" }} />
                      <Bar dataKey="Income" fill="#16A34A" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="Expense" fill="#DC2626" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ================================== SETTINGS TAB ================================== */}
        {activeTab === "settings" && (
          <div className="space-y-6 max-w-2xl mx-auto">
            <div className={cardClass}>
              <h2 className="font-display text-lg font-bold mb-2 text-slate-950 dark:text-white flex items-center gap-1.5">
                <SettingsIcon size={17} /> Portal Configuration
              </h2>
              <p className={`text-xs ${subtleText}`}>Configure local conversion index metrics or wipe stored variables.</p>

              <div className={`mt-6 divide-y ${isDark ? "divide-slate-800" : "divide-slate-100"}`}>
                <div className="py-4 flex justify-between items-center">
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white">Active Account</h4>
                    <p className={`text-[11px] ${subtleText}`}>{user.email}</p>
                  </div>
                  <span className="text-[10px] font-bold bg-emerald-50 text-emerald-600 px-3 py-1 rounded-full">Synchronized</span>
                </div>

                <div className="py-4 flex justify-between items-center">
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white">USD Conversion Index</h4>
                    <p className={`text-[11px] ${subtleText}`}>Custom conversion benchmark for USD inputs to ETB ledger.</p>
                  </div>
                  <input
                    type="number"
                    value={usdRate}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value) || 180;
                      setUsdRate(val);
                      localStorage.setItem("fp_usd_rate", val.toString());
                    }}
                    className={`w-28 border rounded-xl p-2.5 text-xs font-ledger text-right focus:outline-none ${inputClass}`}
                  />
                </div>

                <div className="py-4 space-y-3">
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white">Bulk Statement Import (CSV)</h4>
                    <p className={`text-[11px] ${subtleText}`}>Drag and drop or paste raw CSV lines to parse and populate database statements.</p>
                  </div>
                  <div className={`p-6 border border-dashed rounded-xl flex flex-col items-center justify-center text-center gap-3 bg-slate-50/50 dark:bg-slate-800/10 border-slate-200 dark:border-slate-800`}>
                    <UploadCloud size={20} className="text-[#0284C7]" />
                    <input type="file" accept=".csv" onChange={handleFileUpload} className={`text-xs text-slate-400 file:mr-4 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:cursor-pointer ${isDark ? "file:bg-[#38BDF8]" : "file:bg-[#0284C7] file:text-white"}`} />
                  </div>
                  {csvContent && (
                    <div className="space-y-2">
                      <textarea value={csvContent} onChange={(e) => setCsvContent(e.target.value)} className={`w-full h-32 border rounded-xl p-3 text-[10px] font-ledger focus:outline-none ${inputClass}`} />
                      <button onClick={handleCustomCsvImport} className="w-full py-2 bg-[#16A34A] text-white rounded-xl text-xs font-bold hover:bg-[#16A34A]/90 transition">Commit Bulk Import</button>
                    </div>
                  )}
                </div>

                <div className="py-4 space-y-2">
                  <div>
                    <h4 className="text-xs font-bold text-[#DC2626]">Destructive Actions</h4>
                    <p className={`text-[11px] ${subtleText}`}>Permanently purge transaction ledgers synced with your cloud credentials.</p>
                  </div>
                  <button onClick={handleClearAllData} className="w-full py-3 bg-[#DC2626]/5 hover:bg-[#DC2626]/10 border border-[#DC2626]/20 text-[#DC2626] rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5">
                    <Trash2 size={13} /> Secure Wiping of Cloud Records
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ================================== FLOATING AI COACH WIDGET ================================== */}
      <div className="fixed bottom-6 right-6 z-40">
        {chatOpen ? (
          <div className="w-80 sm:w-96 h-[450px] border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#1E293B] shadow-2xl rounded-2xl flex flex-col justify-between overflow-hidden transition-all duration-300">
            <div className="bg-[#0284C7] text-white p-4 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 bg-white/20 rounded-full flex items-center justify-center">
                  <Sparkles size={11} className="text-white" />
                </div>
                <h4 className="text-xs font-bold tracking-tight">Neo AI Financial Coach</h4>
              </div>
              <button onClick={() => setChatOpen(false)} className="text-white/80 hover:text-white">
                <X size={15} />
              </button>
            </div>

            <div className="flex-1 p-4 space-y-3 overflow-y-auto text-xs">
              {chatMessages.map((m, idx) => (
                <div key={idx} className={`flex ${m.sender === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[80%] rounded-xl p-3 leading-relaxed font-body ${
                    m.sender === "user" 
                      ? "bg-[#0284C7] text-white" 
                      : "bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                  }`}>
                    {m.text}
                  </div>
                </div>
              ))}
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendChatMessage(chatInput);
              }}
              className="p-3 border-t border-slate-100 dark:border-slate-800 flex gap-2"
            >
              <input
                type="text"
                placeholder="Ask about budgets or net worth..."
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                className={`flex-1 border rounded-xl px-3 py-2 text-xs focus:outline-none ${inputClass}`}
              />
              <button type="submit" className="w-9 h-9 shrink-0 rounded-xl bg-[#0284C7] text-white flex items-center justify-center hover:bg-[#0369a1] transition shadow-sm">
                <Send size={13} />
              </button>
            </form>
          </div>
        ) : (
          <button
            onClick={() => setChatOpen(true)}
            className="w-12 h-12 bg-[#0284C7] text-white rounded-full flex items-center justify-center hover:bg-[#0369a1] transition-all duration-300 shadow-2xl hover:scale-105"
            aria-label="Ask AI Coach"
          >
            <MessageSquare size={20} />
          </button>
        )}
      </div>

      {/* ================================== PLAID LINK MODAL SIMULATOR ================================== */}
      {plaidStep && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className={`${cardClass} max-w-md w-full p-6 space-y-6 border-2 border-[#0284C7] relative`}>
            <button onClick={() => setPlaidStep(null)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600">✕</button>
            
            <div className="text-center space-y-1">
              <span className="text-[9px] uppercase tracking-wider font-extrabold text-[#0284C7]">Plaid Link Portal</span>
              <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">Aggregate Financial Institutions</h3>
            </div>

            {plaidStep === "select" && (
              <div className="space-y-3">
                <p className={`text-xs text-center ${subtleText}`}>Select your primary provider to establish OAuth2 credential sync:</p>
                <div className="grid grid-cols-2 gap-2 pt-2">
                  {["Chase", "Stripe", "Wise", "Coinbase", "Fidelity", "Robinhood"].map((inst) => (
                    <button
                      key={inst}
                      onClick={() => {
                        setSelectedInstitution(inst);
                        setPlaidStep("auth");
                      }}
                      className="p-3 border border-slate-200 dark:border-slate-800 rounded-xl hover:border-[#0284C7] font-bold text-xs transition text-center bg-slate-50/50 dark:bg-slate-800/10"
                    >
                      {inst}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {plaidStep === "auth" && (
              <form onSubmit={handlePlaidSubmit} className="space-y-4">
                <p className="text-xs text-center text-slate-500 font-bold">Connect secure statement sync with {selectedInstitution}:</p>
                <div className="space-y-3">
                  <input
                    type="text"
                    placeholder="Online Banking Username"
                    value={plaidUser}
                    onChange={(e) => setPlaidUser(e.target.value)}
                    className={`w-full border rounded-xl p-3 text-xs focus:outline-none ${inputClass}`}
                    required
                  />
                  <input
                    type="password"
                    placeholder="Online Banking Password"
                    value={plaidPass}
                    onChange={(e) => setPlaidPass(e.target.value)}
                    className={`w-full border rounded-xl p-3 text-xs focus:outline-none ${inputClass}`}
                    required
                  />
                </div>
                <button type="submit" className="w-full py-3 bg-[#0284C7] text-white rounded-xl text-xs font-bold hover:bg-[#0369a1] transition">Authorize Connection</button>
              </form>
            )}

            {plaidStep === "loading" && (
              <div className="text-center py-8 space-y-4">
                <div className="w-10 h-10 border-4 border-[#0284C7] border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-xs font-bold text-slate-500 animate-pulse">Establishing mutual TLS &amp; retrieving statement data...</p>
              </div>
            )}

            {plaidStep === "success" && (
              <div className="text-center py-8 space-y-3">
                <div className="w-12 h-12 bg-emerald-50 text-emerald-500 border border-emerald-100 rounded-full flex items-center justify-center mx-auto text-xl font-bold">✓</div>
                <h4 className="text-sm font-bold text-[#16A34A]">Plaid Sync Complete</h4>
                <p className={`text-xs ${subtleText}`}>2 mock accounts successfully aggregated. Syncing initial statement history...</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* EDIT TRANSACTION MODAL */}
      {editingTx && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50" onClick={() => setEditingTx(null)}>
          <div className={`${cardClass} max-w-md w-full p-6 space-y-4`} onClick={(e) => e.stopPropagation()}>
            <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">Edit Audited Entry</h2>
            <form onSubmit={handleUpdateTransaction} className="space-y-3.5">
              <div>
                <label className="block text-[9px] uppercase font-bold mb-1 text-slate-400">Date</label>
                <input type="date" value={editingTx.date} onChange={(e) => setEditingTx({ ...editingTx, date: e.target.value })} className={`w-full border rounded-xl p-2.5 text-xs focus:outline-none transition ${inputClass}`} required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[9px] uppercase font-bold mb-1 text-slate-400">Type</label>
                  <select value={editingTx.type} onChange={(e) => setEditingTx({ ...editingTx, type: e.target.value as "income" | "expense" | "loan" })} className={`w-full border rounded-xl p-2.5 text-xs focus:outline-none transition ${inputClass}`}>
                    <option value="expense">Expense</option>
                    <option value="income">Income</option>
                    <option value="loan">Loan Payment</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[9px] uppercase font-bold mb-1 text-slate-400">Currency</label>
                  <select value={editingTx.original_currency} onChange={(e) => setEditingTx({ ...editingTx, original_currency: e.target.value as "ETB" | "USD" })} className={`w-full border rounded-xl p-2.5 text-xs focus:outline-none transition ${inputClass}`}>
                    <option value="ETB">ETB</option>
                    <option value="USD">USD ($)</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-[9px] uppercase font-bold mb-1 text-slate-400">Amount</label>
                <input type="number" step="any" value={editingTx.original_amount} onChange={(e) => setEditingTx({ ...editingTx, original_amount: parseFloat(e.target.value) || 0 })} className={`w-full border rounded-xl p-2.5 text-xs font-ledger focus:outline-none transition ${inputClass}`} required />
              </div>
              <div>
                <label className="block text-[9px] uppercase font-bold mb-1 text-slate-400">Category</label>
                <select value={editingTx.category} onChange={(e) => setEditingTx({ ...editingTx, category: e.target.value })} className={`w-full border rounded-xl p-2.5 text-xs focus:outline-none transition ${inputClass}`}>
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
                <label className="block text-[9px] uppercase font-bold mb-1 text-slate-400">Description</label>
                <input type="text" value={editingTx.description} onChange={(e) => setEditingTx({ ...editingTx, description: e.target.value })} className={`w-full border rounded-xl p-2.5 text-xs focus:outline-none transition ${inputClass}`} />
              </div>
              <label className="flex items-center gap-2 cursor-pointer pt-1 select-none text-xs font-bold text-slate-700 dark:text-slate-300">
                <input type="checkbox" checked={editingTx.is_recurring || false} onChange={(e) => setEditingTx({ ...editingTx, is_recurring: e.target.checked })} className="rounded text-[#0284C7] focus:ring-0 w-4 h-4" />
                <span>Make this a recurring monthly bill</span>
              </label>
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setEditingTx(null)} className="flex-1 py-2.5 text-xs border border-slate-200 dark:border-slate-700 rounded-xl font-bold">Cancel</button>
                <button type="submit" className="flex-1 py-2.5 text-xs font-bold text-white bg-[#0284C7] rounded-xl hover:bg-[#0369a1] transition">Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
