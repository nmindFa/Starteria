# Triage Labels

The skills speak in terms of five canonical triage roles. This file maps those roles to the actual label strings used in this repo's issue tracker. All five labels exist in `nmindFa/Dashboardstarteria` (created during initial setup).

| Canonical role     | Label en nuestro tracker | Color  | Significado                                  |
| ------------------ | ------------------------ | ------ | -------------------------------------------- |
| `needs-triage`     | `needs-triage`           | yellow | Maintainer needs to evaluate this issue      |
| `needs-info`       | `needs-info`             | blue   | Waiting on reporter for more information     |
| `ready-for-agent`  | `ready-for-agent`        | green  | Fully specified, ready for an AFK agent      |
| `ready-for-human`  | `ready-for-human`        | purple | Requires human implementation                |
| `wontfix`          | `wontfix`                | white  | Will not be actioned (GitHub default label)  |

When a skill mentions a role (e.g. "apply the AFK-ready triage label"), use the corresponding label string from this table.

Edit the right-hand column to match whatever vocabulary you actually use. Si cambias un nombre acá, asegurate también de renombrar el label en GitHub: `gh label edit <old> --name <new> --repo nmindFa/Dashboardstarteria`.
