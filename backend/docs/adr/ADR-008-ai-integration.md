# ADR-008: AI Integration for Project Review

## Status
Accepted

## Date
2026-03-03

## Context
Dashboard Starteria includes an AI-powered review feature that evaluates project steps and provides structured feedback to entrepreneurs. The AI review process must:

- Analyze submitted step content (text, evidence descriptions) and provide constructive feedback
- Generate structured output with scores, strengths, weaknesses, and actionable recommendations
- Support the 4-step innovation methodology (Ideation, Validation, Prototyping, Launch)
- Process reviews asynchronously — AI analysis may take 10-30 seconds
- Be cost-effective for potentially hundreds of reviews per month
- Produce consistent, repeatable feedback aligned with the platform's evaluation criteria
- Not block the user experience while processing

## Decision
We will integrate **Anthropic Claude API via a dedicated service module** with asynchronous processing and webhook-style callback.

### Architecture
- **AI Provider**: Anthropic Claude (claude-sonnet-4-20250514 for reviews, upgradeable to claude-opus-4-20250514 for complex evaluations)
- **Service Module**: `src/services/ai-review.service.ts` — encapsulates all AI interaction logic
- **Processing Model**: Asynchronous with polling — client submits review request, receives a review ID, polls for completion
- **Structured Output**: Claude generates JSON-formatted feedback using system prompts with output schema

### Review Flow

1. User submits step for AI review: `POST /api/v1/ai-review/steps/:stepId`
2. Backend creates an `AiReview` record with status `pending`, returns review ID
3. Background job sends step content + evaluation rubric to Claude API
4. Claude returns structured feedback JSON
5. Backend updates `AiReview` record with results, sets status to `completed`
6. Frontend polls `GET /api/v1/ai-review/:reviewId` until status is `completed`

### Structured Feedback Schema

```typescript
interface AiReviewResult {
  overallScore: number;          // 1-10
  categoryScores: {
    innovation: number;          // 1-10
    feasibility: number;         // 1-10
    marketFit: number;           // 1-10
    execution: number;           // 1-10
  };
  strengths: string[];           // 3-5 key strengths
  weaknesses: string[];          // 3-5 areas for improvement
  recommendations: string[];     // 3-5 actionable next steps
  summary: string;               // 2-3 paragraph overall assessment
}
```

### Prompt Engineering
- System prompt defines the evaluator persona (innovation mentor) and evaluation criteria
- Step-specific prompts include the step's methodology context (what this step should demonstrate)
- Output is constrained to the JSON schema above using Claude's structured output capabilities
- Temperature set to 0.3 for consistent, reproducible evaluations

### Cost Management
- Rate limiting: Max 5 AI reviews per project per day
- Caching: Identical submissions return cached results (content hash-based)
- Model selection: Sonnet for standard reviews, Opus reserved for escalated/complex evaluations
- Token budget: Max 4000 input tokens + 2000 output tokens per review

## Consequences

### Positive
- Claude's strong reasoning capabilities produce high-quality, nuanced feedback for innovation projects
- Structured output ensures consistent feedback format that the frontend can render reliably
- Asynchronous processing prevents API timeouts and provides a smooth user experience
- Dedicated service module isolates AI logic, making it easy to swap providers or update prompts
- Caching reduces costs for repeated submissions of the same content
- Rate limiting prevents abuse and controls costs

### Negative
- External API dependency — Claude API downtime or rate limits affect the review feature
- AI-generated feedback may occasionally be generic or miss domain-specific nuances
- Asynchronous polling adds frontend complexity compared to synchronous responses
- Claude API costs scale with usage — high adoption could increase monthly costs significantly
- Prompt engineering requires ongoing iteration to improve feedback quality
- No offline or local fallback — reviews require internet connectivity to the Anthropic API

### Neutral
- AI reviews supplement but do not replace human mentor feedback — both coexist in the platform
- Review results are stored permanently, enabling future analysis of AI feedback quality and accuracy
- The service module can be extended to support other AI features (project summarization, similarity detection) without architectural changes

## Alternatives Considered

### OpenAI GPT-4
- **Pros**: Well-established API, large community, strong reasoning capabilities, function calling for structured output, extensive documentation
- **Cons**: Higher cost per token compared to Claude for equivalent quality, less consistent structured output without fine-tuning, OpenAI API has experienced more rate limiting and availability issues

### Local/Self-Hosted LLM (Llama, Mistral)
- **Pros**: No per-token cost, full data privacy, no external API dependency, customizable through fine-tuning
- **Cons**: Requires GPU infrastructure (significant cost), higher latency for comparable quality, model management overhead, quality gap compared to frontier models for nuanced evaluation tasks, not feasible for an MVP

### Custom ML Model (Fine-tuned Classifier)
- **Pros**: Optimized for the specific evaluation task, low latency, predictable costs, no external dependency after training
- **Cons**: Requires labeled training data (thousands of evaluated projects), ML engineering expertise, ongoing model maintenance, cannot generate free-form feedback text, not feasible without significant dataset

## References
- Anthropic Claude API: https://docs.anthropic.com/en/api
- Anthropic Structured Output: https://docs.anthropic.com/en/docs/build-with-claude/structured-output
- AI Integration Best Practices: https://docs.anthropic.com/en/docs/build-with-claude/overview
