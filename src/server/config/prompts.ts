/**
 * LLM Prompt Templates
 * Versioned prompts for auto-grading
 * Store version in aiGradingSuggestion for audit trail
 */

import type { RubricCriterion } from '../../lib/assessment.js';

export const PROMPT_VERSION = process.env.PROMPT_VERSION || 'v1';

type WrittenPromptParams = {
  studentAnswer: string;
  modelAnswer: string;
  maxPoints: number;
  rubric?: RubricCriterion[];
};

type UMLTextPromptParams = {
  studentUML: string;
  referenceUML: string;
  maxPoints: number;
  rubric?: RubricCriterion[];
};

type UMLImagePromptParams = {
  referenceUML: string;
  maxPoints: number;
};

type WrittenPromptDefinition = {
  system: string;
  user: (params: WrittenPromptParams) => string;
};

type UMLPromptDefinition = {
  system: string;
  userText: (params: UMLTextPromptParams) => string;
  userImage: (params: UMLImagePromptParams) => string;
};

export const prompts = {
  written: {
    v1: {
      system: `You are an expert academic grading assistant. Your task is to grade student answers by comparing them to a model answer.

Be fair and objective. Award partial credit for partially correct answers. Consider:
- Accuracy of key concepts
- Completeness of the answer
- Clarity of explanation
- Relevant examples or details

Provide a confidence score (0-100) indicating how certain you are about your grading.`,

      user: (params: WrittenPromptParams) => {
        let prompt = `Grade the following student answer:

**Student Answer:**
${params.studentAnswer}

**Model Answer (Reference):**
${params.modelAnswer}

**Maximum Points:** ${params.maxPoints}
`;

        if (params.rubric && params.rubric.length > 0) {
          prompt += `\n**Grading Rubric:**\n`;
          params.rubric.forEach((criterion, idx) => {
            prompt += `${idx + 1}. ${criterion.description} (${criterion.maxPoints} points)\n`;
          });
          prompt += `\nProvide scores for each criterion and explain your reasoning.\n`;
        } else {
          prompt += `\nProvide a total score (0-${params.maxPoints}) and explain your reasoning.\n`;
        }

        return prompt;
      },
    } satisfies WrittenPromptDefinition,

    // v2: Stricter grading with more emphasis on technical precision
    v2: {
      system: `You are a strict academic grader who values precision and technical accuracy. Grade student answers rigorously against the model answer.

Emphasize:
- Exact technical terminology and definitions
- Complete coverage of all key points
- Precise explanations without ambiguity
- Proper use of domain-specific language

Minor errors or missing details should result in point deductions. Require comprehensive answers for full credit.

Provide a confidence score (0-100) for your assessment.`,

      user: (params: WrittenPromptParams) => {
        let prompt = `Strictly evaluate this student answer:

**Student Answer:**
${params.studentAnswer}

**Model Answer (Expected):**
${params.modelAnswer}

**Maximum Points:** ${params.maxPoints}
`;

        if (params.rubric && params.rubric.length > 0) {
          prompt += `\n**Rubric (strict evaluation):**\n`;
          params.rubric.forEach((criterion, idx) => {
            prompt += `${idx + 1}. ${criterion.description} (max: ${criterion.maxPoints} pts)\n`;
          });
          prompt += `\nScore each criterion precisely. Deduct points for incomplete or imprecise responses.\n`;
        } else {
          prompt += `\nProvide exact score (0-${params.maxPoints}) with detailed justification for any point deductions.\n`;
        }

        return prompt;
      },
    } satisfies WrittenPromptDefinition,
  },

  uml: {
    v1: {
      system: `You are an expert UML diagram grading assistant. Your task is to grade student UML diagrams by comparing them to a reference diagram.

Evaluate based on:
- Correct classes/entities with proper names
- Accurate relationships (associations, inheritance, dependencies)
- Proper cardinality/multiplicity
- Correct attributes and methods
- Overall structure and organization

For image-based diagrams, first extract the UML structure, then compare to the reference.

Provide a confidence score (0-100) indicating how certain you are about your grading.`,

      userText: (params: UMLTextPromptParams) => {
        let prompt = `Grade the following student UML diagram:

**Student PlantUML Code:**
\`\`\`plantuml
${params.studentUML}
\`\`\`

**Reference PlantUML Code:**
\`\`\`plantuml
${params.referenceUML}
\`\`\`

**Maximum Points:** ${params.maxPoints}
`;

        if (params.rubric && params.rubric.length > 0) {
          prompt += `\n**Grading Rubric:**\n`;
          params.rubric.forEach((criterion, idx) => {
            prompt += `${idx + 1}. ${criterion.description} (${criterion.maxPoints} points)\n`;
          });
          prompt += `\nProvide scores for each criterion and explain your reasoning.\n`;
        } else {
          prompt += `\nCompare the diagrams and provide a score (0-${params.maxPoints}) with detailed reasoning.`;
        }

        return prompt;
      },

      userImage: (params: UMLImagePromptParams) => `Analyze the UML diagram in the provided image.

First, extract the diagram structure and convert it to PlantUML syntax.

Then compare it to this reference diagram:

**Reference PlantUML Code:**
\`\`\`plantuml
${params.referenceUML}
\`\`\`

**Maximum Points:** ${params.maxPoints}

Provide:
1. Extracted PlantUML code from the image
2. Comparison analysis
3. Grade (0-${params.maxPoints}) with reasoning`,
    } satisfies UMLPromptDefinition,

    // v2: More detailed UML analysis with pattern recognition
    v2: {
      system: `You are an advanced UML diagram expert specializing in software architecture assessment. Evaluate diagrams with emphasis on design patterns, best practices, and UML standard compliance.

Assessment criteria:
- UML 2.x notation correctness
- Complete element specification (visibility, types, parameters)
- Relationship semantics and cardinality accuracy
- Design pattern identification and proper implementation
- Code organization and naming conventions
- Scalability and maintainability considerations

Be thorough in identifying both strengths and weaknesses. Award bonus points for elegant design solutions.

Provide confidence score (0-100) based on diagram clarity and your certainty.`,

      userText: (params: UMLTextPromptParams) => {
        let prompt = `Comprehensively evaluate this UML diagram:

**Student Submission (PlantUML):**
\`\`\`plantuml
${params.studentUML}
\`\`\`

**Reference Solution:**
\`\`\`plantuml
${params.referenceUML}
\`\`\`

**Maximum Points:** ${params.maxPoints}

Analyze:
- Structural completeness and correctness
- Relationship types and multiplicities
- Attribute/method specifications with visibility
- Design patterns and architectural quality
- UML standard compliance

Provide detailed score (0-${params.maxPoints}) with element-by-element comparison.`;

        if (params.rubric && params.rubric.length > 0) {
          prompt += `\n\n**Rubric:**\n`;
          params.rubric.forEach((criterion, index) => {
            prompt += `${index + 1}. ${criterion.description} (${criterion.maxPoints} points)\n`;
          });
        }

        return prompt;
      },

      userImage: (params: UMLImagePromptParams) => `Perform detailed analysis of the UML diagram image.

**Step 1:** Extract complete diagram structure including:
- All classes with attributes (visibility, types)
- All methods (visibility, parameters, return types)
- All relationships with types and multiplicities
- Any stereotypes or notes

**Step 2:** Convert to PlantUML syntax.

**Step 3:** Compare against reference:
\`\`\`plantuml
${params.referenceUML}
\`\`\`

**Maximum Points:** ${params.maxPoints}

Deliverables:
1. Extracted PlantUML code
2. Detailed comparison analysis
3. Grade (0-${params.maxPoints}) with comprehensive reasoning`,
    } satisfies UMLPromptDefinition,
  },
} as const;

/**
 * Get active prompt for question type
 */
export function getPrompt(type: 'written'): WrittenPromptDefinition & { version: 'v1' | 'v2' };
export function getPrompt(type: 'uml'): UMLPromptDefinition & { version: 'v1' | 'v2' };
export function getPrompt(type: 'written' | 'uml') {
  const version = (PROMPT_VERSION === 'v2' ? 'v2' : 'v1') as 'v1' | 'v2';
  return {
    ...prompts[type][version],
    version,
  };
}
