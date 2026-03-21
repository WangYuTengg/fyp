# 5 Experiment — LLM Model Evaluation for UML Diagram Grading

## 5.1 Motivation and Research Questions

The assessment platform described in this report supports configurable LLM providers, enabling institutions to select from models offered by OpenAI, Anthropic, and Google. While this flexibility is architecturally desirable, it introduces a non-trivial practical question: which model should an institution actually use? The choice carries real consequences. A model that assigns grades inconsistent with human judgment undermines student trust and defeats the purpose of automated assessment. A model that costs too much per submission may be financially unsustainable at scale. A model that frequently fails to produce structured output requires costly fallback handling.

Prior work demonstrates that LLM grading capability varies significantly across model families and sizes. Ibanez et al. (2025), whose work is reviewed in Section 2.2.3, evaluated LLMs for automated UML grading using Intraclass Correlation Coefficient (ICC) as their primary metric, reporting ICC values ranging from 0.76 for Claude Sonnet to lower values for smaller models. However, their study did not evaluate Google Gemini models, did not consider cost as a variable, and did not systematically measure output consistency across repeated runs. This experiment addresses those gaps by conducting a controlled multi-model evaluation across ten models from three providers, using a common rubric, a shared dataset of 32 UML class diagram submissions, and a composite scoring framework that balances accuracy, cost, consistency, and feedback quality.

The experiment is motivated by four research questions:

**RQ1:** Which LLM achieves the highest grading accuracy for UML class diagrams, as measured by Pearson correlation coefficient and Mean Absolute Error (MAE) against a human-graded ground truth?

**RQ2:** What is the cost-performance trade-off across models, as measured by USD cost per submission?

**RQ3:** How consistent are LLM-assigned grades across repeated runs of the same submission, as measured by standard deviation across five independent runs?

**RQ4:** Which model provides the most useful structured feedback, as measured by JSON parse success rate and structured output completeness?

Together, these questions aim to produce an actionable recommendation: a ranked comparison of models that allows an institution to select the most appropriate model given its budget, accuracy requirements, and operational constraints.

---

## 5.2 Methodology

### 5.2.1 Models Under Evaluation

Ten models across three providers were selected to span a broad range of capability and cost tiers. Table 5.1 lists the models and their general positioning.

**Table 5.1: Models included in the evaluation**

| Provider | Model | Tier |
|----------|-------|------|
| OpenAI | GPT-4o | Flagship |
| OpenAI | GPT-4o-mini | Mid-range |
| OpenAI | GPT-4.1-mini | Mid-range |
| OpenAI | GPT-4.1-nano | Lightweight |
| OpenAI | o4-mini | Reasoning-optimised |
| Anthropic | Claude Sonnet 4 | Flagship |
| Anthropic | Claude 3.5 Haiku | Mid-range |
| Google | Gemini 2.5 Pro | Flagship |
| Google | Gemini 2.5 Flash | Mid-range |
| Google | Gemini 2.0 Flash | Mid-range |

Model selection was guided by three criteria: (1) multimodal capability, as UML grading requires processing diagram images via vision APIs; (2) support for structured JSON output, since the platform's grading pipeline depends on a well-formed Zod-validated response; and (3) commercial availability at the time of writing, ensuring the results are directly applicable to institutional procurement decisions.

### 5.2.2 Experimental Protocol

Each model grades all 32 submissions in the dataset, producing a structured response for each. To measure consistency (RQ3), this process is repeated five times per model per submission, yielding a total of 10 × 32 × 5 = 1,600 individual API calls.

The following controls are applied uniformly across all models:

**Prompt template.** All models receive an identical prompt derived from the platform's production v2 strict grading prompt. The prompt presents the UML diagram image alongside the assignment rubric and instructs the model to score each of five criteria independently before computing a total score. No model-specific prompt engineering is applied, so as to measure baseline performance under a common instruction set.

**Temperature.** Temperature is set to 0 where supported by the provider's API. For models that do not expose a temperature parameter (notably reasoning-optimised models such as o4-mini), the provider's default deterministic or low-variance mode is used. The effect of this limitation on RQ3 results is discussed in Section 5.6.

**Timeout.** A 60-second per-call timeout is enforced, matching the platform's production configuration. Calls that exceed this threshold are recorded as failures and excluded from accuracy and feedback quality calculations but counted against the model's reliability score.

**Structured output schema.** All models are required to return a JSON object conforming to the following Zod schema:

```
{
  totalPoints: number,           // 0–10
  reasoning: string,             // overall justification
  confidence: number,            // 0–100
  criteriaScores: {
    classIdentification: number, // 0–2
    attributeCompleteness: number,
    methodSignatures: number,
    relationships: number,
    designPrinciples: number
  }
}
```

Models that support native structured output (OpenAI's `response_format: { type: "json_schema" }` and Anthropic's tool-use mode) are configured accordingly. For models where native enforcement is unavailable, the response is parsed from the model's text output using a JSON extraction utility; failures are recorded.

**Latency measurement.** Wall-clock time for each API call is recorded in milliseconds. This captures end-to-end latency including network round-trip and model inference time, but excluding image encoding overhead.

### 5.2.3 Composite Scoring Framework

Raw metrics across the four research questions are combined into a single composite score using the following weights, which reflect the relative importance of each dimension for a production grading system:

| Dimension | Weight |
|-----------|--------|
| Accuracy (Pearson r + MAE) | 30% |
| Consistency (std deviation) | 20% |
| Cost (USD per submission) | 15% |
| Feedback quality (parse rate + completeness) | 15% |
| Speed (median latency) | 10% |
| Rubric adherence (per-criterion coverage) | 10% |

Each raw metric is min-max normalised within the model set before weighting, so that no single metric's scale dominates the composite. For cost and latency, lower values receive higher normalised scores; for accuracy and feedback quality, higher values receive higher normalised scores.

---

## 5.3 Dataset

### 5.3.1 Composition

The evaluation dataset comprises 32 UML class diagram submissions. Two submissions are drawn from the McGill uml-grader repository (Denny et al., as referenced in related work), providing a small anchor of real student work. The remaining 30 submissions are synthetic, generated to achieve controlled variation across known quality tiers and domain contexts.

The 30 synthetic submissions are distributed across five quality tiers and three domain contexts, as shown in Table 5.2.

**Table 5.2: Synthetic submission distribution**

| Tier | Description | Count per domain | Total |
|------|-------------|-----------------|-------|
| T1 | Near-perfect (9–10/10) | 2 | 6 |
| T2 | Minor errors (7–8/10) | 2 | 6 |
| T3 | Moderate errors (5–6/10) | 2 | 6 |
| T4 | Significant errors (3–4/10) | 2 | 6 |
| T5 | Poor / incomplete (0–2/10) | 2 | 6 |

**Domains:** Library management system, e-commerce platform, hospital patient record system.

Synthetic diagrams were constructed by first producing a reference solution for each domain and then systematically introducing errors corresponding to each tier — for example, omitting multiplicities from associations (T2), removing return types from methods (T3), misclassifying inheritance as association (T4), or providing only a single class with no relationships (T5). Each diagram was rendered as a PNG image to match the format expected by vision-capable APIs.

### 5.3.2 Ground Truth

All 32 submissions were graded against a five-criterion rubric, with each criterion scored on a 0–2 integer scale, yielding a maximum total score of 10 points. The five criteria are:

1. **Class identification and naming** — correct identification of domain entities, appropriate naming conventions, appropriate use of abstract classes and interfaces.
2. **Attribute completeness and types** — presence of all required attributes, correct data types, appropriate visibility modifiers.
3. **Method signatures** — correct method names, parameter lists, return types, and visibility.
4. **Relationships and multiplicities** — correct modelling of associations, aggregations, compositions, inheritances, and their multiplicity annotations.
5. **Design principles** — evidence of encapsulation, appropriate cohesion, and avoidance of common anti-patterns.

Ground truth scores were assigned by a single grader (the author) using a detailed marking guide produced prior to dataset construction, to reduce post-hoc rationalisation. The marking guide specifies, for each criterion and each domain, which elements must be present for each point level.

### 5.3.3 Limitations of the Dataset

Several limitations of this dataset must be acknowledged. First, the dataset is small: 32 submissions are sufficient to demonstrate proof-of-concept findings but insufficient to establish statistically robust conclusions. Second, 30 of 32 submissions are synthetic, which may not capture the full distribution of errors produced by real students — in particular, the creative and idiosyncratic misunderstandings that characterise genuine novice work. Third, ground truth is provided by a single grader, with no inter-rater reliability measurement; the degree to which these scores reflect a stable consensus judgment is unknown. Fourth, the dataset covers only UML class diagrams; sequence, activity, and use-case diagrams are not included, limiting the generalisability of findings to class diagram grading specifically. These limitations are further discussed in Section 5.6.

---

## 5.4 Results [PLACEHOLDER]

*Note: All numerical results presented in this section are projected estimates based on related studies, in particular Ibanez et al. (2025), and on the characteristics of the models as reported in their respective technical documentation. These values are clearly marked [PLACEHOLDER] and will be replaced with actual experimental data prior to final submission.*

### 5.4.1 RQ1 — Grading Accuracy

Table 5.3 presents the Pearson correlation coefficient (r), Mean Absolute Error (MAE), and Root Mean Squared Error (RMSE) for each model against the human ground truth, computed across all 32 submissions using the mean grade from the five repeated runs.

**Table 5.3: Grading accuracy metrics [PLACEHOLDER]**

| Model | Pearson r | MAE | RMSE |
|-------|-----------|-----|------|
| Claude Sonnet 4 | 0.85 | 0.87 | 1.15 |
| GPT-4o | 0.82 | 0.94 | 1.21 |
| Gemini 2.5 Pro | 0.79 | 1.02 | 1.34 |
| o4-mini | 0.78 | 1.08 | 1.40 |
| GPT-4.1-mini | 0.74 | 1.22 | 1.55 |
| Gemini 2.5 Flash | 0.73 | 1.28 | 1.58 |
| GPT-4o-mini | 0.71 | 1.35 | 1.68 |
| Gemini 2.0 Flash | 0.70 | 1.38 | 1.72 |
| Claude 3.5 Haiku | 0.68 | 1.42 | 1.75 |
| GPT-4.1-nano | 0.62 | 1.65 | 2.01 |

[PLACEHOLDER — The top two models, Claude Sonnet 4 and GPT-4o, achieve Pearson correlations exceeding 0.80, placing them in the range of "good" agreement with human judgment. This is broadly consistent with Ibanez et al. (2025), who reported ICC = 0.76 for Claude Sonnet in a comparable UML grading task. The reasoning-optimised model o4-mini performs respectably (r = 0.78) despite its smaller parameter count, suggesting that chain-of-thought reasoning may partially compensate for reduced model capacity in structured assessment tasks. GPT-4.1-nano performs worst across all accuracy metrics, indicating that the most aggressively compressed models are not suitable for nuanced rubric-based grading.]

A grade-correlation scatter plot (visualisation type 1) will display model-assigned scores on the x-axis against human scores on the y-axis for each model, with a diagonal reference line representing perfect agreement. Per-criterion MAE is presented as a heatmap (visualisation type 6) with models on one axis and criteria on the other, revealing which rubric dimensions are consistently most difficult for automated assessment.

### 5.4.2 RQ2 — Cost per Submission

Table 5.4 reports the mean estimated cost in USD per submission, computed from each provider's published token pricing and the observed mean input and output token counts across the 32 submissions.

**Table 5.4: Cost per submission [PLACEHOLDER]**

| Model | Input tokens (mean) | Output tokens (mean) | Cost per submission (USD) |
|-------|--------------------|--------------------|--------------------------|
| Gemini 2.5 Pro | ~2,800 | ~420 | $0.078 |
| GPT-4o | ~2,600 | ~390 | $0.071 |
| Claude Sonnet 4 | ~2,650 | ~410 | $0.065 |
| o4-mini | ~2,500 | ~480 | $0.021 |
| Gemini 2.5 Flash | ~2,700 | ~390 | $0.012 |
| GPT-4o-mini | ~2,550 | ~370 | $0.009 |
| Claude 3.5 Haiku | ~2,600 | ~380 | $0.008 |
| GPT-4.1-mini | ~2,500 | ~360 | $0.006 |
| Gemini 2.0 Flash | ~2,650 | ~370 | $0.004 |
| GPT-4.1-nano | ~2,450 | ~340 | $0.001 |

[PLACEHOLDER — The cost-accuracy relationship is visualised as a Pareto frontier plot (visualisation type 3), with cost per submission on the x-axis and Pearson r on the y-axis. Models on the Pareto frontier — those for which no other model achieves both higher accuracy and lower cost simultaneously — represent the set of optimal choices under different institutional budget constraints. Projected Pareto-efficient models are Claude Sonnet 4, o4-mini, Gemini 2.5 Flash, GPT-4.1-mini, and GPT-4.1-nano, representing a spectrum from high-accuracy/high-cost to low-accuracy/low-cost.]

### 5.4.3 RQ3 — Grade Consistency

Table 5.5 reports the mean standard deviation of total scores across five repeated runs for each model, averaged over all 32 submissions. A lower standard deviation indicates more deterministic grading behaviour.

**Table 5.5: Consistency across five runs (std deviation of total score) [PLACEHOLDER]**

| Model | Mean std dev | Min std dev | Max std dev |
|-------|-------------|-------------|-------------|
| GPT-4o | 0.18 | 0.00 | 0.45 |
| Claude Sonnet 4 | 0.21 | 0.00 | 0.52 |
| GPT-4o-mini | 0.28 | 0.00 | 0.61 |
| GPT-4.1-mini | 0.31 | 0.00 | 0.68 |
| o4-mini | 0.35 | 0.00 | 0.72 |
| Gemini 2.5 Pro | 0.38 | 0.00 | 0.79 |
| Gemini 2.5 Flash | 0.42 | 0.00 | 0.83 |
| Claude 3.5 Haiku | 0.48 | 0.00 | 0.91 |
| Gemini 2.0 Flash | 0.55 | 0.00 | 1.02 |
| GPT-4.1-nano | 0.82 | 0.00 | 1.65 |

[PLACEHOLDER — Consistency results are visualised as a boxplot (visualisation type 4) showing the distribution of per-submission standard deviations for each model. GPT-4o achieves the lowest mean standard deviation (0.18 points), suggesting that temperature=0 is most effective for this model family. The higher variance observed for Gemini models may reflect differences in how these providers interpret the temperature parameter when processing multimodal inputs. GPT-4.1-nano's mean standard deviation of 0.82 points — representing nearly a full grade point of variability across runs — raises serious concerns about its suitability for a fair assessment context.]

### 5.4.4 RQ4 — Structured Feedback Quality

Table 5.6 reports parse success rate (the proportion of calls that returned a valid, schema-conformant JSON object) and structured output completeness (the proportion of required fields that were populated with non-null, in-range values, conditional on a successful parse).

**Table 5.6: Feedback quality metrics [PLACEHOLDER]**

| Model | Parse success rate | Output completeness | Median confidence score |
|-------|-------------------|---------------------|------------------------|
| GPT-4o | 100% | 98.4% | 81 |
| Claude Sonnet 4 | 100% | 97.9% | 79 |
| o4-mini | 99.4% | 96.1% | 77 |
| GPT-4o-mini | 99.1% | 95.3% | 74 |
| GPT-4.1-mini | 98.8% | 94.7% | 72 |
| Gemini 2.5 Pro | 97.5% | 93.8% | 76 |
| Claude 3.5 Haiku | 96.9% | 92.4% | 70 |
| Gemini 2.5 Flash | 95.6% | 91.2% | 68 |
| Gemini 2.0 Flash | 94.4% | 89.7% | 65 |
| GPT-4.1-nano | 91.3% | 85.6% | 61 |

[PLACEHOLDER — Parse success rates are high across all models when native structured output enforcement is enabled, confirming that the platform's use of provider-specific structured output APIs is effective. The lower rates for Gemini models reflect the current state of that provider's structured output API, which at the time of writing imposes stricter constraints on schema complexity for multimodal inputs. All parse failures were handled gracefully by the platform's fallback JSON extraction utility, though the recovered outputs were excluded from completeness calculations due to potential truncation.]

### 5.4.5 Composite Scores [PLACEHOLDER]

Table 5.7 presents the weighted composite score for each model. Scores are expressed on a 0–100 scale after normalisation and weighting.

**Table 5.7: Composite scores [PLACEHOLDER]**

| Rank | Model | Composite Score | Accuracy | Consistency | Cost | Feedback | Speed | Rubric |
|------|-------|----------------|----------|-------------|------|----------|-------|--------|
| 1 | Claude Sonnet 4 | 74.2 | 28.1 | 17.4 | 8.2 | 14.3 | 3.8 | 8.4 |
| 2 | GPT-4o | 71.8 | 26.4 | 18.9 | 7.1 | 14.9 | 3.1 | 8.3 |
| 3 | o4-mini | 67.3 | 24.9 | 15.8 | 11.4 | 13.7 | 4.2 | 7.9 |
| 4 | Gemini 2.5 Flash | 61.4 | 22.1 | 14.2 | 12.8 | 12.6 | 6.4 | 7.3 |
| 5 | GPT-4.1-mini | 59.7 | 22.8 | 14.8 | 13.1 | 12.9 | 5.9 | 7.2 |
| 6 | GPT-4o-mini | 58.9 | 21.6 | 16.3 | 12.5 | 13.4 | 5.2 | 7.0 |
| 7 | Gemini 2.5 Pro | 57.1 | 24.2 | 13.1 | 5.8 | 13.1 | 3.5 | 7.9 |
| 8 | Gemini 2.0 Flash | 54.8 | 21.0 | 12.7 | 13.9 | 12.1 | 7.8 | 6.8 |
| 9 | Claude 3.5 Haiku | 53.2 | 19.8 | 12.1 | 13.3 | 12.3 | 5.1 | 6.5 |
| 10 | GPT-4.1-nano | 41.6 | 16.5 | 6.8 | 14.7 | 10.8 | 8.1 | 5.6 |

[PLACEHOLDER — A radar chart (visualisation type 1) will display the six-dimension composite profile for each model, enabling visual comparison of their respective strengths and weaknesses. A latency comparison chart (visualisation type 5) will display median and 95th-percentile response times per model, presented as a horizontal bar chart ordered by median latency.]

---

## 5.5 Discussion

### 5.5.1 Accuracy and the Role of Model Scale

[PLACEHOLDER] The projected accuracy results suggest a general positive relationship between model scale and grading fidelity, consistent with findings in the broader LLM evaluation literature. Flagship models — Claude Sonnet 4, GPT-4o, and Gemini 2.5 Pro — cluster at the top of the accuracy rankings, while lightweight models such as GPT-4.1-nano and Claude 3.5 Haiku perform substantially worse. This is consistent with the intuition that UML grading requires sustained multi-step reasoning: the model must identify each diagram element, map it to the relevant rubric criterion, and apply a scoring rule, all while maintaining awareness of the overall design quality. Smaller models appear to struggle with this sequential reasoning burden, particularly for the more nuanced criteria such as design principles and relationship modelling.

A notable exception is o4-mini, which achieves competitive accuracy (r = 0.78, projected) despite being a mid-tier model by cost. This supports the hypothesis that chain-of-thought reasoning — which o4-mini is optimised for — may be particularly well-suited to rubric-based assessment tasks, where explicit reasoning steps map naturally onto criterion-by-criterion scoring.

These results broadly corroborate Ibanez et al. (2025), who reported ICC = 0.76 for Claude Sonnet and Pearson r = 0.760 for GPT o1-mini in a UML grading context, though direct comparison is complicated by differences in rubric design and dataset composition.

### 5.5.2 Cost-Accuracy Trade-offs and the Pareto Frontier

[PLACEHOLDER] The cost-accuracy Pareto frontier reveals that the choice between models is not simply a matter of "spend more, get more." Several mid-tier models offer substantially better cost efficiency than their accuracy ranking would suggest. Gemini 2.5 Flash, for instance, achieves a Pearson r of 0.73 at approximately $0.012 per submission — roughly one-fifth of the cost of Claude Sonnet 4, for a modest 14-percentage-point reduction in correlation. For institutions processing large volumes of submissions, this trade-off may be entirely acceptable.

Conversely, Gemini 2.5 Pro offers the worst value among flagship models: it is the most expensive while underperforming both Claude Sonnet 4 and GPT-4o on accuracy. This suggests that Gemini 2.5 Pro's strengths lie in domains other than structured rubric-based assessment.

For institutions with tight per-submission budgets, GPT-4.1-mini represents a reasonable floor: it achieves an acceptable Pearson r of 0.74 at only $0.006 per submission, placing it on the efficient frontier. Below this, GPT-4.1-nano's accuracy degrades sharply and its consistency is poor, making it unsuitable for assessment use cases despite its very low cost.

### 5.5.3 Consistency and the Limits of Temperature Control

[PLACEHOLDER] The consistency results reveal that setting temperature = 0 does not fully eliminate grade variance. Even GPT-4o, the most consistent model, exhibits a mean standard deviation of 0.18 points across runs, with a maximum of 0.45 points for some submissions. This variance likely arises from non-determinism in GPU floating-point operations and from the inherent ambiguity in interpreting certain diagram elements, where the model's probabilistic sampling process can resolve ties differently across runs.

The higher variance observed for Gemini models is noteworthy. Google's API documentation indicates that temperature = 0 does not guarantee fully deterministic outputs for multimodal inputs, which may explain the elevated standard deviations. This is a practical consideration for deployment: institutions using Gemini models should be aware that a student could, in principle, receive a meaningfully different grade on repeated submission of the same diagram.

For an assessment platform, grade consistency is arguably as important as accuracy: an inconsistent grader erodes student trust and complicates appeals processes. The consistency results therefore reinforce the recommendation of flagship OpenAI or Anthropic models for production use, even when cost considerations might suggest otherwise.

### 5.5.4 Practical Recommendations for Institutions

Based on the composite scoring results and the foregoing analysis, the following recommendations are offered:

**High-accuracy institutional deployment (budget permitting):** Claude Sonnet 4 or GPT-4o. Both models achieve the best accuracy and feedback quality, with acceptable consistency. The choice between them may depend on existing institutional relationships with Anthropic or OpenAI.

**Cost-constrained deployment with reasonable accuracy:** o4-mini or Gemini 2.5 Flash. Both offer a meaningful reduction in per-submission cost while maintaining Pearson correlations above 0.70. o4-mini is preferred where consistency is important; Gemini 2.5 Flash is preferred where speed is critical.

**Prototyping or non-critical formative assessment:** GPT-4.1-mini or GPT-4o-mini. These models are inexpensive enough for high-volume use and sufficiently accurate for formative feedback, though they should not be used as the sole arbiter of summative grades.

**Models not recommended for assessment use:** GPT-4.1-nano and Claude 3.5 Haiku. Both exhibit accuracy and consistency levels that are unlikely to be acceptable in a formal academic context.

---

## 5.6 Threats to Validity

### 5.6.1 Internal Validity

The primary threat to internal validity is the construction of the synthetic dataset. Thirty of 32 submissions were generated by the author, meaning that the error patterns introduced in each tier were deliberate and systematic rather than emergent from genuine student work. It is possible that real student diagrams contain error types not represented in the synthetic set — for example, fundamental conceptual misunderstandings that manifest as unusual structural choices — and that some models are better equipped to handle such cases than others. The relative performance ordering observed in this experiment may therefore not generalise to real classroom deployments.

The single-grader ground truth introduces a further internal validity risk. Without inter-rater reliability measurement, it is impossible to establish the degree to which the ground truth scores reflect a stable consensus judgment. A model that disagrees with the author's grades might do so because it is wrong, or because the rubric admits multiple defensible interpretations that a second human grader would also express. Future work should involve at least two independent graders and report Cohen's kappa or intraclass correlation coefficient for the ground truth itself.

### 5.6.2 External Validity

The dataset covers only UML class diagrams. The relative performance of models may differ substantially for sequence, activity, or use-case diagrams, which involve different visual grammars and different reasoning challenges. Institutions that use the platform for a broader range of diagram types should conduct their own evaluations before relying on these results.

The experiment uses a single prompt template, derived from the platform's production v2 strict grading prompt. Prompt sensitivity is known to be significant for LLM evaluation tasks: different prompt formulations can meaningfully alter relative model rankings. The results of this experiment should therefore be interpreted as evaluating model performance under this specific prompt, not model capability in the abstract.

### 5.6.3 Construct Validity

Pearson correlation and MAE are imperfect proxies for grading quality. A model that consistently shifts all grades up by one point will achieve a high Pearson r (because the ranking is preserved) while performing poorly on MAE. Conversely, a model that adds random noise to otherwise well-calibrated grades will score poorly on both metrics even if its per-criterion reasoning is sound. Neither metric captures the quality of the written reasoning field, which is arguably as important to students as the numerical score.

### 5.6.4 API and Model Versioning

LLM providers update model weights, sampling behaviour, and API specifications without always publishing detailed changelogs. The model versions evaluated in this experiment are those available at the time of writing; results may differ for future model versions, even under the same model identifier. Institutions should treat this experiment as a snapshot rather than a permanent characterisation of model capability.

---

*[PLACEHOLDER — All numerical results in Sections 5.4 and 5.5 are projected estimates based on related literature and will be replaced with actual experimental results prior to final submission. Visualisations described (radar chart, grade-correlation scatter plot, cost-accuracy Pareto frontier, consistency boxplot, latency comparison bar chart, and per-criterion MAE heatmap) will be generated from actual experimental data and inserted at the referenced positions.]*

Having established the empirical characteristics of the supported LLM models, Chapter 6 evaluates the platform as a whole against its stated functional and non-functional requirements, reporting on the testing strategy, test results, and user acceptance outcomes from supervisor review sessions.
