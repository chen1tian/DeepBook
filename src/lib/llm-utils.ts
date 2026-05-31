import { getUserPreferences } from "./user-prefs";
import { getPreset } from "./presets";
import type OpenAI from "openai";

type ChatMessage = OpenAI.Chat.Completions.ChatCompletionMessageParam;

/** 根据当前激活的预设，构建注入到 LLM 消息顶部的 system 提示词 */
function buildPresetPrompt(userId: string): string | null {
  const prefs = getUserPreferences(userId);
  if (!prefs.activePresetId) return null;
  const preset = getPreset(prefs.activePresetId, userId);
  if (!preset) return null;

  const parts: string[] = [];
  parts.push(`## 当前写作预设：${preset.name}`);
  parts.push(`**模式**：${preset.mode === "novel" ? "小说" : "角色扮演"} | **人称**：${preset.pov === "first" ? "第一人称" : "第三人称"}`);
  if (preset.role) {
    parts.push(`\n${preset.role}`);
  }
  if (preset.rules) {
    parts.push(`\n### 写作规则\n${preset.rules}`);
  }
  return parts.join("\n");
}

/**
 * 所有 LLM 消息的统一预处理入口。
 * 如果用户设置了激活的写作预设，在消息列表最顶部注入预设的 system 提示词。
 * 所有 API 路由在发送 LLM 请求前都应调用此函数。
 */
export function applyActivePreset(
  messages: ChatMessage[],
  userId?: string
): ChatMessage[] {
  if (!userId) return messages;
  const prompt = buildPresetPrompt(userId);
  if (!prompt) return messages;
  return [
    { role: "system", content: prompt },
    ...messages,
  ];
}
