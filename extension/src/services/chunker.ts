/**
 * Arjuna Sarthi - RAG-Style Page Chunking & Relevance Retrieval Engine.
 *
 * Segments extracted web pages into structured, indexed chunks and retrieves
 * the top-ranking relevant context chunks for Groq LLM queries.
 */

import { ContentChunk, ExtractedPage, ExtractedSection } from "../types";

const STOP_WORDS = new Set([
  "a", "about", "above", "after", "again", "against", "all", "am", "an", "and",
  "any", "are", "aren't", "as", "at", "be", "because", "been", "before", "being",
  "below", "between", "both", "but", "by", "can't", "cannot", "could", "couldn't",
  "did", "didn't", "do", "does", "doesn't", "doing", "don't", "down", "during",
  "each", "few", "for", "from", "further", "had", "hadn't", "has", "hasn't",
  "have", "haven't", "having", "he", "he'd", "he'll", "he's", "her", "here",
  "here's", "hers", "herself", "him", "himself", "his", "how", "how's", "i",
  "i'd", "i'll", "i'm", "i've", "if", "in", "into", "is", "isn't", "it", "it's",
  "its", "itself", "let's", "me", "more", "most", "mustn't", "my", "myself",
  "no", "nor", "not", "of", "off", "on", "once", "only", "or", "other", "ought",
  "our", "ours", "ourselves", "out", "over", "own", "same", "shan't", "she",
  "she'd", "she'll", "she's", "should", "shouldn't", "so", "some", "such",
  "than", "that", "that's", "the", "their", "theirs", "them", "themselves",
  "then", "there", "there's", "these", "they", "they'd", "they'll", "they're",
  "they've", "this", "those", "through", "to", "too", "under", "until", "up",
  "very", "was", "wasn't", "we", "we'd", "we'll", "we're", "we've", "were",
  "weren't", "what", "what's", "when", "when's", "where", "where's", "which",
  "while", "who", "who's", "whom", "why", "why's", "with", "won't", "would",
  "wouldn't", "you", "you'd", "you'll", "you're", "you've", "your", "yours",
  "yourself", "yourselves"
]);

/**
 * Breaks extracted page sections into structured, searchable chunks (~500-900 chars).
 */
export function buildPageChunks(page: ExtractedPage): ContentChunk[] {
  const chunks: ContentChunk[] = [];
  const pageTitle = page.metadata.title;
  const pageUrl = page.metadata.url;

  page.sections.forEach((section: ExtractedSection, sIndex: number) => {
    const rawText = section.content.trim();
    if (!rawText) return;

    // Small section: keep whole
    if (rawText.length <= 900) {
      chunks.push({
        id: `chk-${sIndex + 1}-1`,
        title: pageTitle,
        heading: section.heading,
        section: section.heading,
        content: rawText,
        url: pageUrl,
      });
      return;
    }

    // Larger section: split into paragraph-aware chunks
    const paragraphs = rawText.split(/\n\n+/);
    let currentBuffer = "";
    let subChunkIdx = 1;

    for (const para of paragraphs) {
      const cleanPara = para.trim();
      if (!cleanPara) continue;

      if ((currentBuffer + "\n\n" + cleanPara).length > 800 && currentBuffer.length > 0) {
        chunks.push({
          id: `chk-${sIndex + 1}-${subChunkIdx}`,
          title: pageTitle,
          heading: section.heading,
          section: section.heading,
          content: currentBuffer.trim(),
          url: pageUrl,
        });
        subChunkIdx++;
        currentBuffer = cleanPara;
      } else {
        currentBuffer = currentBuffer ? `${currentBuffer}\n\n${cleanPara}` : cleanPara;
      }
    }

    if (currentBuffer.trim().length > 0) {
      chunks.push({
        id: `chk-${sIndex + 1}-${subChunkIdx}`,
        title: pageTitle,
        heading: section.heading,
        section: section.heading,
        content: currentBuffer.trim(),
        url: pageUrl,
      });
    }
  });

  return chunks;
}

/**
 * Tokenizes a string into meaningful search terms, filtering out stop words.
 */
function extractQueryTerms(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, " ")
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 2 && !STOP_WORDS.has(t));
}

/**
 * Selects top relevant chunks using weighted term matching, heading boosts, and length normalization.
 */
export function selectRelevantChunks(
  chunks: ContentChunk[],
  question: string,
  maxChunks: number = 6
): ContentChunk[] {
  if (chunks.length <= maxChunks) {
    return chunks;
  }

  const queryTerms = extractQueryTerms(question);

  // If question has no strong keywords (e.g. "summarize this page"), return introductory/top sections
  if (queryTerms.length === 0) {
    return chunks.slice(0, maxChunks);
  }

  const scoredChunks = chunks.map((chunk, index) => {
    let score = 0;
    const lowerContent = chunk.content.toLowerCase();
    const lowerHeading = chunk.heading.toLowerCase();

    // Baseline priority for initial sections (overview context)
    if (index < 2) {
      score += 1.5;
    }

    for (const term of queryTerms) {
      // Heading match gives high weight
      if (lowerHeading.includes(term)) {
        score += 4.0;
      }

      // Content exact occurrences
      const matches = lowerContent.split(term).length - 1;
      if (matches > 0) {
        // Log-scaled frequency boost to prevent spam skewing
        score += Math.min(matches, 5) * 1.5;
      }
    }

    return {
      ...chunk,
      relevanceScore: score,
    };
  });

  // Sort descending by score
  scoredChunks.sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0));

  // If no chunks scored above 0, return the first few sections for context
  if ((scoredChunks[0].relevanceScore || 0) === 0) {
    return chunks.slice(0, maxChunks);
  }

  return scoredChunks.slice(0, maxChunks);
}
