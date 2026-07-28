"use client";

import React, { useState, useEffect, useMemo } from "react";
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
}

const USD_TO_ETB_RATE = 180;
const CATEGORY_COLORS: Record<string, string> = {
  Food: "#10b981",
  "Transport / Fuel": "#3b82f6",
  "Car Expenses": "#f59e0b",
  "Loans & Ekub": "#8b5cf6",
  "Personal & Date": "#ec4899",
  "Income Stream": "#06b6d4",
  General: "#64748b",
};

export default function ReusableTracker() {
  // Theme State
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  // Auth State
  const [user, setUser] = useState<User | null>(null);
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [authName, setAuthName] = useState("");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authMessage, setAuthMessage] = useState("");

  // Data State
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<"dashboard" | "add" | "csv" | "settings">("dashboard");

  // Editing Modal / State
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);

  // Filter State
  const [timeframe, setTimeframe] = useState<"monthly" | "yearly" | "all">("monthly");
  const [selectedYear, setSelectedYear] = useState<string>("2026");
  const [selectedMonth, setSelectedMonth] = useState<string>("07");

  // Form Entry States
  const [formDate, setFormDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [formType, setFormType] = useState<"income" | "expense" | "loan">("expense");
  const [formAmount, setFormAmount] = useState<string>("");
  const [formCurrency, setFormCurrency] = useState<"ETB" | "USD">("ETB");
  const [formCategory, setFormCategory] = useState<string>("Food");
  const [formDescription, setFormDescription] = useState<string>("");
  const [csvContent, setCsvContent] = useState<string>("");

  useEffect(() => {
    const savedTheme = localStorage.getItem("ft_theme");
    if (savedTheme === "light" || savedTheme === "dark") {
      setTheme(savedTheme);
    }
  }, []);

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    localStorage.setItem("ft_theme", next);
  };

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (user) {
      fetchCloudTransactions(user.id);
    }
  }, [user]);

  const fetchCloudTransactions = async (userId: string) => {
    setLoading(true);
    const { data, error } = await supabase
      .from("transactions")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching transactions:", error.message);
    } else if (data) {
      setAllTransactions(data as Transaction[]);
    }
    setLoading(false);
  };

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthMessage("");

    if (authMode === "signup") {
      setAuthMessage("Creating account...");
      const { data, error } = await supabase.auth.signUp({
        email: authEmail,
        password: authPassword,
        options: {
          data: {
            display_name: authName || authEmail.split("@")[0],
          },
        },
      });

      if (error) {
        setAuthMessage("Error: " + error.message);
      } else {
        setAuthMessage("Success! Check your email or log in.");
        setAuthPassword("");
      }
    } else {
      setAuthMessage("Authenticating...");
      const { error } = await supabase.auth.signInWithPassword({
        email: authEmail,
        password: authPassword,
      });

      if (error) {
        setAuthMessage("Error: " + error.message);
      } else {
        setAuthMessage("");
        setAuthPassword("");
      }
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setAllTransactions([]);
  };

  const handleUpdateTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTx || !user) return;

    const rawAmt = Number(editingTx.original_amount);
    const amountETB = editingTx.original_currency === "USD" ? rawAmt * USD_TO_ETB_RATE : rawAmt;

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
    if (!user || !confirm("Are you sure you want to delete this transaction?")) return;

    const { error } = await supabase.from("transactions").delete().eq("id", id).eq("user_id", user.id);

    if (error) {
      alert("Failed to delete: " + error.message);
    } else {
      await fetchCloudTransactions(user.id);
    }
  };

  // CLEAR ALL CLOUD DATA
  const handleClearAllData = async () => {
    if (!user) return;
    const confirmation = prompt('Type "DELETE" to permanently remove all your cloud transaction data:');
    if (confirmation !== "DELETE") {
      alert("Action canceled.");
      return;
    }

    setLoading(true);
    const { error } = await supabase.from("transactions").delete().eq("user_id", user.id);

    if (error) {
      alert("Error clearing data: " + error.message);
    } else {
      alert("All transaction records cleared successfully.");
      await fetchCloudTransactions(user.id);
    }
    setLoading(false);
  };

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

  const filteredTransactions = useMemo(() => {
    return allTransactions.filter((t) => {
      if (timeframe === "all") return true;
      const d = new Date(t.date);
      if (isNaN(d.getTime())) return true;

      const y = d.getFullYear().toString();
      const m = String(d.getMonth() + 1).padStart(2, "0");

      if (timeframe === "yearly") return y === selectedYear;
      if (timeframe === "monthly") return y === selectedYear && m === selectedMonth;
      return true;
    });
  }, [allTransactions, timeframe, selectedYear, selectedMonth]);

  const categoryChartData = useMemo(() => {
    const expenses = filteredTransactions.filter((t) => t.type === "expense");
    const map: Record<string, number> = {};

    expenses.forEach((t) => {
      map[t.category] = (map[t.category] || 0) + Number(t.amount_etb);
    });

    return Object.keys(map).map((cat) => ({
      name: cat,
      value: map[cat],
      color: CATEGORY_COLORS[cat] || CATEGORY_COLORS.General,
    }));
  }, [filteredTransactions]);

  const barChartData = useMemo(() => {
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return months.map((m, idx) => {
      const monthNum = String(idx + 1).padStart(2, "0");
      const monthTx = allTransactions.filter((t) => {
        const d = new Date(t.date);
        if (isNaN(d.getTime())) return false;
        return d.getFullYear().toString() === selectedYear && String(d.getMonth() + 1).padStart(2, "0") === monthNum;
      });

      const income = monthTx.filter((t) => t.type === "income").reduce((a, b) => a + Number(b.amount_etb), 0);
      const expense = monthTx.filter((t) => t.type === "expense").reduce((a, b) => a + Number(b.amount_etb), 0);

      return { month: m, Income: income, Expense: expense };
    });
  }, [allTransactions, selectedYear]);

  const totalIncome = filteredTransactions.filter((t) => t.type === "income").reduce((a, b) => a + Number(b.amount_etb), 0);
  const totalExpense = filteredTransactions.filter((t) => t.type === "expense").reduce((a, b) => a + Number(b.amount_etb), 0);

  const handleAddManual = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formAmount || !user) return;

    const rawAmt = parseFloat(formAmount);
    const amountETB = formCurrency === "USD" ? rawAmt * USD_TO_ETB_RATE : rawAmt;

    const newTx = {
      id: Date.now().toString(),
      user_id: user.id,
      date: formDate,
      type: formType,
      amount_etb: amountETB,
      original_currency: formCurrency,
      original_amount: rawAmt,
      category: formCategory,
      description: formDescription || formCategory,
    };

    const { error } = await supabase.from("transactions").insert([newTx]);

    if (error) {
      alert("Error saving: " + error.message);
    } else {
      await fetchCloudTransactions(user.id);
      setFormAmount("");
      setFormDescription("");
      setActiveTab("dashboard");
    }
  };

  const handleCustomCsvImport = async () => {
    if (!csvContent.trim() || !user) return;

    const lines = csvContent.split("\n").map((l) => l.trim()).filter(Boolean);
    const parsedData: any[] = [];
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
      const amountETB = currency === "USD" ? rawAmt * USD_TO_ETB_RATE : rawAmt;

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

    if (error) {
      alert("Error importing CSV: " + error.message);
    } else {
      await fetchCloudTransactions(user.id);
      setCsvContent("");
      setActiveTab("dashboard");
    }
  };

  const isDark = theme === "dark";
  const bgClass = isDark ? "bg-slate-950 text-slate-100" : "bg-slate-100 text-slate-900";
  const cardClass = isDark ? "bg-slate-900/90 border-slate-800 shadow-2xl shadow-emerald-500/5 backdrop-blur-2xl" : "bg-white/90 border-slate-200/90 shadow-xl backdrop-blur-2xl";
  const inputClass = isDark ? "bg-slate-950/90 border-slate-800 text-slate-100 focus:border-emerald-500" : "bg-slate-50 border-slate-300 text-slate-900 focus:border-emerald-500";

  if (!user) {
    return (
      <div className={`min-h-screen ${bgClass} flex items-center justify-center p-4 transition-colors`}>
        <div className={`${cardClass} border p-8 rounded-3xl max-w-md w-full space-y-6 shadow-2xl relative overflow-hidden`}>
          <div className="flex justify-between items-center">
            <h1 className="text-3xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-500">
              Financial Hub
            </h1>
            <button onClick={toggleTheme} className={`p-2.5 rounded-2xl border text-xs font-bold ${isDark ? "bg-slate-800 border-slate-700 text-slate-300" : "bg-slate-200 border-slate-300 text-slate-700"}`}>
              {isDark ? "☀️ Light" : "🌙 Dark"}
            </button>
          </div>

          <div className={`p-1.5 rounded-2xl border flex gap-1 ${isDark ? "bg-slate-950 border-slate-800" : "bg-slate-200 border-slate-300"}`}>
            <button onClick={() => { setAuthMode("login"); setAuthMessage(""); }} className={`flex-1 py-2.5 rounded-xl text-xs font-black transition ${authMode === "login" ? "bg-emerald-500 text-slate-950 shadow-md" : "text-slate-400"}`}>
              Log In
            </button>
            <button onClick={() => { setAuthMode("signup"); setAuthMessage(""); }} className={`flex-1 py-2.5 rounded-xl text-xs font-black transition ${authMode === "signup" ? "bg-emerald-500 text-slate-950 shadow-md" : "text-slate-400"}`}>
              Sign Up
            </button>
          </div>

          <form onSubmit={handleAuthSubmit} className="space-y-4">
            {authMode === "signup" && (
              <div>
                <label className="block text-xs font-bold mb-1.5 text-slate-400">Full Name</label>
                <input type="text" placeholder="Full Name" value={authName} onChange={(e) => setAuthName(e.target.value)} className={`w-full border rounded-2xl p-3.5 text-sm focus:outline-none ${inputClass}`} required />
              </div>
            )}
            <div>
              <label className="block text-xs font-bold mb-1.5 text-slate-400">Email Address</label>
              <input type="email" placeholder="name@domain.com" value={authEmail} onChange={(e) => setAuthEmail(e.target.value)} className={`w-full border rounded-2xl p-3.5 text-sm focus:outline-none ${inputClass}`} required />
            </div>
            <div>
              <label className="block text-xs font-bold mb-1.5 text-slate-400">Password</label>
              <input type="password" placeholder="••••••••" value={authPassword} onChange={(e) => setAuthPassword(e.target.value)} className={`w-full border rounded-2xl p-3.5 text-sm focus:outline-none ${inputClass}`} required minLength={6} />
            </div>

            {authMessage && (
              <p className={`text-xs font-bold p-3 rounded-xl text-center border ${authMessage.includes("Error") ? "bg-rose-950/40 border-rose-800 text-rose-400" : "bg-emerald-950/40 border-emerald-800 text-emerald-400"}`}>
                {authMessage}
              </p>
            )}

            <button type="submit" className="w-full bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 font-black py-4 rounded-2xl transition shadow-xl shadow-emerald-500/20">
              {authMode === "login" ? "Log In" : "Create Account"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${bgClass} font-sans p-4 md:p-8 max-w-6xl mx-auto space-y-6 transition-colors duration-200`}>
      {/* HEADER NAVBAR */}
      <header className={`flex flex-col md:flex-row justify-between items-start md:items-center ${cardClass} border p-6 rounded-3xl gap-4 shadow-xl`}>
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400">
              Financial Hub
            </h1>
            <span className={`text-[11px] border px-3 py-1 rounded-full font-extrabold ${isDark ? "bg-slate-800/80 border-slate-700 text-emerald-400" : "bg-slate-100 border-slate-300 text-emerald-600"}`}>
              $1 = 180 ETB
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1 font-medium">
            Account: <strong className={isDark ? "text-slate-200" : "text-slate-800"}>{user.user_metadata?.display_name || user.email}</strong>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          <button onClick={() => setActiveTab("dashboard")} className={`px-4 py-2.5 rounded-2xl font-black text-xs transition ${activeTab === "dashboard" ? "bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20" : isDark ? "bg-slate-800 text-slate-300" : "bg-slate-200 text-slate-700"}`}>
            Dashboard
          </button>
          <button onClick={() => setActiveTab("add")} className={`px-4 py-2.5 rounded-2xl font-black text-xs transition ${activeTab === "add" ? "bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20" : isDark ? "bg-slate-800 text-slate-300" : "bg-slate-200 text-slate-700"}`}>
            + Entry
          </button>
          <button onClick={() => setActiveTab("csv")} className={`px-4 py-2.5 rounded-2xl font-black text-xs transition ${activeTab === "csv" ? "bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20" : isDark ? "bg-slate-800 text-slate-300" : "bg-slate-200 text-slate-700"}`}>
            Bulk CSV
          </button>
          <button onClick={() => setActiveTab("settings")} className={`px-4 py-2.5 rounded-2xl font-black text-xs transition ${activeTab === "settings" ? "bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20" : isDark ? "bg-slate-800 text-slate-300" : "bg-slate-200 text-slate-700"}`}>
            ⚙️ Settings
          </button>
          <button onClick={toggleTheme} className={`px-3.5 py-2.5 border text-xs rounded-2xl font-bold transition ${isDark ? "bg-slate-800 border-slate-700 text-slate-300" : "bg-slate-200 border-slate-300 text-slate-700"}`}>
            {isDark ? "☀️ Light" : "🌙 Dark"}
          </button>
          <button onClick={handleSignOut} className="px-3.5 py-2.5 bg-rose-950/80 hover:bg-rose-900 border border-rose-800/80 text-rose-300 text-xs font-bold rounded-2xl transition">
            Sign Out
          </button>
        </div>
      </header>

      {/* DASHBOARD TAB */}
      {activeTab === "dashboard" && (
        <main className="space-y-6">
          <div className={`${cardClass} border p-4 rounded-3xl flex flex-wrap justify-between items-center gap-4`}>
            <div className={`flex items-center p-1.5 rounded-2xl border ${isDark ? "bg-slate-950 border-slate-800" : "bg-slate-200 border-slate-300"}`}>
              <button onClick={() => setTimeframe("monthly")} className={`px-4 py-2 rounded-xl text-xs font-black transition ${timeframe === "monthly" ? "bg-emerald-500 text-slate-950" : "text-slate-400"}`}>
                Monthly
              </button>
              <button onClick={() => setTimeframe("yearly")} className={`px-4 py-2 rounded-xl text-xs font-black transition ${timeframe === "yearly" ? "bg-emerald-500 text-slate-950" : "text-slate-400"}`}>
                Yearly
              </button>
              <button onClick={() => setTimeframe("all")} className={`px-4 py-2 rounded-xl text-xs font-black transition ${timeframe === "all" ? "bg-emerald-500 text-slate-950" : "text-slate-400"}`}>
                All Time
              </button>
            </div>

            {timeframe !== "all" && (
              <div className="flex items-center gap-2">
                {timeframe === "monthly" && (
                  <select value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} className={`border text-xs p-3 rounded-2xl focus:outline-none font-bold ${inputClass}`}>
                    <option value="01">January</option>
                    <option value="02">February</option>
                    <option value="03">March</option>
                    <option value="04">April</option>
                    <option value="05">May</option>
                    <option value="06">June</option>
                    <option value="07">July</option>
                    <option value="08">August</option>
                    <option value="09">September</option>
                    <option value="10">October</option>
                    <option value="11">November</option>
                    <option value="12">December</option>
                  </select>
                )}
                <select value={selectedYear} onChange={(e) => setSelectedYear(e.target.value)} className={`border text-xs p-3 rounded-2xl focus:outline-none font-bold ${inputClass}`}>
                  <option value="2025">2025</option>
                  <option value="2026">2026</option>
                </select>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className={`${cardClass} border p-6 rounded-3xl relative overflow-hidden`}>
              <span className="text-xs uppercase font-black tracking-widest text-slate-400">Total Income</span>
              <p className="text-3xl font-black text-emerald-400 mt-2">{totalIncome.toLocaleString()} <span className="text-xs font-bold text-slate-400">ETB</span></p>
            </div>

            <div className={`${cardClass} border p-6 rounded-3xl relative overflow-hidden`}>
              <span className="text-xs uppercase font-black tracking-widest text-slate-400">Total Expense</span>
              <p className="text-3xl font-black text-rose-400 mt-2">{totalExpense.toLocaleString()} <span className="text-xs font-bold text-slate-400">ETB</span></p>
            </div>

            <div className={`${cardClass} border p-6 rounded-3xl relative overflow-hidden`}>
              <span className="text-xs uppercase font-black tracking-widest text-slate-400">Net Balance</span>
              <p className={`text-3xl font-black mt-2 ${totalIncome - totalExpense >= 0 ? "text-cyan-400" : "text-rose-400"}`}>
                {(totalIncome - totalExpense).toLocaleString()} <span className="text-xs font-bold text-slate-400">ETB</span>
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className={`${cardClass} border p-6 rounded-3xl flex flex-col justify-between`}>
              <h2 className={`text-sm font-black mb-4 flex items-center gap-2 ${isDark ? "text-slate-200" : "text-slate-800"}`}>
                <span>🍩</span> Expense Category Breakdown
              </h2>
              {categoryChartData.length === 0 ? (
                <div className="h-64 flex items-center justify-center text-xs text-slate-500">No expense data found.</div>
              ) : (
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={categoryChartData} cx="50%" cy="50%" innerRadius={60} outerRadius={85} paddingAngle={4} dataKey="value">
                        {categoryChartData.map((entry, idx) => (
                          <Cell key={`cell-${idx}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ backgroundColor: isDark ? "#0f172a" : "#ffffff", borderColor: "#334155", borderRadius: "16px" }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            <div className={`${cardClass} border p-6 rounded-3xl flex flex-col justify-between`}>
              <h2 className={`text-sm font-black mb-4 flex items-center gap-2 ${isDark ? "text-slate-200" : "text-slate-800"}`}>
                <span>📊</span> {selectedYear} Income vs Expenses
              </h2>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={barChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke={isDark ? "#1e293b" : "#e2e8f0"} />
                    <XAxis dataKey="month" stroke="#64748b" fontSize={11} />
                    <YAxis stroke="#64748b" fontSize={11} />
                    <Tooltip contentStyle={{ backgroundColor: isDark ? "#0f172a" : "#ffffff", borderColor: "#334155", borderRadius: "16px" }} />
                    <Bar dataKey="Income" fill="#10b981" radius={[6, 6, 0, 0]} />
                    <Bar dataKey="Expense" fill="#f43f5e" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* LEDGER RECORD CARDS */}
          <div className={`${cardClass} border rounded-3xl overflow-hidden`}>
            <div className={`p-5 border-b ${isDark ? "border-slate-800" : "border-slate-200"} flex justify-between items-center`}>
              <h2 className={`text-sm font-black ${isDark ? "text-slate-200" : "text-slate-800"}`}>Cloud Transaction Ledger ({filteredTransactions.length})</h2>
              {loading && <span className="text-xs text-emerald-400 font-bold animate-pulse">Syncing...</span>}
            </div>

            <div className={`divide-y ${isDark ? "divide-slate-800/60" : "divide-slate-200"} max-h-96 overflow-y-auto`}>
              {filteredTransactions.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-500">No cloud records found.</div>
              ) : (
                filteredTransactions.map((tx) => (
                  <div key={tx.id} className="p-4 hover:bg-slate-500/5 transition flex justify-between items-center gap-4 group">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] uppercase font-black px-2.5 py-0.5 rounded-lg ${
                          tx.type === "income" ? "bg-emerald-950/80 text-emerald-400 border border-emerald-800" : "bg-rose-950/80 text-rose-400 border border-rose-800"
                        }`}>
                          {tx.type}
                        </span>
                        <span className={`text-xs font-medium ${isDark ? "text-slate-400" : "text-slate-500"}`}>{tx.date}</span>
                        <span className={`text-xs px-2.5 py-0.5 rounded-lg font-bold ${isDark ? "bg-slate-800 text-slate-300" : "bg-slate-200 text-slate-700"}`}>{tx.category}</span>
                      </div>
                      <p className={`text-sm font-extrabold ${isDark ? "text-slate-200" : "text-slate-800"}`}>{tx.description}</p>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className={`font-black ${tx.type === "income" ? "text-emerald-400" : isDark ? "text-slate-200" : "text-slate-800"}`}>
                          {tx.type === "expense" ? "-" : "+"}{Number(tx.amount_etb).toLocaleString()} ETB
                        </p>
                        {tx.original_currency === "USD" && (
                          <p className="text-[10px] text-slate-500 font-bold">(${tx.original_amount} @ 180 ETB)</p>
                        )}
                      </div>

                      <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition">
                        <button onClick={() => setEditingTx(tx)} className="p-2 hover:bg-slate-700/40 text-slate-400 hover:text-emerald-400 rounded-xl text-xs" title="Edit">
                          ✏️
                        </button>
                        <button onClick={() => handleDeleteTransaction(tx.id)} className="p-2 hover:bg-slate-700/40 text-slate-400 hover:text-rose-400 rounded-xl text-xs" title="Delete">
                          🗑️
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </main>
      )}

      {/* EDIT MODAL */}
      {editingTx && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className={`${cardClass} border p-6 rounded-3xl max-w-lg w-full space-y-4 shadow-2xl`}>
            <div className="flex justify-between items-center border-b pb-3 border-slate-800">
              <h3 className="text-base font-black">Edit Transaction</h3>
              <button onClick={() => setEditingTx(null)} className="text-xs text-slate-400 hover:text-slate-200">✕ Close</button>
            </div>
            <form onSubmit={handleUpdateTransaction} className="space-y-4">
              <div>
                <label className="block text-xs font-bold mb-1 text-slate-400">Date</label>
                <input type="text" value={editingTx.date} onChange={(e) => setEditingTx({ ...editingTx, date: e.target.value })} className={`w-full border rounded-2xl p-3 text-sm ${inputClass}`} required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold mb-1 text-slate-400">Type</label>
                  <select value={editingTx.type} onChange={(e) => setEditingTx({ ...editingTx, type: e.target.value as any })} className={`w-full border rounded-2xl p-3 text-sm ${inputClass}`}>
                    <option value="expense">Expense</option>
                    <option value="income">Income</option>
                    <option value="loan">Loan Payment</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold mb-1 text-slate-400">Currency</label>
                  <select value={editingTx.original_currency} onChange={(e) => setEditingTx({ ...editingTx, original_currency: e.target.value as any })} className={`w-full border rounded-2xl p-3 text-sm ${inputClass}`}>
                    <option value="ETB">ETB</option>
                    <option value="USD">USD ($)</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold mb-1 text-slate-400">Amount</label>
                <input type="number" step="any" value={editingTx.original_amount} onChange={(e) => setEditingTx({ ...editingTx, original_amount: parseFloat(e.target.value) || 0 })} className={`w-full border rounded-2xl p-3 text-sm ${inputClass}`} required />
              </div>
              <div>
                <label className="block text-xs font-bold mb-1 text-slate-400">Category</label>
                <select value={editingTx.category} onChange={(e) => setEditingTx({ ...editingTx, category: e.target.value })} className={`w-full border rounded-2xl p-3 text-sm ${inputClass}`}>
                  <option value="Food">Food & Grocery</option>
                  <option value="Transport / Fuel">Transport / Fuel</option>
                  <option value="Car Expenses">Car Maintenance</option>
                  <option value="Loans & Ekub">Loans & Ekub</option>
                  <option value="Personal & Date">Personal & Dates</option>
                  <option value="Income Stream">Income Stream</option>
                  <option value="General">General</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold mb-1 text-slate-400">Description</label>
                <input type="text" value={editingTx.description} onChange={(e) => setEditingTx({ ...editingTx, description: e.target.value })} className={`w-full border rounded-2xl p-3 text-sm ${inputClass}`} />
              </div>
              <div className="flex gap-2 pt-2">
                <button type="submit" className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black py-3 rounded-2xl transition">
                  Save Changes
                </button>
                <button type="button" onClick={() => setEditingTx(null)} className="px-5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-black py-3 rounded-2xl transition">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADD ENTRY TAB */}
      {activeTab === "add" && (
        <main className={`${cardClass} border p-6 rounded-3xl max-w-lg mx-auto space-y-4 shadow-2xl`}>
          <h2 className={`text-lg font-black ${isDark ? "text-slate-200" : "text-slate-800"}`}>New Transaction Entry</h2>
          <form onSubmit={handleAddManual} className="space-y-4">
            <div>
              <label className="block text-xs font-bold mb-1 text-slate-400">Date</label>
              <input type="text" value={formDate} onChange={(e) => setFormDate(e.target.value)} className={`w-full border rounded-2xl p-3.5 text-sm focus:outline-none ${inputClass}`} required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold mb-1 text-slate-400">Type</label>
                <select value={formType} onChange={(e) => setFormType(e.target.value as any)} className={`w-full border rounded-2xl p-3.5 text-sm focus:outline-none ${inputClass}`}>
                  <option value="expense">Expense</option>
                  <option value="income">Income</option>
                  <option value="loan">Loan Payment</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold mb-1 text-slate-400">Currency</label>
                <select value={formCurrency} onChange={(e) => setFormCurrency(e.target.value as any)} className={`w-full border rounded-2xl p-3.5 text-sm focus:outline-none ${inputClass}`}>
                  <option value="ETB">ETB</option>
                  <option value="USD">USD ($)</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold mb-1 text-slate-400">Amount</label>
              <input type="number" step="any" value={formAmount} onChange={(e) => setFormAmount(e.target.value)} placeholder="0.00" className={`w-full border rounded-2xl p-3.5 text-sm focus:outline-none ${inputClass}`} required />
            </div>
            <div>
              <label className="block text-xs font-bold mb-1 text-slate-400">Category</label>
              <select value={formCategory} onChange={(e) => setFormCategory(e.target.value)} className={`w-full border rounded-2xl p-3.5 text-sm focus:outline-none ${inputClass}`}>
                <option value="Food">Food & Grocery</option>
                <option value="Transport / Fuel">Transport / Fuel</option>
                <option value="Car Expenses">Car Maintenance</option>
                <option value="Loans & Ekub">Loans & Ekub</option>
                <option value="Personal & Date">Personal & Dates</option>
                <option value="Income Stream">Income Stream</option>
                <option value="General">General</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold mb-1 text-slate-400">Description</label>
              <input type="text" value={formDescription} onChange={(e) => setFormDescription(e.target.value)} placeholder="Description" className={`w-full border rounded-2xl p-3.5 text-sm focus:outline-none ${inputClass}`} />
            </div>
            <button type="submit" className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black py-4 rounded-2xl transition shadow-xl shadow-emerald-500/20">
              Save Entry
            </button>
          </form>
        </main>
      )}

      {/* CSV IMPORT TAB */}
      {activeTab === "csv" && (
        <main className={`${cardClass} border p-6 rounded-3xl max-w-2xl mx-auto space-y-6 shadow-2xl`}>
          <div>
            <h2 className={`text-lg font-black ${isDark ? "text-slate-200" : "text-slate-800"}`}>Bulk CSV Import</h2>
            <p className="text-xs text-slate-400 mt-0.5">Upload a `.csv` file directly from your device or paste raw CSV text.</p>
          </div>

          <div className={`p-6 border border-dashed rounded-3xl flex flex-col items-center justify-center text-center gap-2 ${isDark ? "bg-slate-950/80 border-slate-800" : "bg-slate-100/80 border-slate-300"}`}>
            <p className="text-xs font-bold text-slate-400">Select `.csv` file from your device</p>
            <input type="file" accept=".csv" onChange={handleFileUpload} className="text-xs text-slate-400 file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-black file:bg-emerald-500 file:text-slate-950 hover:file:bg-emerald-400 cursor-pointer" />
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-bold text-slate-400">CSV Data Preview / Raw Text</label>
            <textarea value={csvContent} onChange={(e) => setCsvContent(e.target.value)} placeholder={`Date,Type,Amount,Currency,Category,Description\n2026-07-01,income,15000,ETB,Income Stream,Salary Payment`} className={`w-full h-48 border rounded-2xl p-4 text-xs font-mono focus:outline-none ${inputClass}`}></textarea>
          </div>

          <button onClick={handleCustomCsvImport} className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black py-4 rounded-2xl transition shadow-xl shadow-emerald-500/20">
            Process CSV Import
          </button>
        </main>
      )}

      {/* ADVANCED SETTINGS TAB */}
      {activeTab === "settings" && (
        <main className={`${cardClass} border p-6 rounded-3xl max-w-2xl mx-auto space-y-6 shadow-2xl`}>
          <div>
            <h2 className={`text-lg font-black ${isDark ? "text-slate-200" : "text-slate-800"}`}>⚙️ Advanced Settings & Controls</h2>
            <p className="text-xs text-slate-400 mt-0.5">Manage your account preferences, theme, and cloud data controls.</p>
          </div>

          <div className="space-y-4 divide-y divide-slate-800/60">
            {/* Account Info */}
            <div className="pt-2 flex justify-between items-center">
              <div>
                <p className="text-sm font-bold">User Account</p>
                <p className="text-xs text-slate-400">{user.email}</p>
              </div>
              <span className="text-xs bg-emerald-950 text-emerald-400 border border-emerald-800 px-3 py-1 rounded-full font-bold">Active Session</span>
            </div>

            {/* Fixed Exchange Rate */}
            <div className="pt-4 flex justify-between items-center">
              <div>
                <p className="text-sm font-bold">Conversion Rate</p>
                <p className="text-xs text-slate-400">Fixed rate applied to USD entries</p>
              </div>
              <span className="text-xs bg-slate-800 text-slate-300 px-3 py-1 rounded-full font-bold">$1 USD = 180 ETB</span>
            </div>

            {/* Clear All Cloud Data */}
            <div className="pt-4 space-y-2">
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-sm font-bold text-rose-400">Clear All Transaction Data</p>
                  <p className="text-xs text-slate-400">Permanently delete all transaction entries linked to your user account in the cloud.</p>
                </div>
              </div>
              <button onClick={handleClearAllData} className="w-full bg-rose-950/80 hover:bg-rose-900 border border-rose-800 text-rose-300 font-black py-3 rounded-2xl transition">
                🗑️ Clear All Cloud Data
              </button>
            </div>
          </div>
        </main>
      )}
    </div>
  );
}