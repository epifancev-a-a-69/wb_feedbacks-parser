// src/ai/ai.service.ts
import { Injectable } from '@nestjs/common';
import GigaChat from 'gigachat';
import { Agent } from 'node:https';
import { ProcessedFeedback } from '../feedback/feedback.service';
import { GIGACHAT_CREDENTIALS } from '../config';

export interface AnalysisResult {
  overview: string;
  highlights: string[];
  changes: {
    summary: string;
    positive: string[];
    negative: string[];
  };
  rawResponse?: string; // Если модель не вернула JSON — весь ответ здесь
}

@Injectable()
export class AiService {
  private readonly client: GigaChat;

  constructor() {
    const httpsAgent = new Agent({ rejectUnauthorized: false });

    if (!GIGACHAT_CREDENTIALS) {
      console.warn('⚠️ [AI] Ключ GigaChat не указан. AI-анализ будет недоступен.');
    }

    this.client = new GigaChat({
      timeout: 60,
      model: 'GigaChat',
      credentials: GIGACHAT_CREDENTIALS,
      httpsAgent: httpsAgent,
    });
  }

  // ========================
  // СВОДКА БЕЗ СРАВНЕНИЯ
  // ========================
  async summarize(feedbacks: ProcessedFeedback[]): Promise<AnalysisResult> {
    // Проверка ключа
    if (!GIGACHAT_CREDENTIALS) {
      console.log('[AI] Ключ отсутствует, возвращаю заглушку');
      return {
        overview: 'AI-анализ недоступен — не указан ключ GigaChat API. Создайте файл src/config.ts (см. config.example.ts)',
        highlights: [],
        changes: { summary: '', positive: [], negative: [] },
      };
    }

    const texts = feedbacks
      .map(fb => `[${fb.valuation}/5] ${fb.text || fb.pros} ${fb.cons ? '| Минусы: ' + fb.cons : ''}`)
      .join('\n---\n');

    const prompt = `Ты помогаешь покупателям разобраться в товаре. Прочитай отзывы и расскажи, что о нём говорят люди.

ОТЗЫВЫ:
${texts}

Верни ОТВЕТ СТРОГО В ФОРМАТЕ JSON-ОБЪЕКТА. Не добавляй ни одной буквы после закрывающей скобки. Не используй markdown.

{
  "overview": "Напиши 3 предложения. 1: общее настроение покупателей — они скорее довольны или нет? 2: главное, за что хвалят. 3: главное, на что жалуются.",
  "highlights": ["факт 1", "факт 2", "факт 3", "факт 4", "факт 5"],
  "changes": {
    "summary": "Нет данных для сравнения",
    "positive": [],
    "negative": []
  }
}

ПРАВИЛА:
- overview — живой рассказ о впечатлениях, не список фактов
- highlights — ровно 5 КОНКРЕТНЫХ наблюдений, которые помогут решить, брать товар или нет
- Каждый highlight — законченное предложение, не начинай с "пользователи отмечают"
- Не выдумывай того, чего нет в отзывах`;

    console.log(`[AI] Сводка по ${feedbacks.length} отзывам...`);

    const response = await this.client.chat({
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.5,
      max_tokens: 1000,
    });

    const content = response.choices[0]?.message?.content || '{}';
    console.log('[AI] Сырой ответ (первые 200):', content.substring(0, 200));
    return this.parseAndNormalize(content);
  }

  // ========================
  // СРАВНЕНИЕ СТАРЫХ И НОВЫХ
  // ========================
  async analyze(
    oldFeedbacks: ProcessedFeedback[],
    newFeedbacks: ProcessedFeedback[],
  ): Promise<AnalysisResult> {
    // Проверка ключа
    if (!GIGACHAT_CREDENTIALS) {
      console.log('[AI] Ключ отсутствует, возвращаю заглушку');
      return {
        overview: 'AI-анализ недоступен — не указан ключ GigaChat API. Создайте файл src/config.ts (см. config.example.ts)',
        highlights: [],
        changes: { summary: '', positive: [], negative: [] },
      };
    }
    const oldTexts = oldFeedbacks
      .map(fb => `[${fb.valuation}/5] ${fb.text || fb.pros} ${fb.cons ? '| Минусы: ' + fb.cons : ''}`)
      .join('\n---\n') || 'Нет старых отзывов';

    const newTexts = newFeedbacks
      .map(fb => `[${fb.valuation}/5] ${fb.text || fb.pros} ${fb.cons ? '| Минусы: ' + fb.cons : ''}`)
      .join('\n---\n');

    const prompt = `Ты помогаешь покупателям отслеживать изменения в товаре. Сравни старые и новые отзывы и расскажи, что изменилось.

СТАРЫЕ ОТЗЫВЫ:
${oldTexts}

НОВЫЕ ОТЗЫВЫ:
${newTexts}

Верни ОТВЕТ СТРОГО В ФОРМАТЕ JSON-ОБЪЕКТА. Не добавляй ни одной буквы после закрывающей скобки. Не используй markdown.

{
  "overview": "Напиши 3 предложения. 1: общее настроение по всем отзывам. 2: главное, за что хвалят. 3: главное, на что жалуются.",
  "highlights": ["факт 1", "факт 2", "факт 3", "факт 4", "факт 5"],
  "changes": {
    "summary": "Напиши 2 предложения: стало лучше, хуже или без изменений, и главное изменение",
    "positive": [],
    "negative": []
  }
}

ПРАВИЛА:
- overview — эмоциональная картина, не список фактов
- highlights — ровно 5 КОНКРЕТНЫХ фактов из ЛЮБЫХ отзывов (и старых, и новых)
- changes.summary — общий вывод об изменениях
- changes.positive — что стало лучше: жалобы исчезли, появились новые похвалы
- changes.negative — что стало хуже: новые жалобы, старые стали чаще
- Если изменений нет — оставь positive и negative пустыми
- НЕ ДОМЫСЛИВАЙ причины: пиши "меньше жалоб на...", а не "производитель улучшил..."
- Не выдумывай фактов`;

    console.log(`[AI] Сравнение: ${oldFeedbacks.length} старых + ${newFeedbacks.length} новых`);

    const response = await this.client.chat({
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.5,
      max_tokens: 1500,
    });

    const content = response.choices[0]?.message?.content || '{}';
    console.log('[AI] Сырой ответ (первые 200):', content.substring(0, 200));
    return this.parseAndNormalize(content);
  }

  // ========================
  // ПАРСИНГ + НОРМАЛИЗАЦИЯ
  // ========================
  private parseAndNormalize(content: string): AnalysisResult {
    let parsed: any = null;
    let usedRaw = false;

    // Попытка 1: прямой парсинг
    try {
      let clean = content.replace(/```json\s*/g, '').replace(/```/g, '').trim();
      parsed = JSON.parse(clean);
      console.log('[AI] Парсинг: попытка 1 — успех');
    } catch (e) {
      // Попытка 2: найти { } внутри текста
      try {
        const first = content.indexOf('{');
        const last = content.lastIndexOf('}');
        if (first !== -1 && last !== -1 && last > first) {
          let inner = content.slice(first, last + 1);
          inner = inner.replace(/\\"/g, '"').replace(/\\n/g, ' ');
          parsed = JSON.parse(inner);
          console.log('[AI] Парсинг: попытка 2 — успех');
        }
      } catch (e2) {
        // Попытка 3: двойная вложенность
        try {
          const first = JSON.parse(content);
          if (typeof first === 'string') {
            parsed = JSON.parse(first);
            console.log('[AI] Парсинг: попытка 3 — двойная вложенность');
          } else {
            parsed = first;
            console.log('[AI] Парсинг: попытка 3 — сразу объект');
          }
        } catch (e3) {
          usedRaw = true;
          console.log('[AI] Все попытки провалены — возвращаю rawResponse');
        }
      }
    }

    // Если не смогли — возвращаем весь текст в rawResponse
    if (usedRaw || !parsed) {
      return {
        overview: 'Модель не смогла обработать отзывы',
        highlights: [],
        changes: { summary: '', positive: [], negative: [] },
        rawResponse: content.trim(),
      };
    }

    // НОРМАЛИЗАЦИЯ
    if (typeof parsed !== 'object' || parsed === null) {
      return {
        overview: 'Модель не смогла обработать отзывы',
        highlights: [],
        changes: { summary: '', positive: [], negative: [] },
        rawResponse: String(parsed),
      };
    }

    // Если есть summary на верхнем уровне — переносим в changes
    if (parsed.summary && !parsed.changes) {
      parsed.changes = {
        summary: parsed.summary || '',
        positive: parsed.positive || [],
        negative: parsed.negative || [],
      };
    }

    return {
      overview: parsed.overview || parsed.summary || 'Нет данных',
      highlights: Array.isArray(parsed.highlights) ? parsed.highlights : [],
      changes: {
        summary: parsed.changes?.summary || parsed.summary || '',
        positive: Array.isArray(parsed.changes?.positive) ? parsed.changes.positive : (Array.isArray(parsed.positive) ? parsed.positive : []),
        negative: Array.isArray(parsed.changes?.negative) ? parsed.changes.negative : (Array.isArray(parsed.negative) ? parsed.negative : []),
      },
    };
  }
}