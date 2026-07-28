"use "client";

import React, { useState, useEffect } from "react";

export interface Transaction {
  id: string;
  date: string;
  type: "income" | "expense" | "loan";
  amountETB: number;
  originalCurrency: "ETB" | "USD";
  originalAmount: number;
  category: string;
  description: string;
}

const USD_TO_ETB_RATE = 180;

export default function ReusableTracker() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [rawText, setRawText] = useState<string>("");
  const [activeTab, setActiveTab] = useState<"dashboard" | "add" | "import">("dashboard");

  // Form State for Web Input
  const [formDate, setFormDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [formType, setFormType] = useState<"income" | "expense" | "loan">("expense");
  const [formAmount, setFormAmount] = useState<string>("");
  const [formCurrency, setFormCurrency] = useState<"ETB" | "USD">("ETB");
  const [formCategory, setFormCategory] = useState<string>("General");
  const [formDescription, setFormDescription] = useState<string>("");

  // Load saved data
  useEffect(() => {
    const saved = localStorage.getItem("financial_tracker_data");
    if (saved) {
      try {
        setTransactions(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to load saved data", e);
      }
    }
  }, []);

  const saveTransactions = (data: Transaction[]) => {
    setTransactions(data);
    localStorage.setItem("financial_tracker_data", JSON.stringify(data));
  };

  const detectCategory = (text: string): string => {
    const t = text.toLowerCase();
    if (t.includes("food") || t.includes("lunch") || t.includes("dinner") || t.includes("ergo") || t.includes("donut") || t.includes("cake") || t.includes("ertb") || t.includes("dabo") || t.includes("sosi")) return "Food";
    if (t.includes("transport") || t.includes("taxi") || t.includes("raid") || t.includes("petrol") || t.includes("diesel")) return "Transport / Fuel";
    if (t.includes("loan") || t.includes("repay") || t.includes("ekub")) return "Loans & Ekub";
    if (t.includes("car") || t.includes("maintenance") || t.includes("decor") || t.includes("goma") || t.includes("hoz")) return "Car Expenses";
    if (t.includes("date") || t.includes("cinema") || t.includes("gift") || t.includes("ps") || t.includes("pool")) return "Personal & Date";
    if (t.includes("badboyz") || t.includes("exness") || t.includes("trading") || t.includes("phone") || t.includes("sale")) return "Income Stream";
    return "General";
  };

  // Text Log Parsing Logic
  const handleParseText = () => {
    if (!rawText.trim()) return;

    const lines = rawText.split("\n").map((l) => l.trim()).filter(Boolean);
    const parsedData: Transaction[] = [];

    let currentDate = new Date().toISOString().split("T")[0];
    let currentSection: "income" | "expense" | "loan" = "expense";

    lines.forEach((line, idx) => {
      const lower = line.toLowerCase();

      // Detect Date lines (e.g. Sep15 2025, Jan 14, April 8, etc.)
      if (/^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i.test(line)) {
        currentDate = line;
        return;
      }

      // Detect Section Switch
      if (lower.includes("income") || lower.includes("today income") || lower === "in" || lower.startsWith("in ")) {
        currentSection = "income";
        return;
      }
      if (lower.includes("expense") || lower.includes("expence") || lower.includes("outcome") || lower.includes("out") || lower.startsWith("out ")) {
        currentSection = "expense";
        return;
      }
      if (lower.includes("loan")) {
        currentSection = "loan";
      }

      // Regex matching USD ($21, $90) or ETB numbers
      const usdMatch = line.match(/\$(\d+(\.\d+)?)/);
      const numberMatch = line.match(/(\d+)/);

      if (usdMatch) {
        const usdAmount = parseFloat(usdMatch[1]);
        const convertedETB = usdAmount * USD_TO_ETB_RATE;

        parsedData.push({
          id: `txt-${idx}-${Math.random().toString(36).substring(2, 7)}`,
          date: currentDate,
          type: currentSection,
          amountETB: convertedETB,
          originalCurrency: "USD",
          originalAmount: usdAmount,
          category: detectCategory(line),
          description: line,
        });
      } else if (numberMatch && !lower.includes("total") && !lower.includes("left")) {
        const etbAmount = parseInt(numberMatch[1], 10);
        if (etbAmount > 0) {
          parsedData.push({
            id: `txt-${idx}-${Math.random().toString(36).substring(2, 7)}`,
            date: currentDate,
            type: currentSection,
            amountETB: etbAmount,
            originalCurrency: "ETB",
            originalAmount: etbAmount,
            category: detectCategory(line),
            description: line,
          });
        }
      }
    });

    const updated = [...parsedData, ...transactions];
    saveTransactions(updated);
    setRawText("");
    setActiveTab("dashboard");
  };

  const handleAddManual = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formAmount) return;

    const rawAmt = parseFloat(formAmount);
    const amountETB = formCurrency === "USD" ? rawAmt * USD_TO_ETB_RATE : rawAmt;

    const newTx: Transaction = {
      id: Date.now().toString(),
      date: formDate,
      type: formType,
      amountETB,
      originalCurrency: formCurrency,
      originalAmount: rawAmt,
      category: formCategory,
      description: formDescription || formCategory,
    };

    saveTransactions([newTx, ...transactions]);
    setFormAmount("");
    setFormDescription("");
    setActiveTab("dashboard");
  };

  // CSV Export for Spreadsheets
  const exportToCsv = () => {
    const headers = ["ID", "Date", "Type", "Amount (ETB)", "Original Amount", "Original Currency", "Category", "Description"];
    const rows = transactions.map((t) => [
      t.id,
      `"${t.date}"`,
      t.type,
      t.amountETB,
      t.originalAmount,
      t.originalCurrency,
      `"${t.category}"`,
      `"${t.description.replace(/"/g, '""')}"`,
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `financial_tracker_export.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Metrics
  const totalIncome = transactions.filter((t) => t.type === "income").reduce((a, b) => a + b.amountETB, 0);
  const totalExpense = transactions.filter((t) => t.type === "expense").reduce((a, b) => a + b.amountETB, 0);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans p-4 md:p-8 max-w-4xl mx-auto">
      {/* Header Navigation */}
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-slate-800 pb-4 mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-emerald-400">Financial Tracker</h1>
          <p className="text-xs text-slate-400">Rate: $1 USD = 180 ETB</p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <button
            onClick={() => setActiveTab("dashboard")}
            className={`flex-1 sm:flex-none px-4 py-2 rounded-lg font-medium text-xs sm:text-sm transition ${
              activeTab === "dashboard" ? "bg-emerald-600 text-white" : "bg-slate-800 text-slate-300"
            }`}
          >
            Dashboard
          </button>
          <button
            onClick={() => setActiveTab("add")}
            className={`flex-1 sm:flex-none px-4 py-2 rounded-lg font-medium text-xs sm:text-sm transition ${
              activeTab === "add" ? "bg-emerald-600 text-white" : "bg-slate-800 text-slate-300"
            }`}
          >
            + Form Entry
          </button>
          <button
            onClick={() => setActiveTab("import")}
            className={`flex-1 sm:flex-none px-4 py-2 rounded-lg font-medium text-xs sm:text-sm transition ${
              activeTab === "import" ? "bg-emerald-600 text-white" : "bg-slate-800 text-slate-300"
            }`}
          >
            Paste Text Log
          </button>
        </div>
      </header>

      {/* Dashboard View */}
      {activeTab === "dashboard" && (
        <main className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
              <span className="text-xs text-slate-400 uppercase font-semibold">Total Income</span>
              <p className="text-2xl font-bold text-emerald-400 mt-1">{totalIncome.toLocaleString()} ETB</p>
            </div>
            <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
              <span className="text-xs text-slate-400 uppercase font-semibold">Total Expense</span>
              <p className="text-2xl font-bold text-rose-400 mt-1">{totalExpense.toLocaleString()} ETB</p>
            </div>
            <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
              <span className="text-xs text-slate-400 uppercase font-semibold">Net Balance</span>
              <p className={`text-2xl font-bold mt-1 ${totalIncome - totalExpense >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                {(totalIncome - totalExpense).toLocaleString()} ETB
              </p>
            </div>
          </div>

          <div className="flex justify-between items-center pt-2">
            <h2 className="text-md font-semibold text-slate-200">History ({transactions.length})</h2>
            {transactions.length > 0 && (
              <button onClick={exportToCsv} className="bg-slate-800 hover:bg-slate-700 text-xs px-3 py-2 rounded-lg border border-slate-700">
                📥 Export CSV
              </button>
            )}
          </div>

          <div className="space-y-2">
            {transactions.length === 0 ? (
              <div className="text-center py-12 text-slate-500 bg-slate-900/50 rounded-xl border border-slate-800">
                No transactions found. Use <strong>Paste Text Log</strong> or <strong>+ Form Entry</strong> to add transactions.
              </div>
            ) : (
              transactions.map((tx) => (
                <div key={tx.id} className="bg-slate-900 border border-slate-800 p-3 rounded-lg flex justify-between items-center gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-2 py-0.5 rounded font-medium ${tx.type === "income" ? "bg-emerald-950 text-emerald-400 border border-emerald-800" : "bg-rose-950 text-rose-400 border border-rose-800"}`}>
                        {tx.type}
                      </span>
                      <span className="text-xs text-slate-400">{tx.date}</span>
                      <span className="text-xs bg-slate-800 text-slate-300 px-2 py-0.5 rounded">{tx.category}</span>
                    </div>
                    <p className="text-sm text-slate-200 mt-1">{tx.description}</p>
                  </div>
                  <div className="text-right whitespace-nowrap">
                    <p className={`font-semibold text-base ${tx.type === "income" ? "text-emerald-400" : "text-slate-200"}`}>
                      {tx.type === "expense" ? "-" : "+"}
                      {tx.amountETB.toLocaleString()} ETB
                    </p>
                    {tx.originalCurrency === "USD" && (
                      <p className="text-xs text-slate-500">(${tx.originalAmount} @ 180 ETB)</p>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </main>
      )}

      {/* Paste Text View */}
      {activeTab === "import" && (
        <main className="bg-slate-900 border border-slate-800 p-6 rounded-xl space-y-4">
          <h2 className="text-lg font-semibold text-slate-200">Paste Text Entry</h2>
          <p className="text-xs text-slate-400">Paste your daily message text directly here. Dollars will be converted automatically ($1 = 180 ETB).</p>
          <textarea
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            placeholder={`Sep15 2025\nTODAY INCOME\n$21 from Badboyz\n\nExpense\n400 for earpod`}
            className="w-full h-48 bg-slate-950 border border-slate-800 rounded-lg p-3 text-sm font-mono text-slate-300 focus:outline-none focus:border-slate-700"
          ></textarea>
          <button onClick={handleParseText} className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium px-6 py-2.5 rounded-lg text-sm transition">
            Process & Save Log
          </button>
        </main>
      )}

      {/* Manual Form Entry */}
      {activeTab === "add" && (
        <main className="bg-slate-900 border border-slate-800 p-6 rounded-xl max-w-md mx-auto">
          <h2 className="text-lg font-semibold text-slate-200 mb-4">Manual Quick Entry</h2>
          <form onSubmit={handleAddManual} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Date</label>
              <input type="text" value={formDate} onChange={(e) => setFormDate(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm" required />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Type</label>
                <select value={formType} onChange={(e) => setFormType(e.target.value as any)} className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm">
                  <option value="expense">Expense</option>
                  <option value="income">Income</option>
                  <option value="loan">Loan Payment</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Currency</label>
                <select value={formCurrency} onChange={(e) => setFormCurrency(e.target.value as any)} className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm">
                  <option value="ETB">ETB</option>
                  <option value="USD">USD ($)</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Amount</label>
              <input type="number" step="any" value={formAmount} onChange={(e) => setFormAmount(e.target.value)} placeholder="0.00" className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm" required />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Category</label>
              <select value={formCategory} onChange={(e) => setFormCategory(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm">
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
              <label className="block text-xs font-medium text-slate-400 mb-1">Description</label>
              <input type="text" value={formDescription} onChange={(e) => setFormDescription(e.target.value)} placeholder="e.g. Lunch with Sami" className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm" />
            </div>
            <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-medium py-2.5 rounded-lg text-sm transition mt-2">
              Save Entry
            </button>
          </form>
        </main>
      )}
    </div>
  );
}