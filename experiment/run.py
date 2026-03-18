#!/usr/bin/env python3
"""
Main entry point for the UML grading LLM benchmark experiment.

Usage:
  # Generate dataset
  python run.py generate

  # Run full experiment (all models, 5 runs each)
  python run.py benchmark

  # Run specific models only
  python run.py benchmark --models gpt-4o claude-sonnet-4

  # Quick test (1 run, 2 submissions)
  python run.py benchmark --runs 1 --submissions lib_001 ecom_001

  # Analyze results
  python run.py analyze results/all_results_XXXXXXXX_XXXXXX.json

  # Full pipeline: generate → benchmark → analyze
  python run.py all
"""

import argparse
import glob
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))


def cmd_generate(args):
    """Generate the synthetic dataset."""
    from data.synthetic.generate_dataset import main as generate_main
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    generate_main()


def cmd_benchmark(args):
    """Run the benchmarking experiment."""
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    from src.runner import run_experiment

    result_file = run_experiment(
        config_path=args.config,
        dataset_path=args.dataset,
        output_dir=args.output,
        models_filter=args.models,
        submissions_filter=args.submissions,
        num_runs=args.runs,
    )
    return result_file


def cmd_analyze(args):
    """Analyze experiment results."""
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    from src.analyze import generate_report

    results_path = args.results
    if not results_path:
        # Find most recent results file
        files = sorted(glob.glob("results/all_results_*.json"))
        if not files:
            print("ERROR: No results files found. Run 'benchmark' first.")
            sys.exit(1)
        results_path = files[-1]
        print(f"Using most recent results: {results_path}")

    generate_report(results_path, args.analysis_output)


def cmd_all(args):
    """Run full pipeline: generate → benchmark → analyze."""
    print("=" * 60)
    print("STEP 1: Generate Dataset")
    print("=" * 60)
    cmd_generate(args)

    print("\n" + "=" * 60)
    print("STEP 2: Run Benchmark")
    print("=" * 60)
    result_file = cmd_benchmark(args)

    print("\n" + "=" * 60)
    print("STEP 3: Analyze Results")
    print("=" * 60)
    args.results = result_file
    cmd_analyze(args)


def main():
    parser = argparse.ArgumentParser(
        description="UML Grading LLM Benchmark Experiment",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    subparsers = parser.add_subparsers(dest="command", help="Command to run")

    # Generate
    gen_parser = subparsers.add_parser("generate", help="Generate synthetic dataset")
    gen_parser.set_defaults(func=cmd_generate)

    # Benchmark
    bench_parser = subparsers.add_parser("benchmark", help="Run LLM benchmark")
    bench_parser.add_argument("--config", default="config.yaml")
    bench_parser.add_argument("--dataset", default="data/synthetic/dataset.json")
    bench_parser.add_argument("--output", default="results")
    bench_parser.add_argument("--models", nargs="*", help="Model IDs to test")
    bench_parser.add_argument("--submissions", nargs="*", help="Submission IDs to test")
    bench_parser.add_argument("--runs", type=int, help="Runs per submission")
    bench_parser.set_defaults(func=cmd_benchmark)

    # Analyze
    analyze_parser = subparsers.add_parser("analyze", help="Analyze results")
    analyze_parser.add_argument("results", nargs="?", help="Results JSON file")
    analyze_parser.add_argument("--analysis-output", default="analysis")
    analyze_parser.set_defaults(func=cmd_analyze)

    # All
    all_parser = subparsers.add_parser("all", help="Run full pipeline")
    all_parser.add_argument("--config", default="config.yaml")
    all_parser.add_argument("--dataset", default="data/synthetic/dataset.json")
    all_parser.add_argument("--output", default="results")
    all_parser.add_argument("--models", nargs="*")
    all_parser.add_argument("--submissions", nargs="*")
    all_parser.add_argument("--runs", type=int)
    all_parser.add_argument("--analysis-output", default="analysis")
    all_parser.add_argument("results", nargs="?", default=None)
    all_parser.set_defaults(func=cmd_all)

    args = parser.parse_args()
    if not args.command:
        parser.print_help()
        sys.exit(1)

    args.func(args)


if __name__ == "__main__":
    main()
