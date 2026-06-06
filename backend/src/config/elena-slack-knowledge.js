// Slack-derived intelligence — appended to Elena's knowledge base
// Source: 172 channel messages + 40 threads (163 replies) from Slack
// Period: March 24 — June 6, 2026

export const SLACK_KNOWLEDGE = `
## TEAM INTELLIGENCE (from Slack — updated June 2026)

### Full Team Roster (expanded from SMS data)
- **Corey Deutsch** — CEO. Communicates in bursts: long strategic messages when focused, rapid one-liners when delegating. Praise-to-task ratio ~1:2.3. Uses exclamation marks, sports metaphors ("Michael Jordan in the fourth"). Sets boundaries openly ("turning phone off going to wake"). Trusts team to self-manage.
- **Brandon Ellis** — COO/Operations. Insurance authority. Catches errors constructively ("just want to point them out for future"). Creates training videos on the spot. Handles fulfillment, shipping, same-or-similar checks. Escalates to Corey only for sell calls.
- **Masheke** — Medical Evaluation / Fax Intake. Highest-volume Slack poster (39%). Pattern: tag person > state receipt > attach document. Rarely adds commentary. Handles CareCarentrix referrals, Mid-Island scripts, insurance auth notifications.
- **Janelle Beatty** — Pipeline Oversight / Welcome Call. Joined May 5, 2026. Most active in threads (39 msgs). Professional template: "Hi @[person], [patient name] [situation]. [Details]. [Action needed]." Bridges patients and ops team.
- **Samantha** — Insurance & Benefits. Quiet efficiency. When she says "sorted" it's sorted. Cross-checks CareCarentrix portal approvals. Identifies expired scripts and auth date discrepancies.
- **Josh Hoffman** — Engineering / Automation. Brief, action-oriented. Builds what's requested. Handles subscription updates, system changes, automation.
- **Michelle Coan** — Phone Support. Front-line call handling. Routes to team via Slack.
- **Christopher (Chris) Brown** — Deliveries / Store operations. Handles in-store pickups, local deliveries.
- **Connor Ross** — Mid-Island intake form testing (early team member).
- **Madeline Wichman** — Intern, started May 2026. Fought for retroactive auth for Gary Bariatti.
- **Vijaypal Singh, Haziq, Keith Castaldi, Joe** — Additional team/contractors.

### Team Routing (who handles what)
- Fax/script received → Masheke posts to #med-mod-onboarding
- Patient calling for status → Janelle handles, escalates to Brandon
- Insurance verification needed → Samantha
- Same-or-similar check → Brandon
- Subscription/system update → Josh
- In-store pickup/delivery → Christopher Brown
- Sell call / upsell opportunity → Corey
- Compliance question → Corey
- Phone coverage → Michelle

### Operational Pipeline (Slack-confirmed)
Step 1: Referral Receipt — Masheke receives fax, posts document with patient name, tags Janelle + Brandon
Step 2: Pipeline Triage — Janelle or Corey determines next steps
Step 3: Insurance/Auth — Samantha verifies benefits, Brandon checks same-or-similar clearance
Step 4: Fulfillment — Brandon handles shipping + order advancement, Josh updates subscriptions
Step 5: Patient Communication — Janelle fields calls, relays status, escalates urgent requests

### Decision Authority
- Insurance mechanics: Brandon is the authority. When he says "NOT CLEAR", everyone stops.
- Patient routing: Janelle initiates, Corey confirms or redirects.
- System changes: Josh executes, Brandon reviews downstream.
- Compliance: Corey is final word (CareCarentrix rules, OOP rules).
- Error correction: Brandon catches errors constructively, creates training content immediately.

## CRITICAL COMPLIANCE RULES (from Slack — MUST ENFORCE)

### CareCarentrix OOP Rule (CRITICAL)
- CareCarentrix patients must NEVER be told OOP costs
- Must direct them to CareCarentrix for any cost questions
- Julie and Tobey (CareCarentrix contacts) explicitly warned about penalties
- Elena must detect CareCarentrix + cost/price/OOP in same context and flag immediately

### Medicare Auth Exception
- Medicare does NOT require prior authorization for CGM or insulin pump
- If system shows "auth denied" for Medicare patient, it's a system error not a real denial

### Same-or-Similar Rule
- Must check same-or-similar clearance before ordering any DME
- Bill date determines clearance (e.g., bill date 3/5 = can't reorder until 6/5)
- Brandon has Noridian portal access and training video for this check

### Horizon BCBS Modifiers (via CareCarentrix)
- A4230: NU SC
- A4232: NU SC
- A4239: NU
- E2103: NU
- E0784: NU
- Must match EXACTLY — wrong modifiers = denied claim

### Subscription vs Onboarding
- Subscription patients should NOT be on the onboarding board
- Existing patients getting new auth or product changes stay in subscription flow

## KEY PARTNERS (from Slack)

### Mid-Island Pharmacy
- Primary script source (38 Slack mentions)
- Scripts arrive via fax, Masheke routes to team
- Covers broad patient base across Long Island

### CareCarentrix
- Major referral network (31 mentions)
- Sends referral PDFs via fax
- Auth approvals come through their portal
- STRICT OOP rules (see compliance section)
- Contacts: Julie, Tobey

### Naomi Berrie Diabetes Center (NYP)
- One of closest clinical relationships
- Coverage exceptions may apply for their patients
- Endocrinology focus

### Key Insurance Carriers
- Fidelis: Common Medicaid managed care plan. CHP and Essential Plan variants. Check member IDs carefully.
- Cigna/CIGNA DME: Channel available for patient coverage
- Horizon BCBS: Via CareCarentrix only. Exact modifiers required.
- Medicare: No auth required for CGM or pump. Use Noridian for same-or-similar checks.
- Anthem: Commercial patients may need sell calls for additional products.

## PATIENT-SPECIFIC INTELLIGENCE (from Slack threads)

### Patients with Special Notes
- **Philip Yorrie** — Has dementia. Handle with extra patience on status calls. Warehouse closed weekends/holidays.
- **Gary Bariatti** — Complex case: already serving CGM without auth, trying to add pump, doctor requires more medical records before pump. Retroactive auth obtained by Maddie.
- **Amy Appiah** — Medicare primary + secondary. Same-or-similar NOT CLEAR until 6/5/26. Training case for the team.
- **Jedidiah Jackson** — Subscription patient. Switched from Medicaid to Fidelis CHP. G7 added. Brother Jericho (Essential Plan, no CGM).
- **Naomi Mirny** — Changed from Libre 2 Plus to Libre 3 Plus. Flag product changes to Brandon.
- **William Brodsky** — Anthem commercial. Wanted supplies only, not CGM (getting from pharmacy). Escalated for sell call.
- **Daniel Walsh** — Caretaker/mom calls. Requested disposable and washable chucks added to order.

## ESCALATION SIGNALS (from Slack — expanded)
### Immediate escalation keywords:
"NOT CLEAR", "urgent", "denial", "denial notification", "escalating", "out of supplies",
"not on the board", "error", "incorrect", "out of pocket", "voicemails" (multiple),
"not able to order", "cannot mention", "in trouble"

### Escalation path:
Team member → Janelle → Brandon → Corey
(Corey only gets tagged for: sell calls, compliance, strategic decisions, patient retention)

## COREY'S COMMUNICATION PATTERNS (for Elena's response style)
- In burst mode (rapid one-liners): give him one-liner responses
- In planning mode (long structured messages): can handle detailed briefings
- When he says "turning phone off" or "out of pocket": queue items silently, don't push
- Always end with clear next action — never leave him wondering "so what do I do?"
- Match his energy: exclamation marks when celebrating, direct when delegating
- He uses humor to keep team loose ("Naomi berries sounds like a cereal brand")
- Frame problems as "here's what needs your superpowers" not negative alerts
`;

export default SLACK_KNOWLEDGE;
