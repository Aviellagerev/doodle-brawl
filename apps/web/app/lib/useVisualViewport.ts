"use client";
import { useEffect } from "react";

/**
 * Publish the visual viewport — the part of the page the visitor can actually
 * see — as --vv-h and --vv-top on <html>. The game stage sizes itself by them.
 *
 * A phone keyboard shrinks the visual viewport but not the layout one (on iOS
 * always; on Android unless interactive-widget says otherwise), so 100dvh keeps
 * counting the pixels under the keys, and the browser scrolls the whole page up
 * to show the focused input — taking the vellum off the top of the screen with
 * it. iOS also pans the visual viewport inside the layout one; --vv-top follows.
 */
export function useVisualViewport() {
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const root = document.documentElement;
    let frame = 0;

    const publish = () => {
      frame = 0;
      // a pinch-zoom is the visitor's own business: let the stage zoom like
      // any page instead of re-fitting itself into the magnified corner
      if (vv.scale > 1.01) {
        root.style.removeProperty("--vv-h");
        root.style.removeProperty("--vv-top");
        return;
      }
      root.style.setProperty("--vv-h", `${vv.height}px`);
      root.style.setProperty("--vv-top", `${vv.offsetTop}px`);
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(publish); };

    publish();
    vv.addEventListener("resize", schedule);
    vv.addEventListener("scroll", schedule);
    return () => {
      cancelAnimationFrame(frame);
      vv.removeEventListener("resize", schedule);
      vv.removeEventListener("scroll", schedule);
      root.style.removeProperty("--vv-h");
      root.style.removeProperty("--vv-top");
    };
  }, []);
}
