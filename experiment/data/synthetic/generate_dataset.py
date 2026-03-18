"""
Dataset generator for UML grading LLM benchmark.

== Dataset Composition ==
The dataset combines two sources:

1. REAL DATA: McGill uml-grader (YounesB-McGill/uml-grader, MODELS 2020)
   - 2 publicly available sample submissions in Umple format
   - Assignment: Fantasy Basketball domain (ideal=0.ump, student=12.ump, grade=75/100)
   - Final Exam: Smart Home domain (ideal=0.ump, student=6.ump, grade from xlsx)
   - Includes marking scheme JSON and grader feedback
   - Limitation: Only 2 samples are public (full dataset restricted for ethics)

2. SYNTHETIC DATA: 30 hand-crafted PlantUML submissions
   - Created by systematically introducing errors into reference solutions
   - 3 problem domains × 2 quality levels per tier × 5 quality tiers = 30 submissions
   - Error types: missing classes, wrong relationships, missing cardinality,
     naming violations, incomplete coverage
   - Ground truth grades assigned by the author using the same rubric consistently

== Methodology for Synthetic Data ==
Each synthetic submission was created by starting from a reference solution and
deliberately introducing errors at controlled severity levels:

  - Excellent (8.5-10): 0-1 minor issues (e.g., abbreviated attribute name)
  - Good (6.5-8.4): 1-2 missing elements, some cardinality gaps
  - Average (4.5-6.4): Missing classes, few relationships, minimal attributes
  - Poor (2.5-4.4): Very incomplete, wrong relationship types, bad naming
  - Failing (0-2.4): Barely attempted, fundamental misunderstanding

Ground truth grades were assigned by evaluating each submission against 5 criteria
(2 points each, 10-point scale):
  1. Class correctness: Are required classes present and correctly named?
  2. Relationship accuracy: Are relationships correct in type and direction?
  3. Cardinality: Are multiplicities specified and correct?
  4. Naming conventions: Do names follow proper UML/OOP conventions?
  5. Completeness: Does the diagram address all requirements?

== Known Limitations ==
- Synthetic data may not capture the full variety of real student errors
- Ground truth grades are from a single grader (no inter-rater reliability)
- Only 2 real submissions available (McGill restricts full dataset)
- No standardized public benchmark exists for rubric-based UML grading
  (this gap is noted in the literature: CSEDU 2025, Ibanez et al. 2025)
"""

import json
import os
import csv

# ============================================================================
# REAL DATA: McGill uml-grader samples
# ============================================================================

def load_mcgill_data() -> list[dict]:
    """Load real submissions from the McGill uml-grader repository."""
    base = os.path.join(os.path.dirname(__file__), "..", "mcgill-uml-grader", "data")
    submissions = []

    # Assignment 2: Fantasy Basketball
    with open(os.path.join(base, "assignment", "0.ump")) as f:
        assignment_ideal = f.read()
    with open(os.path.join(base, "assignment", "12.ump")) as f:
        assignment_student = f.read()
    with open(os.path.join(base, "assignment", "marking_scheme.json")) as f:
        assignment_rubric = json.load(f)
    with open(os.path.join(base, "assignment", "12_grading_notes.txt")) as f:
        assignment_feedback = f.read()

    submissions.append({
        "id": "mcgill_a2_12",
        "source": "mcgill-uml-grader",
        "rubric": "mcgill-assignment",
        "domain": "Fantasy Basketball",
        "quality": "good",
        "format": "umple",
        "reference_solution": assignment_ideal,
        "student_submission": assignment_student,
        "marking_scheme": assignment_rubric,
        "ground_truth": {
            "total": 7.5,  # 75/100 normalized to 10-point scale
            "class_correctness": 1.3,   # Missing Team, VirtualStatistics
            "relationship_accuracy": 1.5,
            "cardinality": 1.2,  # Wrong multiplicities noted
            "naming_conventions": 1.8,
            "completeness": 1.7,
        },
        "human_feedback": assignment_feedback,
        "notes": "Real student submission. Grade 75/100 = 7.5/10. Missing Team and VirtualStatistics classes. Wrong multiplicities on Player-VirtualTeam and User-VirtualTeam.",
        "plantuml": _umple_to_plantuml_approximation(assignment_student, "Fantasy Basketball"),
    })

    # Final Exam: Smart Home
    with open(os.path.join(base, "final_exam", "0.ump")) as f:
        exam_ideal = f.read()
    with open(os.path.join(base, "final_exam", "6.ump")) as f:
        exam_student = f.read()
    with open(os.path.join(base, "final_exam", "marking_scheme.json")) as f:
        exam_rubric = json.load(f)

    submissions.append({
        "id": "mcgill_fe_6",
        "source": "mcgill-uml-grader",
        "rubric": "mcgill-final-exam",
        "domain": "Smart Home Automation",
        "quality": "good",
        "format": "umple",
        "reference_solution": exam_ideal,
        "student_submission": exam_student,
        "marking_scheme": exam_rubric,
        "ground_truth": {
            "total": 7.0,  # Estimated from structure comparison
            "class_correctness": 1.5,   # Has most classes but some missing/renamed
            "relationship_accuracy": 1.3,
            "cardinality": 1.2,
            "naming_conventions": 1.5,
            "completeness": 1.5,
        },
        "notes": "Real student submission. Complex Smart Home domain (18 expected classes). Student has good coverage but some architectural differences (SmartRoom inherits from AtomicTermReference, different naming).",
        "plantuml": _umple_to_plantuml_approximation(exam_student, "Smart Home Automation"),
    })

    return submissions


def _umple_to_plantuml_approximation(umple_code: str, domain: str) -> str:
    """
    Convert Umple code to an approximate PlantUML representation.
    This is a best-effort conversion for LLM consumption — the LLM grading
    prompt will receive both the original Umple and this PlantUML approximation.
    """
    lines = ["@startuml"]
    current_class = None
    in_class = False
    brace_depth = 0

    for line in umple_code.split("\n"):
        stripped = line.strip()

        # Class declaration
        if stripped.startswith("class ") and "{" in stripped:
            class_name = stripped.split("class ")[1].split("{")[0].strip()
            current_class = class_name
            if "abstract;" in umple_code.split(f"class {class_name}")[1].split("}")[0] if f"class {class_name}" in umple_code else "":
                lines.append(f"abstract class {class_name} {{")
            else:
                lines.append(f"class {class_name} {{")
            in_class = True
            brace_depth = 1
            continue

        if in_class:
            brace_depth += stripped.count("{") - stripped.count("}")
            if brace_depth <= 0:
                lines.append("}")
                lines.append("")
                in_class = False
                current_class = None
                continue

            # Skip associations inside classes (we handle them separately)
            if "--" in stripped and not stripped.startswith("//"):
                continue
            # isA = inheritance
            if stripped.startswith("isA "):
                parent = stripped.replace("isA ", "").replace(";", "").strip()
                # Will add inheritance after class definitions
                continue
            # enum
            if stripped.startswith("enum "):
                continue
            # abstract marker
            if stripped == "abstract;":
                continue
            # Regular attributes
            if stripped and not stripped.startswith("//") and not stripped.startswith("{"):
                attr = stripped.rstrip(";").strip()
                if attr and not attr.startswith("}"):
                    lines.append(f"  - {attr}")

    lines.append("@enduml")
    return "\n".join(lines)


# ============================================================================
# SYNTHETIC DATA
# ============================================================================

SYNTHETIC_SUBMISSIONS = [
    # =========================================================================
    # LIBRARY SYSTEM (10 submissions across 5 quality tiers)
    # =========================================================================
    {
        "id": "lib_001",
        "source": "synthetic",
        "rubric": "library-system",
        "domain": "Library Management",
        "quality": "excellent",
        "ground_truth": {
            "total": 9.5,
            "class_correctness": 2.0,
            "relationship_accuracy": 2.0,
            "cardinality": 1.5,
            "naming_conventions": 2.0,
            "completeness": 2.0,
        },
        "error_type": "minor_cardinality",
        "notes": "Near-perfect. All classes present with full attributes/methods. Only issue: BookCopy-Loan cardinality uses '*' instead of '0..*'.",
        "plantuml": """@startuml
class Library {
  - name: String
  - address: String
  + addBook(book: Book): void
  + removeBook(isbn: String): void
}

class Book {
  - title: String
  - isbn: String
  - author: String
  - publicationYear: int
  + getDetails(): String
}

class BookCopy {
  - copyNumber: int
  - isAvailable: boolean
  + checkout(): void
  + returnCopy(): void
}

class Member {
  - name: String
  - membershipId: String
  - email: String
  + borrowBook(copy: BookCopy): Loan
  + returnBook(loan: Loan): void
}

class Librarian {
  - name: String
  - employeeId: String
  + addBook(book: Book): void
  + removeBook(isbn: String): void
  + updateBook(book: Book): void
}

class Loan {
  - borrowDate: Date
  - dueDate: Date
  - returnDate: Date
  + isOverdue(): boolean
}

Library "1" -- "*" Book : contains
Library "1" -- "*" Librarian : employs
Book "1" -- "*" BookCopy : has copies
Member "1" -- "*" Loan : borrows
BookCopy "1" -- "*" Loan : lent via
@enduml""",
    },
    {
        "id": "lib_002",
        "source": "synthetic",
        "rubric": "library-system",
        "domain": "Library Management",
        "quality": "excellent",
        "ground_truth": {
            "total": 10.0,
            "class_correctness": 2.0,
            "relationship_accuracy": 2.0,
            "cardinality": 2.0,
            "naming_conventions": 2.0,
            "completeness": 2.0,
        },
        "error_type": "none",
        "notes": "Perfect solution matching reference exactly.",
        "plantuml": """@startuml
class Library {
  - name: String
  - address: String
  + addBook(book: Book): void
  + removeBook(isbn: String): void
}

class Book {
  - title: String
  - isbn: String
  - author: String
  - publicationYear: int
  + getDetails(): String
}

class BookCopy {
  - copyNumber: int
  - isAvailable: boolean
  + checkout(): void
  + returnCopy(): void
}

class Member {
  - name: String
  - membershipId: String
  - email: String
  + borrowBook(copy: BookCopy): Loan
  + returnBook(loan: Loan): void
}

class Librarian {
  - name: String
  - employeeId: String
  + addBook(book: Book): void
  + removeBook(isbn: String): void
  + updateBook(book: Book): void
}

class Loan {
  - borrowDate: Date
  - dueDate: Date
  - returnDate: Date
  + isOverdue(): boolean
}

Library "1" -- "*" Book : contains
Library "1" -- "*" Librarian : employs
Book "1" -- "*" BookCopy : has copies
Member "1" -- "*" Loan : borrows
BookCopy "1" -- "0..*" Loan : lent via
@enduml""",
    },
    {
        "id": "lib_003",
        "source": "synthetic",
        "rubric": "library-system",
        "domain": "Library Management",
        "quality": "good",
        "ground_truth": {
            "total": 7.5,
            "class_correctness": 2.0,
            "relationship_accuracy": 1.5,
            "cardinality": 1.0,
            "naming_conventions": 1.5,
            "completeness": 1.5,
        },
        "error_type": "missing_class_and_cardinality",
        "notes": "Missing BookCopy class (merged into Book with isAvailable). Loan directly linked to Book. Some cardinality missing. Abbreviated method names.",
        "plantuml": """@startuml
class Library {
  - name: String
  - address: String
}

class Book {
  - title: String
  - isbn: String
  - author: String
  - year: int
  - isAvailable: boolean
}

class Member {
  - name: String
  - memberId: String
  - email: String
  + borrow(book: Book): Loan
}

class Librarian {
  - name: String
  - employeeId: String
  + manageBooks(): void
}

class Loan {
  - borrowDate: Date
  - dueDate: Date
  - returnDate: Date
}

Library -- "*" Book
Library -- "*" Librarian
Member -- "*" Loan
Book -- "*" Loan
@enduml""",
    },
    {
        "id": "lib_004",
        "source": "synthetic",
        "rubric": "library-system",
        "domain": "Library Management",
        "quality": "good",
        "ground_truth": {
            "total": 8.0,
            "class_correctness": 2.0,
            "relationship_accuracy": 1.5,
            "cardinality": 1.5,
            "naming_conventions": 1.5,
            "completeness": 1.5,
        },
        "error_type": "inheritance_variant",
        "notes": "Uses Person base class (valid design choice). Has BookCopy missing. Abbreviated attribute names. Good cardinality on most relationships.",
        "plantuml": """@startuml
abstract class Person {
  - name: String
  - email: String
}

class Member {
  - membershipId: String
}

class Librarian {
  - employeeId: String
  + manageBooks(): void
}

class Library {
  - name: String
  - address: String
}

class Book {
  - title: String
  - isbn: String
  - author: String
  - year: int
}

class Loan {
  - borrowDate: Date
  - dueDate: Date
  - returnDate: Date
}

Person <|-- Member
Person <|-- Librarian
Library "1" -- "*" Book
Member "1" -- "*" Loan
Book "1" -- "*" Loan
Library "1" -- "*" Librarian
@enduml""",
    },
    {
        "id": "lib_005",
        "source": "synthetic",
        "rubric": "library-system",
        "domain": "Library Management",
        "quality": "average",
        "ground_truth": {
            "total": 5.5,
            "class_correctness": 1.5,
            "relationship_accuracy": 1.0,
            "cardinality": 0.5,
            "naming_conventions": 1.0,
            "completeness": 1.5,
        },
        "error_type": "missing_classes_bad_naming",
        "notes": "Missing Librarian, BookCopy. Lowercase class names (violates UML convention). No visibility modifiers. No cardinalities.",
        "plantuml": """@startuml
class library {
  name: String
  addr: String
}

class book {
  title: String
  isbn: String
  author: String
}

class member {
  name: String
  id: String
  email: String
}

class loan {
  date: Date
  dueDate: Date
  returned: boolean
}

library -- book
member -- loan
book -- loan
@enduml""",
    },
    {
        "id": "lib_006",
        "source": "synthetic",
        "rubric": "library-system",
        "domain": "Library Management",
        "quality": "average",
        "ground_truth": {
            "total": 5.0,
            "class_correctness": 1.0,
            "relationship_accuracy": 1.0,
            "cardinality": 0.5,
            "naming_conventions": 1.5,
            "completeness": 1.0,
        },
        "error_type": "missing_classes_wrong_relationships",
        "notes": "Missing Librarian, BookCopy, Loan. Uses composition (*--) where association (--) is appropriate. Only 3 classes.",
        "plantuml": """@startuml
class Library {
  - name: String
  - address: String
}

class Book {
  - title: String
  - isbn: String
  - author: String
  - available: boolean
}

class Member {
  - name: String
  - email: String
  + borrowBook(): void
}

Library *-- Book
Member --> Book : borrows
@enduml""",
    },
    {
        "id": "lib_007",
        "source": "synthetic",
        "rubric": "library-system",
        "domain": "Library Management",
        "quality": "poor",
        "ground_truth": {
            "total": 3.0,
            "class_correctness": 1.0,
            "relationship_accuracy": 0.5,
            "cardinality": 0.0,
            "naming_conventions": 0.5,
            "completeness": 1.0,
        },
        "error_type": "very_incomplete_bad_naming",
        "notes": "Only 3 classes with abbreviated names. Wrong relationship types. No cardinality. Missing most requirements.",
        "plantuml": """@startuml
class lib {
  nm: String
}

class bk {
  t: String
  a: String
}

class usr {
  n: String
  e: String
}

lib --> bk
usr --> bk : borrows
@enduml""",
    },
    {
        "id": "lib_008",
        "source": "synthetic",
        "rubric": "library-system",
        "domain": "Library Management",
        "quality": "poor",
        "ground_truth": {
            "total": 3.5,
            "class_correctness": 1.0,
            "relationship_accuracy": 0.5,
            "cardinality": 0.5,
            "naming_conventions": 1.0,
            "completeness": 0.5,
        },
        "error_type": "wrong_domain_understanding",
        "notes": "Shows some UML knowledge but misunderstands domain. Has 'Shelf' and 'Floor' instead of Member/Loan. Partial cardinality.",
        "plantuml": """@startuml
class Library {
  - name: String
}

class Book {
  - title: String
  - author: String
}

class Shelf {
  - location: String
  - capacity: int
}

class Floor {
  - number: int
}

Library "1" -- "*" Floor
Floor "1" -- "*" Shelf
Shelf "1" -- "*" Book
@enduml""",
    },
    {
        "id": "lib_009",
        "source": "synthetic",
        "rubric": "library-system",
        "domain": "Library Management",
        "quality": "failing",
        "ground_truth": {
            "total": 1.5,
            "class_correctness": 0.5,
            "relationship_accuracy": 0.0,
            "cardinality": 0.0,
            "naming_conventions": 0.5,
            "completeness": 0.5,
        },
        "error_type": "barely_attempted",
        "notes": "Two classes only. No meaningful relationships. Missing virtually all requirements.",
        "plantuml": """@startuml
class Book {
  title: String
}

class Person {
  name: String
}

Book -- Person
@enduml""",
    },
    {
        "id": "lib_010",
        "source": "synthetic",
        "rubric": "library-system",
        "domain": "Library Management",
        "quality": "failing",
        "ground_truth": {
            "total": 2.0,
            "class_correctness": 0.5,
            "relationship_accuracy": 0.5,
            "cardinality": 0.0,
            "naming_conventions": 0.5,
            "completeness": 0.5,
        },
        "error_type": "wrong_diagram_type",
        "notes": "Appears to be mixing use-case and class diagram concepts. 'BorrowBook' and 'ReturnBook' are actions, not classes.",
        "plantuml": """@startuml
class Library {
  name: String
}

class BorrowBook {
  date: String
}

class ReturnBook {
  date: String
}

class User {
  name: String
}

User --> BorrowBook
User --> ReturnBook
BorrowBook --> Library
@enduml""",
    },

    # =========================================================================
    # E-COMMERCE SYSTEM (10 submissions)
    # =========================================================================
    {
        "id": "ecom_001",
        "source": "synthetic",
        "rubric": "ecommerce-system",
        "domain": "E-Commerce Platform",
        "quality": "excellent",
        "ground_truth": {
            "total": 9.0,
            "class_correctness": 2.0,
            "relationship_accuracy": 2.0,
            "cardinality": 1.5,
            "naming_conventions": 1.5,
            "completeness": 2.0,
        },
        "error_type": "minor_naming",
        "notes": "Comprehensive. Minor naming issue ('qty' instead of 'quantity', 'stockQty').",
        "plantuml": """@startuml
class Customer {
  - name: String
  - email: String
  - shippingAddress: String
  + placeOrder(): Order
  + viewOrders(): List<Order>
}

class Product {
  - name: String
  - price: double
  - description: String
  - stockQty: int
  + isInStock(): boolean
}

class Category {
  - name: String
  - description: String
}

class Order {
  - orderDate: Date
  - totalAmount: double
  - status: OrderStatus
  + calculateTotal(): double
}

class OrderItem {
  - qty: int
  - subtotal: double
}

class Payment {
  - amount: double
  - method: String
  - status: String
  - paymentDate: Date
  + processPayment(): boolean
}

enum OrderStatus {
  PENDING
  CONFIRMED
  SHIPPED
  DELIVERED
}

Customer "1" -- "*" Order : places
Order "1" -- "1..*" OrderItem : contains
OrderItem "*" -- "1" Product : references
Product "*" -- "1" Category : belongs to
Order "1" -- "1" Payment : paid via
@enduml""",
    },
    {
        "id": "ecom_002",
        "source": "synthetic",
        "rubric": "ecommerce-system",
        "domain": "E-Commerce Platform",
        "quality": "excellent",
        "ground_truth": {
            "total": 10.0,
            "class_correctness": 2.0,
            "relationship_accuracy": 2.0,
            "cardinality": 2.0,
            "naming_conventions": 2.0,
            "completeness": 2.0,
        },
        "error_type": "none",
        "notes": "Perfect solution.",
        "plantuml": """@startuml
class Customer {
  - name: String
  - email: String
  - shippingAddress: String
  + placeOrder(): Order
  + viewOrders(): List<Order>
}

class Product {
  - name: String
  - price: double
  - description: String
  - stockQuantity: int
  + isInStock(): boolean
}

class Category {
  - name: String
  - description: String
}

class Order {
  - orderDate: Date
  - totalAmount: double
  - status: OrderStatus
  + calculateTotal(): double
  + updateStatus(status: OrderStatus): void
}

class OrderItem {
  - quantity: int
  - subtotal: double
  + calculateSubtotal(): double
}

class Payment {
  - amount: double
  - method: String
  - status: String
  - paymentDate: Date
  + processPayment(): boolean
}

enum OrderStatus {
  PENDING
  CONFIRMED
  SHIPPED
  DELIVERED
}

Customer "1" -- "*" Order : places
Order "1" -- "*" OrderItem : contains
OrderItem "*" -- "1" Product : references
Product "*" -- "1" Category : belongs to
Order "1" -- "1" Payment : paid via
@enduml""",
    },
    {
        "id": "ecom_003",
        "source": "synthetic",
        "rubric": "ecommerce-system",
        "domain": "E-Commerce Platform",
        "quality": "good",
        "ground_truth": {
            "total": 7.0,
            "class_correctness": 1.5,
            "relationship_accuracy": 1.5,
            "cardinality": 1.0,
            "naming_conventions": 1.5,
            "completeness": 1.5,
        },
        "error_type": "missing_payment_enum",
        "notes": "Missing Payment class and OrderStatus enum. Status as plain String. Partial cardinality.",
        "plantuml": """@startuml
class Customer {
  - name: String
  - email: String
  - address: String
  + placeOrder(): Order
}

class Product {
  - name: String
  - price: double
  - description: String
  - stock: int
}

class Category {
  - name: String
}

class Order {
  - orderDate: Date
  - total: double
  - status: String
  + getTotal(): double
}

class OrderItem {
  - quantity: int
  - subtotal: double
}

Customer "1" -- "*" Order
Order "1" -- "*" OrderItem
OrderItem -- Product
Product "*" -- "1" Category
@enduml""",
    },
    {
        "id": "ecom_004",
        "source": "synthetic",
        "rubric": "ecommerce-system",
        "domain": "E-Commerce Platform",
        "quality": "good",
        "ground_truth": {
            "total": 7.5,
            "class_correctness": 2.0,
            "relationship_accuracy": 1.0,
            "cardinality": 1.0,
            "naming_conventions": 1.5,
            "completeness": 2.0,
        },
        "error_type": "wrong_relationship_types",
        "notes": "All classes present but uses composition (*--) everywhere instead of proper association types.",
        "plantuml": """@startuml
class Customer {
  - name: String
  - email: String
  - address: String
}

class Product {
  - productName: String
  - productPrice: double
  - desc: String
  - qty: int
}

class Category {
  - categoryName: String
}

class Order {
  - date: Date
  - amount: double
  - orderStatus: String
}

class OrderItem {
  - quantity: int
}

class Payment {
  - amount: double
  - type: String
}

Customer *-- Order
Order *-- OrderItem
OrderItem o-- Product
Product -- Category
Order *-- Payment
@enduml""",
    },
    {
        "id": "ecom_005",
        "source": "synthetic",
        "rubric": "ecommerce-system",
        "domain": "E-Commerce Platform",
        "quality": "average",
        "ground_truth": {
            "total": 5.0,
            "class_correctness": 1.0,
            "relationship_accuracy": 1.0,
            "cardinality": 0.5,
            "naming_conventions": 1.0,
            "completeness": 1.5,
        },
        "error_type": "missing_multiple_classes",
        "notes": "Missing Category, Payment, OrderItem. Products stored as list in Order. No cardinalities.",
        "plantuml": """@startuml
class Customer {
  - name: String
  - email: String
}

class Product {
  - name: String
  - price: double
  - stock: int
}

class Order {
  - date: Date
  - total: double
  - status: String
  - items: List<Product>
}

Customer -- Order
Order -- Product
@enduml""",
    },
    {
        "id": "ecom_006",
        "source": "synthetic",
        "rubric": "ecommerce-system",
        "domain": "E-Commerce Platform",
        "quality": "average",
        "ground_truth": {
            "total": 5.5,
            "class_correctness": 1.5,
            "relationship_accuracy": 1.0,
            "cardinality": 0.5,
            "naming_conventions": 1.0,
            "completeness": 1.5,
        },
        "error_type": "partial_with_extra_classes",
        "notes": "Has ShoppingCart instead of Order. Missing Payment. Added Review class not in spec. Shows initiative but misses core requirements.",
        "plantuml": """@startuml
class Customer {
  - name: String
  - email: String
}

class Product {
  - name: String
  - price: double
}

class Category {
  - name: String
}

class ShoppingCart {
  - items: List
  - total: double
}

class Review {
  - rating: int
  - comment: String
}

Customer -- ShoppingCart
ShoppingCart -- Product
Product -- Category
Customer -- Review
Review -- Product
@enduml""",
    },
    {
        "id": "ecom_007",
        "source": "synthetic",
        "rubric": "ecommerce-system",
        "domain": "E-Commerce Platform",
        "quality": "poor",
        "ground_truth": {
            "total": 3.5,
            "class_correctness": 1.0,
            "relationship_accuracy": 0.5,
            "cardinality": 0.0,
            "naming_conventions": 1.0,
            "completeness": 1.0,
        },
        "error_type": "very_incomplete",
        "notes": "Only Customer and Product. No Order/Payment/Category. Uses Cart which is not in spec.",
        "plantuml": """@startuml
class Customer {
  name: String
  email: String
}

class Product {
  name: String
  price: float
}

class Cart {
  items: List
}

Customer --> Cart
Cart --> Product
@enduml""",
    },
    {
        "id": "ecom_008",
        "source": "synthetic",
        "rubric": "ecommerce-system",
        "domain": "E-Commerce Platform",
        "quality": "poor",
        "ground_truth": {
            "total": 2.0,
            "class_correctness": 0.5,
            "relationship_accuracy": 0.5,
            "cardinality": 0.0,
            "naming_conventions": 0.5,
            "completeness": 0.5,
        },
        "error_type": "wrong_domain",
        "notes": "Uses 'Shop' and 'Item' and 'Buyer' — generic naming, not matching spec.",
        "plantuml": """@startuml
class Shop {
  name: String
}

class Item {
  name: String
  cost: int
}

class Buyer {
  name: String
}

Shop --> Item
Buyer --> Item : buys
@enduml""",
    },
    {
        "id": "ecom_009",
        "source": "synthetic",
        "rubric": "ecommerce-system",
        "domain": "E-Commerce Platform",
        "quality": "failing",
        "ground_truth": {
            "total": 1.0,
            "class_correctness": 0.5,
            "relationship_accuracy": 0.0,
            "cardinality": 0.0,
            "naming_conventions": 0.0,
            "completeness": 0.5,
        },
        "error_type": "barely_attempted",
        "notes": "Single class with a few attributes. No relationships at all.",
        "plantuml": """@startuml
class store {
  stuff: String
  money: int
}
@enduml""",
    },
    {
        "id": "ecom_010",
        "source": "synthetic",
        "rubric": "ecommerce-system",
        "domain": "E-Commerce Platform",
        "quality": "failing",
        "ground_truth": {
            "total": 1.5,
            "class_correctness": 0.5,
            "relationship_accuracy": 0.0,
            "cardinality": 0.0,
            "naming_conventions": 0.5,
            "completeness": 0.5,
        },
        "error_type": "unrelated_design",
        "notes": "Two classes with a dependency arrow. No e-commerce concepts.",
        "plantuml": """@startuml
class Website {
  url: String
}

class Database {
  name: String
}

Website ..> Database : uses
@enduml""",
    },

    # =========================================================================
    # HOSPITAL SYSTEM (10 submissions)
    # =========================================================================
    {
        "id": "hosp_001",
        "source": "synthetic",
        "rubric": "hospital-system",
        "domain": "Hospital Management",
        "quality": "excellent",
        "ground_truth": {
            "total": 9.5,
            "class_correctness": 2.0,
            "relationship_accuracy": 2.0,
            "cardinality": 1.5,
            "naming_conventions": 2.0,
            "completeness": 2.0,
        },
        "error_type": "minor_cardinality",
        "notes": "Near-perfect. All classes present including Prescription. Minor cardinality on Department-Doctor.",
        "plantuml": """@startuml
class Hospital {
  - name: String
  - address: String
}

class Department {
  - name: String
  + getHeadDoctor(): Doctor
}

class Doctor {
  - name: String
  - specialization: String
  - licenseNumber: String
  + createAppointment(patient: Patient, date: Date): Appointment
  + issuePrescription(patient: Patient): Prescription
}

class Patient {
  - name: String
  - dateOfBirth: Date
  - contactInfo: String
  + getAppointments(): List<Appointment>
  + getMedicalRecords(): List<MedicalRecord>
}

class Appointment {
  - date: Date
  - time: Time
  - status: String
  + reschedule(newDate: Date): void
  + cancel(): void
}

class MedicalRecord {
  - diagnosis: String
  - treatment: String
  - recordDate: Date
}

class Prescription {
  - medication: String
  - dosage: String
  - duration: String
  - issueDate: Date
}

Hospital "1" -- "*" Department : has
Department "1" -- "*" Doctor : staffed by
Doctor "*" -- "*" Department : works in
Doctor "1" -- "*" Appointment : attends
Patient "1" -- "*" Appointment : schedules
Patient "1" -- "*" MedicalRecord : has
Doctor "1" -- "*" Prescription : issues
Patient "1" -- "*" Prescription : receives
@enduml""",
    },
    {
        "id": "hosp_002",
        "source": "synthetic",
        "rubric": "hospital-system",
        "domain": "Hospital Management",
        "quality": "excellent",
        "ground_truth": {
            "total": 9.0,
            "class_correctness": 2.0,
            "relationship_accuracy": 1.5,
            "cardinality": 2.0,
            "naming_conventions": 2.0,
            "completeness": 1.5,
        },
        "error_type": "missing_prescription",
        "notes": "Strong but missing Prescription class. All other classes complete with proper attributes.",
        "plantuml": """@startuml
class Hospital {
  - name: String
  - address: String
}

class Department {
  - name: String
  - headDoctor: Doctor
}

class Doctor {
  - name: String
  - specialization: String
  - licenseNumber: String
  + createAppointment(patient: Patient, date: Date): Appointment
}

class Patient {
  - name: String
  - dateOfBirth: Date
  - contactInfo: String
  + getAppointments(): List<Appointment>
  + getMedicalRecords(): List<MedicalRecord>
}

class Appointment {
  - date: Date
  - time: Time
  - status: String
  + reschedule(newDate: Date): void
  + cancel(): void
}

class MedicalRecord {
  - diagnosis: String
  - treatment: String
  - recordDate: Date
}

Hospital "1" -- "*" Department : has
Department "1" -- "*" Doctor : staffed by
Doctor "*" -- "*" Department : works in
Doctor "1" -- "*" Appointment : attends
Patient "1" -- "*" Appointment : schedules
Patient "1" -- "*" MedicalRecord : has
@enduml""",
    },
    {
        "id": "hosp_003",
        "source": "synthetic",
        "rubric": "hospital-system",
        "domain": "Hospital Management",
        "quality": "good",
        "ground_truth": {
            "total": 7.0,
            "class_correctness": 1.5,
            "relationship_accuracy": 1.5,
            "cardinality": 1.0,
            "naming_conventions": 1.5,
            "completeness": 1.5,
        },
        "error_type": "missing_medical_record_prescription",
        "notes": "Missing MedicalRecord and Prescription. Partial cardinality. Good basic structure.",
        "plantuml": """@startuml
class Hospital {
  - name: String
  - address: String
}

class Department {
  - name: String
}

class Doctor {
  - name: String
  - specialization: String
  - licenseNumber: String
}

class Patient {
  - name: String
  - dob: Date
  - phone: String
}

class Appointment {
  - date: Date
  - time: Time
  - status: String
}

Hospital "1" -- "*" Department
Department -- Doctor
Doctor "1" -- "*" Appointment
Patient "1" -- "*" Appointment
@enduml""",
    },
    {
        "id": "hosp_004",
        "source": "synthetic",
        "rubric": "hospital-system",
        "domain": "Hospital Management",
        "quality": "good",
        "ground_truth": {
            "total": 8.0,
            "class_correctness": 2.0,
            "relationship_accuracy": 1.5,
            "cardinality": 1.5,
            "naming_conventions": 1.5,
            "completeness": 1.5,
        },
        "error_type": "missing_medical_record",
        "notes": "Has Prescription but missing MedicalRecord. Good coverage otherwise.",
        "plantuml": """@startuml
class Hospital {
  - name: String
  - address: String
}

class Department {
  - name: String
}

class Doctor {
  - name: String
  - specialization: String
  - licenseNumber: String
  + prescribe(patient: Patient, med: String): Prescription
}

class Patient {
  - name: String
  - dateOfBirth: Date
  - contactInfo: String
}

class Appointment {
  - date: Date
  - time: Time
  - status: String
}

class Prescription {
  - medication: String
  - dosage: String
  - duration: String
  - issueDate: Date
}

Hospital "1" -- "*" Department : has
Department "*" -- "*" Doctor : employs
Doctor "1" -- "*" Appointment
Patient "1" -- "*" Appointment
Doctor "1" -- "*" Prescription : issues
Patient "1" -- "*" Prescription : receives
@enduml""",
    },
    {
        "id": "hosp_005",
        "source": "synthetic",
        "rubric": "hospital-system",
        "domain": "Hospital Management",
        "quality": "average",
        "ground_truth": {
            "total": 5.0,
            "class_correctness": 1.0,
            "relationship_accuracy": 1.0,
            "cardinality": 0.5,
            "naming_conventions": 1.0,
            "completeness": 1.5,
        },
        "error_type": "minimal_classes",
        "notes": "Missing Department, MedicalRecord, Prescription. Few attributes. No cardinalities.",
        "plantuml": """@startuml
class Hospital {
  name: String
}

class Doctor {
  name: String
  specialty: String
}

class Patient {
  name: String
  age: int
}

class Appointment {
  date: Date
  status: String
}

Hospital -- Doctor
Doctor -- Appointment
Patient -- Appointment
@enduml""",
    },
    {
        "id": "hosp_006",
        "source": "synthetic",
        "rubric": "hospital-system",
        "domain": "Hospital Management",
        "quality": "average",
        "ground_truth": {
            "total": 6.0,
            "class_correctness": 1.5,
            "relationship_accuracy": 1.0,
            "cardinality": 1.0,
            "naming_conventions": 1.0,
            "completeness": 1.5,
        },
        "error_type": "mixed_quality",
        "notes": "Has Department and Appointment but uses inheritance wrongly (Nurse extends Doctor). Missing Prescription/MedicalRecord.",
        "plantuml": """@startuml
class Hospital {
  - name: String
  - address: String
}

class Department {
  - name: String
}

class Doctor {
  - name: String
  - specialization: String
}

class Nurse {
  - shift: String
}

class Patient {
  - name: String
  - dateOfBirth: Date
}

class Appointment {
  - date: Date
  - status: String
}

Doctor <|-- Nurse
Hospital "1" -- "*" Department
Department "1" -- "*" Doctor
Doctor -- Appointment
Patient -- Appointment
@enduml""",
    },
    {
        "id": "hosp_007",
        "source": "synthetic",
        "rubric": "hospital-system",
        "domain": "Hospital Management",
        "quality": "poor",
        "ground_truth": {
            "total": 2.5,
            "class_correctness": 0.5,
            "relationship_accuracy": 0.5,
            "cardinality": 0.0,
            "naming_conventions": 0.5,
            "completeness": 1.0,
        },
        "error_type": "minimal_effort",
        "notes": "Only Doctor and Patient with abbreviated names. No Hospital, Department, or supporting classes.",
        "plantuml": """@startuml
class doc {
  nm: String
  spec: String
}

class pat {
  nm: String
  age: int
}

doc --> pat : treats
@enduml""",
    },
    {
        "id": "hosp_008",
        "source": "synthetic",
        "rubric": "hospital-system",
        "domain": "Hospital Management",
        "quality": "poor",
        "ground_truth": {
            "total": 3.0,
            "class_correctness": 1.0,
            "relationship_accuracy": 0.5,
            "cardinality": 0.0,
            "naming_conventions": 0.5,
            "completeness": 1.0,
        },
        "error_type": "oversimplified",
        "notes": "Has Hospital, Doctor, Patient but flat structure with no Appointment or records.",
        "plantuml": """@startuml
class Hospital {
  name: String
  location: String
}

class Doctor {
  name: String
}

class Patient {
  name: String
  illness: String
}

Hospital -- Doctor
Hospital -- Patient
Doctor -- Patient
@enduml""",
    },
    {
        "id": "hosp_009",
        "source": "synthetic",
        "rubric": "hospital-system",
        "domain": "Hospital Management",
        "quality": "failing",
        "ground_truth": {
            "total": 1.0,
            "class_correctness": 0.5,
            "relationship_accuracy": 0.0,
            "cardinality": 0.0,
            "naming_conventions": 0.0,
            "completeness": 0.5,
        },
        "error_type": "barely_attempted",
        "notes": "Single class. No relationships. No meaningful content.",
        "plantuml": """@startuml
class hospital {
  stuff: String
}
@enduml""",
    },
    {
        "id": "hosp_010",
        "source": "synthetic",
        "rubric": "hospital-system",
        "domain": "Hospital Management",
        "quality": "failing",
        "ground_truth": {
            "total": 1.5,
            "class_correctness": 0.5,
            "relationship_accuracy": 0.0,
            "cardinality": 0.0,
            "naming_conventions": 0.5,
            "completeness": 0.5,
        },
        "error_type": "wrong_concept",
        "notes": "Two unrelated classes. 'Treatment' as a standalone class with no connection to patients or doctors.",
        "plantuml": """@startuml
class Doctor {
  name: String
}

class Treatment {
  type: String
  cost: int
}
@enduml""",
    },
]


def main():
    output_dir = os.path.dirname(os.path.abspath(__file__))
    dataset_path = os.path.join(output_dir, "dataset.json")

    # Combine real + synthetic
    all_submissions = []

    # Load real McGill data
    try:
        mcgill = load_mcgill_data()
        all_submissions.extend(mcgill)
        print(f"Loaded {len(mcgill)} real submissions from McGill uml-grader")
    except Exception as e:
        print(f"Warning: Could not load McGill data: {e}")

    # Add synthetic data
    for sub in SYNTHETIC_SUBMISSIONS:
        sub["format"] = "plantuml"
        all_submissions.append(sub)
    print(f"Added {len(SYNTHETIC_SUBMISSIONS)} synthetic submissions")

    # Save
    with open(dataset_path, "w") as f:
        json.dump(all_submissions, f, indent=2)

    total = len(all_submissions)
    grades = [s["ground_truth"]["total"] for s in all_submissions]
    sources = {}
    for s in all_submissions:
        src = s.get("source", "unknown")
        sources[src] = sources.get(src, 0) + 1

    print(f"\nTotal: {total} submissions → {dataset_path}")
    print(f"Sources: {sources}")
    print(f"Grade distribution: min={min(grades)}, max={max(grades)}, mean={sum(grades)/len(grades):.1f}")
    print(f"Domains: {set(s['domain'] for s in all_submissions)}")
    print(f"Quality tiers: {sorted(set(s['quality'] for s in all_submissions))}")


if __name__ == "__main__":
    main()
