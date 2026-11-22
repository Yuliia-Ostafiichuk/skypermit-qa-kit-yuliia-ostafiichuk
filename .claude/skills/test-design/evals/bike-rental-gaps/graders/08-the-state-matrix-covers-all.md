---
type: llm
focus: trace
weight: 1
---

The state matrix covers all 4 states × all actions (unlock, timeout, return); legal cells are exactly RESERVED-unlock→ACTIVE, RESERVED-timeout→EXPIRED, ACTIVE-return→RETURNED; unlisted pairs from non-final states (e.g. ACTIVE-unlock, RESERVED-return) are unknown with a question in unknowns
