# Deviation log

Copy this into your port and keep it current.

Every real system violates something. The rules are not the goal; **knowing
which you broke is**. A deviation with a reason is a decision. A deviation
without one is an accident nobody has noticed yet — and most of the rules in
[`../../RULES.md`](../../RULES.md) exist because somebody could not tell the
difference.

## Three kinds, and they are not equally serious

| | Kind | Means |
| --- | --- | --- |
| **N/A** | Does not apply | Your platform makes the rule unviolatable, or makes the seam unnecessary |
| **SUB** | Substituted | You achieve the property another way |
| **DEV** | Deviated | You do not hold the property |

**N/A is not a free pass.** "Our tracker has no labels, so DSP-1 does not
apply" is wrong — the rule is about a settable attribute, not about labels.
A genuine N/A is *"our platform refuses the action outright, so nothing can
violate this."* If in doubt, it is a SUB or a DEV.

**Every DEV on a MUST rule needs a named owner and a date.** Not because the
date will be met, but because an undated deviation becomes permanent by
default.

---

## Log

### DEV-001 — *(example; replace)*

| | |
| --- | --- |
| **Rule** | DSP-2 — Trigger markers are consumed |
| **Seam** | S-A3 |
| **Kind** | SUB |
| **What we do** | Our tracker cannot clear one tag without rewriting the set. We read the current set, remove the trigger, and write it back in a single guarded update. |
| **Why** | The API offers no partial update. Read-modify-write is the only route. |
| **What it costs** | A race: two stages finishing together can lose one's marker write. Observed once in three months. |
| **How we contain it** | Concurrency key per item (S-A5) makes the race require two *different* stages on one item, which the dispatch order does not produce. |
| **How we would know it broke** | E4.4 fails, or a marker disappears with no stage having cleared it. |
| **Owner / date** | — |

---

### DEV-002 — *(example; replace)*

| | |
| --- | --- |
| **Rule** | GAT-1 — A new test must have failed against the pre-change code |
| **Seam** | S-H4 |
| **Kind** | DEV |
| **What we do** | Not implemented. |
| **Why** | Our suite cannot run against an overlay tree: the build embeds an absolute path resolved at compile time, so a tree in a temp directory does not build. |
| **What it costs** | Tests that assert already-true behaviour pass review. We have no automated way to catch it. |
| **How we contain it** | Nothing systematic. The review role's *Tests* section asks the question in prose, which CAP-1 says is not a control. |
| **How we would know it broke** | We would not. That is the deviation. |
| **Owner / date** | A. Engineer — revisit when the path is made relocatable (ticket PLAT-412) |

---

## Where to put these

**Two copies, and the second one matters more.**

1. **This file** — the complete list, so a newcomer can read what you decided.
2. **Next to the code**, as a comment citing the ID:

   ```
   # DEV-001 (DSP-2): read-modify-write, our API has no partial update.
   ```

The comment is what a person actually reads when they are touching that line
at 5pm. A deviation recorded only in a document nobody opens is a deviation
that gets "fixed" back into the code by someone who assumed it was an
oversight — or, worse, copied into the next component as though it were the
pattern.

## Reviewing the log

Re-read it whenever:

- **your platform gains a capability** — several N/A and SUB entries may
  become unnecessary, and a substitution you no longer need is pure carrying
  cost;
- **a rule's failure actually happens to you** — promote the deviation, and
  write what it cost in the *What it costs* row, replacing the estimate;
- **someone new joins** — the log is the fastest way to explain why your port
  looks the way it does, and it is the document that stops them "fixing" a
  deliberate choice.

## Deviations worth a second look

Some are more load-bearing than others. If any of these appear as **DEV**
rather than N/A or SUB, treat the log entry as a standing item rather than a
record:

| Rule | Why it matters more |
| --- | --- |
| **MRG-1** | The pipeline certifies its own work. No symptom |
| **CAP-1 / CAP-3** | Constraints become advisory; sessions fail indistinguishably from underperformance |
| **CTX-3** | Review silently becomes agreement with the author |
| **OUT-5** | The review stage becomes theatre |
| **DSP-7** | The failure mode is a bill |
| **SEC-5** | A prompt-injection surface with a credential behind it |

A DEV against **MRG-1** in particular should not sit in a log. It belongs in
whatever channel your team uses for things that are not acceptable to leave
alone — see
[level 0](../architecture/04-conformance.md#level-0--safe-to-run-at-all).
