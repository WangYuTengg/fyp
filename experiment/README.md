# UML Grading LLM Benchmark Experiment

Formal experiment to determine the optimal LLM for auto-grading UML class diagrams in an educational assessment platform.

## Research Questions

1. **RQ1**: Which LLM achieves the highest grading accuracy compared to human expert grades?
2. **RQ2**: What is the cost-performance tradeoff between commercial APIs and local open-source models?
3. **RQ3**: How consistent (reliable) are LLM grades across multiple runs on the same submission?
4. **RQ4**: Which model provides the most useful qualitative feedback?

## Setup

```bash
cd experiment
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# Copy and fill in API keys
cp .env.example .env
```

## Quick Start

```bash
# Generate the dataset (McGill real data + synthetic)
python run.py generate

# Run a quick test (1 run, specific models)
python run.py benchmark --models gpt-4o-mini claude-haiku-3.5 --runs 1

# Run the full experiment (all models, 5 runs each)
python run.py benchmark

# Analyze results
python run.py analyze

# Or run everything end-to-end
python run.py all
```

## Models Tested

| Model | Provider | Input $/1M | Output $/1M |
|-------|----------|-----------|-------------|
| GPT-4o | OpenAI | $2.50 | $10.00 |
| GPT-4o-mini | OpenAI | $0.15 | $0.60 |
| GPT-4.1-mini | OpenAI | $0.40 | $1.60 |
| GPT-4.1-nano | OpenAI | $0.10 | $0.40 |
| o4-mini | OpenAI | $1.10 | $4.40 |
| Claude Sonnet 4 | Anthropic | $3.00 | $15.00 |
| Claude 3.5 Haiku | Anthropic | $0.80 | $4.00 |
| Gemini 2.5 Pro | Google | $1.25 | $10.00 |
| Gemini 2.5 Flash | Google | $0.15 | $0.60 |
| Gemini 2.0 Flash | Google | $0.10 | $0.40 |

## Evaluation Criteria

| Criterion | Weight | Metric |
|-----------|--------|--------|
| Accuracy | 30% | Pearson correlation + MAE vs ground truth |
| Consistency | 20% | Std deviation across 5 repeated runs |
| Cost | 15% | USD per submission |
| Feedback Quality | 15% | Parse success rate + structured output |
| Speed | 10% | Latency in seconds |
| Rubric Adherence | 10% | % of rubric criteria addressed |

## Dataset

**32 submissions** (2 real + 30 synthetic) across 5 domains.

### Real Data: McGill uml-grader (MODELS 2020)

2 publicly available student submissions from [YounesB-McGill/uml-grader](https://github.com/YounesB-McGill/uml-grader):

| ID | Domain | Format | Grade | Notes |
|----|--------|--------|-------|-------|
| mcgill_a2_12 | Fantasy Basketball | Umple | 7.5/10 | Missing Team, VirtualStatistics classes |
| mcgill_fe_6 | Smart Home Automation | Umple | 7.0/10 | Complex 18-class domain, architectural differences |

These include the original marking schemes, ideal solutions, and human grader feedback.

### Synthetic Data: 30 Crafted Submissions

Created by systematically introducing errors into reference solutions at 5 severity levels:

| Quality Tier | Grade Range | Error Types | Count |
|-------------|-------------|-------------|-------|
| Excellent | 8.5–10.0 | None or minor (abbreviated names, optional cardinality) | 6 |
| Good | 6.5–8.4 | 1-2 missing classes, partial cardinality, abbreviated methods | 6 |
| Average | 4.5–6.4 | Missing multiple classes, no cardinality, wrong relationships | 6 |
| Poor | 2.5–4.4 | Very incomplete, bad naming, wrong domain understanding | 6 |
| Failing | 0–2.4 | Barely attempted, single class, no relationships | 6 |

Across 3 domains:
- **Library Management System** (10 submissions) — Books, Members, Loans, Librarians
- **E-Commerce Platform** (10 submissions) — Customers, Orders, Products, Payments
- **Hospital Management** (10 submissions) — Doctors, Patients, Appointments, Records

Ground truth grades assigned on a 10-point scale (5 criteria × 2 points each):
1. Class correctness (0–2)
2. Relationship accuracy (0–2)
3. Cardinality (0–2)
4. Naming conventions (0–2)
5. Completeness (0–2)

### Why No Existing Benchmark Dataset?

No standardized public benchmark exists for rubric-based UML grading — this is an identified research gap (noted in CSEDU 2025, Ibanez et al. 2025). All existing datasets are private:

| Dataset | Has Human Grades? | Public? | Issue |
|---------|------------------|---------|-------|
| Stikkolorum (BNAIC 2019) | Yes (3 experts, 99 subs) | No | Must contact Leiden University |
| McGill uml-grader | Yes (CSV grades) | 2 samples only | Ethics restrictions |
| CSEDU 2025 (U. Twente) | Yes (3 TAs, 92 subs) | No | Not released |
| Ibanez et al. 2025 | Yes (3 experts, 34 subs) | No | Not released |
| NilsBaumgartner (GitHub) | No grades | Yes (104K models) | No quality ratings |

### Known Limitations

- Synthetic submissions may not capture the full diversity of real student errors
- Ground truth grades are from a single grader (no inter-rater reliability measurement)
- Only 2 real submissions with human grades are publicly available
- Umple format (McGill) differs from PlantUML format (synthetic) — may affect comparability

## Output

- `results/` — Raw JSON results per model and combined
- `analysis/model_metrics.csv` — Aggregate metrics per model
- `analysis/criterion_analysis.csv` — Per-rubric-criterion accuracy
- `analysis/figures/` — Visualizations:
  - `radar_chart.png` — Multi-dimensional model comparison
  - `grade_correlation.png` — Predicted vs ground truth scatter plots
  - `cost_vs_accuracy.png` — Pareto frontier
  - `consistency_boxplot.png` — Grade variance across repeated runs
  - `latency_comparison.png` — Response time comparison
  - `criterion_heatmap.png` — Per-criterion MAE heatmap

## Project Structure

```
experiment/
├── run.py                       # CLI: generate / benchmark / analyze / all
├── config.yaml                  # Models, rubric, experiment params
├── requirements.txt             # Python dependencies
├── data/
│   ├── synthetic/
│   │   ├── generate_dataset.py  # Dataset generator (real + synthetic)
│   │   └── dataset.json         # Generated: 32 submissions
│   ├── mcgill-uml-grader/       # Cloned McGill repo (real data)
│   └── rubrics/                 # Reference solutions + specifications
├── prompts/
│   └── grading_prompt.py        # Standardized prompt with few-shot examples
├── src/
│   ├── providers.py             # OpenAI, Anthropic, Google, Ollama abstraction
│   ├── runner.py                # Experiment orchestration with retries
│   └── analyze.py               # Statistical analysis + 6 visualization types
├── results/                     # Raw experiment outputs (git-ignored)
└── analysis/                    # Generated reports + figures
```
