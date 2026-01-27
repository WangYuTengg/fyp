# Example Simple UML Questions (with PlantUML Answers)# Example UML Questions (Simple)




































































































```@endumlstopendif  :Show error message;else (no)  :Show confirmation;  :Save submission;if (Valid?) then (yes):Validate file;:Upload file;start@startuml```plantuml**Answer (PlantUML):****Question:** Draw a UML activity diagram for submitting an assignment: start → upload file → validate file → if valid, save submission and show confirmation; if invalid, show error → end.## 5) Assignment submission activity```@endumlend  AuthService --> User : failure(errorMessage)else invalid credentials  AuthService --> User : success(sessionToken)alt user exists and password matchesDatabase --> AuthService : userRecord / nullAuthService -> Database : findUserByEmail(email)User -> AuthService : login(email, password)database Databaseparticipant AuthServiceactor User@startuml```plantuml**Answer (PlantUML):****Question:** Draw a UML sequence diagram for a user logging in: `User` sends `login(email, password)` to `AuthService`, which checks with `Database`, and returns either `success` or `failure` to `User`.## 4) Login sequence```@endumlVehicle <|-- BicycleVehicle <|-- Car}  +hasBell: booleanclass Bicycle {}  +numDoors: intclass Car {}  +speed: intclass Vehicle {@startuml```plantuml**Answer (PlantUML):****Question:** Draw a UML class diagram with inheritance: `Vehicle` (with `speed: int`) is a parent of `Car` and `Bicycle`.## 3) Vehicle inheritance```@endumlLibrary *-- "0..*" Book : contains}  +author: string  +title: stringclass Book {}  +name: stringclass Library {@startuml```plantuml**Answer (PlantUML):****Question:** Draw a UML class diagram showing a `Library` that contains many `Book`s (composition). `Book` has `title: string` and `author: string`.## 2) Library contains Books (composition)```@enduml}  +enroll(courseCode: string): void  +name: string  +id: intclass Student {@startuml```plantuml**Answer (PlantUML):****Question:** Draw a UML class diagram for a `Student` with `id: int`, `name: string`, and a method `enroll(courseCode: string): void`.## 1) Student class
Below are 5 simple UML questions suitable for students, with answers provided as PlantUML.

---

## 1) Class diagram: Student

**Question:** Draw a UML class diagram for a `Student` with `id: int`, `name: string`, and a method `enroll(courseCode: string): void`.

**Answer (PlantUML):**

```plantuml
@startuml
class Student {
  +id: int
  +name: string
  +enroll(courseCode: string): void
}
@enduml
```

---

## 2) Class diagram: Library contains Books (composition)

**Question:** Draw a UML class diagram showing a `Library` that contains many `Book`s (composition). `Book` has `title: string` and `author: string`.

**Answer (PlantUML):**

```plantuml
@startuml
class Library {
  +name: string
}

class Book {
  +title: string
  +author: string
}

Library *-- "0..*" Book : contains
@enduml
```

---

## 3) Class diagram: Inheritance

**Question:** Draw a UML class diagram with inheritance: `Vehicle` (with `speed: int`) is a parent of `Car` and `Bicycle`.

**Answer (PlantUML):**

```plantuml
@startuml
class Vehicle {
  +speed: int
}

class Car {
  +numDoors: int
}

class Bicycle {
  +hasBell: boolean
}

Vehicle <|-- Car
Vehicle <|-- Bicycle
@enduml
```

---

## 4) Sequence diagram: Login flow

**Question:** Draw a UML sequence diagram for a user logging in: `User` sends `login(email, password)` to `AuthService`, which checks with `Database`, and returns either `success` or `failure` to `User`.

**Answer (PlantUML):**

```plantuml
@startuml
actor User
participant AuthService
database Database

User -> AuthService : login(email, password)
AuthService -> Database : findUserByEmail(email)
Database --> AuthService : userRecord / null

alt user exists and password matches
  AuthService --> User : success(sessionToken)
else invalid credentials
  AuthService --> User : failure(errorMessage)
end
@enduml
```

---

## 5) Activity diagram: Submit assignment

**Question:** Draw a UML activity diagram for submitting an assignment: start → upload file → validate file → if valid, save submission and show confirmation; if invalid, show error → end.

**Answer (PlantUML):**

```plantuml
@startuml
start
:Upload file;
:Validate file;

if (Valid?) then (yes)
  :Save submission;
  :Show confirmation;
else (no)
  :Show error message;
endif

stop
@enduml
```
