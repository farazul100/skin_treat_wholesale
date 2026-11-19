import { Check, X } from "lucide-react";

const comparisons = [
  { feature: "১০০% প্রাকৃতিক উপাদান", us: true, others: false },
  { feature: "ল্যাব টেস্টেড পণ্য", us: true, others: false },
  { feature: "৭ দিনের মানি-ব্যাক গ্যারান্টি", us: true, others: false },
  { feature: "ক্ষতিকর কেমিক্যাল মুক্ত", us: true, others: false },
  { feature: "সাশ্রয়ী মূল্য", us: true, others: true },
  { feature: "সারাদেশে ডেলিভারি", us: true, others: true },
];

const WhyUs = () => {
  return (
    <section className="py-10 md:py-16 bg-background">
      <div className="container mx-auto px-4">
        <div className="text-center mb-8">
          <h2 className="text-2xl md:text-3xl font-bold text-foreground">কেন আমরা আলাদা?</h2>
          <p className="text-muted-foreground mt-2">অন্যদের তুলনায় আমাদের পার্থক্য</p>
        </div>
        <div className="max-w-2xl mx-auto">
          <div className="rounded-xl border overflow-hidden">
            <div className="grid grid-cols-3 bg-primary text-primary-foreground font-semibold text-sm">
              <div className="p-4">বৈশিষ্ট্য</div>
              <div className="p-4 text-center">Sunnahly</div>
              <div className="p-4 text-center">অন্যরা</div>
            </div>
            {comparisons.map((item, i) => (
              <div key={i} className={`grid grid-cols-3 text-sm ${i % 2 === 0 ? "bg-card" : "bg-secondary/50"}`}>
                <div className="p-4 text-foreground font-medium">{item.feature}</div>
                <div className="p-4 flex justify-center">
                  <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center">
                    <Check className="h-4 w-4 text-primary" />
                  </div>
                </div>
                <div className="p-4 flex justify-center">
                  {item.others ? (
                    <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center">
                      <Check className="h-4 w-4 text-primary" />
                    </div>
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-destructive/10 flex items-center justify-center">
                      <X className="h-4 w-4 text-destructive" />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default WhyUs;
