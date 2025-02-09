import axios from 'axios';
import FormData from 'form-data';
import config from '../config/index.js';
import { handleFulfilled, handleRejected, handleRequest } from './utils/index.js';

export const ROLE_SYSTEM = 'system';
export const ROLE_AI = 'assistant';
export const ROLE_HUMAN = 'user';

export const FINISH_REASON_STOP = 'stop';
export const FINISH_REASON_LENGTH = 'length';

export const IMAGE_SIZE_256 = '256x256';
export const IMAGE_SIZE_512 = '512x512';
export const IMAGE_SIZE_1024 = '1024x1024';


export const MODEL_GPT_4_OMNI = 'gpt-4o-mini';
export const MODEL_WHISPER_1 = 'whisper-1';
export const MODEL_DALL_E_3 = 'dall-e-3';

const client = axios.create({
  baseURL: config.OPENAI_BASE_URL,
  timeout: config.OPENAI_TIMEOUT,
  headers: {
    'Accept-Encoding': 'gzip, deflate, compress',
  },
});

client.interceptors.request.use((c) => {
  c.headers.Authorization = `Bearer ${config.OPENAI_API_KEY}`;
  return handleRequest(c);
});

client.interceptors.response.use(handleFulfilled, (err) => {
  if (err.response?.data?.error?.message) {
    err.message = err.response.data.error.message;
  }
  return handleRejected(err);
});

const hasImage = ({ messages }) => (
  messages.some(({ content }) => (
    Array.isArray(content) && content.some((item) => item.image_url)
  ))
);

const createChatCompletion = ({
  model = config.OPENAI_COMPLETION_MODEL,
  messages,
  temperature = config.OPENAI_COMPLETION_TEMPERATURE,
  maxTokens = config.OPENAI_COMPLETION_MAX_TOKENS,
  frequencyPenalty = config.OPENAI_COMPLETION_FREQUENCY_PENALTY,
  presencePenalty = config.OPENAI_COMPLETION_PRESENCE_PENALTY,
}) => {
  const body = {
    model: hasImage({ messages }) ? config.OPENAI_VISION_MODEL : model,
    messages,
    temperature,
    max_tokens: maxTokens,
    frequency_penalty: frequencyPenalty,
    presence_penalty: presencePenalty,
  };
  return client.post('/v1/chat/completions', body);
};

const createImage = ({
  model = config.OPENAI_IMAGE_GENERATION_MODEL,
  prompt,
  size = config.OPENAI_IMAGE_GENERATION_SIZE,
  quality = config.OPENAI_IMAGE_GENERATION_QUALITY,
  n = 1,
}) => {
  // set image size to 1024 when using the DALL-E 3 model and the requested size is 256 or 512.
  if (model === MODEL_DALL_E_3 && [IMAGE_SIZE_256, IMAGE_SIZE_512].includes(size)) {
    size = IMAGE_SIZE_1024;
  }

  return client.post('/v1/images/generations', {
    model,
    prompt,
    size,
    quality,
    n,
  });
};

const createAudioTranscriptions = ({
  buffer,
  file,
  model = MODEL_WHISPER_1,
}) => {
  const formData = new FormData();
  formData.append('file', buffer, file);
  formData.append('model', model);
  return client.post('/v1/audio/transcriptions', formData.getBuffer(), {
    headers: formData.getHeaders(),
  });
};

export {
  createAudioTranscriptions,
  createChatCompletion,
  createImage,
};

import axios from 'axios';
import NodeCache from 'node-cache';

const apiUrl = 'https://free.v36.cm';  // 這是你的 API 接口
const cache = new NodeCache({ stdTTL: 60 });  // 設定快取時間為 60 秒

export async function getApiResponse(endpoint, params) {
  // 嘗試從快取中讀取資料
  const cacheKey = JSON.stringify({ endpoint, params });  // 使用請求的 endpoint 和參數作為快取的 key
  const cachedResponse = cache.get(cacheKey);

  if (cachedResponse) {
    return cachedResponse;  // 如果有快取資料，直接返回
  }

  try {
    const response = await axios.post(`${apiUrl}${endpoint}`, params, { timeout: 5000 });

    // 將回應資料儲存到快取中
    cache.set(cacheKey, response.data);

    return response.data;
  } catch (error) {
    console.error('API 請求錯誤：', error);
    throw new Error('請求錯誤');
  }
}

export async function sendResponseInParts(responseText, lineBot) {
  const MAX_LENGTH = 1000;  // 每段回應的最大長度
  const parts = [];

  // 將回應分割成多段
  for (let i = 0; i < responseText.length; i += MAX_LENGTH) {
    parts.push(responseText.slice(i, i + MAX_LENGTH));
  }

  // 將每段內容發送給用戶
  for (const part of parts) {
    await lineBot.sendMessage(part);  // 使用你自己的發送訊息邏輯
  }
}
