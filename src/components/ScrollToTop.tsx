import { useEffect } from "react";
import { useLocation } from "react-router-dom";

export function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    // Immediate scroll
    const scrollToTop = () => {
      window.scrollTo(0, 0);
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
      
      // Also scroll any scrollable main container
      const main = document.querySelector('main');
      if (main) main.scrollTop = 0;
    };

    // Execute immediately
    scrollToTop();
    
    // Also execute after a brief delay for mobile Safari/Chrome
    requestAnimationFrame(scrollToTop);
    setTimeout(scrollToTop, 0);
    setTimeout(scrollToTop, 100);
  }, [pathname]);

  return null;
}
