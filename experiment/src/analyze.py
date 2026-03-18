"""
Analysis pipeline for experiment results.

Computes per-model metrics:
- Accuracy: Pearson correlation + MAE vs ground truth
- Cost: USD per submission
- Speed: Latency percentiles
- Reliability: Std deviation across repeated runs
- Rubric adherence: % of criteria addressed

Generates visualizations: radar charts, box plots, scatter plots, heatmaps.
"""

import json
import os
import sys
from pathlib import Path

import matplotlib
matplotlib.use("Agg")  # Non-interactive backend
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import seaborn as sns
from scipy import stats


def load_results(results_path: str) -> pd.DataFrame:
    """Load experiment results into a DataFrame."""
    with open(results_path) as f:
        data = json.load(f)

    df = pd.DataFrame(data)
    # Filter to successful parses only for analysis
    return df


def compute_model_metrics(df: pd.DataFrame) -> pd.DataFrame:
    """Compute aggregate metrics per model."""
    successful = df[df["parsed_successfully"] == True].copy()

    metrics = []
    for model_id, group in successful.groupby("model"):
        grades = group["grade"].dropna()
        gt_grades = group["ground_truth_grade"]

        # Accuracy metrics
        if len(grades) >= 3:
            pearson_r, pearson_p = stats.pearsonr(grades, gt_grades[grades.index])
            spearman_r, spearman_p = stats.spearmanr(grades, gt_grades[grades.index])
        else:
            pearson_r = pearson_p = spearman_r = spearman_p = None

        mae = np.mean(np.abs(grades - gt_grades[grades.index]))
        rmse = np.sqrt(np.mean((grades - gt_grades[grades.index]) ** 2))

        # Consistency: std dev across repeated runs per submission
        consistency_stds = []
        for sub_id, sub_group in group.groupby("submission_id"):
            sub_grades = sub_group["grade"].dropna()
            if len(sub_grades) > 1:
                consistency_stds.append(sub_grades.std())
        avg_consistency_std = np.mean(consistency_stds) if consistency_stds else None

        # Cost and speed
        avg_cost = group["cost_usd"].mean()
        total_cost = group["cost_usd"].sum()
        avg_latency = group["latency_ms"].mean()
        p95_latency = group["latency_ms"].quantile(0.95)

        # Parse success rate
        total_runs = len(df[df["model"] == model_id])
        parse_rate = len(group) / total_runs if total_runs > 0 else 0

        # Token usage
        avg_input_tokens = group["input_tokens"].mean()
        avg_output_tokens = group["output_tokens"].mean()

        # Rubric adherence - check if all 5 criteria are scored
        rubric_adherence_scores = []
        for _, row in group.iterrows():
            scores = row.get("rubric_scores")
            if isinstance(scores, dict):
                expected = {"class_correctness", "relationship_accuracy", "cardinality",
                           "naming_conventions", "completeness"}
                covered = sum(1 for k in expected if k in scores and scores[k] is not None)
                rubric_adherence_scores.append(covered / len(expected))
        avg_rubric_adherence = np.mean(rubric_adherence_scores) if rubric_adherence_scores else None

        metrics.append({
            "model": model_id,
            "provider": group["provider"].iloc[0],
            "pearson_r": pearson_r,
            "pearson_p": pearson_p,
            "spearman_r": spearman_r,
            "spearman_p": spearman_p,
            "mae": mae,
            "rmse": rmse,
            "avg_consistency_std": avg_consistency_std,
            "avg_cost_per_submission": avg_cost,
            "total_cost": total_cost,
            "avg_latency_ms": avg_latency,
            "p95_latency_ms": p95_latency,
            "parse_success_rate": parse_rate,
            "avg_rubric_adherence": avg_rubric_adherence,
            "avg_input_tokens": avg_input_tokens,
            "avg_output_tokens": avg_output_tokens,
            "n_successful_runs": len(group),
            "n_total_runs": total_runs,
        })

    return pd.DataFrame(metrics)


def compute_per_criterion_accuracy(df: pd.DataFrame) -> pd.DataFrame:
    """Compute MAE per rubric criterion per model."""
    successful = df[df["parsed_successfully"] == True].copy()
    criteria = ["class_correctness", "relationship_accuracy", "cardinality",
                "naming_conventions", "completeness"]

    rows = []
    for model_id, group in successful.groupby("model"):
        for _, run in group.iterrows():
            pred_scores = run.get("rubric_scores")
            gt_scores = run.get("ground_truth_scores")
            if not isinstance(pred_scores, dict) or not isinstance(gt_scores, dict):
                continue
            for criterion in criteria:
                pred = pred_scores.get(criterion)
                gt = gt_scores.get(criterion)
                if pred is not None and gt is not None:
                    rows.append({
                        "model": model_id,
                        "criterion": criterion,
                        "predicted": pred,
                        "ground_truth": gt,
                        "error": abs(pred - gt),
                    })

    return pd.DataFrame(rows)


def plot_radar_chart(metrics_df: pd.DataFrame, output_dir: str):
    """Generate radar chart comparing models across all criteria."""
    os.makedirs(output_dir, exist_ok=True)

    # Normalize metrics to 0-1 scale (higher = better)
    df = metrics_df.copy()

    # Invert metrics where lower is better
    max_mae = df["mae"].max()
    max_latency = df["avg_latency_ms"].max()
    max_cost = df["avg_cost_per_submission"].max()
    max_std = df["avg_consistency_std"].max() if df["avg_consistency_std"].notna().any() else 1

    df["accuracy_norm"] = 1 - (df["mae"] / max_mae) if max_mae > 0 else 1
    df["cost_norm"] = 1 - (df["avg_cost_per_submission"] / max_cost) if max_cost > 0 else 1
    df["speed_norm"] = 1 - (df["avg_latency_ms"] / max_latency) if max_latency > 0 else 1
    df["consistency_norm"] = 1 - (df["avg_consistency_std"] / max_std) if max_std > 0 else 1
    df["rubric_norm"] = df["avg_rubric_adherence"].fillna(0)
    df["parse_norm"] = df["parse_success_rate"]

    categories = ["Accuracy", "Cost Efficiency", "Speed", "Consistency", "Rubric\nAdherence", "Reliability"]
    N = len(categories)

    fig, ax = plt.subplots(figsize=(10, 10), subplot_kw=dict(polar=True))
    angles = [n / N * 2 * np.pi for n in range(N)]
    angles += angles[:1]

    colors = plt.cm.tab10(np.linspace(0, 1, len(df)))

    for idx, (_, row) in enumerate(df.iterrows()):
        values = [
            row["accuracy_norm"],
            row["cost_norm"],
            row["speed_norm"],
            row["consistency_norm"],
            row["rubric_norm"],
            row["parse_norm"],
        ]
        values += values[:1]
        ax.plot(angles, values, "o-", linewidth=2, label=row["model"], color=colors[idx])
        ax.fill(angles, values, alpha=0.1, color=colors[idx])

    ax.set_xticks(angles[:-1])
    ax.set_xticklabels(categories, size=11)
    ax.set_ylim(0, 1.1)
    ax.set_title("Model Comparison — Radar Chart", size=16, pad=30)
    ax.legend(loc="upper right", bbox_to_anchor=(1.3, 1.1), fontsize=9)

    plt.tight_layout()
    plt.savefig(os.path.join(output_dir, "radar_chart.png"), dpi=150, bbox_inches="tight")
    plt.close()
    print(f"  Saved radar_chart.png")


def plot_grade_correlation(df: pd.DataFrame, output_dir: str):
    """Scatter plots of predicted vs ground truth grades per model."""
    os.makedirs(output_dir, exist_ok=True)
    successful = df[df["parsed_successfully"] == True]

    models = successful["model"].unique()
    n_models = len(models)
    cols = min(3, n_models)
    rows = (n_models + cols - 1) // cols

    fig, axes = plt.subplots(rows, cols, figsize=(6 * cols, 5 * rows), squeeze=False)

    for idx, model in enumerate(models):
        ax = axes[idx // cols][idx % cols]
        model_data = successful[successful["model"] == model]

        grades = model_data["grade"].dropna()
        gt = model_data.loc[grades.index, "ground_truth_grade"]

        ax.scatter(gt, grades, alpha=0.5, s=50)
        ax.plot([0, 10], [0, 10], "r--", alpha=0.5, label="Perfect")

        if len(grades) >= 3:
            r, _ = stats.pearsonr(grades, gt)
            ax.set_title(f"{model}\nr={r:.3f}", fontsize=11)
        else:
            ax.set_title(model, fontsize=11)

        ax.set_xlabel("Ground Truth")
        ax.set_ylabel("Predicted")
        ax.set_xlim(0, 11)
        ax.set_ylim(0, 11)
        ax.legend(fontsize=8)

    # Hide empty subplots
    for idx in range(n_models, rows * cols):
        axes[idx // cols][idx % cols].set_visible(False)

    plt.suptitle("Predicted vs Ground Truth Grades", fontsize=14, y=1.02)
    plt.tight_layout()
    plt.savefig(os.path.join(output_dir, "grade_correlation.png"), dpi=150, bbox_inches="tight")
    plt.close()
    print(f"  Saved grade_correlation.png")


def plot_cost_vs_accuracy(metrics_df: pd.DataFrame, output_dir: str):
    """Pareto chart: cost vs accuracy (MAE)."""
    os.makedirs(output_dir, exist_ok=True)

    fig, ax = plt.subplots(figsize=(10, 7))

    for _, row in metrics_df.iterrows():
        ax.scatter(row["avg_cost_per_submission"] * 1000, row["mae"],
                   s=150, zorder=5)
        ax.annotate(row["model"],
                    (row["avg_cost_per_submission"] * 1000, row["mae"]),
                    textcoords="offset points", xytext=(8, 5), fontsize=9)

    ax.set_xlabel("Cost per Submission ($ x 1000 = millicents)", fontsize=12)
    ax.set_ylabel("Mean Absolute Error (lower = better)", fontsize=12)
    ax.set_title("Cost vs Accuracy Tradeoff", fontsize=14)
    ax.grid(True, alpha=0.3)

    plt.tight_layout()
    plt.savefig(os.path.join(output_dir, "cost_vs_accuracy.png"), dpi=150, bbox_inches="tight")
    plt.close()
    print(f"  Saved cost_vs_accuracy.png")


def plot_consistency_boxplot(df: pd.DataFrame, output_dir: str):
    """Box plots showing grade distribution across repeated runs per model."""
    os.makedirs(output_dir, exist_ok=True)
    successful = df[df["parsed_successfully"] == True]

    # Compute per-submission grade std per model
    consistency_data = []
    for (model, sub_id), group in successful.groupby(["model", "submission_id"]):
        grades = group["grade"].dropna()
        if len(grades) > 1:
            consistency_data.append({
                "model": model,
                "submission_id": sub_id,
                "std": grades.std(),
                "range": grades.max() - grades.min(),
            })

    if not consistency_data:
        print("  Skipping consistency boxplot — not enough repeated runs")
        return

    cdf = pd.DataFrame(consistency_data)

    fig, ax = plt.subplots(figsize=(12, 6))
    sns.boxplot(data=cdf, x="model", y="std", ax=ax)
    ax.set_xlabel("Model", fontsize=12)
    ax.set_ylabel("Grade Std Dev (across runs)", fontsize=12)
    ax.set_title("Grading Consistency (lower = more consistent)", fontsize=14)
    plt.xticks(rotation=45, ha="right")

    plt.tight_layout()
    plt.savefig(os.path.join(output_dir, "consistency_boxplot.png"), dpi=150, bbox_inches="tight")
    plt.close()
    print(f"  Saved consistency_boxplot.png")


def plot_latency_comparison(metrics_df: pd.DataFrame, output_dir: str):
    """Bar chart comparing latency across models."""
    os.makedirs(output_dir, exist_ok=True)

    fig, ax = plt.subplots(figsize=(12, 6))

    models = metrics_df["model"]
    x = range(len(models))
    bars = ax.bar(x, metrics_df["avg_latency_ms"] / 1000, color="steelblue", alpha=0.8)

    ax.set_xticks(x)
    ax.set_xticklabels(models, rotation=45, ha="right")
    ax.set_ylabel("Average Latency (seconds)", fontsize=12)
    ax.set_title("Model Latency Comparison", fontsize=14)
    ax.grid(axis="y", alpha=0.3)

    # Add value labels
    for bar, val in zip(bars, metrics_df["avg_latency_ms"]):
        ax.text(bar.get_x() + bar.get_width() / 2, bar.get_height(),
                f"{val/1000:.1f}s", ha="center", va="bottom", fontsize=9)

    plt.tight_layout()
    plt.savefig(os.path.join(output_dir, "latency_comparison.png"), dpi=150, bbox_inches="tight")
    plt.close()
    print(f"  Saved latency_comparison.png")


def plot_criterion_heatmap(criterion_df: pd.DataFrame, output_dir: str):
    """Heatmap of MAE per rubric criterion per model."""
    os.makedirs(output_dir, exist_ok=True)

    if criterion_df.empty:
        print("  Skipping criterion heatmap — no per-criterion data")
        return

    pivot = criterion_df.groupby(["model", "criterion"])["error"].mean().reset_index()
    heatmap_data = pivot.pivot(index="model", columns="criterion", values="error")

    fig, ax = plt.subplots(figsize=(10, max(6, len(heatmap_data) * 0.8)))
    sns.heatmap(heatmap_data, annot=True, fmt=".2f", cmap="RdYlGn_r",
                ax=ax, vmin=0, vmax=2, linewidths=0.5)
    ax.set_title("Per-Criterion MAE (lower = better)", fontsize=14)
    ax.set_ylabel("Model")
    ax.set_xlabel("Rubric Criterion")

    plt.tight_layout()
    plt.savefig(os.path.join(output_dir, "criterion_heatmap.png"), dpi=150, bbox_inches="tight")
    plt.close()
    print(f"  Saved criterion_heatmap.png")


def compute_weighted_score(metrics_df: pd.DataFrame) -> pd.DataFrame:
    """Compute weighted composite score per the experiment design weights."""
    df = metrics_df.copy()

    # Weights from experiment design
    weights = {
        "accuracy": 0.30,
        "cost": 0.15,
        "speed": 0.10,
        "consistency": 0.20,
        "feedback": 0.15,  # Approximated by parse success rate
        "rubric_adherence": 0.10,
    }

    # Normalize each metric to 0-1 (higher = better)
    def norm_inv(col):
        """Normalize inversely (lower raw value = higher score)."""
        max_val = col.max()
        if max_val == 0:
            return pd.Series(1.0, index=col.index)
        return 1 - (col / max_val)

    def norm(col):
        """Normalize directly (higher raw value = higher score)."""
        max_val = col.max()
        if max_val == 0:
            return pd.Series(0.0, index=col.index)
        return col / max_val

    df["score_accuracy"] = norm_inv(df["mae"])
    df["score_cost"] = norm_inv(df["avg_cost_per_submission"])
    df["score_speed"] = norm_inv(df["avg_latency_ms"])
    df["score_consistency"] = norm_inv(df["avg_consistency_std"].fillna(df["avg_consistency_std"].max() or 1))
    df["score_feedback"] = df["parse_success_rate"]
    df["score_rubric"] = df["avg_rubric_adherence"].fillna(0)

    df["weighted_score"] = (
        weights["accuracy"] * df["score_accuracy"]
        + weights["cost"] * df["score_cost"]
        + weights["speed"] * df["score_speed"]
        + weights["consistency"] * df["score_consistency"]
        + weights["feedback"] * df["score_feedback"]
        + weights["rubric_adherence"] * df["score_rubric"]
    )

    return df.sort_values("weighted_score", ascending=False)


def generate_report(results_path: str, output_dir: str = "analysis"):
    """Generate full analysis report from experiment results."""
    os.makedirs(output_dir, exist_ok=True)
    figures_dir = os.path.join(output_dir, "figures")
    os.makedirs(figures_dir, exist_ok=True)

    print(f"\n{'='*60}")
    print("ANALYSIS REPORT")
    print(f"{'='*60}\n")

    # Load and process data
    df = load_results(results_path)
    print(f"Loaded {len(df)} result records")

    metrics_df = compute_model_metrics(df)
    criterion_df = compute_per_criterion_accuracy(df)
    ranked_df = compute_weighted_score(metrics_df)

    # Generate visualizations
    print("\nGenerating visualizations...")
    plot_radar_chart(metrics_df, figures_dir)
    plot_grade_correlation(df, figures_dir)
    plot_cost_vs_accuracy(metrics_df, figures_dir)
    plot_consistency_boxplot(df, figures_dir)
    plot_latency_comparison(metrics_df, figures_dir)
    plot_criterion_heatmap(criterion_df, figures_dir)

    # Print ranked results
    print(f"\n{'='*60}")
    print("FINAL RANKINGS (Weighted Composite Score)")
    print(f"{'='*60}")
    print(f"{'Rank':<5} {'Model':<25} {'Score':<8} {'MAE':<8} {'Pearson r':<10} {'Cost/sub':<10} {'Latency':<10}")
    print("-" * 76)

    for rank, (_, row) in enumerate(ranked_df.iterrows(), 1):
        r_str = f"{row['pearson_r']:.3f}" if row['pearson_r'] is not None else "N/A"
        print(
            f"{rank:<5} {row['model']:<25} {row['weighted_score']:.3f}   "
            f"{row['mae']:.2f}    {r_str:<10} "
            f"${row['avg_cost_per_submission']:.5f}  "
            f"{row['avg_latency_ms']:.0f}ms"
        )

    # Save metrics CSV
    metrics_csv = os.path.join(output_dir, "model_metrics.csv")
    ranked_df.to_csv(metrics_csv, index=False)
    print(f"\nMetrics saved → {metrics_csv}")

    # Save criterion analysis
    if not criterion_df.empty:
        criterion_csv = os.path.join(output_dir, "criterion_analysis.csv")
        criterion_df.to_csv(criterion_csv, index=False)
        print(f"Criterion analysis saved → {criterion_csv}")

    # Statistical significance tests
    print(f"\n{'='*60}")
    print("STATISTICAL SIGNIFICANCE (Paired Wilcoxon Signed-Rank)")
    print(f"{'='*60}")

    successful = df[df["parsed_successfully"] == True]
    models = successful["model"].unique()
    if len(models) >= 2:
        # Use first run of each submission for fair comparison
        first_runs = successful[successful.get("run_number", 1) == 1] if "run_number" in successful.columns else successful.groupby(["model", "submission_id"]).first().reset_index()

        for i in range(len(models)):
            for j in range(i + 1, len(models)):
                m1_data = first_runs[first_runs["model"] == models[i]].sort_values("submission_id")
                m2_data = first_runs[first_runs["model"] == models[j]].sort_values("submission_id")

                # Find common submissions
                common = set(m1_data["submission_id"]) & set(m2_data["submission_id"])
                if len(common) < 5:
                    continue

                m1_errors = []
                m2_errors = []
                for sub_id in sorted(common):
                    m1_grade = m1_data[m1_data["submission_id"] == sub_id]["grade"].values[0]
                    m2_grade = m2_data[m2_data["submission_id"] == sub_id]["grade"].values[0]
                    gt = m1_data[m1_data["submission_id"] == sub_id]["ground_truth_grade"].values[0]
                    if m1_grade is not None and m2_grade is not None:
                        m1_errors.append(abs(m1_grade - gt))
                        m2_errors.append(abs(m2_grade - gt))

                if len(m1_errors) >= 5:
                    try:
                        stat, p_val = stats.wilcoxon(m1_errors, m2_errors)
                        sig = "***" if p_val < 0.001 else "**" if p_val < 0.01 else "*" if p_val < 0.05 else "ns"
                        print(f"  {models[i]} vs {models[j]}: p={p_val:.4f} {sig}")
                    except Exception:
                        pass

    return ranked_df


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Analyze experiment results")
    parser.add_argument("results", help="Path to results JSON file")
    parser.add_argument("--output", default="analysis", help="Output directory")
    args = parser.parse_args()

    generate_report(args.results, args.output)
