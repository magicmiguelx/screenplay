// The overlay drawn over the app while it is recorded. Its layers, bottom
// to top: the spotlight, the picture, the caption (above the picture's
// dim backdrop: a caption over a picture card was dim in a first film's
// hook), the card, the click ring, the cursor. Headless Chromium
// draws no cursor, so the page gets one: a pointer that glides to each
// control (a CSS transition, so it moves smoothly even while a
// software-rendered scene runs at a few frames a second), a ring on each
// click, a caption (bottom or top, centred, or in a corner), a title card, a picture card and a
// spotlight. Installed in every document the page loads
// (page.addInitScript), so it survives a navigation.
//
// It runs in the page: no imports, no closures over the test process, and
// its only argument is serialised (`OverlayOptions`).

export interface OverlayOptions {
  /** The small line at the bottom of every title card: the product and its tagline. */
  brand?: string;
  /**
   * Refuse browser full screen. In headless Chromium a real full screen
   * resizes the screencast's surface and the frames come out cropped and
   * zoomed; refused, an app that falls back to an in-window full-screen
   * view looks the same at the recording's window size. Default true.
   */
  refuseFullscreen?: boolean;
  /** Extra CSS appended to the overlay's own (fonts, colours). */
  css?: string;
  /**
   * The heartbeat: an invisible 2-pixel dot stepped across the bottom-left
   * corner this many times a second, so the screencast keeps sending
   * frames while the page is still. A page that draws nothing between
   * actions (no animation, no 3D scene) sends no frames, and the recorder
   * could not tell when a caption was in the picture. Stepped from a
   * timer, not a CSS animation: the compositor runs an animation while the
   * main thread is busy, and the frames it sent then were stale (a caption
   * lingered five seconds past its line in a Plenoview take); a timer only
   * fires when the page can paint, so a frame timed after a change shows
   * it. The dot sits above the card, or a card hides it and the frames
   * stop. Default 12; 0 turns it off, though an app whose scene renders
   * continuously still goes still in some states (a table view, a card
   * over it), so leave it on unless measured.
   */
  heartbeat?: number;
}

export interface Rect { x: number; y: number; width: number; height: number }
/** Where a caption would sit and what it would cover there. */
export interface Placement { cover: number; box: Rect }
/** A caption's position (place.ts `Where`; spelled out here, since the overlay imports nothing). */
export type CaptionAt = 'bottom' | 'top' | 'bottom-left' | 'bottom-right' | 'top-left' | 'top-right';

/** The overlay's API, on `window.__demo` once installed. */
export interface OverlayApi {
  cursorTo(x: number, y: number, ms: number): void;
  press(x: number, y: number): void;
  /** Show a caption at a position (default the bottom; `true` is the top, as before corners), or take it down. */
  caption(text: string | null, at?: CaptionAt | boolean): void;
  /**
   * The caption's cover at each position: the share of a grid of points
   * under its box that lands on the page's own content (text, controls,
   * pictures), 0 to 1; plus 1 where the box would sit over `avoid` (the
   * element, or elements, a line is about). Measures `text` without showing it.
   */
  measure(text: string, avoid?: Rect | Rect[] | null): Record<CaptionAt, Placement>;
  card(kicker: string | null, title?: string, sub?: string): void;
  picture(src: string | null): void;
  spot(rect: { x: number; y: number; width: number; height: number } | null): void;
}

/** Installs the overlay; passed to page.addInitScript with its options. */
export function overlay(opts: OverlayOptions = {}) {
  const w = window as unknown as { __demo?: OverlayApi };
  if (w.__demo) return;
  if (opts.refuseFullscreen !== false) {
    Element.prototype.requestFullscreen = () => Promise.reject(new Error('Not in the demo recordings.'));
  }
  const beat = Math.max(0, Math.round(opts.heartbeat ?? 12));
  const css = `
#demo-overlay { position: fixed; inset: 0; pointer-events: none; z-index: 2147483647; font: 500 20px/1.4 system-ui, -apple-system, 'Segoe UI', sans-serif; }
#demo-overlay .cursor { position: absolute; left: 0; top: 0; width: 26px; height: 26px; transition-property: transform; transition-timing-function: cubic-bezier(.45,.05,.25,1); filter: drop-shadow(0 2px 3px rgba(0,0,0,.55)); z-index: 5; }
#demo-overlay .ring { position: absolute; width: 44px; height: 44px; margin: -22px 0 0 -22px; border-radius: 50%; border: 3px solid #ffd54a; opacity: 0; z-index: 4; }
#demo-overlay .ring.on { animation: demo-ring .55s ease-out; }
@keyframes demo-ring { from { transform: scale(.35); opacity: 1; } to { transform: scale(1.25); opacity: 0; } }
#demo-overlay .caption { position: absolute; left: 50%; bottom: 96px; transform: translateX(-50%); max-width: 74%; padding: 12px 22px; border-radius: 12px; background: rgba(9, 13, 22, .9); color: #f4f7fb; text-align: center; box-shadow: 0 8px 28px rgba(0,0,0,.45); border: 1px solid rgba(255,255,255,.12); opacity: 0; transition: opacity .3s; z-index: 2; }
#demo-overlay .caption.top { bottom: auto; top: 64px; }
#demo-overlay .caption.left, #demo-overlay .caption.right { transform: none; max-width: 42%; text-align: left; }
#demo-overlay .caption.left { left: 32px; }
#demo-overlay .caption.right { left: auto; right: 32px; }
#demo-overlay .caption.on { opacity: 1; }
#demo-overlay .card { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 14px; background: radial-gradient(ellipse at 50% 40%, rgba(22, 34, 58, .94), rgba(6, 9, 16, .97)); color: #fff; opacity: 0; transition: opacity .45s; text-align: center; padding: 0 12%; z-index: 3; }
#demo-overlay .card.on { opacity: 1; }
#demo-overlay .card .kicker { font-size: .9em; letter-spacing: .14em; text-transform: uppercase; color: #8fb8ff; }
#demo-overlay .card h1 { margin: 0; font-size: 2.4em; font-weight: 700; letter-spacing: -.01em; }
#demo-overlay .card p { margin: 0; font-size: 1.1em; color: #c9d4e5; max-width: 45em; }
#demo-overlay .card .brand { position: absolute; bottom: 36px; font-size: .8em; color: #7f8ba0; letter-spacing: .04em; }
#demo-overlay .picture { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; background: rgba(6, 9, 16, .82); opacity: 0; transition: opacity .4s; z-index: 1; }
#demo-overlay .picture.on { opacity: 1; }
#demo-overlay .picture img { max-width: 78%; max-height: 74%; border-radius: 10px; box-shadow: 0 18px 60px rgba(0,0,0,.6); }
#demo-overlay .spot { position: absolute; border: 3px solid #ffd54a; border-radius: 10px; box-shadow: 0 0 0 4000px rgba(0,0,0,.28); opacity: 0; transition: opacity .3s, left .3s, top .3s, width .3s, height .3s; }
#demo-overlay .spot.on { opacity: 1; }
#demo-overlay .beat { position: absolute; left: 0; bottom: 0; width: 2px; height: 2px; background: rgba(255,255,255,.02); z-index: 6; }
${opts.css ?? ''}`;
  const text = (s: string) => s.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]!);
  const install = () => {
    if (document.getElementById('demo-overlay')) return;
    const style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);
    const root = document.createElement('div');
    root.id = 'demo-overlay';
    root.setAttribute('aria-hidden', 'true');
    root.innerHTML = `
      ${beat ? '<div class="beat"></div>' : ''}
      <div class="spot"></div>
      <div class="caption"></div>
      <div class="picture"><img alt=""></div>
      <div class="card"><div class="kicker"></div><h1></h1><p></p><div class="brand">${text(opts.brand ?? '')}</div></div>
      <div class="ring"></div>
      <svg class="cursor" viewBox="0 0 26 26"><path d="M3 2 L3 21 L8.2 16.4 L11.6 24 L15 22.5 L11.7 15 L19 15 Z" fill="#fff" stroke="#111" stroke-width="1.6" stroke-linejoin="round"/></svg>`;
    document.body.appendChild(root);
    if (beat) {
      const dot = root.querySelector('.beat') as HTMLElement;
      let step = 0;
      setInterval(() => { dot.style.transform = `translateX(${step++ % beat}px)`; }, 1000 / beat);
    }
  };
  const $ = (sel: string) => { install(); return document.querySelector(`#demo-overlay ${sel}`) as HTMLElement; };
  const place = (c: HTMLElement, at: string) => {
    c.classList.toggle('top', at.startsWith('top'));
    c.classList.toggle('left', at.endsWith('left'));
    c.classList.toggle('right', at.endsWith('right'));
  };
  const placed = (c: HTMLElement) => `${c.classList.contains('top') ? 'top' : 'bottom'}${c.classList.contains('left') ? '-left' : c.classList.contains('right') ? '-right' : ''}`;
  w.__demo = {
    cursorTo(x, y, ms) {
      const c = $('.cursor');
      c.style.transitionDuration = `${ms}ms`;
      c.style.transform = `translate(${x - 3}px, ${y - 2}px)`;
    },
    press(x, y) {
      const r = $('.ring');
      r.style.left = `${x}px`;
      r.style.top = `${y}px`;
      r.classList.remove('on');
      void r.offsetWidth;
      r.classList.add('on');
    },
    caption(text, at = 'bottom') {
      const c = $('.caption');
      if (text) { c.textContent = text; place(c, at === true ? 'top' : at === false ? 'bottom' : at); }
      c.classList.toggle('on', !!text);
    },
    measure(text, avoid = null) {
      const c = $('.caption');
      const was = { text: c.textContent, at: placed(c) };
      c.textContent = text;
      // What a point is on: the page's own content (text, a control, a picture), or a bare surface.
      const content = (el: Element) => {
        if (/^(INPUT|TEXTAREA|SELECT|BUTTON|A|IMG|SVG|CANVAS|VIDEO|LABEL|SUMMARY|OPTION)$/.test(el.tagName) || el.closest('svg')) return true;
        for (const n of Array.from(el.childNodes)) if (n.nodeType === 3 && (n.textContent ?? '').trim()) return true;
        // A background picture counts on a small element (an avatar, a thumbnail), not on the page's own backdrop.
        const r = el.getBoundingClientRect();
        if (r.width * r.height < innerWidth * innerHeight * 0.2 && getComputedStyle(el).backgroundImage !== 'none') return true;
        return false;
      };
      const cover = (r: DOMRect) => {
        let hit = 0, n = 0;
        for (let i = 0; i < 12; i++) for (let j = 0; j < 4; j++) {
          const x = r.left + ((i + 0.5) * r.width) / 12, y = r.top + ((j + 0.5) * r.height) / 4;
          if (x < 0 || y < 0 || x > innerWidth || y > innerHeight) continue;
          n++;
          const el = document.elementsFromPoint(x, y).find(e => !e.closest('#demo-overlay'));
          if (el && content(el)) hit++;
        }
        return n ? hit / n : 0;
      };
      const avoids = avoid ? (Array.isArray(avoid) ? avoid : [avoid]) : [];
      const over = (r: DOMRect) => avoids.some(a => r.left < a.x + a.width && r.right > a.x && r.top < a.y + a.height && r.bottom > a.y);
      // Under a picture card the page is dimmed away: what the caption can cover is the picture itself.
      const picture = $('.picture').classList.contains('on') ? $('.picture img').getBoundingClientRect() : null;
      const onPicture = (r: DOMRect) => {
        if (!picture) return 0;
        const w = Math.max(0, Math.min(r.right, picture.right) - Math.max(r.left, picture.left));
        const h = Math.max(0, Math.min(r.bottom, picture.bottom) - Math.max(r.top, picture.top));
        return r.width * r.height ? (w * h) / (r.width * r.height) : 0;
      };
      // Under a spotlight the rest of the page is dimmed too: the lit element is what matters, and `avoid` names it.
      const at = (where: CaptionAt) => {
        place(c, where);
        const r = c.getBoundingClientRect();
        return { cover: (picture ? onPicture(r) : cover(r)) + (over(r) ? 1 : 0), box: { x: r.left, y: r.top, width: r.width, height: r.height } };
      };
      const all: CaptionAt[] = ['bottom', 'top', 'bottom-left', 'bottom-right', 'top-left', 'top-right'];
      const out = Object.fromEntries(all.map(w => [w, at(w)])) as Record<CaptionAt, Placement>;
      place(c, was.at);
      c.textContent = was.text;
      return out;
    },
    card(kicker, title, sub) {
      const c = $('.card');
      if (kicker !== null) {
        c.querySelector('.kicker')!.textContent = kicker;
        c.querySelector('h1')!.textContent = title ?? '';
        c.querySelector('p')!.textContent = sub ?? '';
      }
      c.classList.toggle('on', kicker !== null);
    },
    picture(src) {
      const p = $('.picture');
      if (src) (p.querySelector('img') as HTMLImageElement).src = src;
      p.classList.toggle('on', !!src);
    },
    spot(rect) {
      const s = $('.spot');
      if (rect) Object.assign(s.style, { left: `${rect.x - 6}px`, top: `${rect.y - 6}px`, width: `${rect.width + 12}px`, height: `${rect.height + 12}px` });
      s.classList.toggle('on', !!rect);
    },
  };
  if (document.body) install(); else document.addEventListener('DOMContentLoaded', install);
}
