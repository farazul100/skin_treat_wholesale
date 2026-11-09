import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import TopBar from "@/components/TopBar";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { toast } from "sonner";

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", password: "" });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isLogin) {
        await signIn(form.email, form.password);
        toast.success("সফলভাবে লগইন হয়েছে");
      } else {
        await signUp(form.email, form.password, form.name);
        toast.success("একাউন্ট সফলভাবে তৈরি হয়েছে!");
      }
      navigate("/dashboard");
    } catch (err: any) {
      toast.error(err.message || "একটি সমস্যা হয়েছে");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <TopBar /><Header />
      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm">
          <h1 className="text-2xl font-bold text-foreground text-center mb-6">
            {isLogin ? "লগইন করুন" : "একাউন্ট তৈরি করুন"}
          </h1>
          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <div>
                <Label htmlFor="name">নাম</Label>
                <Input id="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="আপনার নাম" required />
              </div>
            )}
            <div>
              <Label htmlFor="email">ইমেইল</Label>
              <Input id="email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="email@example.com" required />
            </div>
            <div>
              <Label htmlFor="password">পাসওয়ার্ড</Label>
              <Input id="password" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="কমপক্ষে ৬ অক্ষর" required />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "অপেক্ষা করুন..." : isLogin ? "লগইন" : "সাইনআপ"}
            </Button>
          </form>
          <p className="text-center text-sm text-muted-foreground mt-4">
            {isLogin ? "একাউন্ট নেই?" : "একাউন্ট আছে?"}{" "}
            <button onClick={() => setIsLogin(!isLogin)} className="text-primary underline">
              {isLogin ? "সাইনআপ করুন" : "লগইন করুন"}
            </button>
          </p>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Auth;
