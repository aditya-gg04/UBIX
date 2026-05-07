/**
 * UBIX TF-IDF Vectorizer
 * 
 * Builds TF-IDF vectors from business records for
 * cosine similarity matching.
 */

export class TFIDFVectorizer {
  constructor() {
    this.vocabulary = new Map();
    this.idf = new Map();
    this.docCount = 0;
    this.termDocFreq = new Map();
  }

  fit(documents) {
    this.docCount = documents.length;
    this.termDocFreq.clear();
    this.vocabulary.clear();

    for (const doc of documents) {
      const uniqueTerms = new Set(doc);
      for (const term of uniqueTerms) {
        this.termDocFreq.set(term, (this.termDocFreq.get(term) || 0) + 1);
      }
    }

    let idx = 0;
    for (const [term, docFreq] of this.termDocFreq) {
      this.vocabulary.set(term, idx++);
      this.idf.set(term, Math.log((this.docCount + 1) / (docFreq + 1)) + 1);
    }
    return this;
  }

  transform(tokens) {
    const tf = new Map();
    for (const token of tokens) {
      tf.set(token, (tf.get(token) || 0) + 1);
    }
    const maxTf = Math.max(...tf.values(), 1);
    const vector = {};
    for (const [term, freq] of tf) {
      if (this.vocabulary.has(term)) {
        const tfidf = (freq / maxTf) * (this.idf.get(term) || 0);
        if (tfidf > 0) vector[this.vocabulary.get(term)] = tfidf;
      }
    }
    return vector;
  }

  static cosineSimilarity(vecA, vecB) {
    let dot = 0, normA = 0, normB = 0;
    for (const key in vecA) {
      normA += vecA[key] * vecA[key];
      if (key in vecB) dot += vecA[key] * vecB[key];
    }
    for (const key in vecB) normB += vecB[key] * vecB[key];
    normA = Math.sqrt(normA);
    normB = Math.sqrt(normB);
    if (normA === 0 || normB === 0) return 0;
    return dot / (normA * normB);
  }

  get size() { return this.vocabulary.size; }
}

export default TFIDFVectorizer;
