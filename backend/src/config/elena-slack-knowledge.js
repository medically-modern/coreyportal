// Elena's Slack Intelligence — extracted from complete Slack history
// Sources: 172 channel messages + 40 threads (163 replies) + 3,350 DM/group messages
// Period: March 9 — June 6, 2026

export const SLACK_KNOWLEDGE = `
## TEAM INTELLIGENCE (from Slack — updated June 2026)

### Full Team Roster
- **Corey Deutsch** — CEO. Communicates in bursts: long strategic messages when focused, rapid one-liners when delegating. Praise-to-task ratio ~1:2.3. Uses exclamation marks, sports metaphors ("Michael Jordan in the fourth"). Sets boundaries openly ("turning phone off going to wake"). Trusts team to self-manage. When overwhelmed, he admits it openly ("i'm feeling very very very overwhelmed by gmail + slack + text + calls"). He personally handles sell calls and retention. Speaks some Spanish.
- **Brandon Ellis** — COO/Operations. Insurance authority and fulfillment lead. 768 DMs with Josh, 526 in the leadership trio. Catches errors constructively. Creates training videos on the spot. Handles same-or-similar checks, shipping, claims, modifier rules. Escalates to Corey only for sell calls. Celebrates team wins ("LETS GO! WE GOT A PAYMENT"). Works late nights on operations.
- **Masheke** — Medical Evaluation / Fax Intake. Highest-volume channel poster. Pattern: tag person > state receipt > attach document. Handles CareCarentrix referrals, Mid-Island scripts, auth notifications. Average 42 words per message (most detailed writer). In group DMs with Corey, provides medical evaluation context and patient status updates.
- **Janelle Beatty** — Pipeline Oversight / Welcome Call. Joined May 5, 2026. 440 DMs with Josh (2nd highest). Professional template: "Hi @[person], [patient name] [situation]. [Details]. [Action needed]." Reports system bugs clearly. Bridges patients and ops. Has a private group DM with Samantha (121 msgs) for intake coordination. Corey calls her a leader ("amazing demonstration of leadership, already stepping into coach mode").
- **Samantha** — Insurance & Benefits. 93 msgs in the Brandon+Corey+Samantha group. Extremely thorough: documents every auth submission with patient name, insurance, method, date, and ref number. Flags discrepancies proactively. Asks clarifying questions when something doesn't match. Works through long lists methodically. When she says "sorted" it IS sorted.
- **Josh Hoffman** — Engineering / Automation. 1,422 DM messages total (highest volume). Brief, action-oriented. Builds requested tools rapidly. Handles subscription updates, system changes, Medicaid DVS/claims automation, Monday.com integrations, Stedi insurance verification API. Close personal relationship with Corey and Brandon.
- **Michelle Coan** — Phone Support. Front-line call handling. Has ePaces/Medicaid portal expertise. Routes calls to appropriate team members. 80 DMs with Josh for system questions.
- **Christopher (Chris) Brown** — Deliveries / Store operations. Handles in-store pickups, local deliveries. Manages ostomy supply deliveries.
- **Madeline Wichman (Maddie)** — Intern, started May 2026. Fights for retroactive auths. 26 DMs with Josh.
- **Connor Ross** — Mid-Island intake form testing (early team member).

### Communication Topology (from DM volume)
- **Core trio**: Josh + Brandon + Corey (526 msgs in group, 768+603 in DMs = ~1,900 msgs total)
- **Ops duo**: Samantha + Janelle (121 msgs in private group — intake coordination)
- **Insurance chain**: Brandon + Corey + Samantha (93 msgs — auth submissions, insurance workflow)
- **Leadership trio + ops**: Brandon + Corey + Masheke (103 msgs — medical eval decisions)
- **Janelle's reach**: DMs with Josh (440), group with Brandon (82), group with Corey (62), group with Samantha (121)
- **Private leadership channel**: med-mod-leadership (Corey, Brandon, Janelle, Josh)

### Team Routing (who handles what)
- Fax/script received → Masheke posts to #med-mod-onboarding
- Patient calling for status → Janelle handles, escalates to Brandon
- Insurance verification needed → Samantha (documents everything with auth ref numbers)
- Same-or-similar check → Brandon (Noridian portal, training video exists)
- Subscription/system update → Josh
- In-store pickup/delivery → Christopher Brown
- Sell call / upsell opportunity → Corey
- Compliance question → Corey
- Phone coverage → Michelle (ePaces expertise)
- Clinicals/medical evaluation → Masheke
- Auth submission tracking → Samantha (method, date, ref# for every submission)

### Operational Pipeline (Slack-confirmed from DMs)
Step 1: Referral Receipt — Masheke receives fax, posts document with patient name, tags Janelle + Brandon
Step 2: Medical Evaluation — Masheke processes clinicals, medical necessity
Step 3: Insurance/Auth — Samantha submits auths via portals (Fidelis, Availity, UHC, fax), documents ref numbers
Step 4: Pipeline Triage — Janelle monitors auth outstanding, escalates blockers
Step 5: Same-or-Similar Check — Brandon verifies clearance dates via Noridian
Step 6: Welcome Call — Janelle conducts, captures patient preferences
Step 7: Fulfillment — Brandon handles shipping + order advancement, Josh updates subscriptions
Step 8: Confirm Profile — Brandon reviews final details before shipping

### Key Technical Systems (from DMs)
- **Monday.com** — Primary patient pipeline board (medical eval → benefits → auth → welcome call → confirm profile → ship)
- **Stedi API** — Insurance eligibility verification (integrated by Josh)
- **ePaces** — New York Medicaid portal for DVS (prior auth) and claims
- **Medicaid DVS system** — Automated by Josh: A1=certified, A3=not certified. Auto-retry daily at 9am.
- **Claims system** — F1=finalized paid, F3=not paid. Automated submission built by Josh.
- **Cardinal Health APIs** — Integration in progress for supply chain
- **Stripe** — Co-insurance/co-pay payment collection (just launched June 5, 2026)
- **Command Center** — Internal patient management tool (built by Josh, used by team)

## CRITICAL COMPLIANCE RULES (from Slack — MUST ENFORCE)

### CareCarentrix OOP Rule (CRITICAL)
- CareCarentrix patients must NEVER be told OOP costs
- Must direct them to CareCarentrix for any cost questions
- Julie and Tobey (CareCarentrix contacts) explicitly warned about penalties

### Medicare Auth Exception
- Medicare does NOT require prior authorization for CGM or insulin pump
- If system shows "auth denied" for Medicare patient, it's a system error

### Same-or-Similar Rule
- Must check clearance before ordering any DME
- Bill date determines clearance (e.g., bill date 3/5 = can't reorder until 6/5)
- Brandon has Noridian portal access and training video

### Horizon BCBS Modifiers (via CareCarentrix — EXACT match required)
- A4230: NU SC
- A4232: NU SC
- A4239: NU
- E2103: NU
- E0784: NU

### Auth Submission Methods by Carrier (from Samantha's DM documentation)
- Fidelis: Fidelis portal (generates auth ref starting with 26...)
- Anthem BCBS: Availity (generates ref like UM97...)
- UHC/NYSHIP: UHC portal (generates ref like A31...)
- Wellcare: Availity (may not generate ref)
- Horizon BCBS: Via CareCarentrix only
- Cigna DME: Cigna portal
- Some carriers: Fax submission (no instant ref)

### Subscription vs Onboarding
- Subscription patients should NOT be on the onboarding board
- Existing patients getting new auth or product changes stay in subscription flow

### Special Patient Notes
- **Susan and Sheryl** — Do NOT touch in welcome call bucket (Corey's orders, May 17)
- **Philip Yorrie** — Has dementia. Extra patience on status calls.
- **Jocelyn Green** — Fidelis Medicaid, supplies should go to Medicaid not commercial
- **Milanya Rivera** — May be Fidelis Medicaid not Fidelis low-cost
- **Holly Tyson** — Prediabetic patient, CareCarentrix referral

## KEY PARTNERS (from Slack DMs)

### Mid-Island Pharmacy — Primary script source (38 channel mentions)
### CareCarentrix — Major referral network (31 mentions). OOP discussion PROHIBITED.
### Naomi Berrie Diabetes Center (NYP) — Close clinical relationship. Coverage exceptions may apply.
### Stedi — Insurance verification API partner (private channel with 70 msgs for integration)
### Cardinal Health — Supply chain partner, API integration in progress

### Key Insurance Carriers & Portals
- Fidelis: CHP, Essential Plan, Medicaid variants. Portal for auth submission.
- Anthem BCBS: Commercial and Medicaid (JLJ). Availity for auths.
- UHC/United: Commercial and Medicare Advantage. UHC portal.
- Cigna/CIGNA DME: Channel available for patient coverage.
- Horizon BCBS: Via CareCarentrix ONLY. Exact modifiers required.
- Medicare: No auth required. Noridian for same-or-similar checks.
- NYSHIP/Empire: Via UHC portal.
- Wellcare: Via Availity.
- Humana: Via Availity.

## COREY'S COMMUNICATION PATTERNS (for Elena's response style)

### What Corey said on June 5, 2026 (the exact reason Elena exists):
"Dog i'm feeling very very very overwhelmed by gmail + slack + text + Calls --> pipeline questions, technology questions, admin questions, former seller questions. I dont know how to manage all of it - if you save me - i will give the love back 10x"

### Pattern Rules for Elena:
- In burst mode (rapid one-liners): give him one-liner responses
- In planning mode (long structured messages): can handle detailed briefings
- When he says "turning phone off" or "out of pocket": queue items silently
- Always end with a clear next action — never leave wondering "so what do I do?"
- Match his energy: exclamation marks when celebrating, direct when delegating
- Frame problems as "here's what needs your superpowers" not negative alerts
- He trusts his team deeply — don't second-guess their work to him
- He cares about his health ("my body after 4 hours just starts boiling") — respect boundaries
- He celebrates wins publicly and personally — Elena should acknowledge wins too

### Escalation Signals (from DMs — expanded)
"NOT CLEAR", "urgent", "denial", "denial notification", "escalating", "out of supplies",
"not on the board", "error", "incorrect", "can't edit", "missing", "not visible",
"voicemails" (multiple), "not able to order", "cannot mention", "in trouble",
"clinicals did not transfer", "no medicare id"

### Escalation Path:
Team member → Janelle → Brandon → Corey
(Corey only for: sell calls, compliance, strategic decisions, patient retention, CareCarentrix issues)

## RECENT MILESTONES (from latest DMs)
- June 5, 2026: First external-facing co-insurance payment product launched (Stripe integration)
- June 5, 2026: Reorder confirmation system going live Sunday
- May 17, 2026: Leadership channel created, role definitions formalized
- May 5, 2026: Janelle Beatty joined, immediately became pipeline leader
- April 8, 2026: Medicaid DVS automation fully operational with auto-retry
- March-April 2026: Claims automation built for NY Medicaid
`;

export default SLACK_KNOWLEDGE;
