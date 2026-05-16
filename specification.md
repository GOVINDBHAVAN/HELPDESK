# Helpdesk System — Specification

Fill in your answers directly below each question. Leave blank if unknown/TBD.

---

## 1. Email Ingestion

**1.1** How do support emails arrive into the system?
- [*] Polling a mailbox (IMAP/POP3)
- [ ] Inbound webhook (e.g. SendGrid, Mailgun, Postmark)
- [ ] Email forwarding rule to a custom endpoint
- [ ] Other: ___

> Answer:

**1.2** Which email provider/service are you using?
> Answer: Gmail

**1.3** Should email attachments (PDFs, screenshots) be stored and viewable in the ticket detail?
> Answer: Yes

**1.4** What happens if the same student emails multiple times about the same issue — are they threaded into one ticket or created as separate tickets?
> Answer: Threaded into one ticket

**1.5** Should the system detect and ignore auto-replies, out-of-office responses, and spam?
> Answer: Yes

---

## 2. AI Behaviour

**2.1** When the AI generates a reply, is it:
- [ ] Sent automatically to the student with no human review
- [ ] Shown to the agent as a suggestion they can edit and then send
- [*] Both, depending on confidence score or ticket category

> Answer:

**2.2** Which AI provider will be used?
- [ ] OpenAI (GPT-4o, etc.)
- [*] Anthropic (Claude)
- [ ] Other: ___

> Answer:

**2.3** What does the knowledge base consist of?
- [ ] Static FAQ / markdown documents
- [ ] Structured database of articles
- [ ] Previous resolved tickets
- [*] All of the above

> Answer:

**2.4** Who is responsible for maintaining the knowledge base? Can agents add/edit articles from within the app?
> Answer: Yes

**2.5** Should agents be able to rate or correct AI-suggested replies so the system improves over time?
> Answer: Yes

**2.6** Should there be a confidence threshold below which the AI abstains and flags the ticket for manual handling?
> Answer: Yes

---

## 3. Ticket Classification & Routing

**3.1** List the ticket categories/labels you expect (e.g. billing, enrollment, technical, refund, general):
> Answer: billing, enrollment, technical, refund, general

**3.2** What priority levels should exist?
- [*] High / Medium / Low
- [ ] Urgent / Normal
- [ ] Custom: ___

> Answer:

**3.3** How should tickets be routed — assigned to a specific agent, a team/queue, or just tagged with a category?
> Answer: Category

**3.4** Should routing rules be configurable in the UI by admins, or hardcoded initially?
> Answer: Configurable in the UI by admins

**3.5** Should tickets be auto-assigned to agents based on workload (round-robin) or always manually assigned?
> Answer: Agents based on workload (round-robin)

---

## 4. Ticket Lifecycle & States

**4.1** What states should a ticket move through?
- [*] Open → In Progress → Resolved → Closed
- [ ] Open → Pending Student Reply → Resolved
- [ ] Custom: ___

> Answer: Open → In Progress → Resolved → Closed (And can be re-opened if already closed)

**4.2** Can a closed ticket be re-opened (e.g. if the student replies again)?
> Answer: Yes

**4.3** Should there be an SLA or response-time target per priority or category?
> Answer: Yes (varies by priority)

**4.4** What happens to tickets with no agent activity after X days — auto-close, escalate, or send a reminder?
> Answer: Escalate and send a reminder

---

## 5. Users & Roles

**5.1** What roles should exist in the system?
- [*] Admin
- [*] Agent
- [ ] Supervisor / Manager (view-only or reporting access)
- [ ] Other: ___

> Answer:

**5.2** Can students log in to view ticket status, or is this a purely internal tool?
> Answer: Students can view their ticket status

**5.3** Should agents only see tickets assigned to them, or all tickets?
> Answer: Can view all tickets of others but a default value should be self tickets

**5.4** How is authentication handled?
- [*] Email + password
- [*] Google / SSO
- [ ] Magic link
- [ ] Other: ___

> Answer:

---

## 6. Dashboard & Reporting

**6.1** What metrics should appear on the dashboard?
- [*] Open ticket count
- [*] Average first-response time
- [*] Resolution time
- [*] Tickets by category
- [*] Agent workload / ticket volume per agent
- [*] AI suggestion acceptance rate
- [ ] Other: ___

> Answer:

**6.2** Should reports be exportable (CSV, PDF)?
> Answer: Yes

**6.3** Should the dashboard be real-time (live updates) or refreshed on page load?
> Answer: Real-time

---

## 7. Notifications

**7.1** How should agents be notified of new or updated tickets?
- [*] In-app notification bell
- [*] Email notification
- [ ] Slack / Teams integration
- [ ] Other: ___

> Answer:

**7.2** Should students receive an automatic acknowledgement email when their ticket is created?
> Answer: Yes

**7.3** Should students be notified when their ticket is resolved or a reply is sent?
> Answer: Yes

---

## 8. Filtering, Search & Sorting

**8.1** What filters should be available on the ticket list?
- [*] Status
- [*] Category / Label
- [*] Priority
- [*] Assigned agent
- [*] Date range
- [ ] Other: ___

> Answer:

**8.2** Should full-text search across ticket subjects and bodies be supported?
> Answer: Yes

**8.3** Should filters/views be saveable per agent (e.g. "My open tickets")?
> Answer: Yes

---

## 9. Scale & Performance

**9.1** Approximate daily email volume today, and expected peak:
> Answer: 5

**9.2** How many agents will use the system concurrently?
> Answer: 3

**9.3** How long should ticket data be retained?
> Answer: Unlimited

---

## 10. Security & Compliance

**10.1** Are there data privacy or compliance requirements (GDPR, FERPA, HIPAA, etc.)?
> Answer: Yes (GDPR, FERPA, HIPAA)

**10.2** Should all student PII be masked or anonymised in AI prompts before sending to the AI provider?
> Answer: Yes

**10.3** Should there be an audit log of agent actions (who changed what, when)?
> Answer: Yes

---

## 11. Tech Stack (if already decided)

**11.1** Frontend: React
> Answer: React with typescript, Tailwind CSS, React Router

**11.2** Backend: ASP.NET Core
> Answer: ASP.NET Core, JWT for authentication, Entity Framwork core, Rest API.

**11.3** Database: Postgresql
> Answer: Postgresql

**11.4** Hosting / deployment target:
> Answer: Docker and cloud deployment later.

**11.5** Email:
> Answer: Gmail (personal account for testing) for outbound replies and inbound webhooks.

---

## 12. Out of Scope (confirm these are NOT in scope for v1)

- [ ] Native mobile app
- [ ] Live chat widget
- [ ] Phone / voice support
- [ ] Multi-language / i18n support
- [ ] Multi-tenant (serving multiple organisations)
- [ ] Billing or payment integrations
- [ ] Public-facing student portal

> Corrections / additions:

---

## 13. Open Questions / Risks

> Add any concerns, unknowns, or dependencies you want to flag before development starts:
