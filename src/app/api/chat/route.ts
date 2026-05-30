import { NextRequest } from "next/server";
import OpenAI from "openai";
import { createBook, getBook, getBooks, updateBook, deleteBook } from "@/lib/db";
import { createDialogue, getDialogue, getOpeningOptions } from "@/lib/dialogue-store";
import { readFileSync, existsSync, readdirSync, writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { requireUserId } from "@/lib/auth-helper";

/* ── tools ─────────────────────────────────────────── */

const CREATE_BOOK_TOOL = {
  type: "function" as const,
  function: {
    name: "create_book",
    description: "创建一本新故事。收集完背景、风格、名字后调用。",
    parameters: {
      type: "object" as const,
      properties: {
        name: { type: "string", description: "故事名字" },
        genre: { type: "string", description: "故事背景，如 仙侠/科幻/都市/奇幻" },
        style: { type: "string", description: "文字风格，如 网络小说/轻小说/传统文学" },
        system_prompt: {
          type: "string",
          description: "系统提示词（200-400字），帮助后续AI理解故事设定和文风。",
        },
      },
      required: ["name", "genre", "style", "system_prompt"],
    },
  },
};

const START_DIALOGUE_TOOL = {
  type: "function" as const,
  function: {
    name: "start_dialogue",
    description:
      "创建故事对话的开场白和配置。收集完时间、地点、主角、NPC、模式后调用。",
    parameters: {
      type: "object" as const,
      properties: {
        mode: { type: "string", enum: ["novel", "roleplay"], description: "对话模式" },
        pov: { type: "string", enum: ["first", "third"], description: "人称：first=第一人称, third=第三人称" },
        time: { type: "string", description: "故事发生的时间" },
        place: { type: "string", description: "故事发生的地点" },
        protagonist_name: { type: "string", description: "主角（用户扮演）的名字" },
        protagonist_description: { type: "string", description: "主角的描述" },
        npcs: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              description: { type: "string" },
            },
            required: ["name", "description"],
          },
          description: "NPC 列表（AI 扮演）",
        },
        dialogue_system_prompt: {
          type: "string",
          description: "对话系统提示词（300-500字），永不修改，作为对话的 system 消息。",
        },
        opening: { type: "string", description: "开场白（200-400字），对话的第一条消息。" },
      },
      required: [
        "mode", "pov", "time", "place",
        "protagonist_name", "protagonist_description",
        "npcs", "dialogue_system_prompt", "opening",
      ],
    },
  },
};

const SAVE_PROTAGONIST_TOOL = {
  type: "function" as const,
  function: {
    name: "save_protagonist",
    description: "将主角信息保存到故事中。在用户同意保存后调用。",
    parameters: {
      type: "object" as const,
      properties: {
        name: { type: "string", description: "主角名字" },
        description: { type: "string", description: "主角描述" },
      },
      required: ["name", "description"],
    },
  },
};

const REUSE_OPENING_TOOL = {
  type: "function" as const,
  function: {
    name: "reuse_opening",
    description: "复用已有的开场白创建新对话。用户选择复用某个开场白时调用。",
    parameters: {
      type: "object" as const,
      properties: {
        source_dialogue_id: { type: "string", description: "要复用的对话 ID" },
      },
      required: ["source_dialogue_id"],
    },
  },
};

const LIST_PRESETS_TOOL = {
  type: "function" as const,
  function: {
    name: "list_presets",
    description: '列出所有已保存的预设。用户问「有哪些预设」「现在有什么预设」时调用。',
    parameters: { type: "object" as const, properties: {} },
  },
};

const UPDATE_PRESET_TOOL = {
  type: "function" as const,
  function: {
    name: "update_preset",
    description: "修改现有的预设。用户要求调整预设的名称、角色定义、写作规则时调用。",
    parameters: {
      type: "object" as const,
      properties: {
        preset_id: { type: "string", description: "预设 ID" },
        name: { type: "string", description: "新的预设名称（可选）" },
        mode: { type: "string", enum: ["novel", "roleplay"], description: "模式（可选）" },
        pov: { type: "string", enum: ["first", "third"], description: "人称（可选）" },
        role: { type: "string", description: "角色定义（可选）" },
        rules: { type: "string", description: "写作规则（可选）" },
      },
      required: ["preset_id"],
    },
  },
};

const CREATE_PRESET_TOOL = {
  type: "function" as const,
  function: {
    name: "create_preset",
    description: "创建新的预设。用户描述想要的写作风格后，生成并保存。",
    parameters: {
      type: "object" as const,
      properties: {
        name: { type: "string", description: "预设名称" },
        mode: { type: "string", enum: ["novel", "roleplay"], description: "模式" },
        pov: { type: "string", enum: ["first", "third"], description: "人称" },
        role: { type: "string", description: "角色定义" },
        rules: { type: "string", description: "写作规则" },
      },
      required: ["name", "mode", "pov", "role", "rules"],
    },
  },
};

const CREATE_PERSONA_TOOL = {
  type: "function" as const,
  function: {
    name: "create_persona",
    description: "创建一个新的人格。用户描述想要的助手性格后调用。",
    parameters: {
      type: "object" as const,
      properties: {
        name: { type: "string", description: "人格名称，如'小书'" },
        avatar: { type: "string", description: "头像 emoji，如'📚'" },
        tone: { type: "string", description: "语气，如'温暖鼓励'" },
        addressUser: { type: "string", description: "称呼用户的方式，如'你'、'主人'" },
        style: { type: "string", description: "说话风格，如'简洁'" },
        catchphrase: { type: "string", description: "口头禅" },
      },
      required: ["name"],
    },
  },
};

const UPDATE_PERSONA_TOOL = {
  type: "function" as const,
  function: {
    name: "update_persona",
    description: "修改现有人格。用户要求调整助手性格时调用。",
    parameters: {
      type: "object" as const,
      properties: {
        persona_id: { type: "string", description: "人格 ID" },
        name: { type: "string" },
        avatar: { type: "string" },
        tone: { type: "string" },
        addressUser: { type: "string" },
        style: { type: "string" },
        catchphrase: { type: "string" },
      },
      required: ["persona_id"],
    },
  },
};

const LIST_PERSONAS_TOOL = {
  type: "function" as const,
  function: {
    name: "list_personas",
    description: "列出所有已保存的人格。用户问'有哪些人格'时调用。",
    parameters: { type: "object" as const, properties: {} },
  },
};

/* ── file operation tools ──────────────────────────── */

const READ_FILE_TOOL = {
  type: "function" as const,
  function: {
    name: "read_file",
    description: "读取项目中的文件内容。可以读取技能文件(prompts/)、配置文件、代码等。",
    parameters: {
      type: "object" as const,
      properties: {
        path: { type: "string", description: "文件路径，相对于项目根目录，如 src/prompts/create-story.md" },
      },
      required: ["path"],
    },
  },
};

const LIST_DIR_TOOL = {
  type: "function" as const,
  function: {
    name: "list_directory",
    description: "列出目录中的文件和子目录。用于探索项目结构。",
    parameters: {
      type: "object" as const,
      properties: {
        path: { type: "string", description: "目录路径，如 src/prompts" },
      },
      required: ["path"],
    },
  },
};

const SEARCH_FILES_TOOL = {
  type: "function" as const,
  function: {
    name: "search_files",
    description: "按文件名模式搜索文件。用于查找特定类型的文件。",
    parameters: {
      type: "object" as const,
      properties: {
        pattern: { type: "string", description: "搜索模式，如 *.md、create-*" },
        directory: { type: "string", description: "搜索目录，如 src/prompts" },
      },
      required: ["pattern"],
    },
  },
};

const WRITE_FILE_TOOL = {
  type: "function" as const,
  function: {
    name: "write_file",
    description: "创建或覆盖一个文件。用于动态生成技能文件、保存内容等。仅允许写入 src/prompts/ 和 .data/ 目录。",
    parameters: {
      type: "object" as const,
      properties: {
        path: { type: "string", description: "文件路径，如 src/prompts/my-skill.md" },
        content: { type: "string", description: "文件内容" },
      },
      required: ["path", "content"],
    },
  },
};

const LIST_BOOKS_TOOL = {
  type: "function" as const,
  function: {
    name: "list_books",
    description: "列出用户的故事列表（最多 10 个）。用户问'有哪些故事''我的故事'时调用。",
    parameters: { type: "object" as const, properties: {} },
  },
};

const CLOSE_DIALOGUE_TOOL = {
  type: "function" as const,
  function: {
    name: "close_dialogue",
    description: "关闭当前对话，返回故事列表。用户说「关闭对话」「退出」「回到首页」等时调用。",
    parameters: { type: "object" as const, properties: {} },
  },
};

const DELETE_BOOK_TOOL = {
  type: "function" as const,
  function: {
    name: "delete_book",
    description: "删除一本故事。用户说「删除这本书」「删掉这个故事」时调用。删除后数据不可恢复，需用户确认。",
    parameters: {
      type: "object" as const,
      properties: {
        book_id: { type: "number", description: "要删除的故事 ID" },
      },
      required: ["book_id"],
    },
  },
};

const DELETE_PRESET_TOOL = {
  type: "function" as const,
  function: {
    name: "delete_preset",
    description: "删除一个预设。用户说「删除这个预设」「删掉××预设」时调用。",
    parameters: {
      type: "object" as const,
      properties: {
        preset_id: { type: "string", description: "预设 ID" },
      },
      required: ["preset_id"],
    },
  },
};

const DELETE_PERSONA_TOOL = {
  type: "function" as const,
  function: {
    name: "delete_persona",
    description: "删除一个人格。用户说「删除这个人格」「删掉××人格」时调用。",
    parameters: {
      type: "object" as const,
      properties: {
        persona_id: { type: "string", description: "人格 ID" },
      },
      required: ["persona_id"],
    },
  },
};

const GET_DIALOGUE_OVERVIEW_TOOL = {
  type: "function" as const,
  function: {
    name: "get_dialogue_overview",
    description: "获取当前对话的故事状态概览：角色列表、主角、当前地点、时间、活跃剧情线。用户问「故事进展如何」「现在有哪些角色」「剧情到哪了」时调用。需要 bookId。",
    parameters: {
      type: "object" as const,
      properties: {},
    },
  },
};

const GET_DIALOGUE_MESSAGES_TOOL = {
  type: "function" as const,
  function: {
    name: "get_dialogue_messages",
    description: "读取当前对话最近的消息记录。用户问「最近写了什么」「对话进行到哪了」「看看内容」时调用。需要 bookId 对应的活跃对话。",
    parameters: {
      type: "object" as const,
      properties: {
        count: { type: "number", description: "读取最近多少条消息，默认 10" },
      },
    },
  },
};

const UPDATE_DIALOGUE_CONFIG_TOOL = {
  type: "function" as const,
  function: {
    name: "update_dialogue_config",
    description: "更新当前对话的配置：修改时间、地点、NPC 列表等。用户说「换个地点」「增加一个NPC」「修改时间」时调用。",
    parameters: {
      type: "object" as const,
      properties: {
        time: { type: "string", description: "新的时间设定（可选）" },
        place: { type: "string", description: "新的地点设定（可选）" },
        npcs: {
          type: "array",
          items: {
            type: "object",
            properties: { name: { type: "string" }, description: { type: "string" } },
            required: ["name", "description"],
          },
          description: "替换整个 NPC 列表（可选）",
        },
      },
    },
  },
};

const GET_PLOT_STATE_TOOL = {
  type: "function" as const,
  function: {
    name: "get_plot_state",
    description: "获取当前对话的完整剧情状态：所有剧情线、节点及各自状态（pending/active/completed/skipped）。用户问「剧情详情」「看看所有剧情线」「剧情匹配不上」「为什么这个节点没激活」时调用。需要 bookId。",
    parameters: {
      type: "object" as const,
      properties: {},
    },
  },
};

const GET_PLOT_PROMPTS_TOOL = {
  type: "function" as const,
  function: {
    name: "get_plot_prompts",
    description: "查看剧情系统的提示词（prompt）模板。包括剧情生成、剧情分析和剧情展开三个提示词。用户问「剧情是怎么匹配的」「分析剧情用的什么提示词」「为什么剧情对不上」时调用，帮助诊断剧情系统的工作逻辑。",
    parameters: {
      type: "object" as const,
      properties: {},
    },
  },
};

/* ── prompts ───────────────────────────────────────── */

const DEFAULT_SYSTEM = `你是 DeepBook 的智能助手，一位博学、善解人意且富有创造力的伙伴。

你的职责：
- 帮助用户进行小说创作：情节构思、角色塑造、世界观构建、文笔润色等
- 管理故事：创建、列出、删除故事。当用户说「删除这本书」「删掉这个故事」时，先确认后调用 delete_book
- 管理预设：列出、创建、修改、删除预设（delete_preset）
- 管理人格：列出、创建、修改、删除智能体人格（delete_persona)。当用户说"创建新人格""有哪些人格"时调用对应工具
- 查询故事：当用户问"有哪些故事""我的故事""故事列表"时，调用 list_books 列出。当用户说"打开某故事"时，告诉用户可以在首页点击故事封面进入对话
- 查看对话进展：当用户问「故事进展如何」「有哪些角色」「剧情到哪了」时，用 get_dialogue_overview 查看
- 查看对话内容：当用户问「最近写了什么」「看看内容」时，用 get_dialogue_messages 读取最近的消息
- 修改对话设定：当用户说「换个地点」「增加一个NPC」「修改时间」时，用 update_dialogue_config 更新
- 查看剧情详情：当用户问「剧情匹配不上」「为什么剧情没推进」「看看所有剧情线」时，用 get_plot_state 查看完整剧情状态（所有节点及状态），用 get_plot_prompts 查看剧情系统的提示词逻辑，然后分析原因

对话风格：
- 创作时专业细致，角色扮演时全情投入
- 保持友好、温暖的语调
- 使用中文交流

你是一个创意伙伴，不是命令执行工具。主动思考、给出有见地的建议。

## 你的能力

你是一个 code agent，可以：
- **读取文件**：用 read_file 读取项目中的技能文件、配置、代码等。例如查看 create-story.md 了解创建故事的流程
- **浏览目录**：用 list_directory 探索项目结构，查看有哪些技能可用
- **搜索文件**：用 search_files 按模式查找文件
- **写文件**：用 write_file 在 src/prompts/ 目录下创建新的技能文件。当你发现现有技能不足以完成任务时，可以动态编写新的技能

**主动探索**：遇到不确定的事情时，先读相关文件了解上下文，而不是猜测。

## 创建新故事

当用户说"建一个新故事""创建故事""我要写故事"等时，按以下流程逐步引导（每次一个问题，不要一次性全问）：

1. **故事背景**：仙侠、科幻、奇幻、都市、悬疑... 给 4-5 个示例，也允许自由描述
2. **文字风格**：网络小说、轻小说、传统文学... 给 3-4 个示例
3. **故事名字**：让用户起个名字
4. 收集完毕后，整合用户的描述，生成一段 system_prompt（200-400字），然后调用 create_book 保存

注意：这是**创建故事**，不是开始写故事内容。不要直接开始叙述或写作。一步步问完三个问题后再操作。调用 create_book 之前先告诉用户"正在保存..."，保存完成后醒目告知结果。

## 创建/修改预设

当用户说"建一个新预设""创建预设""编辑预设"等时，按以下流程逐步引导（每次一个问题）：

1. **模式**：小说还是角色扮演？
2. **人称**：第一人称还是第三人称？
3. **角色定义**：小说模式 → AI 作为什么类型的作者（如"快节奏爽文代笔"）；角色扮演模式 → AI 作为角色扮演系统该怎么做（如"根据主角行为生成 NPC 对话和旁白，推动剧情"）。注意：不要在这里设定具体 NPC，那是对话创建时才做的。
4. **写作规则**：字数、视角、节奏等要求
5. **名称**：给预设起个名字

收集完毕后，调用 create_preset 或 update_preset 函数保存。
`;

function loadSkillPrompt(name: string, vars?: Record<string, string>): string {
  try {
    const p = join(/* turbopackIgnore: true */ process.cwd(), "src", "prompts", `${name}.md`);
    if (!existsSync(p)) return "";
    let content = readFileSync(p, "utf-8");
    if (vars) {
      for (const [k, v] of Object.entries(vars)) {
        content = content.replaceAll(`{${k}}`, v);
      }
    }
    return content;
  } catch {
    return "";
  }
}

/* ── tool execution helpers ────────────────────────── */

function buildTools(task: string | null, bookId?: number) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const list: any[] = [];
  if (task === "create-story") list.push(CREATE_BOOK_TOOL);
  if (task === "open-dialogue")
    list.push(START_DIALOGUE_TOOL, SAVE_PROTAGONIST_TOOL);
  if (task === "new-dialogue")
    list.push(REUSE_OPENING_TOOL, START_DIALOGUE_TOOL, SAVE_PROTAGONIST_TOOL);
  if (task === "edit-preset")
    list.push(UPDATE_PRESET_TOOL, CREATE_PRESET_TOOL);
  // dialogue-aware tools (available when a book is active)
  if (bookId) {
    list.push(GET_DIALOGUE_OVERVIEW_TOOL, GET_DIALOGUE_MESSAGES_TOOL, UPDATE_DIALOGUE_CONFIG_TOOL, GET_PLOT_STATE_TOOL, GET_PLOT_PROMPTS_TOOL);
  }
  // these are always available (deduplicate by name)
  const always = [
    CREATE_BOOK_TOOL, LIST_BOOKS_TOOL, DELETE_BOOK_TOOL,
    CLOSE_DIALOGUE_TOOL,
    LIST_PRESETS_TOOL, UPDATE_PRESET_TOOL, CREATE_PRESET_TOOL, DELETE_PRESET_TOOL,
    LIST_PERSONAS_TOOL, CREATE_PERSONA_TOOL, UPDATE_PERSONA_TOOL, DELETE_PERSONA_TOOL,
    READ_FILE_TOOL, LIST_DIR_TOOL, SEARCH_FILES_TOOL, WRITE_FILE_TOOL,
  ];
  const seen = new Set(list.map((t) => t.function.name));
  for (const t of always) {
    if (!seen.has(t.function.name)) {
      list.push(t);
      seen.add(t.function.name);
    }
  }
  return list.length > 0 ? list : undefined;
}

function buildSystemPrompt(
  task: string | null,
  userId: string,
  bookId?: number,
  contextBook?: { id?: number; name: string; genre: string; style: string },
  contextPersona?: { name: string; avatar: string; tone: string; addressUser: string; style: string; catchphrase: string }
): string {
  let base = DEFAULT_SYSTEM;

  // Inject persona
  if (contextPersona) {
    const personaInjection = `
## 你当前的人格

- **名称**：${contextPersona.name}
- **语气**：${contextPersona.tone || "友好"}
- **称呼用户**：用"${contextPersona.addressUser || "你"}"称呼用户
- **说话风格**：${contextPersona.style || "自然"}
${contextPersona.catchphrase ? `- **口头禅**：${contextPersona.catchphrase}` : ""}

请以上述人格设定来回复用户。`;
    base = personaInjection + "\n\n---\n\n" + base;
  }
  if (task === "create-story") {
    const skill = loadSkillPrompt("create-story");
    if (skill) return `${base}\n\n---\n\n## 当前任务：创建故事\n\n${skill}`;
  }
  if (task === "edit-preset") {
    const skill = loadSkillPrompt("edit-preset");
    if (skill) return `${base}\n\n---\n\n## 当前任务：编辑预设\n\n${skill}`;
  }
  if (task === "new-dialogue" && bookId) {
    const openings = getOpeningOptions(bookId, userId);
    let openingList = "";
    if (openings.length > 0) {
      openingList = openings
        .map((o, i) => `${i + 1}. ${o.name}\n   开场白预览：${o.opening.slice(0, 100)}...`)
        .join("\n");
    }
    const skill = loadSkillPrompt("new-dialogue", { book_name: contextBook?.name || "故事" });
    if (skill) {
      let prompt = `${base}\n\n---\n\n${skill}`;
      if (openingList) {
        prompt = prompt.replace(
          "{opening_1_name}",
          openingList || "（暂无已有开场白，请直接创建新的）"
        );
      }
      return prompt;
    }
  }
  if (task === "open-dialogue" && bookId) {
    const skill = loadSkillPrompt("open-dialogue");
    let ctx = "";
    if (contextBook) {
      ctx = `\n\n## 故事信息\n\n- **书名**：《${contextBook.name}》
- **背景**：${contextBook.genre || "未知"}
- **风格**：${contextBook.style || "未知"}

用户在创建故事时已经确定了以上信息。请不要重复询问背景和风格，直接进入时间、地点、主角等开场白相关问题。如果用户提到背景/风格相关的内容，以上述信息为准。`;
    }
    if (skill) return `${base}\n\n---\n\n## 当前任务：为故事创建开场白\n\n${ctx}\n\n${skill}`;
  }
  if (contextBook) {
    return `${base}\n\n---\n\n## 用户当前正在编辑的故事\n\n- **书名**：《${contextBook.name}》
- **背景**：${contextBook.genre}
- **风格**：${contextBook.style}

当用户提到"这个故事""当前故事""它"等词时，指的是上面这个故事。请在回答时结合该故事的背景和风格。`;
  }
  return base;
}

async function executeToolCall(
  name: string,
  args: Record<string, unknown>,
  userId: string,
  bookId?: number
): Promise<{ success: boolean; [key: string]: unknown }> {
  switch (name) {
    case "create_book": {
      const book = await createBook({
        name: args.name as string,
        genre: args.genre as string,
        style: args.style as string,
        system_prompt: (args.system_prompt as string) || "",
      }, userId);
      return { success: true, book };
    }
    case "start_dialogue": {
      if (!bookId) return { success: false, error: "bookId is required" };
      const config = {
        mode: args.mode as "novel" | "roleplay",
        pov: args.pov as "first" | "third",
        time: args.time as string,
        place: args.place as string,
        protagonist: {
          name: args.protagonist_name as string,
          description: args.protagonist_description as string,
        },
        npcs: (args.npcs as { name: string; description: string }[]) || [],
        dialogue_system_prompt: args.dialogue_system_prompt as string,
      };
      const name = `对话 - ${new Date().toLocaleString("zh-CN")}`;
      const dialogue = createDialogue(bookId, userId, name, [
        { role: "system", content: config.dialogue_system_prompt },
        { role: "assistant", content: args.opening as string },
      ], config);
      await updateBook(bookId, userId, { active_dialogue_id: dialogue.id, dialogue_config: config });
      return { success: true, dialogueId: dialogue.id, bookId };
    }
    case "save_protagonist": {
      if (!bookId) return { success: false, error: "bookId is required" };
      const book = await getBook(bookId, userId);
      if (!book?.dialogue_config) return { success: false, error: "No dialogue config" };
      const updatedConfig = {
        ...book.dialogue_config,
        protagonist: {
          name: args.name as string,
          description: args.description as string,
        },
      };
      await updateBook(bookId, userId, { dialogue_config: updatedConfig });
      return { success: true };
    }
    case "reuse_opening": {
      if (!bookId) return { success: false, error: "bookId is required" };
      const sourceId = args.source_dialogue_id as string;
      const source = getDialogue(sourceId);
      if (!source) return { success: false, error: "Source dialogue not found" };
      if (source.userId && source.userId !== userId) return { success: false, error: "Access denied" };
      if (!source.config) return { success: false, error: "Source dialogue has no config" };
      const name = `对话 - ${new Date().toLocaleString("zh-CN")}`;
      const dialogue = createDialogue(bookId, userId, name, [
        { role: "system", content: source.config.dialogue_system_prompt },
        { role: "assistant", content: source.messages.find((m) => m.role === "assistant")?.content || "" },
      ], source.config);
      await updateBook(bookId, userId, { active_dialogue_id: dialogue.id, dialogue_config: source.config });
      return { success: true, dialogueId: dialogue.id, bookId };
    }
    case "list_books": {
      const books = await getBooks(userId);
      const slim = books.slice(0, 10).map((b) => ({
        id: b.id,
        name: b.name,
        genre: b.genre,
        style: b.style,
        hasDialogue: !!b.active_dialogue_id,
      }));
      return { success: true, books: slim };
    }
    case "list_presets": {
      const { listPresets } = await import("@/lib/presets");
      const presets = listPresets(userId);
      return { success: true, presets };
    }
    case "update_preset": {
      const { updatePreset } = await import("@/lib/presets");
      const updated = updatePreset(args.preset_id as string, userId, {
        ...(args.name ? { name: args.name as string } : {}),
        ...(args.mode ? { mode: args.mode as "novel" | "roleplay" } : {}),
        ...(args.pov ? { pov: args.pov as "first" | "third" } : {}),
        ...(args.role !== undefined ? { role: args.role as string } : {}),
        ...(args.rules !== undefined ? { rules: args.rules as string } : {}),
      });
      return updated ? { success: true, preset: updated } : { success: false, error: "Preset not found" };
    }
    case "create_preset": {
      const { createPreset } = await import("@/lib/presets");
      const preset = createPreset({
        name: args.name as string,
        mode: args.mode as "novel" | "roleplay",
        pov: args.pov as "first" | "third",
        role: args.role as string,
        rules: args.rules as string,
      }, userId);
      return { success: true, preset };
    }
    case "create_persona": {
      const { createPersona } = await import("@/lib/personas");
      const persona = createPersona({
        name: (args.name as string) || "助手",
        avatar: (args.avatar as string) || "🤖",
        tone: (args.tone as string) || "",
        addressUser: (args.addressUser as string) || "你",
        style: (args.style as string) || "",
        catchphrase: (args.catchphrase as string) || "",
      }, userId);
      return { success: true, persona };
    }
    case "update_persona": {
      const { updatePersona } = await import("@/lib/personas");
      const updated = updatePersona(args.persona_id as string, userId, {
        ...(args.name ? { name: args.name as string } : {}),
        ...(args.avatar ? { avatar: args.avatar as string } : {}),
        ...(args.tone !== undefined ? { tone: args.tone as string } : {}),
        ...(args.addressUser ? { addressUser: args.addressUser as string } : {}),
        ...(args.style !== undefined ? { style: args.style as string } : {}),
        ...(args.catchphrase !== undefined ? { catchphrase: args.catchphrase as string } : {}),
      });
      return updated ? { success: true, persona: updated } : { success: false, error: "Persona not found" };
    }
    case "list_personas": {
      const { listPersonas } = await import("@/lib/personas");
      const personas = listPersonas(userId);
      return { success: true, personas };
    }
    case "read_file": {
      const filePath = join(process.cwd(), args.path as string);
      // security: prevent path traversal
      if (!filePath.startsWith(process.cwd())) return { success: false, error: "Access denied" };
      try {
        if (!existsSync(filePath)) return { success: false, error: "File not found" };
        const content = readFileSync(filePath, "utf-8");
        // truncate if too large
        const maxLen = 8000;
        const truncated = content.length > maxLen ? content.slice(0, maxLen) + "\n...(truncated)" : content;
        return { success: true, content: truncated, size: content.length };
      } catch (err) {
        return { success: false, error: (err as Error).message };
      }
    }
    case "list_directory": {
      const dirPath = join(process.cwd(), args.path as string);
      if (!dirPath.startsWith(process.cwd())) return { success: false, error: "Access denied" };
      try {
        const entries = readdirSync(dirPath, { withFileTypes: true });
        const result = entries.map((e) => ({
          name: e.name,
          type: e.isDirectory() ? "dir" : "file",
        }));
        return { success: true, entries: result };
      } catch (err) {
        return { success: false, error: (err as Error).message };
      }
    }
    case "search_files": {
      const searchDir = args.directory ? join(process.cwd(), args.directory as string) : process.cwd();
      if (!searchDir.startsWith(process.cwd())) return { success: false, error: "Access denied" };
      try {
        const pattern = (args.pattern as string).toLowerCase();
        const results: string[] = [];
        function walk(dir: string) {
          const entries = readdirSync(dir, { withFileTypes: true });
          for (const e of entries) {
            const full = join(dir, e.name);
            if (e.isDirectory() && !e.name.startsWith(".") && e.name !== "node_modules" && e.name !== ".next" && e.name !== ".data") {
              walk(full);
            } else if (e.isFile()) {
              const match = pattern.includes("*")
                ? new RegExp("^" + pattern.replace(/\*/g, ".*").replace(/\?/g, ".") + "$", "i").test(e.name)
                : e.name.toLowerCase().includes(pattern);
              if (match) results.push(full.replace(process.cwd(), ""));
            }
          }
        }
        walk(searchDir);
        return { success: true, files: results.slice(0, 50) };
      } catch (err) {
        return { success: false, error: (err as Error).message };
      }
    }
    case "write_file": {
      const filePath = join(process.cwd(), args.path as string);
      if (!filePath.startsWith(process.cwd())) return { success: false, error: "Access denied" };
      // Only allow writing to src/prompts/ and .data/
      const rel = filePath.replace(process.cwd(), "").replace(/\\/g, "/");
      if (!rel.startsWith("/src/prompts/") && !rel.startsWith("/.data/")) {
        return { success: false, error: "只允许写入 src/prompts/ 和 .data/ 目录" };
      }
      try {
        const dir = dirname(filePath);
        if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
        writeFileSync(filePath, args.content as string, "utf-8");
        return { success: true, path: rel };
      } catch (err) {
        return { success: false, error: (err as Error).message };
      }
    }
    case "close_dialogue": {
      if (bookId) {
        await updateBook(bookId, userId, { active_dialogue_id: null });
      }
      return { success: true, action: "close_dialogue" };
    }
    case "delete_book": {
      const targetId = args.book_id as number;
      const book = await getBook(targetId, userId);
      if (!book) return { success: false, error: "Book not found" };
      await deleteBook(targetId, userId);
      return { success: true, message: `故事「${book.name}」已删除` };
    }
    case "delete_preset": {
      const { deletePreset } = await import("@/lib/presets");
      const ok = deletePreset(args.preset_id as string, userId);
      return ok ? { success: true, message: "预设已删除" } : { success: false, error: "Preset not found" };
    }
    case "delete_persona": {
      const { deletePersona } = await import("@/lib/personas");
      const ok = deletePersona(args.persona_id as string, userId);
      return ok ? { success: true, message: "人格已删除" } : { success: false, error: "Persona not found" };
    }
    case "get_dialogue_overview": {
      if (!bookId) return { success: false, error: "需要先打开一个故事" };
      const book = await getBook(bookId, userId);
      if (!book) return { success: false, error: "Book not found" };
      if (!book.active_dialogue_id) return { success: false, error: "当前故事没有活跃对话" };

      const { getStoryState } = await import("@/lib/story-state");
      const { getPlotState } = await import("@/lib/plot-state");
      const { listDialogues: listDlgs } = await import("@/lib/dialogue-store");

      const dialogue = getDialogue(book.active_dialogue_id);
      const storyState = getStoryState(book.active_dialogue_id);
      const plotState = getPlotState(book.active_dialogue_id);
      const dialogues = listDlgs(bookId, userId);

      return {
        success: true,
        overview: {
          bookName: book.name,
          genre: book.genre,
          style: book.style,
          dialogueName: dialogue?.name || "未知",
          config: book.dialogue_config ? {
            mode: book.dialogue_config.mode,
            pov: book.dialogue_config.pov,
            time: book.dialogue_config.time,
            place: book.dialogue_config.place,
            protagonist: book.dialogue_config.protagonist,
            npcs: book.dialogue_config.npcs,
          } : null,
          messageCount: dialogue?.messages.length || 0,
          characters: storyState.characters,
          protagonist: storyState.protagonist,
          currentLocation: storyState.currentLocation,
          currentDate: storyState.currentDate,
          currentTime: storyState.currentTime,
          activePlotLines: plotState.plotLines.filter((l) => l.status === "active").map((l) => ({
            title: l.title,
            activeNode: l.nodes.find((n) => n.status === "active")?.content,
            nextNode: l.nodes.find((n) => n.status === "pending")?.content,
          })),
          dialogueCount: dialogues.length,
        },
      };
    }
    case "get_dialogue_messages": {
      if (!bookId) return { success: false, error: "需要先打开一个故事" };
      const book = await getBook(bookId, userId);
      if (!book) return { success: false, error: "Book not found" };
      if (!book.active_dialogue_id) return { success: false, error: "当前故事没有活跃对话" };

      const dialogue = getDialogue(book.active_dialogue_id);
      if (!dialogue) return { success: false, error: "Dialogue not found" };
      if (dialogue.userId && dialogue.userId !== userId) return { success: false, error: "Access denied" };

      const count = (args.count as number) || 10;
      const nonSystem = dialogue.messages.filter((m) => m.role !== "system");
      const recent = nonSystem.slice(-Math.min(count, nonSystem.length));

      return {
        success: true,
        dialogueName: dialogue.name,
        totalMessages: nonSystem.length,
        recentMessages: recent.map((m) => ({
          role: m.role,
          content: m.content.length > 500 ? m.content.slice(0, 500) + "..." : m.content,
        })),
      };
    }
    case "update_dialogue_config": {
      if (!bookId) return { success: false, error: "需要先打开一个故事" };
      const book = await getBook(bookId, userId);
      if (!book) return { success: false, error: "Book not found" };
      if (!book.dialogue_config) return { success: false, error: "当前故事没有对话配置" };

      const patch: Partial<typeof book.dialogue_config> = {};
      if (args.time !== undefined) patch.time = args.time as string;
      if (args.place !== undefined) patch.place = args.place as string;
      if (args.npcs !== undefined) patch.npcs = args.npcs as { name: string; description: string }[];

      if (Object.keys(patch).length === 0) return { success: false, error: "没有要更新的字段" };

      const updatedConfig = { ...book.dialogue_config, ...patch };
      await updateBook(bookId, userId, { dialogue_config: updatedConfig });
      return { success: true, message: "对话配置已更新", config: updatedConfig };
    }
    case "get_plot_state": {
      if (!bookId) return { success: false, error: "需要先打开一个故事" };
      const book = await getBook(bookId, userId);
      if (!book) return { success: false, error: "Book not found" };
      if (!book.active_dialogue_id) return { success: false, error: "当前故事没有活跃对话" };

      const { getPlotState } = await import("@/lib/plot-state");
      const plotState = getPlotState(book.active_dialogue_id);

      const lines = plotState.plotLines.map((l) => ({
        title: l.title,
        status: l.status,
        createdAt: l.createdAt,
        nodes: l.nodes.map((n) => ({
          content: n.content,
          status: n.status,
          order: n.order,
          activatedAt: n.activatedAt || null,
          completedAt: n.completedAt || null,
        })),
      }));

      const totalNodes = lines.reduce((sum, l) => sum + l.nodes.length, 0);
      const activeNodes = lines.reduce((sum, l) => sum + l.nodes.filter((n) => n.status === "active").length, 0);
      const completedNodes = lines.reduce((sum, l) => sum + l.nodes.filter((n) => n.status === "completed").length, 0);
      const pendingNodes = lines.reduce((sum, l) => sum + l.nodes.filter((n) => n.status === "pending").length, 0);

      return {
        success: true,
        summary: {
          totalLines: lines.length,
          activeLines: lines.filter((l) => l.status === "active").length,
          archivedLines: lines.filter((l) => l.status === "archived").length,
          totalNodes,
          activeNodes,
          completedNodes,
          pendingNodes,
          lastAnalyzedAt: plotState.lastAnalyzedAt,
          lastGeneratedAt: plotState.lastGeneratedAt,
        },
        lines,
      };
    }
    case "get_plot_prompts": {
      const generatePrompt = `你是一个创意故事策划师。根据当前故事进展，为故事生成可能的分支剧情线。

已有剧情线：
{已有剧情线列表}

主要角色：{角色名列表}
当前地点：{地点}

请生成 1-3 条新的剧情线（不要与已有剧情线重复标题），每条剧情线包含 2-4 个具体节点。

剧情方向应该多样化，随机涵盖：
- 和缓路线（日常、温情、成长）
- 紧张路线（冲突、危机、对抗）
- 反转路线（意外、背叛、真相揭露）
- 高风险高回报路线（冒险、赌注、重大抉择）

返回 JSON 格式：
{
  "lines": [
    {
      "title": "剧情线标题（简短）",
      "direction": "路线类型描述",
      "nodes": [
        { "content": "节点1内容（具体的故事情节描述）" },
        { "content": "节点2内容" }
      ]
    }
  ]
}`;

      const analyzePrompt = `你是一个剧情状态追踪器。根据最新的对话内容，判断以下剧情节点的状态变化。

当前激活的节点：
{激活节点列表}

待激活的节点：
{待激活节点列表}

请返回 JSON，格式如下（只列出有变化的节点）：
{
  "activations": ["剧情线标题::节点内容"],  // pending→active
  "completions": ["剧情线标题::节点内容"],  // active→completed
  "skips": ["剧情线标题::节点内容"],        // pending→skipped（情节跳跃）
  "archiveLines": ["剧情线标题"]            // 整条线归档
}

注意：
1. 只返回 JSON，不要其他文字
2. 只列出确实有变化的节点
3. 如果没有任何变化，返回空对象 {}`;

      const refinePrompt = `你是一个故事策划师。用户给你一个粗略的情节方向，你将其展开为 2-4 个具体的故事节点。

返回 JSON：
{
  "title": "剧情线标题（简短）",
  "nodes": [
    { "content": "节点1的具体情节描述" },
    { "content": "节点2的具体情节描述" }
  ]
}

注意：只返回 JSON，不要其他文字。节点按故事发展顺序排列。`;

      return {
        success: true,
        prompts: {
          generate: {
            name: "剧情生成 (generate-plot)",
            description: "根据对话内容和已有剧情线，生成 1-3 条新的分支剧情线。每条线包含 2-4 个节点。",
            prompt: generatePrompt,
          },
          analyze: {
            name: "剧情分析 (analyze-plot)",
            description: "根据最新对话内容，追踪剧情节点的状态变化。判断哪些节点完成了、应该激活下一个、或应该跳过。",
            prompt: analyzePrompt,
          },
          refine: {
            name: "剧情展开 (refine-plot)",
            description: "将用户粗略的情节想法展开为 2-4 个具体故事节点。",
            prompt: refinePrompt,
          },
        },
        note: "剧情分析匹配规则：\n1. 节点匹配使用「剧情线标题::节点内容」的精确文本匹配\n2. 完成一个 active 节点后会自动激活该线的下一个 pending 节点\n3. 同一条线只能有一个 active 节点\n4. 如果分析提示词中的节点内容与对话实际进展语义不匹配，LLM 可能无法正确识别完成/激活",
      };
    }
    default:
      return { success: false, error: `Unknown tool: ${name}` };
  }
}

/* ── handler ───────────────────────────────────────── */

export async function POST(req: NextRequest) {
  try {
    const userId = await requireUserId();
    if (userId === "NEEDS_SETUP") {
      return new Response(JSON.stringify({ error: "请先完成初始化设置" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const { messages, baseUrl, apiKey, modelId, task, bookId, contextBook, contextPersona } = await req.json();

    if (!apiKey) return new Response("API Key is required", { status: 400 });
    if (!modelId) return new Response("Model ID is required", { status: 400 });

    // 如果指定了 bookId，验证该书属于当前用户
    if (bookId) {
      const book = await getBook(bookId, userId);
      if (!book) {
        return new Response(JSON.stringify({ error: "Book not found" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        });
      }
    }

    const client = new OpenAI({ apiKey, baseURL: baseUrl.replace(/\/$/, "") });

    const systemContent = buildSystemPrompt(task, userId, bookId, contextBook, contextPersona);
    const tools = buildTools(task, bookId);

    const llmMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: "system", content: systemContent },
      ...messages.map((m: { role: string; content: string }) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
    ];

    // Compaction: if user messages > 40, trim middle to save context
    const COMPACT_THRESHOLD = 40;
    const KEEP_FIRST = 5;
    const KEEP_LAST = 25;
    let compacted = false;
    const userMsgs = messages.filter((m: { role: string }) => m.role !== "system");
    if (userMsgs.length > COMPACT_THRESHOLD) {
      const first = userMsgs.slice(0, KEEP_FIRST);
      const last = userMsgs.slice(-KEEP_LAST);
      // Rebuild llmMessages: system + first + compaction marker + last
      llmMessages.length = 0;
      llmMessages.push({ role: "system", content: systemContent });
      for (const m of first) {
        llmMessages.push({ role: m.role as "user" | "assistant", content: m.content });
      }
      llmMessages.push({
        role: "system",
        content: "【较早的对话已被压缩以节省上下文空间。以下是最近的对话：】",
      });
      for (const m of last) {
        llmMessages.push({ role: m.role as "user" | "assistant", content: m.content });
      }
      compacted = true;
    }

    const encoder = new TextEncoder();

    const readable = new ReadableStream({
      async start(controller) {
        try {
          const stream1 = await client.chat.completions.create({
            model: modelId,
            messages: llmMessages,
            stream: true,
            tools,
            tool_choice: tools ? "auto" : undefined,
          });

          let toolCalls: Map<number, { id: string; name: string; args: string }> = new Map();
          let reasoningContent = "";

          for await (const chunk of stream1) {
            const delta = chunk.choices[0]?.delta;
            const d = delta as Record<string, unknown>;

            if (d?.reasoning_content)
              reasoningContent += d.reasoning_content as string;

            if (delta?.tool_calls) {
              for (const tc of delta.tool_calls) {
                const idx = tc.index;
                if (!toolCalls.has(idx))
                  toolCalls.set(idx, { id: tc.id || "", name: tc.function?.name || "", args: "" });
                const e = toolCalls.get(idx)!;
                if (tc.id) e.id = tc.id;
                if (tc.function?.name) e.name = tc.function.name;
                if (tc.function?.arguments) e.args += tc.function.arguments;
              }
            }

            if (delta?.content) {
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ text: delta.content })}\n\n`)
              );
            }
          }

          if (toolCalls.size > 0) {
            for (const [, tc] of toolCalls) {
              try {
                const args = JSON.parse(tc.args);
                const result = await executeToolCall(tc.name, args, userId, bookId);

                controller.enqueue(
                  encoder.encode(
                    `data: ${JSON.stringify({ tool_result: { name: tc.name, ...result } })}\n\n`
                  )
                );

                // append assistant tool_call + tool result for follow-up
                llmMessages.push({
                  role: "assistant",
                  content: null,
                  ...(reasoningContent ? { reasoning_content: reasoningContent } : {}),
                  tool_calls: [{
                    id: tc.id,
                    type: "function" as const,
                    function: { name: tc.name, arguments: tc.args },
                  }],
                } as OpenAI.Chat.Completions.ChatCompletionMessageParam);
                llmMessages.push({
                  role: "tool",
                  tool_call_id: tc.id,
                  content: JSON.stringify(result),
                });

                // stream follow-up response
                const stream2 = await client.chat.completions.create({
                  model: modelId,
                  messages: llmMessages,
                  stream: true,
                });
                for await (const chunk of stream2) {
                  const delta = chunk.choices[0]?.delta?.content;
                  if (delta) {
                    controller.enqueue(
                      encoder.encode(`data: ${JSON.stringify({ text: delta })}\n\n`)
                    );
                  }
                }
              } catch (err) {
                const msg = err instanceof Error ? err.message : "执行失败";
                controller.enqueue(
                  encoder.encode(
                    `data: ${JSON.stringify({ tool_result: { name: tc.name, success: false, error: msg } })}\n\n`
                  )
                );
              }
            }
          }

          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        } catch (err) {
          const message = err instanceof Error ? err.message : "Unknown error";
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ error: message })}\n\n`)
          );
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
