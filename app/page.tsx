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
  // Theme State (Dark / Light)
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  // Supabase Auth State
  const [user, setUser] = useState<User | null>(null);
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [authName, setAuthName] = useState("");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authMessage, setAuthMessage] = useState("");

  // Data State
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<"dashboard" | "add" | "csv">("dashboard");

  // Filters
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

  // Load Saved Theme Preference
  useEffect(() => {
    const savedTheme = localStorage.getItem("ft_theme");
    if (savedTheme === "light" || savedTheme === "dark") {
      setTheme(savedTheme);
    }
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    localStorage.setItem("ft_theme", nextTheme);
  };

  // Check Supabase Auth State
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Fetch Transactions from Supabase
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

  // Auth Submit Handler (Supports both Login & Signup)
  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthMessage("");

    if (authMode === "signup") {
      setAuthMessage("Signing up...");
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
        setAuthMessage("Success! Check your email for confirmation or log in.");
        setAuthPassword("");
      }
    } else {
      setAuthMessage("Logging in...");
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

  // Device CSV File Upload Handler
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      if (text) {
        setCsvContent(text);
      }
    };
    reader.readAsText(file);
  };

  // Calculations & Aggregations
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

  const downloadCsvTemplate = () => {
    const template = `Date,Type,Amount,Currency,Category,Description\n2026-07-01,income,15000,ETB,Income Stream,Salary Payment\n2026-07-02,expense,450,ETB,Food,Dinner with friends\n2026-07-03,expense,25,USD,General,Software subscription`;
    const blob = new Blob([template], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "tracker_import_template.csv";
    a.click();
  };

  // Dynamic Theme Styling Classes
  const isDark = theme === "dark";
  const bgClass = isDark ? "bg-slate-950 text-slate-100" : "bg-slate-100 text-slate-900";
  const cardClass = isDark ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200 shadow-sm";
  const inputClass = isDark ? "bg-slate-950 border-slate-800 text-slate-100" : "bg-slate-50 border-slate-300 text-slate-900";

  // Login / Signup Screen (Logged Out)
  if (!user) {
    return (
      <div className={`min-h-screen ${bgClass} flex items-center justify-center p-4`}>
        <div className={`${cardClass} border p-8 rounded-2xl max-w-md w-full space-y-6 shadow-2xl`}>
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">
              Financial Hub
            </h1>
            <button
              onClick={toggleTheme}
              className={`p-2 rounded-xl border text-xs font-semibold ${isDark ? "bg-slate-800 border-slate-700 text-slate-300" : "bg-slate-200 border-slate-300 text-slate-700"}`}
            >
              {isDark ? "☀️ Light Mode" : "🌙 Dark Mode"}
            </button>
          </div>

          {/* Login / Sign Up Toggle Switch */}
          <div className={`p-1 rounded-xl border flex gap-1 ${isDark ? "bg-slate-950 border-slate-800" : "bg-slate-200 border-slate-300"}`}>
            <button
              onClick={() => { setAuthMode("login"); setAuthMessage(""); }}
              className={`flex-1 py-2 rounded-lg text-xs font-bold transition ${authMode === "login" ? "bg-emerald-500 text-slate-950" : isDark ? "text-slate-400" : "text-slate-600"}`}
            >
              Log In
            </button>
            <button
              onClick={() => { setAuthMode("signup"); setAuthMessage(""); }}
              className={`flex-1 py-2 rounded-lg text-xs font-bold transition ${authMode === "signup" ? "bg-emerald-500 text-slate-950" : isDark ? "text-slate-400" : "text-slate-600"}`}
            >
              Sign Up
            </button>
          </div>

          <form onSubmit={handleAuthSubmit} className="space-y-4">
            {authMode === "signup" && (
              <div>
                <label className={`block text-xs font-semibold mb-1 ${isDark ? "text-slate-400" : "text-slate-600"}`}>Full Name</label>
                <input
                  type="text"
                  placeholder="Full Name"
                  value={authName}
                  onChange={(e) => setAuthName(e.target.value)}
                  className={`w-full border rounded-xl p-3 text-sm focus:outline-none ${inputClass}`}
                  required
                />
              </div>
            )}
            <div>
              <label className={`block text-xs font-semibold mb-1 ${isDark ? "text-slate-400" : "text-slate-600"}`}>Email Address</label>
              <input
                type="email"
                placeholder="name@domain.com"
                value={authEmail}
                onChange={(e) => setAuthEmail(e.target.value)}
                className={`w-full border rounded-xl p-3 text-sm focus:outline-none ${inputClass}`}
                required
              />
            </div>
            <div>
              <label className={`block text-xs font-semibold mb-1 ${isDark ? "text-slate-400" : "text-slate-600"}`}>Password</label>
              <input
                type="password"
                placeholder="••••••••"
                value={authPassword}
                onChange={(e) => setAuthPassword(e.target.value)}
                className={`w-full border rounded-xl p-3 text-sm focus:outline-none ${inputClass}`}
                required
                minLength={6}
              />
            </div>

            {authMessage && (
              <p className={`text-xs font-semibold p-2.5 rounded-lg text-center border ${authMessage.includes("Error") ? "bg-rose-950/40 border-rose-800 text-rose-400" : "bg-emerald-950/40 border-emerald-800 text-emerald-400"}`}>
                {authMessage}
              </p>
            )}

            <button
              type="submit"
              className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold py-3 rounded-xl transition shadow-lg shadow-emerald-500/20"
            >
              {authMode === "login" ? "Log In" : "Create Account"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Main Dashboard Interface (Logged In)
  return (
    <div className={`min-h-screen ${bgClass} font-sans p-4 md:p-8 max-w-6xl mx-auto space-y-6 transition-colors duration-200`}>
      <header className={`flex flex-col md:flex-row justify-between items-start md:items-center ${cardClass} border p-5 rounded-2xl gap-4`}>
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">
              Financial Hub
            </h1>
            <span className={`text-xs border px-2.5 py-1 rounded-full font-semibold ${isDark ? "bg-slate-800 border-slate-700 text-slate-300" : "bg-slate-100 border-slate-300 text-slate-700"}`}>
              $1 = 180 ETB
            </span>
          </div>
          <p className={`text-xs mt-0.5 ${isDark ? "text-slate-400" : "text-slate-500"}`}>
            Logged in as <strong className={isDark ? "text-slate-200" : "text-slate-800"}>{user.user_metadata?.display_name || user.email}</strong>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          <button
            onClick={() => setActiveTab("dashboard")}
            className={`px-4 py-2 rounded-xl font-medium text-xs transition ${
              activeTab === "dashboard" ? "bg-emerald-500 text-slate-950 font-bold" : isDark ? "bg-slate-800 text-slate-300" : "bg-slate-200 text-slate-700"
            }`}
          >
            Dashboard
          </button>
          <button
            onClick={() => setActiveTab("add")}
            className={`px-4 py-2 rounded-xl font-medium text-xs transition ${
              activeTab === "add" ? "bg-emerald-500 text-slate-950 font-bold" : isDark ? "bg-slate-800 text-slate-300" : "bg-slate-200 text-slate-700"
            }`}
          >
            + Entry
          </button>
          <button
            onClick={() => setActiveTab("csv")}
            className={`px-4 py-2 rounded-xl font-medium text-xs transition ${
              activeTab === "csv" ? "bg-emerald-500 text-slate-950 font-bold" : isDark ? "bg-slate-800 text-slate-300" : "bg-slate-200 text-slate-700"
            }`}
          >
            Bulk CSV
          </button>
          <button
            onClick={toggleTheme}
            className={`px-3 py-2 border text-xs rounded-xl transition ${isDark ? "bg-slate-800 border-slate-700 text-slate-300" : "bg-slate-200 border-slate-300 text-slate-700"}`}
          >
            {isDark ? "☀️ Light" : "🌙 Dark"}
          </button>
          <button
            onClick={handleSignOut}
            className="px-3 py-2 bg-rose-950 hover:bg-rose-900 border border-rose-800 text-rose-300 text-xs rounded-xl transition"
          >
            Sign Out
          </button>
        </div>
      </header>

      {activeTab === "dashboard" && (
        <main className="space-y-6">
          <div className={`${cardClass} border p-4 rounded-2xl flex flex-wrap justify-between items-center gap-4`}>
            <div className={`flex items-center p-1 rounded-xl border ${isDark ? "bg-slate-950 border-slate-800" : "bg-slate-100 border-slate-300"}`}>
              <button
                onClick={() => setTimeframe("monthly")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  timeframe === "monthly" ? "bg-emerald-500 text-slate-950" : "text-slate-400"
                }`}
              >
                Monthly
              </button>
              <button
                onClick={() => setTimeframe("yearly")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  timeframe === "yearly" ? "bg-emerald-500 text-slate-950" : "text-slate-400"
                }`}
              >
                Yearly
              </button>
              <button
                onClick={() => setTimeframe("all")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  timeframe === "all" ? "bg-emerald-500 text-slate-950" : "text-slate-400"
                }`}
              >
                All Time
              </button>
            </div>

            {timeframe !== "all" && (
              <div className="flex items-center gap-2">
                {timeframe === "monthly" && (
                  <select
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    className={`border text-xs p-2 rounded-xl focus:outline-none ${inputClass}`}
                  >
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
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(e.target.value)}
                  className={`border text-xs p-2 rounded-xl focus:outline-none ${inputClass}`}
                >
                  <option value="2025">2025</option>
                  <option value="2026">2026</option>
                </select>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className={`${cardClass} border p-5 rounded-2xl`}>
              <span className={`text-xs uppercase font-semibold ${isDark ? "text-slate-400" : "text-slate-500"}`}>Total Income</span>
              <p className="text-3xl font-extrabold text-emerald-400 mt-2">{totalIncome.toLocaleString()} <span className="text-sm font-normal">ETB</span></p>
            </div>

            <div className={`${cardClass} border p-5 rounded-2xl`}>
              <span className={`text-xs uppercase font-semibold ${isDark ? "text-slate-400" : "text-slate-500"}`}>Total Expense</span>
              <p className="text-3xl font-extrabold text-rose-400 mt-2">{totalExpense.toLocaleString()} <span className="text-sm font-normal">ETB</span></p>
            </div>

            <div className={`${cardClass} border p-5 rounded-2xl`}>
              <span className={`text-xs uppercase font-semibold ${isDark ? "text-slate-400" : "text-slate-500"}`}>Net Balance</span>
              <p className={`text-3xl font-extrabold mt-2 ${totalIncome - totalExpense >= 0 ? "text-cyan-400" : "text-rose-400"}`}>
                {(totalIncome - totalExpense).toLocaleString()} <span className="text-sm font-normal">ETB</span>
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className={`${cardClass} border p-5 rounded-2xl flex flex-col justify-between`}>
              <h2 className={`text-sm font-bold mb-4 flex items-center gap-2 ${isDark ? "text-slate-200" : "text-slate-800"}`}>
                <span>🍩</span> Expense Breakdown
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
                      <Tooltip contentStyle={{ backgroundColor: isDark ? "#0f172a" : "#ffffff", borderColor: "#334155", borderRadius: "12px" }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            <div className={`${cardClass} border p-5 rounded-2xl flex flex-col justify-between`}>
              <h2 className={`text-sm font-bold mb-4 flex items-center gap-2 ${isDark ? "text-slate-200" : "text-slate-800"}`}>
                <span>📊</span> {selectedYear} Income vs Expenses
              </h2>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={barChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke={isDark ? "#1e293b" : "#e2e8f0"} />
                    <XAxis dataKey="month" stroke="#64748b" fontSize={11} />
                    <YAxis stroke="#64748b" fontSize={11} />
                    <Tooltip contentStyle={{ backgroundColor: isDark ? "#0f172a" : "#ffffff", borderColor: "#334155", borderRadius: "12px" }} />
                    <Bar dataKey="Income" fill="#10b981" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Expense" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className={`${cardClass} border rounded-2xl overflow-hidden`}>
            <div className={`p-4 border-b ${isDark ? "border-slate-800" : "border-slate-200"} flex justify-between items-center`}>
              <h2 className={`text-sm font-bold ${isDark ? "text-slate-200" : "text-slate-800"}`}>Cloud Ledger ({filteredTransactions.length})</h2>
              {loading && <span className="text-xs text-emerald-400">Syncing...</span>}
            </div>

            <div className={`divide-y ${isDark ? "divide-slate-800/60" : "divide-slate-200"} max-h-96 overflow-y-auto`}>
              {filteredTransactions.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-500">No cloud records found.</div>
              ) : (
                filteredTransactions.map((tx) => (
                  <div key={tx.id} className="p-4 hover:bg-slate-500/5 transition flex justify-between items-center gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] uppercase font-extrabold px-2 py-0.5 rounded-md ${
                          tx.type === "income" ? "bg-emerald-950 text-emerald-400 border border-emerald-800" : "bg-rose-950 text-rose-400 border border-rose-800"
                        }`}>
                          {tx.type}
                        </span>
                        <span className={`text-xs ${isDark ? "text-slate-400" : "text-slate-500"}`}>{tx.date}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-md ${isDark ? "bg-slate-800 text-slate-300" : "bg-slate-200 text-slate-700"}`}>{tx.category}</span>
                      </div>
                      <p className={`text-sm font-medium ${isDark ? "text-slate-200" : "text-slate-800"}`}>{tx.description}</p>
                    </div>
                    <div className="text-right">
                      <p className={`font-bold ${tx.type === "income" ? "text-emerald-400" : isDark ? "text-slate-200" : "text-slate-800"}`}>
                        {tx.type === "expense" ? "-" : "+"}{Number(tx.amount_etb).toLocaleString()} ETB
                      </p>
                      {tx.original_currency === "USD" && (
                        <p className="text-[10px] text-slate-500">(${tx.original_amount} @ 180 ETB)</p>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </main>
      )}

      {activeTab === "add" && (
        <main className={`${cardClass} border p-6 rounded-2xl max-w-lg mx-auto space-y-4`}>
          <h2 className={`text-lg font-bold ${isDark ? "text-slate-200" : "text-slate-800"}`}>New Transaction Entry</h2>
          <form onSubmit={handleAddManual} className="space-y-4">
            <div>
              <label className={`block text-xs font-semibold mb-1 ${isDark ? "text-slate-400" : "text-slate-600"}`}>Date</label>
              <input type="text" value={formDate} onChange={(e) => setFormDate(e.target.value)} className={`w-full border rounded-xl p-3 text-sm focus:outline-none ${inputClass}`} required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={`block text-xs font-semibold mb-1 ${isDark ? "text-slate-400" : "text-slate-600"}`}>Type</label>
                <select value={formType} onChange={(e) => setFormType(e.target.value as any)} className={`w-full border rounded-xl p-3 text-sm focus:outline-none ${inputClass}`}>
                  <option value="expense">Expense</option>
                  <option value="income">Income</option>
                  <option value="loan">Loan Payment</option>
                </select>
              </div>
              <div>
                <label className={`block text-xs font-semibold mb-1 ${isDark ? "text-slate-400" : "text-slate-600"}`}>Currency</label>
                <select value={formCurrency} onChange={(e) => setFormCurrency(e.target.value as any)} className={`w-full border rounded-xl p-3 text-sm focus:outline-none ${inputClass}`}>
                  <option value="ETB">ETB</option>
                  <option value="USD">USD ($)</option>
                </select>
              </div>
            </div>
            <div>
              <label className={`block text-xs font-semibold mb-1 ${isDark ? "text-slate-400" : "text-slate-600"}`}>Amount</label>
              <input type="number" step="any" value={formAmount} onChange={(e) => setFormAmount(e.target.value)} placeholder="0.00" className={`w-full border rounded-xl p-3 text-sm focus:outline-none ${inputClass}`} required />
            </div>
            <div>
              <label className={`block text-xs font-semibold mb-1 ${isDark ? "text-slate-400" : "text-slate-600"}`}>Category</label>
              <select value={formCategory} onChange={(e) => setFormCategory(e.target.value)} className={`w-full border rounded-xl p-3 text-sm focus:outline-none ${inputClass}`}>
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
              <label className={`block text-xs font-semibold mb-1 ${isDark ? "text-slate-400" : "text-slate-600"}`}>Description</label>
              <input type="text" value={formDescription} onChange={(e) => setFormDescription(e.target.value)} placeholder="Description" className={`w-full border rounded-xl p-3 text-sm focus:outline-none ${inputClass}`} />
            </div>
            <button type="submit" className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold py-3 rounded-xl transition shadow-lg shadow-emerald-500/20">
              Save Entry
            </button>
          </form>
        </main>
      )}

      {/* CSV Bulk Import View */}
      {activeTab === "csv" && (
        <main className={`${cardClass} border p-6 rounded-2xl max-w-2xl mx-auto space-y-6`}>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h2 className={`text-lg font-bold ${isDark ? "text-slate-200" : "text-slate-800"}`}>Bulk CSV Import</h2>
              <p className="text-xs text-slate-400 mt-0.5">Upload a `.csv` file directly from your phone/PC or paste raw text below.</p>
            </div>
            <button onClick={downloadCsvTemplate} className={`text-xs border px-3 py-2 rounded-xl font-semibold ${isDark ? "bg-slate-800 border-slate-700 text-emerald-400" : "bg-slate-100 border-slate-300 text-emerald-600"}`}>
              📥 Download Sample CSV
            </button>
          </div>

          {/* DEVICE FILE UPLOAD OPTION */}
          <div className={`p-4 border border-dashed rounded-xl flex flex-col items-center justify-center text-center gap-2 ${isDark ? "bg-slate-950 border-slate-800" : "bg-slate-50 border-slate-300"}`}>
            <p className="text-xs font-medium text-slate-400">Select `.csv` file from your device</p>
            <input
              type="file"
              accept=".csv"
              onChange={handleFileUpload}
              className="text-xs text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-emerald-500 file:text-slate-950 hover:file:bg-emerald-400 cursor-pointer"
            />
          </div>

          <div className="space-y-1">
            <label className={`block text-xs font-semibold ${isDark ? "text-slate-400" : "text-slate-600"}`}>CSV Data Preview / Raw Text</label>
            <textarea
              value={csvContent}
              onChange={(e) => setCsvContent(e.target.value)}
              placeholder={`Date,Type,Amount,Currency,Category,Description\n2026-07-01,income,15000,ETB,Income Stream,Salary Payment`}
              className={`w-full h-48 border rounded-xl p-4 text-xs font-mono focus:outline-none ${inputClass}`}
            ></textarea>
          </div>

          <button onClick={handleCustomCsvImport} className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold py-3 rounded-xl transition shadow-lg shadow-emerald-500/20">
            Process CSV Import
          </button>
        </main>
      )}
    </div>
  );
}