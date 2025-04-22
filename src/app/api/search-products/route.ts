// app/api/search-products.ts

import { OpenAI } from 'openai';
import { Pinecone } from '@pinecone-database/pinecone';
import { NextRequest, NextResponse } from 'next/server';


// Types
interface Product {
  id: string;
  name: string;
  price: string;
  image: string;
  link: string;
  description?: string;
}

interface PineconeSearchResult {
  id: string;
  score: number;
  values: number[];
  metadata: {
    name: string;
    price: string;
    image: string;
    link: string;
    description?: string;
    [key: string]: any;
  };
}

// Environment variables (store these in .env.local)
const OPENAI_API_KEY = process.env.OPENAI_API_KEY!;
const PINECONE_API_KEY = process.env.PINECONE_API_KEY!;
const PINECONE_ENVIRONMENT = process.env.PINECONE_ENVIRONMENT!;
const PINECONE_INDEX = process.env.PINECONE_INDEX!;

// --- UTILS ---

const initializeOpenAI = () => {
  return new OpenAI({
    apiKey: OPENAI_API_KEY
  });
};

const initializePinecone = () => {
  return new Pinecone({
    apiKey: PINECONE_API_KEY,
    maxRetries: 3, // optional
  });
};

const generateEmbedding = async (query: string): Promise<number[]> => {
  const openai = initializeOpenAI();
  const response = await openai.embeddings.create({
    model: 'text-embedding-ada-002',
    input: query
  });
  return response.data[0].embedding;
};

const searchPinecone = async (embedding: number[]): Promise<PineconeSearchResult[]> => {
  const pinecone = initializePinecone();
  const index = pinecone.index(PINECONE_INDEX);

  const queryResponse = await index.query({
    vector: embedding,
    topK: 10,
    includeValues: false,
    includeMetadata: true
  });

  return queryResponse.matches as PineconeSearchResult[];
};

const generateResponse = async (
  query: string,
  searchResults: PineconeSearchResult[]
): Promise<string> => {
  if (searchResults.length === 0) {
    return "I couldn't find any products matching your query. Could you try describing what you're looking for differently?";
  }

  const openai = initializeOpenAI();

  const productInfo = searchResults
    .map((result, index) => {
      const { name, price, description = '' } = result.metadata;
      return `Product ${index + 1}: ${name}\nPrice: ${price}\nDescription: ${description}\nSimilarity Score: ${result.score.toFixed(2)}`;
    })
    .join('\n\n');

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content:
          `You are a friendly shopping assistant. Your task is to recommend products based on the user's query and the search results provided. Be conversational, helpful, and suggest the most relevant products.`
      },
      {
        role: 'user',
        content: `User query: "${query}"\n\nAvailable products:\n${productInfo}`
      }
    ],
    max_tokens: 250
  });

  return response.choices[0].message.content || "I found some products that might interest you!";
};

const mapResultsToProducts = (results: PineconeSearchResult[]): Product[] => {
  return results.map((result) => ({
    id: result.id,
    name: result.metadata.name,
    price: result.metadata.price,
    image: result.metadata.picture,
    link: result.metadata.url,
    description: result.metadata.short_description || result.metadata.description,
    category: result.metadata.category || 'General',
  }));
};

// --- HANDLER ---

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { query } = body;

    console.log('Received query:', query);

    if (!query || typeof query !== 'string') {
      return NextResponse.json({ error: 'Missing or invalid query' }, { status: 400 });
    }

    const embedding = await generateEmbedding(query);
    const searchResults = await searchPinecone(embedding);
    const message = await generateResponse(query, searchResults);
    const products = mapResultsToProducts(searchResults);

    return NextResponse.json({ message, products });
  } catch (error: any) {
    console.error('Error in App Route API:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}