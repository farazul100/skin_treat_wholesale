import React, { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { AlertTriangle, Wrench, ShieldAlert, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SystemStatus {
  mode: "live" | "maintenance" | "offline";
  maintenance_title?: string;
  maintenance_message?: string;
  offline_code?: string;
  offline_message?: string;
}

export default function SystemOperationalGuard({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const [status, setStatus] = useState<SystemStatus>({ mode: "live" });
  const [loaded, setLoaded] = useState(false);

  // Secret paths that ALWAYS bypass all locks so the owner can restore the site anytime
  const isMasterControl =
    location.pathname.startsWith("/brandqore-control") ||
    location.pathname.startsWith("/brandqore-vault");

  const checkStatus = async () => {
    try {
      const res = await fetch("/api/system-control/status");
      if (res.ok) {
        const data = await res.json();
        if (data && data.mode) {
          setStatus(data);
        }
      }
    } catch (_) {
      // Keep default on network failure
    } finally {
      setLoaded(true);
    }
  };

  useEffect(() => {
    checkStatus();
    // Poll every 30 seconds to catch remote emergency toggles
    const interval = setInterval(checkStatus, 30000);
    return () => clearInterval(interval);
  }, [location.pathname]);

  // If on the master control page, never block!
  if (isMasterControl) {
    return <>{children}</>;
  }

  // 1. EMERGENCY OFFLINE / 503 ERROR SCREEN
  if (status.mode === "offline") {
    return (
      <div className="min-h-screen bg-[#0f172a] text-slate-200 flex items-center justify-center p-4 font-sans select-none">
        <div className="w-full max-w-lg bg-slate-900/90 border border-slate-800 rounded-2xl p-8 sm:p-10 shadow-2xl text-center space-y-6">
          <div className="w-16 h-16 rounded-2xl bg-red-950/50 border border-red-500/30 flex items-center justify-center mx-auto text-red-400">
            <ShieldAlert className="w-8 h-8" />
          </div>

          <div className="space-y-2">
            <span className="text-4xl sm:text-5xl font-black text-red-500 tracking-wider font-mono">
              {status.offline_code || "503"}
            </span>
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              Service Temporarily Unavailable
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 leading-relaxed pt-2">
              {status.offline_message ||
                "The server is temporarily unable to service your request due to maintenance downtime or capacity problems. Please try again later."}
            </p>
          </div>

          <div className="pt-4 border-t border-slate-800 flex flex-col items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.location.reload()}
              className="border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700 text-xs px-5 py-2 rounded-lg"
            >
              <RefreshCw className="w-3.5 h-3.5 mr-2" />
              Reload Page
            </Button>
            <span className="text-[10px] text-slate-600 font-mono">
              Error Reference: ERR_CONNECTION_REFUSED
            </span>
          </div>
        </div>
      </div>
    );
  }

  // 2. MAINTENANCE MODE SCREEN
  if (status.mode === "maintenance") {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 text-slate-800 dark:text-slate-100 flex items-center justify-center p-4">
        <div className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 sm:p-10 shadow-2xl text-center space-y-6 relative overflow-hidden">
          <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600" />

          <div className="w-20 h-20 rounded-3xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mx-auto text-amber-600 dark:text-amber-400 shadow-inner">
            <Wrench className="w-10 h-10 animate-pulse" />
          </div>

          <div className="space-y-3">
            <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-950/60 px-3 py-1 rounded-full border border-amber-300/50">
              <AlertTriangle className="w-3.5 h-3.5" />
              রক্ষণাবেক্ষণ চলছে
            </span>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              {status.maintenance_title || "ওয়েবসাইট রক্ষণাবেক্ষণ চলছে"}
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              {status.maintenance_message ||
                "আমাদের ওয়েবসাইটে নিয়মিত আপগ্রেড ও রক্ষণাবেক্ষণের কাজ চলছে। সাময়িক অসুবিধার জন্য আন্তরিকভাবে দুঃখিত, খুব দ্রুত সাইট স্বাভাবিক হবে।"}
            </p>
          </div>

          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-col items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.location.reload()}
              className="text-xs px-5 py-2 rounded-xl"
            >
              <RefreshCw className="w-3.5 h-3.5 mr-2" />
              পুনরায় চেষ্টা করুন
            </Button>
            <p className="text-xs text-slate-400">
              জরুরি প্রয়োজনে আমাদের সাথে যোগাযোগ করুন।
            </p>
          </div>
        </div>
      </div>
    );
  }

  // 3. NORMAL LIVE MODE
  return <>{children}</>;
}

