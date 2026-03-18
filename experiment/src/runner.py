"""
Experiment runner — orchestrates LLM grading across all models and submissions.

Handles retries, logging, and result collection. Outputs structured JSON
for each run following the schema from the experiment design.
"""

import json
import os
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import yaml
from dotenv import load_dotenv
from tenacity import retry, stop_after_attempt, wait_exponential
from tqdm import tqdm

# Add parent to path so we can import sibling modules
sys.path.insert(0, str(Path(__file__).parent.parent))

from prompts.grading_prompt import SYSTEM_PROMPT, build_grading_prompt
from src.providers import call_model, parse_grade_response


def load_config(config_path: str = "config.yaml") -> dict:
    """Load experiment configuration."""
    with open(config_path) as f:
        return yaml.safe_load(f)


def load_dataset(dataset_path: str = "data/synthetic/dataset.json") -> list[dict]:
    """Load the submission dataset."""
    with open(dataset_path) as f:
        return json.load(f)


def load_rubric(rubric_name: str) -> dict:
    """Load a rubric file by name."""
    rubric_path = f"data/rubrics/{rubric_name}.yaml"
    with open(rubric_path) as f:
        return yaml.safe_load(f)


def get_api_key(provider: str) -> str:
    """Get API key for a provider from environment."""
    key_map = {
        "openai": "OPENAI_API_KEY",
        "anthropic": "ANTHROPIC_API_KEY",
        "google": "GOOGLE_API_KEY",
    }
    env_var = key_map.get(provider, "")
    key = os.getenv(env_var, "")
    if not key and provider != "ollama":
        print(f"  WARNING: {env_var} not set, skipping {provider} models")
    return key


@retry(stop=stop_after_attempt(3), wait=wait_exponential(min=2, max=30))
def grade_submission(
    model_config: dict,
    submission: dict,
    rubric: dict,
    api_key: str,
    timeout: int = 120,
) -> dict:
    """Grade a single submission with a single model (with retry logic)."""
    # Determine specification and reference — McGill submissions carry their own
    if submission.get("source") == "mcgill-uml-grader":
        spec = submission.get("marking_scheme", {})
        spec_text = (
            f"Domain: {submission.get('domain', 'Unknown')}\n"
            f"Expected classes ({spec.get('nClasses', '?')}): "
            + ", ".join(str(c) for c in spec.get("expectedClasses", []))
            + f"\nExpected associations: {spec.get('nAssoc', '?')}\n"
            f"Expected attributes: {', '.join(spec.get('expectedAttributes', []))}"
        )
        ref_solution = submission.get("reference_solution", "")
        student_text = submission.get("student_submission", submission.get("plantuml", ""))
        fmt = submission.get("format", "umple")
    else:
        spec_text = rubric["specification"]
        ref_solution = rubric["reference_solution"]
        student_text = submission["plantuml"]
        fmt = "PlantUML"

    prompt = build_grading_prompt(
        specification=spec_text,
        reference_solution=ref_solution,
        student_submission=student_text,
        rubric_criteria=yaml.safe_load(open("config.yaml"))["rubric"]["criteria"],
        submission_format=fmt,
    )

    response = call_model(
        provider=model_config["provider"],
        model_name=model_config["model_name"],
        system_prompt=SYSTEM_PROMPT,
        user_prompt=prompt,
        api_key=api_key,
        timeout=timeout,
        base_url=os.getenv("OLLAMA_BASE_URL", "http://localhost:11434"),
    )

    parsed = parse_grade_response(response.content)

    # Calculate cost
    input_cost = (response.input_tokens / 1_000_000) * model_config.get(
        "input_cost_per_1m", 0
    )
    output_cost = (response.output_tokens / 1_000_000) * model_config.get(
        "output_cost_per_1m", 0
    )

    return {
        "model": model_config["id"],
        "provider": model_config["provider"],
        "submission_id": submission["id"],
        "rubric": submission["rubric"],
        "parsed_successfully": parsed is not None,
        "grade": parsed.get("grade") if parsed else None,
        "rubric_scores": parsed.get("rubric_scores") if parsed else None,
        "feedback": parsed.get("feedback") if parsed else None,
        "strengths": parsed.get("strengths") if parsed else None,
        "weaknesses": parsed.get("weaknesses") if parsed else None,
        "raw_response": response.content,
        "latency_ms": response.latency_ms,
        "input_tokens": response.input_tokens,
        "output_tokens": response.output_tokens,
        "cost_usd": input_cost + output_cost,
        "ground_truth_grade": submission["ground_truth"]["total"],
        "ground_truth_scores": submission["ground_truth"],
    }


def run_experiment(
    config_path: str = "config.yaml",
    dataset_path: str = "data/synthetic/dataset.json",
    output_dir: str = "results",
    models_filter: list[str] | None = None,
    submissions_filter: list[str] | None = None,
    num_runs: int | None = None,
):
    """Run the full experiment."""
    load_dotenv()

    config = load_config(config_path)
    dataset = load_dataset(dataset_path)
    runs_per_submission = num_runs or config["experiment"]["runs_per_submission"]
    timeout = config["experiment"]["timeout_seconds"]

    os.makedirs(output_dir, exist_ok=True)

    # Filter models if specified
    models = config["models"]
    if models_filter:
        models = [m for m in models if m["id"] in models_filter]

    # Filter submissions if specified
    if submissions_filter:
        dataset = [s for s in dataset if s["id"] in submissions_filter]

    # Pre-load rubrics
    rubrics = {}
    for sub in dataset:
        if sub["rubric"] not in rubrics:
            rubrics[sub["rubric"]] = load_rubric(sub["rubric"])

    # Collect API keys
    api_keys = {}
    for model in models:
        provider = model["provider"]
        if provider not in api_keys:
            api_keys[provider] = get_api_key(provider)

    all_results = []
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")

    total_tasks = len(models) * len(dataset) * runs_per_submission
    print(f"\n{'='*60}")
    print(f"UML Grading LLM Benchmark")
    print(f"{'='*60}")
    print(f"Models: {len(models)}")
    print(f"Submissions: {len(dataset)}")
    print(f"Runs per submission: {runs_per_submission}")
    print(f"Total API calls: {total_tasks}")
    print(f"{'='*60}\n")

    with tqdm(total=total_tasks, desc="Overall progress") as pbar:
        for model in models:
            api_key = api_keys.get(model["provider"], "")
            if not api_key and model["provider"] != "ollama":
                pbar.update(len(dataset) * runs_per_submission)
                continue

            print(f"\n--- Model: {model['id']} ---")
            model_results = []

            for submission in dataset:
                rubric = rubrics[submission["rubric"]]

                for run_num in range(1, runs_per_submission + 1):
                    try:
                        result = grade_submission(
                            model_config=model,
                            submission=submission,
                            rubric=rubric,
                            api_key=api_key,
                            timeout=timeout,
                        )
                        result["run_number"] = run_num
                        result["timestamp"] = datetime.now(timezone.utc).isoformat()
                        model_results.append(result)
                        all_results.append(result)

                        status = "OK" if result["parsed_successfully"] else "PARSE_FAIL"
                        grade_str = (
                            f"{result['grade']:.1f}"
                            if result["grade"] is not None
                            else "N/A"
                        )
                        pbar.set_postfix(
                            model=model["id"],
                            sub=submission["id"],
                            grade=grade_str,
                            status=status,
                        )

                    except Exception as e:
                        error_result = {
                            "model": model["id"],
                            "provider": model["provider"],
                            "submission_id": submission["id"],
                            "rubric": submission["rubric"],
                            "run_number": run_num,
                            "parsed_successfully": False,
                            "grade": None,
                            "error": str(e),
                            "ground_truth_grade": submission["ground_truth"]["total"],
                            "timestamp": datetime.now(timezone.utc).isoformat(),
                        }
                        model_results.append(error_result)
                        all_results.append(error_result)
                        pbar.set_postfix(
                            model=model["id"],
                            sub=submission["id"],
                            status="ERROR",
                        )

                    pbar.update(1)

                    # Small delay between calls to respect rate limits
                    time.sleep(0.5)

            # Save per-model results
            model_file = os.path.join(
                output_dir, f"{model['id']}_{timestamp}.json"
            )
            with open(model_file, "w") as f:
                json.dump(model_results, f, indent=2)
            print(f"  Saved {len(model_results)} results → {model_file}")

    # Save combined results
    combined_file = os.path.join(output_dir, f"all_results_{timestamp}.json")
    with open(combined_file, "w") as f:
        json.dump(all_results, f, indent=2)
    print(f"\nAll results saved → {combined_file}")

    # Print quick summary
    print(f"\n{'='*60}")
    print("QUICK SUMMARY")
    print(f"{'='*60}")
    for model in models:
        model_runs = [r for r in all_results if r["model"] == model["id"]]
        successful = [r for r in model_runs if r.get("parsed_successfully")]
        if successful:
            grades = [r["grade"] for r in successful if r["grade"] is not None]
            gt_grades = [r["ground_truth_grade"] for r in successful]
            if grades:
                avg_grade = sum(grades) / len(grades)
                errors = [abs(g - gt) for g, gt in zip(grades, gt_grades)]
                mae = sum(errors) / len(errors)
                avg_latency = sum(r["latency_ms"] for r in successful) / len(successful)
                total_cost = sum(r.get("cost_usd", 0) for r in successful)
                print(
                    f"  {model['id']:25s} | MAE: {mae:.2f} | "
                    f"Avg Grade: {avg_grade:.1f} | "
                    f"Latency: {avg_latency:.0f}ms | "
                    f"Cost: ${total_cost:.4f} | "
                    f"Parse: {len(successful)}/{len(model_runs)}"
                )
        else:
            print(f"  {model['id']:25s} | No successful runs")

    return combined_file


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Run UML grading benchmark")
    parser.add_argument("--config", default="config.yaml", help="Config file path")
    parser.add_argument(
        "--dataset", default="data/synthetic/dataset.json", help="Dataset path"
    )
    parser.add_argument("--output", default="results", help="Output directory")
    parser.add_argument(
        "--models",
        nargs="*",
        help="Specific model IDs to run (default: all)",
    )
    parser.add_argument(
        "--submissions",
        nargs="*",
        help="Specific submission IDs to run (default: all)",
    )
    parser.add_argument(
        "--runs", type=int, help="Override runs per submission"
    )
    args = parser.parse_args()

    run_experiment(
        config_path=args.config,
        dataset_path=args.dataset,
        output_dir=args.output,
        models_filter=args.models,
        submissions_filter=args.submissions,
        num_runs=args.runs,
    )
