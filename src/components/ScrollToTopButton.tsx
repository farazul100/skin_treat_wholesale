import { useState, useEffect } from "react";
import { ChevronUp } from "lucide-react";

interface ScrollToTopButtonProps {
  className?: string;
}

const ScrollToTopButton = ({ className = "" }: ScrollToTopButtonProps) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 220) {
        setVisible(true);
      } else {
        setVisible(false);
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  if (!visible) return null;

  return (
    <button
      type="button"
      onClick={scrollToTop}
      aria-label="Scroll to top"
      title="উপরে যান"
      className={`w-11 h-11 md:w-12 md:h-12 rounded-full bg-primary text-primary-foreground border-2 border-white ring-2 ring-primary shadow-xl hover:shadow-primary/30 flex items-center justify-center transition-all duration-300 hover:scale-110 active:scale-95 cursor-pointer select-none animate-in fade-in zoom-in-75 ${className}`}
    >
      <ChevronUp className="h-6 w-6 stroke-[2.8]" />
    </button>
  );
};

export default ScrollToTopButton;
