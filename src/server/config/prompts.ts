/**
 * LLM Prompt Templates
 * Versioned prompts for auto-grading
 * Store version in aiGradingSuggestion for audit trail
 */

export const PROMPT_VERSION = process.env.PROMPT_VERSION || 'v1';

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

      user: (params: {
        studentAnswer: string;
        modelAnswer: string;
        maxPoints: number;
        rubric?: Array<{ id: string; description: string; maxPoints: number }>;
      }) => {
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
    },
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

      userText: (params: {
        studentUML: string;
        referenceUML: string;
        maxPoints: number;
      }) => `Grade the following student UML diagram:

**Student PlantUML Code:**
\`\`\`plantuml
${params.studentUML}
\`\`\`

**Reference PlantUML Code:**
\`\`\`plantuml
${params.referenceUML}
\`\`\`

**Maximum Points:** ${params.maxPoints}

Compare the diagrams and provide a score (0-${params.maxPoints}) with detailed reasoning.`,

      userImage: (params: {
        referenceUML: string;
        maxPoints: number;
      }) => `Analyze the UML diagram in the provided image.

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
    },
  },
} as const;

/**
 * Get active prompt for question type
 */
export function getPrompt(type: 'written' | 'uml') {
  return prompts[type][PROMPT_VERSION as 'v1'];
}
