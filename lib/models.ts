import type { Model } from "./types";
export const base: Model[] = [
  ["llama32", "Llama 3.2", "Meta", "3B", "meta-llama/Llama-3.2-3B-Instruct"],
  ["llama31", "Llama 3.1", "Meta", "8B", "meta-llama/Llama-3.1-8B-Instruct"],
  ["qwen354", "Qwen 3.5", "Qwen", "4B", "Qwen/Qwen3.5-4B"],
  ["qwen359", "Qwen 3.5", "Qwen", "9B", "Qwen/Qwen3.5-9B"],
  ["qwen3527", "Qwen 3.5", "Qwen", "27B", "Qwen/Qwen3.5-27B"],
  ["qwen314", "Qwen 3", "Qwen", "14B", "Qwen/Qwen3-14B"],
  ["gemma412", "Gemma 4", "Google", "12B", "google/gemma-4-12B-it"],
  ["gemma431", "Gemma 4", "Google", "31B", "google/gemma-4-31B-it"],
  ["olmo", "OLMo 3 Instruct", "Ai2", "7B", "allenai/Olmo-3-7B-Instruct"],
  ["olmothink", "OLMo 3 Think", "Ai2", "7B", "allenai/Olmo-3-7B-Think"],
].map(([id, name, family, size, checkpoint]) => ({
  id,
  name,
  family,
  size,
  checkpoint,
  verified: true,
  source: `https://huggingface.co/${checkpoint}`,
  routes: [],
}));
