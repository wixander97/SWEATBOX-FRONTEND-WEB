/**
 * Q&A extraction hook - extracts questions from assistant responses
 *
 * Custom interactive TUI for answering questions.
 *
 * Demonstrates the "prompt generator" pattern with custom TUI:
 * 1. /answer command gets the last assistant message
 * 2. Shows a spinner while extracting questions as structured JSON
 * 3. Presents an interactive TUI to navigate and answer questions
 * 4. Submits the compiled answers when done
 */

import {
  complete,
  type Model,
  type Api,
  type UserMessage,
} from "@mariozechner/pi-ai";
import type {
  ExtensionAPI,
  ExtensionContext,
  ModelRegistry,
} from "@mariozechner/pi-coding-agent";
import { BorderedLoader } from "@mariozechner/pi-coding-agent";
import {
  type Component,
  Editor,
  type EditorTheme,
  Key,
  matchesKey,
  truncateToWidth,
  type TUI,
  visibleWidth,
  wrapTextWithAnsi,
} from "@mariozechner/pi-tui";

// Structured output format for question extraction
interface ExtractedQuestion {
  question: string;
  context?: string;
  options?: string[];
}

interface ExtractionResult {
  questions: ExtractedQuestion[];
}

interface AssistantTextResult {
  id: string;
  text: string;
}

interface AnswerHandlerOptions {
  auto?: boolean;
  assistantText?: AssistantTextResult;
}

const OPEN_QUESTIONS_HEADING_RE =
  /(^|\n)\s{0,3}(?:#{1,6}\s*)?(?:open|clarification) questions?\s*:?\s*(\n|$)/i;

const SYSTEM_PROMPT = `You are a question extractor. Given text from a conversation, extract any questions that need answering.

Output a JSON object with this structure:
{
  "questions": [
    {
      "question": "The question text",
      "context": "Optional context that helps answer the question"
    }
  ]
}

Rules:
- Prefer questions under an "Open questions" or "Clarification questions" heading when present
- Extract all questions that require user input
- Ignore rhetorical questions and generic approval wording such as "Reply with approval" unless it asks for a substantive decision
- Keep questions in the order they appeared
- Be concise with question text
- Include context only when it provides essential information for answering
- If no questions are found, return {"questions": []}

Example output:
{
  "questions": [
    {
      "question": "What is your preferred database?",
      "context": "We can only configure MySQL and PostgreSQL because of what is implemented."
    },
    {
      "question": "Should we use TypeScript or JavaScript?"
    }
  ]
}`;

const CODEX_MODEL_ID = "gpt-5.3";
const HAIKU_MODEL_ID = "claude-haiku-4-5";

/**
 * Prefer GPT-5.3 for extraction when available, otherwise fallback to haiku or the current model.
 */
async function selectExtractionModel(
  currentModel: Model<Api>,
  modelRegistry: ModelRegistry,
): Promise<Model<Api>> {
  const codexModel = modelRegistry.find("openai-codex", CODEX_MODEL_ID);
  if (codexModel) {
    const auth = await modelRegistry.getApiKeyAndHeaders(codexModel);
    if (auth.ok) {
      return codexModel;
    }
  }

  const haikuModel = modelRegistry.find("anthropic", HAIKU_MODEL_ID);
  if (!haikuModel) {
    return currentModel;
  }

  const auth = await modelRegistry.getApiKeyAndHeaders(haikuModel);
  if (!auth.ok) {
    return currentModel;
  }

  return haikuModel;
}

/**
 * Parse the JSON response from the LLM
 */
function parseExtractionResult(text: string): ExtractionResult | null {
  try {
    // Try to find JSON in the response (it might be wrapped in markdown code blocks)
    let jsonStr = text;

    // Remove markdown code block if present
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1].trim();
    }

    const parsed = JSON.parse(jsonStr);
    if (parsed && Array.isArray(parsed.questions)) {
      return parsed as ExtractionResult;
    }
    return null;
  } catch {
    return null;
  }
}

function hasOpenQuestionsHeading(text: string): boolean {
  return OPEN_QUESTIONS_HEADING_RE.test(text);
}

function extractOpenQuestionsFromText(text: string): ExtractionResult | null {
  const lines = text.split(/\r?\n/);
  const startIndex = lines.findIndex((line) => OPEN_QUESTIONS_HEADING_RE.test(line));
  if (startIndex === -1) return null;

  const questions: ExtractedQuestion[] = [];
  let current: { question: string; context: string[]; options: string[] } | null = null;

  const flush = () => {
    if (!current) return;
    const question = current.question.trim();
    if (question.length === 0) return;
    const context = current.context.join("\n").trim();
    questions.push({
      question,
      ...(context ? { context } : {}),
      ...(current.options.length > 0 ? { options: current.options } : {}),
    });
  };

  for (const line of lines.slice(startIndex + 1)) {
    if (/^\s{0,3}#{1,6}\s+\S/.test(line)) break;

    const numbered = line.match(/^\s*(?:[-*]\s*)?(\d+)[.)]\s+(.+)$/);
    if (numbered) {
      flush();
      current = { question: numbered[2].trim(), context: [], options: [] };
      continue;
    }

    if (!current) continue;
    if (line.trim().length === 0) continue;

    const option = line.match(/^\s*[-*]?\s*([A-Z])[.)]\s+(.+)$/i);
    if (option) {
      current.options.push(`${option[1].toUpperCase()}. ${option[2].trim()}`);
      continue;
    }

    current.context.push(line.trim());
  }

  flush();
  return questions.length > 0 ? { questions } : null;
}

function getLastAssistantText(ctx: ExtensionContext): AssistantTextResult | null {
  const branch = ctx.sessionManager.getBranch();

  for (let i = branch.length - 1; i >= 0; i--) {
    const entry = branch[i];
    if (entry.type !== "message") continue;

    const msg = entry.message;
    if (!("role" in msg) || msg.role !== "assistant") continue;

    if (msg.stopReason !== "stop") {
      ctx.ui.notify(
        `Last assistant message incomplete (${msg.stopReason})`,
        "error",
      );
      return null;
    }

    const text = msg.content
      .filter((c): c is { type: "text"; text: string } => c.type === "text")
      .map((c) => c.text)
      .join("\n");

    if (text.length > 0) {
      return { id: entry.id, text };
    }
  }

  return null;
}

/**
 * Interactive Q&A component for answering extracted questions
 */
class QnAComponent implements Component {
  private questions: ExtractedQuestion[];
  private customAnswers: string[];
  private currentIndex: number = 0;
  private selectedOptionIndices: number[];
  private editor: Editor;
  private tui: TUI;
  private onDone: (result: string | null) => void;
  private showingConfirmation: boolean = false;

  // Cache
  private cachedWidth?: number;
  private cachedLines?: string[];

  // Colors - using proper reset sequences
  private dim = (s: string) => `\x1b[2m${s}\x1b[0m`;
  private bold = (s: string) => `\x1b[1m${s}\x1b[0m`;
  private cyan = (s: string) => `\x1b[36m${s}\x1b[0m`;
  private green = (s: string) => `\x1b[32m${s}\x1b[0m`;
  private yellow = (s: string) => `\x1b[33m${s}\x1b[0m`;
  private gray = (s: string) => `\x1b[90m${s}\x1b[0m`;

  constructor(
    questions: ExtractedQuestion[],
    tui: TUI,
    onDone: (result: string | null) => void,
  ) {
    this.questions = questions;
    this.customAnswers = questions.map(() => "");
    this.selectedOptionIndices = questions.map((q) =>
      (q.options?.length ?? 0) > 0 ? 0 : q.options?.length ?? 0,
    );
    this.tui = tui;
    this.onDone = onDone;

    // Create a minimal theme for the editor
    const editorTheme: EditorTheme = {
      borderColor: this.dim,
      selectList: {
        selectedBg: (s: string) => `\x1b[44m${s}\x1b[0m`,
        matchHighlight: this.cyan,
        itemSecondary: this.gray,
      },
    };

    this.editor = new Editor(tui, editorTheme);
    // Disable the editor's built-in submit (which clears the editor)
    // We'll handle Enter ourselves to preserve the text
    this.editor.disableSubmit = true;
    this.editor.onChange = () => {
      this.invalidate();
      this.tui.requestRender();
    };
  }

  private saveCurrentCustomAnswer(): void {
    this.customAnswers[this.currentIndex] = this.editor.getText();
  }

  private navigateTo(index: number): void {
    if (index < 0 || index >= this.questions.length) return;
    this.saveCurrentCustomAnswer();
    this.currentIndex = index;
    this.editor.setText(this.customAnswers[index] || "");
    this.invalidate();
  }

  private currentOptions(): string[] {
    return this.questions[this.currentIndex]?.options ?? [];
  }

  private customOptionIndex(questionIndex = this.currentIndex): number {
    return this.questions[questionIndex]?.options?.length ?? 0;
  }

  private isCustomSelected(questionIndex = this.currentIndex): boolean {
    return (this.selectedOptionIndices[questionIndex] ?? 0) >= this.customOptionIndex(questionIndex);
  }

  private answerForQuestion(index: number): string {
    const q = this.questions[index];
    const options = q.options ?? [];
    const selected = this.selectedOptionIndices[index] ?? options.length;
    if (selected < options.length) return options[selected];
    return this.customAnswers[index]?.trim() || "";
  }

  private moveOption(delta: number): boolean {
    const choiceCount = this.currentOptions().length + 1; // includes Custom / free text
    if (choiceCount <= 1) return false;
    const current = this.selectedOptionIndices[this.currentIndex] ?? 0;
    const next = Math.max(0, Math.min(choiceCount - 1, current + delta));
    this.selectedOptionIndices[this.currentIndex] = next;
    this.invalidate();
    return true;
  }

  private submit(): void {
    this.saveCurrentCustomAnswer();

    // Build the response text
    const parts: string[] = [];
    for (let i = 0; i < this.questions.length; i++) {
      const q = this.questions[i];
      const a = this.answerForQuestion(i) || "(no answer)";
      parts.push(`Q: ${q.question}`);
      if (q.context) {
        parts.push(`> ${q.context}`);
      }
      parts.push(`A: ${a}`);
      parts.push("");
    }

    this.onDone(parts.join("\n").trim());
  }

  private cancel(): void {
    this.onDone(null);
  }

  invalidate(): void {
    this.cachedWidth = undefined;
    this.cachedLines = undefined;
  }

  handleInput(data: string): void {
    // Handle confirmation dialog
    if (this.showingConfirmation) {
      if (matchesKey(data, Key.enter) || data.toLowerCase() === "y") {
        this.submit();
        return;
      }
      if (
        matchesKey(data, Key.escape) ||
        matchesKey(data, Key.ctrl("c")) ||
        data.toLowerCase() === "n"
      ) {
        this.showingConfirmation = false;
        this.invalidate();
        this.tui.requestRender();
        return;
      }
      return;
    }

    // Global navigation and commands
    if (matchesKey(data, Key.escape) || matchesKey(data, Key.ctrl("c"))) {
      this.cancel();
      return;
    }

    // Tab / Shift+Tab for navigation
    if (matchesKey(data, Key.tab)) {
      if (this.currentIndex < this.questions.length - 1) {
        this.navigateTo(this.currentIndex + 1);
        this.tui.requestRender();
      }
      return;
    }
    if (matchesKey(data, Key.shift("tab"))) {
      if (this.currentIndex > 0) {
        this.navigateTo(this.currentIndex - 1);
        this.tui.requestRender();
      }
      return;
    }

    // Arrow up/down selects options including Custom / free text.
    if (matchesKey(data, Key.up)) {
      if (this.moveOption(-1)) {
        this.tui.requestRender();
        return;
      }
      if (this.currentIndex > 0) {
        this.navigateTo(this.currentIndex - 1);
        this.tui.requestRender();
        return;
      }
    }
    if (matchesKey(data, Key.down)) {
      if (this.moveOption(1)) {
        this.tui.requestRender();
        return;
      }
      if (this.currentIndex < this.questions.length - 1) {
        this.navigateTo(this.currentIndex + 1);
        this.tui.requestRender();
        return;
      }
    }

    // Handle Enter ourselves (editor's submit is disabled)
    // Plain Enter moves to next question or shows confirmation on last question
    // Shift+Enter adds a newline (handled by editor)
    if (matchesKey(data, Key.enter) && !matchesKey(data, Key.shift("enter"))) {
      this.saveCurrentCustomAnswer();
      if (this.currentIndex < this.questions.length - 1) {
        this.navigateTo(this.currentIndex + 1);
      } else {
        // On last question - show confirmation
        this.showingConfirmation = true;
      }
      this.invalidate();
      this.tui.requestRender();
      return;
    }

    // Typing means the user wants Custom / free text.
    this.selectedOptionIndices[this.currentIndex] = this.customOptionIndex();
    this.editor.handleInput(data);
    this.saveCurrentCustomAnswer();
    this.invalidate();
    this.tui.requestRender();
  }

  render(width: number): string[] {
    if (this.cachedLines && this.cachedWidth === width) {
      return this.cachedLines;
    }

    const lines: string[] = [];
    const boxWidth = Math.min(width - 4, 120); // Allow wider box
    const contentWidth = boxWidth - 4; // 2 chars padding on each side

    // Helper to create horizontal lines (dim the whole thing at once)
    const horizontalLine = (count: number) => "─".repeat(count);

    // Helper to create a box line
    const boxLine = (content: string, leftPad: number = 2): string => {
      const paddedContent = " ".repeat(leftPad) + content;
      const contentLen = visibleWidth(paddedContent);
      const rightPad = Math.max(0, boxWidth - contentLen - 2);
      return (
        this.dim("│") + paddedContent + " ".repeat(rightPad) + this.dim("│")
      );
    };

    const emptyBoxLine = (): string => {
      return this.dim("│") + " ".repeat(boxWidth - 2) + this.dim("│");
    };

    const padToWidth = (line: string): string => {
      const len = visibleWidth(line);
      return line + " ".repeat(Math.max(0, width - len));
    };

    // Title
    lines.push(padToWidth(this.dim("╭" + horizontalLine(boxWidth - 2) + "╮")));
    const title = `${this.bold(this.cyan("Questions"))} ${this.dim(`(${this.currentIndex + 1}/${this.questions.length})`)}`;
    lines.push(padToWidth(boxLine(title)));
    lines.push(padToWidth(this.dim("├" + horizontalLine(boxWidth - 2) + "┤")));

    // Progress indicator
    const progressParts: string[] = [];
    for (let i = 0; i < this.questions.length; i++) {
      const answered = this.answerForQuestion(i).length > 0;
      const current = i === this.currentIndex;
      if (current) {
        progressParts.push(this.cyan("●"));
      } else if (answered) {
        progressParts.push(this.green("●"));
      } else {
        progressParts.push(this.dim("○"));
      }
    }
    lines.push(padToWidth(boxLine(progressParts.join(" "))));
    lines.push(padToWidth(emptyBoxLine()));

    // Current question
    const q = this.questions[this.currentIndex];
    const questionText = `${this.bold("Q:")} ${q.question}`;
    const wrappedQuestion = wrapTextWithAnsi(questionText, contentWidth);
    for (const line of wrappedQuestion) {
      lines.push(padToWidth(boxLine(line)));
    }

    // Options plus Custom / free text
    lines.push(padToWidth(emptyBoxLine()));
    const options = q.options ?? [];
    const selectedIndex = this.selectedOptionIndices[this.currentIndex] ?? this.customOptionIndex();
    const choices = [...options, "Custom / free text"];
    for (let i = 0; i < choices.length; i++) {
      const marker = i === selectedIndex ? this.cyan("›") : " ";
      const optionText = `${marker} ${choices[i]}`;
      const styled = i === selectedIndex ? this.cyan(optionText) : this.gray(optionText);
      const wrappedOption = wrapTextWithAnsi(styled, contentWidth - 2);
      for (const line of wrappedOption) {
        lines.push(padToWidth(boxLine(line)));
      }
    }

    // Context if present
    if (q.context) {
      lines.push(padToWidth(emptyBoxLine()));
      const contextText = this.gray(`> ${q.context}`);
      const wrappedContext = wrapTextWithAnsi(contextText, contentWidth - 2);
      for (const line of wrappedContext) {
        lines.push(padToWidth(boxLine(line)));
      }
    }

    lines.push(padToWidth(emptyBoxLine()));

    if (this.isCustomSelected()) {
      // Render the editor component (multi-line input) with padding
      // Skip the first and last lines (editor's own border lines)
      const answerPrefix = this.bold("A: ");
      const editorWidth = contentWidth - 4 - 3; // Extra padding + space for "A: "
      const editorLines = this.editor.render(editorWidth);
      for (let i = 1; i < editorLines.length - 1; i++) {
        if (i === 1) {
          // First content line gets the "A: " prefix
          lines.push(padToWidth(boxLine(answerPrefix + editorLines[i])));
        } else {
          // Subsequent lines get padding to align with the first line
          lines.push(padToWidth(boxLine("   " + editorLines[i])));
        }
      }
    } else {
      const selectedAnswer = this.answerForQuestion(this.currentIndex);
      const selectedText = `${this.bold("A:")} ${selectedAnswer}`;
      for (const line of wrapTextWithAnsi(selectedText, contentWidth)) {
        lines.push(padToWidth(boxLine(line)));
      }
    }

    lines.push(padToWidth(emptyBoxLine()));

    // Confirmation dialog or footer with controls
    if (this.showingConfirmation) {
      lines.push(
        padToWidth(this.dim("├" + horizontalLine(boxWidth - 2) + "┤")),
      );
      const confirmMsg = `${this.yellow("Submit all answers?")} ${this.dim("(Enter/y to confirm, Esc/n to cancel)")}`;
      lines.push(
        padToWidth(boxLine(truncateToWidth(confirmMsg, contentWidth))),
      );
    } else {
      lines.push(
        padToWidth(this.dim("├" + horizontalLine(boxWidth - 2) + "┤")),
      );
      const controls = this.currentOptions().length > 0
        ? `${this.dim("↑/↓")} select option/custom · ${this.dim("type")} custom · ${this.dim("Enter")} next · ${this.dim("Esc")} cancel`
        : `${this.dim("type")} custom · ${this.dim("Enter")} next · ${this.dim("Shift+Enter")} newline · ${this.dim("Esc")} cancel`;
      lines.push(padToWidth(boxLine(truncateToWidth(controls, contentWidth))));
    }
    lines.push(padToWidth(this.dim("╰" + horizontalLine(boxWidth - 2) + "╯")));

    this.cachedWidth = width;
    this.cachedLines = lines;
    return lines;
  }
}

export default function (pi: ExtensionAPI) {
  const autoTriggeredAssistantIds = new Set<string>();

  const answerHandler = async (
    ctx: ExtensionContext,
    options: AnswerHandlerOptions = {},
  ) => {
    if (!ctx.hasUI) {
      if (!options.auto) ctx.ui.notify("answer requires interactive mode", "error");
      return;
    }

    if (!ctx.model) {
      if (!options.auto) ctx.ui.notify("No model selected", "error");
      return;
    }

    const assistantText = options.assistantText ?? getLastAssistantText(ctx);

    if (!assistantText) {
      if (!options.auto) ctx.ui.notify("No assistant messages found", "error");
      return;
    }

    let extractionResult = extractOpenQuestionsFromText(assistantText.text);

    if (!extractionResult) {
      // Select the best model for extraction (prefer GPT-5.3, then haiku)
      const extractionModel = await selectExtractionModel(
        ctx.model,
        ctx.modelRegistry,
      );

      // Run extraction with loader UI
      extractionResult = await ctx.ui.custom<ExtractionResult | null>(
        (tui, theme, _kb, done) => {
          const loader = new BorderedLoader(
            tui,
            theme,
            `Extracting questions using ${extractionModel.id}...`,
          );
          loader.onAbort = () => done(null);

          const doExtract = async () => {
            const auth =
              await ctx.modelRegistry.getApiKeyAndHeaders(extractionModel);
            if (!auth.ok) {
              throw new Error(auth.error);
            }
            const userMessage: UserMessage = {
              role: "user",
              content: [{ type: "text", text: assistantText.text }],
              timestamp: Date.now(),
            };

            const response = await complete(
              extractionModel,
              { systemPrompt: SYSTEM_PROMPT, messages: [userMessage] },
              {
                apiKey: auth.apiKey,
                headers: auth.headers,
                signal: loader.signal,
              },
            );

            if (response.stopReason === "aborted") {
              return null;
            }

            const responseText = response.content
              .filter(
                (c): c is { type: "text"; text: string } => c.type === "text",
              )
              .map((c) => c.text)
              .join("\n");

            return parseExtractionResult(responseText);
          };

          doExtract()
            .then(done)
            .catch((error) => {
              ctx.ui.notify(
                `Question extraction failed: ${error instanceof Error ? error.message : String(error)}`,
                "error",
              );
              done(null);
            });

          return loader;
        },
      );
    }

    if (extractionResult === null) {
      ctx.ui.notify(options.auto ? "Answer flow cancelled" : "Cancelled", "info");
      return;
    }

    if (extractionResult.questions.length === 0) {
      if (!options.auto) {
        ctx.ui.notify("No questions found in the last message", "info");
      }
      return;
    }

    // Show the Q&A component
    const answersResult = await ctx.ui.custom<string | null>(
      (tui, _theme, _kb, done) => {
        return new QnAComponent(extractionResult.questions, tui, done);
      },
    );

    if (answersResult === null) {
      ctx.ui.notify("Cancelled", "info");
      return;
    }

    // Send the answers directly as a message and trigger a turn
    pi.sendMessage(
      {
        customType: "answers",
        content:
          "I answered your questions in the following way:\n\n" + answersResult,
        display: true,
      },
      { triggerTurn: true },
    );
  };

  pi.on("agent_end", async (_event, ctx) => {
    if (!ctx.hasUI || ctx.hasPendingMessages()) return;

    const assistantText = getLastAssistantText(ctx);
    if (!assistantText) return;
    if (autoTriggeredAssistantIds.has(assistantText.id)) return;
    if (!hasOpenQuestionsHeading(assistantText.text)) return;

    autoTriggeredAssistantIds.add(assistantText.id);
    await answerHandler(ctx, { auto: true, assistantText });
  });

  pi.registerCommand("answer", {
    description:
      "Extract questions from last assistant message into interactive Q&A",
    handler: (_args, ctx) => answerHandler(ctx),
  });

  pi.registerShortcut("ctrl+.", {
    description: "Extract and answer questions",
    handler: (ctx) => answerHandler(ctx),
  });
}
