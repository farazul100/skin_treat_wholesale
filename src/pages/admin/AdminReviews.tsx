import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Trash2, Plus, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

const AdminReviews = () => {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const { data: reviews, isLoading } = useQuery({
    queryKey: ["admin-reviews"],
    queryFn: async () => {
      const { data } = await supabase.from("reviews").select("*").order("created_at", { ascending: false });
      return data || [];
    },
  });

  const uploadImage = async (file: File): Promise<string> => {
    const ext = file.name.split(".").pop();
    const fileName = `${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("review-images").upload(fileName, file);
    if (error) throw error;
    const { data } = supabase.storage.from("review-images").getPublicUrl(fileName);
    return data.publicUrl;
  };

  const addReview = useMutation({
    mutationFn: async () => {
      if (!imageFile) throw new Error("No image");
      setUploading(true);
      const imageUrl = await uploadImage(imageFile);
      const { error } = await supabase.from("reviews").insert({
        customer_name: "রিভিউ",
        rating: 5,
        image: imageUrl,
        is_approved: true,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-reviews"] });
      queryClient.invalidateQueries({ queryKey: ["approved-reviews"] });
      setImageFile(null);
      setOpen(false);
      setUploading(false);
      toast.success("রিভিউ যোগ হয়েছে");
    },
    onError: () => {
      setUploading(false);
      toast.error("রিভিউ যোগ করতে সমস্যা হয়েছে");
    },
  });

  const toggleApproval = useMutation({
    mutationFn: async ({ id, approved }: { id: string; approved: boolean }) => {
      const { error } = await supabase.from("reviews").update({ is_approved: approved }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-reviews"] });
      queryClient.invalidateQueries({ queryKey: ["approved-reviews"] });
    },
  });

  const deleteReview = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("reviews").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-reviews"] });
      queryClient.invalidateQueries({ queryKey: ["approved-reviews"] });
      toast.success("রিভিউ মুছে ফেলা হয়েছে");
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">রিভিউ ম্যানেজমেন্ট</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" /> রিভিউ যোগ করুন</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>নতুন রিভিউ ছবি যোগ করুন</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between">
                  <Label>রিভিউ ছবি</Label>
                  <span className="text-[11px] font-bold text-primary">সঠিক মাপ: 400×300 বা 400×400 px</span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5 mb-2">৪:৩ বা ১:১ অনুপাত (JPG বা PNG)। গ্রাহকের রিভিউ বা আনবক্সিং ছবি।</p>
                <div className="mt-2">
                  {imageFile ? (
                    <div className="relative inline-block">
                      <img src={URL.createObjectURL(imageFile)} alt="" className="w-full max-w-[300px] aspect-[4/3] rounded-lg object-cover border-2 border-primary" />
                      <button onClick={() => setImageFile(null)} className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-0.5">
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center gap-2 cursor-pointer border-2 border-dashed border-primary/40 rounded-lg px-4 py-8 hover:bg-secondary transition-colors">
                      <Upload className="h-8 w-8 text-primary/60" />
                      <span className="text-sm font-medium text-foreground">ছবি আপলোড করুন (400×300 px)</span>
                      <span className="text-xs text-muted-foreground">৪:৩ বা স্কয়ার রেশিও</span>
                      <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                        if (e.target.files?.[0]) setImageFile(e.target.files[0]);
                      }} />
                    </label>
                  )}
                </div>
              </div>
              <Button onClick={() => addReview.mutate()} disabled={!imageFile || uploading} className="w-full">
                {uploading ? "আপলোড হচ্ছে..." : "সেভ করুন"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="text-center py-10 text-muted-foreground">লোড হচ্ছে...</div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {reviews?.map((review: any) => (
            <Card key={review.id} className="overflow-hidden">
              {review.image ? (
                <img src={review.image} alt="রিভিউ" className="w-full aspect-[4/3] object-cover" />
              ) : (
                <div className="w-full aspect-[4/3] bg-muted flex items-center justify-center text-muted-foreground text-sm">
                  কোনো ছবি নেই
                </div>
              )}
              <div className="p-3 flex items-center justify-between">
                <Switch checked={review.is_approved} onCheckedChange={(v) => toggleApproval.mutate({ id: review.id, approved: v })} />
                <Button variant="ghost" size="icon" onClick={() => deleteReview.mutate(review.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </Card>
          ))}
          {!reviews?.length && <p className="text-center text-muted-foreground py-10 col-span-full">কোনো রিভিউ নেই</p>}
        </div>
      )}
    </div>
  );
};

export default AdminReviews;
