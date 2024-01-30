import OpenAI from "openai";
import { NextRequest, NextResponse } from "next/server";
import { LLMConfig } from "../../client/platforms/llm";
import { Embedding } from "@/app/client/fetch/url";
import {
  ChatHistory,
  ChatMessage,
  IndexDict,
  ServiceContext,
  SimpleChatHistory,
  TextNode,
  VectorStoreIndex,
} from "llamaindex";

async function createIndex(
  serviceContext: ServiceContext,
  embeddings: Embedding[],
) {
  const embeddingResults = embeddings.map((config) => {
    return new TextNode({ text: config.text, embedding: config.embedding });
  });
  const indexDict = new IndexDict();
  for (const node of embeddingResults) {
    indexDict.addNode(node);
  }

  const index = await VectorStoreIndex.init({
    indexStruct: indexDict,
    serviceContext: serviceContext,
  });

  index.vectorStore.add(embeddingResults);
  if (!index.vectorStore.storesText) {
    await index.docStore.addDocuments(embeddingResults, true);
  }
  await index.indexStore?.addIndexStruct(indexDict);
  index.indexStruct = indexDict;
  return index;
}

// ... [Other imports and functions for handling embeddings remain unchanged]
function createReadableStream(
  stream: AsyncIterable<any>, // Change to AsyncIterable
  chatHistory: ChatHistory,
) {
  let responseStream = new TransformStream();
  const writer = responseStream.writable.getWriter();
  let aborted = false;
  writer.closed.catch(() => {
    aborted = true; // Handle stream abortion
  });
  const encoder = new TextEncoder();

  const processStream = async () => {
    try {
      for await (const chunk of stream) {
        if (aborted) break;
        // Extract response content from the OpenAI stream chunk
        const responseContent = chunk.choices[0]?.delta?.content || "";
        // Write the response content to the response stream
        writer.write(
          encoder.encode(`data: ${JSON.stringify(responseContent)}\n\n`),
        );
      }
      // Once the stream is finished
      writer.write(
        `data: ${JSON.stringify({
          done: true,
          memoryMessage: chatHistory
            .newMessages()
            .filter((m) => m.role === "memory")
            .at(0),
        })}\n\n`,
      );
      writer.close();
    } catch (error) {
      console.error("[Your Error Log]", error);
      writer.write(
        `data: ${JSON.stringify({ error: (error as Error).message })}\n\n`,
      );
      writer.close();
    }
  };

  processStream();
  return responseStream.readable;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      message,
      chatHistory: messages,
      config,
      embeddings, // Assuming embeddings are part of the request body
    }: {
      message: string;
      chatHistory: ChatMessage[];
      config: LLMConfig;
      embeddings: Embedding[] | undefined;
    } = body;

    if (!message || !messages || !config) {
      return NextResponse.json(
        {
          error:
            "message, chatHistory, and config are required in the request body",
        },
        { status: 400 },
      );
    }

    // Handle embeddings (if provided)
    if (embeddings) {
      // Your logic to process embeddings
      // This could involve updating your context-aware index or similar functionality
    }

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    // Generate response using OpenAI
    console.log(config.model);
    console.log(config);
    const stream = await openai.chat.completions.create({
      model: config.model,
      messages: [
        { role: "user", content: message },
        ...messages.map((msg) => ({
          role: msg.role as "user" | "assistant",
          content: msg.content,
        })),
      ],
      stream: true,
    });

    const readableStream = createReadableStream(
      stream,
      new SimpleChatHistory({ messages }),
    );

    return new NextResponse(readableStream, {
      headers: {
        "Content-Type": "text/event-stream",
        Connection: "keep-alive",
        "Cache-Control": "no-cache, no-transform",
      },
    });
  } catch (error) {
    console.error("[Your Error Log]", error);
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 },
    );
  }
}
