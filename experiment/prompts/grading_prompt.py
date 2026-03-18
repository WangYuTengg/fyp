"""
Standardized grading prompt template for LLM benchmarking.

Uses identical prompts across all models for fair comparison.
Includes few-shot examples as recommended by literature.
"""

SYSTEM_PROMPT = """You are an expert software engineering instructor who grades UML class diagrams.
You evaluate student submissions against a specification and rubric with precision and consistency.
You provide structured grades and actionable feedback."""

FEW_SHOT_EXAMPLES = """
Here are examples of how to grade UML class diagram submissions:

### Example 1: Good Submission (7/10)
**Specification**: Design a class diagram for a simple Banking System with Account, Customer, and Transaction classes.
**Submission (PlantUML)**:
```
@startuml
class Customer {
  - name: String
  - email: String
}
class Account {
  - accountNumber: String
  - balance: double
}
class Transaction {
  - amount: double
  - date: Date
}
Customer "1" -- "*" Account
Account "1" -- "*" Transaction
@enduml
```
**Grade**:
```json
{
  "grade": 7.0,
  "rubric_scores": {
    "class_correctness": 2.0,
    "relationship_accuracy": 1.5,
    "cardinality": 1.5,
    "naming_conventions": 1.0,
    "completeness": 1.0
  },
  "feedback": "All three required classes are present with appropriate attributes. Relationships and cardinalities are correct. However, methods are missing from all classes (e.g., deposit(), withdraw() for Account). Attribute visibility modifiers are only partially used. The Transaction class should include a type field (deposit/withdrawal).",
  "strengths": ["Correct class identification", "Proper cardinality notation"],
  "weaknesses": ["No methods defined", "Missing Transaction type attribute", "Incomplete attribute visibility"]
}
```

### Example 2: Poor Submission (3/10)
**Specification**: Design a class diagram for a simple Banking System with Account, Customer, and Transaction classes.
**Submission (PlantUML)**:
```
@startuml
class Bank {
  name: String
}
class User {
  name: String
}
Bank --> User
@enduml
```
**Grade**:
```json
{
  "grade": 3.0,
  "rubric_scores": {
    "class_correctness": 0.5,
    "relationship_accuracy": 0.5,
    "cardinality": 0.0,
    "naming_conventions": 1.0,
    "completeness": 1.0
  },
  "feedback": "The diagram is significantly incomplete. 'Bank' was not a required class — the specification asked for Account, Customer, and Transaction. 'User' partially maps to Customer but uses a different name. No Account or Transaction class is present. No cardinalities are specified. The relationship type (directed association) is incorrect for this context.",
  "strengths": ["Basic UML syntax is correct"],
  "weaknesses": ["Missing 2 of 3 required classes", "No cardinality", "Wrong class names", "No attributes beyond name"]
}
```
"""


def build_grading_prompt(
    specification: str,
    reference_solution: str,
    student_submission: str,
    rubric_criteria: list[dict],
    submission_format: str = "PlantUML",
) -> str:
    """Build the complete grading prompt for a single submission."""

    criteria_text = "\n".join(
        f"  - **{c['name']}** (0-{c['max_points']} points): {c['description']}"
        for c in rubric_criteria
    )
    total_points = sum(c["max_points"] for c in rubric_criteria)

    return f"""{FEW_SHOT_EXAMPLES}

---

Now grade the following submission.

## Specification
{specification}

## Reference Solution
```
{reference_solution}
```

## Rubric ({total_points}-point scale)
{criteria_text}

## Student Submission ({submission_format})
```
{student_submission}
```

## Instructions
1. Compare the student submission against the specification and reference solution
2. Evaluate each rubric criterion independently
3. Assign partial credit where appropriate (0.5 increments)
4. Provide specific, actionable feedback

Respond with ONLY valid JSON in this exact format (no markdown fences, no extra text):
{{
  "grade": <total score as float>,
  "rubric_scores": {{
    "class_correctness": <0-2 float>,
    "relationship_accuracy": <0-2 float>,
    "cardinality": <0-2 float>,
    "naming_conventions": <0-2 float>,
    "completeness": <0-2 float>
  }},
  "feedback": "<2-4 sentence assessment>",
  "strengths": ["<strength 1>", "<strength 2>"],
  "weaknesses": ["<weakness 1>", "<weakness 2>"]
}}"""
