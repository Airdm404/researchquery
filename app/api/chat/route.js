import {NextResponse} from 'next/server' 
import OpenAI from 'openai' 
import { Pinecone as PineconeClient } from "@pinecone-database/pinecone";
import { OpenAIEmbeddings } from "@langchain/openai";

const systemPrompt = "You're a highly knowledgeable research assistant, specialized in helping users extract and understand information from academic papers and technical documents. Always provide concise, accurate, and contextually relevant responses.";

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

const pinecone = new PineconeClient({
    apiKey: process.env.PINECONE_API_KEY,
});

const pineconeIndex = await pinecone.Index(process.env.PINECONE_INDEX);
const embeddings = new OpenAIEmbeddings({
  openAIApiKey: process.env.OPENAI_API_KEY,
  model: "text-embedding-3-small",
});


export async function POST(req) {


    const { query, messages } = await req.json();

    // Convert the user query to embeddings
    const queryEmbedding = await new OpenAIEmbeddings().embedQuery(query);
  
    // Search for relevant documents in Pinecone
    const searchResults = await pineconeIndex.query({
      vector: queryEmbedding,
      topK: 10, // Retrieve the top 10 similar documents
      includeMetadata: true,
    });
  
    // Combine the top documents as context
    const context = searchResults.matches.map(match => match.metadata.text).join("\n");



    const completion = await openai.chat.completions.create({
        messages: [
            { role: 'system', content: systemPrompt },
            ...messages, // Previous conversation history
            { role: 'user', content: `Based on the following context, please address the user's query:\n\nContext: ${context}\n\nUser's Query: ${query}` },
        ],
        model: 'gpt-4',
        stream: true,
    });



    // Create a ReadableStream to handle the streaming response
    const stream = new ReadableStream({
        async start(controller) {
        const encoder = new TextEncoder() // Create a TextEncoder to convert strings to Uint8Array
        try {
            // Iterate over the streamed chunks of the response
            for await (const chunk of completion) {
            const content = chunk.choices[0]?.delta?.content // Extract the content from the chunk
            if (content) {
                const text = encoder.encode(content) // Encode the content to Uint8Array
                controller.enqueue(text) // Enqueue the encoded text to the stream
            }
            }
        } catch (err) {
            controller.error(err) // Handle any errors that occur during streaming
        } finally {
            controller.close() // Close the stream when done
        }
        },
    })

    return new NextResponse(stream) // Return the stream as the response
}



