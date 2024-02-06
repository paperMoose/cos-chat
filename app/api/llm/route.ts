import OpenAI from "openai";
import { NextRequest, NextResponse } from "next/server";
import { LLMConfig } from "../../client/platforms/llm";
import { Embedding } from "@/app/client/fetch/url";
import {
  ChatHistory,
  ChatMessage,
  IndexDict,
  MessageType,
  ServiceContext,
  SimpleChatHistory,
  TextNode,
  VectorStoreIndex,
} from "llamaindex";
import { Message } from "ai";

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
        const responseContent = chunk.text || "";
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

function createChatHistoryPrompt(messages: ChatMessage[]): string {
  // Check if messages is defined and is an array
  if (!Array.isArray(messages)) {
    // Handle the undefined or incorrect type case, perhaps by logging an error or returning a default value
    console.error(
      "createChatHistoryPrompt was called with an undefined or non-array messages argument",
    );
    return ""; // Return an empty string or some default value as appropriate
  }

  return messages
    .map(
      (message) =>
        `${message.role === "user" ? "User:" : "Assistant:"} ${
          message.content
        }`,
    )
    .join("\n");
}

async function checkAndWakeUpLargeModel(
  statsUrl: string,
  bigModelUrl: string,
  apiKey: string,
): Promise<boolean> {
  // Fetch the current model stats to check the availability of the larger model
  const statsResponse = await fetch(statsUrl, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });

  if (!statsResponse.ok) {
    console.error("Failed to fetch model stats");
    return false; // Indicates failure to check larger model stats
  }

  const stats: { num_total_runners: number } = await statsResponse.json();

  // If no runners are available for the larger model, attempt to wake it up
  if (stats.num_total_runners === 0) {
    // Send "up" to the larger model without waiting for confirmation
    await fetch(bigModelUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ question: "up", messageHistory: "" }), // Special request to wake up the model
    });

    return false; // Indicate that the larger model had 0 runners and an attempt was made to wake it up
  }

  return true; // The larger model has runners and is considered ready
}

async function* fetchCompletionAsStream(
  userQuestion: string,
  messages: ChatMessage[],
) {
  if (!Array.isArray(messages)) {
    throw new Error(
      "fetchCompletionAsStream was called with an undefined or non-array messages argument",
    );
  }

  // Define model URLs
  const smallModelUrl =
    "https://chatopensource--vllm-mistral-tiny.modal.run/completion/";
  const bigModelUrl =
    "https://chatopensource--vllm-mixtral.modal.run/completion/";
  const statsUrl = "https://chatopensource--vllm-mixtral.modal.run/stats";

  const modelReady = await checkAndWakeUpLargeModel(
    statsUrl,
    bigModelUrl,
    process.env.INFERENCE_API_KEY as string,
  );
  const modelUrl = modelReady ? bigModelUrl : smallModelUrl;

  // Format chat history
  const messageHistory: string = createChatHistoryPrompt(messages);

  // Prepare the data with both fields as strings
  const data = {
    question: userQuestion,
    messageHistory: messageHistory,
  };

  // Assuming INFERENCE_API_KEY is stored as an environment variable
  const apiKey = process.env.INFERENCE_API_KEY;
  if (!apiKey) {
    throw new Error('The environment variable "INFERENCE_API_KEY" is not set.');
  }

  const response = await fetch(modelUrl, {
    method: "POST",
    headers: {
      Accept: "text/event-stream",
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`, // Add the Authorization header here
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    throw new Error("Network response was not ok");
  }

  const reader = response.body?.getReader();
  const decoder = new TextDecoder();

  try {
    if (reader) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const textChunk: string = decoder.decode(value, { stream: true });

        // Split the chunk into individual SSE messages
        const eventStrings = textChunk.split("\n\n");

        for (const eventString of eventStrings) {
          if (eventString.startsWith("data: ")) {
            // Extract the JSON string from the SSE message
            const jsonString = eventString.replace("data: ", "").trim();
            if (jsonString) {
              try {
                // Parse the JSON string
                const data = JSON.parse(jsonString);

                yield data;
              } catch (e) {
                console.error("Error parsing JSON: ", e);
                // If JSON parsing fails for one message, log the error and continue to the next
              }
            }
          }
        }
      }
    }
  } finally {
    reader?.releaseLock();
  }
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

    // const stream = await openai.chat.completions.create({
    //   model: config.model,
    //   messages: [
    //     { role: "user", content: message },
    //     ...messages.map((msg) => ({
    //       role: msg.role as "user" | "assistant",
    //       content: msg.content,
    //     })),
    //   ],
    //   stream: true,
    // });
    // Assuming 'messages' is an array of message objects with 'role' and 'content'
    const last10Messages = messages.slice(-10); // Get only the last 10 messages

    const chatMessages = [
      { role: "user" as MessageType, content: message },
      ...last10Messages.map((msg) => ({
        role: msg.role as MessageType,
        content: msg.content,
      })),
    ];
    // console.log(chatMessages)
    const stream = fetchCompletionAsStream(message, chatMessages);

    // const chatHistory = new SimpleChatHistory({ messages: [] }); // Adapt as needed

    // const readableStream = createReadableStream(stream, chatHistory);

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
