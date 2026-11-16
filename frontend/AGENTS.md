<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## WebEdu UI and motion

- WebEdu is TD Hán Ngữ's Vietnamese learning platform. Prioritize reading and completing tasks in the student, teacher, and admin portals. Use the paper, ink, and seal-red tokens in [globals.css](src/app/globals.css), Be Vietnam Pro for Vietnamese UI text, and the existing Han font stack for Chinese characters. Reuse shared portal and UI components.
- Use [frontend-design](../.agents/skills/frontend-design/SKILL.md) for visual direction and [ui-ux-pro-max](../.agents/skills/ui-ux-pro-max/SKILL.md) for targeted UX and accessibility checks. Review its suggestions against WebEdu's existing design. From the repo root, run `python .agents/skills/ui-ux-pro-max/scripts/search.py "reduced motion keyboard focus" --domain ux` for motion accessibility checks.
- Concentrate motion where it helps users notice a change or understand feedback. Use [css-animation-creator](../.agents/skills/css-animation-creator/SKILL.md) for simple DOM transitions and [motion-framer](../.agents/skills/motion-framer/SKILL.md) for React layout, gestures, or coordinated transitions that need Motion. Consult [web-motion-design](../.agents/skills/web-motion-design/SKILL.md) for timing and easing, [hover-interactions](../.agents/skills/hover-interactions/SKILL.md) for pointer feedback, and [motion-language-designer](../.agents/skills/motion-language-designer/SKILL.md) when defining shared motion conventions.
- Use [gsap-framer-scroll-animation](../.agents/skills/gsap-framer-scroll-animation/SKILL.md) for scroll-linked motion. For a decorative canvas that responds to a pointer, start with Canvas 2D, pointer events, and `requestAnimationFrame`. Keep pointer coordinates out of React render state and cancel the animation frame and listeners on unmount.
- Use [accessible-motion](../.agents/skills/accessible-motion/SKILL.md) to check reduced-motion behavior. The CSS reset in `globals.css` covers CSS motion. For a decorative canvas, also honor `prefers-reduced-motion` in JavaScript and show a static fallback. Verify touch and keyboard use, keep the focus ring visible around overlays, and keep decorative layers from intercepting controls.
