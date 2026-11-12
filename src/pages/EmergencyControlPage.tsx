import React, { useState, useEffect } from "react";
import { ShieldAlert, Lock, CheckCircle2, AlertTriangle, Power, Eye, EyeOff, RefreshCw, ExternalLink, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

export default function EmergencyControlPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Status settings
  const [currentMode, setCurrentMode] = useState<"live" | "maintenance" | "offline">("live");
  const [selectedMode, setSelectedMode] = useState<"live" | "maintenance" | "offline">("live");
  const [maintenanceMessage, setMaintenanceMessage] = useState(
    "আমাদের ওয়েবসাইটে নিয়মিত আপগ্রেড ও রক্ষণাবেক্ষণের কাজ চলছে। সাময়িক অসুবিধার জন্য আন্তরিকভাবে দুঃখিত, খুব দ্রুত সাইট স্বাভাবিক হবে।"
  );
  const [offlineMessage, setOfflineMessage] = useState(
    "503 Service Temporarily Unavailable. Server connection failed."
  );

  // Check existing session
  useEffect(() => {
    const authSession = sessionStorage.getItem("bq_control_auth");
    if (authSession === "true") {
      setIsAuthenticated(true);
      fetchStatus();
    }
  }, []);

  const fetchStatus = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/system-control/status");
      if (res.ok) {
        const data = await res.json();
        const mode = data.mode || "live";
        setCurrentMode(mode);
        setSelectedMode(mode);
        if (data.maintenance_message) setMaintenanceMessage(data.maintenance_message);
        if (data.offline_message) setOfflineMessage(data.offline_message);
      }
    } catch (_) {
      // Fallback
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError("");

    if (!passwordInput.trim()) {
      setLoginError("পাসওয়ার্ড প্রদান করুন");
      return;
    }

    try {
      const res = await fetch("/api/system-control/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: passwordInput.trim() }),
      });

      if (res.ok) {
        sessionStorage.setItem("bq_control_auth", "true");
        sessionStorage.setItem("bq_control_pass", passwordInput.trim());
        setIsAuthenticated(true);
        fetchStatus();
        toast.success("নিরাপদ এক্সেস অনুমোদিত হয়েছে");
      } else {
        // Fallback local check
        if (passwordInput.trim() === "BrandQore@2024") {
          sessionStorage.setItem("bq_control_auth", "true");
          sessionStorage.setItem("bq_control_pass", "BrandQore@2024");
          setIsAuthenticated(true);
          fetchStatus();
          toast.success("নিরাপদ এক্সেস অনুমোদিত হয়েছে");
        } else {
          setLoginError("ভুল পাসওয়ার্ড! সঠিক সিক্রেট পাসওয়ার্ড দিন।");
        }
      }
    } catch {
      if (passwordInput.trim() === "BrandQore@2024") {
        sessionStorage.setItem("bq_control_auth", "true");
        sessionStorage.setItem("bq_control_pass", "BrandQore@2024");
        setIsAuthenticated(true);
        fetchStatus();
        toast.success("নিরাপদ এক্সেস অনুমোদিত হয়েছে");
      } else {
        setLoginError("সার্ভার যাচাইকরণ ব্যর্থ হয়েছে বা ভুল পাসওয়ার্ড");
      }
    }
  };

  const handleSave = async () => {
    setSaving(true);
    const pass = sessionStorage.getItem("bq_control_pass") || passwordInput.trim() || "BrandQore@2024";

    try {
      const res = await fetch("/api/system-control/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          password: pass,
          mode: selectedMode,
          maintenance_message: maintenanceMessage,
          offline_message: offlineMessage,
        }),
      });

      if (res.ok) {
        setCurrentMode(selectedMode);
        toast.success("সিস্টেম স্ট্যাটাস সফলভাবে আপডেট করা হয়েছে!");
      } else {
        const err = await res.json();
        toast.error(err.error || "স্ট্যাটাস পরিবর্তন ব্যর্থ হয়েছে");
      }
    } catch {
      toast.error("সার্ভারে সংযোগ ব্যর্থ হয়েছে");
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem("bq_control_auth");
    sessionStorage.removeItem("bq_control_pass");
    setIsAuthenticated(false);
    setPasswordInput("");
  };

  // 1. Password Protection Gate
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-red-600 via-amber-500 to-emerald-600" />

          <div className="flex flex-col items-center text-center mb-6">
            <div className="w-14 h-14 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center mb-3 shadow-inner">
              <Lock className="w-7 h-7 text-amber-400" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-white">System Access Control</h1>
            <p className="text-xs text-slate-400 mt-1">
              প্রবেশ করতে সিক্রেট অথেন্টিকেশন পাসওয়ার্ড প্রদান করুন
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                সিকিউরিটি পাসওয়ার্ড:
              </label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  placeholder="পাসওয়ার্ড দিন..."
                  className="bg-slate-950 border-slate-700 text-white pr-10 focus:border-amber-400"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {loginError && <p className="text-xs text-red-400 mt-1.5 font-medium">{loginError}</p>}
            </div>

            <Button
              type="submit"
              className="w-full bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold py-2.5 rounded-xl transition-all shadow-md"
            >
              লগিন করুন
            </Button>
          </form>

          <p className="text-[11px] text-slate-500 text-center mt-6">
            BrandQore Master System Control Console
          </p>
        </div>
      </div>
    );
  }

  // 2. Control Panel
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-8">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Top Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center">
              <ShieldAlert className="w-6 h-6 text-amber-400" />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-black text-white flex items-center gap-2">
                BrandQore Master Control
                <span className="text-[10px] uppercase font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2 py-0.5 rounded-full">
                  Privileged
                </span>
              </h1>
              <p className="text-xs text-slate-400">
                ওয়েবসাইটের লাইভ ও ইমার্জেন্সি স্ট্যাটাস পরিচালনা কনসোল
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-center">
            <Button
              variant="outline"
              size="sm"
              onClick={fetchStatus}
              disabled={loading}
              className="border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} />
              রিফ্রেশ
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="text-slate-400 hover:text-red-400 hover:bg-red-950/30 text-xs"
            >
              <LogOut className="w-3.5 h-3.5 mr-1.5" />
              লগআউট
            </Button>
          </div>
        </div>

        {/* Current Status Indicator Banner */}
        <div
          className={`p-4 rounded-xl border flex items-center justify-between gap-3 ${
            currentMode === "live"
              ? "bg-emerald-950/40 border-emerald-500/40 text-emerald-300"
              : currentMode === "maintenance"
              ? "bg-amber-950/40 border-amber-500/40 text-amber-300"
              : "bg-red-950/40 border-red-500/40 text-red-300"
          }`}
        >
          <div className="flex items-center gap-3">
            {currentMode === "live" ? (
              <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0" />
            ) : currentMode === "maintenance" ? (
              <AlertTriangle className="w-6 h-6 text-amber-400 shrink-0" />
            ) : (
              <Power className="w-6 h-6 text-red-400 shrink-0" />
            )}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider opacity-80">
                বর্তমান লাইভ স্ট্যাটাস:
              </p>
              <h2 className="text-base font-black">
                {currentMode === "live" && "🟢 স্বাভাবিক মোড — সাইট ১০০% সচল"}
                {currentMode === "maintenance" && "🟡 মেইনটেনেন্স মোড — রক্ষণাবেক্ষণ বার্তা সক্রিয়"}
                {currentMode === "offline" && "🔴 এরর / অফলাইন মোড — পুরো সাইট ও এডমিন প্যানেল বন্ধ"}
              </h2>
            </div>
          </div>

          <a
            href="/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs bg-slate-900 border border-slate-700 px-3 py-1.5 rounded-lg hover:bg-slate-800 transition-colors text-slate-200"
          >
            <span>সাইট প্রিভিউ</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>

        {/* Mode Selector Cards */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
          <div>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-1">
              ১. সিস্টেম মোড নির্বাচন করুন:
            </h3>
            <p className="text-xs text-slate-400">
              আপনি যে মোডটি সক্রিয় করতে চান সেটি নির্বাচন করে নিচে সেভ করুন
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* 1. Live Mode */}
            <div
              onClick={() => setSelectedMode("live")}
              className={`cursor-pointer rounded-xl p-4 border-2 transition-all flex flex-col justify-between ${
                selectedMode === "live"
                  ? "border-emerald-500 bg-emerald-950/30 shadow-lg shadow-emerald-950/50"
                  : "border-slate-800 bg-slate-950/60 hover:border-slate-700"
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-[10px] font-black uppercase text-emerald-400 bg-emerald-950 border border-emerald-800 px-2 py-0.5 rounded">
                    স্বাভাবিক
                  </span>
                </div>
                <h4 className="font-extrabold text-white text-sm mb-1.5">সরাসরি লাইভ (Live)</h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  ওয়েবসাইট, চেকআউট, প্রোডাক্ট ও এডমিন প্যানেল সম্পূর্ণ স্বাভাবিকভাবে চলবে।
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs font-bold text-emerald-400">
                <span>{selectedMode === "live" ? "✓ নির্বাচিত" : "নির্বাচন করতে চাপুন"}</span>
              </div>
            </div>

            {/* 2. Maintenance Mode */}
            <div
              onClick={() => setSelectedMode("maintenance")}
              className={`cursor-pointer rounded-xl p-4 border-2 transition-all flex flex-col justify-between ${
                selectedMode === "maintenance"
                  ? "border-amber-500 bg-amber-950/30 shadow-lg shadow-amber-950/50"
                  : "border-slate-800 bg-slate-950/60 hover:border-slate-700"
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="w-3 h-3 rounded-full bg-amber-500" />
                  <span className="text-[10px] font-black uppercase text-amber-400 bg-amber-950 border border-amber-800 px-2 py-0.5 rounded">
                    রক্ষণাবেক্ষণ
                  </span>
                </div>
                <h4 className="font-extrabold text-white text-sm mb-1.5">মেইনটেনেন্স মোড</h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  ভিজিটরদের একটি আধুনিক রক্ষণাবেক্ষণ বার্তা দেখাবে। কোনো নতুন অর্ডার নেওয়া হবে না।
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs font-bold text-amber-400">
                <span>{selectedMode === "maintenance" ? "✓ নির্বাচিত" : "নির্বাচন করতে চাপুন"}</span>
              </div>
            </div>

            {/* 3. Emergency Offline / Error Mode */}
            <div
              onClick={() => setSelectedMode("offline")}
              className={`cursor-pointer rounded-xl p-4 border-2 transition-all flex flex-col justify-between ${
                selectedMode === "offline"
                  ? "border-red-500 bg-red-950/40 shadow-lg shadow-red-950/50"
                  : "border-slate-800 bg-slate-950/60 hover:border-slate-700"
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="w-3 h-3 rounded-full bg-red-500" />
                  <span className="text-[10px] font-black uppercase text-red-400 bg-red-950 border border-red-800 px-2 py-0.5 rounded">
                    সম্পূর্ণ বন্ধ
                  </span>
                </div>
                <h4 className="font-extrabold text-white text-sm mb-1.5">অফলাইন / এরর মোড</h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  সাইট ও এডমিন প্যানেল বন্ধ দেখাবে (503 Service Unavailable)। সাইট সচল করতে আবার এই পেজে পাসওয়ার্ড দিয়ে চালু করতে হবে।
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs font-bold text-red-400">
                <span>{selectedMode === "offline" ? "✓ নির্বাচিত" : "নির্বাচন করতে চাপুন"}</span>
              </div>
            </div>
          </div>

          {/* Optional Message Customization for Maintenance */}
          {selectedMode === "maintenance" && (
            <div className="p-4 bg-slate-950 border border-amber-500/30 rounded-xl space-y-2">
              <label className="text-xs font-semibold text-amber-300 block">
                গ্রাহকদের জন্য রক্ষণাবেক্ষণ বার্তা (ঐচ্ছিক):
              </label>
              <textarea
                value={maintenanceMessage}
                onChange={(e) => setMaintenanceMessage(e.target.value)}
                rows={3}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-xs text-white focus:border-amber-400"
              />
            </div>
          )}

          {/* Optional Message Customization for Offline */}
          {selectedMode === "offline" && (
            <div className="p-4 bg-slate-950 border border-red-500/30 rounded-xl space-y-2">
              <label className="text-xs font-semibold text-red-300 block">
                অফলাইন টেকনিক্যাল এরর বার্তা (ঐচ্ছিক):
              </label>
              <input
                type="text"
                value={offlineMessage}
                onChange={(e) => setOfflineMessage(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-xs text-white focus:border-red-400 font-mono"
              />
            </div>
          )}

          {/* Action Button */}
          <div className="pt-2 flex items-center justify-between gap-4 border-t border-slate-800">
            <div className="text-xs text-slate-400">
              নির্বাচিত মোড:{" "}
              <strong className="text-white">
                {selectedMode === "live"
                  ? "লাইভ চালু"
                  : selectedMode === "maintenance"
                  ? "মেইনটেনেন্স"
                  : "অফলাইন / এরর"}
              </strong>
            </div>

            <Button
              onClick={handleSave}
              disabled={saving}
              className={`px-6 py-2.5 rounded-xl font-bold transition-all shadow-md ${
                selectedMode === "live"
                  ? "bg-emerald-600 hover:bg-emerald-500 text-white"
                  : selectedMode === "maintenance"
                  ? "bg-amber-500 hover:bg-amber-600 text-slate-950"
                  : "bg-red-600 hover:bg-red-500 text-white"
              }`}
            >
              {saving ? "সংরক্ষণ হচ্ছে..." : "পরিবর্তন সেভ করুন"}
            </Button>
          </div>
        </div>

        {/* Security Notice */}
        <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-xl text-slate-400 text-xs flex items-center justify-between">
          <span>🔒 এই পেজের লিঙ্ক শুধুমাত্র আপনার ব্যক্তিগত ব্যবহারের জন্য।</span>
          <span className="font-mono text-[11px] text-slate-500">URL: /brandqore-control</span>
        </div>
      </div>
    </div>
  );
}

