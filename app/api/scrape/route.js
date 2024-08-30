import { NextResponse } from 'next/server';
import { PuppeteerWebBaseLoader } from "@langchain/community/document_loaders/web/puppeteer";
import * as cheerio from "cheerio";
import * as puppeteer from "puppeteer";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { Document } from "langchain/document";
import { OpenAIEmbeddings } from "@langchain/openai";
import { PineconeStore } from "@langchain/pinecone";
import { Pinecone as PineconeClient } from "@pinecone-database/pinecone";



const pinecone = new PineconeClient({
    apiKey: process.env.PINECONE_API_KEY,
});

const pineconeIndex = pinecone.Index(process.env.PINECONE_INDEX);
const embeddings = new OpenAIEmbeddings({
    openAIApiKey: process.env.OPENAI_API_KEY,
    model: "text-embedding-3-small",
});





export async function POST(request) {

    try {

        const { url } = await request.json()

        console.log('Making the call to:', url);
    

        const loader = new PuppeteerWebBaseLoader(url, {
            launchOptions: {
              headless: "new",
            },
            async evaluate(page, browser) {
              try {
                await page.goto(url, { waitUntil: "networkidle0" });
                const textContent = await page.evaluate(() => {
                  // Clean up the HTML content and extract the text
                  const bodyElement = document.querySelector("body");
                  return bodyElement ? bodyElement.textContent : "";
                });
                await browser.close();
                return textContent || "";
              } catch (error) {
                console.error("Error occurred while loading the page: ", error);
                await browser.close();
                return ""; // return empty string in case of an error
              }
            },
        });


    
        console.log("Loading URL to Docs");
    
        const urlDocs = await loader.load();
        const pageContent = urlDocs[0].pageContent; // Access the extracted text content
    
        // Load the HTML content into cheerio
        const $ = cheerio.load(pageContent);
    
        $("script, style").remove(); // Remove unnecessary elements
    
        // Further clean-up using regular expressions (example)
        const cleanedText = $("body")
        .html()
        ?.replace(/<style[^>]*>.*<\/style>/gms, "");
    
        // Load the cleaned HTML again to extract text
        const cleaned$ = cheerio.load(cleanedText);
    
        const textContent = cleaned$("body").text();
    
        const docs = textContent.replace(/[^\x20-\x7E]+/g, ""); // Remove non-ASCII characters
    
        // Create Document instances
        const documents = [new Document({ pageContent: docs })];
    
        const splitter = new RecursiveCharacterTextSplitter({
        chunkSize: 1000,
        chunkOverlap: 200,
        });
    
        const splitDocuments = await splitter.splitDocuments(documents);    
        // console.log(splitDocuments);

        

        //pinecone storage and vector embeddings

        const vectorStore = await PineconeStore.fromExistingIndex(embeddings, {
            pineconeIndex,
            maxConcurrency: 3,
        });


        for (const doc of splitDocuments) {
            if (doc.pageContent.trim()) { // Ensure that the content is not just empty or whitespace
                await vectorStore.addDocuments([doc]);
            }
        }

        return NextResponse.json({ success: true, message: 'Embeddings stored successfully.' });

        // return NextResponse.json(splitDocuments);


    } catch (error) {
        console.error("Error in server-side code:", error);
        return NextResponse.json({ error: 'Failed to process the URL.' }, { status: 500 });
    }
    
}



