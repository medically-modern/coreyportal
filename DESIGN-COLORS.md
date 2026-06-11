# ADHD-Informed Color System

Why the portal looks the way it does, and the rules to follow when adding anything new. Corey has ADHD; every color decision here exists to lower cognitive load, not to decorate.

## What the research says

**Saturation is the enemy.** Saturated colors increase visual arousal and cognitive load; muted, desaturated tones support emotional regulation and sustained focus. A desaturated palette means the brain processes fewer competing visual signals ([Well Built Places](https://wellbuiltplaces.org/2024/08/03/best-practices-for-design-and-use-of-colour-focus-on-adhd/), [MiEN](https://miencompany.com/designing-with-color-supporting-neurodivergence-in-learning-spaces/)).

**Blue and green calm; red and orange arouse.** Soft blues lower physiological arousal and promote focus; greens reduce eye strain and aid comprehension. Bright warm colors (red/orange/yellow) trigger heightened arousal that impairs cognitive performance — so they must be rationed, never ambient ([NeuroLaunch](https://neurolaunch.com/best-colors-for-adhd/), [Kylie M Interiors](https://www.kylieminteriors.ca/the-best-paint-colors-for-an-adhd-friendly-home-office/)).

**Dark mode helps — if contrast is softened.** Subdued dark interfaces are less overstimulating for neurodivergent users, but pure white text on near-black creates glare. Off-white on a near-neutral dark base is the sweet spot ([ProfileTree](https://profiletree.com/dark-mode-design/), [See Me Please](https://seemeplease.com/blog/dark-mode)).

**Consistent color-coding is an external memory system.** Assigning one stable meaning per color across every surface lets an ADHD brain route information pre-attentively — no re-reading, no re-deciding ([Sachs Center](https://sachscenter.com/color-coding-notes/), [Recallify](https://recallify.ai/adhd-apps-colour-coding-recallify/), [Neurodiversity Design System](https://www.neurodiversity.design/principles/colour/)).

**One accent color for action.** A muted base palette with a single accent for primary actions keeps attention undivided ([Adchitects](https://adchitects.co/blog/design-for-neurodiversity), [SOHO Creative](https://sohocreativegroup.com/color-psychology-for-neurodiverse-audiences)).

## The rules (enforced in `frontend/tailwind.config.js`)

Every Tailwind hue the app uses is overridden with a version desaturated ~35–45%, tuned for dark backgrounds. New UI automatically inherits the system as long as you use Tailwind color classes.

One meaning per color, everywhere, no exceptions:

| Color | Meaning | Never use for |
|---|---|---|
| **Teal (`brand`)** | Elena + primary actions. The single accent. | Status or urgency |
| **Red (`urgent`/`bad`/`red`)** | Do now. True urgency only. | Decoration, emphasis, deletes that aren't urgent |
| **Amber (`warn`/`amber`)** | Today / aging / snooze | Anything calm |
| **Blue** | Email channel; "can wait" | Primary buttons (that's teal) |
| **Green (`good`)** | Texts channel; done / caught up | Warnings |
| **Purple** | Team questions channel | Anything else |

Other rules: backgrounds stay near-neutral dark (`surface-900` base, `surface-800` cards); body text is `surface-100` off-white, never pure white; color appears as tints (`/5`–`/30` opacities) for fills with the full hue reserved for dots, badges, and text accents; urgency is shown by position (top of list) plus one badge — never by making things blink, glow, or saturate.

Elena's organize labels use the same scale end to end: red `do_now` → amber `today` → blue `can_wait` → neutral `fyi`.
