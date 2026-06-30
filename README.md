# Multi-Source Candidate Data Transformer

A professional Node.js command-line application that ingests structured candidate data (CSV) and unstructured professional resumes (PDF), normalizes formats, merges records based on confidence policies, tracks data provenance, and applies runtime custom schemas.

Developed as a submission for the Eightfold Engineering Intern Assignment.

---

## Technical Architecture

The architecture consists of a modular pipeline written in modern JavaScript (ES Modules):

```
                       +-------------------------+
                       |       Input files       |
                       |  (CSV, PDF, config.json)|
                       +------------+------------+
                                    |
                                    v
                       +------------+------------+
                       |      Parsers Stage      |
                       |  (csvParser, pdfParser) |
                       +------------+------------+
                                    |
                                    v
                       +------------+------------+
                       |    Normalizers Stage    |
                       | (phone, email, date, etc|
                       +------------+------------+
                                    |
                                    v
                       +------------+------------+
                       |      Merger Stage       |
                       | (conflict-res, trust)   |
                       +------------+------------+
                                    |
                                    v
                       +------------+------------+
                       |     Validator Stage     |
                       | (schema enforce checks) |
                       +------------+------------+
                                    |
                                    v
                       +------------+------------+
                       |    Projection Layer     |
                       |  (config.json projection)|
                       +------------+------------+
                                    |
                                    v
                       +------------+------------+
                       |      Output files       |
                       |  (result.json, etc.)    |
                       +-------------------------+
```

### Folder Structure

```
├── BharathSrinivas_bsrin.dev@gmail.com_Eightfold.pdf  # Step-1 Design One-Pager
├── input/                                            # Ingest Directory
│   ├── candidate.csv                                 # Structured Recruiter Export
│   ├── resume.pdf                                    # Unstructured Candidate PDF Resume
│   └── config.json                                   # Custom Output Configuration Schema
├── output/                                           # Result Directory
│   ├── canonical_profile.json                        # Default Unified Output Schema
│   └── result.json                                   # Configured Custom Projected Output
├── scripts/                                          # Automation & Tooling
│   ├── generate_sample_inputs.js                     # Generates CSV, Config, and Resume PDF
│   └── generate_design_pdf.js                       # Compiles the Step-1 Design PDF
├── src/                                              # Application Source
│   ├── index.js                                      # Pipeline Orchestration & CLI
│   ├── parsers/                                      # Data extractors (CSV, PDF text)
│   ├── normalizers/                                  # Formatter scripts (E.164, YYYY-MM)
│   ├── merger/                                       # Trust-weighted conflict resolver
│   ├── validator/                                    # Strict schema verification
│   └── projection/                                   # Dynamic config layout projector
└── tests/                                            # Jest Unit Tests
```

---

## Setup & Installation

### Prerequisites
- **Node.js**: `v18.0.0` or higher (tested on Node `v24.15.0`)
- **NPM**: `v9.0.0` or higher

### Installation
1. Clone or download the repository contents into your local workspace.
2. In the workspace root directory, install dependencies:
   ```bash
   npm install
   ```

*Note: On Windows systems running PowerShell, if script execution is disabled, you can run commands directly using the `.cmd` wrapper or bypass the policy using `Powershell -ExecutionPolicy Bypass`.*

---

## How to Run

Follow these simple steps to run the pipeline end-to-end:

### Step 1: Generate Mock Ingest Files
Generate sample inputs including `input/candidate.csv`, `input/config.json`, and a professional mock resume `input/resume.pdf` (built using `pdfkit`):
```bash
npm run generate-inputs
```

### Step 2: Run the Transformer Pipeline
Execute the CLI script to run the parsing, merging, and projection pipeline:
```bash
npm start
```
The program will print pipeline steps directly to console and save results:
- **Default/Canonical Schema**: Output saved to `output/canonical_profile.json`.
- **Custom Config Projection**: Output saved to `output/result.json` shaped according to `config.json`.

---

## Running Unit Tests

We use **Jest** for automated unit testing. Run the tests using:
```bash
npm test
```
The test suite validates:
- E.164 phone formatting and YYYY-MM date parsing.
- Email sanitization and canonical skill mapping.
- Core candidate merging, conflict resolution weights, and confidence evaluations.
- Runtime JSON field mapping and missing field constraint actions (null, omit, error).

---

## Key Design Decisions & Assumptions

1. **Deterministic Processing**: The merge rules are completely deterministic. Single values (like Names) are selected using a strict source confidence weight: CSV structured data has confidence `0.95`, while unstructured resume heuristics have `0.80`.
2. **Local Resume Extraction**: Text extraction is handled locally using `pdf-parse`, followed by a heuristic line-by-line parser and regular expression analyzer. This ensures no network API dependency, high speed, and zero external costs.
3. **Flexible Projection Layer**: The projection layer supports deep dot-path lookup (`location.city`), indexed array retrieval (`emails[0]`), and list projections (`skills[].name`) dynamically using regex paths without code modifications.
4. **Skills Confidence Scoring**: Skill confidence is set at `0.90` if found in the dedicated skills block. The merger scans experience summaries for references to those skills; matching skills get a `+0.05` confidence boost (capped at `0.99`).
5. **Graceful Degraded States**: Malformed input documents or missing elements fail silently. If standard headers or section demarcations are missing in resumes, the pipeline performs a default global text scan.
