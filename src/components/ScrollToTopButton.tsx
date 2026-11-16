import { useState, useEffect, useCallback, useRef } from "react";
import { ChevronUp } from "lucide-react";

interface ScrollToTopButtonProps {
  className?: string;
}

const ScrollToTopButton = ({ className = "" }: ScrollToTopButtonProps) => {
  const [visible, setVisible] = useState(false);
  const [progress, setProgress] = useState(0);
  const rafId = useRef<number | null>(null);

  const updateProgress = useCallback(() => {
    const scrollTop = window.scrollY || document.documentElement.scrollTop;
    const docHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;

    // Show button once user scrolls down more than 140px
    if (scrollTop > 140) {
      setVisible(true);
    } else {
      setVisible(false);
    }

    if (docHeight > 0) {
      const currentProgress = (scrollTop / docHeight) * 100;
      setProgress(Math.min(100, Math.max(0, currentProgress)));
    } else {
      setProgress(0);
    }
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      if (rafId.current !== null) {
        cancelAnimationFrame(rafId.current);
      }
      rafId.current = requestAnimationFrame(() => {
        updateProgress();
        rafId.current = null;
      });
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    updateProgress();

    return () => {
      window.removeEventListener("scroll", handleScroll);
      if (rafId.current !== null) {
        cancelAnimationFrame(rafId.current);
      }
    };
  }, [updateProgress]);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  // SVG circular geometry
  const radius = 23.5;
  const circumference = 2 * Math.PI * radius; // ~147.65px
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  return (
    <div
      className={`relative transition-all duration-300 ease-out select-none ${
        visible
          ? "opacity-100 scale-100 translate-y-0 pointer-events-auto"
          : "opacity-0 scale-75 translate-y-4 pointer-events-none"
      } ${className}`}
    >
      <button
        type="button"
        onClick={scrollToTop}
        aria-label="Scroll to top"
        title={`উপরে যান (${Math.round(progress)}%)`}
        className="group relative w-12 h-12 md:w-[52px] md:h-[52px] flex items-center justify-center rounded-full cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 transition-transform duration-300 hover:scale-110 active:scale-95"
      >
        {/* SVG Circular Progress Track & Progress Indicator */}
        <svg
          className="absolute inset-0 w-full h-full -rotate-90 pointer-events-none overflow-visible"
          viewBox="0 0 52 52"
        >
          {/* Faint Background Track Ring */}
          <circle
            cx="26"
            cy="26"
            r={radius}
            className="stroke-primary/20 dark:stroke-primary/30"
            strokeWidth="3"
            fill="transparent"
          />

          {/* Animated Scroll Progress Arc */}
          <circle
            cx="26"
            cy="26"
            r={radius}
            className="stroke-primary transition-[stroke-dashoffset] duration-150 ease-out"
            strokeWidth="3"
            strokeLinecap="round"
            fill="transparent"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
          />
        </svg>

        {/* Inner Solid Circular Core Button */}
        <div className="w-[38px] h-[38px] md:w-[42px] md:h-[42px] rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-md shadow-primary/25 border border-white/70 dark:border-white/20 transition-all duration-300 group-hover:shadow-lg group-hover:shadow-primary/40">
          <ChevronUp className="h-6 w-6 md:h-7 md:w-7 stroke-[3] transition-transform duration-300 group-hover:-translate-y-0.5" />
        </div>
      </button>
    </div>
  );
};

export default ScrollToTopButton;
