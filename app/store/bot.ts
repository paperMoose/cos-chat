import { nanoid } from "nanoid";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { LLMConfig } from "../client/platforms/llm";
import { ChatSession, ChatMessage, createEmptySession } from "./session";
import { createDemoBots, createEmptyBot } from "@/app/bots/bot.data";

export type Share = {
  id: string;
};

export type Bot = {
  id: string;
  name: string;
  hideContext: boolean;
  context: ChatMessage[];
  modelConfig: LLMConfig;
  readOnly: boolean;
  botHello: string | null;
  datasource?: string;
  share?: Share;
  createdAt?: number;
  session: ChatSession;
};

type BotState = {
  bots: Record<string, Bot>;
  currentBotId: string;
};

type BotStore = BotState & {
  currentBot: () => Bot;
  selectBot: (id: string) => void;
  currentSession: () => ChatSession;
  updateBotSession: (
    updater: (session: ChatSession) => void,
    botId: string,
  ) => void;
  get: (id: string) => Bot | undefined;
  getByShareId: (shareId: string) => Bot | undefined;
  getAll: () => Bot[];
  create: (
    bot?: Partial<Bot>,
    options?: { readOnly?: boolean; reset?: boolean },
  ) => Bot;
  update: (id: string, updater: (bot: Bot) => void) => void;
  delete: (id: string) => void;
  restore: (state: BotState) => void;
  backup: () => BotState;
  clearAllData: () => void;
};

const demoBots = createDemoBots();

export const useBotStore = create<BotStore>()(
  persist(
    (set, get) => ({
      bots: demoBots,
      currentBotId:
        Object.keys(demoBots).length > 0
          ? Object.values(demoBots)[0].id
          : "empty",
      currentBot() {
        const bots = get().bots;
        const currentBotId = get().currentBotId;

        // If no bots are available, return an empty or default bot
        if (Object.keys(bots).length === 0) {
          return createEmptyBot();
        }

        // If currentBotId is "empty" and there are bots available, select the first bot
        if (currentBotId === "empty" && Object.keys(bots).length > 0) {
          const firstBotId = Object.keys(bots)[0];
          return bots[firstBotId];
        }

        // Return the bot with the currentBotId
        return bots[currentBotId];
      },
      selectBot(id) {
        set(() => ({ currentBotId: id }));
      },
      currentSession() {
        const currentBot = get().currentBot();
        if (!currentBot) {
          // If currentBot is undefined, return a default or empty session
          return createEmptySession();
        }
        return currentBot.session;
      },
      updateBotSession(updater, botId) {
        const bots = get().bots;
        let bot = bots[botId];

        if (!bot) {
          // If the bot doesn't exist, create a new one
          const newBot = {
            ...createEmptyBot(), // Assuming this function creates a new empty bot
            id: botId, // Use the provided botId for the new bot
            session: createEmptySession(), // Assuming this function creates a new empty session
          };
          bots[botId] = newBot;
          bot = newBot;
        }

        // Update the session of the bot
        updater(bot.session);
        set(() => ({ bots }));
      },
      get(id) {
        return get().bots[id] || undefined;
      },
      getAll() {
        const list = Object.values(get().bots).map((b) => ({
          ...b,
          createdAt: b.createdAt || 0,
        }));
        return list.sort((a, b) => b.createdAt - a.createdAt);
      },
      getByShareId(shareId) {
        return get()
          .getAll()
          .find((b) => shareId === b.share?.id);
      },
      create(bot, options) {
        const bots = get().bots;
        const id = nanoid();
        const session = createEmptySession();
        bots[id] = {
          ...createEmptyBot(),
          ...bot,
          id,
          session,
          readOnly: options?.readOnly || false,
        };
        if (options?.reset) {
          bots[id].share = undefined;
        }
        set(() => ({ bots }));
        return bots[id];
      },
      update(id, updater) {
        const bots = get().bots;
        const bot = bots[id];
        if (!bot) return;
        const updateBot = { ...bot };
        updater(updateBot);
        bots[id] = updateBot;
        set(() => ({ bots }));
      },
      delete(id) {
        const bots = JSON.parse(JSON.stringify(get().bots));
        delete bots[id];

        let nextId = get().currentBotId;
        if (nextId === id) {
          nextId = Object.keys(bots)[0];
        }
        set(() => ({ bots, currentBotId: nextId }));
      },

      backup() {
        return get();
      },
      restore(state: BotState) {
        if (!state.bots) {
          throw new Error("no state object");
        }
        set(() => ({ bots: state.bots }));
      },
      clearAllData() {
        localStorage.clear();
        location.reload();
      },
    }),
    {
      name: "bot-store",
    },
  ),
);
