# PortfolioPulse — Full Page & Role Design Specification

## 1. Design principles

1. One page type, three jobs. Every domain gets the same pattern of management/data-entry, dashboard, and report pages.
2. Every page declares its lifecycle phase so navigation and roadmap stay aligned.
3. RBAC is expressed as Full / Edit-own / View / None per page rather than by module.
4. Status changes and documents are captured inline with the work item so audit trails stay consistent.

## 2. Master page inventory

| ID | Type | Lifecycle | Domain | Purpose |
| --- | --- | --- | --- | --- |
| P01 | DE | Initiating | Admin | Create org, division, and department hierarchy |
| P02 | DE | Initiating | Project | Create or edit a project through a five-step wizard |
| P03 | DB | All phases | Project | Portfolio scorecard with RAG sorting and filters |
| P04 | DB | All phases | Project | Single-project master detail with health and linked artifacts |
| P05 | DE | Planning | Project | Baseline and rebaseline submission with approval context |
| P06–P08 | DE | Planning | Planning Cascade | Quarter, month, and week planning builders |
| P09 | DE | Executing | Planning Cascade | Daily task board and workflow transitions |
| P10 | DE | Executing | Planning Cascade | Mark task incomplete with reason code and notes |
| P11 | DB/DE | Planning / Executing | Schedule | Gantt-style schedule management and variance tracking |
| P12 | DE | Executing | Finance | Periodic AC + progress entry with live EVM preview |
| P13 | DE | Executing | Finance | Budget line item management |
| P14 | DE | Executing | Finance | Contingency and reserve management |
| P15 | DB | Executing / Monitoring | Finance | Financial dashboard with EVM and budget utilization |
| P16 | DB | Monitoring | Finance | EVM KPI and formula reference |
| P17 | DE | Executing | Procurement | Vendor directory and onboarding |
| P18 | DE | Executing | Procurement | Procurement package management |
| P19 | DE/DB | Executing | Procurement | Contract milestone and delivery tracking |
| P20 | DE | Executing / Monitoring | Procurement | Contractor evaluation entry |
| P21 | DB | Executing | Procurement | Procurement dashboard |
| P22 | DE | Monitoring & Controlling | Risk | Risk register entry and mitigation planning |
| P23 | DB | Monitoring & Controlling | Risk | Risk heat map |
| P24 | DB | Monitoring & Controlling | Risk | Portfolio risk exposure aggregation |
| P25 | DE | Monitoring & Controlling | Governance | Submit a decision request |
| P26 | DB | Monitoring & Controlling | Governance | My requests tracker |
| P27 | DE/DB | Monitoring & Controlling | Governance | Executive approval center |
| P28 | DB | Monitoring & Controlling | Governance | Board decision register |
| P29 | DE | Monitoring & Controlling | Governance | Board voting and resolution page |
| P30 | DE | All phases | Documents | Document repository with versioning and links |
| P31 | DB/RP | All phases | Compliance | Live audit trail |
| P32 | DB | All phases | Cross-cutting | Notifications center |
| P33 | DE | All phases | Admin | Reason code administration |
| P34 | DE | All phases | Admin | Custom field administration |
| P35 | DE/DB | Closing / Stage-gates | Evaluation | Project evaluation and scoring |
| P36 | DB | All phases | Executive | CEO dashboard |
| P37 | DB | All phases | Insight | AI executive advisor |
| P38–P43 | RP | All phases | Reporting | Executive, project, financial, risk, resource, and vendor reports |
| P44 | DE | All phases | Reporting | Scheduled reports administration |

## 3. Role access model

The access model follows Full, Edit-own, View, and None per page. The primary roles are:

- CEO / Executive Sponsor: decision and governance oriented, no raw daily task entry.
- Portfolio / Program Manager: cross-project oversight and strategy review.
- Project Manager: operational owner of plans, financial entry, risks, documents, and escalations.
- Financial Controller: financial validation and reserve management.
- Procurement / Contracts Lead: vendor and contract oversight.
- Board Member: governance review and voting.
- Team Member: execution-only access to assigned work and own documents.

## 4. Landing experience and lifecycle journey

- CEO: P36 → P27 → P28/P29 → P37 → report export.
- Portfolio Manager: P03 → P04 → P11/P21/P23/P24 → P44.
- Project Manager: P02 → P06–P09 → P12 → P22 → P25/P26 → P30.
- Financial Controller: P15 → P12 → P13/P14 → P05 → P40.
- Procurement Lead: P21 → P17 → P18 → P19 → P20 → P43.
- Board Member: P28 → P29 → P31 → P38.
- Team Member: P09 → P10 → P30 → P22.

## 5. Page design pattern

- Data-entry pages group fields by logical sections and show computed previews before submission.
- Dashboards follow KPI strip → trend ribbon → widget grid → detail table.
- Report pages share the same underlying views as dashboards so export and live data remain consistent.
- Status changes and document attachments appear inline on the owning entity.
