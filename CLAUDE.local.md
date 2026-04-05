# BHIL AI-First Development Toolkit — Claude Code Configuration

## Project identity
This is the BHIL AI-First Development Toolkit — a methodology repository for building AI-native applications. When used as a GitHub template, this file should be updated with the specific project's context.

**Current mode:** Methodology toolkit (meta-project)
**Stack:** Markdown, shell scripts, YAML, GitHub Actions
**Agent toolchain:** Claude Code primary, RuFlo orchestration, RuVector memory

---

## CRITICAL: Read this before writing anything

This is a **methodology repository**. Every file is a template, guide, or example. Do not write application code here. Do not modify template placeholders — fill them or leave them.

Before implementing any feature in a project derived from this toolkit:
1. Read the relevant guide (e.g., `BHIL-AI-First-Development-Toolkit/01-methodology-overview.md`)
2. Check whether an ADR exists (e.g., `BHIL-AI-First-Development-Toolkit/ADR-*.md`) for the decision area
3. Create the PRD slice → SPEC → ADR chain before writing code

---

## Repository structure (actual)

All BHIL toolkit files live flat in `BHIL-AI-First-Development-Toolkit/`:

```
BHIL-AI-First-Development-Toolkit/
├── README.md                        ← Toolkit overview
├── CLAUDE.md                        ← Claude Code config (toolkit-level)
├── AGENTS.md                        ← Cross-tool agent context
├── SKILL.md                         ← new-feature skill definition
│
├── Guides (NN-kebab-case.md)
│   ├── 00-getting-started.md
│   ├── 01-methodology-overview.md
│   ├── 03-sprint-workflow.md
│   ├── 04-context-management.md
│   ├── 05-ai-native-patterns.md
│   └── 07-ruflo-ruvector-setup.md
│
├── Templates (UPPERCASE-WITH-HYPHENS.md)
│   ├── PRD-TEMPLATE.md
│   ├── SPEC-TEMPLATE.md
│   ├── TASK-TEMPLATE.md
│   ├── SPRINT-PLAN-TEMPLATE.md
│   ├── EVAL-SUITE-TEMPLATE.yaml
│   ├── GUARDRAILS-SPEC-TEMPLATE.md
│   ├── PULL_REQUEST_TEMPLATE.md
│   └── PROMPT-REGISTRY.md
│
├── ADR Templates & Examples
│   ├── ADR-MODEL-SELECTION.md       ← Template: LLM model choice
│   ├── ADR-PROMPT-STRATEGY.md       ← Template: prompt engineering
│   ├── ADR-AGENT-ORCHESTRATION.md   ← Template: agent architecture
│   └── ADR-001-model-selection.md   ← Example: completed ADR
│
├── Examples
│   └── PRD-001-rag-chat.md          ← Example: completed PRD
│
├── Agent definitions
│   ├── code-reviewer.md
│   └── spec-writer.md
│
├── Rules
│   ├── ai-native-rules.md
│   ├── methodology-rules.md
│   └── architecture.md
│
├── Scripts
│   ├── init.sh                      ← Project initialization
│   ├── new-adr.sh                   ← Create sequentially numbered ADR
│   └── validate-artifacts.sh        ← Validate artifact frontmatter
│
├── CI/CD
│   ├── eval-suite.yml
│   └── validate-artifacts.yml
│
└── settings.json                    ← Claude Code hooks/permissions
```

---

## Commands

```bash
# Validate all artifact frontmatter
./BHIL-AI-First-Development-Toolkit/validate-artifacts.sh

# Initialize project from toolkit
./BHIL-AI-First-Development-Toolkit/init.sh "Project Name" "Stack" "Description"

# Create a sequentially numbered ADR
./BHIL-AI-First-Development-Toolkit/new-adr.sh "Decision title" "adr-type"
# adr-type: standard | model-selection | prompt-strategy | agent-orchestration
```

---

## Artifact format rules

### ALWAYS
- Include YAML frontmatter in every artifact file with `id`, `status`, `date`
- Use traceability IDs in the format specified in README.md
- Write acceptance criteria as probabilistic bands for AI-native features
- Reference parent artifacts in child frontmatter
- Create an ADR before making any model, prompt, or orchestration decision

### ASK before
- Adding a new template type not covered by existing categories
- Modifying the traceability ID format
- Changing the directory structure

### NEVER
- Remove frontmatter from any template or example file
- Write application code in this repository
- Create artifacts without traceability IDs
- Use vague acceptance criteria like "works correctly" — always quantify

---

## Skills available

Use these via natural language — Claude Code loads them on demand:

- **new-sprint** — Initialize a sprint: creates sprint plan, sets up artifact folders, prepares context files
- **new-feature** — Create a feature artifact scaffold: PRD slice + SPEC + task breakdown (see `SKILL.md`)
- **new-adr** — Create a properly formatted ADR with correct numbering and traceability

---

## File structure conventions

```
Template files:     UPPERCASE-WITH-HYPHENS.md
Example files:      TYPE-NNN-short-description.md  (e.g., PRD-001-rag-chat.md)
Guide files:        NN-kebab-case.md
Script files:       kebab-case.sh
Agent definitions:  kebab-case.md
```

---

## Context management for this project

When working on this toolkit, keep sessions focused on one module at a time:
- Guides: one guide per session
- Templates: one template family per session (e.g., all ADR templates together)
- Examples: full-chain example as a single coherent session

If context reaches 60%, compact with: `/compact "Preserve only the template structure and traceability conventions"`

*BHIL AI-First Development Toolkit — [barryhurd.com](https://barryhurd.com)*
